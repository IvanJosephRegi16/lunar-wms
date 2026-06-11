import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role === 'worker') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const db = getDb();
    let query = `
      SELECT po.*, u.full_name as creator_name 
      FROM purchase_orders po
      JOIN users u ON po.created_by = u.id
      WHERE po.is_deleted = 0
    `;
    const params: any[] = [];

    // Role-based visibility
    if (user.role === 'pm') {
      query += ` AND po.created_by = ?`;
      params.push(user.id);
    } else if (user.role === 'accountant') {
      // Accountant can ONLY see POs that are approved (processing or completed)
      query += ` AND po.status IN ('accountant_processing', 'completed')`;
    }

    query += ` ORDER BY po.id DESC`;

    const pos = await db.prepare(query).all(...params) as any[];

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

    // Include raw material items instead of sizes
    const mergedPos = await Promise.all(pos.map(async p => {
      const healed = await healPoData(p);
      const items = await db.prepare(`
        SELECT id, material_code, material_name, size_thickness, order_rate, current_stock, current_stock_unit, required_qty, unit, amount, vendor, remarks 
        FROM purchase_order_items 
        WHERE po_id = ?
      `).all(healed.id) as any[];
      
      return {
        ...healed,
        items
      };
    }));

    return NextResponse.json({ pos: mergedPos });
  } catch (error: any) {
    console.error('Error fetching POs:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    // Strict backend role check: Only Admin and PM can create POs
    if (user.role !== 'pm' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Only Purchase Managers or Admins can create POs' }, { status: 403 });
    }

    const body = await req.json();
    const {
      vendor,
      discount_percent = 0,
      remarks = '',
      status = 'draft',
      items = [],
      po_number: custom_po_number,
      po_date
    } = body;

    // Operational validations
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

    const db = getDb();

    // Validate unique custom PO number if provided
    let po_number = custom_po_number?.trim();
    if (po_number) {
      const existing = await db.prepare(`SELECT id FROM purchase_orders WHERE po_number = ?`).get(po_number);
      if (existing) {
        return NextResponse.json({ error: `PO Number '${po_number}' is already taken. Please specify a unique PO Number.` }, { status: 400 });
      }
    } else {
      // 1. Auto-generate sequential PO number YYMMDD-XXXX based on the provided PO Date
      const dateObj = po_date ? new Date(po_date) : new Date();
      const yy = dateObj.getFullYear().toString().slice(-2);
      const mm = (dateObj.getMonth() + 1).toString().padStart(2, '0');
      const dd = dateObj.getDate().toString().padStart(2, '0');
      const dayPrefix = `${yy}${mm}${dd}-`;

      const existingPos = await db.prepare(`SELECT po_number FROM purchase_orders WHERE po_number LIKE ?`).all(dayPrefix + '%') as { po_number: string }[];
      let maxSeq = 0;
      for (const p of existingPos) {
        const parts = p.po_number.split('-');
        const seqStr = parts[parts.length - 1];
        if (/^\d+$/.test(seqStr)) {
          const seq = parseInt(seqStr, 10);
          if (seq > maxSeq) {
            maxSeq = seq;
          }
        }
      }
      const nextSeq = maxSeq + 1;
      po_number = dayPrefix + nextSeq.toString().padStart(4, '0');
    }

    // 2. Perform dynamic row Calculations
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

    // Save into database inside atomic transaction
    const result = await db.transaction(async () => {
      // Insert PO Header
      const poRes = await db.prepare(`
        INSERT INTO purchase_orders (
          po_number, vendor, status, remarks, gross_amount, discount_percent, net_amount, created_by, po_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        po_number, vendor, status, remarks, gross_amount, discount_percent_val, net_amount, user.id, po_date || null
      );
      const poId = poRes.lastInsertRowid;

      // Insert dynamic PO Raw Material items
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

      // Log to po_activity_logs
      await db.prepare(`
        INSERT INTO po_activity_logs (po_id, user_id, username, action, description)
        VALUES (?, ?, ?, 'create', ?)
      `).run(poId, user.id, user.username, `Created Raw Material Purchase Order Draft: ${po_number}`);

      if (status === 'pending_admin_approval') {
        await db.prepare(`
          INSERT INTO po_activity_logs (po_id, user_id, username, action, description)
          VALUES (?, ?, ?, 'submit', ?)
        `).run(poId, user.id, user.username, `Submitted Raw Material PO for Admin Review: ${po_number}`);
        
        // Log to approval history
        const istStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        await db.prepare(`
          INSERT INTO po_approval_history (po_id, action, actor_id, actor_name, comments, ist_timestamp)
          VALUES (?, 'submit', ?, ?, 'Initial Procurement Submit', ?)
        `).run(poId, user.id, user.full_name, istStr);

        // 🔔 MNC-grade Notification: Insert separate row for each Admin user so they can read independently
        const admins = await db.prepare(`SELECT id FROM users WHERE role = 'admin'`).all() as any[];
        for (const adm of admins) {
          await db.prepare(`
            INSERT INTO po_notifications (user_id, po_id, po_number, type, message, created_at)
            VALUES (?, ?, ?, 'pending_admin_approval', ?, ?)
          `).run(
            adm.id, poId, po_number,
            `⏳ Purchase Order ${po_number} was submitted by ${user.full_name} and is pending your approval.`,
            new Date().toISOString()
          );
        }
      }

      return poId;
    });

    return NextResponse.json({ success: true, id: result, po_number });
  } catch (error: any) {
    console.error('Error creating PO:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
