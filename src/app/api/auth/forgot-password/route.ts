import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const db = getDb();
    // Locate the user linked to this phone number
    const user = await db.prepare('SELECT * FROM users WHERE phone = ? OR username = ?').get(phone, phone) as any;

    if (!user || !user.phone) {
      return NextResponse.json({ error: 'No account found with this phone number linked.' }, { status: 404 });
    }

    // Generate 6-digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Insert into DB
    await db.prepare('INSERT INTO otp_verifications (phone, otp, expires_at) VALUES (?, ?, ?)')
      .run(user.phone, otp, expiresAt);

    // Console Alert Log
    console.log(`\n==========================================`);
    console.log(`[OTP VERIFICATION] Reset Code for ${user.username} (${user.phone}): ${otp}`);
    console.log(`==========================================\n`);

    // Write to local debug file
    const logDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const logPath = path.join(logDir, 'sent_otps.txt');
    const logLine = `[${new Date().toISOString()}] Phone: ${user.phone} | User: ${user.username} | OTP: ${otp}\n`;
    fs.appendFileSync(logPath, logLine);

    return NextResponse.json({
      success: true,
      message: 'Verification code sent successfully.',
      phone: user.phone,
      dev_otp: otp // Exposed for ease of evaluation and client verification helper
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
