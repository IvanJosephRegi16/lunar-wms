import { NextRequest, NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin' && user.role !== 'pm' && user.role !== 'supervisor') {
      return NextResponse.json({ error: 'Only administrators, managers, or supervisors can reset outward scanning history.' }, { status: 403 });
    }

    const { confirm } = await req.json();
    if (confirm !== 'RESET_HISTORY') {
      return NextResponse.json({ error: 'Invalid confirmation token' }, { status: 400 });
    }

    const db = getDb();

    // Hard delete ALL outward-related data from the database
    await db.prepare('DELETE FROM outward_scan_items').run();
    await db.prepare('DELETE FROM outward_scan_sessions').run();
    await db.prepare('DELETE FROM outward_items').run();
    await db.prepare('DELETE FROM outward_transactions').run();
    await db.prepare('DELETE FROM packed_cartons').run();

    await logAudit({
      userId: user.id,
      username: user.username,
      action: 'OUTWARD_HISTORY_RESET',
      module: 'outward_scan_sessions',
      description: 'User permanently reset the outward scanning history back to zero.'
    });

    return NextResponse.json({
      success: true,
      message: 'Outward scanning history has been successfully reset.'
    });

  } catch (error: any) {
    console.error('Outward History Reset failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
