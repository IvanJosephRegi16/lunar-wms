import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = getDb();
    const configKey = `menu_visibility_config_${user.role}`;
    let configRow = await db.prepare('SELECT value FROM system_settings WHERE "key" = ?').get(configKey) as { value: string } | undefined;
    if (!configRow) {
      configRow = await db.prepare('SELECT value FROM system_settings WHERE "key" = ?').get('menu_visibility_config') as { value: string } | undefined;
    }

    let hasApprovePermission = user.role === 'admin' || user.role === 'pm';
    if (user.role !== 'admin' && user.role !== 'pm') {
      let isPoPendingVisible = true; // default is true
      if (configRow) {
        try {
          const parsed = JSON.parse(configRow.value);
          if (parsed.po_pending === false) {
            isPoPendingVisible = false;
          }
        } catch {}
      }
      if (isPoPendingVisible) {
        hasApprovePermission = true;
      }
    }

    if (!hasApprovePermission) {
      return NextResponse.json({ error: 'Unauthorized: Your role profile does not possess visibility authorization for the pending PO approval queue.' }, { status: 403 });
    }

    const body = await req.json();
    const { id, action, comments = '', rejection_reason = '', correction_notes = '' } = body;

    if (!id || !action) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Fetch PO including creator details
    const po = await db.prepare(`
      SELECT po.*, u.full_name as creator_name, u.id as creator_user_id
      FROM purchase_orders po
      JOIN users u ON po.created_by = u.id
      WHERE po.id = ? AND po.is_deleted = 0
    `).get(id) as any;
    if (!po) return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });

    if (po.status !== 'pending_admin_approval' && po.status !== 'pending_pm_approval') {
      return NextResponse.json({ error: 'This PO is not in a pending approval queue.' }, { status: 400 });
    }
    
    // PM can only approve pending_pm_approval, Admin can only approve pending_admin_approval
    if (user.role === 'pm' && po.status !== 'pending_pm_approval') {
      return NextResponse.json({ error: 'PM can only pre-approve POs.' }, { status: 403 });
    }
    if (user.role === 'admin' && po.status !== 'pending_admin_approval') {
      return NextResponse.json({ error: 'Admin can only approve POs after PM pre-approval.' }, { status: 403 });
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
        if (user.role === 'pm') {
          // PM approves -> sends to Admin
          await db.prepare(`
            UPDATE purchase_orders 
            SET status = 'pending_admin_approval',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(id);

          await db.prepare(`
            INSERT INTO po_approval_history (po_id, action, actor_id, actor_name, comments, ist_timestamp)
            VALUES (?, 'submit', ?, ?, ?, ?)
          `).run(id, user.id, user.full_name, comments || 'Pre-Approved by PM', timestampStr);

          await db.prepare(`
            INSERT INTO po_activity_logs (po_id, user_id, username, action, description)
            VALUES (?, ?, ?, 'approve', ?)
          `).run(id, user.id, user.username, `Pre-Approved Purchase Order. Moved to Admin queue: ${po.po_number}`);

          // Notify Admin
          const admins = await db.prepare(`SELECT id FROM users WHERE role = 'admin'`).all() as any[];
          for (const adm of admins) {
            await db.prepare(`
              INSERT INTO po_notifications (user_id, po_id, po_number, type, message, created_at)
              VALUES (?, ?, ?, 'pending_admin_approval', ?, ?)
            `).run(
              adm.id, id, po.po_number,
              `⏳ Purchase Order ${po.po_number} was pre-approved by PM ${user.full_name} and is pending your final approval.`,
              new Date().toISOString()
            );
          }
        } else {
          // Admin approves -> sends to Accountant
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

          // Notify Creator
          await db.prepare(`
            INSERT INTO po_notifications (user_id, po_id, po_number, type, message, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            po.creator_user_id, id, po.po_number, 'approved',
            `✅ Your Purchase Order ${po.po_number} was approved by Admin and sent to Accountant for processing.`,
            new Date().toISOString()
          );

          // Notify Accountants
          for (const acct of accountants) {
            await db.prepare(`
              INSERT INTO po_notifications (user_id, po_id, po_number, type, message, created_at)
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(
              acct.id, id, po.po_number, 'approved',
              `📋 Purchase Order ${po.po_number} has been approved and is now ready in your processing queue.`,
              new Date().toISOString()
            );
          }
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

        // 🔔 Notify Creator only — rejected, no further edit
        await db.prepare(`
          INSERT INTO po_notifications (user_id, po_id, po_number, type, message, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          po.creator_user_id, id, po.po_number, 'rejected',
          `❌ Your Purchase Order ${po.po_number} was rejected by ${user.role.toUpperCase()}. Reason: ${rejection_reason || comments || 'No reason provided'}`,
          new Date().toISOString()
        );

      } else if (action === 'return') {
        const returnStatus = user.role === 'admin' ? 'returned_by_admin' : 'returned_by_pm';
        
        await db.prepare(`
          UPDATE purchase_orders 
          SET status = ?,
              correction_notes = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(returnStatus, correction_notes || comments || 'Please review inputs', id);

        await db.prepare(`
          INSERT INTO po_approval_history (po_id, action, actor_id, actor_name, comments, ist_timestamp)
          VALUES (?, 'return', ?, ?, ?, ?)
        `).run(id, user.id, user.full_name, correction_notes || comments || `Returned for edit by ${user.role.toUpperCase()}`, timestampStr);

        await db.prepare(`
          INSERT INTO po_activity_logs (po_id, user_id, username, action, description)
          VALUES (?, ?, ?, 'return_for_edit', ?)
        `).run(id, user.id, user.username, `Returned Purchase Order for Correction: ${po.po_number}`);

        if (user.role === 'admin') {
          // Admin returned to PM, notify all PMs
          const pms = await db.prepare(`SELECT id FROM users WHERE role = 'pm'`).all() as any[];
          for (const pm of pms) {
            await db.prepare(`
              INSERT INTO po_notifications (user_id, po_id, po_number, type, message, created_at)
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(
              pm.id, id, po.po_number, 'returned_by_admin',
              `🔄 Admin returned PO ${po.po_number} for PM correction. Notes: ${correction_notes || comments || 'Please review inputs'}`,
              new Date().toISOString()
            );
          }
        } else {
          // PM returned to creator
          await db.prepare(`
            INSERT INTO po_notifications (user_id, po_id, po_number, type, message, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            po.creator_user_id, id, po.po_number, 'returned_by_pm',
            `🔄 PM returned your PO ${po.po_number} for correction. Notes: ${correction_notes || comments || 'Please review inputs'}. You can edit and resubmit.`,
            new Date().toISOString()
          );
        }

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
