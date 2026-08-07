import { NextRequest, NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // CRITICAL SECURITY: Only admins and supervisors can wipe the database
  if (user.role !== 'admin' && user.role !== 'supervisor') {
    return NextResponse.json({ error: 'Forbidden: Insufficient privileges to reset system data.' }, { status: 403 });
  }

  const { confirm } = await req.json();
  if (confirm !== 'RESET ALL DATA') {
    return NextResponse.json({ error: 'Invalid confirmation string' }, { status: 400 });
  }

  const db = getDb();
  
  // Clear all stock-related tables
  await db.prepare('DELETE FROM daily_stock').run();
  await db.prepare('DELETE FROM v_strap').run();
  // We can also reset sheet statuses if needed
  await db.prepare("UPDATE daily_sheets SET status = 'open', locked_by = NULL, locked_at = NULL").run();

  await logAudit({ 
    userId: user.id, 
    username: user.username, 
    action: 'SYSTEM_RESET', 
    module: 'system', 
    description: 'User performed a complete data reset of all stock ledgers.' 
  });

  return NextResponse.json({ success: true });
}
