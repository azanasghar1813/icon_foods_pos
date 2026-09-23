import { modifierRepository } from '../repositories/modifierRepository.js';
import { catalogValidationService } from './catalogValidationService.js';
import { activityLogService } from './activityLogService.js';
import { lifecycleService } from './lifecycleService.js';
import { syncService } from './syncService.js';
import { menuCacheService } from './menuCacheService.js';

class ModifierService {
  // --- Modifier Groups ---
  createGroup(data, userId) {
    catalogValidationService.validateModifierGroup(data);
    const group = modifierRepository.createGroup(data);
    
    activityLogService.logActivity(userId, 'MODIFIER_GROUP_CREATED', 'CATALOG', group.id, { name: group.name });
    syncService.queueSyncEvent('MODIFIER_GROUP', group.id, 'CREATED', { name: group.name }, 1);
    menuCacheService.refresh();
    return group;
  }

  updateGroup(groupId, data, userId) {
    const group = modifierRepository.findGroupById(groupId);
    if (!group) throw new Error('Modifier group not found');

    const merged = { ...group, ...data };
    catalogValidationService.validateModifierGroup(merged);

    const updated = modifierRepository.updateGroup(groupId, data);
    activityLogService.logActivity(userId, 'MODIFIER_GROUP_UPDATED', 'CATALOG', groupId, { name: updated.name });
    syncService.queueSyncEvent('MODIFIER_GROUP', groupId, 'UPDATED', {}, updated.version);
    menuCacheService.refresh();
    return updated;
  }

  deleteGroup(groupId, userId) {
    lifecycleService.softDelete('MODIFIER_GROUP', groupId, userId);
  }

  archiveGroup(groupId, userId) {
    lifecycleService.archive('MODIFIER_GROUP', groupId, userId);
  }

  publishGroup(groupId, userId) {
    lifecycleService.publish('MODIFIER_GROUP', groupId, userId);
  }

  // --- Modifiers ---
  createModifier(data, userId) {
    const mod = modifierRepository.createModifier(data);
    activityLogService.logActivity(userId, 'MODIFIER_CREATED', 'CATALOG', mod.id, { name: mod.name });
    syncService.queueSyncEvent('MODIFIER', mod.id, 'CREATED', { name: mod.name }, 1);
    menuCacheService.refresh();
    return mod;
  }

  updateModifier(modId, data, userId) {
    const mod = modifierRepository.findModifierById(modId);
    if (!mod) throw new Error('Modifier not found');

    const updated = modifierRepository.updateModifier(modId, data);
    activityLogService.logActivity(userId, 'MODIFIER_UPDATED', 'CATALOG', modId, { name: updated.name });
    syncService.queueSyncEvent('MODIFIER', modId, 'UPDATED', {}, updated.version);
    menuCacheService.refresh();
    return updated;
  }

  deleteModifier(modId, userId) {
    lifecycleService.softDelete('MODIFIER', modId, userId);
  }

  archiveModifier(modId, userId) {
    lifecycleService.archive('MODIFIER', modId, userId);
  }

  publishModifier(modId, userId) {
    lifecycleService.publish('MODIFIER', modId, userId);
  }

  // --- Linking ---
  addOptionToGroup(groupId, modifierId, data, userId) {
    modifierRepository.addOptionToGroup(groupId, modifierId, data);
    menuCacheService.refresh();
  }

  removeOptionFromGroup(optionId, userId) {
    modifierRepository.removeOptionFromGroup(optionId);
    menuCacheService.refresh();
  }

  linkGroupToProduct(productId, groupId, displayOrder, userId) {
    modifierRepository.linkGroupToProduct(productId, groupId, displayOrder);
    menuCacheService.refresh();
  }

  unlinkGroupFromProduct(productId, groupId, userId) {
    modifierRepository.unlinkGroupFromProduct(productId, groupId);
    menuCacheService.refresh();
  }
}

export const modifierService = new ModifierService();
