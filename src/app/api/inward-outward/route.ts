import { NextRequest, NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Date-wise summary requested by user:
  // Inward = SUM(opening_stock + inward_stock + machine_return_stock) 
  // Outward = SUM(outward_stock)
  // We include semi_finished_stock in inward too as it is part of the 'total available' pool.
  const dailyTotals = await db.prepare(`
    SELECT 
      sheet_date,
      SUM(opening_stock + inward_stock + machine_return_stock + semi_finished_stock) as inward_total,
      SUM(outward_stock) as outward_total
    FROM daily_stock
    GROUP BY sheet_date
    ORDER BY sheet_date ASC
  `).all();

  // Summary per Article + Color
  const summary = await db.prepare(`
    SELECT 
      article_code, colour, size,
      SUM(opening_stock + inward_stock + machine_return_stock + semi_finished_stock) as total_inward,
      SUM(outward_stock) as total_outward
    FROM daily_stock
    GROUP BY article_code, colour, size
    ORDER BY article_code, colour
  `).all();

  return NextResponse.json({ dailyTotals, summary });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const db = getDb();

  const r = await db.prepare(`
    INSERT INTO inward_outward (entry_date, article_code, description, colour, size, opening_stock, inward_qty, outward_qty, remarks, entry_type, created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    body.entry_date, body.article_code, body.description || null, body.colour, body.size || null,
    body.opening_stock || 0, body.inward_qty || 0, body.outward_qty || 0,
    body.remarks || null, body.entry_type || 'inward', user.id
  );

  await logAudit({ userId: user.id, username: user.username, action: 'CREATE', module: 'inward_outward', recordId: r.lastInsertRowid as number, recordDate: body.entry_date });
  return NextResponse.json({ success: true, id: r.lastInsertRowid });
}

export async function PUT(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const db = getDb();

  const existing = await db.prepare('SELECT * FROM inward_outward WHERE id = ?').get(body.id) as any;
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (existing.status === 'approved' && user.role === 'operator') {
    return NextResponse.json({ error: 'Cannot edit approved entry' }, { status: 403 });
  }

  await db.prepare(`
    UPDATE inward_outward SET
      entry_date=?, article_code=?, description=?, colour=?, size=?,
      opening_stock=?, inward_qty=?, outward_qty=?, remarks=?, entry_type=?,
      updated_by=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(
    body.entry_date, body.article_code, body.description, body.colour, body.size,
    body.opening_stock, body.inward_qty, body.outward_qty, body.remarks, body.entry_type,
    user.id, body.id
  );

  await logAudit({ userId: user.id, username: user.username, action: 'UPDATE', module: 'inward_outward', recordId: body.id, oldValue: JSON.stringify(existing) });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role === 'operator') return NextResponse.json({ error: 'No permission' }, { status: 403 });

  const { id } = await req.json();
  const db = getDb();
  const existing = await db.prepare('SELECT * FROM inward_outward WHERE id=?').get(id) as any;
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (existing.status === 'approved' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Cannot delete approved entry' }, { status: 403 });
  }

  await db.prepare('UPDATE inward_outward SET is_deleted = 1 WHERE id=?').run(id);
  await logAudit({ userId: user.id, username: user.username, action: 'SOFT_DELETE', module: 'inward_outward', recordId: id, oldValue: JSON.stringify(existing) });
  return NextResponse.json({ success: true });
}
