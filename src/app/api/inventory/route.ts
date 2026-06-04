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
        ds.article_code, 
        ds.colour, 
        ds.size,
        SUM(CASE WHEN ds.sheet_date = '2026-05-01' THEN ds.opening_stock ELSE 0 END) as initial_opening,
        SUM(ds.inward_stock) as total_inward,
        SUM(ds.outward_stock) as total_outward,
        SUM(ds.machine_return_stock) as total_machine_return,
        SUM(ds.semi_finished_stock) as total_semi_finished,
        (SELECT mrp FROM inventory_pool ip WHERE ip.article_code = ds.article_code AND ip.colour = ds.colour LIMIT 1) as mrp
    FROM daily_stock ds
    GROUP BY ds.article_code, ds.colour, ds.size
    ORDER BY ds.article_code ASC, ds.colour ASC, CAST(ds.size AS INTEGER) ASC
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
        available_stock: 0,
        mrp: item.mrp || null
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
