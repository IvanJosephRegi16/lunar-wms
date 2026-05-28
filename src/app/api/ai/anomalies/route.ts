import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { AIEngine } from '@/lib/aiEngine';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const anomalies = await AIEngine.scanForAnomalies();

    return NextResponse.json({ success: true, anomalies });
  } catch (err: any) {
    console.error('[AI ANOMALIES ERROR]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
