import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { carton_id } = body;

    if (!carton_id) {
      return NextResponse.json({ error: 'Missing carton_id' }, { status: 400 });
    }

    const db = getDb();
    
    // Check if the carton exists
    const carton = await db.prepare(`
      SELECT * FROM packed_cartons WHERE carton_id = ?
    `).get(carton_id) as any;

    if (!carton) {
      return NextResponse.json({ error: 'Carton not found' }, { status: 404 });
    }

    if (carton.status === 'completed') {
      return NextResponse.json({ error: 'Carton is already verified and completed' }, { status: 400 });
    }

    // Update status to completed and set scanned_at
    const nowIST = new Date().toISOString(); 
    
    await db.prepare(`
      UPDATE packed_cartons 
      SET status = 'completed', scanned_at = ?
      WHERE carton_id = ?
    `).run(nowIST, carton_id);

    // Log to scan_history
    await db.prepare(`
      INSERT INTO scan_history (barcode, article_code, colour, size, operator_id, status, carton_id, scan_type)
      VALUES (?, ?, ?, ?, ?, 'success_verification', ?, 'verification')
    `).run(carton_id, carton.article_code || '-', carton.colour || '-', '-', user.id, carton_id);

    return NextResponse.json({
      success: true,
      message: 'Carton verified successfully'
    });

  } catch (error: any) {
    console.error('Error scanning master carton:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
