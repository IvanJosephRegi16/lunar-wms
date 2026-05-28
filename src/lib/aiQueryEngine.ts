/**
 * AI Query Engine — Safe, parameterized ERP data fetcher.
 * Maps classified intents to read-only SQL queries.
 * NO destructive operations. Whitelisted tables only.
 */
import { getDb } from './db';
import type { ExtractedEntities, ConversationContext } from './aiIntentEngine';
import { formatDate, formatDateTime, formatNowIST, formatTodayHeader, getTodayIST } from './utils';

export interface QueryResult {
  type: 'table' | 'kpi' | 'text' | 'warning' | 'list' | 'empty';
  title: string;
  summary: string;
  rows?: any[];
  kpis?: { label: string; value: string | number; sub?: string; color?: string }[];
  hint?: string;
  intent?: string;
  /** Optional Gemini one-liner; never replaces numeric ERP data */
  narrative?: string;
}

export async function executeIntent(
  intent: string,
  entities: ExtractedEntities,
  context: ConversationContext
): Promise<QueryResult> {
  const db = getDb();
  const dateFilter = entities.dateRange === 'week'
    ? "date('now', '-7 days')"
    : entities.dateRange === 'month'
    ? "date('now', '-30 days')"
    : "date('now')";

  switch (intent) {

    case 'UPPERSTOCK_INVENTORY': {
      const code = entities.articleCode;
      const colour = entities.colour;
      let q = `
        SELECT 
          article_code, colour, size,
          SUM(opening_stock + inward_stock + machine_return_stock + semi_finished_stock - outward_stock) as total_qty
        FROM daily_stock
        WHERE 1=1
      `;
      const params: any[] = [];
      if (code) {
        q += ` AND UPPER(REPLACE(article_code,'-','')) = UPPER(REPLACE(?,'-',''))`;
        params.push(code);
      }
      if (colour) {
        q += ` AND UPPER(colour) LIKE ?`;
        params.push(`%${colour}%`);
      }
      q += ` GROUP BY article_code, colour, size HAVING total_qty > 0 ORDER BY total_qty DESC LIMIT 25`;
      
      const rows = await db.prepare(q).all(...params) as any[];
      if (!rows.length) {
        const detailStr = code ? ` for ${code}` + (colour ? ` (${colour})` : '') : '';
        return { 
          type: 'empty', 
          title: '🏢 Upperstock (General Warehouse) Inventory', 
          summary: `No stock recorded in outstock (general warehouse) daily stock ledger${detailStr}.` 
        };
      }
      return {
        type: 'table', intent,
        title: `🏢 Upperstock (General Warehouse) Inventory${code ? ' — ' + code : ''}`,
        summary: `Showing live stock balances in the outstock ledger.`,
        rows: rows.map(r => ({
          'Article': r.article_code,
          'Colour': r.colour,
          'Size': r.size,
          'Stock (pairs)': r.total_qty
        })),
        hint: 'This data is derived directly from your daily outstock ledger entries.'
      };
    }

    case 'LOW_STOCK': {
      const rows = await db.prepare(`
        SELECT article_code, colour, total_qty
        FROM inventory_pool
        WHERE total_qty < 100 AND is_deleted = 0
        ORDER BY total_qty ASC LIMIT 15
      `).all() as any[];
      if (!rows.length) return { type: 'empty', title: 'Low Stock Check', summary: '✅ All items are above the 100-pair safety threshold. No restocking needed right now.' };
      return {
        type: 'table', intent,
        title: `⚠️ Low Stock — ${rows.length} item(s) need attention`,
        summary: `${rows.length} article(s) are below the 100-pair safety threshold.`,
        rows: rows.map(r => ({ 'Article': r.article_code, 'Colour': r.colour, 'Stock (pairs)': r.total_qty })),
        hint: 'Tip: Navigate to Purchase Orders → Create PO to restock critical items.'
      };
    }

    case 'ARTICLE_LOOKUP': {
      const code = entities.articleCode;
      const colour = entities.colour;
      if (!code) return { type: 'text', title: 'Article Lookup', summary: '❓ Please specify an article code. Example: *"Show stock for JF4444"* or *"A229 blue"*.' };
      let q = `SELECT * FROM inventory_pool WHERE UPPER(REPLACE(article_code,'-','')) = UPPER(REPLACE(?,'-','')) AND is_deleted = 0`;
      const params: any[] = [code];
      if (colour) { q += ` AND UPPER(colour) LIKE ?`; params.push(`%${colour}%`); }
      const rows = await db.prepare(q).all(...params) as any[];
      if (!rows.length) {
        const colourTip = colour ? ` in colour ${colour}` : '';
        return { type: 'empty', title: `Article ${code}`, summary: `⚠️ No stock found for article **${code}**${colourTip}. It may not have been received yet.` };
      }
      return {
        type: 'table', intent,
        title: `📊 Stock for Article ${code}${colour ? ' — ' + colour : ''}`,
        summary: `${rows.length} variant(s) found.`,
        rows: rows.map(r => ({
          'Article': r.article_code, 'Colour': r.colour,
          'Total': r.total_qty,
          'Sz6': r.size_6||0, 'Sz7': r.size_7||0, 'Sz8': r.size_8||0,
          'Sz9': r.size_9||0, 'Sz10': r.size_10||0, 'Sz11': r.size_11||0, 'Sz12': r.size_12||0
        }))
      };
    }

    case 'SIZE_LOOKUP': {
      const size = entities.size;
      if (!size) {
        const rows = await db.prepare(`SELECT article_code, colour, size_6, size_7, size_8, size_9, size_10, size_11, size_12, total_qty FROM inventory_pool WHERE is_deleted = 0 ORDER BY total_qty DESC LIMIT 10`).all() as any[];
        return { type: 'table', intent, title: '📐 Inventory Size Breakdown', summary: 'Top 10 articles by total stock with size distribution.', rows: rows.map(r => ({ Article: r.article_code, Colour: r.colour, 'Sz6': r.size_6||0, 'Sz7': r.size_7||0, 'Sz8': r.size_8||0, 'Sz9': r.size_9||0, 'Sz10': r.size_10||0, 'Sz11': r.size_11||0, 'Sz12': r.size_12||0 })) };
      }
      const col = `size_${size}`;
      const rows = await db.prepare(`SELECT article_code, colour, ${col} as qty FROM inventory_pool WHERE is_deleted = 0 AND ${col} > 0 ORDER BY qty DESC LIMIT 15`).all() as any[];
      if (!rows.length) return { type: 'empty', title: `Size ${size} Stock`, summary: `ℹ️ No stock found for size ${size} across any article.` };
      return { type: 'table', intent, title: `📐 Size ${size} Stock`, summary: `${rows.length} article(s) have size ${size} in stock.`, rows: rows.map(r => ({ Article: r.article_code, Colour: r.colour, [`Size ${size} (pairs)`]: r.qty })) };
    }

    case 'SLOW_MOVING': {
      const rows = await db.prepare(`
        SELECT i.article_code, i.colour, i.total_qty,
          (SELECT COUNT(*) FROM scan_history s WHERE s.article_code = i.article_code AND s.is_deleted = 0) as scan_count
        FROM inventory_pool i WHERE i.is_deleted = 0 AND i.total_qty > 0
        ORDER BY scan_count ASC, i.total_qty DESC LIMIT 10
      `).all() as any[];
      if (!rows.length) return { type: 'empty', title: 'Slow Moving Stock', summary: 'ℹ️ No slow-moving items detected.' };
      return { type: 'table', intent, title: '🐢 Slow Moving Inventory', summary: `${rows.length} articles with low scan activity.`, rows: rows.map(r => ({ Article: r.article_code, Colour: r.colour, Stock: r.total_qty, 'Total Scans': r.scan_count })), hint: 'Items with stock but very few scans may be accumulating as dead stock.' };
    }

    case 'STOCK_PREDICTION': {
      const rows = await db.prepare(`
        SELECT i.article_code, i.colour, i.total_qty,
          (SELECT COUNT(*) FROM scan_history s WHERE s.article_code = i.article_code AND date(s.created_at) >= date('now','-30 days') AND s.is_deleted = 0) as scans_30d
        FROM inventory_pool i WHERE i.is_deleted = 0 AND i.total_qty > 0
      `).all() as any[];
      const predictions = rows.map((r: any) => {
        const dailyRate = (r.scans_30d || 0) / 30;
        const daysLeft = dailyRate > 0 ? Math.round(r.total_qty / dailyRate) : 999;
        return { ...r, dailyRate: Math.round(dailyRate * 10) / 10, daysLeft };
      }).filter((r: any) => r.daysLeft < 30).sort((a: any, b: any) => a.daysLeft - b.daysLeft).slice(0, 10);
      if (!predictions.length) return { type: 'empty', title: 'Stock Prediction', summary: '✅ No articles are predicted to run out within the next 30 days based on current scan velocity.' };
      return { type: 'table', intent, title: '🔮 Stock Depletion Forecast (next 30 days)', summary: `${predictions.length} article(s) at risk of running out.`, rows: predictions.map((r: any) => ({ Article: r.article_code, Colour: r.colour, 'Stock': r.total_qty, 'Daily Rate': r.dailyRate, 'Days Left': r.daysLeft === 999 ? '—' : r.daysLeft })), hint: 'Based on 30-day scan velocity. Create POs for items with < 7 days left.' };
    }

    case 'INVENTORY_SUMMARY': {
      const summary = await db.prepare(`SELECT COUNT(*) as articles, SUM(total_qty) as total_pairs FROM inventory_pool WHERE is_deleted = 0`).get() as any;
      const low = await db.prepare(`SELECT COUNT(*) as cnt FROM inventory_pool WHERE total_qty < 100 AND is_deleted = 0`).get() as any;
      return { type: 'kpi', intent, title: '📦 Inventory Summary', summary: 'Live snapshot of the inventory pool.', kpis: [{ label: 'Total Articles', value: summary?.articles || 0 }, { label: 'Total Pairs in Stock', value: Number(summary?.total_pairs || 0).toLocaleString('en-IN') }, { label: 'Low Stock Items', value: low?.cnt || 0, color: (low?.cnt || 0) > 0 ? '#dc2626' : '#16a34a' }] };
    }

    case 'CARTONS_TODAY': {
      const today = await db.prepare(`SELECT COUNT(*) as cnt FROM packed_cartons WHERE date(created_at) = date('now') AND is_deleted = 0`).get() as any;
      const total = today?.cnt ?? 0;
      if (total === 0) return { type: 'empty', title: 'Cartons Today', summary: 'ℹ️ No cartons packed today yet. Head to Carton Generation to start packing.' };
      return { type: 'kpi', intent, title: '📦 Cartons Packed Today', summary: `${total} carton(s) generated and sealed today.`, kpis: [{ label: 'Cartons Today', value: total }], hint: 'View full breakdown in Packed Inventory.' };
    }

    case 'CARTON_TOTAL': {
      const res = await db.prepare(`SELECT COUNT(*) as total FROM packed_cartons WHERE is_deleted = 0`).get() as any;
      const todayRes = await db.prepare(`SELECT COUNT(*) as today FROM packed_cartons WHERE date(created_at) = date('now') AND is_deleted = 0`).get() as any;
      return { type: 'kpi', intent, title: '📦 Carton Statistics', summary: 'All-time and today carton packing totals.', kpis: [{ label: 'Total Cartons (All Time)', value: res?.total || 0 }, { label: 'Cartons Today', value: todayRes?.today || 0 }] };
    }

    case 'CARTON_CONFIG': {
      const res = await db.prepare(`SELECT COUNT(*) as cnt FROM carton_generation WHERE is_deleted = 0`).get() as any;
      if (!res?.cnt) return { type: 'empty', title: 'Carton Configurations', summary: 'ℹ️ No carton configurations set up yet. Go to Carton Generation to configure packing rules.' };
      return { type: 'kpi', intent, title: '⚙️ Carton Configurations', summary: `${res.cnt} packing configuration(s) active in the system.`, kpis: [{ label: 'Active Configurations', value: res.cnt }], hint: 'Manage configurations in the Carton Generation module.' };
    }

    case 'PENDING_APPROVALS': {
      const rows = await db.prepare(`SELECT po_number, vendor, grand_total, created_at FROM purchase_orders WHERE status = 'pending_admin_approval' AND is_deleted = 0 ORDER BY id DESC LIMIT 10`).all() as any[];
      if (!rows.length) return { type: 'empty', title: 'Pending Approvals', summary: '✅ No purchase orders awaiting admin approval. Your queue is clear.' };
      return { type: 'table', intent, title: `⏳ ${rows.length} PO(s) Awaiting Approval`, summary: `${rows.length} purchase order(s) need your review.`, rows: rows.map(r => ({ 'PO Number': r.po_number, 'Vendor': r.vendor, 'Value': `₹${Number(r.grand_total||0).toLocaleString('en-IN')}`, 'Raised On': formatDate(r.created_at) })), hint: 'Navigate to PO → Pending Approval to review and approve.' };
    }

    case 'DELAYED_POS': {
      const rows = await db.prepare(`SELECT po_number, vendor, grand_total, created_at FROM purchase_orders WHERE status IN ('approved','pending_admin_approval') AND is_deleted = 0 AND date(created_at) < date('now', '-3 days') ORDER BY created_at ASC LIMIT 10`).all() as any[];
      if (!rows.length) return { type: 'empty', title: 'Delayed POs', summary: '✅ All purchase orders are within the standard 3-day lead time window.' };
      return { type: 'table', intent, title: `⚠️ ${rows.length} Delayed PO(s)`, summary: 'Purchase orders exceeding the 3-day lead time.', rows: rows.map(r => ({ 'PO Number': r.po_number, 'Vendor': r.vendor, 'Value': `₹${Number(r.grand_total||0).toLocaleString('en-IN')}`, 'Raised On': formatDate(r.created_at) })), hint: 'Use the Accountant email workflow to follow up with suppliers.' };
    }

    case 'PROCUREMENT_SUMMARY': {
      const s = await db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed, SUM(CASE WHEN status='pending_admin_approval' THEN 1 ELSE 0 END) as pending, SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) as approved, SUM(grand_total) as total_value FROM purchase_orders WHERE is_deleted = 0`).get() as any;
      if (!s?.total) return { type: 'empty', title: 'Procurement Summary', summary: 'ℹ️ No purchase orders in the system yet.' };
      return { type: 'kpi', intent, title: '📋 Procurement Summary', summary: 'Overall purchase order statistics.', kpis: [{ label: 'Total POs', value: s.total }, { label: 'Completed', value: s.completed, color: '#16a34a' }, { label: 'Approved', value: s.approved, color: '#2563eb' }, { label: 'Pending Approval', value: s.pending, color: s.pending > 0 ? '#dc2626' : '#64748b' }, { label: 'Total Value', value: `₹${Number(s.total_value||0).toLocaleString('en-IN')}` }] };
    }

    case 'APPROVED_PO_HISTORY': {
      const rows = await db.prepare(`
        SELECT po_number, vendor, grand_total, status, approved_at_date, approved_at_time 
        FROM purchase_orders 
        WHERE status IN ('accountant_processing', 'completed') AND is_deleted = 0 
        ORDER BY id DESC LIMIT 15
      `).all() as any[];
      if (!rows.length) return { type: 'empty', title: 'Approved PO History', summary: 'ℹ️ No approved purchase orders found in history yet.' };
      return {
        type: 'table', intent,
        title: '📁 Approved Purchase Order History',
        summary: `Showing the last ${rows.length} approved purchase orders, currently with accounting or completed.`,
        rows: rows.map(r => ({
          'PO Number': r.po_number,
          'Vendor': r.vendor,
          'Amount': `₹${Number(r.grand_total||0).toLocaleString('en-IN')}`,
          'Stage': r.status === 'completed' ? '🟢 Completed' : '🔵 Processing (Accountant)',
          'Approved On': r.approved_at_date ? `${r.approved_at_date} ${r.approved_at_time || ''}` : '—'
        })),
        hint: 'These orders have passed managerial review and are in active fulfillment or ledger completion stages.'
      };
    }

    case 'PAYMENT_PENDING': {
      const summary = await db.prepare(`
        SELECT 
          SUM(grand_total) as total_val, 
          SUM(amount_paid) as total_paid, 
          SUM(grand_total - amount_paid) as total_pending, 
          COUNT(CASE WHEN payment_status != 'paid' THEN 1 END) as pending_count
        FROM purchase_orders 
        WHERE status IN ('accountant_processing', 'completed') AND is_deleted = 0 AND payment_status != 'paid'
      `).get() as any;

      const list = await db.prepare(`
        SELECT po_number, vendor, grand_total, amount_paid, (grand_total - amount_paid) as pending_balance
        FROM purchase_orders 
        WHERE status IN ('accountant_processing', 'completed') AND is_deleted = 0 AND payment_status != 'paid'
        ORDER BY id DESC LIMIT 10
      `).all() as any[];

      if (!list.length || !summary || !summary.pending_count) {
        return { 
          type: 'empty', 
          title: 'Pending Payments Ledger', 
          summary: '🟢 Excellent! All active and historical purchase orders are fully paid. Zero outstanding liabilities.' 
        };
      }

      return {
        type: 'kpi', intent,
        title: '💸 Pending Payments Ledger',
        summary: `Outstanding liabilities for ${summary.pending_count} purchase order(s).`,
        kpis: [
          { label: 'Outstanding Balance', value: `₹${Number(summary.total_pending||0).toLocaleString('en-IN')}`, color: '#dc2626' },
          { label: 'Total Paid', value: `₹${Number(summary.total_paid||0).toLocaleString('en-IN')}`, color: '#16a34a' },
          { label: 'Pending POs', value: summary.pending_count }
        ],
        hint: `Top pending order: ${list[0].po_number} to ${list[0].vendor} has an outstanding balance of ₹${Number(list[0].pending_balance).toLocaleString('en-IN')}.`
      };
    }

    case 'PAYMENT_ALL_LIST': {
      const summary = await db.prepare(`
        SELECT 
          SUM(grand_total) as total_liabilities,
          SUM(amount_paid) as total_paid,
          SUM(grand_total - amount_paid) as total_pending,
          COUNT(*) as po_count 
        FROM purchase_orders 
        WHERE status IN ('accountant_processing', 'completed') AND is_deleted = 0
      `).get() as any;

      const list = await db.prepare(`
        SELECT po_number, vendor, payment_status, grand_total, amount_paid, (grand_total - amount_paid) as pending_balance
        FROM purchase_orders 
        WHERE status IN ('accountant_processing', 'completed') AND is_deleted = 0
        ORDER BY id DESC LIMIT 15
      `).all() as any[];

      if (!list.length) {
        return { type: 'empty', title: 'All Payments List', summary: 'No purchase orders found in the system yet.' };
      }

      return {
        type: 'table', intent,
        title: '💼 All Payments Ledger (Pending & Completed)',
        summary: `Showing recent payments. Total Liabilities: ₹${Number(summary.total_liabilities||0).toLocaleString('en-IN')}`,
        rows: list.map(r => ({
          'PO': r.po_number,
          'Vendor': r.vendor,
          'Status': r.payment_status === 'paid' ? '✅ Paid' : r.payment_status === 'partial' ? '⏳ Partial' : '🔴 Pending',
          'Total': `₹${Number(r.grand_total).toLocaleString('en-IN')}`,
          'Pending': `₹${Number(r.pending_balance).toLocaleString('en-IN')}`
        }))
      };
    }

    case 'PAYMENT_DONE_TODAY': {
      const todayStr = getTodayIST();

      const paidTodayAgg = await db
        .prepare(
          `
        SELECT 
          SUM(amount_paid) as total_paid, 
          COUNT(*) as po_count 
        FROM purchase_orders 
        WHERE is_deleted = 0 
        AND accountant_updated_at IS NOT NULL
        AND date(accountant_updated_at) = date(?)
        AND amount_paid > 0
      `
        )
        .get(todayStr) as any;

      const rows = await db
        .prepare(
          `
        SELECT po.po_number, po.vendor, po.grand_total, po.amount_paid, po.balance_amount, po.payment_status,
               po.accountant_updated_at, u.full_name AS accountant_name, u.username AS accountant_username
        FROM purchase_orders po
        LEFT JOIN users u ON po.accountant_updated_by = u.id
        WHERE po.is_deleted = 0
        AND po.accountant_updated_at IS NOT NULL
        AND date(po.accountant_updated_at) = date(?)
        AND po.amount_paid > 0
        ORDER BY po.accountant_updated_at DESC
        LIMIT 50
      `
        )
        .all(todayStr) as any[];

      const allPaid = await db
        .prepare(
          `
        SELECT 
          SUM(amount_paid) as total_paid,
          COUNT(*) as po_count
        FROM purchase_orders 
        WHERE is_deleted = 0 AND payment_status = 'paid'
      `
        )
        .get() as any;

      return {
        type: 'table',
        intent,
        title: '💰 Payments recorded today (IST)',
        summary: `**Today (${formatTodayHeader()}):** total **₹${Number(paidTodayAgg?.total_paid || 0).toLocaleString('en-IN')}** recorded across **${paidTodayAgg?.po_count || 0}** PO update(s) by accounting. All-time fully paid POs: **₹${Number(allPaid?.total_paid || 0).toLocaleString('en-IN')}** (${allPaid?.po_count || 0} POs).`,
        rows:
          rows.length > 0
            ? rows.map((r) => ({
                PO: r.po_number,
                Vendor: r.vendor,
                'Paid (₹)': Number(r.amount_paid || 0).toLocaleString('en-IN'),
                'Balance (₹)': Number(r.balance_amount ?? 0).toLocaleString('en-IN'),
                Status: r.payment_status,
                Accountant: r.accountant_name || r.accountant_username || '—',
                'Recorded (IST)': r.accountant_updated_at ? formatDateTime(r.accountant_updated_at) : '—',
              }))
            : undefined,
        kpis: [
          { label: 'Paid today (₹)', value: `₹${Number(paidTodayAgg?.total_paid || 0).toLocaleString('en-IN')}`, color: '#16a34a' },
          { label: 'PO updates today', value: paidTodayAgg?.po_count || 0 },
          { label: 'All-time paid POs (₹)', value: `₹${Number(allPaid?.total_paid || 0).toLocaleString('en-IN')}` },
        ],
        hint:
          rows.length === 0
            ? 'No accountant payment entries with **date(accountant_updated_at) = today** yet. Try a date range, or check PO → Accountant Processing.'
            : 'Amounts come from live **purchase_orders**; timestamps reflect when the accountant last saved payment data.',
      };
    }

    case 'PAYMENT_COMPLETED_RANGE': {
      const start = entities.paymentRangeStart;
      const end = entities.paymentRangeEnd;
      if (!start || !end) {
        return {
          type: 'text',
          intent,
          title: '💰 Payment date range',
          summary:
            'Please specify a range like **16/05/2026 to 18/05/2026** (dd/mm/yyyy). Example: *Show completed payments 16/05/2026 to 18/05/2026*.',
        };
      }

      const rows = await db
        .prepare(
          `
        SELECT po.po_number, po.vendor, po.grand_total, po.amount_paid, po.balance_amount, po.payment_status,
               po.accountant_updated_at, u.full_name AS accountant_name
        FROM purchase_orders po
        LEFT JOIN users u ON po.accountant_updated_by = u.id
        WHERE po.is_deleted = 0
        AND po.payment_status = 'paid'
        AND po.amount_paid > 0
        AND po.accountant_updated_at IS NOT NULL
        AND date(po.accountant_updated_at) BETWEEN date(?) AND date(?)
        ORDER BY po.accountant_updated_at DESC
        LIMIT 100
      `
        )
        .all(start, end) as any[];

      if (!rows.length) {
        return {
          type: 'empty',
          intent,
          title: `💰 Completed payments (${start} → ${end})`,
          summary:
            'No **fully paid** POs with accountant activity in that IST date window. Try widening the range or check partial payments under *Pending payments*.',
        };
      }

      const totalPaid = rows.reduce((s, r) => s + Number(r.amount_paid || 0), 0);

      return {
        type: 'table',
        intent,
        title: `💰 Completed payments (${start} → ${end} IST)`,
        summary: `**${rows.length}** fully paid PO(s). **Total paid (₹):** ${totalPaid.toLocaleString('en-IN')}. Listed by accountant save time in IST.`,
        rows: rows.map((r) => ({
          PO: r.po_number,
          Vendor: r.vendor,
          'Paid (₹)': Number(r.amount_paid || 0).toLocaleString('en-IN'),
          'Grand (₹)': Number(r.grand_total || 0).toLocaleString('en-IN'),
          Accountant: r.accountant_name || '—',
          'Recorded (IST)': formatDateTime(r.accountant_updated_at),
        })),
        hint: 'Only **payment_status = paid** rows are included. Use *All payments* for partial/unpaid.',
      };
    }

    case 'VENDOR_DELAY': {
      const rows = await db.prepare(`SELECT vendor_name, reliability_score, average_lead_time_hours, overall_grade FROM ai_vendor_scorecard ORDER BY reliability_score ASC LIMIT 5`).all() as any[];
      if (!rows.length) return { type: 'empty', title: 'Vendor Delays', summary: 'ℹ️ No vendor scorecard data yet. Complete PO workflows to generate vendor performance metrics.' };
      return { type: 'table', intent, title: '🕒 Vendor Delay Rankings (worst first)', summary: 'Vendors ranked by lowest reliability score.', rows: rows.map(r => ({ 'Vendor': r.vendor_name, 'Grade': r.overall_grade, 'Reliability': `${r.reliability_score}%`, 'Avg Lead Time': `${r.average_lead_time_hours}h` })) };
    }

    case 'TOP_VENDOR': {
      const v = await db.prepare(`SELECT vendor_name, reliability_score, overall_grade, average_lead_time_hours FROM ai_vendor_scorecard ORDER BY reliability_score DESC LIMIT 1`).get() as any;
      if (!v) return { type: 'empty', title: 'Top Vendor', summary: 'ℹ️ No vendor scorecard data yet.' };
      return { type: 'kpi', intent, title: '🥇 Top Performing Vendor', summary: `${v.vendor_name} leads with the highest reliability.`, kpis: [{ label: 'Vendor', value: v.vendor_name }, { label: 'Grade', value: v.overall_grade, color: '#16a34a' }, { label: 'Reliability', value: `${v.reliability_score}%` }, { label: 'Avg Lead Time', value: `${v.average_lead_time_hours}h` }], hint: 'Recommended for time-sensitive procurement orders.' };
    }

    case 'VENDOR_SCORECARD': {
      const rows = await db.prepare(`SELECT vendor_name, reliability_score, average_lead_time_hours, completion_efficiency, overall_grade FROM ai_vendor_scorecard ORDER BY reliability_score DESC`).all() as any[];
      if (!rows.length) return { type: 'empty', title: 'Vendor Scorecard', summary: 'ℹ️ No vendor scorecard data yet.' };
      return { type: 'table', intent, title: '📊 Vendor Scorecard', summary: `${rows.length} vendor(s) evaluated from PO history.`, rows: rows.map(r => ({ 'Vendor': r.vendor_name, 'Grade': r.overall_grade, 'Reliability': `${r.reliability_score}%`, 'Lead Time': `${r.average_lead_time_hours}h`, 'Completion': `${r.completion_efficiency}%` })) };
    }

    case 'SCAN_TODAY': {
      const res = await db.prepare(`SELECT COUNT(*) as cnt FROM scan_history WHERE date(created_at) = date('now') AND is_deleted = 0`).get() as any;
      const top = await db.prepare(`SELECT u.full_name, COUNT(s.id) as scans FROM scan_history s JOIN users u ON s.operator_id = u.id WHERE date(s.created_at) = date('now') AND s.is_deleted = 0 GROUP BY u.id ORDER BY scans DESC LIMIT 1`).get() as any;
      const total = res?.cnt ?? 0;
      if (total === 0) return { type: 'empty', title: 'Scan Activity Today', summary: 'ℹ️ No scans recorded today yet.' };
      return { type: 'kpi', intent, title: '📥 Today\'s Scan Activity', summary: `${total} inward scan(s) recorded today.`, kpis: [{ label: 'Total Scans Today', value: total }, ...(top ? [{ label: 'Top Operator', value: top.full_name, sub: `${top.scans} scans` }] : [])] };
    }

    case 'TOP_OPERATOR': {
      const rows = await db.prepare(`SELECT u.full_name, u.role, COUNT(s.id) as scans FROM scan_history s JOIN users u ON s.operator_id = u.id WHERE s.is_deleted = 0 GROUP BY u.id ORDER BY scans DESC LIMIT 5`).all() as any[];
      if (!rows.length) return { type: 'empty', title: 'Top Operators', summary: 'ℹ️ No operator scan data available yet.' };
      return { type: 'table', intent, title: '🏆 Top Scanning Operators', summary: 'Ranked by total scans (all time).', rows: rows.map((r, i) => ({ 'Rank': `#${i+1}`, 'Operator': r.full_name, 'Role': r.role, 'Total Scans': r.scans })) };
    }

    case 'OPERATOR_ACTIVITY': {
      const rows = await db.prepare(`SELECT u.full_name, COUNT(s.id) as scans, MAX(s.created_at) as last_scan FROM scan_history s JOIN users u ON s.operator_id = u.id WHERE date(s.created_at) >= ${dateFilter} AND s.is_deleted = 0 GROUP BY u.id ORDER BY scans DESC`).all() as any[];
      if (!rows.length) return { type: 'empty', title: 'Operator Activity', summary: 'ℹ️ No operator activity in the selected period.' };
      return { type: 'table', intent, title: '👷 Operator Scan Activity', summary: `${rows.length} operator(s) active in period.`, rows: rows.map(r => ({ 'Operator': r.full_name, 'Scans': r.scans, 'Last Scan': formatDateTime(r.last_scan) })) };
    }

    case 'OUTWARD_TODAY': {
      const res = await db.prepare(`SELECT COUNT(*) as txns, SUM(quantity) as qty FROM outward_transactions WHERE is_deleted = 0 AND date(created_at) = date('now')`).get() as any;
      if (!res?.txns) return { type: 'empty', title: 'Outward Today', summary: 'ℹ️ No outward dispatches recorded today.' };
      return { type: 'kpi', intent, title: '🚚 Today\'s Outward Activity', summary: `${res.txns} dispatch transaction(s) today.`, kpis: [{ label: 'Transactions', value: res.txns }, { label: 'Pairs Dispatched', value: Number(res.qty||0).toLocaleString('en-IN') }] };
    }

    case 'INWARD_TODAY': {
      const res = await db.prepare(`SELECT COUNT(*) as txns, SUM(quantity) as qty FROM inward_inventory_transactions WHERE date(created_at) = date('now')`).get() as any;
      if (!res?.txns) return { type: 'empty', title: 'Inward Today', summary: 'ℹ️ No inward receipts recorded today.' };
      return { type: 'kpi', intent, title: '📥 Today\'s Inward Activity', summary: `${res.txns} receipt transaction(s) today.`, kpis: [{ label: 'Transactions', value: res.txns }, { label: 'Pairs Received', value: Number(res.qty||0).toLocaleString('en-IN') }] };
    }

    case 'ARTICLE_MOVEMENT': {
      // "Sales" or "Movement" means outward dispatch. We sum outward_stock from daily_stock for accurate historical sales.
      const rows = await db.prepare(`
        SELECT article_code, colour, SUM(outward_stock) as total_sales 
        FROM daily_stock 
        WHERE outward_stock > 0 
        GROUP BY article_code, colour 
        ORDER BY total_sales DESC 
        LIMIT 10
      `).all() as any[];
      
      if (!rows.length) return { type: 'empty', title: 'Article Sales & Movement', summary: 'ℹ️ No sales or dispatch data found in the outward ledger.' };
      return { 
        type: 'table', 
        intent, 
        title: '📈 Highest Selling Articles (All Time)', 
        summary: `Top ${rows.length} bestselling articles based on verified outward dispatches.`, 
        rows: rows.map((r, i) => ({ 
          'Rank': `#${i+1}`, 
          'Article': r.article_code, 
          'Colour': r.colour, 
          'Total Sold (pairs)': r.total_sales 
        })) 
      };
    }

    case 'DAILY_SUMMARY': {
      const [scans, cartons, pos, inward] = await Promise.all([
        db.prepare(`SELECT COUNT(*) as cnt FROM scan_history WHERE date(created_at) = date('now') AND is_deleted = 0`).get() as Promise<any>,
        db.prepare(`SELECT COUNT(*) as cnt FROM packed_cartons WHERE date(created_at) = date('now') AND is_deleted = 0`).get() as Promise<any>,
        db.prepare(`SELECT COUNT(*) as cnt FROM purchase_orders WHERE status = 'pending_admin_approval' AND is_deleted = 0`).get() as Promise<any>,
        db.prepare(`SELECT COUNT(*) as cnt FROM inward_inventory_transactions WHERE date(created_at) = date('now')`).get() as Promise<any>,
      ]);
      return { type: 'kpi', intent, title: `📅 Daily Operations Summary — ${formatTodayHeader()}`, summary: `Live snapshot for today in IST (Mumbai). Current time: ${formatNowIST()}.`, kpis: [{ label: 'Inward Scans', value: (scans as any)?.cnt ?? 0 }, { label: 'Cartons Packed', value: (cartons as any)?.cnt ?? 0 }, { label: 'Inward Receipts', value: (inward as any)?.cnt ?? 0 }, { label: 'POs Pending Approval', value: (pos as any)?.cnt ?? 0, color: (pos as any)?.cnt > 0 ? '#dc2626' : '#16a34a' }] };
    }

    case 'CURRENT_DATETIME': {
      return {
        type: 'text',
        intent,
        title: '🕐 Mumbai · Indian Standard Time (IST)',
        summary: formatNowIST(),
        hint: 'All ERP timestamps use Asia/Kolkata (UTC+5:30).',
      };
    }

    case 'ANOMALY_CHECK': {
      const rows = await db.prepare(`SELECT severity, module, description, anomaly_score, created_at FROM ai_anomaly_alerts ORDER BY id DESC LIMIT 10`).all() as any[];
      if (!rows.length) return { type: 'empty', title: 'Anomaly Alerts', summary: '✅ No anomalies detected in recent operations.' };
      return { type: 'table', intent, title: `🚨 ${rows.length} Anomaly Alert(s)`, summary: 'Recent operational anomalies detected by the AI scanner.', rows: rows.map(r => ({ 'Severity': r.severity, 'Module': r.module, 'Description': r.description, 'Score': `${Math.round(r.anomaly_score * 100)}%` })) };
    }

    case 'VSTRAP_SUMMARY': {
      const res = await db.prepare(`SELECT COUNT(*) as entries, SUM(quantity) as qty FROM v_strap WHERE is_deleted = 0`).get() as any;
      if (!res?.entries) return { type: 'empty', title: 'V-Strap Summary', summary: 'ℹ️ No V-Strap entries found.' };
      return { type: 'kpi', intent, title: '🩴 V-Strap Summary', summary: 'V-Strap inventory totals.', kpis: [{ label: 'Total Entries', value: res.entries }, { label: 'Total Units', value: Number(res.qty||0).toLocaleString('en-IN') }] };
    }

    case 'HELP':
      return {
        type: 'text', intent,
        title: "🧠 LUNAR'S CHAT BOT — Capabilities",
        summary: `**📦 Inventory**\n• "Show upperstock inventory" • "Show low stock" • "Stock for JF4444 blue" • "Size 8 inventory" • "Slow moving articles" • "Predict which articles run out"\n\n**💰 Payments & accountant**\n• "How much payment completed today" • "Payment done today" • "Pending payments" • "Completed payments **16/05/2026 to 18/05/2026**" (dd/mm/yyyy range)\n\n**📋 Purchase Orders**\n• "Pending approvals" • "Delayed POs" • "Procurement summary" • "Approved PO history" • "All payments"\n\n**📦 Cartons**\n• "Cartons today" • "Total cartons" • "Carton configs"\n\n**📥 Inward / Outward**\n• "Inward today" • "Outward today" • "Scan activity today"\n\n**🏭 Vendors**\n• "Top vendor" • "Which vendor delayed most?" • "Vendor scorecard"\n\n**👷 Operators**\n• "Top operator" • "Operator activity this week"\n\n**📅 General**\n• "Daily summary" • "Anomaly check" • "What time is it?" (IST / Mumbai)`
      };

    case 'SMALLTALK': {
      const isPookie = entities.articleCode?.toLowerCase() === 'pookie' || context.lastIntent === 'pookie' || false;
      return {
        type: 'text', intent,
        title: "✨ Lunar's AI Engine",
        summary: `Hello there! I am Lunar's ERP Chat Bot, powered by our live intelligence engine. I am here to assist you with operations, inventory, vendors, and payments. Ask me anything, and I'll fetch the real-time data for you!`
      };
    }

    case 'CLARIFY':
      return { type: 'text', intent: 'CLARIFY', title: 'Clarification Needed', summary: '' };

    default:
      return { type: 'text', intent: 'UNKNOWN', title: 'Not Understood', summary: `🤔 I couldn't match that to a specific ERP query.\n\nTry: *"Show low stock"*, *"Pending approvals"*, *"Cartons today"*, *"Top vendor"*, or type **"help"** for a full list.` };
  }
}
