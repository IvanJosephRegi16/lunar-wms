import { NextRequest, NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';
import { signToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const { username, password, full_name, phone } = await req.json();

    if (!username || !password || !full_name) {
      return NextResponse.json({ error: 'Username, password, and full name are required' }, { status: 400 });
    }

    const db = getDb();
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

    // Check if user exists
    const existingUser = await db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
    }

    // Default new signups to 'operator' role, requires Admin approval
    const role = 'operator';
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.prepare(
      'INSERT INTO users (username, password_hash, full_name, phone, role, is_active, plain_password) VALUES (?, ?, ?, ?, ?, 0, ?)'
    ).run(username, passwordHash, full_name, phone || null, role, password);

    const newUserId = result.lastInsertRowid;

    const user = {
      id: Number(newUserId),
      username,
      full_name,
      role
    };

    // Log activity
    await db.prepare('INSERT INTO login_activity (user_id, username, action, ip_address) VALUES (?,?,?,?)')
      .run(newUserId, username, 'SIGNUP_PENDING', ipAddress);
    await logAudit({ userId: Number(newUserId), username, action: 'SIGNUP_PENDING', module: 'auth', description: `User signed up from ${ipAddress}, pending admin approval` });

    const response = NextResponse.json({
      success: true,
      message: "Account created successfully. Please wait for an Administrator to approve your account before logging in.",
      user
    });

    return response;
  } catch (err: any) {
    console.error('Signup error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
