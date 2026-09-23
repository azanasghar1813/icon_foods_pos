import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

class DatabaseEngine {
  constructor() {
    if (DatabaseEngine.instance) {
      return DatabaseEngine.instance;
    }
    this.db = null;
    this.dbPath = null;
    this.WAL_SIZE_THRESHOLD = 64 * 1024 * 1024; // 64 MB
    this._checkpointTimer = null;
    DatabaseEngine.instance = this;
  }

  connect(dbPath) {
    if (this.db) {
      return this.db;
    }

    this.dbPath = dbPath;

    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath, {
      verbose: process.env.NODE_ENV === 'development' ? console.log : null,
      fileMustExist: false
    });

    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 30000');
    this.db.pragma('cache_size = -64000');
    this.db.pragma('temp_store = MEMORY');
    // Explicit safety net: keep SQLite's own default auto-checkpoint active
    // (this is the default already, but declared here so it's never silently
    // disabled by a future change elsewhere in the codebase).
    this.db.pragma('wal_autocheckpoint = 1000');

    return this.db;
  }

  /**
   * Performs a WAL checkpoint and reports whether it actually completed.
   * Returns { success, busy, pagesInWal, pagesCheckpointed } so callers can
   * log/act on partial failures instead of assuming success.
   */
  forceCheckpoint(mode = 'TRUNCATE') {
    if (!this.db) return { success: false, reason: 'NOT_CONNECTED' };
    try {
      const result = this.db.pragma(`wal_checkpoint(${mode})`);
      const row = Array.isArray(result) ? result[0] : result;
      const busy = row?.busy ?? 0;
      const log = row?.log ?? 0;
      const checkpointed = row?.checkpointed ?? 0;

      if (busy) {
        console.warn(
          `⚠️  WAL checkpoint (${mode}) INCOMPLETE — another reader/writer is blocking it. ` +
          `log=${log} pages, checkpointed=${checkpointed} pages.`
        );
        return { success: false, busy: true, pagesInWal: log, pagesCheckpointed: checkpointed };
      }

      console.log(`✅ SQLite WAL checkpoint (${mode}) complete. ${checkpointed}/${log} pages.`);
      return { success: true, busy: false, pagesInWal: log, pagesCheckpointed: checkpointed };
    } catch (error) {
      console.error(`❌ Failed to execute WAL checkpoint (${mode}):`, error.message);
      return { success: false, reason: error.message };
    }
  }

  /**
   * Checks WAL file size and truncates only if it exceeds the threshold.
   * Safe to call frequently (e.g. every 15 min) — it's a no-op most of the time.
   */
  autoCheckpointIfNecessary() {
    if (!this.dbPath) return;
    const walPath = `${this.dbPath}-wal`;
    try {
      if (fs.existsSync(walPath)) {
        const stats = fs.statSync(walPath);
        if (stats.size > this.WAL_SIZE_THRESHOLD) {
          console.log(`⚠️  WAL size (${(stats.size / 1024 / 1024).toFixed(2)} MB) exceeded threshold. Checkpointing...`);
          this.forceCheckpoint('TRUNCATE');
        }
      }
    } catch (error) {
      console.error('Failed to check WAL size:', error.message);
    }
  }

  /**
   * Starts a background interval that periodically checkpoints the WAL.
   * Call once at startup; safe no-op if called twice.
   */
  startAutoCheckpointTimer(intervalMs = 15 * 60 * 1000) {
    if (this._checkpointTimer) return;
    this._checkpointTimer = setInterval(() => {
      this.autoCheckpointIfNecessary();
    }, intervalMs);
    // Don't let this timer keep the process alive on its own
    this._checkpointTimer.unref?.();
    console.log(`🕒 WAL auto-checkpoint timer started (every ${intervalMs / 60000} min).`);
  }

  stopAutoCheckpointTimer() {
    if (this._checkpointTimer) {
      clearInterval(this._checkpointTimer);
      this._checkpointTimer = null;
    }
  }

  prepare(sql) {
    this._ensureConnected();
    return this.db.prepare(sql);
  }

  run(sql, ...params) {
    return this.prepare(sql).run(...params);
  }

  get(sql, ...params) {
    return this.prepare(sql).get(...params);
  }

  all(sql, ...params) {
    return this.prepare(sql).all(...params);
  }

  transaction(callback) {
    this._ensureConnected();
    const tx = this.db.transaction(callback);
    return tx();
  }

  close() {
    if (this.db) {
      this.stopAutoCheckpointTimer();
      console.log('Database Engine: Executing final WAL checkpoint...');
      const result = this.forceCheckpoint('TRUNCATE');
      if (!result.success) {
        console.warn('⚠️  Shutdown checkpoint did not fully complete — WAL may retain uncommitted pages on next boot.');
      }
      this.db.close();
      this.db = null;
      console.log('✅ SQLite database connection closed safely.');
    }
  }

  _ensureConnected() {
    if (!this.db) {
      throw new Error('Database Engine is not connected. Call connect() first.');
    }
  }
}

export const dbEngine = new DatabaseEngine();
