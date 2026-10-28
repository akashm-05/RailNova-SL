import { Pool, PoolClient } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import path from 'path';
import fs from 'fs';

export interface DbResult<T = any> {
  rows: T[];
  rowCount?: number;
}

export interface DbClient {
  query<T = any>(sql: string, params?: any[]): Promise<DbResult<T>>;
}

let pool: Pool | null = null;
let pglite: PGlite | null = null;

const dbDataDir = path.resolve(process.cwd(), '.data', 'railnova_db');

export async function getDb(): Promise<DbClient> {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    if (!pool) {
      pool = new Pool({
        connectionString: databaseUrl,
        ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false }
      });
      console.log('[RailNova DB] Connected to external PostgreSQL via Pool:', databaseUrl.split('@')[1] || 'remote');
    }
    return {
      query: async <T = any>(sql: string, params?: any[]): Promise<DbResult<T>> => {
        const res = await pool!.query(sql, params);
        return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
      }
    };
  }

  // Fallback to persistent PGlite (Real PostgreSQL WASM with on-disk storage)
  if (!pglite) {
    if (!fs.existsSync(dbDataDir)) {
      fs.mkdirSync(dbDataDir, { recursive: true });
    }
    pglite = new PGlite(dbDataDir);
    await pglite.waitReady;
    console.log('[RailNova DB] Initialized PostgreSQL (PGlite engine) with persistent storage at:', dbDataDir);
  }

  return {
    query: async <T = any>(sql: string, params?: any[]): Promise<DbResult<T>> => {
      const res = await pglite!.query(sql, params);
      return { rows: res.rows as T[], rowCount: res.rows.length };
    }
  };
}

export async function withTransaction<T>(
  callback: (client: DbClient) => Promise<T>
): Promise<T> {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    if (!pool) await getDb();
    const client = await pool!.connect();
    try {
      await client.query('BEGIN');
      const wrappedClient: DbClient = {
        query: async <R = any>(sql: string, params?: any[]): Promise<DbResult<R>> => {
          const res = await client.query(sql, params);
          return { rows: res.rows as R[], rowCount: res.rowCount ?? 0 };
        }
      };
      const result = await callback(wrappedClient);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // PGlite transaction
  if (!pglite) await getDb();
  return await pglite!.transaction(async (tx) => {
    const wrappedTx: DbClient = {
      query: async <R = any>(sql: string, params?: any[]): Promise<DbResult<R>> => {
        const res = await tx.query(sql, params);
        return { rows: res.rows as R[], rowCount: res.rows.length };
      }
    };
    return await callback(wrappedTx);
  });
}
