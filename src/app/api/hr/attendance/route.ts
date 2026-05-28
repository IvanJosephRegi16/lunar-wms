import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // YYYY-MM
    
    if (!month) {
      return NextResponse.json({ error: 'Month parameter is required (YYYY-MM)' }, { status: 400 });
    }

    const db = getDb();
    
    // 1. Fetch all active employees (or employees who have attendance in this month)
    const employees = await db.prepare(`
      SELECT id, emp_code, punch_code, name, department, designation, unit, status 
      FROM hr_employees 
      WHERE is_deleted = 0 AND (status = 'Active' OR status = 'Hold')
      ORDER BY name ASC
    `).all();

    // 2. Fetch all daily attendance records for the given month
    const attendanceRecords = await db.prepare(`
      SELECT emp_id, date, status, ot_hours, late_minutes, early_exit_minutes, remarks, is_locked 
      FROM hr_attendance_daily 
      WHERE date LIKE ?
    `).all(`${month}-%`);

    // 3. Transform into a fast lookup matrix map: emp_id -> { date: record }
    const matrixMap: Record<number, Record<string, any>> = {};
    for (const record of attendanceRecords) {
      if (!matrixMap[record.emp_id]) {
        matrixMap[record.emp_id] = {};
      }
      matrixMap[record.emp_id][record.date] = record;
    }

    return NextResponse.json({ 
      employees,
      matrix: matrixMap 
    });

  } catch (error: any) {
    console.error('Fetch attendance error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Batch save attendance records
export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { updates, month } = data; // updates = array of { emp_id, date, status, ... }
    
    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const db = getDb();
    
    await db.transaction(async () => {
      const stmt = db.prepare(`
        INSERT INTO hr_attendance_daily (emp_id, date, status, ot_hours, ot_minutes_total, late_minutes, early_exit_minutes, remarks, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(emp_id, date) DO UPDATE SET 
          status = excluded.status,
          ot_hours = excluded.ot_hours,
          ot_minutes_total = excluded.ot_minutes_total,
          late_minutes = excluded.late_minutes,
          early_exit_minutes = excluded.early_exit_minutes,
          remarks = excluded.remarks,
          updated_at = CURRENT_TIMESTAMP
      `);

      for (const update of updates) {
        // Skip if locked (additional safety can be implemented here by checking is_locked first)
        await stmt.run(
          update.emp_id, 
          update.date, 
          update.status,
          update.ot_hours || 0,
          update.ot_minutes_total || 0,
          update.late_minutes || 0,
          update.early_exit_minutes || 0,
          update.remarks || null
        );
      }
    });

    return NextResponse.json({ success: true, count: updates.length });
  } catch (error: any) {
    console.error('Save attendance batch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
