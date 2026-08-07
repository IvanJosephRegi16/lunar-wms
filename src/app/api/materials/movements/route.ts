import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const material_id = searchParams.get('material_id');
    const type = searchParams.get('type'); // optional filter by movement_type
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const db = getDb();
    let query = `
      SELECT m.*, i.material_name, i.colour, u.unit_name, u.abbreviation
      FROM mat_movements m
      JOIN mat_inventory i ON i.id = m.material_id
      LEFT JOIN mat_units u ON i.unit_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (material_id) { query += ` AND m.material_id = ?`; params.push(material_id); }
    if (type) { query += ` AND m.movement_type = ?`; params.push(type); }
    if (from) { query += ` AND m.created_at >= ?`; params.push(from); }
    if (to) { query += ` AND m.created_at <= ?`; params.push(to); }

    query += ` ORDER BY m.created_at DESC, m.id DESC`;

    const movements = await db.prepare(query).all(...params);
    return NextResponse.json({ movements });
  } catch (error: any) {
    console.error('Fetch movements error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
