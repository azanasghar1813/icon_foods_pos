import { dbEngine } from '../database/sqlite.js';

class CartCacheRepository {
  saveCart(sessionId, cashierUserId, branchId, cartData) {
    const jsonStr = typeof cartData === 'object' ? JSON.stringify(cartData) : cartData;
    
    dbEngine.prepare(`
      INSERT INTO cart_cache (session_id, cashier_user_id, branch_id, cart_data, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(session_id) DO UPDATE SET
        cashier_user_id = excluded.cashier_user_id,
        branch_id = excluded.branch_id,
        cart_data = excluded.cart_data,
        updated_at = CURRENT_TIMESTAMP
    `).run(sessionId, cashierUserId, branchId || 'DEFAULT_BRANCH', jsonStr);
  }

  getCart(sessionId) {
    const row = dbEngine.prepare('SELECT * FROM cart_cache WHERE session_id = ?').get(sessionId);
    if (!row) return null;
    try {
      return JSON.parse(row.cart_data);
    } catch (e) {
      return null;
    }
  }

  deleteCart(sessionId) {
    dbEngine.prepare('DELETE FROM cart_cache WHERE session_id = ?').run(sessionId);
  }
}

export const cartCacheRepository = new CartCacheRepository();
