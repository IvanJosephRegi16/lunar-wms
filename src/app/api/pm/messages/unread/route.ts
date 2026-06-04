import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (user.role !== 'pm' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = getDb();
    const result = await db.prepare(`
      SELECT COUNT(*) as unreadCount FROM pm_messages
      WHERE pm_id = ? AND is_read = 0
    `).get(user.id) as any;

    return NextResponse.json({ unreadCount: result.unreadCount || 0 });
  } catch (error: any) {
    console.error('Error fetching PM unread messages count:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
