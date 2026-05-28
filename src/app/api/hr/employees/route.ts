import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const unit = searchParams.get('unit') || '';
    const status = searchParams.get('status') || '';

    const db = getDb();
    
    let query = `SELECT * FROM hr_employees WHERE is_deleted = 0`;
    const params: any[] = [];
    
    if (search) {
      query += ` AND (name LIKE ? OR emp_code LIKE ? OR punch_code LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (unit && unit !== 'all') {
      query += ` AND unit = ?`;
      params.push(unit);
    }
    if (status && status !== 'all') {
      query += ` AND status = ?`;
      params.push(status);
    }
    
    query += ` ORDER BY name ASC`;
    
    const employees = await db.prepare(query).all(...params);
    return NextResponse.json({ employees });
  } catch (error: any) {
    console.error('Fetch employees error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const db = getDb();

    // Check if punch_code exists (since it's the manual reference)
    if (data.punch_code) {
      const existingPunch = await db.prepare(`SELECT id FROM hr_employees WHERE punch_code = ? AND is_deleted = 0`).get(data.punch_code);
      if (existingPunch) {
        return NextResponse.json({ error: 'Punch Code already exists' }, { status: 400 });
      }
    }

    // Auto-generate emp_code (e.g. VIKINGCBE0001)
    const lastEmp = await db.prepare(`SELECT id FROM hr_employees ORDER BY id DESC LIMIT 1`).get() as any;
    const nextId = lastEmp ? lastEmp.id + 1 : 1;
    const emp_code = `VIKINGCBE${nextId.toString().padStart(4, '0')}`;

    const stmt = db.prepare(`
      INSERT INTO hr_employees (
        emp_code, punch_code, name, unit, department, section, line, designation, 
        grade, skill_category, employment_type, status, join_date, 
        shift_group_id, weekly_off_pattern, salary_group_id, payroll_category, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = await stmt.run(
      emp_code, 
      data.punch_code || null, 
      data.name, 
      data.unit || null, 
      data.department || null, 
      data.section || null, 
      data.line || null, 
      data.designation || null, 
      data.grade || null, 
      data.skill_category || null, 
      data.employment_type || null, 
      data.status || 'Active', 
      data.join_date || null, 
      data.shift_group_id || null, 
      data.weekly_off_pattern || null, 
      data.salary_group_id || null, 
      data.payroll_category || null,
      data.created_by || 1
    );

    // Auto-create a default salary structure stub
    if (result.lastInsertRowid) {
      await db.prepare(`
        INSERT INTO hr_salary_structures (emp_id, basic_wage, da_wage, hra_wage, other_allowances, ot_rate_per_hour, pf_eligible, esi_eligible, pt_eligible)
        VALUES (?, 0, 0, 0, 0, 0, 1, 1, 1)
      `).run(result.lastInsertRowid);
    }

    return NextResponse.json({ success: true, id: result.lastInsertRowid });
  } catch (error: any) {
    console.error('Create employee error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
