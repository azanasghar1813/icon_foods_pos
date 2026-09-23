const fs = require('fs');
const file = 'backend/src/controllers/orderController.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Add imports if missing
if (!content.includes('socketService.js')) {
  content = content.replace(
    /^import \{ authService \} from '\.\.\/services\/authService\.js';$/m,
    "import { authService } from '../services/authService.js';\nimport { socketService } from '../services/socketService.js';\nimport { lanSyncService } from '../services/lanSyncService.js';"
  );
}

// 2. Replace sendSuccess calls with the broadcasts
// Matches: sendSuccess(res, VAR_NAME, '...
content = content.replace(/sendSuccess\(res,\s*([a-zA-Z0-9_]+),\s*'([^']+)'(?:,\s*\d+)?\);/g, (match, varName, msg) => {
  // Don't inject for peekNextNumber or getDraft or getOrderDetails or getHeldOrders
  if (msg === 'Next order number' || msg === 'Draft retrieved successfully' || msg === 'Order details retrieved' || msg === 'Held orders retrieved') {
    return match;
  }
  
  if (msg === 'Order deleted successfully') {
    return `socketService.emitOrderDeleted(req.params.orderId);\n      ${match}`;
  }

  // Inject upsert and broadcast
  return `socketService.emitOrderUpserted(${varName});\n      lanSyncService.broadcastOrder(${varName}.id).catch(() => {});\n      ${match}`;
});

fs.writeFileSync(file, content);
console.log("orderController.js successfully updated with broadcast hooks.");
