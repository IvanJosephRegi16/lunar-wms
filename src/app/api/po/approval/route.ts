import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'supervisor') {
      return NextResponse.json({ error: 'Only administrators can review POs' }, { status: 403 });
    }

    const body = await req.json();
    const { id, action, comments = '', rejection_reason = '', correction_notes = '' } = body;

    if (!id || !action) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const db = getDb();

    // Fetch PO including creator details
    const po = await db.prepare(`
      SELECT po.*, u.full_name as creator_name, u.id as creator_user_id
      FROM purchase_orders po
      JOIN users u ON po.created_by = u.id
      WHERE po.id = ? AND po.is_deleted = 0
    `).get(id) as any;
    if (!po) return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });

    if (po.status !== 'pending_admin_approval') {
      return NextResponse.json({ error: 'This PO is not in the pending approval queue.' }, { status: 400 });
    }

    // Capture IST timestamps
    const d = new Date();
    const options = { timeZone: 'Asia/Kolkata' };
    const dateStr = d.toLocaleDateString('en-IN', { ...options, year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');
    const timeStr = d.toLocaleTimeString('en-IN', { ...options, hour12: false });
    const timestampStr = d.toLocaleString('en-IN', options);

    // Get all accountant user IDs for approval notifications
    const accountants = await db.prepare(`SELECT id FROM users WHERE role = 'accountant'`).all() as any[];

    const result = await db.transaction(async () => {

      if (action === 'approve') {
        const grand_total = po.net_amount;
        const balance_amount = grand_total;

        await db.prepare(`
          UPDATE purchase_orders 
          SET status = 'accountant_processing',
              approved_by = ?,
              approved_at_date = ?,
              approved_at_time = ?,
              approved_timestamp = ?,
              grand_total = ?,
              balance_amount = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(user.id, dateStr, timeStr, timestampStr, grand_total, balance_amount, id);

        await db.prepare(`
          INSERT INTO po_approval_history (po_id, action, actor_id, actor_name, comments, ist_timestamp)
          VALUES (?, 'approve', ?, ?, ?, ?)
        `).run(id, user.id, user.full_name, comments || 'Approved by Admin', timestampStr);

        await db.prepare(`
          INSERT INTO po_activity_logs (po_id, user_id, username, action, description)
          VALUES (?, ?, ?, 'approve', ?)
        `).run(id, user.id, user.username, `Approved Purchase Order. Moved to Accountant queue: ${po.po_number}`);

        // 🔔 Notify PM (creator) — approved
        await db.prepare(`
          INSERT INTO po_notifications (user_id, po_id, po_number, type, message, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          po.creator_user_id, id, po.po_number, 'approved',
          `✅ Your Purchase Order ${po.po_number} was approved by Admin and sent to Accountant for processing.`,
          timestampStr
        );

        // 🔔 Notify all Accountants — approved and in their queue
        for (const acct of accountants) {
          await db.prepare(`
            INSERT INTO po_notifications (user_id, po_id, po_number, type, message, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            acct.id, id, po.po_number, 'approved',
            `📋 Purchase Order ${po.po_number} has been approved and is now ready in your processing queue.`,
            timestampStr
          );
        }

      } else if (action === 'reject') {
        await db.prepare(`
          UPDATE purchase_orders 
          SET status = 'rejected',
              rejection_reason = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(rejection_reason || comments || 'No reason provided', id);

        await db.prepare(`
          INSERT INTO po_approval_history (po_id, action, actor_id, actor_name, comments, ist_timestamp)
          VALUES (?, 'reject', ?, ?, ?, ?)
        `).run(id, user.id, user.full_name, rejection_reason || comments || 'Rejected by Admin', timestampStr);

        await db.prepare(`
          INSERT INTO po_activity_logs (po_id, user_id, username, action, description)
          VALUES (?, ?, ?, 'reject', ?)
        `).run(id, user.id, user.username, `Rejected Purchase Order: ${po.po_number}`);

        // 🔔 Notify PM (creator) only — rejected, no further edit
        await db.prepare(`
          INSERT INTO po_notifications (user_id, po_id, po_number, type, message, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          po.creator_user_id, id, po.po_number, 'rejected',
          `❌ Your Purchase Order ${po.po_number} was rejected by Admin. Reason: ${rejection_reason || comments || 'No reason provided'}`,
          timestampStr
        );

      } else if (action === 'return') {
        await db.prepare(`
          UPDATE purchase_orders 
          SET status = 'returned_for_edit',
              correction_notes = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(correction_notes || comments || 'Please review inputs', id);

        await db.prepare(`
          INSERT INTO po_approval_history (po_id, action, actor_id, actor_name, comments, ist_timestamp)
          VALUES (?, 'return', ?, ?, ?, ?)
        `).run(id, user.id, user.full_name, correction_notes || comments || 'Returned for edit', timestampStr);

        await db.prepare(`
          INSERT INTO po_activity_logs (po_id, user_id, username, action, description)
          VALUES (?, ?, ?, 'return_for_edit', ?)
        `).run(id, user.id, user.username, `Returned Purchase Order for Correction: ${po.po_number}`);

        // 🔔 Notify PM (creator) only — returned, can edit & resubmit
        await db.prepare(`
          INSERT INTO po_notifications (user_id, po_id, po_number, type, message, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          po.creator_user_id, id, po.po_number, 'returned_for_edit',
          `🔄 Your Purchase Order ${po.po_number} was returned for correction by Admin. Notes: ${correction_notes || comments || 'Please review inputs'}. You can edit and resubmit.`,
          timestampStr
        );

      } else {
        throw new Error('Unknown approval action');
      }

      return true;
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error handling PO approval:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
