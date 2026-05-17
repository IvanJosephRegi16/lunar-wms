import { NextRequest, NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';
import { getAuthUser, signToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();
    const user = await db.prepare('SELECT id, username, full_name, role, phone FROM users WHERE id = ?').get(authUser.id) as any;
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { full_name, username, phone, password } = body;
    const db = getDb();

    // Validate username uniqueness if changed
    if (username && username !== authUser.username) {
      const exists = await db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, authUser.id);
      if (exists) {
        return NextResponse.json({ error: 'Username is already taken' }, { status: 400 });
      }
    }

    // Validate phone uniqueness if changed
    if (phone) {
      const exists = await db.prepare('SELECT id FROM users WHERE phone = ? AND id != ?').get(phone, authUser.id);
      if (exists) {
        return NextResponse.json({ error: 'Phone number is already linked to another account' }, { status: 400 });
      }
    }

    const updates: string[] = [];
    const vals: any[] = [];

    if (full_name) {
      updates.push('full_name=?');
      vals.push(full_name);
    }
    if (username) {
      updates.push('username=?');
      vals.push(username);
    }
    
    // Always set phone (can be null/empty)
    updates.push('phone=?');
    vals.push(phone || null);

    if (password) {
      const hash = bcrypt.hashSync(password, 10);
      updates.push('password_hash=?');
      vals.push(hash);
      
      updates.push('plain_password=?');
      vals.push(password);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    vals.push(authUser.id);
    await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...vals);

    // Fetch updated user to sign a new token
    const updatedUser = await db.prepare('SELECT id, username, full_name, role FROM users WHERE id = ?').get(authUser.id) as any;

    const token = await signToken({
      id: updatedUser.id,
      username: updatedUser.username,
      full_name: updatedUser.full_name,
      role: updatedUser.role,
    });

    await logAudit({
      userId: authUser.id,
      username: authUser.username,
      action: 'UPDATE_PROFILE',
      module: 'auth',
      description: 'Updated personal profile and credentials settings'
    });

    const response = NextResponse.json({
      success: true,
      user: updatedUser
    });

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: false, // Disabled for local network access
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
