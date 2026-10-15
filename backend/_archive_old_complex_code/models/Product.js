/**
 * Product Mongoose Model
 * 
 * Stores synced products in online MongoDB with stable localId reference,
 * versioning for conflict detection, and soft-delete support.
 */

const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    localId: {
      type: String,
      required: [true, 'Local client identifier (localId) is required'],
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: [0, 'Price cannot be negative'],
    },
    quantity: {
      type: Number,
      required: [true, 'Product quantity is required'],
      min: [0, 'Quantity cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Quantity must be an integer',
      },
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  }
);

// Index for text search on name
productSchema.index({ name: 'text', description: 'text' });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
