import { NextRequest, NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const db = getDb();

  const existing = await db.prepare('SELECT * FROM daily_entries WHERE id = ?').get(Number(id)) as any;
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const sheet = await db.prepare('SELECT * FROM daily_sheets WHERE sheet_date = ?').get(existing.sheet_date) as any;
  if (sheet?.status === 'locked' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Sheet is locked' }, { status: 403 });
  }

  if (existing.status === 'approved' && user.role === 'operator') {
    return NextResponse.json({ error: 'Cannot edit approved entry' }, { status: 403 });
  }

  const oldValue = JSON.stringify(existing);
  
  await db.prepare(`
    UPDATE daily_entries SET
      sl_no=?, article_code=?, description=?, colour=?,
      size_6=?, size_7=?, size_8=?, size_9=?, size_10=?, size_11=?, size_12=?,
      entry_type=?, remarks=?, updated_by=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(
    body.sl_no || existing.sl_no, body.article_code || existing.article_code,
    body.description ?? existing.description, body.colour || existing.colour,
    body.size_6 ?? existing.size_6, body.size_7 ?? existing.size_7, body.size_8 ?? existing.size_8,
    body.size_9 ?? existing.size_9, body.size_10 ?? existing.size_10, body.size_11 ?? existing.size_11,
    body.size_12 ?? existing.size_12, body.entry_type || existing.entry_type,
    body.remarks ?? existing.remarks, user.id, Number(id)
  );

  await logAudit({
    userId: user.id, username: user.username, action: 'UPDATE', module: 'daily_entry',
    recordId: Number(id), recordDate: existing.sheet_date,
    oldValue, newValue: JSON.stringify(body), description: `Updated entry ${id}`
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (user.role === 'operator') return NextResponse.json({ error: 'No permission' }, { status: 403 });

  const { id } = await params;
  const db = getDb();
  const existing = await db.prepare('SELECT * FROM daily_entries WHERE id = ?').get(Number(id)) as any;
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (existing.status === 'approved' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Cannot delete approved entry' }, { status: 403 });
  }

  await db.prepare('UPDATE daily_entries SET is_deleted = 1 WHERE id = ?').run(Number(id));
  await logAudit({
    userId: user.id, username: user.username, action: 'SOFT_DELETE', module: 'daily_entry',
    recordId: Number(id), recordDate: existing.sheet_date,
    oldValue: JSON.stringify(existing), description: `Soft-deleted entry ${id}`
  });

  return NextResponse.json({ success: true });
}
