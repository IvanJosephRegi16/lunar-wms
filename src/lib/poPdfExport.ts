/**
 * poPdfExport.ts
 * Ultra-premium, Fortune-500-grade PDF generator for Purchase Order History.
 * Uses jsPDF + jspdf-autotable only.
 * This file is ONLY used by the PO History export — it does NOT affect any other module.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Brand Palette ───────────────────────────────────────────────────────────
const NAVY       = [15,  23,  42]  as [number, number, number]; // #0f172a
const NAVY_MID   = [30,  58,  95]  as [number, number, number]; // #1e3a5f
const BLUE_ACC   = [37,  99,  235] as [number, number, number]; // #2563eb
const GOLD       = [245, 158, 11]  as [number, number, number]; // #f59e0b
const GREEN      = [22,  163, 74]  as [number, number, number]; // #16a34a
const RED_SOFT   = [220, 38,  38]  as [number, number, number]; // #dc2626
const WHITE      = [255, 255, 255] as [number, number, number];
const GRAY_LIGHT = [241, 245, 249] as [number, number, number]; // #f1f5f9
const GRAY_MID   = [100, 116, 139] as [number, number, number]; // #64748b
const GRAY_DARK  = [30,  41,  59]  as [number, number, number]; // #1e293b

// ─── Status colour lookup ─────────────────────────────────────────────────────
const statusColor = (status: string): [number, number, number] => {
  if (status === 'completed')              return GREEN;
  if (status === 'supervisor_review')      return BLUE_ACC;
  if (status === 'accountant_processing')  return GOLD;
  if (status?.includes('reject'))          return RED_SOFT;
  if (status?.includes('return'))          return RED_SOFT;
  return GRAY_MID;
};

const statusLabel = (status: string): string => {
  const map: Record<string, string> = {
    draft:                   'DRAFT',
    pending_admin_approval:  'PENDING APPROVAL',
    returned_for_edit:       'RETURNED',
    rejected:                'REJECTED',
    accountant_processing:   'ACCOUNTANT PROCESSING',
    supervisor_review:       'STORE REVIEW',
    completed:               'COMPLETED',
  };
  return map[status] ?? status.replace(/_/g, ' ').toUpperCase();
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function setFill(doc: jsPDF, rgb: [number, number, number]) { doc.setFillColor(...rgb); }
function setDraw(doc: jsPDF, rgb: [number, number, number]) { doc.setDrawColor(...rgb); }
function setFont(doc: jsPDF, rgb: [number, number, number], size: number, style: 'normal' | 'bold' | 'italic' = 'normal') {
  doc.setTextColor(...rgb);
  doc.setFontSize(size);
  doc.setFont('helvetica', style);
}

function rupee(n: number | string): string {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(v)) return '₹0.00';
  return `INR ${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function qty(n: number | string, unit = ''): string {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(v)) return '0';
  return `${v.toLocaleString('en-IN')}${unit ? ' ' + unit : ''}`;
}

function nowIST(): string {
  return new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
}

// ─── KPI Card helper ─────────────────────────────────────────────────────────
function kpiCard(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  label: string, value: string,
  accent: [number, number, number],
  bgOverride?: [number, number, number]
) {
  // Card background
  setFill(doc, bgOverride ?? WHITE);
  setDraw(doc, [226, 232, 240]);
  doc.roundedRect(x, y, w, h, 3, 3, 'FD');

  // Accent left bar
  setFill(doc, accent);
  doc.rect(x, y, 3, h, 'F');

  // Label
  setFont(doc, GRAY_MID, 7, 'bold');
  doc.text(label.toUpperCase(), x + 7, y + 8);

  // Value
  setFont(doc, GRAY_DARK, 9, 'bold');
  const lines = doc.splitTextToSize(value, w - 10);
  doc.text(lines[0] ?? value, x + 7, y + 16);
}

// ─── MAIN EXPORT FUNCTION ────────────────────────────────────────────────────
export function exportPOHistoryPDF(po: any) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();   // 297
  const H = doc.internal.pageSize.getHeight();  // 210

  const items: any[] = po.items || [];

  // ── PAGE 1: COVER / SUMMARY ──────────────────────────────────────────────

  // Full-width navy header banner
  setFill(doc, NAVY);
  doc.rect(0, 0, W, 42, 'F');

  // Navy-mid diagonal accent strip
  setFill(doc, NAVY_MID);
  doc.triangle(0, 0, 80, 0, 0, 42, 'F');

  // Gold decorative line at bottom of banner
  setFill(doc, GOLD);
  doc.rect(0, 42, W, 1.5, 'F');

  // Company name
  setFont(doc, WHITE, 20, 'bold');
  doc.text('VIKING RUBBERS', 14, 18);

  // Tagline
  setFont(doc, [180, 200, 230], 8, 'normal');
  doc.text('Enterprise Procurement Management System', 14, 25);

  // Document title (right side)
  setFont(doc, WHITE, 14, 'bold');
  doc.text('PURCHASE ORDER REPORT', W - 14, 18, { align: 'right' });

  setFont(doc, GOLD, 9, 'bold');
  doc.text(po.po_number || '—', W - 14, 26, { align: 'right' });

  // Status badge (right side of banner)
  const sCol = statusColor(po.status);
  setFill(doc, sCol);
  const stLabel = statusLabel(po.status);
  const badgeW = doc.getTextWidth(stLabel) + 10;
  doc.roundedRect(W - 14 - badgeW, 29, badgeW, 9, 2, 2, 'F');
  setFont(doc, WHITE, 7, 'bold');
  doc.text(stLabel, W - 14 - badgeW / 2, 34.5, { align: 'center' });

  // ── KPI CARDS ROW ──────────────────────────────────────────────────────
  const cardY = 50;
  const cardH = 26;
  const gap   = 5;
  const colW  = (W - 28 - gap * 5) / 6;

  const grandTotal  = Number(po.grand_total  || 0);
  const netAmount   = Number(po.net_amount   || 0);
  const grossAmount = Number(po.gross_amount || 0);
  const discount    = Number(po.discount_percent || 0);
  const transport   = Number(po.transport_charge || 0);

  const kpis = [
    { label: 'Vendor / Supplier',    value: po.vendor || '—',                           accent: BLUE_ACC },
    { label: 'PO Date',              value: po.po_date || po.created_at?.slice(0,10) || '—', accent: NAVY_MID },
    { label: 'Grand Total',          value: rupee(grandTotal),                            accent: GREEN    },
    { label: 'Net Amount',           value: rupee(netAmount),                             accent: GOLD     },
    { label: 'Payment Status',       value: (po.payment_status || 'unpaid').toUpperCase(), accent: po.payment_status === 'paid' ? GREEN : RED_SOFT },
    { label: 'Total Line Items',     value: `${items.length} Items`,                      accent: BLUE_ACC },
  ];

  kpis.forEach((kpi, i) => {
    kpiCard(doc, 14 + i * (colW + gap), cardY, colW, cardH, kpi.label, kpi.value, kpi.accent);
  });

  // ── FINANCIALS SUMMARY BAR ───────────────────────────────────────────────
  const finY = cardY + cardH + 8;
  setFill(doc, GRAY_LIGHT);
  setDraw(doc, [226, 232, 240]);
  doc.roundedRect(14, finY, W - 28, 14, 2, 2, 'FD');

  const finItems = [
    { label: 'Gross Amount',      value: rupee(grossAmount) },
    { label: `Discount (${discount}%)`, value: `- ${rupee(grossAmount * discount / 100)}` },
    { label: 'Transport Charge',  value: rupee(transport) },
    { label: 'Grand Total',       value: rupee(grandTotal) },
  ];

  const finColW = (W - 28) / finItems.length;
  finItems.forEach((f, i) => {
    const fx = 14 + i * finColW + finColW / 2;
    setFont(doc, GRAY_MID, 6.5, 'bold');
    doc.text(f.label, fx, finY + 5, { align: 'center' });
    setFont(doc, GRAY_DARK, 8, 'bold');
    doc.text(f.value, fx, finY + 11, { align: 'center' });
    if (i < finItems.length - 1) {
      setDraw(doc, [203, 213, 225]);
      doc.line(14 + (i + 1) * finColW, finY + 2, 14 + (i + 1) * finColW, finY + 12);
    }
  });

  // ── TERMS SECTION ─────────────────────────────────────────────────────────
  let curY = finY + 22;

  const hasTerms = po.terms_delivery || po.terms_payment || po.terms_pan_gst;
  if (hasTerms) {
    setFont(doc, NAVY, 9, 'bold');
    doc.text('TERMS & CONDITIONS', 14, curY);
    setFill(doc, GOLD);
    doc.rect(14, curY + 1.5, 40, 0.8, 'F');
    curY += 7;

    const termItems = [
      po.terms_delivery && { label: 'Delivery', value: po.terms_delivery },
      po.terms_payment  && { label: 'Payment',  value: po.terms_payment  },
      po.terms_pan_gst  && { label: 'PAN / GST', value: po.terms_pan_gst },
      po.terms_validity && { label: 'Validity',  value: po.terms_validity },
    ].filter(Boolean) as { label: string; value: string }[];

    const tColW = (W - 28) / Math.min(termItems.length, 4);
    termItems.slice(0, 4).forEach((t, i) => {
      setFont(doc, GRAY_MID, 6.5, 'bold');
      doc.text(t.label.toUpperCase(), 14 + i * tColW, curY);
      setFont(doc, GRAY_DARK, 7.5, 'normal');
      const lines = doc.splitTextToSize(t.value, tColW - 4);
      doc.text(lines.slice(0, 2), 14 + i * tColW, curY + 6);
    });
    curY += 18;
  }

  // ── MATERIALS TABLE HEADING ───────────────────────────────────────────────
  setFont(doc, NAVY, 9, 'bold');
  doc.text('MATERIAL DETAILS', 14, curY);
  setFill(doc, BLUE_ACC);
  doc.rect(14, curY + 1.5, 38, 0.8, 'F');
  curY += 7;

  // Unique rows only (remove exact duplicates)
  const seen = new Set<string>();
  const uniqueItems = items.filter(item => {
    const key = [
      item.material_code, item.material_name, item.size_thickness,
      item.required_qty,  item.order_rate,    item.unit,
      item.category
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const tableHeaders = [
    ['#', 'Category', 'Material Code', 'Material Name', 'Size / Thickness', 'Unit', 'Req Qty', 'Recd Qty', 'Pending', 'Rate (₹)', 'Amount (₹)']
  ];

  const tableRows = uniqueItems.map((item, idx) => {
    const req  = Number(item.required_qty  || 0);
    const recd = Number(item.received_qty  || 0);
    const pend = Math.max(0, req - recd);
    return [
      String(idx + 1),
      item.category        || '—',
      item.material_code   || '—',
      item.material_name   || '—',
      item.size_thickness  || '—',
      item.unit            || '—',
      qty(req),
      qty(recd),
      qty(pend),
      Number(item.order_rate || 0).toFixed(2),
      Number(item.amount     || 0).toFixed(2),
    ];
  });

  autoTable(doc, {
    head: tableHeaders,
    body: tableRows,
    startY: curY,
    margin: { left: 14, right: 14 },
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 4, bottom: 4, left: 5, right: 5 },
      font: 'helvetica',
      textColor: GRAY_DARK,
      lineColor: [226, 232, 240],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: NAVY,
      textColor: WHITE,
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: { top: 5, bottom: 5, left: 5, right: 5 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0:  { halign: 'center', cellWidth: 8 },
      1:  { cellWidth: 24 },
      2:  { cellWidth: 22 },
      3:  { cellWidth: 'auto' },
      4:  { cellWidth: 24 },
      5:  { halign: 'center', cellWidth: 14 },
      6:  { halign: 'right',  cellWidth: 16 },
      7:  { halign: 'right',  cellWidth: 16 },
      8:  { halign: 'right',  cellWidth: 16 },
      9:  { halign: 'right',  cellWidth: 20 },
      10: { halign: 'right',  cellWidth: 24, fontStyle: 'bold' },
    },
    didDrawCell: (data: any) => {
      // Colour the Pending Qty column red if > 0
      if (data.section === 'body' && data.column.index === 8) {
        const raw = tableRows[data.row.index]?.[8];
        if (raw && parseFloat(raw) > 0) {
          doc.setTextColor(...RED_SOFT);
          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'bold');
          doc.text(raw, data.cell.x + data.cell.width - 5, data.cell.y + 8, { align: 'right' });
        }
      }
    },
  });

  // ── FOOTER ON EVERY PAGE ─────────────────────────────────────────────────
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let pg = 1; pg <= pageCount; pg++) {
    doc.setPage(pg);
    // footer divider
    setFill(doc, NAVY);
    doc.rect(0, H - 12, W, 12, 'F');
    setFont(doc, [148, 163, 184], 6.5, 'normal');
    doc.text('VIKING RUBBERS | Procurement Management System | CONFIDENTIAL', 14, H - 5.5);
    doc.text(`Generated: ${nowIST()}  |  Page ${pg} of ${pageCount}`, W - 14, H - 5.5, { align: 'right' });
  }

  doc.save(`PO_${po.po_number}_Report_${new Date().toISOString().slice(0,10)}.pdf`);
}
