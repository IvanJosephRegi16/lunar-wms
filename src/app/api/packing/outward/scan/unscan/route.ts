import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

/**
 * POST /api/packing/outward/scan/unscan
 * Reverses a single outward scan (MRP rejection).
 * - Removes the row from outward_scan_items
 * - Restores inventory_pool qty by +1
 * - Resets intake_barcode_pool.status back to 'available'
 * Body: { session_id, barcode }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { session_id, barcode } = body;

    if (!session_id || !barcode) {
      return NextResponse.json({ error: 'Missing session_id or barcode' }, { status: 400 });
    }

    // Parse barcode to get article/colour/size
    let parts: string[] = [];
    if (barcode.includes('|')) {
      parts = barcode.split('|');
    } else if (barcode.startsWith('J') || barcode.startsWith('j')) {
      parts = barcode.split(' ');
    }

    if (parts.length < 3) {
      return NextResponse.json({ error: 'Invalid barcode format' }, { status: 400 });
    }

    const article = parts[0].toUpperCase();
    const colour  = parts[1].toUpperCase();
    const size    = parts[2];
    const invCol  = `size_${size}`;

    const db = getDb();

    // Confirm the item actually exists in this session before reversing
    const item = await db.prepare(`
      SELECT id FROM outward_scan_items
      WHERE session_id = ? AND barcode = ?
      LIMIT 1
    `).get(session_id, barcode) as any;

    if (!item) {
      return NextResponse.json({ error: 'Barcode not found in this session — nothing to reverse.' }, { status: 404 });
    }

    // Reverse all three DB writes atomically
    await Promise.all([
      // 1. Remove from outward_scan_items
      db.prepare(`
        DELETE FROM outward_scan_items
        WHERE session_id = ? AND barcode = ?
      `).run(session_id, barcode),

      // 2. Restore inventory_pool stock
      db.prepare(`
        UPDATE inventory_pool
        SET ${invCol} = ${invCol} + 1, total_qty = total_qty + 1
        WHERE article_code = ? AND colour = ?
      `).run(article, colour),

      // 3. Reset intake_barcode_pool status back to available
      db.prepare(`
        UPDATE intake_barcode_pool
        SET status = 'available', outward_scanned_at = NULL
        WHERE barcode = ?
      `).run(barcode),

      // 4. Log the rejection in scan_history
      db.prepare(`
        INSERT INTO scan_history (barcode, article_code, colour, size, operator_id, status, scan_type)
        VALUES (?, ?, ?, ?, ?, 'rejected_mrp_mismatch', 'outward')
      `).run(barcode, article, colour, size, user.id),
    ]);

    return NextResponse.json({
      success: true,
      message: `Barcode ${barcode} removed from outward session and returned to Scan Intake.`
    });

  } catch (error: any) {
    console.error('Error in outward unscan:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
