import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

// GET: Fetch notifications for logged-in user
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb();
    const notifications = await db.prepare(`
      SELECT * FROM po_notifications 
      WHERE user_id = ? 
      ORDER BY id DESC 
      LIMIT 50
    `).all(user.id) as any[];

    const unreadCount = notifications.filter((n: any) => !n.is_read).length;

    return NextResponse.json({ notifications, unreadCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH: Mark notification(s) as read
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { id, markAllRead } = body;

    const db = getDb();

    if (markAllRead) {
      await db.prepare(`UPDATE po_notifications SET is_read = 1 WHERE user_id = ?`).run(user.id);
    } else if (id) {
      await db.prepare(`UPDATE po_notifications SET is_read = 1 WHERE id = ? AND user_id = ?`).run(id, user.id);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Delete single or all notifications for logged-in user
export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const clearAll = url.searchParams.get('clearAll');

    const db = getDb();

    if (clearAll === 'true') {
      // Clear all notifications for this user
      await db.prepare(`DELETE FROM po_notifications WHERE user_id = ?`).run(user.id);
    } else if (id) {
      // Delete a single notification
      await db.prepare(`DELETE FROM po_notifications WHERE id = ? AND user_id = ?`).run(id, user.id);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
