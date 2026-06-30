import { NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function POST(request: Request) {
  // Authenticate once
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { barcode } = body;

  if (!barcode) {
    return NextResponse.json({ error: 'Barcode is required' }, { status: 400 });
  }

  // Expected format "ARTICLE|COLOUR|SIZE" or "ARTICLE|COLOUR|SIZE|MRP"
  // JOKOT format "ARTICLE COLOUR SIZE" (starts with J)
  let parts: string[] = [];
  if (barcode.includes('|')) {
    parts = barcode.split('|');
  } else if (barcode.startsWith('J') || barcode.startsWith('j')) {
    parts = barcode.split(' ');
  }

  if (parts.length < 3) {
    return NextResponse.json({ error: 'Invalid barcode format. Expected ARTICLE|COLOUR|SIZE or ARTICLE COLOUR SIZE (for Jokot)' }, { status: 400 });
  }

  const article = parts[0].toUpperCase();
  const colour = parts[1].toUpperCase();
  const size = parts[2];
  const mrp = parts.length >= 4 ? parseFloat(parts[3]) || null : null;
  const sizeColumn = `size_${size}`;

  const validSizes = ['5','6','7','8','9','10','11','12'];
  if (!validSizes.includes(size)) {
    return NextResponse.json({ error: `Unsupported size: ${size}` }, { status: 400 });
  }

  const db = getDb();

  try {
    const result = await db.transaction(async () => {
      // Upsert inventory pool safely – column name already validated
      const existing = await db.prepare(`SELECT id, ${sizeColumn}, mrp FROM inventory_pool WHERE article_code = ? AND colour = ?`).get(article, colour) as any;
      if (existing) {
        // If an MRP is provided in this scan and it differs from the existing, we update it (or set if null).
        // Optionally you could average it, but standard is latest MRP overrides.
        const mrpUpdate = mrp !== null ? `, mrp = ${mrp}` : '';
        await db.prepare(`
          UPDATE inventory_pool
          SET ${sizeColumn} = ${sizeColumn} + 1, total_qty = total_qty + 1 ${mrpUpdate}
          WHERE id = ?
        `).run(existing.id);
      } else {
        const cols = validSizes.map(s => `size_${s}`).join(', ');
        const vals = validSizes.map(s => (s === size ? '1' : '0')).join(', ');
        await db.prepare(`
          INSERT INTO inventory_pool (article_code, colour, total_qty, ${cols}, mrp)
          VALUES (?, ?, 1, ${vals}, ?)
        `).run(article, colour, mrp);
      }

      // Record inward transaction
      await db.prepare(`
        INSERT INTO inward_inventory_transactions (article_code, colour, size, quantity, operator_id, type)
        VALUES (?, ?, ?, 1, ?, 'scan')
      `).run(article, colour, size, user.id);

      // Record successful scan history
      await db.prepare(`
        INSERT INTO scan_history (barcode, article_code, colour, size, operator_id, status, mrp, scan_type)
        VALUES (?, ?, ?, ?, ?, 'success', ?, 'intake')
      `).run(barcode, article, colour, size, user.id, mrp);

      return { article, colour, size, mrp };
    });

    // Successful audit log
    await logAudit({
      userId: user.id,
      username: user.username,
      action: 'INWARD_SCAN',
      module: 'inventory_pool',
      recordId: 0,
      description: `Scanned barcode ${barcode} to add Size ${size} of ${article} (${colour}) to Inventory Pool`
    });

    return NextResponse.json({ success: true, message: 'Stock Added to Inventory', product: result });
  } catch (error: any) {
    // Log error audit for traceability
    await logAudit({
      userId: user.id,
      username: user.username,
      action: 'INWARD_SCAN_ERROR',
      module: 'inventory_pool',
      recordId: 0,
      description: `Error scanning barcode ${barcode}: ${error.message}`
    });
    // Record failed scan in history for forensic analysis
    try {
      await db.prepare(`
        INSERT INTO scan_history (barcode, article_code, colour, size, operator_id, status, mrp, scan_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'intake')
      `).run(barcode, '-', '-', '-', user.id, `error: ${error.message}`, null);
    } catch {}
    console.error('Error scanning barcode:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
