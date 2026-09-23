import crypto from 'crypto';
import { dbEngine } from '../database/sqlite.js';

export const sessionRepository = {
  createSession: (userId, tokenId, deviceInfo = 'Unknown') => {
    const sessionId = crypto.randomUUID();
    const stmt = dbEngine.db.prepare(`
      INSERT INTO user_sessions (id, user_id, token_id, device_info)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(sessionId, userId, tokenId, deviceInfo);
    return sessionId;
  },

  findSessionByTokenId: (tokenId) => {
    const stmt = dbEngine.db.prepare('SELECT * FROM user_sessions WHERE token_id = ?');
    return stmt.get(tokenId);
  },

  updateLastActivity: (tokenId) => {
    const stmt = dbEngine.db.prepare(`
      UPDATE user_sessions 
      SET last_activity = CURRENT_TIMESTAMP 
      WHERE token_id = ? AND status = 'ACTIVE'
    `);
    stmt.run(tokenId);
  },

  revokeSession: (tokenId) => {
    const stmt = dbEngine.db.prepare(`
      UPDATE user_sessions 
      SET status = 'REVOKED', logout_time = CURRENT_TIMESTAMP 
      WHERE token_id = ?
    `);
    stmt.run(tokenId);
  }
};
