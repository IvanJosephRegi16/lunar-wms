import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const tables = await db.prepare("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'").all();
    const users = await db.prepare("SELECT * FROM users").all();
    return NextResponse.json({ cwd: process.cwd(), tables, users });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
