import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { carton_generation_id, article_code, colour } = body;

    if (!carton_generation_id || !article_code || !colour) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = getDb();
    
    // Get the master config to return to the client
    const config = await db.prepare(`
      SELECT * FROM carton_generation WHERE id = ?
    `).get(carton_generation_id) as any;

    if (!config) {
      return NextResponse.json({ error: 'Carton configuration not found' }, { status: 404 });
    }

    const sizes = await db.prepare(`
      SELECT * FROM carton_generation_sizes WHERE config_id = ?
    `).all(carton_generation_id);

    // Check for active sessions for this config + article + colour
    const existing = await db.prepare(`
      SELECT id FROM outward_scan_sessions 
      WHERE carton_generation_id = ? AND article_code = ? AND colour = ? AND status = 'in_progress'
    `).get(carton_generation_id, article_code, colour) as any;

    let sessionId;
    if (existing) {
      // Allow resuming existing session
      sessionId = existing.id;
    } else {
      await db.transaction(async () => {
        const res = await db.prepare(`
          INSERT INTO outward_scan_sessions (carton_generation_id, operator_id, article_code, colour, status)
          VALUES (?, ?, ?, ?, 'in_progress')
        `).run(carton_generation_id, user.id, article_code, colour);
        
        sessionId = res.lastInsertRowid;
      });
    }

    return NextResponse.json({
      success: true,
      session_id: sessionId,
      config: {
        ...config,
        sizes
      }
    });
  } catch (error: any) {
    console.error('Error starting outward scan session:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
