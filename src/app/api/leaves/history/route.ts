import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
  }
  // All authenticated users can view leave history

  try {
    const db = getDb();
    
    // Aggregate total approved days this month per user (PostgreSQL TO_CHAR)
    const usersList = await db.prepare(`
      SELECT u.id as user_id, u.full_name as emp_name, u.role,
             COALESCE((
               SELECT SUM(total_days) FROM leave_applications l 
               WHERE l.user_id = u.id 
               AND l.status = 'approved' 
               AND TO_CHAR(l.start_date::date, 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
             ), 0) as this_month_taken
      FROM users u
      WHERE u.is_active = 1
      ORDER BY this_month_taken DESC, u.full_name ASC
    `).all() as any[];

    // Fetch all leave applications to allow drill-down
    const allLeaves = await db.prepare(`
      SELECT l.*, u.full_name as emp_name, s.full_name as supervisor_name
      FROM leave_applications l
      JOIN users u ON l.user_id = u.id
      LEFT JOIN users s ON l.supervisor_id = s.id
      ORDER BY l.created_at DESC
    `).all() as any[];

    return NextResponse.json({ users: usersList, leaves: allLeaves });
  } catch (error: any) {
    console.error('Error fetching leave history:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
