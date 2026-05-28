import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // 1. PO Strict Financial & Count Metrics
  const poFinance = await db.prepare(`
    SELECT 
      COUNT(id) as total_po_count,
      COALESCE(SUM(grand_total), 0) as total_procurement_capital,
      COALESCE(SUM(amount_paid), 0) as total_paid,
      COALESCE(SUM(balance_amount), 0) as total_outstanding,
      COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_count,
      COUNT(CASE WHEN status = 'pending_admin_approval' THEN 1 END) as pending_approval_count,
      COUNT(CASE WHEN status = 'returned_for_edit' THEN 1 END) as returned_count,
      COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
      COUNT(CASE WHEN status = 'accountant_processing' THEN 1 END) as active_po_count,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_po_count
    FROM purchase_orders
    WHERE is_deleted = 0
  `).get() as any;

  // 2. Strict status-wise capital sum
  const statusCapital = await db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN status = 'pending_admin_approval' THEN grand_total ELSE 0 END), 0) as pending_approval_capital,
      COALESCE(SUM(CASE WHEN status = 'returned_for_edit' THEN grand_total ELSE 0 END), 0) as returned_capital,
      COALESCE(SUM(CASE WHEN status = 'rejected' THEN grand_total ELSE 0 END), 0) as rejected_capital
    FROM purchase_orders
    WHERE is_deleted = 0
  `).get() as any;

  // 3. Materials Hub and Vendor Hub totals
  const materialsCount = await db.prepare(`SELECT COUNT(*) as count FROM materials`).get() as { count: number };
  const vendorsCount = await db.prepare(`SELECT COUNT(*) as count FROM vendors`).get() as { count: number };

  // 4. Highly Purchase PO (Highest value Purchase Order in history)
  const highlyPurchasePO = await db.prepare(`
    SELECT po_number, vendor, grand_total, po_date, status
    FROM purchase_orders
    WHERE is_deleted = 0 AND grand_total > 0
    ORDER BY grand_total DESC
    LIMIT 1
  `).get() as any;

  // 5. Date-to-Date Monthly Spend (Graph A - cumulative day-by-day spend for current active month)
  // Let's identify the latest month with active POs in the system first to ensure robust plotting.
  const latestMonthRow = await db.prepare(`
    SELECT SUBSTR(po_date, 1, 7) as active_month
    FROM purchase_orders
    WHERE is_deleted = 0 AND po_date IS NOT NULL AND po_date != '' AND status != 'draft' AND status != 'rejected'
    ORDER BY po_date DESC
    LIMIT 1
  `).get() as { active_month: string } | undefined;

  const targetMonth = latestMonthRow?.active_month || new Date().toISOString().substring(0, 7);

  const rawDailySpendInMonth = await db.prepare(`
    SELECT po_date as date, SUM(grand_total) as day_total
    FROM purchase_orders
    WHERE is_deleted = 0 AND SUBSTR(po_date, 1, 7) = ? AND status != 'draft' AND status != 'rejected'
    GROUP BY po_date
    ORDER BY po_date ASC
  `).all(targetMonth) as { date: string; day_total: number }[];

  // Convert to cumulative date-to-date values
  let runningCumulative = 0;
  const dateToDateSpend = rawDailySpendInMonth.map(item => {
    runningCumulative += item.day_total;
    return {
      date: item.date,
      day_total: item.day_total,
      cumulative: runningCumulative
    };
  });

  // 6. Top ordered materials by quantity & spend (Graph B)
  const topOrderedMaterials = await db.prepare(`
    SELECT 
      material_code, 
      material_name, 
      SUM(required_qty) as total_qty, 
      SUM(amount) as total_spend
    FROM purchase_order_items
    GROUP BY material_code, material_name
    ORDER BY total_spend DESC
    LIMIT 5
  `).all();

  // 7. Vendor Settlement Index & Satisfaction Order Fulfillment (Graph C)
  const spendByVendor = await db.prepare(`
    SELECT 
      vendor, 
      COUNT(id) as po_count,
      COALESCE(SUM(grand_total), 0) as total_spend,
      COALESCE(SUM(amount_paid), 0) as total_paid,
      COALESCE(SUM(balance_amount), 0) as total_outstanding,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count
    FROM purchase_orders
    WHERE is_deleted = 0 AND status != 'draft' AND grand_total > 0
    GROUP BY vendor
    ORDER BY total_spend DESC
    LIMIT 5
  `).all() as any[];

  // Calculate MNC Satisfaction score and settlement percentage
  const vendorsSatisfaction = spendByVendor.map(v => {
    const total = Number(v.total_spend) || 1;
    const paid = Number(v.total_paid) || 0;
    const settlement_index = Math.round((paid / total) * 100);
    const completion_rate = Math.round((v.completed_count / v.po_count) * 100);
    // MNC satisfaction is calculated as a composite index of prompt payout + fulfillment completion
    const satisfaction_score = Math.min(100, Math.round(settlement_index * 0.6 + completion_rate * 0.4));
    
    return {
      vendor: v.vendor,
      po_count: v.po_count,
      total_spend: v.total_spend,
      total_paid: v.total_paid,
      total_outstanding: v.total_outstanding,
      settlement_index,
      completion_rate,
      satisfaction_score
    };
  });

  // 8. Monthly Spend Trend (Over active months for Graph A legend context)
  const monthlySpendTrend = await db.prepare(`
    SELECT 
      SUBSTR(po_date, 1, 7) as month,
      COALESCE(SUM(grand_total), 0) as total_spend
    FROM purchase_orders
    WHERE is_deleted = 0 AND status != 'draft' AND status != 'rejected' AND po_date IS NOT NULL AND po_date != ''
    GROUP BY month
    ORDER BY month ASC
    LIMIT 6
  `).all();

  // 9. Timeline cashflows comparing Paid vs Pending vs Unpaid over the last 7 active days (Graph D)
  const dailyCashflows = await db.prepare(`
    SELECT 
      po_date as date, 
      COALESCE(SUM(amount_paid), 0) as spend,
      COALESCE(SUM(balance_amount), 0) as pending,
      COALESCE(SUM(CASE WHEN amount_paid = 0 THEN grand_total ELSE 0 END), 0) as unpaid
    FROM purchase_orders
    WHERE is_deleted = 0 AND po_date IS NOT NULL AND po_date != '' AND status != 'draft'
    GROUP BY po_date
    ORDER BY po_date DESC
    LIMIT 7
  `).all();

  // 10. Direct Drafts, Pending, Returned, Rejected lists for stage navigator counts
  const poDrafts = await db.prepare(`SELECT id FROM purchase_orders WHERE status = 'draft' AND is_deleted = 0`).all();
  const poPending = await db.prepare(`SELECT id FROM purchase_orders WHERE status = 'pending_admin_approval' AND is_deleted = 0`).all();
  const poReturned = await db.prepare(`SELECT id FROM purchase_orders WHERE status = 'returned_for_edit' AND is_deleted = 0`).all();
  const poRejected = await db.prepare(`SELECT id FROM purchase_orders WHERE status = 'rejected' AND is_deleted = 0`).all();
  const poProcessing = await db.prepare(`SELECT id FROM purchase_orders WHERE status = 'accountant_processing' AND is_deleted = 0`).all();
  const poCompleted = await db.prepare(`SELECT id FROM purchase_orders WHERE status = 'completed' AND is_deleted = 0`).all();

  // --- GENERAL WAREHOUSE METRICS (Added Back) ---
  const rawTotals = await db.prepare(`
    SELECT 
      SUM(opening_stock + inward_stock + machine_return_stock + semi_finished_stock - outward_stock) as warehouse_total,
      SUM(CASE WHEN sheet_date = CURRENT_DATE::text THEN inward_stock + machine_return_stock + semi_finished_stock ELSE 0 END) as today_production,
      SUM(CASE WHEN sheet_date = CURRENT_DATE::text THEN outward_stock ELSE 0 END) as today_dispatch
    FROM daily_stock
  `).get() as { warehouse_total: number; today_production: number; today_dispatch: number } | undefined;

  const vStrapRaw = await db.prepare(`
    SELECT SUM(opening_stock + inward_qty - outward_qty) as balance FROM v_strap
  `).get() as { balance: number } | undefined;

  // Staging loose stock pool sum
  let stagingPoolTotal = 0;
  let stagingPoolSizes: Record<string, number> = { '5': 0, '6': 0, '7': 0, '8': 0, '9': 0, '10': 0, '11': 0, '12': 0 };
  try {
    const poolRaw = await db.prepare(`
      SELECT 
        SUM(size_5) as sz5, SUM(size_6) as sz6, SUM(size_7) as sz7, SUM(size_8) as sz8,
        SUM(size_9) as sz9, SUM(size_10) as sz10, SUM(size_11) as sz11, SUM(size_12) as sz12
      FROM inventory_pool
      WHERE is_deleted = 0
    `).get() as any;
    if (poolRaw) {
      stagingPoolSizes = {
        '5': poolRaw.sz5 || 0, '6': poolRaw.sz6 || 0, '7': poolRaw.sz7 || 0, '8': poolRaw.sz8 || 0,
        '9': poolRaw.sz9 || 0, '10': poolRaw.sz10 || 0, '11': poolRaw.sz11 || 0, '12': poolRaw.sz12 || 0
      };
      stagingPoolTotal = Object.values(stagingPoolSizes).reduce((a, b) => a + b, 0);
    }
  } catch (e) {
    console.warn('Inventory pool table does not exist or has schema mismatches');
  }

  // Packed cartons today
  let packedCartonsToday = 0;
  let packedSizesToday: Record<string, number> = { '5': 0, '6': 0, '7': 0, '8': 0, '9': 0, '10': 0, '11': 0, '12': 0 };
  try {
    const cartonsCount = await db.prepare(`SELECT COUNT(*) as cnt FROM packed_cartons WHERE created_at::date = CURRENT_DATE`).get() as { cnt: number } | undefined;
    packedCartonsToday = Number(cartonsCount?.cnt) || 0;

    const sizesRaw = await db.prepare(`
      SELECT oi.size, SUM(oi.total_quantity) as total_qty
      FROM outward_transactions ot
      JOIN outward_items oi ON ot.id = oi.transaction_id
      WHERE ot.created_at::date = CURRENT_DATE
      GROUP BY oi.size
    `).all() as { size: string | number; total_qty: number }[];

    sizesRaw.forEach(row => {
      const szStr = String(row.size);
      if (szStr in packedSizesToday) packedSizesToday[szStr] = row.total_qty || 0;
    });
  } catch (e) {
    console.warn('Packed cartons table not yet fully active.');
  }

  // Scan history counts
  let scansToday = 0;
  try {
    const scansCount = await db.prepare(`SELECT COUNT(*) as cnt FROM scan_history WHERE created_at::date = CURRENT_DATE`).get() as { cnt: number } | undefined;
    scansToday = Number(scansCount?.cnt) || 0;
  } catch (e) {
    console.warn('Scan history table not yet active');
  }

  const totals = {
    warehouse_total: rawTotals?.warehouse_total || 0,
    today_production: rawTotals?.today_production || 0,
    today_dispatch: rawTotals?.today_dispatch || 0,
    vstrap_balance: vStrapRaw?.balance || 0,
    staging_pool_total: stagingPoolTotal,
    packed_cartons_today: packedCartonsToday,
    scans_today: scansToday
  };

  const topArticles = await db.prepare(`
    SELECT article_code, SUM(opening_stock + inward_stock + machine_return_stock + semi_finished_stock - outward_stock) as total_qty
    FROM daily_stock
    GROUP BY article_code
    ORDER BY total_qty DESC
    LIMIT 5
  `).all();

  const sizeDistribution = await db.prepare(`
    SELECT size, SUM(opening_stock + inward_stock + machine_return_stock + semi_finished_stock - outward_stock) as total_qty
    FROM daily_stock
    GROUP BY size
    ORDER BY CAST(size AS INTEGER) ASC
  `).all();

  const stagingPoolDistribution = Object.entries(stagingPoolSizes).map(([size, total_qty]) => ({ size, total_qty }));
  const packedDistributionToday = Object.entries(packedSizesToday).map(([size, total_qty]) => ({ size, total_qty }));

  let activeRulesDistribution: any[] = [];
  try {
    activeRulesDistribution = await db.prepare(`
      SELECT cg.name as rule_name, COUNT(*) as carton_count
      FROM packed_cartons pc
      JOIN outward_transactions ot ON pc.transaction_id = ot.id
      JOIN carton_generation cg ON ot.config_id = cg.id
      WHERE pc.created_at::date = CURRENT_DATE
      GROUP BY cg.name
      ORDER BY carton_count DESC
      LIMIT 5
    `).all();
  } catch (e) {
    console.warn('Active packaging rule query failed');
  }

  const recentActivityRaw = await db.prepare(`
    SELECT 
      sheet_date, article_code, colour,
      (inward_stock + machine_return_stock + semi_finished_stock) as qty_in,
      outward_stock as qty_out,
      CASE WHEN (inward_stock + machine_return_stock + semi_finished_stock) > 0 THEN 'Inward' ELSE 'Outward' END as type
    FROM daily_stock
    WHERE (inward_stock + machine_return_stock + semi_finished_stock) > 0 OR outward_stock > 0
    ORDER BY id DESC
    LIMIT 6
  `).all();

  const recentActivity = recentActivityRaw.map((a: any) => ({
     ...a,
     qty: a.type === 'Inward' ? a.qty_in : -a.qty_out
  }));

  let recentCartons: any[] = [];
  try {
    const cartonsRaw = await db.prepare(`
      SELECT 
        pc.created_at as sheet_date, pc.carton_id as article_code, 'Completed' as colour, cg.name as type, ot.total_pairs as qty
      FROM packed_cartons pc
      JOIN outward_transactions ot ON pc.transaction_id = ot.id
      JOIN carton_generation cg ON ot.config_id = cg.id
      ORDER BY pc.id DESC
      LIMIT 3
    `).all();
    recentCartons = cartonsRaw.map((c: any) => ({
      sheet_date: c.sheet_date, article_code: c.article_code, colour: 'IST Dispatched', qty: -c.qty, type: 'Outward Carton'
    }));
  } catch (e) {}

  let materialWarnings: any[] = [];
  try {
    materialWarnings = await db.prepare(`
      SELECT 
        mi.id, mi.material_name, mi.colour, mi.current_stock, mi.min_stock_level, mi.warning_threshold,
        mu.abbreviation as unit_abbr
      FROM mat_inventory mi
      LEFT JOIN mat_units mu ON mi.unit_id = mu.id
      WHERE mi.is_deleted = 0 
        AND (
          (mi.min_stock_level > 0 AND mi.current_stock <= mi.min_stock_level) 
          OR 
          (mi.warning_threshold > 0 AND mi.current_stock <= mi.warning_threshold)
        )
    `).all();
  } catch (e) {
    console.warn('Material inventory table not yet fully active.');
  }

  return NextResponse.json({
    poFinance: {
      total_procurement_capital: poFinance?.total_procurement_capital || 0,
      total_paid: poFinance?.total_paid || 0,
      total_outstanding: poFinance?.total_outstanding || 0,
      total_po_count: poFinance?.total_po_count || 0,
      draft_count: poFinance?.draft_count || 0,
      pending_approval_count: poFinance?.pending_approval_count || 0,
      returned_count: poFinance?.returned_count || 0,
      rejected_count: poFinance?.rejected_count || 0,
      active_po_count: poFinance?.active_po_count || 0,
      completed_po_count: poFinance?.completed_po_count || 0,
      pending_approval_capital: statusCapital?.pending_approval_capital || 0,
      returned_capital: statusCapital?.returned_capital || 0,
      rejected_capital: statusCapital?.rejected_capital || 0
    },
    materialsCount: materialsCount?.count || 0,
    vendorsCount: vendorsCount?.count || 0,
    highlyPurchasePO,
    targetMonth,
    dateToDateSpend,
    topOrderedMaterials,
    vendorsSatisfaction,
    monthlySpendTrend,
    dailyCashflows: dailyCashflows.reverse(), // chronologically ordered for plotting
    stageCounts: {
      drafts: poDrafts.length,
      pending: poPending.length,
      returned: poReturned.length,
      rejected: poRejected.length,
      processing: poProcessing.length,
      completed: poCompleted.length
    },
    totals,
    topArticles,
    sizeDistribution,
    stagingPoolDistribution,
    packedDistributionToday,
    activeRulesDistribution,
    recentActivity: [...recentCartons, ...recentActivity].slice(0, 8),
    materialWarnings
  });
}
