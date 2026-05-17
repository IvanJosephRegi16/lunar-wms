import { NextRequest, NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');

  const db = getDb();
  let q = `
    SELECT v.*, u.full_name as created_by_name
    FROM v_strap v LEFT JOIN users u ON v.created_by = u.id
    WHERE 1=1
  `;
  const args: any[] = [];
  if (date) { q += ' AND v.entry_date = ?'; args.push(date); }
  q += ' ORDER BY v.entry_date DESC, v.id';

  const entries = await db.prepare(q).all(...args);

  const summary = await db.prepare(`
    SELECT 
      SUM(inward_qty) as total_inward,
      SUM(outward_qty) as total_outward,
      SUM(opening_stock) as total_opening,
      COUNT(*) as total_entries
    FROM v_strap
  `).get();

  return NextResponse.json({ entries, summary });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const db = getDb();

  const r = await db.prepare(`
    INSERT INTO v_strap (entry_date, article_code, colour, opening_stock, inward_qty, outward_qty, remarks, created_by)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(body.entry_date, body.article_code, body.colour, body.opening_stock || 0, body.inward_qty || 0, body.outward_qty || 0, body.remarks || null, user.id);

  await logAudit({ userId: user.id, username: user.username, action: 'CREATE', module: 'v_strap', recordId: r.lastInsertRowid as number });
  return NextResponse.json({ success: true, id: r.lastInsertRowid });
}

export async function PUT(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const db = getDb();
  const existing = await db.prepare('SELECT * FROM v_strap WHERE id=?').get(body.id) as any;
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.prepare(`
    UPDATE v_strap SET entry_date=?, article_code=?, colour=?, opening_stock=?, inward_qty=?, outward_qty=?, remarks=?, updated_by=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(body.entry_date, body.article_code, body.colour, body.opening_stock, body.inward_qty, body.outward_qty, body.remarks, user.id, body.id);

  await logAudit({ userId: user.id, username: user.username, action: 'UPDATE', module: 'v_strap', recordId: body.id });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role === 'operator') return NextResponse.json({ error: 'No permission' }, { status: 403 });

  const { id } = await req.json();
  const db = getDb();
  await db.prepare('UPDATE v_strap SET is_deleted = 1 WHERE id=?').run(id);
  await logAudit({ userId: user.id, username: user.username, action: 'SOFT_DELETE', module: 'v_strap', recordId: id });
  return NextResponse.json({ success: true });
}
