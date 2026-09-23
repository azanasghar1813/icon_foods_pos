import app from './app.js';
import config from './config/index.js';
import { storageManager } from './utils/storageManager.js';
import { initDatabase } from './database/initDatabase.js';
import { dbEngine } from './database/sqlite.js';
import { configService } from './services/configService.js';
import { menuCacheService } from './services/menuCacheService.js';
import { printEngineService } from './services/printEngineService.js';
import { socketService } from './services/socketService.js';
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err.name, err.message);
  console.error(err.stack);
  if (!process.versions.electron) {
    process.exit(1);
  }
});

const printStartupSummary = (storageResults, dbInfo, startupTimeMs) => {
  console.log('\n======================================================');
  console.log(`🚀 ${config.app.name} Backend Starting`);
  console.log('======================================================');
  console.log(`[Version]     : ${config.app.version}`);
  console.log(`[Environment] : ${config.app.env}`);
  console.log(`[Port]        : ${config.server.port}`);
  console.log(`[API URL]     : http://localhost:${config.server.port}${config.server.apiPrefix}`);
  console.log(`[Startup]     : ${startupTimeMs} ms`);
  console.log('------------------------------------------------------');
  
  if (storageResults) {
    console.log('📁 Storage Initialization:');
    let failures = false;
    storageResults.forEach(result => {
      const icon = result.status === 'VERIFIED' ? '✅' : result.status === 'CREATED' ? '✨' : '❌';
      console.log(`   ${icon} [${result.status}] ${result.path}`);
      if (result.status === 'FAILED') failures = true;
    });
    
    if (failures) {
      console.error('\n⚠️  WARNING: Some storage paths failed to initialize! Check permissions.');
    }
  }

  console.log('------------------------------------------------------');
  if (dbInfo) {
    console.log('🗄️  Database Engine:');
    console.log(`   Status      : ✅ ${dbInfo.status}`);
    console.log(`   Path        : ${dbInfo.path}`);
    console.log(`   SQLite Ver  : ${dbInfo.version}`);
    console.log(`   Mode        : ${dbInfo.journalMode}`);
    console.log(`   Foreign Keys: ${dbInfo.foreignKeysActive ? 'ON' : 'OFF'}`);
    
    if (dbInfo.migrations) {
      console.log('------------------------------------------------------');
      console.log('🏗️  Schema & Migrations:');
      console.log(`   Version     : ${dbInfo.migrations.newVersion}`);
      console.log(`   New Applied : ${dbInfo.migrations.newlyApplied}`);
      if (dbInfo.migrations.newlyApplied > 0) {
        console.log(`   Status      : ✅ Schema Upgraded`);
      } else {
        console.log(`   Status      : ✅ Schema Up To Date`);
      }
    }
    
    if (dbInfo.seeds) {
      console.log('------------------------------------------------------');
      console.log('🌱  Seed Data Initialization:');
      let anyNew = false;
      for (const stat of dbInfo.seeds) {
        console.log(`   ${stat.name.padEnd(12)}: ${stat.inserted > 0 ? `[INSERTED ${stat.inserted}]` : '[SKIPPED]'}`);
        if (stat.inserted > 0) anyNew = true;
      }
      if (anyNew) {
        console.log(`   Status      : ✅ Missing defaults injected`);
      } else {
        console.log(`   Status      : ✅ All defaults present`);
      }
    }
  }

  console.log('======================================================\n');
};

const startServer = async () => {
  const startTime = Date.now();
  let server;

  try {
    const storageResults = await storageManager.initializeStorage();
    const dbInfo = await initDatabase();

    configService.initialize();

    try {
      const testResult = dbEngine.transaction(() => 42);
      if (testResult !== 42) {
        throw new Error(`dbEngine.transaction sanity check failed: expected 42, got ${JSON.stringify(testResult)}`);
      }
      console.log('[Startup] dbEngine.transaction() sanity check passed.');
    } catch (e) {
      console.error('[Startup] FATAL: dbEngine.transaction() is not behaving as expected:', e.message);
      process.exit(1);
    }

    menuCacheService.initialize();
    // Start background print processor (disabled per user request)
    // printEngineService.start();

    // Start periodic WAL maintenance now that the DB connection is live.
    // Cheap no-op checks every 15 min; only does real work if WAL > 64MB.
    dbEngine.startAutoCheckpointTimer(15 * 60 * 1000);

    // Default 0.0.0.0 so tablets on LAN can reach this till. Set HOST=127.0.0.1 for a single-PC site.
    server = app.listen(config.server.port, config.server.host, () => {
      const startupTimeMs = Date.now() - startTime;
      printStartupSummary(storageResults, dbInfo, startupTimeMs);
    });

    socketService.attach(server);

    process.on('unhandledRejection', (err) => {
      console.error('[UNHANDLED REJECTION]', err?.name, err?.message);
      if (!process.versions.electron) {
        printEngineService.stop();
        dbEngine.close();
        server.close(() => process.exit(1));
      }
    });

    let isShuttingDown = false;
    const gracefulShutdown = (signal) => {
      if (isShuttingDown) return; // prevent double-shutdown races
      isShuttingDown = true;

      console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
      printEngineService.stop();
      dbEngine.close();

      server.close(() => {
        console.log('HTTP server closed.');
        if (process.versions.electron) {
          // Tell Electron's main process we're done, then exit this process.
          // (send() only works if this process was spawned with an 'ipc' channel)
          try {
            process.send?.('shutdown-complete');
          } catch (_) { /* no-op if channel unavailable */ }
        }
        process.exit(0);
      });

      // Absolute safety net: if server.close() hangs (e.g. a stuck keep-alive
      // connection), force-exit after 4s so Electron's own timeout can still
      // fall back to taskkill rather than hanging forever.
      setTimeout(() => {
        console.warn('[Shutdown] server.close() did not complete in time, forcing exit.');
        process.exit(0);
      }, 4000).unref();
    };

    // POSIX-style signals (works when running standalone / on non-Windows dev)
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    // IPC-based shutdown — this is the reliable path when running as an
    // Electron-spawned child process on Windows, where signal delivery
    // to a headless child process is not guaranteed.
    process.on('message', (msg) => {
      if (msg === 'shutdown') {
        gracefulShutdown('IPC-SHUTDOWN');
      }
    });

  } catch (error) {
    console.error('❌ FATAL STARTUP ERROR:', error);
    dbEngine.close();
    if (!process.versions.electron) {
      process.exit(1);
    }
  }
};

startServer();