import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
// @ts-ignore
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:ivan@localhost:5432/Lunar'
});

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tablesToReset, confirmationOverride } = await req.json();

    if (!Array.isArray(tablesToReset) || tablesToReset.length === 0) {
      return NextResponse.json({ error: 'No tables specified for reset.' }, { status: 400 });
    }

    if (confirmationOverride !== 'I_AM_SURE_WIPE_DATA') {
       return NextResponse.json({ error: 'Safety lock confirmation required.' }, { status: 400 });
    }

    // Connect and execute truncate
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      
      // Verify all tables exist to prevent SQL injection
      const existingTablesRes = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      
      const existingTables = existingTablesRes.rows.map((r: any) => r.table_name);
      
      for (const table of tablesToReset) {
        if (existingTables.includes(table) && table !== 'users' && table !== 'system_settings') {
           // We never truncate users or system_settings completely here without extreme caution, 
           // but we allow it if explicitly requested and handled by admin logic.
           await client.query(`TRUNCATE TABLE "${table}" CASCADE`);
        }
      }
      
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Also remove local SQLite DB if everything is being reset
    // In this specific flow, we might keep SQLite as it handles offline data syncing.
    
    return NextResponse.json({ 
      success: true, 
      message: `Successfully truncated ${tablesToReset.length} tables.`,
      tables: tablesToReset
    });

  } catch (error: any) {
    console.error('Database clean failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
