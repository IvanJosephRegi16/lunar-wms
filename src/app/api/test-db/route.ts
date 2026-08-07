import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  // SECURITY: Block this endpoint entirely in production — it exposes DB schema and user list
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  // In development, require admin authentication
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  try {
    const db = getDb();
    const tables = await db.prepare("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'").all();
    // Never return password_hash or any sensitive user fields
    const users = await db.prepare("SELECT id, username, full_name, role, is_active, created_at FROM users").all();
    return NextResponse.json({ tables, users });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal database connection error.' }, { status: 500 });
  }
}
