import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { carton_generation_id } = body;

    if (!carton_generation_id) {
      return NextResponse.json({ error: 'Missing carton_generation_id' }, { status: 400 });
    }

    const db = getDb();
    
    // Check for active sessions for this config
    const existing = await db.prepare(`
      SELECT id FROM outward_scan_sessions 
      WHERE carton_generation_id = ? AND status = 'in_progress'
    `).get(carton_generation_id);

    if (existing) {
      return NextResponse.json({ error: 'An active scan session already exists for this configuration.' }, { status: 400 });
    }

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

    let sessionId;
    await db.transaction(async () => {
      const res = await db.prepare(`
        INSERT INTO outward_scan_sessions (carton_generation_id, operator_id, status)
        VALUES (?, ?, 'in_progress')
      `).run(carton_generation_id, user.id);
      
      sessionId = res.lastInsertRowid;
    });

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
