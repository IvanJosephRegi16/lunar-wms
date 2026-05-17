import { NextRequest, NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin','supervisor'].includes(user.role)) return NextResponse.json({ error: 'No permission' }, { status: 403 });

  const { sheet_date, action, comment } = await req.json();
  const db = getDb();

  if (action === 'lock') {
    await db.prepare(`UPDATE daily_sheets SET status='locked', locked_by=?, locked_at=CURRENT_TIMESTAMP WHERE sheet_date=?`).run(user.id, sheet_date);
    await db.prepare(`UPDATE daily_entries SET status='approved', approved_by=?, approved_at=CURRENT_TIMESTAMP WHERE sheet_date=? AND status='submitted'`).run(user.id, sheet_date);
    await logAudit({ userId: user.id, username: user.username, action: 'LOCK_SHEET', module: 'daily_sheet', recordDate: sheet_date });
  } else if (action === 'unlock') {
    if (user.role !== 'admin') return NextResponse.json({ error: 'Only admin can unlock' }, { status: 403 });
    await db.prepare(`UPDATE daily_sheets SET status='open', locked_by=NULL, locked_at=NULL WHERE sheet_date=?`).run(sheet_date);
    await logAudit({ userId: user.id, username: user.username, action: 'UNLOCK_SHEET', module: 'daily_sheet', recordDate: sheet_date });
  } else if (action === 'submit') {
    await db.prepare(`UPDATE daily_sheets SET status='submitted' WHERE sheet_date=? AND status='open'`).run(sheet_date);
    await db.prepare(`UPDATE daily_entries SET status='submitted' WHERE sheet_date=? AND status='draft'`).run(sheet_date);
    await logAudit({ userId: user.id, username: user.username, action: 'SUBMIT_SHEET', module: 'daily_sheet', recordDate: sheet_date });
  } else if (action === 'approve_entry') {
    const { entry_id } = await req.json().catch(() => ({}));
    // handled below
  }

  return NextResponse.json({ success: true });
}
