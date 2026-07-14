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
    if (session.status !== 'in_progress' && session.status !== 'completed') {
      return NextResponse.json({ error: `Cannot cancel a ${session.status} session` }, { status: 400 });
    }

    await db.transaction(async () => {
      // ── For COMPLETED sessions: undo the seal (delete packed_carton + outward_transaction) ──
      if (session.status === 'completed') {
        // Find the latest outward_transaction for this session's config
        const latestTxn = await db.prepare(`
          SELECT ot.id as txn_id
          FROM outward_transactions ot
          WHERE ot.config_id = ? AND ot.article_code = ? AND ot.colour = ?
          ORDER BY ot.id DESC LIMIT 1
        `).get(session.carton_generation_id, session.article_code, session.colour) as any;

        if (latestTxn) {
          await db.prepare(`DELETE FROM packed_cartons WHERE transaction_id = ?`).run(latestTxn.txn_id);
          await db.prepare(`DELETE FROM outward_items WHERE transaction_id = ?`).run(latestTxn.txn_id);
          await db.prepare(`DELETE FROM outward_transactions WHERE id = ?`).run(latestTxn.txn_id);
        }
      }

      // ── Restore inventory counts ──
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

      // ── Restore barcode pool and purge outward scan history ──
      const itemsToRestore = await db.prepare(`
        SELECT barcode FROM outward_scan_items
        WHERE session_id = ? AND barcode IS NOT NULL
      `).all(session_id);

      for (const item of itemsToRestore) {
        await db.prepare(`
          UPDATE intake_barcode_pool
          SET status = 'available', outward_scanned_at = NULL
          WHERE barcode = ?
        `).run(item.barcode);

        await db.prepare(`
          DELETE FROM scan_history 
          WHERE barcode = ? AND scan_type = 'outward' AND status = 'success_outward'
        `).run(item.barcode);
      }

      // ── Delete scan items and mark session cancelled ──
      await db.prepare(`DELETE FROM outward_scan_items WHERE session_id = ?`).run(session_id);
      await db.prepare(`UPDATE outward_scan_sessions SET status = 'cancelled' WHERE id = ?`).run(session_id);
    });

    return NextResponse.json({ success: true, message: 'Session cancelled and inventory restored' });
  } catch (error: any) {
    console.error('Error cancelling outward scan session:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
