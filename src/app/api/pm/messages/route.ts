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
    const messages = await db.prepare(`
      SELECT * FROM pm_messages
      WHERE pm_id = ?
      ORDER BY created_at DESC
    `).all(user.id) as any[];

    return NextResponse.json({ messages });
  } catch (error: any) {
    console.error('Error fetching PM messages:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { id, markAllRead } = body;

    const db = getDb();

    if (markAllRead) {
      await db.prepare(`UPDATE pm_messages SET is_read = 1 WHERE pm_id = ?`).run(user.id);
    } else if (id) {
      await db.prepare(`UPDATE pm_messages SET is_read = 1 WHERE id = ? AND pm_id = ?`).run(id, user.id);
    } else {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating PM messages:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const clearAll = url.searchParams.get('clearAll');

    const db = getDb();

    if (clearAll === 'true') {
      await db.prepare(`DELETE FROM pm_messages WHERE pm_id = ?`).run(user.id);
    } else if (id) {
      await db.prepare(`DELETE FROM pm_messages WHERE id = ? AND pm_id = ?`).run(id, user.id);
    } else {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting PM messages:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
