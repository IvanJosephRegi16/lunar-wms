import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

// GET: Fetch POs pending supervisor verification
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (user.role !== 'supervisor' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Only Supervisor or Admin can access this module' }, { status: 403 });
    }

    const db = getDb();
    const pos = await db.prepare(`
      SELECT po.*, u.full_name as creator_name
      FROM purchase_orders po
      LEFT JOIN users u ON po.created_by = u.id
      WHERE po.status = 'supervisor_review' AND po.is_deleted = 0
      ORDER BY po.updated_at DESC
    `).all() as any[];

    // Attach items for each PO
    const result = [];
    for (const po of pos) {
      const items = await db.prepare(`
        SELECT poi.*, poi.category as material_category
        FROM purchase_order_items poi
        WHERE poi.po_id = ?
      `).all(po.id) as any[];
      result.push({ ...po, items });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Supervisor GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Supervisor verify & complete a PO
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (user.role !== 'supervisor' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Only Supervisor or Admin can verify POs' }, { status: 403 });
    }

    const body = await req.json();
    const { id, action, remarks = '', items = [] } = body;

    if (!id || !action) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const db = getDb();
    const po = await db.prepare(`
      SELECT po.*, u.full_name as creator_name, u.id as creator_user_id
      FROM purchase_orders po
      LEFT JOIN users u ON po.created_by = u.id
      WHERE po.id = ? AND po.is_deleted = 0
    `).get(id) as any;

    if (!po) return NextResponse.json({ error: 'PO not found' }, { status: 404 });
    if (po.status !== 'supervisor_review') {
      return NextResponse.json({ error: 'This PO is not in the supervisor review queue' }, { status: 400 });
    }

    // IST timestamp
    const d = new Date();
    const options: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Kolkata' };
    const timestampStr = d.toLocaleString('en-IN', options);

    await db.transaction(async () => {
      if (action === 'verify_complete') {
        // Mark PO as completed
        await db.prepare(`
          UPDATE purchase_orders
          SET status = 'completed',
              supervisor_verified_by = ?,
              supervisor_verified_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(user.id, id);

        // Log the activity
        await db.prepare(`
          INSERT INTO po_activity_logs (po_id, user_id, username, action, description)
          VALUES (?, ?, ?, 'supervisor_verified', ?)
        `).run(
          id, user.id, user.username,
          `Supervisor verified and completed PO ${po.po_number}. All materials confirmed received.${remarks ? ' Remarks: ' + remarks : ''}`
        );

        // Record in approval history
        await db.prepare(`
          INSERT INTO po_approval_history (po_id, action, actor_id, actor_name, comments, ist_timestamp)
          VALUES (?, 'supervisor_verified', ?, ?, ?, ?)
        `).run(id, user.id, user.full_name, remarks || 'Supervisor verified — all materials received and confirmed', timestampStr);

        // Update received quantities for all items
        if (items && items.length > 0) {
          for (const item of items) {
            await db.prepare(`
              UPDATE purchase_order_items
              SET received_qty = ?
              WHERE id = ? AND po_id = ?
            `).run(item.received_qty || 0, item.id, id);
          }
        }

        // Notify PM creator
        if (po.creator_user_id) {
          await db.prepare(`
            INSERT INTO po_notifications (user_id, po_id, po_number, type, message, created_at)
            VALUES (?, ?, ?, 'completed', ?, ?)
          `).run(
            po.creator_user_id, id, po.po_number,
            `✅ Purchase Order ${po.po_number} has been verified by Supervisor and is now COMPLETED.`,
            new Date().toISOString()
          );
        }

        // Notify Accountants
        const accountants = await db.prepare(`SELECT id FROM users WHERE role = 'accountant'`).all() as any[];
        for (const acct of accountants) {
          await db.prepare(`
            INSERT INTO po_notifications (user_id, po_id, po_number, type, message, created_at)
            VALUES (?, ?, ?, 'completed', ?, ?)
          `).run(
            acct.id, id, po.po_number,
            `✅ Purchase Order ${po.po_number} has been verified by Supervisor and is now COMPLETED.`,
            new Date().toISOString()
          );
        }

      } else if (action === 'partial_entry') {
        // Update received quantities for all items but don't complete the PO
        if (items && items.length > 0) {
          for (const item of items) {
            await db.prepare(`
              UPDATE purchase_order_items
              SET received_qty = ?
              WHERE id = ? AND po_id = ?
            `).run(item.received_qty || 0, item.id, id);
          }
        }

        await db.prepare(`
          INSERT INTO po_activity_logs (po_id, user_id, username, action, description)
          VALUES (?, ?, ?, 'partial_entry', ?)
        `).run(
          id, user.id, user.username,
          `Supervisor recorded a partial receiving entry for PO ${po.po_number}.${remarks ? ' Remarks: ' + remarks : ''}`
        );

        await db.prepare(`
          INSERT INTO po_approval_history (po_id, action, actor_id, actor_name, comments, ist_timestamp)
          VALUES (?, 'partial_entry', ?, ?, ?, ?)
        `).run(id, user.id, user.full_name, remarks || 'Partial receiving entry saved', timestampStr);



      } else {
        throw new Error('Unknown action');
      }

      // Send PM Message if remarks were provided
      if (po.creator_user_id && remarks && remarks.trim() !== '') {
        await db.prepare(`
          INSERT INTO pm_messages (po_id, po_number, pm_id, supervisor_id, supervisor_name, remarks)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, po.po_number, po.creator_user_id, user.id, user.full_name, remarks.trim());
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Supervisor POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
