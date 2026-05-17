import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  
  // Cumulative Stock Aggregation
  // Formulas: 
  //   initial_opening = opening stock from the very first date (May 1)
  //   deltas = SUM of in/out/mr/sf across all dates
  //   available_stock = initial_opening + IN + MR + SF - OUT
  const items = await db.prepare(`
    SELECT 
        article_code, 
        colour, 
        size,
        SUM(CASE WHEN sheet_date = '2026-05-01' THEN opening_stock ELSE 0 END) as initial_opening,
        SUM(inward_stock) as total_inward,
        SUM(outward_stock) as total_outward,
        SUM(machine_return_stock) as total_machine_return,
        SUM(semi_finished_stock) as total_semi_finished
    FROM daily_stock
    GROUP BY article_code, colour, size
    ORDER BY article_code ASC, colour ASC, CAST(size AS INTEGER) ASC
  `).all() as any[];

  // Consolidated response with stock calculation
  const consolidated: Record<string, any> = {};

  items.forEach(item => {
    // Strip (2), (3) etc. from the colour name for clean inventory display if needed
    const baseColour = item.colour.replace(/\s\(\d+\)$/, '').toUpperCase();
    const key = `${item.article_code}|${baseColour}|${item.size}`;

    if (!consolidated[key]) {
      consolidated[key] = {
        article_code: item.article_code,
        colour: baseColour,
        size: item.size,
        initial_opening: 0,
        total_inward: 0,
        total_outward: 0,
        total_machine_return: 0,
        total_semi_finished: 0,
        available_stock: 0
      };
    }

    const c = consolidated[key];
    c.initial_opening += (item.initial_opening || 0);
    c.total_inward += (item.total_inward || 0);
    c.total_outward += (item.total_outward || 0);
    c.total_machine_return += (item.total_machine_return || 0);
    c.total_semi_finished += (item.total_semi_finished || 0);
    
    // Final Warehouse Balance Formula
    c.available_stock = c.initial_opening + c.total_inward + c.total_machine_return + c.total_semi_finished - c.total_outward;
  });

  return NextResponse.json({ inventory: Object.values(consolidated) });
}
