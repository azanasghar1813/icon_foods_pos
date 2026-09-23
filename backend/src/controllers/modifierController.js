import { modifierService } from '../services/modifierService.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';
import { modifierRepository } from '../repositories/modifierRepository.js';

class ModifierController {
  // --- Modifier Groups ---
  createGroup = (req, res) => {
    try {
      const group = modifierService.createGroup(req.body, req.user.id);
      return sendSuccess(res, group, 'Modifier group created successfully', 201);
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  };

  updateModifierGroup = (req, res) => {
    try {
      const { groupId } = req.params;
      const group = modifierService.updateModifierGroup(groupId, req.body, req.user.id);
      return sendSuccess(res, group, 'Modifier group updated successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  };

  deleteModifierGroup = (req, res) => {
    try {
      const { groupId } = req.params;
      modifierService.deleteModifierGroup(groupId, req.user.id);
      return sendSuccess(res, null, 'Modifier group deleted successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  };

  getModifierGroups = (req, res) => {
    try {
      const { is_active } = req.query;
      const groups = modifierService.getModifierGroups({ is_active });
      return sendSuccess(res, groups, 'Modifier groups fetched');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  };

  // --- Modifiers ---
  createModifier = (req, res) => {
    try {
      const mod = modifierService.createModifier(req.body, req.user.id);
      return sendSuccess(res, mod, 'Modifier created successfully', 201);
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  };

  updateModifier = (req, res) => {
    try {
      const { modifierId } = req.params;
      const mod = modifierService.updateModifier(modifierId, req.body, req.user.id);
      return sendSuccess(res, mod, 'Modifier updated successfully');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  };

  getModifiers = (req, res) => {
    try {
      const mods = modifierService.getModifiers();
      return sendSuccess(res, mods, 'Modifiers fetched');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  };

  // --- Group-Modifier Links ---
  addModifierToGroup = (req, res) => {
    try {
      const { groupId, modifierId } = req.params;
      modifierService.addModifierToGroup(groupId, modifierId, req.body, req.user.id);
      return sendSuccess(res, null, 'Option added to group', 201);
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  };

  removeModifierFromGroup = (req, res) => {
    try {
      const { groupId, modifierId } = req.params;
      modifierService.removeModifierFromGroup(groupId, modifierId, req.user.id);
      return sendSuccess(res, null, 'Option removed from group');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  };

  // --- Product-Group Links ---
  linkGroupToProduct = (req, res) => {
    try {
      const { productId, groupId } = req.params;
      modifierService.linkGroupToProduct(productId, groupId, req.body, req.user.id);
      return sendSuccess(res, null, 'Group linked to product', 201);
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  };

  unlinkGroupFromProduct = (req, res) => {
    try {
      const { productId, groupId } = req.params;
      modifierService.unlinkGroupFromProduct(productId, groupId, req.user.id);
      return sendSuccess(res, null, 'Group unlinked from product');
    } catch (error) {
      return sendError(res, 400, error.message);
    }
  };
}

export const modifierController = new ModifierController();
