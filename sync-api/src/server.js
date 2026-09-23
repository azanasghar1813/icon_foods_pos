import app from './app.js';
import config from './config/index.js';

import { startCronJobs } from './tasks/purgeOldOrders.js';

const startServer = async () => {
  try {
    const port = Number(process.env.PORT) || config.port || 3000;
    app.listen(port, '0.0.0.0', () => {
      console.log(`[Sync API] Server is running on 0.0.0.0:${port}`);
      console.log(`[Sync API] Environment: ${config.env}`);
    });
    
    // Start background jobs
    startCronJobs();
  } catch (error) {
    console.error('[Sync API] Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
