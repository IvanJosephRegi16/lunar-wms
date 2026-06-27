import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();
    
    // Aggregate total approved days this month and this year for the logged-in user
    const stats = await db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN TO_CHAR(start_date::timestamp, 'YYYY-MM') = TO_CHAR(CURRENT_TIMESTAMP, 'YYYY-MM') THEN total_days ELSE 0 END), 0) as this_month_taken,
        COALESCE(SUM(CASE WHEN TO_CHAR(start_date::timestamp, 'YYYY') = TO_CHAR(CURRENT_TIMESTAMP, 'YYYY') THEN total_days ELSE 0 END), 0) as this_year_taken
      FROM leave_applications
      WHERE user_id = ? AND status = 'approved'
    `).get(user.id) as any;

    // Fetch all their leave applications
    const leaves = await db.prepare(`
      SELECT l.*, s.full_name as supervisor_name
      FROM leave_applications l
      LEFT JOIN users s ON l.supervisor_id = s.id
      WHERE l.user_id = ?
      ORDER BY l.created_at DESC
    `).all(user.id) as any[];

    return NextResponse.json({ 
      user: { full_name: user.full_name, role: user.role },
      stats: stats || { this_month_taken: 0, this_year_taken: 0 },
      leaves 
    });
  } catch (error: any) {
    console.error('Error fetching personal leave profile:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
