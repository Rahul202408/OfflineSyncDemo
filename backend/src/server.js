/**
 * ========================================================
 * OFFLINE SYNC DEMO — BACKEND SERVER (All-In-One Simple)
 * ========================================================
 * 
 * આ આખી બેકએન્ડ ફાઈલમાં ફક્ત ૪ વસ્તુઓ છે:
 * ૧. MongoDB કનેક્શન (લોકલ MongoDB અથવા ઓટોમેટિક Memory Server)
 * ૨. Product સ્કીમા (localId, name, price)
 * ૩. API રૂટ્સ:
 *    - POST   /api/sync       ➔ એપમાંથી ડેટા MongoDB માં સિંક કરવો
 *    - GET    /api/products   ➔ બધા પ્રોડક્ટ્સ લિસ્ટ જોવા
 *    - DELETE /api/products/:id ➔ પ્રોડક્ટ ડિલીટ કરવી
 * ૪. Live HTML Dashboard:
 *    - GET    /view           ➔ બ્રાઉઝરમાં લાઈવ MongoDB નો ડેટા જોવા માટે!
 */

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const net = require('net');
const os = require('os');
const { exec } = require('child_process');

const app = express();
const PORT = 5000;
const HOST = '0.0.0.0';

// ૧. Middleware (JSON ડેટા સ્વીકારવા માટે)
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ૨. MongoDB Product Schema (ડેટા કેવો સ્ટોર થશે)
const productSchema = new mongoose.Schema({
  localId: { type: String, required: true, unique: true }, // Mobile SQLite ID
  name: { type: String, required: true },
  price: { type: Number, required: true },
  updatedAt: { type: Date, default: Date.now },
});

const Product = mongoose.model('Product', productSchema);

// ૩. API Routes

// (A) હેલ્થ ચેક
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    online: true,
    database: mongoose.connection.readyState === 1 ? 'connected' : 'connecting',
  });
});

// (B) બધા પ્રોડક્ટ્સ જોવા (JSON API)
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ updatedAt: -1 });
    res.json({ success: true, count: products.length, products });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// (C) મુખ્ય સિંક API (એપ આના પર પેન્ડિંગ પ્રોડક્ટ્સ અને ડિલીટ થયેલા આઈડીઝ મોકલે છે)
app.post('/api/sync', async (req, res) => {
  const { products, deletedIds } = req.body;

  const syncedIds = [];
  const removedIds = [];

  try {
    // ૧. નવી/અપડેટ થયેલી પ્રોડક્ટ્સ મોંગોમાં સેવ કરો
    if (Array.isArray(products) && products.length > 0) {
      console.log(`[Sync] Receiving ${products.length} products from mobile app...`);
      for (const item of products) {
        await Product.findOneAndUpdate(
          { localId: String(item.id) },
          {
            localId: String(item.id),
            name: item.name,
            price: Number(item.price),
            updatedAt: new Date(),
          },
          { upsert: true, new: true }
        );
        syncedIds.push(item.id);
      }
      console.log(`[Sync] Successfully saved ${syncedIds.length} products into MongoDB!`);
    }

    // ૨. મોબાઇલમાંથી ડિલીટ થયેલી પ્રોડક્ટ્સ મોંગોમાંથી પણ કાઢી નાખો
    if (Array.isArray(deletedIds) && deletedIds.length > 0) {
      console.log(`[Sync] Deleting ${deletedIds.length} products from MongoDB...`);
      for (const delId of deletedIds) {
        await Product.deleteMany({
          $or: [
            { localId: String(delId) },
            { _id: mongoose.isValidObjectId(delId) ? delId : null }
          ]
        });
        removedIds.push(delId);
      }
      console.log(`[Sync] Successfully removed ${removedIds.length} products from MongoDB!`);
    }

    return res.json({ success: true, syncedIds, removedIds });
  } catch (err) {
    console.error('[Sync] Error during sync:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// (D) પ્રોડક્ટ ડિલીટ કરવી (localId અથવા _id દ્વારા)
app.delete('/api/products/:id', async (req, res) => {
  try {
    const id = req.params.id;
    console.log(`[Server] Request to delete product ID: ${id}`);
    const result = await Product.deleteMany({
      $or: [
        { localId: String(id) },
        { _id: mongoose.isValidObjectId(id) ? id : null }
      ]
    });
    console.log(`[Server] Deleted ${result.deletedCount} items from MongoDB`);
    res.json({ success: true, message: 'Deleted successfully', count: result.deletedCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// (E) પ્રોડક્ટ અપડેટ કરવી (localId અથવા _id દ્વારા)
app.put('/api/products/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { name, price } = req.body;
    console.log(`[Server] Request to update product ID: ${id}`);
    const updated = await Product.findOneAndUpdate(
      {
        $or: [
          { localId: String(id) },
          { _id: mongoose.isValidObjectId(id) ? id : null }
        ]
      },
      { name, price: Number(price), updatedAt: new Date() },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    console.log(`[Server] Updated product in MongoDB: ${updated.name} (₹${updated.price})`);
    res.json({ success: true, product: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ૪. બ્રાઉઝરમાં લાઈવ ડેટા જોવાનું પેજ (http://localhost:5000/view)
app.get('/view', async (req, res) => {
  try {
    const products = await Product.find().sort({ updatedAt: -1 }).lean();
    const totalValue = products.reduce((sum, p) => sum + (Number(p.price) || 0), 0);

    const rows = products.map((p, idx) => `
      <tr style="border-bottom: 1px solid #E2E8F0; transition: background 0.15s;">
        <td style="padding: 14px; font-weight: bold; color: #64748B;">#${idx + 1}</td>
        <td style="padding: 14px; font-weight: 700; color: #0F172A; font-size: 15px;">📦 ${p.name}</td>
        <td style="padding: 14px; font-weight: 800; color: #4F46E5; font-size: 15px;">₹${Number(p.price).toFixed(2)}</td>
        <td style="padding: 14px; font-family: monospace; font-size: 11px; color: #64748B; background: #F8FAFC; border-radius: 6px;">${p.localId}</td>
        <td style="padding: 14px; font-size: 12px; color: #64748B;">${new Date(p.updatedAt).toLocaleTimeString()} <span style="color: #94A3B8;">(${new Date(p.updatedAt).toLocaleDateString()})</span></td>
        <td style="padding: 14px; text-align: center;">
          <form action="/view/delete/${p._id}" method="POST" style="margin: 0;" onsubmit="return confirm('Permanently delete this product from MongoDB?');">
            <button type="submit" style="background: #FEE2E2; color: #DC2626; border: 1px solid #FECACA; padding: 6px 12px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer;">Delete 🗑️</button>
          </form>
        </td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>MongoDB Live Dashboard — OfflineSync</title>
        <meta http-equiv="refresh" content="5">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { box-sizing: border-box; }
          body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #F1F5F9; margin: 0; padding: 24px; color: #0F172A; }
          .container { max-width: 1050px; margin: 0 auto; }
          .top-bar { display: flex; justify-content: space-between; align-items: center; background: #0F172A; padding: 20px 24px; border-radius: 16px; margin-bottom: 20px; color: #FFF; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
          .top-bar h1 { margin: 0; font-size: 20px; font-weight: 900; letter-spacing: 0.5px; }
          .top-bar p { margin: 4px 0 0; font-size: 12px; color: #94A3B8; }
          .live-badge { display: flex; align-items: center; gap: 8px; background: rgba(16,185,129,0.15); color: #10B981; border: 1px solid rgba(16,185,129,0.3); padding: 6px 14px; border-radius: 20px; font-weight: 800; font-size: 12px; }
          .live-dot { width: 8px; height: 8px; border-radius: 50%; background: #10B981; animation: pulse 1.5s infinite; }
          @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
          .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 20px; }
          .stat-card { background: #FFFFFF; padding: 18px 20px; border-radius: 14px; border: 1px solid #E2E8F0; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
          .stat-card .num { font-size: 26px; font-weight: 900; color: #0F172A; margin-top: 4px; }
          .stat-card .lbl { font-size: 12px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; }
          .card { background: #FFFFFF; border-radius: 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); border: 1px solid #E2E8F0; overflow: hidden; margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; text-align: left; }
          th { background: #F8FAFC; padding: 14px; font-size: 11px; text-transform: uppercase; color: #475569; letter-spacing: 0.5px; border-bottom: 1px solid #E2E8F0; }
          tr:hover { background: #F8FAFC; }
          .footer { text-align: center; font-size: 12px; color: #64748B; }
          .footer a { color: #4F46E5; text-decoration: none; font-weight: 700; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="top-bar">
            <div>
              <h1>🍃 MongoDB Online Database Dashboard</h1>
              <p>Auto-refreshes every 5s • Real-time synced with Phone SQLite</p>
            </div>
            <div class="live-badge">
              <span class="live-dot"></span> LIVE CONNECTED
            </div>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="lbl">Total Products</div>
              <div class="num">${products.length}</div>
            </div>
            <div class="stat-card">
              <div class="lbl">Total Stock Value</div>
              <div class="num" style="color: #4F46E5;">₹${totalValue.toFixed(2)}</div>
            </div>
            <div class="stat-card">
              <div class="lbl">Sync Health</div>
              <div class="num" style="color: #10B981; font-size: 20px;">100% OK</div>
            </div>
          </div>

          <div class="card">
            <table>
              <thead>
                <tr>
                  <th>No</th>
                  <th>Product</th>
                  <th>Price</th>
                  <th>Mobile SQLite ID</th>
                  <th>Last Synced</th>
                  <th style="text-align: center;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${rows.length > 0 ? rows : '<tr><td colspan="6" style="padding: 40px; text-align: center; color: #94A3B8; font-size: 14px;">📭 No products in MongoDB yet. Add one in the mobile app!</td></tr>'}
              </tbody>
            </table>
          </div>

          <p class="footer">
            API: <a href="/api/products" target="_blank">/api/products</a> • 
            Health: <a href="/api/health" target="_blank">/api/health</a>
          </p>
        </div>
      </body>
      </html>
    `;
    res.send(html);
  } catch (err) {
    res.status(500).send(`Error loading page: ${err.message}`);
  }
});

// બ્રાઉઝરમાંથી ડિલીટ કરવા માટે
app.post('/view/delete/:id', async (req, res) => {
  try {
    await Product.deleteOne({ _id: req.params.id });
    res.redirect('/view');
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});

app.get('/', (req, res) => res.redirect('/view'));

// ૫. પોર્ટ ચેક કરવું (જો ૨૭૦૧૭ ઓપન હોય તો લોકલ મોંગો, નહિતર ઇન-મેમરી મોંગો)
function checkPortOpen(port, host = '127.0.0.1', timeout = 300) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => { socket.destroy(); resolve(false); });
    socket.connect(port, host);
  });
}

function getLocalIps() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({ name, address: iface.address });
      }
    }
  }
  return ips;
}

// ૬. MongoDB સાથે કનેક્ટ થવું અને સર્વર ચાલુ કરવું
async function start() {
  const isLocalMongoUp = await checkPortOpen(27017);

  if (isLocalMongoUp) {
    const localMongoUri = 'mongodb://127.0.0.1:27017/offline_sync_demo';
    await mongoose.connect(localMongoUri);
    console.log('✅ [MongoDB] Connected to local MongoDB server (127.0.0.1:27017)');
  } else {
    console.log('[MongoDB] Local MongoDB not running on 27017. Starting embedded in-memory MongoDB...');
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const memoryServer = await MongoMemoryServer.create();
    const memUri = memoryServer.getUri();
    await mongoose.connect(memUri);
    console.log(`✅ [MongoDB] Embedded in-memory MongoDB online at: ${memUri}`);
  }

  // જો એન્ડ્રોઇડ ફોન કનેક્ટેડ હોય તો ADB પોર્ટ ૫૦૦૦ આપોઆપ રિવર્સ કરો
  exec('adb reverse tcp:5000 tcp:5000', (err) => {
    if (!err) {
      console.log('⚡ [ADB] Port 5000 forwarded to Android device automatically!');
    }
  });

  app.listen(PORT, HOST, () => {
    const localIps = getLocalIps();
    console.log('====================================================');
    console.log(`🚀 BACKEND SERVER RUNNING AT: http://localhost:${PORT}`);
    console.log(`📊 BROWSER LIVE VIEWER:       http://localhost:${PORT}/view`);
    localIps.forEach((ip) => {
      console.log(`📱 MOBILE API BASE URL (${ip.name}): http://${ip.address}:${PORT}`);
    });
    console.log('====================================================');
  });
}

start().catch(console.error);
