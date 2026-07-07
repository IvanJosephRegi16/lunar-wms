import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { barcode } = body;

    if (!barcode) {
      return NextResponse.json({ error: 'Barcode is required' }, { status: 400 });
    }

    const db = getDb();

    // Check intake status
    const intakeRecord = await db.prepare(`
      SELECT * FROM scan_history
      WHERE barcode = ? AND scan_type = 'intake' AND status = 'success'
      ORDER BY created_at DESC LIMIT 1
    `).get(barcode) as any;

    // Check outward status
    const outwardRecord = await db.prepare(`
      SELECT * FROM scan_history
      WHERE barcode = ? AND scan_type = 'outward' AND status = 'success_outward'
      ORDER BY created_at DESC LIMIT 1
    `).get(barcode) as any;

    return NextResponse.json({
      success: true,
      barcode,
      isIntakeScanned: !!intakeRecord,
      intakeData: intakeRecord || null,
      isOutwardScanned: !!outwardRecord,
      outwardData: outwardRecord || null,
    });
  } catch (error: any) {
    console.error('Error verifying barcode:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
