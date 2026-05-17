import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb();
    
    const inventory = await db.prepare(`
      SELECT * FROM inventory_pool
      WHERE is_deleted = 0
      ORDER BY article_code, colour
    `).all();

    return NextResponse.json({ inventory });
  } catch (error: any) {
    console.error('Error fetching aggregated inventory:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
