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
    
    // Allow payment/financial updates on both accountant_processing and completed POs
    if (po.status !== 'accountant_processing' && po.status !== 'completed') {
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
          if (itemId) {
            await db.prepare(`
              UPDATE purchase_order_items 
              SET required_qty = ?, order_rate = ?, amount = ? * ? 
              WHERE id = ?
            `).run(required_qty, order_rate, required_qty, order_rate, itemId);
            calculatedGross += required_qty * order_rate;
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

      // Determine new status (keep completed POs as completed)
      const targetStatus = (finalize || po.status === 'completed') ? 'completed' : 'accountant_processing';

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

      success = true;
    });

    return NextResponse.json({ success });
  } catch (error: any) {
    console.error('Accountant update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
