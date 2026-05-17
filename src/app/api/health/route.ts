import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    // 1. Verify Database Connectivity
    const db = getDb();
    const dbCheck = await db.prepare('SELECT 1 as is_alive').get();

    // 2. Verify Security Configuration
    const jwtConfigured = !!process.env.JWT_SECRET;
    
    // 3. System Status Verification
    const status = (dbCheck && jwtConfigured) ? 'healthy' : 'degraded';

    return NextResponse.json({
      status,
      timestamp: new Date().toISOString(),
      services: {
        database: dbCheck ? 'connected' : 'disconnected',
        security: jwtConfigured ? 'configured' : 'missing_jwt_secret',
        framework: 'Next.js App Router (Standalone)',
        uptime: process.uptime()
      }
    }, { status: status === 'healthy' ? 200 : 503 });

  } catch (error: any) {
    console.error('[HEALTH CHECK FAILED]:', error);
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    }, { status: 500 });
  }
}
