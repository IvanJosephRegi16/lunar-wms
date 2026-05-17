import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role === 'worker') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const db = getDb();

    // Query all activity logs sorted by timestamp desc
    const logs = await db.prepare(`
      SELECT l.*, po.po_number, po.vendor
      FROM po_activity_logs l
      JOIN purchase_orders po ON l.po_id = po.id
      ORDER BY l.timestamp DESC, l.id DESC
      LIMIT 200
    `).all() as any[];

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error('Error fetching PO history:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
