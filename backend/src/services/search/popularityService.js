import { dbEngine } from '../../database/sqlite.js';
import { searchIndexService } from './searchIndexService.js';

class PopularityService {
  /**
   * Loads all popularity scores from the database into the memory index.
   * This provides instant suggestions upon startup.
   */
  loadIntoIndex() {
    console.log('[PopularityService] Loading persistence into search index...');
    // For search ranking, we might combine TODAY + THIS_WEEK + ALL_TIME with different weights.
    // To keep it simple, we use ALL_TIME for general search ranking, and expose TODAY for specific suggestions.
    
    const rows = dbEngine.prepare(`
      SELECT entity_type, entity_id, score 
      FROM item_popularity 
      WHERE time_window = 'ALL_TIME'
    `).all();

    rows.forEach(row => {
      searchIndexService.updatePopularity(row.entity_type, row.entity_id, row.score);
    });
  }

  /**
   * Incrementally updates the popularity score for a given entity and time window.
   * This should be called by the Order Engine when an order is COMPLETED.
   */
  increment(entityType, entityId, quantity = 1) {
    const windows = ['TODAY', 'THIS_WEEK', 'THIS_MONTH', 'ALL_TIME'];
    
    // Using a transaction to ensure all windows are updated safely
    const updateStmt = dbEngine.prepare(`
      INSERT INTO item_popularity (entity_type, entity_id, time_window, score)
      VALUES (@entityType, @entityId, @timeWindow, @quantity)
      ON CONFLICT(entity_type, entity_id, time_window) 
      DO UPDATE SET score = score + @quantity, updated_at = CURRENT_TIMESTAMP
    `);

    dbEngine.transaction(() => {
      windows.forEach(win => {
        updateStmt.run({
          entityType,
          entityId,
          timeWindow: win,
          quantity
        });
      });
    });

    // Update the memory index specifically for ALL_TIME (or a weighted formula)
    const allTimeScore = dbEngine.prepare(`
      SELECT score FROM item_popularity 
      WHERE entity_type = ? AND entity_id = ? AND time_window = 'ALL_TIME'
    `).get(entityType, entityId);

    if (allTimeScore) {
      searchIndexService.updatePopularity(entityType, entityId, allTimeScore.score);
    }
  }

  /**
   * Decrements popularity (e.g. for Refunds or Cancelled Orders)
   */
  decrement(entityType, entityId, quantity = 1) {
    // Exact inverse of increment
    this.increment(entityType, entityId, -quantity);
  }

  /**
   * Fetches the top N most popular items for a specific time window.
   */
  getTopPopular(timeWindow = 'TODAY', limit = 10, entityType = 'PRODUCT') {
    return dbEngine.prepare(`
      SELECT entity_id, score 
      FROM item_popularity
      WHERE time_window = ? AND entity_type = ? AND score > 0
      ORDER BY score DESC, updated_at DESC
      LIMIT ?
    `).all(timeWindow, entityType, limit);
  }

  /**
   * Background task: Rebuilds popularity metrics from historical order data.
   * (Placeholder: will be integrated when the Order Engine is built).
   */
  rebuildFromHistory() {
    console.log('[PopularityService] Background rebuild triggered.');
    // 1. Wipe current table: DELETE FROM item_popularity
    // 2. Iterate through all COMPLETED historical orders
    // 3. For each order item, calculate quantity
    // 4. Determine business day, week, month for the order timestamp
    // 5. Aggregate and bulk insert into item_popularity
    // 6. Reload into searchIndexService
    console.log('[PopularityService] Rebuild complete.');
  }
}

export const popularityService = new PopularityService();
