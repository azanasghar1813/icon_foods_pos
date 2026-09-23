import crypto from 'crypto';
import { dbEngine } from '../database/sqlite.js';

export const printerRepository = {
  findAll: () => {
    const stmt = dbEngine.db.prepare('SELECT * FROM printers ORDER BY created_at ASC');
    return stmt.all();
  },

  findById: (id) => {
    const stmt = dbEngine.db.prepare('SELECT * FROM printers WHERE id = ?');
    return stmt.get(id);
  },

  create: (printerData) => {
    const id = crypto.randomUUID();
    const stmt = dbEngine.db.prepare(`
      INSERT INTO printers (id, name, type, driver_type, connection_string, ip_address, port, paper_width, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      printerData.name,
      printerData.type,
      printerData.driver_type || 'ESCPOS_LAN',
      printerData.connection_string || null,
      printerData.ipAddress || null,
      printerData.port || null,
      printerData.paperWidth || 80,
      printerData.isActive === undefined ? 1 : (printerData.isActive ? 1 : 0)
    );
    return id;
  },

  update: (id, printerData) => {
    const stmt = dbEngine.db.prepare(`
      UPDATE printers 
      SET name = ?, type = ?, driver_type = ?, connection_string = ?, ip_address = ?, port = ?, paper_width = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(
      printerData.name,
      printerData.type,
      printerData.driver_type || 'ESCPOS_LAN',
      printerData.connection_string || null,
      printerData.ipAddress || null,
      printerData.port || null,
      printerData.paperWidth || 80,
      printerData.isActive ? 1 : 0,
      id
    );
  },

  delete: (id) => {
    const stmt = dbEngine.db.prepare('DELETE FROM printers WHERE id = ?');
    stmt.run(id);
  }
};
