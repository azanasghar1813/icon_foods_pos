import { dbEngine } from '../database/sqlite.js';
import { syncService } from './syncService.js';
import { activityLogService } from './activityLogService.js';
import { menuCacheService } from './menuCacheService.js';

class LifecycleService {
  /**
   * Validates if a transition is allowed based on the current state.
   */
  _validateTransition(currentState, newState) {
    if (currentState === 'DELETED' && newState !== 'ARCHIVED' && newState !== 'DRAFT') {
      throw new Error(`Cannot transition directly from DELETED to ${newState}`);
    }
    // Future: implement more strict enterprise transition rules if necessary.
  }

  /**
   * Helper to resolve the correct table for a given entity type.
   */
  _getTableForEntity(entityType) {
    switch(entityType.toUpperCase()) {
      case 'PRODUCT': return 'products';
      case 'VARIANT': return 'product_variants';
      case 'CATEGORY': return 'categories';
      case 'MODIFIER_GROUP': return 'modifier_groups';
      case 'MODIFIER': return 'modifiers';
      case 'DEAL': return 'deals';
      default: throw new Error(`Unknown entity type: ${entityType}`);
    }
  }

  /**
   * Generic method to transition an entity's lifecycle state.
   * Updates state, bumps version, queues sync, logs activity, and triggers cache refresh.
   */
  transitionState(entityType, entityId, newState, userId) {
    const table = this._getTableForEntity(entityType);
    
    // 1. Fetch current state
    const current = dbEngine.prepare(`SELECT lifecycle_state, version FROM ${table} WHERE id = ?`).get(entityId);
    if (!current) throw new Error(`${entityType} not found.`);

    // 2. Validate transition
    this._validateTransition(current.lifecycle_state, newState);

    if (current.lifecycle_state === newState) return; // No change needed

    const newVersion = current.version + 1;

    // 3. Update database
    dbEngine.prepare(`
      UPDATE ${table} 
      SET lifecycle_state = ?, version = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(newState, newVersion, entityId);

    // 4. Log Activity
    activityLogService.logActivity(
      userId,
      `${entityType.toUpperCase()}_STATE_CHANGED`,
      'CATALOG',
      entityId,
      { old_state: current.lifecycle_state, new_state: newState, version: newVersion }
    );

    // 5. Queue Sync Event
    syncService.queueSyncEvent(entityType.toUpperCase(), entityId, 'STATE_CHANGED', { state: newState }, newVersion);

    // 6. Refresh Cache
    // In a fully optimized system, we would do menuCacheService.refreshEntity(entityType, entityId).
    // For now, we trigger a global refresh, or a specific product refresh if we implement it.
    menuCacheService.refresh();
  }

  // --- Convenience Methods ---

  publish(entityType, entityId, userId) {
    this.transitionState(entityType, entityId, 'ACTIVE', userId);
  }

  archive(entityType, entityId, userId) {
    this.transitionState(entityType, entityId, 'ARCHIVED', userId);
  }

  hide(entityType, entityId, userId) {
    this.transitionState(entityType, entityId, 'HIDDEN', userId);
  }

  temporarilyDisable(entityType, entityId, userId) {
    this.transitionState(entityType, entityId, 'UNAVAILABLE', userId);
  }

  softDelete(entityType, entityId, userId) {
    this.transitionState(entityType, entityId, 'DELETED', userId);
  }
}

export const lifecycleService = new LifecycleService();
