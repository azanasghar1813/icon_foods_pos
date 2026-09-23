import fs from 'fs';
import path from 'path';
import config from '../config/index.js';
import { dbEngine } from '../database/sqlite.js';
import Database from 'better-sqlite3';
import { createRequire } from 'module';
import { backupService } from '../backup/backupService.js';

const require = createRequire(import.meta.url);
const AdmZip = require('adm-zip');

export const listBackups = async (req, res) => {
  try {
    const backups = dbEngine.prepare(`
      SELECT id, file_path, size_bytes, status, created_at 
      FROM backup_history 
      ORDER BY created_at DESC
    `).all();

    const formatted = backups.map(b => ({
      id: b.id,
      filename: path.basename(b.file_path),
      size: (b.size_bytes / (1024 * 1024)).toFixed(2) + ' MB',
      status: b.status,
      date: new Date(b.created_at).toLocaleString(),
      type: 'Local'
    }));

    res.status(200).json(formatted);
  } catch (error) {
    console.error('[BackupController] List failed:', error);
    res.status(500).json({ error: 'Failed to list backups' });
  }
};

export const createBackup = async (req, res) => {
  try {
    const result = await backupService.createBackup('Manual backup via API');
    res.status(200).json({
      message: 'Backup created successfully',
      backup: {
        id: result.id,
        filename: path.basename(result.file),
        size: (result.size / (1024 * 1024)).toFixed(2) + ' MB'
      }
    });
  } catch (error) {
    console.error('[BackupController] Create failed:', error);
    res.status(500).json({ error: 'Failed to create backup: ' + error.message });
  }
};

export const deleteBackup = async (req, res) => {
  try {
    const { id } = req.params;
    const backup = dbEngine.prepare(`SELECT * FROM backup_history WHERE id = ?`).get(id);
    
    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    if (fs.existsSync(backup.file_path)) {
      fs.unlinkSync(backup.file_path);
    }
    
    dbEngine.prepare(`DELETE FROM backup_history WHERE id = ?`).run(id);
    res.status(200).json({ message: 'Backup deleted successfully' });
  } catch (error) {
    console.error('[BackupController] Delete failed:', error);
    res.status(500).json({ error: 'Failed to delete backup' });
  }
};

const performRestore = async (zipFilePath, isTempUpload = false) => {
  console.log(`[BackupController] Attempting restore from: ${zipFilePath}`);

  // Verify it's a valid zip
  const zip = new AdmZip(zipFilePath);
  const zipEntries = zip.getEntries();
  
  let hasDb = false;
  for (const entry of zipEntries) {
    if (entry.entryName === 'database/pos.db') {
      hasDb = true;
      break;
    }
  }

  if (!hasDb) {
    if (isTempUpload) fs.unlinkSync(zipFilePath);
    throw new Error('Invalid backup file: pos.db not found');
  }

  // Step 1: Safely close database connections
  console.log('[BackupController] Closing database connections for restore...');
  dbEngine.close();

  // Step 2: Extract over existing paths
  console.log('[BackupController] Extracting backup...');
  
  const tempExtractDir = path.join(config.paths.root, 'temp_restore');
  if (!fs.existsSync(tempExtractDir)) {
    fs.mkdirSync(tempExtractDir);
  }

  zip.extractAllTo(tempExtractDir, true);

  // Step 3: Verify Integrity & Replace DB
  const extractedDbPath = path.join(tempExtractDir, 'database', 'pos.db');
  if (fs.existsSync(extractedDbPath)) {
    console.log('[BackupController] Verifying backup database integrity...');
    const tempDb = new Database(extractedDbPath, { fileMustExist: true });
    const integrityCheck = tempDb.pragma('integrity_check', { simple: true });
    tempDb.close();

    const isOk = integrityCheck === 'ok' || integrityCheck?.integrity_check === 'ok' || integrityCheck?.[0]?.integrity_check === 'ok';
    if (!isOk) {
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
      if (isTempUpload) fs.unlinkSync(zipFilePath);
      throw new Error('Database backup failed integrity check. Aborting restore.');
    }
    console.log('[BackupController] Backup database integrity OK.');

    // Make a safety copy of the live database
    const liveDbPath = config.paths.database.file;
    const safetyCopyPath = `${liveDbPath}.bak`;
    console.log(`[BackupController] Creating safety copy at ${safetyCopyPath}...`);
    if (fs.existsSync(liveDbPath)) {
      fs.copyFileSync(liveDbPath, safetyCopyPath);
    }

    fs.copyFileSync(extractedDbPath, liveDbPath);
    console.log('[BackupController] Database replaced successfully.');
  }

  // Replace images if they exist
  const extractedImagesPath = path.join(tempExtractDir, 'images');
  const targetImagesPath = path.join(config.paths.root, 'images');
  if (fs.existsSync(extractedImagesPath)) {
    fs.cpSync(extractedImagesPath, targetImagesPath, { recursive: true, force: true });
    console.log('[BackupController] Images restored successfully.');
  }

  // Clean up
  fs.rmSync(tempExtractDir, { recursive: true, force: true });
  if (isTempUpload) fs.unlinkSync(zipFilePath);

  // Restart Backend
  console.log('[BackupController] Triggering backend restart...');
  setTimeout(() => {
    process.exit(0); 
  }, 1000);
};

export const restoreBackup = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No backup file provided' });
    }
    await performRestore(req.file.path, true);
    res.status(200).json({ message: 'Restore successful. System will now restart.' });
  } catch (error) {
    console.error('[BackupController] Restore failed:', error);
    res.status(500).json({ error: 'Failed to restore backup: ' + error.message });
  }
};

export const restoreLocalBackup = async (req, res) => {
  try {
    const { id } = req.params;
    const backup = dbEngine.prepare(`SELECT * FROM backup_history WHERE id = ?`).get(id);
    
    if (!backup) {
      return res.status(404).json({ error: 'Backup not found in history' });
    }

    if (!fs.existsSync(backup.file_path)) {
      return res.status(404).json({ error: 'Backup file missing from storage' });
    }

    await performRestore(backup.file_path, false);
    res.status(200).json({ message: 'Restore successful. System will now restart.' });
  } catch (error) {
    console.error('[BackupController] Local restore failed:', error);
    res.status(500).json({ error: 'Failed to restore backup: ' + error.message });
  }
};
