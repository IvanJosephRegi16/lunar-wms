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
               s.full_name as supervisor_name,
               (SELECT SUM(total_days) FROM leave_applications l2 
                WHERE l2.user_id = l.user_id 
                AND l2.status = 'approved' 
                AND strftime('%Y-%m', l2.start_date) = strftime('%Y-%m', 'now')) as this_month_taken
        FROM leave_applications l
        JOIN users u ON l.user_id = u.id
        LEFT JOIN users s ON l.supervisor_id = s.id
        ORDER BY l.created_at DESC
      `;
    } else if (user.role === 'supervisor') {
      // Supervisor sees their own AND those assigned to them
      query = `
        SELECT l.*, u.full_name as emp_name, u.phone, u.role,
               s.full_name as supervisor_name,
               0 as this_month_taken
        FROM leave_applications l
        JOIN users u ON l.user_id = u.id
        LEFT JOIN users s ON l.supervisor_id = s.id
        WHERE l.user_id = ? OR l.supervisor_id = ?
        ORDER BY l.created_at DESC
      `;
      params = [user.id, user.id];
    } else if (user.role === 'pm') {
      // PM sees their own AND those in pending_pm / returned_by_pm / rejected_by_pm
      query = `
        SELECT l.*, u.full_name as emp_name, u.phone, u.role,
               s.full_name as supervisor_name,
               (SELECT SUM(total_days) FROM leave_applications l2 
                WHERE l2.user_id = l.user_id 
                AND l2.status = 'approved' 
                AND strftime('%Y-%m', l2.start_date) = strftime('%Y-%m', 'now')) as this_month_taken
        FROM leave_applications l
        JOIN users u ON l.user_id = u.id
        LEFT JOIN users s ON l.supervisor_id = s.id
        WHERE l.user_id = ? OR l.status IN ('pending_pm', 'returned_by_pm', 'rejected_by_pm')
        ORDER BY l.created_at DESC
      `;
      params = [user.id];
    } else {
      // Worker / Accountant sees only their own
      query = `
        SELECT l.*, u.full_name as emp_name, u.phone, u.role,
               s.full_name as supervisor_name,
               0 as this_month_taken
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
    } else if (user.role === 'supervisor') {
      initialStatus = 'pending_pm';
    } else if (user.role === 'pm' || user.role === 'accountant') {
      // Non-workers send directly to Admin
      initialStatus = 'pending_admin';
    } else {
      initialStatus = 'pending_admin';
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

    // Notification Logic
    const notifMsg = `New leave application from ${user.full_name} (${total_days} days)`;
    if (initialStatus === 'pending_supervisor' && assignedSupervisor) {
      await db.prepare(`INSERT INTO po_notifications (user_id, message, type) VALUES (?, ?, 'leave')`).run(assignedSupervisor, notifMsg);
    } else if (initialStatus === 'pending_pm') {
      const pms = await db.prepare(`SELECT id FROM users WHERE role = 'pm' AND is_active = 1`).all() as any[];
      for (const pm of pms) {
        await db.prepare(`INSERT INTO po_notifications (user_id, message, type) VALUES (?, ?, 'leave')`).run(pm.id, notifMsg);
      }
    } else if (initialStatus === 'pending_admin') {
      const admins = await db.prepare(`SELECT id FROM users WHERE role = 'admin' AND is_active = 1`).all() as any[];
      for (const adm of admins) {
        await db.prepare(`INSERT INTO po_notifications (user_id, message, type) VALUES (?, ?, 'leave')`).run(adm.id, notifMsg);
      }
    }


    return NextResponse.json({ success: true, message: 'Leave application submitted successfully' });
  } catch (error: any) {
    console.error('Error creating leave:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
