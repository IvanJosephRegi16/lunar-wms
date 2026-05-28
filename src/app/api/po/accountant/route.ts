import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    // Only accountant or admin can update PO details
    if (user.role !== 'accountant' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Only Accountant or Admin can update PO financials' }, { status: 403 });
    }

    const body = await req.json();
    const { 
      id, 
      items, 
      invoice_number, 
      transport_charge, 
      amount_paid, 
      shipping_method, 
      delivery_status, 
      finalize 
    } = body as any;

    if (!id) return NextResponse.json({ error: 'Missing PO id' }, { status: 400 });

    const db = getDb();
    const po = await db.prepare('SELECT * FROM purchase_orders WHERE id = ? AND is_deleted = 0').get(id) as any;
    if (!po) return NextResponse.json({ error: 'PO not found' }, { status: 404 });
    
    // Allow payment/financial updates on accountant_processing, supervisor_review, and completed POs
    if (po.status !== 'accountant_processing' && po.status !== 'supervisor_review' && po.status !== 'completed') {
      return NextResponse.json({ error: 'PO is not in an active or completed stage for payment' }, { status: 400 });
    }

    let success = false;

    await db.transaction(async () => {
      // 1. Update each line item in database using required_qty and calculate item amounts
      let calculatedGross = 0;
      if (Array.isArray(items)) {
        for (const it of items) {
          const itemId = it.id;
          const required_qty = Number(it.required_qty ?? it.required_quantity ?? 0);
          const order_rate = Number(it.order_rate ?? 0);
          const itemAmount = required_qty * order_rate;
          if (itemId) {
            await db.prepare(`
              UPDATE purchase_order_items 
              SET required_qty = ?, order_rate = ?, amount = ?
              WHERE id = ?
            `).run(required_qty, order_rate, itemAmount, itemId);
            calculatedGross += itemAmount;
          }
        }
      } else {
        // Fallback: sum the existing item amounts from the database
        const existingItems = await db.prepare('SELECT required_qty, order_rate FROM purchase_order_items WHERE po_id = ?').all(id) as any[];
        for (const item of existingItems) {
          calculatedGross += (item.required_qty || 0) * (item.order_rate || 0);
        }
      }

      // 2. Recalculate PO level financials
      const discountPercent = Number(po.discount_percent) || 0;
      const netAmount = calculatedGross - (calculatedGross * discountPercent / 100);
      
      const transport = Number(transport_charge) ?? Number(po.transport_charge) ?? 0;
      const grandTotal = netAmount + transport;
      const paid = Number(amount_paid) ?? Number(po.amount_paid) ?? 0;
      const balance = grandTotal - paid;

      let paymentStatus = 'unpaid';
      if (balance <= 0) paymentStatus = 'paid';
      else if (paid > 0) paymentStatus = 'partial';

      // Determine new status (keep completed or supervisor POs as is if just updating payment)
      let targetStatus = po.status;
      if (po.status === 'accountant_processing') {
        targetStatus = finalize ? 'supervisor_review' : 'accountant_processing';
      }

      // 3. Update the purchase_orders record with inputs and computed financials
      await db.prepare(`
        UPDATE purchase_orders 
        SET 
          invoice_number = ?,
          transport_charge = ?,
          gross_amount = ?,
          net_amount = ?,
          grand_total = ?,
          amount_paid = ?,
          balance_amount = ?,
          payment_status = ?,
          shipping_method = ?,
          delivery_status = ?,
          status = ?,
          accountant_updated_by = ?,
          accountant_updated_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        invoice_number || po.invoice_number || null,
        transport,
        calculatedGross,
        netAmount,
        grandTotal,
        paid,
        balance,
        paymentStatus,
        shipping_method || po.shipping_method || null,
        delivery_status || po.delivery_status || 'pending',
        targetStatus,
        user.id,
        id
      );

      // 4. Log operational activity
      await db.prepare(`
        INSERT INTO po_activity_logs (po_id, user_id, username, action, description) 
        VALUES (?, ?, ?, 'accountant_update', ?)
      `).run(
        id,
        user.id,
        user.username,
        po.status === 'completed' 
          ? `Recorded payment of ₹${paid.toLocaleString()} against completed PO invoice`
          : (finalize ? 'Finalized PO and completed accounting check' : 'Saved draft updates to PO items and ledger')
      );

      // 5. Notify Supervisors if finalized
      if (finalize && po.status !== 'completed') {
        const supervisors = await db.prepare(`SELECT id FROM users WHERE role = 'supervisor'`).all() as any[];
        const timestampStr = new Date().toISOString();
        const msg = `🔍 Purchase Order ${po.po_number} finalized by Accountant and ready for Verification`;
        for (const sup of supervisors) {
          await db.prepare(`
            INSERT INTO po_notifications (user_id, po_id, po_number, type, message, is_read, created_at)
            VALUES (?, ?, ?, 'supervisor_review', ?, 0, ?)
          `).run(sup.id, po.id, po.po_number, msg, timestampStr);
        }
      }

      success = true;
    });

    return NextResponse.json({ success });
  } catch (error: any) {
    console.error('Accountant update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
