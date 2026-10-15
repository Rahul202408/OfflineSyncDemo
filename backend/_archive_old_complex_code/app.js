/**
 * Express Application Configuration
 * 
 * Configures middleware, routes, CORS, and standardized error handling.
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const healthRoutes = require('./routes/healthRoutes');
const productRoutes = require('./routes/productRoutes');
const syncRoutes = require('./routes/syncRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sync', syncRoutes);

// Live Visual Web Dashboard to view MongoDB data in browser
app.get('/view', async (req, res) => {
  try {
    const Product = require('./models/Product');
    const SyncOperation = require('./models/SyncOperation');

    // Purge any soft-deleted items so database stays clean
    await Product.deleteMany({ isDeleted: true }).catch(() => {});

    // Only retrieve active, non-deleted products
    const [products, syncOps] = await Promise.all([
      Product.find({ isDeleted: false }).sort({ updatedAt: -1 }).lean(),
      SyncOperation.find().sort({ processedAt: -1 }).limit(10).lean(),
    ]);

    const rows = products.map((p, idx) => `
      <tr style="border-bottom: 1px solid #E2E8F0;">
        <td style="padding: 12px; font-weight: bold; color: #1E293B;">#${idx + 1}</td>
        <td style="padding: 12px; font-weight: 700; color: #2563EB;">${p.name}</td>
        <td style="padding: 12px; font-weight: 800; color: #059669;">₹${Number(p.price).toFixed(2)}</td>
        <td style="padding: 12px; color: #334155;">${p.quantity} pcs</td>
        <td style="padding: 12px; color: #64748B;">${p.description || '-'}</td>
        <td style="padding: 12px; font-family: monospace; font-size: 11px; color: #7C3AED;">${p.localId}</td>
        <td style="padding: 12px; font-family: monospace; font-size: 11px; color: #0284C7;">${p._id}</td>
        <td style="padding: 12px; font-size: 12px; color: #475569;">${new Date(p.updatedAt).toLocaleTimeString()} ${new Date(p.updatedAt).toLocaleDateString()}</td>
        <td style="padding: 12px; text-align: center;">
          <form action="/view/delete/${p._id}" method="POST" style="margin: 0;" onsubmit="return confirm('Delete this product permanently?');">
            <button type="submit" style="background: #FEE2E2; color: #DC2626; border: 1px solid #FECACA; padding: 4px 8px; border-radius: 6px; font-weight: 700; font-size: 11px; cursor: pointer;">Delete</button>
          </form>
        </td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>MongoDB Live Data Viewer — OfflineSyncDemo</title>
        <meta http-equiv="refresh" content="5">
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; background: #F8FAFC; margin: 0; padding: 24px; color: #0F172A; }
          .container { max-width: 1200px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
          .title { font-size: 24px; font-weight: 800; color: #0F172A; }
          .badge { background: #D1FAE5; color: #065F46; padding: 6px 12px; border-radius: 20px; font-weight: 700; font-size: 13px; }
          .card { background: #FFFFFF; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #E2E8F0; overflow: hidden; margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; text-align: left; }
          th { background: #F1F5F9; padding: 12px; font-size: 12px; text-transform: uppercase; color: #475569; letter-spacing: 0.5px; }
          .meta-info { font-size: 12px; color: #64748B; margin-top: 8px; }
          a { color: #2563EB; text-decoration: none; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div>
              <div class="title">🍃 MongoDB Online Database Records</div>
              <div class="meta-info">Auto-refreshes every 5 seconds • Connected & Synced with React Native App</div>
            </div>
            <div class="badge">● MongoDB Live (${products.length} Products)</div>
          </div>

          <div class="card">
            <table>
              <thead>
                <tr>
                  <th>No</th>
                  <th>Product Name</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Description</th>
                  <th>Local SQLite ID</th>
                  <th>MongoDB _id</th>
                  <th>Last Synced</th>
                  <th style="text-align: center;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${rows.length > 0 ? rows : '<tr><td colspan="9" style="padding: 30px; text-align: center; color: #94A3B8;">No products in database. Add one in the app!</td></tr>'}
              </tbody>
            </table>
          </div>

          <p style="text-align: center; font-size: 13px; color: #64748B;">
            Raw JSON API: <a href="/api/products" target="_blank">/api/products</a> • 
            Health Check: <a href="/api/health" target="_blank">/api/health</a>
          </p>
        </div>
      </body>
      </html>
    `;
    return res.send(html);
  } catch (err) {
    return res.status(500).send(`Error loading records: ${err.message}`);
  }
});

// Delete product directly from web viewer
app.post('/view/delete/:id', async (req, res) => {
  try {
    const Product = require('./models/Product');
    await Product.deleteOne({ _id: req.params.id });
    res.redirect('/view');
  } catch (err) {
    res.status(500).send(`Failed to delete: ${err.message}`);
  }
});

// Root greeting / API info
app.get('/', (req, res) => {
  res.redirect('/view');
});

// 404 Not Found Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.originalUrl} not found`,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[App Error]', err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
});

module.exports = app;
