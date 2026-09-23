import { dbEngine } from './src/database/sqlite.js';
import { kitchenQueueService } from './src/services/kitchenQueueService.js';
import path from 'path';

try {
  dbEngine.connect(path.resolve('./storage/database/pos.db'));
  const result = kitchenQueueService.getQueue({ monitorMode: true });
  console.log("SUCCESS, found", result?.tickets?.length);
} catch (err) {
  console.error("ERROR CAUGHT:");
  console.error(err);
}
