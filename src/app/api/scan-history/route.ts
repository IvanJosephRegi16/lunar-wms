import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb();
    
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = `
      SELECT s.*, 
        CASE 
          WHEN u.role = 'admin' THEN '-'
          ELSE COALESCE(NULLIF(u.full_name, ''), u.username)
        END as operator_name 
      FROM scan_history s
      LEFT JOIN users u ON s.operator_id = u.id
      WHERE s.is_deleted = 0
    `;

    const params: any[] = [];
    
    if (startDate && endDate) {
      query += ` AND date(s.created_at) >= ? AND date(s.created_at) <= ?`;
      params.push(startDate, endDate);
    } else if (startDate) {
      query += ` AND date(s.created_at) = ?`;
      params.push(startDate);
    }
    
    query += ` ORDER BY s.created_at DESC LIMIT 2000`;
    
    const history = await db.prepare(query).all(...params);

    return NextResponse.json({ history });
  } catch (error: any) {
    console.error('Error fetching scan history:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
