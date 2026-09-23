import { productService } from '../services/productService.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

export const searchProducts = (req, res) => {
  try {
    const { q } = req.query;
    // If there is a query, search from cache. Otherwise return all products from cache.
    const products = q ? productService.searchProducts(q) : productService.getAllProducts();
    sendSuccess(res, products, 'Products retrieved successfully');
  } catch (error) {
    sendError(res, 500, 'Failed to search products', error.message);
  }
};

export const getProductById = (req, res) => {
  try {
    const product = productService.getProductById(req.params.id);
    if (!product) {
      return sendError(res, 404, 'Product not found');
    }
    sendSuccess(res, product, 'Product retrieved successfully');
  } catch (error) {
    sendError(res, 500, 'Failed to retrieve product', error.message);
  }
};

export const createProduct = (req, res) => {
  try {
    const { name, category_id, price } = req.body;

    const product = productService.createProduct(req.body, req.user.id);
    sendSuccess(res, product, 'Product created successfully', 201);
  } catch (error) {
    if (error.message.includes('already exists')) {
      return sendError(res, 409, error.message);
    }
    sendError(res, 500, 'Failed to create product', error.message);
  }
};

export const updateProduct = (req, res) => {
  try {
    const product = productService.updateProduct(req.params.id, req.body, req.user.id);
    sendSuccess(res, product, 'Product updated successfully');
  } catch (error) {
    if (error.message.includes('already exists')) {
      return sendError(res, 409, error.message);
    }
    sendError(res, 500, 'Failed to update product', error.message);
  }
};

export const deleteProduct = (req, res) => {
  try {
    productService.deleteProduct(req.params.id, req.user.id);
    sendSuccess(res, null, 'Product deleted successfully');
  } catch (error) {
    if (error.message === 'Product not found') {
      return sendError(res, 404, error.message);
    }
    sendError(res, 500, 'Failed to delete product', error.message);
  }
};

export const uploadProductImage = (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, 400, 'No image file provided');
    }
    
    // Check if it should be marked as primary
    const isPrimary = req.body.is_primary === 'true' || req.body.is_primary === '1' || req.body.is_primary === true;
    
    const result = productService.uploadImage(req.params.id, req.file, isPrimary);
    sendSuccess(res, result, 'Image uploaded successfully');
  } catch (error) {
    sendError(res, 500, 'Failed to upload image', error.message);
  }
};

export const deleteProductImage = (req, res) => {
  try {
    const { id, imageId } = req.params;
    if (!id || !imageId) {
      return sendError(res, 400, 'Product ID and Image ID are required');
    }
    productService.removeImage(imageId, req.user.id);
    sendSuccess(res, null, 'Image deleted successfully');
  } catch (error) {
    if (error.message === 'Image not found') {
      return sendError(res, 404, error.message);
    }
    sendError(res, 500, 'Failed to delete image', error.message);
  }
};
