import { dealService } from '../services/dealService.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

export const getDeals = (req, res) => {
  try {
    const deals = dealService.getAllDeals();
    sendSuccess(res, deals, 'Deals retrieved successfully');
  } catch (error) {
    sendError(res, 500, 'Failed to retrieve deals', error.message);
  }
};

export const getDealById = (req, res) => {
  try {
    const deal = dealService.getDealById(req.params.id);
    if (!deal) {
      return sendError(res, 404, 'Deal not found');
    }
    sendSuccess(res, deal, 'Deal retrieved successfully');
  } catch (error) {
    sendError(res, 500, 'Failed to retrieve deal', error.message);
  }
};

export const createDeal = (req, res) => {
  try {
    const { code, name, price } = req.body;
    if (!code || !name || price === undefined) {
      return sendError(res, 400, 'Code, name, and price are required');
    }

    const deal = dealService.createDeal(req.body, req.user.id);
    sendSuccess(res, deal, 'Deal created successfully', 201);
  } catch (error) {
    sendError(res, 500, 'Failed to create deal', error.message);
  }
};

export const updateDeal = (req, res) => {
  try {
    const deal = dealService.updateDeal(req.params.id, req.body, req.user.id);
    sendSuccess(res, deal, 'Deal updated successfully');
  } catch (error) {
    sendError(res, 500, 'Failed to update deal', error.message);
  }
};

export const deleteDeal = (req, res) => {
  try {
    dealService.deleteDeal(req.params.id, req.user.id);
    sendSuccess(res, null, 'Deal deleted successfully');
  } catch (error) {
    if (error.message === 'Deal not found') {
      return sendError(res, 404, error.message);
    }
    sendError(res, 500, 'Failed to delete deal', error.message);
  }
};
