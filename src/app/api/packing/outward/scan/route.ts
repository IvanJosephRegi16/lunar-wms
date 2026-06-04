import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { session_id, barcode } = body;

    if (!session_id || !barcode) {
      return NextResponse.json({ error: 'Missing session_id or barcode' }, { status: 400 });
    }

    const db = getDb();
    
    // 1. Resolve Barcode
    const article = await db.prepare(`SELECT * FROM articles WHERE barcode = ?`).get(barcode) as any;
    if (!article) {
      return NextResponse.json({ error: 'Invalid barcode: Article not found' }, { status: 400 });
    }

    // 2. Validate Session
    const session = await db.prepare(`
      SELECT s.* 
      FROM outward_scan_sessions s
      JOIN carton_generation c ON s.carton_generation_id = c.id
      WHERE s.id = ?
    `).get(session_id) as any;

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    if (session.status !== 'in_progress') {
      return NextResponse.json({ error: `Session is ${session.status}` }, { status: 400 });
    }

    // 3. Match article and colour
    if (article.article_code !== session.article_code || article.colour !== session.colour) {
      return NextResponse.json({ 
        error: `Article mismatch. Expected ${session.article_code} - ${session.colour}, got ${article.article_code} - ${article.colour}` 
      }, { status: 400 });
    }

    // 4. Validate size still needs pairs
    const sizeConfig = await db.prepare(`
      SELECT quantity FROM carton_generation_sizes WHERE config_id = ? AND size = ?
    `).get(session.carton_generation_id, article.size) as any;

    if (!sizeConfig) {
      return NextResponse.json({ error: `Size ${article.size} is not required for this carton configuration.` }, { status: 400 });
    }

    const scannedCount = await db.prepare(`
      SELECT COUNT(*) as count FROM outward_scan_items 
      WHERE session_id = ? AND size = ?
    `).get(session_id, article.size) as any;

    if (scannedCount.count >= sizeConfig.quantity) {
      return NextResponse.json({ error: `Size ${article.size} is already fully scanned (${sizeConfig.quantity}/${sizeConfig.quantity}).` }, { status: 400 });
    }

    // 5. Validate inventory_pool has sufficient stock
    const invCol = `size_${article.size}`;
    // We must ensure the column exists (5-12)
    const validSizes = ['5','6','7','8','9','10','11','12'];
    if (!validSizes.includes(article.size)) {
      return NextResponse.json({ error: `Invalid size in article: ${article.size}` }, { status: 400 });
    }

    const pool = await db.prepare(`
      SELECT ${invCol} as qty FROM inventory_pool 
      WHERE article_code = ? AND colour = ?
    `).get(article.article_code, article.colour) as any;

    if (!pool || pool.qty < 1) {
      return NextResponse.json({ error: `Insufficient stock in staging area for size ${article.size}.` }, { status: 400 });
    }

    // Success! Perform DB updates
    await db.transaction(async () => {
      // Insert scan item
      await db.prepare(`
        INSERT INTO outward_scan_items (session_id, article_code, colour, size)
        VALUES (?, ?, ?, ?)
      `).run(session_id, article.article_code, article.colour, article.size);

      // Decrement inventory pool
      await db.prepare(`
        UPDATE inventory_pool 
        SET ${invCol} = ${invCol} - 1, total_qty = total_qty - 1
        WHERE article_code = ? AND colour = ?
      `).run(article.article_code, article.colour);
      
      // Log to scan_history as well for audit
      await db.prepare(`
        INSERT INTO scan_history (barcode, article_code, colour, size, operator_id, status)
        VALUES (?, ?, ?, ?, ?, 'success_outward')
      `).run(barcode, article.article_code, article.colour, article.size, user.id);
    });

    // Determine progress and if auto-seal is needed
    const allScanned = await db.prepare(`
      SELECT size, COUNT(*) as count FROM outward_scan_items 
      WHERE session_id = ? GROUP BY size
    `).all(session_id);

    const configSizes = await db.prepare(`
      SELECT size, quantity FROM carton_generation_sizes WHERE config_id = ?
    `).all(session.carton_generation_id);

    let isComplete = true;
    for (const conf of configSizes) {
      const scanned = allScanned.find((s: any) => s.size === conf.size);
      if (!scanned || scanned.count < conf.quantity) {
        isComplete = false;
        break;
      }
    }

    // Call seal if complete
    let sealedCarton = null;
    if (isComplete) {
      // In Next.js App Router, calling our own API is tricky. We can just invoke a helper or fetch the full URL.
      // Better to just inline the seal logic or hit the endpoint via absolute URL.
      // Because we are inside an API, we can just do the seal logic right here or call a shared function.
      const baseUrl = req.nextUrl.origin;
      try {
        const sealRes = await fetch(`${baseUrl}/api/packing/outward/session/seal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: req.headers.get('cookie') || '' },
          body: JSON.stringify({ session_id })
        });
        if (sealRes.ok) {
          const sealData = await sealRes.json();
          sealedCarton = sealData.carton;
        }
      } catch (err) {
        console.error('Auto seal failed:', err);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Scanned ${article.article_code} (${article.size})`,
      article,
      isComplete,
      sealedCarton
    });
  } catch (error: any) {
    console.error('Error in outward scan:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
