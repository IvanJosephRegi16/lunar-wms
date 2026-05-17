import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'final_report';

  if (type === 'final_report') {
    const data = await db.prepare(`
      SELECT 
        article_code, 
        UPPER(colour) as colour, 
        MAX(sheet_date) as last_activity,
        SUM(CASE WHEN size = '5' THEN opening_stock + inward_stock + machine_return_stock + semi_finished_stock - outward_stock ELSE 0 END) as s5,
        SUM(CASE WHEN size = '6' THEN opening_stock + inward_stock + machine_return_stock + semi_finished_stock - outward_stock ELSE 0 END) as s6,
        SUM(CASE WHEN size = '7' THEN opening_stock + inward_stock + machine_return_stock + semi_finished_stock - outward_stock ELSE 0 END) as s7,
        SUM(CASE WHEN size = '8' THEN opening_stock + inward_stock + machine_return_stock + semi_finished_stock - outward_stock ELSE 0 END) as s8,
        SUM(CASE WHEN size = '9' THEN opening_stock + inward_stock + machine_return_stock + semi_finished_stock - outward_stock ELSE 0 END) as s9,
        SUM(CASE WHEN size = '10' THEN opening_stock + inward_stock + machine_return_stock + semi_finished_stock - outward_stock ELSE 0 END) as s10,
        SUM(CASE WHEN size = '11' THEN opening_stock + inward_stock + machine_return_stock + semi_finished_stock - outward_stock ELSE 0 END) as s11,
        SUM(CASE WHEN size = '12' THEN opening_stock + inward_stock + machine_return_stock + semi_finished_stock - outward_stock ELSE 0 END) as s12
      FROM daily_stock
      GROUP BY article_code, UPPER(colour)
      ORDER BY article_code ASC, UPPER(colour) ASC
    `).all() as any[];

    data.forEach(r => {
       r.net_stock = (r.s5||0) + (r.s6||0) + (r.s7||0) + (r.s8||0) + (r.s9||0) + (r.s10||0) + (r.s11||0) + (r.s12||0);
    });

    const vStrapSummary = await db.prepare(`
      SELECT SUM(inward_qty) as total_inward, SUM(outward_qty) as total_outward,
        SUM(opening_stock) as total_opening, COUNT(*) as count
      FROM v_strap WHERE entry_date LIKE '2026-05-%'
    `).get();

    return NextResponse.json({ data, vStrapSummary });
  }

  if (type === 'final_sheet') {
    const dailySummary = await db.prepare(`
      SELECT 
        d.sheet_date,
        d.article_code,
        UPPER(d.colour) as colour,
        SUM(
          (CASE WHEN d.sheet_date = '2026-05-01' THEN d.opening_stock ELSE 0 END) + 
          d.inward_stock + d.machine_return_stock + d.semi_finished_stock - d.outward_stock
        ) as total_added,
        SUM(CASE WHEN d.size = '5' THEN (CASE WHEN d.sheet_date = '2026-05-01' THEN d.opening_stock ELSE 0 END) + d.inward_stock + d.machine_return_stock + d.semi_finished_stock - d.outward_stock ELSE 0 END) as s5,
        SUM(CASE WHEN d.size = '6' THEN (CASE WHEN d.sheet_date = '2026-05-01' THEN d.opening_stock ELSE 0 END) + d.inward_stock + d.machine_return_stock + d.semi_finished_stock - d.outward_stock ELSE 0 END) as s6,
        SUM(CASE WHEN d.size = '7' THEN (CASE WHEN d.sheet_date = '2026-05-01' THEN d.opening_stock ELSE 0 END) + d.inward_stock + d.machine_return_stock + d.semi_finished_stock - d.outward_stock ELSE 0 END) as s7,
        SUM(CASE WHEN d.size = '8' THEN (CASE WHEN d.sheet_date = '2026-05-01' THEN d.opening_stock ELSE 0 END) + d.inward_stock + d.machine_return_stock + d.semi_finished_stock - d.outward_stock ELSE 0 END) as s8,
        SUM(CASE WHEN d.size = '9' THEN (CASE WHEN d.sheet_date = '2026-05-01' THEN d.opening_stock ELSE 0 END) + d.inward_stock + d.machine_return_stock + d.semi_finished_stock - d.outward_stock ELSE 0 END) as s9,
        SUM(CASE WHEN d.size = '10' THEN (CASE WHEN d.sheet_date = '2026-05-01' THEN d.opening_stock ELSE 0 END) + d.inward_stock + d.machine_return_stock + d.semi_finished_stock - d.outward_stock ELSE 0 END) as s10,
        SUM(CASE WHEN d.size = '11' THEN (CASE WHEN d.sheet_date = '2026-05-01' THEN d.opening_stock ELSE 0 END) + d.inward_stock + d.machine_return_stock + d.semi_finished_stock - d.outward_stock ELSE 0 END) as s11,
        SUM(CASE WHEN d.size = '12' THEN (CASE WHEN d.sheet_date = '2026-05-01' THEN d.opening_stock ELSE 0 END) + d.inward_stock + d.machine_return_stock + d.semi_finished_stock - d.outward_stock ELSE 0 END) as s12
      FROM daily_stock d
      GROUP BY d.sheet_date, d.article_code, UPPER(d.colour)
      HAVING (
         total_added != 0 OR s5 != 0 OR
         s6 != 0 OR s7 != 0 OR s8 != 0 OR s9 != 0 OR s10 != 0 OR s11 != 0 OR s12 != 0
      )
      ORDER BY d.sheet_date DESC, d.article_code ASC
    `).all() as any[];

    return NextResponse.json({ dailySummary });
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
}
