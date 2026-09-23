import fs from 'fs';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error('Set DATABASE_URL or SUPABASE_DB_URL before running this migration.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
});

async function runMigration() {
  console.log('Connecting to Supabase...');
  try {
    const sql = fs.readFileSync('./supabase_migration.sql', 'utf8');
    
    console.log('Executing migration script...');
    await pool.query(sql);
    
    console.log('✅ Supabase Migration executed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pool.end();
  }
}

runMigration();
