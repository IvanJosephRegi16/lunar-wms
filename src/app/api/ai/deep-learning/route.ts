import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

/**
 * Deep Learning Gateway — Admin-only
 * Placeholder hooks for future PyTorch / OCR / neural inference integrations.
 * No real ML inference happens here yet.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    return NextResponse.json({ error: 'Neural inference gateway not yet connected.' }, { status: 501 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    return NextResponse.json({ error: 'Neural inference gateway not yet connected.' }, { status: 501 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
