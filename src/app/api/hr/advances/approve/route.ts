import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser, hasPermission } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !hasPermission('/hr', user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { advance_id, amount_approved, signature } = body;

    if (!advance_id || !amount_approved) {
      return NextResponse.json({ error: 'Advance ID and approved amount are required' }, { status: 400 });
    }

    if (signature !== 'APPROVED') {
      return NextResponse.json({ error: 'Invalid digital signature. Must type "APPROVED"' }, { status: 400 });
    }

    const db = getDb();
    
    // Update advance to approved
    await db.prepare(`
      UPDATE hr_advances 
      SET status = 'approved',
          amount_approved = ?,
          outstanding_balance = ?,
          approved_by = ?,
          approval_timestamp = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'pending'
    `).run(amount_approved, amount_approved, user.id, advance_id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
