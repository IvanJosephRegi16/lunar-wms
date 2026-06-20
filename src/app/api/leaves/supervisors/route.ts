import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  try {
    // Only return active users who are supervisors or admins
    const supervisors = await db.prepare(`
      SELECT id, full_name, role 
      FROM users 
      WHERE is_active = 1 AND role IN ('supervisor', 'admin')
      ORDER BY full_name ASC
    `).all();

    return NextResponse.json({ supervisors });
  } catch (error: any) {
    console.error('Error fetching supervisors:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
