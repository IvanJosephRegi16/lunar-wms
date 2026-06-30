import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { sessionId } = await params;
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    const db = getDb();
    
    const session = await db.prepare(`
      SELECT s.*, c.total_pairs 
      FROM outward_scan_sessions s
      JOIN carton_generation c ON s.carton_generation_id = c.id
      WHERE s.id = ?
    `).get(sessionId) as any;

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const poolData = await db.prepare(`
      SELECT mrp FROM inventory_pool 
      WHERE article_code = ? AND colour = ? 
      LIMIT 1
    `).get(session.article_code, session.colour) as any;
    
    session.mrp = poolData?.mrp || null;

    const configSizes = await db.prepare(`
      SELECT * FROM carton_generation_sizes WHERE config_id = ?
    `).all(session.carton_generation_id);

    const scannedItems = await db.prepare(`
      SELECT size, COUNT(*) as count FROM outward_scan_items 
      WHERE session_id = ? GROUP BY size
    `).all(sessionId);

    // Merge required vs scanned
    const progress = configSizes.map((conf: any) => {
      const scanned = scannedItems.find((s: any) => s.size === conf.size);
      return {
        size: conf.size,
        required: conf.quantity,
        scanned: scanned ? scanned.count : 0,
        remaining: Math.max(0, conf.quantity - (scanned ? scanned.count : 0))
      };
    });

    // Add any custom sizes that were scanned but not in original config
    scannedItems.forEach((scanned: any) => {
      if (!configSizes.find((c: any) => c.size === scanned.size)) {
        progress.push({
          size: scanned.size,
          required: 0,
          scanned: scanned.count,
          remaining: 0
        });
      }
    });

    // Sort by size
    progress.sort((a: any, b: any) => parseInt(a.size) - parseInt(b.size));

    return NextResponse.json({
      success: true,
      session,
      progress
    });
  } catch (error: any) {
    console.error('Error fetching outward scan session:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
