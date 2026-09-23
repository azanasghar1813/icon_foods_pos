import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';
import { ZipArchive } from 'archiver';
import config from '../config/index.js';
import { dbEngine } from '../database/sqlite.js';

const require = createRequire(import.meta.url);
const cron = require('node-cron');

class BackupService {
  constructor() {
    this.backupDir = config.paths.backups;
    this.dbFile = config.paths.database.file;
    this.imagesDir = path.join(config.paths.root, 'images');
  }

  startScheduler() {
    console.log('[BackupService] Starting automated backup scheduler (4:00 AM daily)...');
    cron.schedule('0 4 * * *', () => {
      console.log('[BackupService] Running scheduled backup...');
      this.createBackup('Scheduled daily backup').catch(err => {
        console.error('[BackupService] Scheduled backup failed:', err);
      });
    });
  }

  async createBackup(notes = '') {
    return new Promise((resolve, reject) => {
      try {
        if (!fs.existsSync(this.backupDir)) {
          fs.mkdirSync(this.backupDir, { recursive: true });
        }

        const backupId = crypto.randomUUID();
        const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `pos_backup_${dateStr}.zip`;
        const backupFilePath = path.join(this.backupDir, backupFileName);

        // Before backing up, checkpoint the DB to ensure everything is flushed from WAL
        dbEngine.db.pragma('wal_checkpoint(TRUNCATE)');

        const output = fs.createWriteStream(backupFilePath);
        const archive = new ZipArchive({ zlib: { level: 9 } });

        output.on('close', () => {
          const sizeBytes = archive.pointer();
          
          // Log to DB
          dbEngine.prepare(`
            INSERT INTO backup_history (id, file_path, size_bytes, status)
            VALUES (?, ?, ?, 'SUCCESS')
          `).run(backupId, backupFilePath, sizeBytes);

          console.log(`[BackupService] Backup created successfully: ${backupFilePath} (${sizeBytes} bytes)`);
          
          this.cleanupOldBackups();
          
          resolve({ id: backupId, file: backupFilePath, size: sizeBytes });
        });

        archive.on('error', (err) => {
          dbEngine.prepare(`
            INSERT INTO backup_history (id, file_path, size_bytes, status)
            VALUES (?, ?, ?, 'FAILED')
          `).run(backupId, backupFilePath, 0);
          reject(err);
        });

        archive.pipe(output);

        // Append DB file
        archive.file(this.dbFile, { name: 'database/pos.db' });
        
        // Append Images
        if (fs.existsSync(this.imagesDir)) {
          archive.directory(this.imagesDir, 'images');
        }

        archive.finalize();
      } catch (error) {
        reject(error);
      }
    });
  }

  cleanupOldBackups() {
    try {
      // Keep only last 7 days of backups
      const MAX_BACKUPS = 7;
      const records = dbEngine.prepare(`
        SELECT id, file_path FROM backup_history 
        WHERE status = 'SUCCESS' 
        ORDER BY created_at DESC
      `).all();

      if (records.length > MAX_BACKUPS) {
        const toDelete = records.slice(MAX_BACKUPS);
        for (const record of toDelete) {
          if (fs.existsSync(record.file_path)) {
            fs.unlinkSync(record.file_path);
          }
          dbEngine.prepare(`DELETE FROM backup_history WHERE id = ?`).run(record.id);
        }
        console.log(`[BackupService] Cleaned up ${toDelete.length} old backups.`);
      }
    } catch (error) {
      console.error('[BackupService] Failed to cleanup old backups:', error);
    }
  }
}

export const backupService = new BackupService();
