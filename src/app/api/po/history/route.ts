import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role === 'worker') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const db = getDb();

    // Query all activity logs sorted by timestamp desc
    const logs = await db.prepare(`
      SELECT l.*, po.po_number, po.vendor
      FROM po_activity_logs l
      JOIN purchase_orders po ON l.po_id = po.id
      ORDER BY l.timestamp DESC, l.id DESC
      LIMIT 200
    `).all() as any[];

    // Fetch POs for tracking view with full details
    const rawPos = await db.prepare(`
      SELECT po.*,
             u.full_name as creator_name,
             u.role as creator_role,
             split_part(u.full_name, ' ', 1) as creator_first_name
      FROM purchase_orders po
      LEFT JOIN users u ON po.created_by = u.id
      WHERE po.is_deleted = 0
      ORDER BY po.id DESC
    `).all() as any[];

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

    const pos = await Promise.all(rawPos.map(async (po) => {
      const healed = await healPoData(po);
      const items = await db.prepare(`
        SELECT id, category, material_code, material_name, size_thickness, order_rate, original_order_rate, current_stock, current_stock_unit, required_qty, received_qty, unit, amount, vendor, remarks 
        FROM purchase_order_items 
        WHERE po_id = ?
      `).all(healed.id) as any[];
      const uniqueCategories = [...new Set(items.map((it: any) => it.category).filter(Boolean))];
      return { ...healed, items, categories: uniqueCategories };
    }));

    // Calculate pending statistics
    const stats = {
      pendingPm: 0,
      pendingAccountant: 0,
      pendingAdmin: 0,
      pendingStoreKeeper: 0
    };

    pos.forEach(po => {
      if (po.status === 'pending_pm_approval') stats.pendingPm++;
      if (po.status === 'accountant_processing') stats.pendingAccountant++;
      if (po.status === 'pending_admin_approval') stats.pendingAdmin++;
      if (po.status === 'supervisor_review') stats.pendingStoreKeeper++;
    });

    return NextResponse.json({ logs, pos, stats });
  } catch (error: any) {
    console.error('Error fetching PO history:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
