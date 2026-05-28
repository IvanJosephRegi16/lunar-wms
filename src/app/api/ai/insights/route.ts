import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { AIEngine } from '@/lib/aiEngine';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const db = getDb();

    // ── 1. Live inventory pool ─────────────────────────────────────────────
    const inventorySummary = await db.prepare(`
      SELECT COUNT(*) as total_articles, SUM(total_qty) as total_pairs
      FROM inventory_pool WHERE is_deleted = 0
    `).get() as any;

    const lowStockItems = await db.prepare(`
      SELECT article_code, colour, total_qty
      FROM inventory_pool
      WHERE total_qty < 50 AND is_deleted = 0
      ORDER BY total_qty ASC LIMIT 10
    `).all() as any[];

    // ── 2. Live purchase order stats ───────────────────────────────────────
    const poStats = await db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'pending_admin_approval' THEN 1 ELSE 0 END) as pending_approval,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(COALESCE(grand_total, 0)) as total_value
      FROM purchase_orders WHERE is_deleted = 0
    `).get() as any;

    // ── 3. Live carton & packing stats ────────────────────────────────────
    const cartonsToday = await db.prepare(`
      SELECT COUNT(*) as cnt FROM packed_cartons
      WHERE date(created_at) = date('now') AND is_deleted = 0
    `).get() as any;

    const cartonsTotal = await db.prepare(`
      SELECT COUNT(*) as cnt FROM packed_cartons WHERE is_deleted = 0
    `).get() as any;

    // ── 4. Scan activity today ─────────────────────────────────────────────
    const scanActivityToday = await db.prepare(`
      SELECT COUNT(*) as cnt FROM scan_history
      WHERE date(created_at) = date('now') AND is_deleted = 0
    `).get() as any;

    const topOperatorToday = await db.prepare(`
      SELECT u.full_name, COUNT(s.id) as scans
      FROM scan_history s
      JOIN users u ON s.operator_id = u.id
      WHERE date(s.created_at) = date('now') AND s.is_deleted = 0
      GROUP BY u.id ORDER BY scans DESC LIMIT 1
    `).get() as any;

    // ── 5. Inward & outward today ─────────────────────────────────────────
    const inwardToday = await db.prepare(`
      SELECT COUNT(*) as txns, COALESCE(SUM(quantity), 0) as qty
      FROM inward_inventory_transactions WHERE date(created_at) = date('now')
    `).get() as any;

    const outwardToday = await db.prepare(`
      SELECT COUNT(*) as txns, COALESCE(SUM(total_pairs), 0) as qty
      FROM outward_transactions WHERE is_deleted = 0 AND date(created_at) = date('now')
    `).get() as any;

    // ── 6. Vendor scorecards (real data) ──────────────────────────────────
    const vendorScorecards = await AIEngine.compileVendorScorecards();

    // ── 7. Delayed POs (approved but > 3 days old) ────────────────────────
    const delayedPOs = await db.prepare(`
      SELECT po_number, vendor, grand_total, created_at
      FROM purchase_orders
      WHERE status = 'approved' AND is_deleted = 0
        AND date(created_at) < date('now', '-3 days')
      ORDER BY created_at ASC LIMIT 5
    `).all() as any[];

    // ── 8. Warehouse efficiency score ─────────────────────────────────────
    const inCount = (inwardToday?.txns || 1);
    const outCount = (outwardToday?.txns || 0);
    const efficiencyScore = inCount > 0
      ? Math.min(100, Math.round((outCount / inCount) * 100))
      : 0;

    // ── 9. V-Strap summary ────────────────────────────────────────────────
    const vstrapSummary = await db.prepare(`
      SELECT COUNT(*) as entries, COALESCE(SUM(closing_stock), 0) as total_qty
      FROM v_strap WHERE is_deleted = 0
    `).get() as any;

    const articleRows = await db.prepare(`
      SELECT DISTINCT article_code FROM inventory_pool WHERE is_deleted = 0
      UNION
      SELECT DISTINCT article_code FROM daily_stock
      UNION
      SELECT DISTINCT article_code FROM inward_outward WHERE is_deleted = 0
    `).all() as { article_code: string }[];
    const uniqueArticles = articleRows.map(r => r.article_code).filter(Boolean);

    return NextResponse.json({
      success: true,
      uniqueArticles,
      inventorySummary: {
        total_articles: inventorySummary?.total_articles || 0,
        total_pairs: inventorySummary?.total_pairs || 0,
      },
      lowStockItems,
      poStats: {
        total: poStats?.total || 0,
        completed: poStats?.completed || 0,
        pending_approval: poStats?.pending_approval || 0,
        approved: poStats?.approved || 0,
        rejected: poStats?.rejected || 0,
        total_value: poStats?.total_value || 0,
      },
      cartonsToday: cartonsToday?.cnt || 0,
      cartonsTotal: cartonsTotal?.cnt || 0,
      scanActivityToday: scanActivityToday?.cnt || 0,
      topOperatorToday: topOperatorToday || null,
      inwardToday: { txns: inwardToday?.txns || 0, qty: inwardToday?.qty || 0 },
      outwardToday: { txns: outwardToday?.txns || 0, qty: outwardToday?.qty || 0 },
      vendorScorecards,
      delayedPOs,
      efficiencyScore,
      vstrapSummary: {
        entries: vstrapSummary?.entries || 0,
        total_qty: vstrapSummary?.total_qty || 0,
      },
    });

  } catch (err: any) {
    console.error('[AI INSIGHTS ERROR]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
