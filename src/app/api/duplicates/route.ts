import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

// Check duplicates
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { article_code, colour, sheet_date, exclude_id } = await req.json();
  const db = getDb();

  // Same day duplicate
  let q = `SELECT * FROM daily_entries WHERE article_code=? AND colour=? AND sheet_date=?`;
  const args: any[] = [article_code, colour, sheet_date];
  if (exclude_id) { q += ' AND id != ?'; args.push(exclude_id); }

  const sameDayDups = await db.prepare(q).all(...args);

  // Cross-day duplicate this month
  const crossDayDups = await db.prepare(`
    SELECT sheet_date, COUNT(*) as count FROM daily_entries
    WHERE article_code=? AND colour=? AND sheet_date LIKE '2026-05-%'
    ${exclude_id ? 'AND id != ' + exclude_id : ''}
    GROUP BY sheet_date
  `).all(article_code, colour);

  return NextResponse.json({
    is_duplicate: sameDayDups.length > 0,
    same_day_count: sameDayDups.length,
    cross_day_count: crossDayDups.length,
    dates: crossDayDups.map((d: any) => d.sheet_date),
  });
}

// Run full duplicate scan
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Find all same-day duplicates
  const dups = await db.prepare(`
    SELECT article_code, colour, sheet_date, COUNT(*) as count, STRING_AGG(id::text, ',') as ids
    FROM daily_entries
    WHERE sheet_date LIKE '2026-05-%'
    GROUP BY article_code, colour, sheet_date
    HAVING COUNT(*) > 1
    ORDER BY sheet_date, article_code
  `).all();

  // Mark duplicates
  await db.prepare(`UPDATE daily_entries SET is_duplicate=0`).run();
  for (const d of dups as any[]) {
    const ids = d.ids.split(',').slice(1); // keep first, mark rest as dup
    for (const id of ids) {
      await db.prepare('UPDATE daily_entries SET is_duplicate=1 WHERE id=?').run(Number(id));
    }
  }

  return NextResponse.json({ duplicates: dups, total: dups.length });
}
