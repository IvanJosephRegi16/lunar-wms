import { NextRequest, NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  const body = await req.json().catch(() => ({}));
  const reason = body.reason || 'manual';

  if (user) {
    try {
      const db = getDb();
      const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
      
      // Log the logout action securely to PostgreSQL
      await db.prepare('INSERT INTO login_activity (user_id, username, action, ip_address) VALUES (?,?,?,?)')
              .run(user.id, user.username, `LOGOUT_${reason.toUpperCase()}`, ipAddress);
      
      await logAudit({ userId: user.id, username: user.username, action: 'LOGOUT', module: 'auth', description: `User logged out (${reason})` });
    } catch (e) {
      console.error('[LOGOUT AUDIT FAILED]', e);
    }
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set('auth_token', '', { maxAge: 0, path: '/' });
  return response;
}
