import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { session_id, barcode, force } = body;

    if (!session_id || !barcode) {
      return NextResponse.json({ error: 'Missing session_id or barcode' }, { status: 400 });
    }

    // Parse ARTICLE|COLOUR|SIZE or ARTICLE|COLOUR|SIZE|MRP format
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

    const scannedArticle = parts[0].toUpperCase();
    const scannedColour = parts[1].toUpperCase();
    const scannedSize = parts[2];
    const mrp = parts.length >= 4 ? parseFloat(parts[3]) || null : null;

    const validSizes = ['5','6','7','8','9','10','11','12'];
    if (!validSizes.includes(scannedSize)) {
      return NextResponse.json({ error: `Unsupported size: ${scannedSize}` }, { status: 400 });
    }

    const db = getDb();
    
    // 1. Concurrent Fetch: Session, ScannedCount, Pool
    const invCol = `size_${scannedSize}`;
    
    const [session, scannedCount, pool] = await Promise.all([
      db.prepare(`
        SELECT s.* 
        FROM outward_scan_sessions s
        JOIN carton_generation c ON s.carton_generation_id = c.id
        WHERE s.id = ?
      `).get(session_id),
      db.prepare(`
        SELECT COUNT(*) as count FROM outward_scan_items 
        WHERE session_id = ? AND size = ?
      `).get(session_id, scannedSize),
      db.prepare(`
        SELECT ${invCol} as qty FROM inventory_pool 
        WHERE article_code = ? AND colour = ?
      `).get(scannedArticle, scannedColour)
    ]) as any[];

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    if (session.status !== 'in_progress') {
      return NextResponse.json({ error: `Session is ${session.status}` }, { status: 400 });
    }

    // ─── DUPLICATE SCAN GUARD (per-session) ──────────────────────────────────
    // Check if this exact barcode string was already scanned in this session
    const existingInSession = await db.prepare(`
      SELECT id FROM scan_history
      WHERE barcode = ? AND scan_type = 'outward' AND status = 'success_outward'
        AND created_at >= NOW() - INTERVAL '30 minutes'
      LIMIT 1
    `).get(barcode) as any;

    if (existingInSession && !force) {
      // Log the duplicate attempt visibly in scan_history
      await db.prepare(`
        INSERT INTO scan_history (barcode, article_code, colour, size, operator_id, status, scan_type)
        VALUES (?, ?, ?, ?, ?, 'error_duplicate', 'outward')
      `).run(barcode, scannedArticle, scannedColour, scannedSize, user.id);
      return NextResponse.json({
        error: `⚠️ DUPLICATE SCAN: Barcode "${barcode}" was already scanned in this session. Duplicate rejected.`,
        isDuplicate: true
      }, { status: 409 });
    }
    // ──────────────────────────────────────────────────────────────────

    // 2. Match article and colour
    if (scannedArticle !== session.article_code || scannedColour !== session.colour) {
      return NextResponse.json({ 
        error: `Article mismatch. Expected ${session.article_code} - ${session.colour}, got ${scannedArticle} - ${scannedColour}` 
      }, { status: 400 });
    }

    // 3. Fetch Rule Config
    const sizeConfig = await db.prepare(`
      SELECT quantity FROM carton_generation_sizes WHERE config_id = ? AND size = ?
    `).get(session.carton_generation_id, scannedSize) as any;

    const ruleQuantity = sizeConfig ? sizeConfig.quantity : 0;
    const currentCount = scannedCount.count;

    // Trigger approval warning for any scan that reaches or exceeds the required rule quantity
    if (currentCount >= ruleQuantity && !force) {
      const isCustom = ruleQuantity === 0;
      return NextResponse.json({ 
        requireApproval: true, 
        message: isCustom 
          ? `Size ${scannedSize} is not defined in the original carton rule. Would you like to add it as a custom size variation?` 
          : `You have reached the required rule limit for size ${scannedSize}. You are about to add an extra pair (${currentCount + 1} scanned, rule is ${ruleQuantity}). Approve variation?`
      }, { status: 200 });
    }

    // 4. Validate inventory_pool has sufficient stock
    if (!pool || pool.qty < 1) {
      return NextResponse.json({ 
        error: `Sorry, there is not enough stock in the staging inventory for size ${scannedSize}. Please resume scanning other items.` 
      }, { status: 400 });
    }

    // Success! Perform DB updates concurrently
    await Promise.all([
      db.prepare(`
        INSERT INTO outward_scan_items (session_id, article_code, colour, size)
        VALUES (?, ?, ?, ?)
      `).run(session_id, scannedArticle, scannedColour, scannedSize),
      
      db.prepare(`
        UPDATE inventory_pool 
        SET ${invCol} = ${invCol} - 1, total_qty = total_qty - 1
        WHERE article_code = ? AND colour = ?
      `).run(scannedArticle, scannedColour),
      
      db.prepare(`
        INSERT INTO scan_history (barcode, article_code, colour, size, operator_id, status, mrp, scan_type)
        VALUES (?, ?, ?, ?, ?, 'success_outward', ?, 'outward')
      `).run(barcode, scannedArticle, scannedColour, scannedSize, user.id, mrp)
    ]);

    return NextResponse.json({
      success: true,
      message: `Scanned ${scannedArticle} (${scannedSize})`,
      article: { article_code: scannedArticle, size: scannedSize, colour: scannedColour }
    });
  } catch (error: any) {
    console.error('Error in outward scan:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
