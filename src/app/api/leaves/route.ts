import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  try {
    let query = '';
    let params: any[] = [];

    if (user.role === 'admin') {
      // Admin sees everything
      query = `
        SELECT l.*, u.full_name as emp_name, u.phone, u.role, 
               s.full_name as supervisor_name
        FROM leave_applications l
        JOIN users u ON l.user_id = u.id
        LEFT JOIN users s ON l.supervisor_id = s.id
        ORDER BY l.created_at DESC
      `;
    } else if (user.role === 'supervisor') {
      // Supervisor sees their own AND those assigned to them
      query = `
        SELECT l.*, u.full_name as emp_name, u.phone, u.role,
               s.full_name as supervisor_name
        FROM leave_applications l
        JOIN users u ON l.user_id = u.id
        LEFT JOIN users s ON l.supervisor_id = s.id
        WHERE l.user_id = ? OR l.supervisor_id = ?
        ORDER BY l.created_at DESC
      `;
      params = [user.id, user.id];
    } else {
      // Worker / PM / Accountant sees only their own
      query = `
        SELECT l.*, u.full_name as emp_name, u.phone, u.role,
               s.full_name as supervisor_name
        FROM leave_applications l
        JOIN users u ON l.user_id = u.id
        LEFT JOIN users s ON l.supervisor_id = s.id
        WHERE l.user_id = ?
        ORDER BY l.created_at DESC
      `;
      params = [user.id];
    }

    const leaves = await db.prepare(query).all(...params);
    return NextResponse.json({ leaves });
  } catch (error: any) {
    console.error('Error fetching leaves:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { department, leave_type, start_date, end_date, total_days, reason, supervisor_id } = body;

    if (!start_date || !end_date || !total_days || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = getDb();
    
    let initialStatus = 'pending_admin';
    let assignedSupervisor = supervisor_id || null;

    if (user.role === 'worker') {
      if (!supervisor_id) {
        return NextResponse.json({ error: 'Supervisor selection is required for workers' }, { status: 400 });
      }
      initialStatus = 'pending_supervisor';
    } else {
      // Non-workers send directly to Admin
      assignedSupervisor = null;
    }

    await db.prepare(`
      INSERT INTO leave_applications (
        user_id, department, leave_type, start_date, end_date, total_days, reason, supervisor_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.id,
      department || null,
      leave_type || 'Annual Leave',
      start_date,
      end_date,
      total_days,
      reason,
      assignedSupervisor,
      initialStatus
    );

    return NextResponse.json({ success: true, message: 'Leave application submitted successfully' });
  } catch (error: any) {
    console.error('Error creating leave:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
