import { dbEngine } from '../../database/sqlite.js';
import { searchIndexService } from './searchIndexService.js';

class RecentUsageService {
  /**
   * Loads recent usage for a specific user into the memory index.
   * Gives a slight bump to items the cashier recently interacted with.
   */
  loadIntoIndex(userId) {
    // In a multi-terminal setup with a centralized server, loading per-user into a global memory index
    // is tricky. For POS, we assume the local POS terminal cache is primarily for the logged-in cashier.
    // We will apply a fixed bump for recently used items.
    
    const rows = dbEngine.prepare(`
      SELECT entity_type, entity_id 
      FROM recent_usage 
      WHERE user_id = ?
      ORDER BY last_used_at DESC
      LIMIT 20
    `).all(userId);

    // Give higher bump to more recently used items (index 0 gets 200, index 19 gets 10)
    rows.forEach((row, index) => {
      const bump = (20 - index) * 10;
      searchIndexService.updateRecentUsage(row.entity_type, row.entity_id, bump);
    });
  }

  /**
   * Marks an item as recently used by a cashier.
   */
  markUsed(userId, entityType, entityId) {
    dbEngine.prepare(`
      INSERT INTO recent_usage (user_id, entity_type, entity_id)
      VALUES (@userId, @entityType, @entityId)
      ON CONFLICT(user_id, entity_type, entity_id) 
      DO UPDATE SET last_used_at = CURRENT_TIMESTAMP
    `).run({ userId, entityType, entityId });

    // Instantly bump in memory (arbitrary 200 max bump)
    searchIndexService.updateRecentUsage(entityType, entityId, 200);
  }

  /**
   * Gets the raw list of recently used items for suggestions.
   */
  getRecent(userId, limit = 10, entityType = 'PRODUCT') {
    return dbEngine.prepare(`
      SELECT entity_id 
      FROM recent_usage
      WHERE user_id = ? AND entity_type = ?
      ORDER BY last_used_at DESC
      LIMIT ?
    `).all(userId, entityType, limit);
  }
}

export const recentUsageService = new RecentUsageService();
