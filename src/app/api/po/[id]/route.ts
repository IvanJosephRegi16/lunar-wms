import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role === 'worker') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const resolvedParams = await params;
    const poId = resolvedParams.id;
    const db = getDb();

    // On-the-fly Self-healing Database Recalculator
    async function healPoData(poObj: any) {
      if (!poObj) return poObj;
      const itemsList = await db.prepare(`SELECT * FROM purchase_order_items WHERE po_id = ?`).all(poObj.id) as any[];
      if (itemsList.length === 0) return poObj;

      let calculatedGross = 0;
      for (const it of itemsList) {
        calculatedGross += (Number(it.order_rate) || 0) * (Number(it.required_qty) || 0);
      }

      const discount = Number(poObj.discount_percent) || 0;
      const net = calculatedGross * (1 - discount / 100);
      const transport = Number(poObj.transport_charge) || 0;
      const grand = net + transport;
      const paid = Number(poObj.amount_paid) || 0;
      const balance = grand - paid;

      const expectedStatus = balance <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';

      const needsNumericalHeal = calculatedGross > 0 && (poObj.gross_amount === 0 || poObj.net_amount === 0 || poObj.grand_total === 0);
      const needsStatusHeal = poObj.payment_status !== expectedStatus;

      if (needsNumericalHeal || needsStatusHeal) {
        await db.prepare(`
          UPDATE purchase_orders
          SET gross_amount = ?, net_amount = ?, grand_total = ?, balance_amount = ?, payment_status = ?
          WHERE id = ?
        `).run(calculatedGross, net, grand, balance, expectedStatus, poObj.id);

        poObj.gross_amount = calculatedGross;
        poObj.net_amount = net;
        poObj.grand_total = grand;
        poObj.balance_amount = balance;
        poObj.payment_status = expectedStatus;
      }
      return poObj;
    }

    let po = await db.prepare(`
      SELECT po.*, u.full_name as creator_name 
      FROM purchase_orders po
      JOIN users u ON po.created_by = u.id
      WHERE po.id = ? AND po.is_deleted = 0
    `).get(poId) as any;

    if (!po) return NextResponse.json({ error: 'Purchase order not found or deleted' }, { status: 404 });
    po = await healPoData(po);

    // Strict accountant visibility rule before approval
    if (user.role === 'accountant' && po.status !== 'accountant_processing' && po.status !== 'completed') {
      return NextResponse.json({ error: 'Access denied to this PO stage' }, { status: 403 });
    }

    // Raw Material items
    const items = await db.prepare(`
      SELECT id, material_code, material_name, size_thickness, order_rate, current_stock, current_stock_unit, required_qty, unit, amount, vendor, remarks 
      FROM purchase_order_items 
      WHERE po_id = ?
    `).all(poId) as any[];

    // History and audit logs
    const approvalHistory = await db.prepare(`
      SELECT * FROM po_approval_history WHERE po_id = ? ORDER BY id ASC
    `).all(poId);

    const activityLogs = await db.prepare(`
      SELECT * FROM po_activity_logs WHERE po_id = ? ORDER BY id DESC
    `).all(poId);

    return NextResponse.json({
      po: {
        ...po,
        items
      },
      approvalHistory,
      activityLogs
    });
  } catch (error: any) {
    console.error('Error fetching PO details:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const resolvedParams = await params;
    const poId = resolvedParams.id;
    const db = getDb();

    // Fetch existing PO
    const po = await db.prepare(`SELECT * FROM purchase_orders WHERE id = ? AND is_deleted = 0`).get(poId) as any;
    if (!po) return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });

    // Strict role check: PMs can ONLY edit draft or returned POs
    if (user.role === 'pm') {
      if (po.status !== 'draft' && po.status !== 'returned_for_edit') {
        return NextResponse.json({ error: 'This PO is locked and cannot be edited by PM roles.' }, { status: 403 });
      }
    } else if (user.role !== 'admin') {
      // Accountants and Workers cannot edit basic details
      return NextResponse.json({ error: 'Unauthorized to modify basic PO details' }, { status: 403 });
    }

    const body = await req.json();
    const {
      vendor,
      discount_percent = 0,
      remarks = '',
      status = po.status,
      items = [],
      po_number: custom_po_number,
      po_date
    } = body;

    // Field-level validations
    if (!vendor) {
      return NextResponse.json({ error: 'Missing required field: Vendor' }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Purchase Order must contain at least one material item' }, { status: 400 });
    }

    // Verify row level items
    for (const [idx, item] of items.entries()) {
      const { material_name, size_thickness, order_rate, required_qty } = item;
      if (!material_name || !size_thickness || order_rate === undefined || required_qty === undefined) {
        return NextResponse.json({ error: `Item at index ${idx + 1} has missing operational fields (Name, Size, Rate, or Qty)` }, { status: 400 });
      }
      if (Number(order_rate) <= 0 || Number(required_qty) <= 0) {
        return NextResponse.json({ error: `Item at index ${idx + 1} must have a positive Order Rate and Required Quantity` }, { status: 400 });
      }
    }

    // Perform dynamic row calculations
    let gross_amount = 0;
    const computedItems = items.map(item => {
      const orderRate = Number(item.order_rate);
      const requiredQty = Number(item.required_qty);
      const itemAmount = orderRate * requiredQty;
      gross_amount += itemAmount;
      return {
        ...item,
        order_rate: orderRate,
        required_qty: requiredQty,
        amount: itemAmount
      };
    });

    const discount_percent_val = Math.min(Math.max(Number(discount_percent) || 0, 0), 100);
    const net_amount = gross_amount * (1 - discount_percent_val / 100);

    const result = await db.transaction(async () => {
      // Validate unique custom PO number if provided and changed
      let new_po_number = custom_po_number?.trim();
      if (new_po_number && new_po_number !== po.po_number) {
        const existing = await db.prepare(`SELECT id FROM purchase_orders WHERE po_number = ? AND id != ?`).get(new_po_number, poId);
        if (existing) {
          throw new Error(`PO Number '${new_po_number}' is already taken. Please specify a unique PO Number.`);
        }
      } else if (!new_po_number) {
        new_po_number = po.po_number;
      }

      // Update PO basic details (PM Columns A-J)
      await db.prepare(`
        UPDATE purchase_orders 
        SET po_number = ?, vendor = ?, gross_amount = ?, discount_percent = ?, net_amount = ?, remarks = ?, status = ?,
            updated_at = CURRENT_TIMESTAMP, po_date = ?
        WHERE id = ?
      `).run(
        new_po_number, vendor, gross_amount, discount_percent_val, net_amount, remarks, status, po_date || po.po_date || null, poId
      );

      // Re-insert items
      await db.prepare(`DELETE FROM purchase_order_items WHERE po_id = ?`).run(poId);
      for (const item of computedItems) {
        await db.prepare(`
          INSERT INTO purchase_order_items (
            po_id, material_code, material_name, size_thickness, order_rate, current_stock, current_stock_unit, required_qty, unit, amount, vendor, remarks
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          poId,
          item.material_code,
          item.material_name,
          item.size_thickness,
          item.order_rate,
          Number(item.current_stock) || 0,
          item.current_stock_unit || 'Pair',
          item.required_qty,
          item.unit || 'Pair',
          item.amount,
          item.vendor || vendor || '',
          item.remarks || ''
        );
      }

      // Log action
      if (status === 'pending_admin_approval' && po.status !== 'pending_admin_approval') {
        await db.prepare(`
          INSERT INTO po_activity_logs (po_id, user_id, username, action, description)
          VALUES (?, ?, ?, 'submit', ?)
        `).run(poId, user.id, user.username, `Resubmitted Raw Material PO for Admin Approval: ${po.po_number}`);

        const istStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        await db.prepare(`
          INSERT INTO po_approval_history (po_id, action, actor_id, actor_name, comments, ist_timestamp)
          VALUES (?, 'submit', ?, ?, 'Resubmitted Procurement after Return/Draft', ?)
        `).run(poId, user.id, user.full_name, istStr);

        // 🔔 MNC-grade Notification: Insert separate row for each Admin user so they can read independently
        const admins = await db.prepare(`SELECT id FROM users WHERE role = 'admin'`).all() as any[];
        for (const adm of admins) {
          await db.prepare(`
            INSERT INTO po_notifications (user_id, po_id, po_number, type, message, created_at)
            VALUES (?, ?, ?, 'pending_admin_approval', ?, ?)
          `).run(
            adm.id, poId, po.po_number,
            `⏳ Purchase Order ${po.po_number} was resubmitted by ${user.full_name} and is pending your approval.`,
            new Date().toISOString()
          );
        }
      } else {
        await db.prepare(`
          INSERT INTO po_activity_logs (po_id, user_id, username, action, description)
          VALUES (?, ?, ?, 'edit', ?)
        `).run(poId, user.id, user.username, `Updated basic Raw Material PO details (A-J): ${po.po_number}`);
      }

      return true;
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating PO:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
