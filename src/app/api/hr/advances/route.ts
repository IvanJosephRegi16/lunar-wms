import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser, hasPermission } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !hasPermission('/hr', user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  try {
    const advances = await db.prepare(`
      SELECT a.*, e.name as emp_name, e.emp_code, e.department
      FROM hr_advances a
      JOIN hr_employees e ON a.emp_id = e.id
      ORDER BY a.created_at DESC
    `).all();

    return NextResponse.json({ advances });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !hasPermission('/hr', user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { emp_id, amount_requested, remarks, proof_document_path } = body;

    if (!emp_id || !amount_requested) {
      return NextResponse.json({ error: 'Employee and amount are required' }, { status: 400 });
    }

    const db = getDb();
    
    // Create new pending advance
    const request_date = new Date().toISOString().split('T')[0];
    
    await db.prepare(`
      INSERT INTO hr_advances (emp_id, request_date, amount_requested, remarks, proof_document_path, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(emp_id, request_date, amount_requested, remarks || null, proof_document_path || null);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
