import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { session_id } = body;

    if (!session_id) {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
    }

    const db = getDb();
    
    const session = await db.prepare(`
      SELECT * FROM outward_scan_sessions WHERE id = ?
    `).get(session_id) as any;

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    if (session.status !== 'in_progress') return NextResponse.json({ error: `Cannot cancel ${session.status} session` }, { status: 400 });

    await db.transaction(async () => {
      // Get all scanned items to restore inventory
      const items = await db.prepare(`
        SELECT article_code, colour, size, COUNT(*) as count
        FROM outward_scan_items
        WHERE session_id = ?
        GROUP BY article_code, colour, size
      `).all(session_id);

      for (const item of items) {
        const invCol = `size_${item.size}`;
        await db.prepare(`
          UPDATE inventory_pool 
          SET ${invCol} = ${invCol} + ?, total_qty = total_qty + ?
          WHERE article_code = ? AND colour = ?
        `).run(item.count, item.count, item.article_code, item.colour);
      }

      // Get all scanned items to restore inventory and barcodes
      const itemsToRestore = await db.prepare(`
        SELECT barcode FROM outward_scan_items
        WHERE session_id = ? AND barcode IS NOT NULL
      `).all(session_id);

      for (const item of itemsToRestore) {
        // Revert intake pool status
        await db.prepare(`
          UPDATE intake_barcode_pool
          SET status = 'available', outward_scanned_at = NULL
          WHERE barcode = ?
        `).run(item.barcode);

        // Delete successful outward scan history records so they don't show up in logs as successfully scanned outward
        await db.prepare(`
          DELETE FROM scan_history 
          WHERE barcode = ? AND scan_type = 'outward' AND status = 'success_outward'
        `).run(item.barcode);
      }

      // Delete scan items
      await db.prepare(`
        DELETE FROM outward_scan_items WHERE session_id = ?
      `).run(session_id);

      // Cancel session
      await db.prepare(`
        UPDATE outward_scan_sessions SET status = 'cancelled' WHERE id = ?
      `).run(session_id);
    });

    return NextResponse.json({ success: true, message: 'Session cancelled and inventory restored' });
  } catch (error: any) {
    console.error('Error cancelling outward scan session:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
