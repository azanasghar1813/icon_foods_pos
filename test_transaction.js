import { dbEngine } from './backend/src/database/sqlite.js';
dbEngine.connect('./pos_local.sqlite');

try {
  const result = dbEngine.transaction(() => {
    console.log('DID THIS RUN?');
    return 42;
  });
  console.log('typeof result:', typeof result);
  console.log('result:', result);
} catch (e) {
  console.log('ERROR:', e.message);
}
