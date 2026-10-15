/**
 * Product Controller
 * 
 * Handles standard REST API endpoints for product CRUD operations.
 */

const Product = require('../models/Product');

/**
 * GET /api/products
 * List products with optional search and pagination
 */
async function getProducts(req, res) {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const query = { isDeleted: false };

    if (search && search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [products, total] = await Promise.all([
      Product.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      Product.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: products,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        totalPages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (error) {
    console.error('[ProductController] getProducts error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve products',
      error: error.message,
    });
  }
}

/**
 * GET /api/products/:id
 * Retrieve a single product by MongoDB ID or local client ID
 */
async function getProductById(req, res) {
  try {
    const { id } = req.params;
    let product = await Product.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { localId: id }],
      isDeleted: false,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product with ID "${id}" not found`,
      });
    }

    return res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('[ProductController] getProductById error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve product',
      error: error.message,
    });
  }
}

/**
 * POST /api/products
 * Create a new product directly via REST
 */
async function createProduct(req, res) {
  try {
    const { localId, name, price, quantity, description } = req.body;

    if (!name || price === undefined || quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Name, price, and quantity are required',
      });
    }

    // Check if localId already exists
    if (localId) {
      const existing = await Product.findOne({ localId });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: `Product with localId "${localId}" already exists`,
          data: existing,
        });
      }
    }

    const product = new Product({
      localId: localId || require('crypto').randomUUID(),
      name,
      price: Number(price),
      quantity: Number(quantity),
      description: description || '',
    });

    await product.save();

    return res.status(201).json({
      success: true,
      data: product,
      message: 'Product created successfully',
    });
  } catch (error) {
    console.error('[ProductController] createProduct error:', error);
    return res.status(400).json({
      success: false,
      message: 'Failed to create product',
      error: error.message,
    });
  }
}

/**
 * PUT /api/products/:id
 * Update an existing product
 */
async function updateProduct(req, res) {
  try {
    const { id } = req.params;
    const { name, price, quantity, description } = req.body;

    const product = await Product.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { localId: id }],
      isDeleted: false,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product with ID "${id}" not found`,
      });
    }

    if (name !== undefined) product.name = name;
    if (price !== undefined) product.price = Number(price);
    if (quantity !== undefined) product.quantity = Number(quantity);
    if (description !== undefined) product.description = description;

    product.version = (product.version || 1) + 1;
    await product.save();

    return res.status(200).json({
      success: true,
      data: product,
      message: 'Product updated successfully',
    });
  } catch (error) {
    console.error('[ProductController] updateProduct error:', error);
    return res.status(400).json({
      success: false,
      message: 'Failed to update product',
      error: error.message,
    });
  }
}

/**
 * DELETE /api/products/:id
 * Soft-delete an existing product
 */
async function deleteProduct(req, res) {
  try {
    const { id } = req.params;

    const product = await Product.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { localId: id }],
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product with ID "${id}" not found`,
      });
    }

    product.isDeleted = true;
    await product.save();

    return res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    console.error('[ProductController] deleteProduct error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete product',
      error: error.message,
    });
  }
}

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
