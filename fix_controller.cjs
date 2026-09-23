const fs = require('fs');
const file = 'backend/src/controllers/orderController.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Add import
if (!content.includes('lanSyncService.js')) {
  content = content.replace(
    /^import \{ socketService \} from '\.\.\/services\/socketService\.js';$/m,
    "import { socketService } from '../services/socketService.js';\nimport { lanSyncService } from '../services/lanSyncService.js';"
  );
}

// 2. Replace emitOrderUpserted
content = content.replace(/socketService\.emitOrderUpserted\(([^)]+)\);/g, (match, p1) => {
  return `socketService.emitOrderUpserted(${p1});\n      lanSyncService.broadcastOrder(${p1}.id).catch(() => {});`;
});

fs.writeFileSync(file, content);
console.log("Done");
