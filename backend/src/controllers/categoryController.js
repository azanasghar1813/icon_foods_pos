import { categoryService } from '../services/categoryService.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

export const getCategories = (req, res) => {
  try {
    const categories = categoryService.getAllCategories();
    sendSuccess(res, categories, 'Categories retrieved successfully');
  } catch (error) {
    sendError(res, 500, 'Failed to retrieve categories', error.message);
  }
};

export const getCategoryById = (req, res) => {
  try {
    const category = categoryService.getCategoryById(req.params.id);
    if (!category) {
      return sendError(res, 404, 'Category not found');
    }
    sendSuccess(res, category, 'Category retrieved successfully');
  } catch (error) {
    sendError(res, 500, 'Failed to retrieve category', error.message);
  }
};

export const createCategory = (req, res) => {
  try {
    const { name } = req.body;

    const category = categoryService.createCategory(req.body, req.user.id);
    sendSuccess(res, category, 'Category created successfully', 201);
  } catch (error) {
    sendError(res, 500, 'Failed to create category', error.message);
  }
};

export const updateCategory = (req, res) => {
  try {
    const category = categoryService.updateCategory(req.params.id, req.body, req.user.id);
    sendSuccess(res, category, 'Category updated successfully');
  } catch (error) {
    sendError(res, 500, 'Failed to update category', error.message);
  }
};

export const deleteCategory = (req, res) => {
  try {
    categoryService.deleteCategory(req.params.id, req.user.id);
    sendSuccess(res, null, 'Category deleted successfully');
  } catch (error) {
    if (error.message === 'Category not found') {
      return sendError(res, 404, error.message);
    }
    sendError(res, 500, 'Failed to delete category', error.message);
  }
};
