import { NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';

// PF/ESI Constants (Indian statutory defaults)
const PF_RATE = 0.12;        // 12% of Basic
const PF_CEILING = 15000;    // PF applicable up to ₹15,000 basic
const ESI_RATE = 0.0075;     // 0.75% employee contribution
const ESI_CEILING = 21000;   // ESI applicable if gross <= ₹21,000
const PT_AMOUNT = 200;       // Professional Tax flat ₹200/month (configurable)

// GET: Fetch payroll runs, or a specific run's slip data
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const runId = searchParams.get('run_id');

    const db = getDb();

    if (runId) {
      // Fetch a specific payroll run with all its slips
      const run = await db.prepare(`SELECT * FROM hr_payroll_runs WHERE id = ?`).get(parseInt(runId));
      const slips = await db.prepare(`
        SELECT s.*, e.emp_code, e.name, e.department, e.unit, e.designation
        FROM hr_payroll_slips s
        JOIN hr_employees e ON e.id = s.emp_id
        WHERE s.payroll_run_id = ?
        ORDER BY e.name ASC
      `).all(parseInt(runId));
      return NextResponse.json({ run, slips });
    }

    // List all payroll runs, optionally filtered by month
    let query = `SELECT * FROM hr_payroll_runs`;
    const params: any[] = [];
    if (month) {
      query += ` WHERE month_year = ?`;
      params.push(month);
    }
    query += ` ORDER BY created_at DESC`;
    const runs = await db.prepare(query).all(...params);

    // Also return salary components for the UI
    const components = await db.prepare(`SELECT * FROM hr_salary_components ORDER BY type, code`).all();

    return NextResponse.json({ runs, components });
  } catch (error: any) {
    console.error('Fetch payroll error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Process payroll or update stage
export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { action } = data;
    const db = getDb();

    // ACTION: Process payroll for a month/unit
    if (action === 'process') {
      const { month_year, unit, processed_by } = data;
      if (!month_year) return NextResponse.json({ error: 'month_year is required' }, { status: 400 });

      // Check if run already exists
      const existing = await db.prepare(
        `SELECT id, stage FROM hr_payroll_runs WHERE month_year = ? AND (unit = ? OR (unit IS NULL AND ? IS NULL))`
      ).get(month_year, unit || null, unit || null);

      if (existing && existing.stage === 'Locked') {
        return NextResponse.json({ error: 'This payroll period is locked and cannot be reprocessed.' }, { status: 400 });
      }

      let runId: number;

      await db.transaction(async () => {
        // Create or update the payroll run
        if (existing) {
          runId = existing.id;
          // Clear old slips for reprocessing
          await db.prepare(`DELETE FROM hr_payroll_slips WHERE payroll_run_id = ?`).run(runId);
          await db.prepare(`UPDATE hr_payroll_runs SET stage = 'Draft', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(runId);
        } else {
          const res = await db.prepare(
            `INSERT INTO hr_payroll_runs (month_year, unit, stage, processed_by) VALUES (?, ?, 'Draft', ?)`
          ).run(month_year, unit || null, processed_by || 1);
          runId = Number(res.lastInsertRowid);
        }

        // Fetch employees (filtered by unit if specified)
        let empQuery = `SELECT e.id, e.emp_code, e.name, e.department, e.unit, e.designation
          FROM hr_employees e WHERE e.is_deleted = 0 AND e.status = 'Active'`;
        const empParams: any[] = [];
        if (unit) {
          empQuery += ` AND e.unit = ?`;
          empParams.push(unit);
        }
        const employees = await db.prepare(empQuery).all(...empParams);

        // Calculate days in the month
        const [year, mon] = month_year.split('-').map(Number);
        const daysInMonth = new Date(year, mon, 0).getDate();

        let totalGross = 0;
        let totalNet = 0;

        for (const emp of employees) {
          // 1. Get salary structure
          const salary = await db.prepare(`SELECT * FROM hr_salary_structures WHERE emp_id = ?`).get(emp.id);
          const basic = salary?.basic_wage || 0;
          const da = salary?.da_wage || 0;
          const hra = salary?.hra_wage || 0;
          const otherAllow = salary?.other_allowances || 0;
          const otRate = salary?.ot_rate_per_hour || 0;
          const pfEligible = salary?.pf_eligible ?? 1;
          const esiEligible = salary?.esi_eligible ?? 1;
          const ptEligible = salary?.pt_eligible ?? 1;

          // 2. Count attendance
          const attendance = await db.prepare(`
            SELECT status, COUNT(*) as cnt, SUM(ot_hours) as total_ot
            FROM hr_attendance_daily 
            WHERE emp_id = ? AND date LIKE ?
            GROUP BY status
          `).all(emp.id, `${month_year}-%`);

          let presentDays = 0;
          let absentDays = 0;
          let woDays = 0;
          let hlDays = 0;
          let otHoursTotal = 0;

          for (const row of attendance) {
            if (row.status === 'P') { presentDays = row.cnt; otHoursTotal += (row.total_ot || 0); }
            else if (row.status === 'A') absentDays = row.cnt;
            else if (row.status === 'WO') woDays = row.cnt;
            else if (row.status === 'HL') hlDays = row.cnt;
            else if (row.status === 'OT') { presentDays += row.cnt; otHoursTotal += (row.total_ot || 0); }
            else if (row.status === 'HD') presentDays += 0.5;
            else if (row.status === 'CL' || row.status === 'SL') presentDays += row.cnt; // Paid leave
          }

          // Payable days = present + weekly offs + holidays + paid leaves
          const payableDays = presentDays + woDays + hlDays;
          const dailyWage = (basic + da + hra + otherAllow) / daysInMonth;

          // 3. Calculate Earnings
          const earnBasic = (basic / daysInMonth) * payableDays;
          const earnDA = (da / daysInMonth) * payableDays;
          const earnHRA = (hra / daysInMonth) * payableDays;
          const earnOther = (otherAllow / daysInMonth) * payableDays;
          const earnOT = otHoursTotal * otRate;
          const grossEarnings = Math.round((earnBasic + earnDA + earnHRA + earnOther + earnOT) * 100) / 100;

          // 4. Calculate Deductions
          let dedPF = 0;
          if (pfEligible && basic <= PF_CEILING) {
            dedPF = Math.round(earnBasic * PF_RATE * 100) / 100;
          }

          let dedESI = 0;
          if (esiEligible && grossEarnings <= ESI_CEILING) {
            dedESI = Math.round(grossEarnings * ESI_RATE * 100) / 100;
          }

          let dedPT = 0;
          if (ptEligible) {
            dedPT = PT_AMOUNT;
          }

          // 5. Get one-off deductions/additions for this month
          const adjustments = await db.prepare(
            `SELECT * FROM hr_deductions_additions WHERE emp_id = ? AND month_year = ?`
          ).all(emp.id, month_year);

          let extraDeductions = 0;
          let extraAdditions = 0;
          for (const adj of adjustments) {
            if (adj.is_deduction) extraDeductions += adj.amount;
            else extraAdditions += adj.amount;
          }

          const totalStandardDeductions = Math.round((dedPF + dedESI + dedPT + extraDeductions) * 100) / 100;
          let netPayable = Math.round((grossEarnings + extraAdditions - totalStandardDeductions) * 100) / 100;

          // 5.5 Advance Salary Auto-Recovery
          const activeAdvances = await db.prepare(`SELECT * FROM hr_advances WHERE emp_id = ? AND status = 'approved' AND outstanding_balance > 0 ORDER BY created_at ASC`).all(emp.id);
          let advanceRecoveryTotal = 0;
          let recoveryDetails = [];

          if (activeAdvances && activeAdvances.length > 0 && netPayable > 0) {
            let availableForRecovery = netPayable; // We can recover up to their full net pay for MVP
            
            for (const adv of activeAdvances) {
              if (availableForRecovery <= 0) break;
              
              const deductionAmount = Math.min(adv.outstanding_balance, availableForRecovery);
              advanceRecoveryTotal += deductionAmount;
              availableForRecovery -= deductionAmount;
              
              recoveryDetails.push({
                advance_id: adv.id,
                amount_recovered: deductionAmount,
                original_balance: adv.outstanding_balance
              });
            }
          }

          const totalDeductions = Math.round((totalStandardDeductions + advanceRecoveryTotal) * 100) / 100;
          netPayable = Math.round((grossEarnings + extraAdditions - totalDeductions) * 100) / 100;

          // 6. Build immutable snapshot
          const snapshot = {
            salary_structure: { basic, da, hra, other_allowances: otherAllow, ot_rate: otRate },
            attendance_summary: { payableDays, presentDays, absentDays, woDays, hlDays, otHoursTotal, daysInMonth },
            earnings: { basic: earnBasic, da: earnDA, hra: earnHRA, other: earnOther, ot: earnOT },
            deductions: { pf: dedPF, esi: dedESI, pt: dedPT, extra: extraDeductions, advance_recovery: advanceRecoveryTotal },
            advance_recovery_details: recoveryDetails,
            additions: { extra: extraAdditions },
            adjustments
          };

          // 7. Insert payroll slip
          await db.prepare(`
            INSERT INTO hr_payroll_slips (payroll_run_id, emp_id, payable_days, ot_hours, gross_earnings, total_deductions, net_payable, snapshot_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(runId!, emp.id, payableDays, otHoursTotal, grossEarnings, totalDeductions, netPayable, JSON.stringify(snapshot));

          totalGross += grossEarnings;
          totalNet += netPayable;
        }

        // Update run totals
        await db.prepare(`
          UPDATE hr_payroll_runs SET total_gross = ?, total_net = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(Math.round(totalGross * 100) / 100, Math.round(totalNet * 100) / 100, runId!);
      });

      return NextResponse.json({ success: true, run_id: runId! });
    }

    // ACTION: Update payroll stage (Verify, Approve, Lock)
    if (action === 'update_stage') {
      const { run_id, new_stage, user_id } = data;
      const validStages = ['Draft', 'Verified', 'Approved', 'Locked'];
      if (!validStages.includes(new_stage)) {
        return NextResponse.json({ error: 'Invalid stage' }, { status: 400 });
      }

      const run = await db.prepare(`SELECT * FROM hr_payroll_runs WHERE id = ?`).get(run_id);
      if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
      if (run.stage === 'Locked') return NextResponse.json({ error: 'Cannot modify a locked payroll' }, { status: 400 });

      // Enforce stage progression order
      const stageOrder = ['Draft', 'Verified', 'Approved', 'Locked'];
      const currentIdx = stageOrder.indexOf(run.stage);
      const newIdx = stageOrder.indexOf(new_stage);
      if (newIdx <= currentIdx) {
        return NextResponse.json({ error: `Cannot move from ${run.stage} to ${new_stage}` }, { status: 400 });
      }

      const updateFields = new_stage === 'Locked'
        ? `stage = ?, locked_by = ?, updated_at = CURRENT_TIMESTAMP`
        : `stage = ?, updated_at = CURRENT_TIMESTAMP`;
      const updateParams = new_stage === 'Locked'
        ? [new_stage, user_id || 1, run_id]
        : [new_stage, run_id];

      await db.prepare(`UPDATE hr_payroll_runs SET ${updateFields} WHERE id = ?`).run(...updateParams);

      // Lock attendance records and execute advance deductions when payroll is locked
      if (new_stage === 'Locked') {
        await db.prepare(`
          UPDATE hr_attendance_daily SET is_locked = 1 
          WHERE date LIKE ? AND (emp_id IN (SELECT emp_id FROM hr_payroll_slips WHERE payroll_run_id = ?))
        `).run(`${run.month_year}-%`, run_id);

        // Execute Advance Deductions safely
        const slips = await db.prepare(`SELECT emp_id, snapshot_json FROM hr_payroll_slips WHERE payroll_run_id = ?`).all(run_id);
        for (const slip of slips) {
          const snapshot = JSON.parse(slip.snapshot_json || '{}');
          if (snapshot.advance_recovery_details && snapshot.advance_recovery_details.length > 0) {
            for (const rec of snapshot.advance_recovery_details) {
              // 1. Log deduction
              await db.prepare(`
                INSERT INTO hr_advance_deductions (advance_id, payroll_run_id, amount_deducted, timestamp)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
              `).run(rec.advance_id, run_id, rec.amount_recovered);

              // 2. Decrement balance and auto-complete if 0
              await db.prepare(`
                UPDATE hr_advances 
                SET outstanding_balance = outstanding_balance - ?,
                    status = CASE WHEN (outstanding_balance - ?) <= 0 THEN 'completed' ELSE status END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `).run(rec.amount_recovered, rec.amount_recovered, rec.advance_id);
            }
          }
        }
      }

      await logAudit({
        userId: user_id || 1,
        username: 'system',
        action: `payroll_stage_${new_stage.toLowerCase()}`,
        module: 'hr_payroll',
        recordId: run_id,
        description: `Payroll run ${run_id} moved to ${new_stage}`
      });

      return NextResponse.json({ success: true });
    }

    // ACTION: Add/remove deduction or addition
    if (action === 'add_adjustment') {
      const { emp_id, month_year, type, label, amount, is_deduction, remarks, created_by } = data;
      const res = await db.prepare(`
        INSERT INTO hr_deductions_additions (emp_id, month_year, type, label, amount, is_deduction, remarks, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(emp_id, month_year, type, label || type, amount, is_deduction ?? 1, remarks || null, created_by || 1);
      return NextResponse.json({ success: true, id: res.lastInsertRowid });
    }

    if (action === 'delete_adjustment') {
      const { adjustment_id } = data;
      await db.prepare(`DELETE FROM hr_deductions_additions WHERE id = ?`).run(adjustment_id);
      return NextResponse.json({ success: true });
    }

    // ACTION: Update salary structure
    if (action === 'update_salary_structure') {
      const { emp_id, basic_wage, da_wage, hra_wage, other_allowances, ot_rate_per_hour, pf_eligible, esi_eligible, pt_eligible } = data;
      await db.prepare(`
        INSERT INTO hr_salary_structures (emp_id, basic_wage, da_wage, hra_wage, other_allowances, ot_rate_per_hour, pf_eligible, esi_eligible, pt_eligible, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(emp_id) DO UPDATE SET
          basic_wage = excluded.basic_wage,
          da_wage = excluded.da_wage,
          hra_wage = excluded.hra_wage,
          other_allowances = excluded.other_allowances,
          ot_rate_per_hour = excluded.ot_rate_per_hour,
          pf_eligible = excluded.pf_eligible,
          esi_eligible = excluded.esi_eligible,
          pt_eligible = excluded.pt_eligible,
          updated_at = CURRENT_TIMESTAMP
      `).run(emp_id, basic_wage || 0, da_wage || 0, hra_wage || 0, other_allowances || 0, ot_rate_per_hour || 0, pf_eligible ?? 1, esi_eligible ?? 1, pt_eligible ?? 1);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Payroll API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
