import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resolvedParams = await params;
  const leaveId = parseInt(resolvedParams.id, 10);
  if (isNaN(leaveId)) {
    return NextResponse.json({ error: 'Invalid leave ID' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { action, remarks } = body; // action: 'approve', 'reject', 'return'

    if (!['approve', 'reject', 'return'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const db = getDb();
    
    // Fetch current leave
    const leave = await db.prepare('SELECT * FROM leave_applications WHERE id = ?').all(leaveId);
    if (!leave || leave.length === 0) {
      return NextResponse.json({ error: 'Leave application not found' }, { status: 404 });
    }

    const currentLeave = leave[0];
    let newStatus = currentLeave.status;
    let updateField = '';
    
    // Authorization & Status Transition Logic
    if (user.role === 'admin') {
      if (!['pending_admin', 'pending_supervisor', 'pending_pm'].includes(currentLeave.status)) {
        return NextResponse.json({ error: 'Leave is not in a pending state' }, { status: 400 });
      }
      
      if (action === 'approve') newStatus = 'approved';
      if (action === 'reject') newStatus = 'rejected_by_admin';
      if (action === 'return') newStatus = 'returned_by_admin';
      updateField = 'admin_remarks';
      
    } else if (user.role === 'pm') {
      if (currentLeave.status !== 'pending_pm') {
        return NextResponse.json({ error: 'Leave is not pending PM approval' }, { status: 400 });
      }

      if (action === 'approve') newStatus = 'pending_admin';
      if (action === 'reject') newStatus = 'rejected_by_pm';
      if (action === 'return') newStatus = 'returned_by_pm';
      updateField = 'pm_remarks';

    } else if (user.role === 'supervisor') {
      // Supervisor can only act on leaves assigned to them and currently pending supervisor approval
      if (currentLeave.supervisor_id !== user.id) {
        return NextResponse.json({ error: 'Not authorized to action this leave' }, { status: 403 });
      }
      if (currentLeave.status !== 'pending_supervisor') {
        return NextResponse.json({ error: 'Leave is not pending supervisor approval' }, { status: 400 });
      }
      
      if (action === 'approve') newStatus = 'pending_pm';
      if (action === 'reject') newStatus = 'rejected_by_supervisor';
      if (action === 'return') newStatus = 'returned_by_supervisor';
      updateField = 'supervisor_remarks';
      
    } else {
      return NextResponse.json({ error: 'Not authorized to perform this action' }, { status: 403 });
    }

    // Update the leave
    await db.prepare(`
      UPDATE leave_applications 
      SET status = ?, ${updateField} = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newStatus, remarks || null, leaveId);

    // Notification Logic
    const notifyUser = async (userId: number, msg: string) => {
      await db.prepare(`INSERT INTO po_notifications (user_id, message, type) VALUES (?, ?, 'leave')`).run(userId, msg);
    };
    
    const notifyRole = async (role: string, msg: string) => {
      const roleUsers = await db.prepare(`SELECT id FROM users WHERE role = ? AND is_active = 1`).all(role) as any[];
      for (const u of roleUsers) {
        await notifyUser(u.id, msg);
      }
    };

    if (newStatus === 'pending_pm') {
      await notifyRole('pm', `Leave application escalated to you for pre-approval`);
    } else if (newStatus === 'pending_admin') {
      await notifyRole('admin', `Leave application requires final sanction`);
    } else if (newStatus.startsWith('rejected') || newStatus.startsWith('returned') || newStatus === 'approved') {
      // Notify the original applicant
      const stateLabel = newStatus.includes('approved') ? 'Approved' : newStatus.includes('rejected') ? 'Rejected' : 'Returned';
      await notifyUser(currentLeave.user_id, `Your leave application has been ${stateLabel}`);
    }

    return NextResponse.json({ success: true, newStatus });
  } catch (error: any) {
    console.error('Error updating leave:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
