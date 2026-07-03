import { NextRequest, NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

/**
 * POST /api/po/force-edit
 * Force-updates received_qty, order_rate, and amount for PO line items.
 * Restricted to Admin, Supervisor, and PM only.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Only admin, supervisor, or pm can force-edit historical PO data
    if (!['admin', 'supervisor', 'pm'].includes(user.role)) {
      return NextResponse.json({ error: 'Only Admin, Supervisor, or PM can force-edit PO data.' }, { status: 403 });
    }

    const body = await req.json();
    const { po_id, items } = body;

    if (!po_id || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Missing po_id or items' }, { status: 400 });
    }

    const db = getDb();

    // Verify PO exists
    const po = await db.prepare(`SELECT id, po_number FROM purchase_orders WHERE id = ? AND is_deleted = 0`).get(po_id) as any;
    if (!po) return NextResponse.json({ error: 'PO not found' }, { status: 404 });

    await db.transaction(async () => {
      for (const item of items) {
        const recvQty = Number(item.received_qty ?? 0);
        const rate    = Number(item.order_rate ?? 0);
        const amount  = recvQty * rate;

        await db.prepare(`
          UPDATE purchase_order_items
          SET received_qty = ?, order_rate = ?, amount = ?
          WHERE id = ? AND po_id = ?
        `).run(recvQty, rate, amount, item.id, po_id);
      }

      // Recalculate the PO grand total from all items
      const totRow = await db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total FROM purchase_order_items WHERE po_id = ?
      `).get(po_id) as any;
      const newTotal = totRow?.total || 0;

      await db.prepare(`UPDATE purchase_orders SET grand_total = ?, gross_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(newTotal, newTotal, po_id);

      // Log the force-edit event
      await db.prepare(`
        INSERT INTO po_activity_logs (po_id, user_id, username, action, description)
        VALUES (?, ?, ?, 'force_edit', ?)
      `).run(
        po_id, user.id, user.username,
        `Force-edit applied to PO ${po.po_number} by ${user.full_name}. Received quantities and rates updated.`
      );
    });

    await logAudit({
      userId: user.id,
      username: user.username,
      action: 'FORCE_EDIT',
      module: 'purchase_order_items',
      recordId: po_id,
      description: `Force-edited PO ${po.po_number} — received_qty, rate, and amount updated for ${items.length} item(s).`
    });

    return NextResponse.json({ success: true, message: 'PO items updated successfully.' });
  } catch (error: any) {
    console.error('Force-edit error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
