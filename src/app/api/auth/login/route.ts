import { NextRequest, NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';
import { signToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    const db = getDb();
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    console.log(`[DEBUG] Login attempt for user: ${username} from host: ${req.headers.get('host')}`);
    const user = await db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;

    if (!user) {
      console.log(`[DEBUG] User not found: ${username}`);
      await logAudit({ username, action: 'LOGIN_FAILED', module: 'auth', description: `User not found. IP: ${ipAddress}` });
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      console.log(`[DEBUG] Invalid password for user: ${username}`);
      await logAudit({ userId: user.id, username, action: 'LOGIN_FAILED', module: 'auth', description: `Wrong password. IP: ${ipAddress}` });
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (user.is_active === 0) {
      console.log(`[DEBUG] User pending approval: ${username}`);
      await logAudit({ userId: user.id, username, action: 'LOGIN_FAILED', module: 'auth', description: `Pending admin approval. IP: ${ipAddress}` });
      return NextResponse.json({ error: 'Your account is pending Admin approval.' }, { status: 403 });
    }
    
    console.log(`[DEBUG] Login successful for user: ${username}`);

    const token = await signToken({
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
    });

    // Update last login
    await db.prepare(`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`).run(user.id);
    
    // Log activity
    await db.prepare('INSERT INTO login_activity (user_id, username, action, ip_address) VALUES (?,?,?,?)').run(user.id, username, 'LOGIN', ipAddress);
    await logAudit({ userId: user.id, username, action: 'LOGIN', module: 'auth', description: `Successful login via ${userAgent}` });

    const response = NextResponse.json({
      user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role }
    });

    console.log(`[DEBUG] Setting cookie. Secure: false, Host: ${req.headers.get('host')}`);
    
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: false, // Disabled for local network access
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    return response;
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
