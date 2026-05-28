import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: '501 Not Implemented: Database restores are now managed automatically via Railway PostgreSQL.' },
    { status: 501 }
  );
}
