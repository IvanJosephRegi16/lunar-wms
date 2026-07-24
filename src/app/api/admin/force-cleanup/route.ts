import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    
    // Get start of today in IST
    const now = new Date();
    // Shift to IST timezone for comparison (approx UTC+5:30)
    // Actually, it's safer to use a hardcoded date string for 'yesterday'
    // '2026-07-24' is today. We want to delete everything strictly before '2026-07-24'
    const cutoffDateStr = '2026-07-24 00:00:00+05:30';

    const results = [];

    const queries = [
      { name: 'scan_history', sql: `DELETE FROM scan_history WHERE created_at < '${cutoffDateStr}'` },
      { name: 'intake_barcode_pool', sql: `DELETE FROM intake_barcode_pool WHERE created_at < '${cutoffDateStr}'` },
      { name: 'inward_inventory_transactions', sql: `DELETE FROM inward_inventory_transactions WHERE created_at < '${cutoffDateStr}'` },
      { name: 'outward_scan_items', sql: `DELETE FROM outward_scan_items WHERE session_id IN (SELECT id FROM outward_scan_sessions WHERE created_at < '${cutoffDateStr}')` },
      { name: 'outward_scan_sessions', sql: `DELETE FROM outward_scan_sessions WHERE created_at < '${cutoffDateStr}'` },
      { name: 'packed_cartons', sql: `DELETE FROM packed_cartons WHERE created_at < '${cutoffDateStr}'` }
    ];

    for (const q of queries) {
      const res = await db.prepare(q.sql).run() as any;
      results.push({ table: q.name, rowsDeleted: res.changes });
    }

    // Since inventory_pool doesn't have a created_at column and just tracks totals,
    // it's tricky to 'delete only up to yesterday'. If we want to recalculate it, 
    // we would have to wipe it and replay inward_inventory_transactions.
    // However, the user said they reset the inventory today morning. So it should be fine.

    return NextResponse.json({
      success: true,
      message: 'Successfully deleted all packing data from before today (2026-07-24).',
      cutoffDateStr,
      details: results
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
