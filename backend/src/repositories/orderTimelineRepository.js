import { dbEngine } from '../database/sqlite.js';

class OrderTimelineRepository {
  createEntry(entryData) {
    dbEngine.prepare(`
      INSERT INTO order_timeline (
        id, order_id, user_id, event_type, from_state, to_state, description, metadata, created_at
      ) VALUES (
        @id, @order_id, @user_id, @event_type, @from_state, @to_state, @description, @metadata, CURRENT_TIMESTAMP
      )
    `).run({
      id: entryData.id,
      order_id: entryData.order_id,
      user_id: entryData.user_id || null,
      event_type: entryData.event_type,
      from_state: entryData.from_state || null,
      to_state: entryData.to_state || null,
      description: entryData.description,
      metadata: entryData.metadata ? JSON.stringify(entryData.metadata) : null
    });

    return entryData.id;
  }

  findByOrderId(orderId) {
    const rows = dbEngine.prepare('SELECT * FROM order_timeline WHERE order_id = ? ORDER BY created_at ASC').all(orderId);
    return rows.map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    }));
  }
}

export const orderTimelineRepository = new OrderTimelineRepository();
