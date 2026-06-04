import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { session_id } = body;

    if (!session_id) {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
    }

    const db = getDb();
    
    // 1. Get session details
    const session = await db.prepare(`
      SELECT s.*, c.article_code, c.colour, c.total_pairs 
      FROM outward_scan_sessions s
      JOIN carton_generation c ON s.carton_generation_id = c.id
      WHERE s.id = ?
    `).get(session_id) as any;

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    if (session.status === 'completed') return NextResponse.json({ error: 'Session already completed' }, { status: 400 });
    if (session.status === 'cancelled') return NextResponse.json({ error: 'Session is cancelled' }, { status: 400 });

    const configSizes = await db.prepare(`
      SELECT * FROM carton_generation_sizes WHERE config_id = ?
    `).all(session.carton_generation_id);

    const scannedItems = await db.prepare(`
      SELECT size, COUNT(*) as count FROM outward_scan_items 
      WHERE session_id = ? GROUP BY size
    `).all(session_id);

    // Verify all quantities met
    for (const conf of configSizes) {
      const scanned = scannedItems.find((s: any) => s.size === conf.size);
      if (!scanned || scanned.count < conf.quantity) {
        return NextResponse.json({ error: `Incomplete scan for size ${conf.size}. Expected ${conf.quantity}, found ${scanned?.count || 0}` }, { status: 400 });
      }
    }

    let packedCarton = null;

    await db.transaction(async () => {
      // Create outward_transaction
      const transactionIdStr = `TXN-${Date.now()}`;
      const txRes = await db.prepare(`
        INSERT INTO outward_transactions (transaction_id, article_code, colour, config_id, num_cartons, total_pairs, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(transactionIdStr, session.article_code, session.colour, session.carton_generation_id, 1, session.total_pairs, user.id);
      
      const txId = txRes.lastInsertRowid;

      // Insert outward_items (for this single carton)
      for (const conf of configSizes) {
        await db.prepare(`
          INSERT INTO outward_items (transaction_id, size, quantity_per_carton, total_quantity)
          VALUES (?, ?, ?, ?)
        `).run(txId, conf.size, conf.quantity, conf.quantity);
      }

      // Create packed_carton
      const cartonIdStr = `CRT-${Date.now()}`;
      await db.prepare(`
        INSERT INTO packed_cartons (carton_id, transaction_id, status)
        VALUES (?, ?, 'completed')
      `).run(cartonIdStr, txId);
      
      packedCarton = cartonIdStr;

      // Update session status
      await db.prepare(`
        UPDATE outward_scan_sessions 
        SET status = 'completed', completed_at = NOW() 
        WHERE id = ?
      `).run(session_id);
    });

    return NextResponse.json({
      success: true,
      message: 'Carton sealed successfully',
      carton: packedCarton
    });

  } catch (error: any) {
    console.error('Error sealing outward scan session:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
