import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
// @ts-ignore
import { Pool } from 'pg';

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:ivan@localhost:5432/Lunar'
});

// GET - List all tables with their row counts for the reset preview
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tablesRes = await pgPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    const tables: { name: string; rows: number }[] = [];
    for (const row of tablesRes.rows) {
      const countRes = await pgPool.query(`SELECT COUNT(*) as count FROM "${row.table_name}"`);
      tables.push({
        name: row.table_name,
        rows: parseInt(countRes.rows[0].count, 10)
      });
    }

    return NextResponse.json({ tables });

  } catch (error: any) {
    console.error('Failed to list tables for reset:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Reset selected tables by truncating them
export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const tablesToReset: string[] = body.tables;

    if (!tablesToReset || tablesToReset.length === 0) {
      return NextResponse.json({ error: 'No tables specified for reset' }, { status: 400 });
    }

    // Safety: never allow resetting the users table (would lock everyone out)
    const protectedTables = ['users', 'system_settings'];
    const safeToReset = tablesToReset.filter(t => !protectedTables.includes(t));
    const skipped = tablesToReset.filter(t => protectedTables.includes(t));

    const results: { table: string; status: string }[] = [];
    for (const table of safeToReset) {
      try {
        await pgPool.query(`TRUNCATE TABLE "${table}" CASCADE`);
        results.push({ table, status: 'cleared' });
      } catch (e: any) {
        results.push({ table, status: `error: ${e.message}` });
      }
    }

    for (const table of skipped) {
      results.push({ table, status: 'PROTECTED - skipped' });
    }

    return NextResponse.json({
      success: true,
      message: `Database reset completed. ${safeToReset.length} tables cleared, ${skipped.length} protected.`,
      results
    });

  } catch (error: any) {
    console.error('Database reset failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
