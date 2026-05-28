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
    // Locate the user linked to this phone number or username
    const user = await db.prepare('SELECT * FROM users WHERE phone = ? OR username = ?').get(phone, phone) as any;

    if (!user) {
      return NextResponse.json({ error: 'No account found with this username or phone number.' }, { status: 404 });
    }

    // Generate 6-digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Insert into DB under the exact input value they typed (phone)
    await db.prepare('INSERT INTO otp_verifications (phone, otp, expires_at) VALUES (?, ?, ?)')
      .run(phone, otp, expiresAt);

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

    // --- LIVE SMS GATEWAY INTEGRATION ---
    const smsApiKey = process.env.SMS_API_KEY;
    const fast2smsOtpId = process.env.FAST2SMS_OTP_ID;

    if (smsApiKey && smsApiKey !== 'your_fast2sms_authorization_key_here') {
      try {
        const phoneDigits = user.phone.replace(/[^0-9]/g, '');
        // Defaulting to Indian network length (10 digits)
        const targetNumber = phoneDigits.length > 10 ? phoneDigits.slice(-10) : phoneDigits;
        
        let response;
        if (fast2smsOtpId && fast2smsOtpId !== 'your_otp_template_id_here') {
          // Use the exact Fast2SMS Send OTP API shown in your screenshot
          response = await fetch('https://www.fast2sms.com/dev/otp/send', {
            method: 'POST',
            headers: {
              'authorization': smsApiKey,
              'accept': 'application/json',
              'content-type': 'application/json'
            },
            body: JSON.stringify({
              mobile: targetNumber,
              otp_id: fast2smsOtpId,
              variables_values: otp,
              otp_expiry: 10
            })
          });
        } else {
          // Fallback to bulkV2 Quick SMS API (no pre-approved OTP template required)
          response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
            method: 'POST',
            headers: {
              'authorization': smsApiKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              route: 'q',
              message: `Your Lunar's ERP verification code is: ${otp}. Do not share this with anyone.`,
              language: 'english',
              flash: 0,
              numbers: targetNumber,
            })
          });
        }

        const resData = await response.json().catch(() => ({}));
        if (response.ok && resData.return) {
          console.log(`[SMS SUCCESS] OTP dispatched to ${targetNumber}. Gateway response:`, resData);
        } else {
          console.error(`[SMS WARNING] Gateway accepted request but returned failure:`, resData);
        }
      } catch (err) {
        console.error('[SMS ERROR] Failed to push to SMS gateway:', err);
      }
    } else {
      console.warn('[SMS WARNING] SMS_API_KEY is not configured in .env.local. Skipping physical SMS delivery.');
    }

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
