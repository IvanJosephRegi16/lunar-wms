import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ valid: false, user: null }, { status: 401 });
  }

  // Optional: check DB if the user has been banned or forcefully logged out
  // But for lightweight sync, token validity is usually enough.

  return NextResponse.json({ valid: true, user });
}
