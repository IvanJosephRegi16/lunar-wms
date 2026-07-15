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

  // ─── BARCODE FORMAT ───────────────────────────────────────────────────────
  // Pipe-delimited:  ARTICLE|COLOUR|SIZE[|MRP]
  // Space-delimited: ARTICLE COLOUR SIZE [MRP_OR_UNIQUECODE]
  //   • Jokot barcodes start with 'J'  (e.g. JF-3713 VIOLET 5 399.00 JF-6)
  //   • Lunar barcodes start with digit (e.g. 3713 VIOLET 5 399.00 L-6)
  //   • 4th token is MRP only when it ends with ".00" (e.g. "399.00");
  //     otherwise it is a unique/serial code and MRP stays null.
  // ─────────────────────────────────────────────────────────────────────────
  let parts: string[] = [];
  if (barcode.includes('|')) {
    parts = barcode.split('|').map((p: string) => p.trim()).filter(Boolean) as string[];
  } else {
    // Space-separated: works for both Jokot (J prefix) and Lunar (digit prefix)
    const firstChar = barcode.trimStart()[0];
    if (
      firstChar === 'J' || firstChar === 'j' ||
      (firstChar >= '0' && firstChar <= '9')
    ) {
      parts = barcode.trim().split(/\s+/);
    }
  }

  if (parts.length < 3) {
    return NextResponse.json(
      { error: 'Invalid barcode format. Expected ARTICLE COLOUR SIZE [MRP] (space-separated for Jokot/Lunar) or ARTICLE|COLOUR|SIZE[|MRP]' },
      { status: 400 }
    );
  }

  const article = parts[0].toUpperCase();
  const colour  = parts[1].toUpperCase();
  const size    = parts[2];

  // Determine MRP: 4th token is MRP only when it ends with ".00"
  let mrp: number | null = null;
  if (parts.length >= 4) {
    const candidate = parts[3];
    if (candidate.endsWith('.00') || /^\d+(\.\d+)?$/.test(candidate)) {
      const parsed = parseFloat(candidate);
      if (!isNaN(parsed) && candidate.endsWith('.00')) {
        mrp = parsed;
      }
      // else: it's a unique/serial code – mrp stays null
    }
  }

  const sizeColumn = `size_${size}`;

  const validSizes = ['5','6','7','8','9','10','11','12','13'];
  if (!validSizes.includes(size)) {
    return NextResponse.json({ error: `Unsupported size: ${size}` }, { status: 400 });
  }

  const db = getDb();

  try {
    const result = await db.transaction(async () => {
      // ─── DUPLICATE SCAN GUARD ────────────────────────────────────────────────
      // Reject if this exact barcode was already successfully scanned in the
      // last 10 minutes to protect against accidental double-scans.
      const recentDuplicate = await db.prepare(`
        SELECT barcode, created_at FROM scan_history
        WHERE barcode = ? AND scan_type = 'intake' AND status = 'success'
        ORDER BY created_at DESC
        LIMIT 1
      `).get(barcode) as any;

      if (recentDuplicate) {
        // Enforce 10-minute duplicate block in Javascript to be DB agnostic
        const scanTimeMs = new Date(recentDuplicate.created_at).getTime();
        const tenMinsAgo = Date.now() - 10 * 60 * 1000;
        
        if (scanTimeMs >= tenMinsAgo) {
          let scanTime = '';
          try {
            scanTime = new Date(recentDuplicate.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
          } catch(e) { scanTime = recentDuplicate.created_at; }
          
          // Log the duplicate attempt in scan_history for forensic visibility
          await db.prepare(`
            INSERT INTO scan_history (barcode, article_code, colour, size, operator_id, status, mrp, scan_type)
            VALUES (?, ?, ?, ?, ?, 'error_duplicate', ?, 'intake')
          `).run(barcode, article, colour, size, user.id, mrp);
          throw Object.assign(new Error(`Duplicate Entry which you already scanned. Scanned on: ${scanTime}`), { isDuplicate: true });
        }
      }
      // ────────────────────────────────────────────────────────────────────────

      // Upsert inventory pool safely – article_code+colour is the natural key
      const existing = await db.prepare(
        `SELECT article_code, ${sizeColumn}, mrp FROM inventory_pool WHERE article_code = ? AND colour = ?`
      ).get(article, colour) as any;

      if (existing) {
        // Update existing row – use article_code+colour as the WHERE key (no id column)
        const mrpUpdate = mrp !== null ? `, mrp = ${mrp}` : '';
        await db.prepare(`
          UPDATE inventory_pool
          SET ${sizeColumn} = ${sizeColumn} + 1, total_qty = total_qty + 1 ${mrpUpdate}
          WHERE article_code = ? AND colour = ?
        `).run(article, colour);
      } else {
        const cols = validSizes.map((s: string) => `size_${s}`).join(', ');
        const vals = validSizes.map((s: string) => (s === size ? '1' : '0')).join(', ');
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

      // Add to unique barcode pool for outward matching, overwriting if reusing from old cycle
      await db.prepare(`
        INSERT INTO intake_barcode_pool (barcode, article_code, colour, size, status)
        VALUES (?, ?, ?, ?, 'available')
        ON CONFLICT (barcode) DO UPDATE 
        SET status = 'available', outward_scanned_at = NULL
      `).run(barcode, article, colour, size);

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
    const isDuplicate = error.isDuplicate === true;
    // Log error audit for traceability (skip if already logged as duplicate)
    if (!isDuplicate) {
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
    }
    console.error('Error scanning barcode:', error);
    return NextResponse.json(
      { error: error.message, isDuplicate },
      { status: isDuplicate ? 409 : 400 }
    );
  }
}
