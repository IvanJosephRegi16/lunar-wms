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

    // Check intake_barcode_pool
    const poolRecord = await db.prepare(`
      SELECT * FROM intake_barcode_pool
      WHERE barcode = ?
    `).get(barcode) as any;

    let isIntakeScanned = false;
    let isOutwardScanned = false;
    let intakeData = null;
    let outwardData = null;

    if (poolRecord) {
      isIntakeScanned = true; // It's in the pool, so it was scanned in intake
      intakeData = { created_at: poolRecord.created_at };
      
      if (poolRecord.status === 'scanned_outward') {
        isOutwardScanned = true;
        outwardData = { created_at: poolRecord.outward_scanned_at };
      }
    } else {
      // Fallback check scan_history just in case it's an old record before the pool system
      const oldIntake = await db.prepare(`
        SELECT * FROM scan_history
        WHERE barcode = ? AND scan_type = 'intake' AND status = 'success'
        ORDER BY created_at DESC LIMIT 1
      `).get(barcode) as any;
      if (oldIntake) {
        isIntakeScanned = true;
        intakeData = { created_at: oldIntake.created_at };
        
        const oldOutward = await db.prepare(`
          SELECT * FROM scan_history
          WHERE barcode = ? AND scan_type = 'outward' AND status = 'success_outward'
          ORDER BY created_at DESC LIMIT 1
        `).get(barcode) as any;
        if (oldOutward) {
          isOutwardScanned = true;
          outwardData = { created_at: oldOutward.created_at };
        }
      }
    }
    return NextResponse.json({
      success: true,
      barcode,
      isIntakeScanned,
      intakeData,
      isOutwardScanned,
      outwardData,
    });
  } catch (error: any) {
    console.error('Error verifying barcode:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
