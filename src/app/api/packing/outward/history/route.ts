import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb();
    
    // Fetch completed or in-progress scan outward sessions
    const sessions = await db.prepare(`
      SELECT 
        s.id as session_id,
        s.article_code,
        s.colour,
        s.status,
        s.created_at,
        s.completed_at,
        c.name as rule_name,
        c.total_pairs,
        u.full_name as operator_name
      FROM outward_scan_sessions s
      JOIN carton_generation c ON s.carton_generation_id = c.id
      LEFT JOIN users u ON s.operator_id = u.id
      ORDER BY s.created_at DESC
      LIMIT 100
    `).all();

    return NextResponse.json({
      success: true,
      history: sessions
    });
  } catch (error: any) {
    console.error('Error fetching outward scan history:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
