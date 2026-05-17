import { Pool, PoolClient } from 'pg';
import { AsyncLocalStorage } from 'async_hooks';

// 1. Connection Pool Stability Configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Max concurrent connections to Supabase
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  console.error('[FATAL POOL ERROR] Unexpected error on idle client', err);
});

// AsyncLocalStorage ensures that concurrent requests do not share the same transaction state.
const asyncLocalStorage = new AsyncLocalStorage<DatabaseAdapter>();

const DEBUG = process.env.NODE_ENV !== 'production';

// 2. Query Translation (SQLite -> PostgreSQL)
function convertToPgSql(sql: string) {
  let index = 1;
  // Replaces SQLite '?' with PostgreSQL '$1', '$2' etc.
  let converted = sql.replace(/\?/g, () => `$${index++}`);
  return converted;
}

// 3. Database Adapter Class
class DatabaseAdapter {
  client?: PoolClient;

  constructor(client?: PoolClient) {
    this.client = client; // If present, this adapter is inside a transaction
  }

  private async executeQuery(type: 'GET' | 'ALL' | 'RUN', sql: string, params: any[]) {
    let pgSql = convertToPgSql(sql);

    // Auto-Return ID for SQLite compatibility on INSERTs
    if (type === 'RUN' && pgSql.trim().toUpperCase().startsWith('INSERT') && !pgSql.toUpperCase().includes('RETURNING')) {
      pgSql += ' RETURNING id';
    }

    const start = Date.now();
    try {
      const runner = this.client || pool;
      const res = await runner.query(pgSql, params);
      
      if (DEBUG) console.log(`[DB ${type}] ${Date.now() - start}ms`, pgSql);

      if (type === 'GET') return res.rows[0] || null;
      if (type === 'ALL') return res.rows;
      if (type === 'RUN') return { lastInsertRowid: res.rows[0]?.id || 0, changes: res.rowCount };
      
    } catch (err: any) {
      console.error(`[DB ${type} FAILED]`, pgSql, err.message);
      throw err;
    }
  }

  // Legacy SQLite API Support Wrappers
  prepare(sql: string) {
    return {
      get: async (...params: any[]) => this.executeQuery('GET', sql, params),
      all: async (...params: any[]) => this.executeQuery('ALL', sql, params),
      run: async (...params: any[]) => this.executeQuery('RUN', sql, params),
    };
  }

  // 4. Atomic Transaction & Isolation Configuration
  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    if (this.client) {
      // We are already inside a transaction wrapper
      return callback();
    }

    const client = await pool.connect();
    const txAdapter = new DatabaseAdapter(client);
    
    try {
      // Explicit isolation lock against race conditions
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
      
      // Execute the callback entirely within the scoped transaction context
      const result = await asyncLocalStorage.run(txAdapter, callback);
      
      await client.query('COMMIT');
      return result;
    } catch (e: any) {
      await client.query('ROLLBACK');
      console.error('[DB TRANSACTION ROLLBACK TRIGGERED]', e.message);
      throw e;
    } finally {
      client.release();
    }
  }
}

const baseDbInstance = new DatabaseAdapter();

export function getDb(): DatabaseAdapter {
  const store = asyncLocalStorage.getStore();
  // If we are inside asyncLocalStorage.run, return the transactional adapter. Otherwise base pool.
  return store || baseDbInstance;
}

// Global Audit Log Utility
export async function logAudit({ userId, username, action, module, recordId, recordDate, oldValue, newValue, oldVal, newVal, description }: any) {
  try {
    const db = getDb();
    await db.prepare(
      `INSERT INTO audit_logs (user_id, username, action, module, record_id, old_value, new_value, description) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(userId, username, action, module, recordId, oldValue || oldVal, newValue || newVal, description);
  } catch (e) {
    console.error('Audit log failed', e);
  }
}
