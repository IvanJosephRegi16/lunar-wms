import { NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';

// GET: Fetch purchase history with filtering
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const material_id = searchParams.get('material_id');
    const supplier_id = searchParams.get('supplier_id');
    const from_date = searchParams.get('from');
    const to_date = searchParams.get('to');

    const db = getDb();

    let query = `
      SELECT p.*, 
             m.material_name, m.colour, 
             c.category_name,
             u.abbreviation as unit_abbr,
             s.supplier_name
      FROM mat_purchases p
      JOIN mat_inventory m ON m.id = p.material_id
      LEFT JOIN mat_categories c ON c.id = m.category_id
      LEFT JOIN mat_units u ON u.id = m.unit_id
      JOIN mat_suppliers s ON s.id = p.supplier_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (material_id) { query += ` AND p.material_id = ?`; params.push(material_id); }
    if (supplier_id) { query += ` AND p.supplier_id = ?`; params.push(supplier_id); }
    if (from_date) { query += ` AND p.purchase_date >= ?`; params.push(from_date); }
    if (to_date) { query += ` AND p.purchase_date <= ?`; params.push(to_date); }

    query += ` ORDER BY p.purchase_date DESC, p.id DESC`;

    const purchases = await db.prepare(query).all(...params);

    // Also return materials and suppliers for the form dropdowns
    const materials = await db.prepare(`
      SELECT i.id, i.material_name, i.colour, i.current_stock, c.category_name, u.abbreviation
      FROM mat_inventory i
      LEFT JOIN mat_categories c ON c.id = i.category_id
      LEFT JOIN mat_units u ON u.id = i.unit_id
      WHERE i.is_deleted = 0
      ORDER BY i.material_name
    `).all();

    const suppliers = await db.prepare(`SELECT id, supplier_name FROM mat_suppliers WHERE status = 'Active' ORDER BY supplier_name`).all();

    return NextResponse.json({ purchases, materials, suppliers });
  } catch (error: any) {
    console.error('Fetch purchases error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Atomic purchase transaction
export async function POST(request: Request) {
  try {
    const data = await request.json();
    const db = getDb();

    const { action } = data;

    // === ACTION: Record a new purchase ===
    if (action === 'purchase') {
      const { invoice_no, purchase_date, material_id, supplier_id, quantity, rate, remarks, created_by } = data;

      if (!purchase_date || !material_id || !supplier_id || !quantity || !rate) {
        return NextResponse.json({ error: 'Date, Material, Supplier, Quantity, and Rate are required.' }, { status: 400 });
      }

      const qty = parseFloat(quantity);
      const unitRate = parseFloat(rate);
      if (qty <= 0 || unitRate <= 0) {
        return NextResponse.json({ error: 'Quantity and Rate must be positive.' }, { status: 400 });
      }

      const totalAmount = Math.round(qty * unitRate * 100) / 100;
      let purchaseId: number;

      // ATOMIC TRANSACTION: purchase record + inventory update + movement log
      await db.transaction(async () => {
        // 1. Get current stock (the "before" snapshot)
        const material = await db.prepare(`SELECT current_stock FROM mat_inventory WHERE id = ? AND is_deleted = 0`).get(material_id);
        if (!material) throw new Error('Material not found or deleted.');

        const beforeQty = material.current_stock;
        const afterQty = Math.round((beforeQty + qty) * 100) / 100;

        // 2. Create purchase record
        const purchaseResult = await db.prepare(`
          INSERT INTO mat_purchases (invoice_no, purchase_date, material_id, supplier_id, quantity, rate, total_amount, remarks, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(invoice_no || null, purchase_date, material_id, supplier_id, qty, unitRate, totalAmount, remarks || null, created_by || 1);

        purchaseId = Number(purchaseResult.lastInsertRowid);

        // 3. Update inventory stock atomically
        await db.prepare(`
          UPDATE mat_inventory 
          SET current_stock = ?, last_supplier_id = ?, last_rate = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?
          WHERE id = ?
        `).run(afterQty, supplier_id, unitRate, created_by || 1, material_id);

        // 4. Generate immutable movement log entry
        await db.prepare(`
          INSERT INTO mat_movements (material_id, movement_type, before_qty, after_qty, change_qty, source_reference, remarks, created_by)
          VALUES (?, 'Purchase', ?, ?, ?, ?, ?, ?)
        `).run(material_id, beforeQty, afterQty, qty, `Purchase #${purchaseId}`, `Invoice: ${invoice_no || 'N/A'}`, created_by || 1);
      });

      return NextResponse.json({ success: true, id: purchaseId! });
    }

    // === ACTION: Manual stock adjustment ===
    if (action === 'adjust') {
      const { material_id, new_stock, reason, created_by } = data;
      if (material_id === undefined || new_stock === undefined || !reason) {
        return NextResponse.json({ error: 'Material, new stock, and reason are required.' }, { status: 400 });
      }

      const newQty = parseFloat(new_stock);
      if (newQty < 0) {
        return NextResponse.json({ error: 'Stock cannot be negative.' }, { status: 400 });
      }

      await db.transaction(async () => {
        const material = await db.prepare(`SELECT current_stock FROM mat_inventory WHERE id = ? AND is_deleted = 0`).get(material_id);
        if (!material) throw new Error('Material not found.');

        const beforeQty = material.current_stock;
        const changeQty = Math.round((newQty - beforeQty) * 100) / 100;

        await db.prepare(`UPDATE mat_inventory SET current_stock = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?`)
          .run(newQty, created_by || 1, material_id);

        await db.prepare(`
          INSERT INTO mat_movements (material_id, movement_type, before_qty, after_qty, change_qty, source_reference, remarks, created_by)
          VALUES (?, 'Adjustment', ?, ?, ?, 'Manual Adjustment', ?, ?)
        `).run(material_id, beforeQty, newQty, changeQty, reason, created_by || 1);
      });

      return NextResponse.json({ success: true });
    }

    // === ACTION: Add supplier ===
    if (action === 'add_supplier') {
      const { supplier_name, contact_person, contact_number, email, address, gstin } = data;
      if (!supplier_name) return NextResponse.json({ error: 'Supplier name is required.' }, { status: 400 });

      const existing = await db.prepare(`SELECT id FROM mat_suppliers WHERE supplier_name = ?`).get(supplier_name);
      if (existing) return NextResponse.json({ error: 'Supplier already exists.' }, { status: 400 });

      const result = await db.prepare(`
        INSERT INTO mat_suppliers (supplier_name, contact_person, contact_number, email, address, gstin)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(supplier_name, contact_person || null, contact_number || null, email || null, address || null, gstin || null);

      return NextResponse.json({ success: true, id: result.lastInsertRowid });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Buying API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
