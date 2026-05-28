import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser, hasPermission } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !hasPermission('/hr', user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const emp_id = searchParams.get('emp_id');
  const month_year = searchParams.get('month_year') || new Date().toISOString().slice(0, 7);

  if (!emp_id) {
    return NextResponse.json({ error: 'Employee ID required' }, { status: 400 });
  }

  const db = getDb();
  
  try {
    // Get monthly summary
    const monthlySummary = await db.prepare(`
      SELECT total_present, total_absent, total_half_days, total_leave, total_wo, total_holiday, total_ot_hours, payable_days
      FROM hr_attendance_monthly
      WHERE emp_id = ? AND month_year = ?
    `).get(emp_id, month_year);

    // Calculate dynamic attendance percentage
    let present_days = monthlySummary?.total_present || 0;
    let half_days = monthlySummary?.total_half_days || 0;
    let absent_days = monthlySummary?.total_absent || 0;
    let wo_days = monthlySummary?.total_wo || 0;
    
    // For MVP, half day counts as 0.5 present
    let effective_present = present_days + (half_days * 0.5);
    let total_working_days_attempted = effective_present + absent_days + (half_days * 0.5);
    let attendance_percentage = total_working_days_attempted > 0 
      ? Math.round((effective_present / total_working_days_attempted) * 100) 
      : 100;

    // Get Salary Estimate info
    const salaryStructure = await db.prepare(`
      SELECT basic_wage, da_wage, hra_wage, other_allowances, ot_rate_per_hour
      FROM hr_salary_structures WHERE emp_id = ?
    `).get(emp_id);

    // Get Active Advance Balance
    const advanceInfo = await db.prepare(`
      SELECT COALESCE(SUM(outstanding_balance), 0) as total_outstanding, COUNT(id) as pending_advances
      FROM hr_advances
      WHERE emp_id = ? AND status = 'approved' AND outstanding_balance > 0
    `).get(emp_id);

    return NextResponse.json({
      summary: {
        total_present: present_days,
        total_absent: absent_days,
        total_half_days: half_days,
        total_wo: wo_days,
        total_ot_hours: monthlySummary?.total_ot_hours || 0,
        payable_days: monthlySummary?.payable_days || 0,
        attendance_percentage
      },
      salary: salaryStructure || { basic_wage: 0, ot_rate_per_hour: 0 },
      advances: {
        total_outstanding: advanceInfo?.total_outstanding || 0,
        pending_advances: advanceInfo?.pending_advances || 0
      }
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
