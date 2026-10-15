/**
 * Product Data Validation Utility
 * 
 * Validates product input on the client before saving to SQLite
 * and sending to the backend REST API.
 */

export function validateProduct(data) {
  const errors = {};

  // Validate Name
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.name = 'Product name is required';
  } else if (data.name.trim().length < 2) {
    errors.name = 'Product name must be at least 2 characters';
  } else if (data.name.trim().length > 100) {
    errors.name = 'Product name cannot exceed 100 characters';
  }

  // Validate Price
  const numPrice = Number(data.price);
  if (data.price === '' || data.price === null || data.price === undefined || isNaN(numPrice)) {
    errors.price = 'Valid price is required';
  } else if (numPrice < 0) {
    errors.price = 'Price cannot be negative';
  }

  // Validate Quantity
  const numQty = Number(data.quantity);
  if (data.quantity === '' || data.quantity === null || data.quantity === undefined || isNaN(numQty)) {
    errors.quantity = 'Valid quantity is required';
  } else if (!Number.isInteger(numQty) || numQty < 0) {
    errors.quantity = 'Quantity must be a positive whole number (0 or more)';
  }

  // Validate Description (optional)
  if (data.description && typeof data.description === 'string' && data.description.length > 500) {
    errors.description = 'Description cannot exceed 500 characters';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export default validateProduct;
