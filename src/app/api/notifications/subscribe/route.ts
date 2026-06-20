import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getDb } from '@/lib/db';

// POST /api/notifications/subscribe - store push subscription for logged-in user
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const subscription = await req.json();
    if (!subscription?.endpoint) return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });

    const db = getDb();

    // Ensure table exists
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT,
        auth TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `).run();

    // Upsert subscription
    await db.prepare(`
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth
    `).run(authUser.id, subscription.endpoint, subscription.keys?.p256dh || '', subscription.keys?.auth || '');

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[PUSH SUBSCRIBE ERROR]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/notifications/subscribe - remove subscription
export async function DELETE(req: NextRequest) {
  try {
    const { endpoint } = await req.json();
    const db = getDb();
    await db.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`).run(endpoint);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
