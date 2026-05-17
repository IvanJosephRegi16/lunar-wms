import { NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { barcode } = body;

    if (!barcode) {
      return NextResponse.json({ error: 'Barcode is required' }, { status: 400 });
    }

    // Expected format "JF4444|GREEN|8|500" or "4444|GREEN|8|500"
    const parts = barcode.split('|');
    if (parts.length < 3) {
      return NextResponse.json({ error: 'Invalid barcode format. Expected ARTICLE|COLOUR|SIZE' }, { status: 400 });
    }

    const article = parts[0].toUpperCase();
    const colour = parts[1].toUpperCase();
    const size = parts[2];
    const sizeColumn = `size_${size}`;

    // Size validation - only allow 5-12 for our schema
    const validSizes = ['5', '6', '7', '8', '9', '10', '11', '12'];
    if (!validSizes.includes(size)) {
      return NextResponse.json({ error: `Unsupported size: ${size}` }, { status: 400 });
    }
    
    const db = getDb();

    // 0. Protection against rapid duplicate scans (2-second debounce window)
    const recentScan = await db.prepare(`
      SELECT id FROM scan_history 
      WHERE barcode = ? AND operator_id = ? AND status = 'success'
      AND created_at >= NOW() - INTERVAL '2 seconds'
    `).get(barcode, user.id);

    if (recentScan) {
      return NextResponse.json({ error: 'Duplicate scan ignored. Please wait a moment between identical barcodes.' }, { status: 429 });
    }

    const result = await db.transaction(async () => {
      // 1. Upsert into Inventory Pool (Row-level lock to prevent concurrent double-counts)
      const checkAgg = await db.prepare(`SELECT id FROM inventory_pool WHERE article_code = ? AND colour = ? FOR UPDATE`).get(article, colour) as any;
      
      if (checkAgg) {
         await db.prepare(`
           UPDATE inventory_pool 
           SET ${sizeColumn} = ${sizeColumn} + 1, total_qty = total_qty + 1
           WHERE id = ?
         `).run(checkAgg.id);
      } else {
         const cols = validSizes.map(s => `size_${s}`).join(', ');
         const vals = validSizes.map(s => s === size ? '1' : '0').join(', ');
         await db.prepare(`
           INSERT INTO inventory_pool (article_code, colour, total_qty, ${cols})
           VALUES (?, ?, 1, ${vals})
         `).run(article, colour);
      }

      // 2. Record Inward Transaction
      await db.prepare(`
        INSERT INTO inward_inventory_transactions (article_code, colour, size, quantity, operator_id, type)
        VALUES (?, ?, ?, 1, ?, 'scan')
      `).run(article, colour, size, user.id);

      // 3. Record Scan History (Success)
      await db.prepare(`
        INSERT INTO scan_history (barcode, article_code, colour, size, operator_id, status)
        VALUES (?, ?, ?, ?, ?, 'success')
      `).run(barcode, article, colour, size, user.id);

      return { article, colour, size };
    });

    await logAudit({
      userId: user.id,
      username: user.username,
      action: 'INWARD_SCAN',
      module: 'inventory_pool',
      recordId: 0,
      description: `Scanned barcode ${barcode} to add Size ${size} of ${article} (${colour}) to Inventory Pool`
    });

    return NextResponse.json({
      success: true,
      message: 'Stock Added to Inventory',
      product: result
    });

  } catch (error: any) {
    // If it fails, log as error scan
    try {
      const user = await getAuthUser();
      if (user) {
         const body = await request.json().catch(() => ({}));
         const barcode = body.barcode || 'unknown';
         await getDb().prepare(`
            INSERT INTO scan_history (barcode, article_code, colour, size, operator_id, status)
            VALUES (?, ?, ?, ?, ?, ?)
         `).run(barcode, '-', '-', '-', user.id, `error: ${error.message}`);
      }
    } catch(e) {}
    
    console.error('Error scanning barcode:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
