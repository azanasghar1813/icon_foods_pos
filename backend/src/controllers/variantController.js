import { variantService } from '../services/variantService.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

class VariantController {
  createVariant = (req, res) => {
    try {
      const { productId } = req.params;
      const variant = variantService.createVariant(productId, req.body, req.user.id);
      return sendSuccess(res, variant, 'Variant created successfully', 201);
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  };

  updateVariant = (req, res) => {
    try {
      const { variantId } = req.params;
      const variant = variantService.updateVariant(variantId, req.body, req.user.id);
      return sendSuccess(res, variant, 'Variant updated successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  };

  deleteVariant = (req, res) => {
    try {
      const { variantId } = req.params;
      variantService.deleteVariant(variantId, req.user.id);
      return sendSuccess(res, null, 'Variant deleted successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  };
}

export const variantController = new VariantController();
