export default {
  version: '016',
  name: 'print_engine',
  disableForeignKeys: true,

  up: (db) => {
    // ─────────────────────────────────────────────────────────────────────────
    // 1. Extend printers table with print-engine columns
    // ─────────────────────────────────────────────────────────────────────────
    const printerCols = db.prepare('PRAGMA table_info(printers)').all().map(c => c.name);

    const printerExtensions = [
      ['status',               'TEXT NOT NULL DEFAULT \'OFFLINE\''],
      ['connection_type',      'TEXT NOT NULL DEFAULT \'USB\''],
      ['driver_type',          'TEXT NOT NULL DEFAULT \'VIRTUAL\''],
      ['paper_width',          'INTEGER NOT NULL DEFAULT 80'],
      ['margins_mm',           'INTEGER NOT NULL DEFAULT 3'],
      ['copies',               'INTEGER NOT NULL DEFAULT 1'],
      ['auto_cut',             'INTEGER NOT NULL DEFAULT 1'],
      ['cash_drawer_enabled',  'INTEGER NOT NULL DEFAULT 0'],
      ['cash_drawer_pin',      'INTEGER NOT NULL DEFAULT 2'],
      ['char_width',           'INTEGER NOT NULL DEFAULT 48'],
      ['station_type',         'TEXT'],
      ['updated_at',           'DATETIME DEFAULT CURRENT_TIMESTAMP'],
    ];

    for (const [col, def] of printerExtensions) {
      if (!printerCols.includes(col)) {
        db.exec(`ALTER TABLE printers ADD COLUMN ${col} ${def}`);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Print Jobs Table — the persistent print queue
    //    Survives application restart. Never deleted (completed jobs kept for audit).
    // ─────────────────────────────────────────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS print_jobs (
        id                TEXT PRIMARY KEY,
        printer_id        TEXT,                          -- NULL = use default for job_type
        job_type          TEXT NOT NULL,                 -- see PrintJobType enum
        status            TEXT NOT NULL DEFAULT 'PENDING', -- PENDING|PROCESSING|COMPLETED|FAILED|CANCELLED
        payload           TEXT NOT NULL,                 -- JSON: full print data (receipt/ticket/report)
        order_id          TEXT,                          -- FK for order-related jobs
        order_number      TEXT,                          -- snapshot for quick display
        cashier_user_id   TEXT,
        shift_id          TEXT,
        branch_id         TEXT NOT NULL DEFAULT 'DEFAULT_BRANCH',
        retries           INTEGER NOT NULL DEFAULT 0,
        max_retries       INTEGER NOT NULL DEFAULT 5,
        next_retry_at     DATETIME,
        last_error        TEXT,
        priority          INTEGER NOT NULL DEFAULT 5,    -- 1 (highest) … 10 (lowest)
        created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
        processing_at     DATETIME,
        completed_at      DATETIME,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
      );
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Reprint Log Table — tracks every reprint for audit
    // ─────────────────────────────────────────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS reprint_log (
        id                  TEXT PRIMARY KEY,
        print_job_id        TEXT NOT NULL,               -- new print job created for this reprint
        original_job_id     TEXT,                        -- the job being reprinted
        order_id            TEXT,
        receipt_id          TEXT,
        cashier_user_id     TEXT NOT NULL,
        reprint_count       INTEGER NOT NULL DEFAULT 1,  -- how many times this order was reprinted total
        reason              TEXT,
        branch_id           TEXT NOT NULL DEFAULT 'DEFAULT_BRANCH',
        created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
      );
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Printer Status Log — historical status for diagnostics
    // ─────────────────────────────────────────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS printer_status_log (
        id            TEXT PRIMARY KEY,
        printer_id    TEXT NOT NULL,
        status        TEXT NOT NULL,  -- ONLINE|OFFLINE|PRINTING|BUSY|ERROR|PAPER_OUT|DISCONNECTED
        error_detail  TEXT,
        job_id        TEXT,
        recorded_at   DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Performance Indexes
    // ─────────────────────────────────────────────────────────────────────────
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_print_jobs_status       ON print_jobs(status);
      CREATE INDEX IF NOT EXISTS idx_print_jobs_order        ON print_jobs(order_id);
      CREATE INDEX IF NOT EXISTS idx_print_jobs_type_status  ON print_jobs(job_type, status);
      CREATE INDEX IF NOT EXISTS idx_print_jobs_next_retry   ON print_jobs(next_retry_at) WHERE status = 'FAILED';
      CREATE INDEX IF NOT EXISTS idx_print_jobs_created      ON print_jobs(created_at);
      CREATE INDEX IF NOT EXISTS idx_reprint_log_order       ON reprint_log(order_id);
      CREATE INDEX IF NOT EXISTS idx_reprint_log_cashier     ON reprint_log(cashier_user_id);
      CREATE INDEX IF NOT EXISTS idx_printer_status_printer  ON printer_status_log(printer_id, recorded_at);
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Seed default printer station types for existing printers
    // ─────────────────────────────────────────────────────────────────────────
    db.exec(`
      UPDATE printers SET station_type = 'RECEIPT' WHERE type = 'Receipt' AND station_type IS NULL;
      UPDATE printers SET station_type = 'FAST_FOOD' WHERE type = 'Fast Food' AND station_type IS NULL;
      UPDATE printers SET station_type = 'RESTAURANT' WHERE type = 'Restaurant' AND station_type IS NULL;
      UPDATE printers SET station_type = 'KITCHEN' WHERE station_type IS NULL;
    `);
  },

  down: (db) => {
    console.warn('Manual rollback required for 016_print_engine.');
  }
};
