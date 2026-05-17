import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { phone, otp } = await req.json();

    if (!phone || !otp) {
      return NextResponse.json({ error: 'Phone number and OTP are required' }, { status: 400 });
    }

    const db = getDb();
    
    // Find the latest active verification code
    const record = await db.prepare(`
      SELECT * FROM otp_verifications
      WHERE phone = ? AND otp = ? AND verified = 0
      ORDER BY id DESC LIMIT 1
    `).get(phone, otp) as any;

    if (!record || new Date(record.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invalid or expired verification OTP code.' }, { status: 400 });
    }

    // Mark as verified (status 1)
    await db.prepare('UPDATE otp_verifications SET verified = 1 WHERE id = ?').run(record.id);

    return NextResponse.json({
      success: true,
      message: 'Verification successful.'
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
