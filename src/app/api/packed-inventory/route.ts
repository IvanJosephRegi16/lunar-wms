import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const db = getDb();
    
    let query = `
      SELECT 
        c.id,
        c.carton_id,
        c.status,
        c.created_at,
        c.scanned_at,
        pt.article_code,
        pt.colour,
        pc.name as config_name,
        (
          SELECT COALESCE(SUM(oi.quantity_per_carton), 0)
          FROM outward_items oi
          WHERE oi.transaction_id = pt.id
        ) as total_pairs,
        (
          SELECT json_agg(json_build_object('size', oi.size, 'quantity', oi.quantity_per_carton))
          FROM outward_items oi
          WHERE oi.transaction_id = pt.id
        ) as sizes,
        (
          SELECT mrp FROM inventory_pool 
          WHERE article_code = pt.article_code AND colour = pt.colour 
          LIMIT 1
        ) as mrp
      FROM packed_cartons c
      JOIN outward_transactions pt ON c.transaction_id = pt.id
      JOIN carton_generation pc ON pt.config_id = pc.id
      WHERE (c.status = 'completed' OR c.status = 'pending' OR c.status = 'pending_validation')
      AND pt.is_deleted = 0
    `;
    
    const params: any[] = [];
    
    if (startDate && endDate) {
      query += ` AND date(c.created_at) >= ? AND date(c.created_at) <= ?`;
      params.push(startDate, endDate);
    } else if (startDate) {
      query += ` AND date(c.created_at) = ?`;
      params.push(startDate);
    }
    
    query += ` ORDER BY c.created_at DESC, c.id ASC`;
    
    const inventory = await db.prepare(query).all(...params);

    return NextResponse.json({ inventory });
  } catch (error: any) {
    console.error('Error fetching packed inventory:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
