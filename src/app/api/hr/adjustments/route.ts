import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'supervisor' && user.role !== 'accountant') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    
    if (!month) {
      return NextResponse.json({ error: 'Month parameter is required' }, { status: 400 });
    }

    const db = getDb();
    const adjustments = await db.prepare(`
      SELECT * FROM hr_deductions_additions 
      WHERE month_year = ? 
      ORDER BY created_at DESC
    `).all(month);

    return NextResponse.json({ adjustments });
  } catch (error: any) {
    console.error('Fetch adjustments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
