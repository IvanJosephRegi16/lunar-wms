import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const article_code = searchParams.get('article_code');
  const colour = searchParams.get('colour');
  const date = searchParams.get('date');

  if (!article_code || !colour || !date) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  const db = getDb();
  
  // Find the latest closing stock for this article/colour across all sizes before the target date
  const latestStates = await db.prepare(`
    SELECT size, closing_stock 
    FROM daily_stock d1
    WHERE article_code = ? AND colour = ? AND sheet_date < ?
    AND sheet_date = (
        SELECT MAX(sheet_date) FROM daily_stock d2
        WHERE d2.article_code = d1.article_code 
        AND d2.colour = d1.colour 
        AND d2.size = d1.size
        AND d2.sheet_date < ?
    )
  `).all(article_code, colour, date, date) as any[];

  const results: Record<string, number> = {};
  latestStates.forEach(s => {
    results[s.size] = s.closing_stock || 0;
  });

  return NextResponse.json({ openingBalances: results });
}
