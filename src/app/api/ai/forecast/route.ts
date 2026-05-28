import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { AIEngine } from '@/lib/aiEngine';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const articleCode = searchParams.get('article_code') || undefined;

    const forecastData = await AIEngine.generateDemandForecast(articleCode);

    return NextResponse.json({
      success: true,
      articleCode: articleCode || 'ALL_ARTICLES',
      points: forecastData
    });
  } catch (err: any) {
    console.error('[AI FORECAST ERROR]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
