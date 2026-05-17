import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  if (user.role === 'accountant') {
    // 1. PO Financial Metrics
    const poMetrics = await db.prepare(`
      SELECT 
        COUNT(CASE WHEN status = 'accountant_processing' THEN 1 END) as active_po_count,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_po_count,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN grand_total ELSE 0 END), 0) as total_completed_spend,
        COALESCE(SUM(CASE WHEN status = 'accountant_processing' THEN grand_total ELSE 0 END), 0) as total_active_spend,
        COALESCE(SUM(amount_paid), 0) as total_paid,
        COALESCE(SUM(balance_amount), 0) as total_outstanding
      FROM purchase_orders
      WHERE status IN ('accountant_processing', 'completed') AND is_deleted = 0
    `).get() as any;

    // 2. Spend by Vendor (top 5)
    const spendByVendor = await db.prepare(`
      SELECT 
        vendor, 
        COALESCE(SUM(grand_total), 0) as total_spend,
        COUNT(id) as po_count
      FROM purchase_orders
      WHERE status IN ('accountant_processing', 'completed') AND is_deleted = 0
      GROUP BY vendor
      ORDER BY total_spend DESC
      LIMIT 5
    `).all();

    // 3. Last 10 POs for the Spend Trend Bezier Curve Chart
    const poTrend = await db.prepare(`
      SELECT po_number as label, grand_total as value
      FROM purchase_orders
      WHERE status IN ('accountant_processing', 'completed') AND is_deleted = 0
      ORDER BY id ASC
      LIMIT 10
    `).all();

    // 4. Recent PO Activity Feed (last 8)
    const recentPos = await db.prepare(`
      SELECT 
        po_number, vendor, status, grand_total, amount_paid, balance_amount, 
        approved_timestamp, po_date, payment_status, delivery_status
      FROM purchase_orders
      WHERE status IN ('accountant_processing', 'completed') AND is_deleted = 0
      ORDER BY id DESC
      LIMIT 8
    `).all();

    return NextResponse.json({
      role: 'accountant',
      poTotals: {
        active_po_count: poMetrics?.active_po_count || 0,
        completed_po_count: poMetrics?.completed_po_count || 0,
        total_completed_spend: poMetrics?.total_completed_spend || 0,
        total_active_spend: poMetrics?.total_active_spend || 0,
        total_paid: poMetrics?.total_paid || 0,
        total_outstanding: poMetrics?.total_outstanding || 0
      },
      spendByVendor,
      poTrend,
      recentPos
    });
  }
  
  // 1. Core Totals
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
        '5': poolRaw.sz5 || 0,
        '6': poolRaw.sz6 || 0,
        '7': poolRaw.sz7 || 0,
        '8': poolRaw.sz8 || 0,
        '9': poolRaw.sz9 || 0,
        '10': poolRaw.sz10 || 0,
        '11': poolRaw.sz11 || 0,
        '12': poolRaw.sz12 || 0
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
    const cartonsCount = await db.prepare(`
      SELECT COUNT(*) as cnt 
      FROM packed_cartons 
      WHERE created_at::date = CURRENT_DATE
    `).get() as { cnt: number } | undefined;
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
      if (szStr in packedSizesToday) {
        packedSizesToday[szStr] = row.total_qty || 0;
      }
    });
  } catch (e) {
    console.warn('Packed cartons table not yet fully active.');
  }

  // Scan history counts
  let scansToday = 0;
  try {
    const scansCount = await db.prepare(`
      SELECT COUNT(*) as cnt 
      FROM scan_history 
      WHERE created_at::date = CURRENT_DATE
    `).get() as { cnt: number } | undefined;
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

  // 2. Top 5 Articles
  const topArticles = await db.prepare(`
    SELECT article_code, SUM(opening_stock + inward_stock + machine_return_stock + semi_finished_stock - outward_stock) as total_qty
    FROM daily_stock
    GROUP BY article_code
    ORDER BY total_qty DESC
    LIMIT 5
  `).all();

  // 3. Size Distribution
  const sizeDistribution = await db.prepare(`
    SELECT size, SUM(opening_stock + inward_stock + machine_return_stock + semi_finished_stock - outward_stock) as total_qty
    FROM daily_stock
    GROUP BY size
    ORDER BY CAST(size AS INTEGER) ASC
  `).all();

  // 4. Staging Pool Distribution by Size
  const stagingPoolDistribution = Object.entries(stagingPoolSizes).map(([size, total_qty]) => ({
    size,
    total_qty
  }));

  // 5. Packed Pairs Distribution Today by Size
  const packedDistributionToday = Object.entries(packedSizesToday).map(([size, total_qty]) => ({
    size,
    total_qty
  }));

  // 6. Active packaging rules distribution (Top 5 rules generating cartons today)
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

  // 7. Consolidated Recent Activity Ledger (Stock movements + live dispatches)
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

  // Append recent carton dispatches if active
  let recentCartons: any[] = [];
  try {
    const cartonsRaw = await db.prepare(`
      SELECT 
        pc.created_at as sheet_date, 
        pc.carton_id as article_code, 
        'Completed' as colour, 
        cg.name as type,
        ot.total_pairs as qty
      FROM packed_cartons pc
      JOIN outward_transactions ot ON pc.transaction_id = ot.id
      JOIN carton_generation cg ON ot.config_id = cg.id
      ORDER BY pc.id DESC
      LIMIT 3
    `).all();
    recentCartons = cartonsRaw.map((c: any) => ({
      sheet_date: c.sheet_date,
      article_code: c.article_code,
      colour: 'IST Dispatched',
      qty: -c.qty,
      type: 'Outward Carton'
    }));
  } catch (e) {}

  return NextResponse.json({ 
    totals, 
    topArticles, 
    sizeDistribution, 
    stagingPoolDistribution,
    packedDistributionToday,
    activeRulesDistribution,
    recentActivity: [...recentCartons, ...recentActivity].slice(0, 8) // Unified feed
  });
}
