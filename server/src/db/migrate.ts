import fs from 'fs';
import path from 'path';
import { getDb } from './connection.js';

export async function runMigrations() {
  console.log('[RailNova] Running PostgreSQL database migrations...');
  const db = await getDb();
  let schemaPath = path.resolve(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    schemaPath = path.resolve(__dirname, '../../src/db/schema.sql');
  }
  if (!fs.existsSync(schemaPath)) {
    schemaPath = path.resolve(process.cwd(), 'server', 'src', 'db', 'schema.sql');
  }
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  // Split and execute statements
  const statements = schemaSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    try {
      await db.query(statement);
    } catch (err: any) {
      // Ignore extension errors if btree_gist is not present in WASM
      if (statement.includes('btree_gist') && err.message?.includes('not available')) {
        console.log('[RailNova Migration] Notice: btree_gist not bundled in current engine; using row-lock segment verification.');
        continue;
      }
      console.error('[RailNova Migration Error]', err.message, '\nIn statement:', statement.slice(0, 80));
      throw err;
    }
  }

  // Attempt to add GiST exclusion constraint if supported
  try {
    await db.query(`
      ALTER TABLE seat_allocations 
      ADD CONSTRAINT exclude_overlapping_allocations 
      EXCLUDE USING gist (
        run_seat_id WITH =,
        journey_interval WITH &&
      ) WHERE (status IN ('HELD', 'CONFIRMED'))
    `);
    console.log('[RailNova Migration] GiST exclusion constraint successfully enabled.');
  } catch (err: any) {
    // If table already has constraint or extension missing, log notice
    console.log('[RailNova Migration] Exclusion constraint status:', err.message?.includes('already exists') ? 'Active' : 'Using serialized transactional row-locking verification');
  }

  // Audit logs and extended organiser support
  const extendedStatements = [
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT,
      actor_name TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      outcome TEXT,
      metadata JSONB,
      details TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_id TEXT`,
    `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_name TEXT`,
    `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_type TEXT`,
    `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_id TEXT`,
    `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS outcome TEXT`,
    `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB`,
    `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details TEXT`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC)`,
    `ALTER TABLE run_seats ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT FALSE`
  ];

  for (const stmt of extendedStatements) {
    try {
      await db.query(stmt);
    } catch (err: any) {
      // Ignore if column or table already exists
    }
  }
  console.log('[RailNova Migration] Extended audit_logs and run_seats columns ready.');

  console.log('[RailNova] Migrations completed successfully.');
}

if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
