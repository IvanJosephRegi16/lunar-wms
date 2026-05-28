import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb();
    // Get all requests for this user that were approved or rejected but not yet acknowledged (is_notified_user = 0)
    const alerts = await db.prepare(
      "SELECT * FROM sidebar_access_requests WHERE user_id = ? AND status IN ('approved', 'rejected') AND is_notified_user = 0 ORDER BY processed_at DESC"
    ).all(user.id);

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error('Failed to get user alerts:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb();
    const body = await req.json().catch(() => ({}));
    const { action, requestId } = body;

    if (action === 'dismiss') {
      if (requestId) {
        await db.prepare(
          "UPDATE sidebar_access_requests SET is_notified_user = 1 WHERE id = ? AND user_id = ?"
        ).run(requestId, user.id);
      } else {
        // Acknowledge all active alerts for this user
        await db.prepare(
          "UPDATE sidebar_access_requests SET is_notified_user = 1 WHERE user_id = ? AND status IN ('approved', 'rejected')"
        ).run(user.id);
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Failed to dismiss user alerts:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
