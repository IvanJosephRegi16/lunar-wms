import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin','supervisor'].includes(user.role)) return NextResponse.json({ error: 'No permission' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const module = searchParams.get('module');
  const action = searchParams.get('action');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const limit = Number(searchParams.get('limit') || '100');

  const db = getDb();
  let q = `
    SELECT al.*, u.full_name
    FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id
    WHERE 1=1
  `;
  const args: any[] = [];
  if (module) { q += ' AND al.module=?'; args.push(module); }
  if (action) { q += ' AND al.action=?'; args.push(action); }
  if (from) { q += ' AND al.timestamp >= ?'; args.push(from); }
  if (to) { q += ' AND al.timestamp <= ?'; args.push(to + ' 23:59:59'); }
  q += ' ORDER BY al.timestamp DESC LIMIT ?';
  args.push(limit);

  const logs = await db.prepare(q).all(...args);
  return NextResponse.json({ logs });
}
