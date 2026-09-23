import Database from 'better-sqlite3';
const db = new Database('storage/database/pos.db', { readonly: true });
console.log(db.prepare('SELECT entity_type, status, COUNT(*) c FROM sync_queue GROUP BY 1,2 ORDER BY 1,2').all());
console.log('payments', db.prepare('SELECT COUNT(*) c FROM order_payments').get());
db.close();
