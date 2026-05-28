import { NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || '';
    const search = searchParams.get('search') || '';
    
    const db = getDb();
    
    // Fetch lookup dictionaries
    const categories = await db.prepare("SELECT * FROM mat_categories ORDER BY category_name").all();
    const units = await db.prepare("SELECT * FROM mat_units ORDER BY unit_name").all();
    const suppliers = await db.prepare("SELECT id, supplier_name FROM mat_suppliers WHERE status = 'Active'").all();

    // Build highly optimized query for the inventory matrix
    let query = `
      SELECT i.*, 
             c.category_name, 
             u.unit_name, u.abbreviation,
             s.supplier_name as last_supplier_name
      FROM mat_inventory i
      LEFT JOIN mat_categories c ON i.category_id = c.id
      LEFT JOIN mat_units u ON i.unit_id = u.id
      LEFT JOIN mat_suppliers s ON i.last_supplier_id = s.id
      WHERE i.is_deleted = 0
    `;
    const params: any[] = [];
    
    if (category && category !== 'all') {
      query += ` AND i.category_id = ?`;
      params.push(category);
    }
    
    if (search) {
      query += ` AND (i.material_name LIKE ? OR c.category_name LIKE ? OR i.colour LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    query += ` ORDER BY c.category_name ASC, i.material_name ASC`;
    
    const inventory = await db.prepare(query).all(...params);

    return NextResponse.json({ inventory, categories, units, suppliers });
  } catch (error: any) {
    console.error('Fetch inventory error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const db = getDb();

    // Ensure material name and category exist
    if (!data.material_name || !data.category_id || !data.unit_id) {
      return NextResponse.json({ error: 'Name, Category, and Unit are required' }, { status: 400 });
    }

    let materialId;
    let initialStock = parseFloat(data.current_stock) || 0;

    await db.transaction(async () => {
      // 1. Create the inventory record
      const stmt = db.prepare(`
        INSERT INTO mat_inventory (
          material_name, category_id, colour, unit_id, 
          current_stock, min_stock_level, warning_threshold, 
          created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = await stmt.run(
        data.material_name,
        data.category_id,
        data.colour || null,
        data.unit_id,
        initialStock,
        data.min_stock_level || 0,
        data.warning_threshold || 0,
        data.created_by || 1
      );

      materialId = result.lastInsertRowid;

      // 2. If there is opening stock, log it immediately into the immutable movement engine
      if (initialStock > 0) {
        await db.prepare(`
          INSERT INTO mat_movements (
            material_id, movement_type, before_qty, after_qty, change_qty, 
            source_reference, remarks, created_by
          ) VALUES (?, 'Adjustment', 0, ?, ?, 'Opening Stock', 'Initial inventory entry', ?)
        `).run(materialId, initialStock, initialStock, data.created_by || 1);
      }
    });

    await logAudit({
      userId: data.created_by || 1,
      username: 'system',
      action: 'material_create',
      module: 'materials',
      recordId: Number(materialId),
      description: `Created new raw material: ${data.material_name}`
    });

    return NextResponse.json({ success: true, id: materialId });
  } catch (error: any) {
    console.error('Create material error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
