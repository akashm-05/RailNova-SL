import { getDb } from './connection.js';

async function runCli() {
  const query = process.argv[2] || 'SELECT table_name FROM information_schema.tables WHERE table_schema=\'public\'';
  console.log(`\nExecuting SQL: ${query}\n`);
  const db = await getDb();
  try {
    const res = await db.query(query);
    console.table(res.rows);
    console.log(`\nReturned ${res.rows.length} row(s).\n`);
  } catch (err: any) {
    console.error('SQL Error:', err.message);
  }
  process.exit(0);
}

runCli();
