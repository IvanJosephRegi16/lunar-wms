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
    const preview = searchParams.get('preview');

    // Preview mode: return count for reset confirmation
    if (preview === '1') {
      const authorizedRoles = ['admin', 'pm', 'supervisor'];
      if (!authorizedRoles.includes(user.role)) {
        return NextResponse.json({ error: 'Not authorized to reset scan history' }, { status: 403 });
      }
      const countRow = await db.prepare(`SELECT COUNT(*) as count FROM scan_history WHERE is_deleted = 0`).get() as any;
      return NextResponse.json({ count: countRow?.count || 0 });
    }

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

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const authorizedRoles = ['admin', 'pm', 'supervisor'];
    if (!authorizedRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Only Admin, PM, or Supervisor can reset Scan History.' }, { status: 403 });
    }

    const body = await request.json();
    
    if (body.action === 'preview') {
      const countRow = await db.prepare(`SELECT COUNT(*) as count FROM scan_history WHERE is_deleted = 0`).get() as any;
      return NextResponse.json({ count: countRow?.count || 0 });
    }

    if (body.confirm !== 'CONFIRM_RESET') {
      return NextResponse.json({ error: 'Invalid confirmation code' }, { status: 400 });
    }

    const db = getDb();
    const result = await db.prepare(`UPDATE scan_history SET is_deleted = 1 WHERE is_deleted = 0`).run();

    return NextResponse.json({
      success: true,
      message: `Scan history successfully reset. ${result.changes} records archived.`,
      rows_deleted: result.changes
    });
  } catch (error: any) {
    console.error('Error resetting scan history:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
