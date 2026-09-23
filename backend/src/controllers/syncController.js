import { dbEngine } from '../database/sqlite.js';
import { syncWorker } from '../sync/syncWorker.js';
import { configService } from '../services/configService.js';
import { syncService } from '../services/syncService.js';
import { getSyncCloudClient } from '../sync/syncCloudClient.js';
import config from '../config/index.js';

export const getSyncStatus = async (req, res) => {
  try {
    const counts = dbEngine.prepare(`
      SELECT 
        status, COUNT(*) as count 
      FROM sync_queue 
      GROUP BY status
    `).all();

    let pending = 0;
    let failed = 0;
    let synced = 0;
    let conflicted = 0;

    for (const row of counts) {
      if (row.status === 'PENDING') pending = row.count;
      if (row.status === 'FAILED') failed = row.count;
      if (row.status === 'SYNCED') synced = row.count;
      if (row.status === 'CONFLICT') conflicted = row.count;
    }

    const syncConfig = configService.getSyncConfig();
    const cloud = getSyncCloudClient(config).getState();

    res.status(200).json({
      pending,
      failed,
      synced,
      conflicted,
      isRunning: syncWorker.isRunning,
      currentPhase: syncWorker.currentPhase,
      logs: syncWorker.logs,
      nextRunDelay: syncWorker.currentDelayMs,
      deviceId: syncConfig.device_id || 'UNKNOWN_DEVICE',
      cloudHost: cloud.activeHost,
      cloudUrlHost: (() => {
        try { return new URL(cloud.activeUrl).host; } catch { return cloud.activeHost; }
      })()
    });
  } catch (error) {
    console.error('[SyncController] Status fetch failed:', error);
    res.status(500).json({ error: 'Failed to fetch sync status' });
  }
};

export const resolveConflict = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution } = req.body; // 'keep_local' | 'keep_cloud'
    if (resolution === 'keep_local') {
      // re-queue as a fresh PENDING push, bumping payload_version past the server's
      dbEngine.prepare(`UPDATE sync_queue SET status='PENDING', payload_version = payload_version + 1 WHERE id = ?`).run(id);
    } else {
      // accept server's version — mark synced, let next pull bring the authoritative copy
      dbEngine.prepare(`UPDATE sync_queue SET status='SYNCED' WHERE id = ?`).run(id);
    }
    res.json({ message: 'Conflict resolved' });
  } catch (error) {
    console.error('[SyncController] Failed to resolve conflict:', error);
    res.status(500).json({ error: 'Failed to resolve conflict' });
  }
};

export const triggerSync = async (req, res) => {
  try {
    const result = await syncWorker.run();
    if (result && !result.success) {
      return res.status(400).json({ error: result.error || 'Sync failed' });
    }
    res.status(200).json({ 
      message: 'Sync completed successfully',
      pushed: result ? result.pushed : 0,
      pulled: result ? result.pulled : 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to trigger sync' });
  }
};

export const getActiveDevices = (req, res) => {
  try {
    // This uses the global active devices map from app.js
    const activeDevices = global.activeDevices ? Array.from(global.activeDevices.values()) : [];
    
    // Sort by lastSeen descending
    activeDevices.sort((a, b) => b.lastSeen - a.lastSeen);
    
    res.status(200).json(activeDevices);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
};

export const getSyncQueue = (req, res) => {
  try {
    const { status = 'FAILED', limit = 50 } = req.query;
    // ensure status is either FAILED or SYNCED or PENDING or CONFLICT
    if (!['FAILED', 'SYNCED', 'PENDING', 'CONFLICT'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const data = syncService.getQueue(status, parseInt(limit, 10) || 50);
    res.status(200).json(data);
  } catch (error) {
    console.error('[SyncController] Failed to get sync queue:', error);
    res.status(500).json({ error: 'Failed to fetch sync queue' });
  }
};

export const retrySyncEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const success = syncService.retryEvent(id);
    if (!success) {
      return res.status(404).json({ error: 'Failed event not found or already retried' });
    }
    // Immediately trigger the background worker to try and push it
    syncWorker.run().catch(e => console.error('Error triggering syncWorker after retry:', e));
    res.status(200).json({ message: 'Event queued for retry' });
  } catch (error) {
    console.error('[SyncController] Failed to retry event:', error);
    res.status(500).json({ error: 'Failed to retry event' });
  }
};

export const retryAllSyncEvents = async (req, res) => {
  try {
    const success = syncService.retryAllEvents();
    if (!success) {
      return res.status(404).json({ error: 'No failed events found to retry' });
    }
    syncWorker.run().catch(e => console.error('Error triggering syncWorker after retryAll:', e));
    res.status(200).json({ message: 'All failed events queued for retry' });
  } catch (error) {
    console.error('[SyncController] Failed to retry all events:', error);
    res.status(500).json({ error: 'Failed to retry all events' });
  }
};

export const clearSyncQueue = async (req, res) => {
  try {
    const { force } = req.body || req.query || {};
    const pendingCount = dbEngine.prepare("SELECT COUNT(*) as c FROM sync_queue WHERE status = 'PENDING'").get().c;
    
    if (pendingCount > 0 && !force) {
      return res.status(409).json({
        error: `${pendingCount} operations have not yet synced. Confirm you want to clear them.`,
        pendingCount
      });
    }

    syncService.clearQueue(force);
    res.status(200).json({ message: 'Sync queue cleared successfully' });
  } catch (error) {
    console.error('[SyncController] Failed to clear sync queue:', error);
    res.status(500).json({ error: 'Failed to clear sync queue' });
  }
};

export const reassignDeviceId = async (req, res) => {
  try {
    const { force } = req.body || {};
    const pendingCount = dbEngine.prepare("SELECT COUNT(*) as c FROM sync_queue WHERE status = 'PENDING'").get().c;
    if (pendingCount > 0 && !force) {
      return res.status(409).json({
        error: `${pendingCount} operations have not yet synced. Confirm you want to discard them, or wait for sync to complete.`,
        pendingCount
      });
    }

    const { v4: uuidv4 } = await import('uuid');
    const newId = uuidv4();
    
    dbEngine.transaction(() => {
      dbEngine.prepare("UPDATE application_settings SET value = ? WHERE key = 'device_id'").run(newId);
      dbEngine.prepare("DELETE FROM sync_queue").run();
      
      // After wiping sync_queue/device identity, backfill fresh CREATE events
      const backfillTables = [
        { table: 'categories', type: 'CATEGORY' },
        { table: 'products', type: 'PRODUCT' },
        { table: 'deals', type: 'DEAL' },
        { table: 'customers', type: 'CUSTOMER' },
        { table: 'users', type: 'USER' },
      ];

      for (const { table, type } of backfillTables) {
        try {
          const rows = dbEngine.prepare(`SELECT id FROM ${table}`).all();
          const insertStmt = dbEngine.prepare(`
            INSERT INTO sync_queue (id, entity_type, entity_id, action, metadata, payload_version)
            VALUES (?, ?, ?, 'CREATED', '{}', 1)
          `);
          for (const row of rows) {
            insertStmt.run(uuidv4(), type, row.id);
          }
        } catch(e) {}
      }

      try { dbEngine.prepare("DELETE FROM sync_conflicts").run(); } catch(e){}
      dbEngine.prepare("UPDATE application_settings SET value = '0' WHERE key = 'last_sync_timestamp'").run();
    });

    // Reload config in memory
    configService.loadSettings();

    res.status(200).json({ message: 'Device identity reassigned', newDeviceId: newId });
  } catch (error) {
    console.error('[SyncController] Failed to reassign device id:', error);
    res.status(500).json({ error: 'Failed to reassign device id' });
  }
};
