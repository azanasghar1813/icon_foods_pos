export default {
  version: '009',
  name: 'search_popularity',

  up: (db) => {
    // ----------------------------------------------------
    // Item Popularity (Derived Analytics)
    // ----------------------------------------------------
    db.exec(`
      CREATE TABLE IF NOT EXISTS item_popularity (
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        time_window TEXT NOT NULL, -- 'TODAY', 'THIS_WEEK', 'THIS_MONTH', 'ALL_TIME'
        score REAL NOT NULL DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (entity_type, entity_id, time_window)
      );
    `);

    // ----------------------------------------------------
    // Recent Usage (Session / Cashier)
    // ----------------------------------------------------
    db.exec(`
      CREATE TABLE IF NOT EXISTS recent_usage (
        user_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, entity_type, entity_id)
      );
    `);

    // Indexes for fast querying
    db.exec(`CREATE INDEX IF NOT EXISTS idx_popularity_score ON item_popularity(time_window, score DESC);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_recent_usage_time ON recent_usage(user_id, last_used_at DESC);`);
  },

  down: (db) => {
    db.exec(`DROP TABLE IF EXISTS item_popularity;`);
    db.exec(`DROP TABLE IF EXISTS recent_usage;`);
  }
};
