import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const article = searchParams.get('article');
    const color = searchParams.get('color');

    if (!article || !color) {
      return NextResponse.json({ error: 'Article and color are required' }, { status: 400 });
    }

    const db = getDb();
    
    // Use the current date to fetch active stock
    const dateStr = new Date().toLocaleDateString('en-CA'); // 'YYYY-MM-DD' in local time
    
    // Check if daily sheet exists for today
    const sheetExists = await db.prepare('SELECT status FROM daily_sheets WHERE sheet_date = ?').get(dateStr) as any;
    
    if (!sheetExists) {
      // Return 0 stock if no sheet exists, or we could look backwards.
      // But based on current stock Engine, today's sheet must be created or we query the latest sheet.
      // We will query the most recent sheet date available for this article/color
    }

    const query = `
      SELECT size, closing_stock 
      FROM daily_stock 
      WHERE article_code = ? AND colour = ? AND sheet_date <= ?
      ORDER BY sheet_date DESC, size ASC
    `;
    
    const rows = await db.prepare(query).all(article, color, dateStr) as any[];
    
    // Group by size and take the first one (most recent date)
    const stockMap = new Map<string, number>();
    for (const row of rows) {
      if (!stockMap.has(row.size)) {
         // Keep stock >= 0
         stockMap.set(row.size, Math.max(0, row.closing_stock || 0));
      }
    }

    const availableStock = Array.from(stockMap.entries()).map(([size, quantity]) => ({
      size,
      quantity
    }));

    return NextResponse.json({ stock: availableStock });
  } catch (error: any) {
    console.error('Error fetching stock:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
