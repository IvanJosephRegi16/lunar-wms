import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb();
    
    const history = await db.prepare(`
      SELECT s.*, u.username as operator_name 
      FROM scan_history s
      LEFT JOIN users u ON s.operator_id = u.id
      WHERE s.is_deleted = 0
      ORDER BY s.created_at DESC
      LIMIT 1000
    `).all();

    return NextResponse.json({ history });
  } catch (error: any) {
    console.error('Error fetching scan history:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
