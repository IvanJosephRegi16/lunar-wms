import { NextRequest, NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const { phone, otp, newPassword } = await req.json();

    if (!phone || !otp || !newPassword) {
      return NextResponse.json({ error: 'Missing recovery credentials' }, { status: 400 });
    }

    const db = getDb();

    // Confirm that this OTP was indeed verified previously (verified = 1)
    const record = await db.prepare(`
      SELECT * FROM otp_verifications
      WHERE phone = ? AND otp = ? AND verified = 1
      ORDER BY id DESC LIMIT 1
    `).get(phone, otp) as any;

    if (!record) {
      return NextResponse.json({ error: 'Unauthorized credential reset attempt or invalid session.' }, { status: 400 });
    }

    // Locate the user linked to this phone or username
    const user = await db.prepare('SELECT * FROM users WHERE phone = ? OR username = ?').get(phone, phone) as any;
    if (!user) {
      return NextResponse.json({ error: 'User account not found.' }, { status: 404 });
    }

    // Hash the password and save
    const hash = bcrypt.hashSync(newPassword, 10);
    await db.prepare('UPDATE users SET password_hash = ?, plain_password = ? WHERE id = ?')
      .run(hash, newPassword, user.id);

    // Completely consume the OTP (status 2) so it cannot be reused
    await db.prepare('UPDATE otp_verifications SET verified = 2 WHERE id = ?').run(record.id);

    await logAudit({
      userId: user.id,
      username: user.username,
      action: 'RESET_PASSWORD',
      module: 'auth',
      description: 'Reset credentials successfully via Phone & OTP verification'
    });

    return NextResponse.json({
      success: true,
      message: 'Access credentials reset successfully.'
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
