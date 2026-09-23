import { dbEngine } from './src/database/sqlite.js';
import { kitchenController } from './src/controllers/kitchenController.js';
import path from 'path';

dbEngine.connect(path.resolve('./storage/database/pos.db'));

const req = {
  query: { monitorMode: 'true' }
};

const res = {
  status: (code) => {
    console.log("STATUS:", code);
    return res;
  },
  json: (data) => {
    console.log("JSON:", JSON.stringify(data).substring(0, 200));
  }
};

kitchenController.getQueue(req, res);
