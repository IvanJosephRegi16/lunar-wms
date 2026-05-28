import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: '501 Not Implemented: Database backups are now managed automatically via Railway PostgreSQL.' },
    { status: 501 }
  );
}
