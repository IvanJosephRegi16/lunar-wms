import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
// @ts-ignore
import { Pool } from 'pg';

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:ivan@localhost:5432/Lunar'
});

// POST: Delete all PO data — only PM and Admin can execute this
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (user.role !== 'pm' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Only Project Managers or Administrators can reset PO data' }, { status: 403 });
    }

    const body = await req.json();
    const { confirm } = body;

    if (confirm !== 'CONFIRM_RESET') {
      return NextResponse.json({ error: 'Confirmation token missing or invalid' }, { status: 400 });
    }

    // Tables to purge in the correct order (respecting foreign key constraints)
    const poTables = [
      'po_notifications',
      'po_approval_history',
      'po_activity_logs',
      'pm_messages',
      'purchase_order_items',
      'purchase_orders'
    ];

    const results: { table: string; status: string; rows_deleted: number }[] = [];

    for (const table of poTables) {
      try {
        // Check if table exists first
        const exists = await pgPool.query(
          `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)`,
          [table]
        );
        if (!exists.rows[0].exists) {
          results.push({ table, status: 'skipped (table not found)', rows_deleted: 0 });
          continue;
        }

        const countRes = await pgPool.query(`SELECT COUNT(*) as count FROM "${table}"`);
        const rowCount = parseInt(countRes.rows[0].count, 10);

        await pgPool.query(`TRUNCATE TABLE "${table}" CASCADE`);
        results.push({ table, status: 'cleared', rows_deleted: rowCount });
      } catch (e: any) {
        results.push({ table, status: `error: ${e.message}`, rows_deleted: 0 });
      }
    }

    const totalDeleted = results.reduce((sum, r) => sum + r.rows_deleted, 0);

    return NextResponse.json({
      success: true,
      message: `PO Factory Reset completed. ${totalDeleted} total records purged across ${poTables.length} tables.`,
      results,
      resetBy: user.username,
      resetAt: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('PO Reset failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET: Preview PO data counts before reset
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const poTables = [
      'purchase_orders',
      'purchase_order_items',
      'po_activity_logs',
      'po_approval_history',
      'po_notifications',
      'pm_messages'
    ];

    const counts: { table: string; rows: number }[] = [];
    let totalRecords = 0;

    for (const table of poTables) {
      try {
        const exists = await pgPool.query(
          `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)`,
          [table]
        );
        if (!exists.rows[0].exists) {
          counts.push({ table, rows: 0 });
          continue;
        }
        const countRes = await pgPool.query(`SELECT COUNT(*) as count FROM "${table}"`);
        const rowCount = parseInt(countRes.rows[0].count, 10);
        counts.push({ table, rows: rowCount });
        totalRecords += rowCount;
      } catch {
        counts.push({ table, rows: 0 });
      }
    }

    return NextResponse.json({ counts, totalRecords });
  } catch (error: any) {
    console.error('PO Reset preview failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
