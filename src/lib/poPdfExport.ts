/**
 * poPdfExport.ts
 * Ultra-premium, Fortune-500-grade PDF generator for Purchase Order History.
 * Uses jsPDF + jspdf-autotable only.
 * This file is ONLY used by the PO History export — it does NOT affect any other module.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Brand Palette ────────────────────────────────────────────────────────────
const RED_MAIN    = [185, 28,  28]  as [number, number, number]; // #b91c1c deep red
const RED_SOFT    = [220, 38,  38]  as [number, number, number]; // #dc2626 bright red
const RED_LIGHT   = [254, 226, 226] as [number, number, number]; // #fee2e2 light red tint
const WHITE       = [255, 255, 255] as [number, number, number];
const OFF_WHITE   = [255, 245, 245] as [number, number, number]; // warm white
const GRAY_LIGHT  = [241, 245, 249] as [number, number, number]; // #f1f5f9
const GRAY_MID    = [100, 116, 139] as [number, number, number]; // #64748b
const GRAY_DARK   = [30,  41,  59]  as [number, number, number]; // #1e293b
const GOLD        = [245, 158, 11]  as [number, number, number]; // #f59e0b
const GREEN       = [22,  163, 74]  as [number, number, number]; // #16a34a

// ─── Async image loader ───────────────────────────────────────────────────────
const fetchImageAsBase64 = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
};

// ─── Status colour lookup ─────────────────────────────────────────────────────
const statusColor = (status: string): [number, number, number] => {
  if (status === 'completed')              return GREEN;
  if (status === 'supervisor_review')      return GRAY_MID;
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

// ─── KPI Card helper ──────────────────────────────────────────────────────────
function kpiCard(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  label: string, value: string,
  accent: [number, number, number]
) {
  // Card background with subtle red tint
  setFill(doc, OFF_WHITE);
  setDraw(doc, RED_LIGHT);
  doc.roundedRect(x, y, w, h, 3, 3, 'FD');

  // Accent top bar
  setFill(doc, accent);
  doc.roundedRect(x, y, w, 3, 1.5, 1.5, 'F');
  // Fix bottom corners of top bar
  doc.rect(x, y + 1.5, w, 1.5, 'F');

  // Label
  setFont(doc, GRAY_MID, 6.5, 'bold');
  doc.text(label.toUpperCase(), x + 6, y + 10);

  // Value
  setFont(doc, GRAY_DARK, 9, 'bold');
  const lines = doc.splitTextToSize(value, w - 10);
  doc.text(lines[0] ?? value, x + 6, y + 19);
}

// ─── MAIN EXPORT FUNCTION ────────────────────────────────────────────────────
export async function exportPOHistoryPDF(po: any, userRole?: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();   // 297
  const H = doc.internal.pageSize.getHeight();  // 210

  const items: any[] = po.items || [];

  // ══════════════════════════════════════════════════════════════════════════
  // HEADER BANNER — Ultra-professional Red & White geometric design
  // ══════════════════════════════════════════════════════════════════════════

  const BANNER_H = 48;

  // 1. Base deep-red background
  setFill(doc, RED_MAIN);
  doc.rect(0, 0, W, BANNER_H, 'F');

  // 2. Brighter red left wedge (depth layer)
  setFill(doc, RED_SOFT);
  doc.triangle(0, 0, 110, 0, 0, BANNER_H, 'F');

  // 3. Dark inner left triangular shadow
  setFill(doc, [150, 20, 20]);
  doc.triangle(0, 0, 60, 0, 0, BANNER_H, 'F');

  // 4. White diagonal slash — the signature design element
  setFill(doc, WHITE);
  doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
  doc.triangle(75, 0, 130, 0, 55, BANNER_H, 'F');

  // 5. Another lighter slash for depth
  doc.setGState(new (doc as any).GState({ opacity: 0.05 }));
  doc.triangle(115, 0, 165, 0, 95, BANNER_H, 'F');

  // 6. White circle orbs (top-right decorative)
  doc.setGState(new (doc as any).GState({ opacity: 0.06 }));
  doc.circle(W - 20, -10, 42, 'F');
  doc.circle(W - 55, 5, 22, 'F');

  // 7. Small accent dots pattern (right side)
  doc.setGState(new (doc as any).GState({ opacity: 0.12 }));
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      doc.circle(W - 110 + col * 12, 6 + row * 10, 1.5, 'F');
    }
  }

  doc.setGState(new (doc as any).GState({ opacity: 1.0 }));

  // 8. Gold accent line at bottom of banner
  setFill(doc, GOLD);
  doc.rect(0, BANNER_H, W, 1.2, 'F');

  // 9. Second thin white line above gold for elegance
  setFill(doc, WHITE);
  doc.setGState(new (doc as any).GState({ opacity: 0.3 }));
  doc.rect(0, BANNER_H - 1, W, 0.5, 'F');
  doc.setGState(new (doc as any).GState({ opacity: 1.0 }));

  // ── LOGO ──────────────────────────────────────────────────────────────────
  const logoBase64 = await fetchImageAsBase64('/lunars-logo.png');
  if (logoBase64) {
    // White circular badge behind logo
    setFill(doc, WHITE);
    doc.setGState(new (doc as any).GState({ opacity: 0.12 }));
    doc.circle(27, BANNER_H / 2, 17, 'F');
    doc.setGState(new (doc as any).GState({ opacity: 1.0 }));
    doc.addImage(logoBase64, 'PNG', 12, 8, 28, 28);
  }

  // ── COMPANY NAME & ADDRESS ─────────────────────────────────────────────────
  setFont(doc, WHITE, 18, 'bold');
  doc.text('VIKING RUBBERS PVT. LTD.', 46, 20);

  // Thin white underline below company name
  setFill(doc, WHITE);
  doc.setGState(new (doc as any).GState({ opacity: 0.25 }));
  doc.rect(46, 22, 110, 0.4, 'F');
  doc.setGState(new (doc as any).GState({ opacity: 1.0 }));

  setFont(doc, [255, 210, 210], 7.5, 'normal');
  doc.text('37/8, Nethajipuram, Velanthavalam Road, K.G.Chavadi, Coimbatore - 641 105', 46, 29);
  doc.text('Phone: 0422 2656271/331  |  Fax: 0422-2656271  |  E-Mail: vikingcbe@lunars.com', 46, 35);

  // ── DOCUMENT TITLE (RIGHT SIDE) ───────────────────────────────────────────
  setFont(doc, WHITE, 13, 'bold');
  doc.text('PURCHASE ORDER REPORT', W - 16, 18, { align: 'right' });

  setFont(doc, GOLD, 9, 'bold');
  doc.text(po.po_number || '—', W - 16, 27, { align: 'right' });

  // Status badge
  const sCol = statusColor(po.status);
  setFill(doc, sCol);
  const stLabel = statusLabel(po.status);
  doc.setFontSize(7);
  const badgeW = doc.getTextWidth(stLabel) + 12;
  doc.roundedRect(W - 16 - badgeW, 30, badgeW, 9, 2, 2, 'F');
  setFont(doc, WHITE, 7, 'bold');
  doc.text(stLabel, W - 16 - badgeW / 2, 35.5, { align: 'center' });

  // ══════════════════════════════════════════════════════════════════════════
  // KPI SUMMARY CARDS
  // ══════════════════════════════════════════════════════════════════════════

  const cardY = BANNER_H + 7;
  const cardH = 24;
  const gap   = 5;
  const colW  = 62;

  const kpis = [
    { label: 'Vendor / Supplier', value: po.vendor || '—',                               accent: RED_MAIN },
    { label: 'PO Date',           value: po.po_date || po.created_at?.slice(0, 10) || '—', accent: RED_SOFT },
    { label: 'Total Line Items',  value: `${items.length} Items`,                          accent: RED_MAIN },
  ];

  kpis.forEach((kpi, i) => {
    kpiCard(doc, 14 + i * (colW + gap), cardY, colW, cardH, kpi.label, kpi.value, kpi.accent);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TERMS SECTION (if any)
  // ══════════════════════════════════════════════════════════════════════════

  let curY = cardY + cardH + 8;

  const hasTerms = po.terms_delivery || po.terms_payment || po.terms_pan_gst;
  if (hasTerms) {
    // Small red section label
    setFont(doc, RED_MAIN, 8, 'bold');
    doc.text('TERMS & CONDITIONS', 14, curY);
    setFill(doc, RED_SOFT);
    doc.rect(14, curY + 1.2, 44, 0.7, 'F');
    curY += 6;

    const termItems = [
      po.terms_delivery && { label: 'Delivery', value: po.terms_delivery },
      po.terms_payment  && { label: 'Payment',  value: po.terms_payment  },
      po.terms_pan_gst  && { label: 'PAN / GST', value: po.terms_pan_gst },
      po.terms_validity && { label: 'Validity',  value: po.terms_validity },
    ].filter(Boolean) as { label: string; value: string }[];

    const tColW = (W - 28) / Math.min(termItems.length, 4);
    termItems.slice(0, 4).forEach((t, i) => {
      setFont(doc, GRAY_MID, 6, 'bold');
      doc.text(t.label.toUpperCase(), 14 + i * tColW, curY);
      setFont(doc, GRAY_DARK, 7, 'normal');
      const lines = doc.splitTextToSize(t.value, tColW - 4);
      doc.text(lines.slice(0, 2), 14 + i * tColW, curY + 5);
    });
    curY += 16;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MATERIALS TABLE
  // ══════════════════════════════════════════════════════════════════════════

  // Section heading
  setFont(doc, RED_MAIN, 9, 'bold');
  doc.text('MATERIAL DETAILS', 14, curY);
  setFill(doc, RED_SOFT);
  doc.rect(14, curY + 1.5, 40, 0.8, 'F');
  curY += 7;

  // De-duplicate rows
  const seen = new Set<string>();
  const uniqueItems = items.filter(item => {
    const key = [
      item.material_code, item.material_name, item.size_thickness,
      item.required_qty,  item.order_rate,    item.unit, item.category
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const isPM = userRole === 'pm';

  const tableHeaders = [[
    '#', 'Category', 'Material Code', 'Material Name',
    'Size / Thickness', 'Current Stock', 'Unit', 'Req Qty',
    ...(isPM ? [] : ['Recd Qty', 'Pending']),
    'Rate (INR)',
  ]];

  const tableRows = uniqueItems.map((item, idx) => {
    const req  = Number(item.required_qty || 0);
    const recd = Number(item.received_qty || 0);
    const pend = Math.max(0, req - recd);

    let cStock = '—';
    if (item.current_stock !== undefined && item.current_stock !== null && item.current_stock !== '') {
      const cUnit = item.current_stock_unit === 'Custom' ? item.custom_current_stock_unit : item.current_stock_unit;
      cStock = qty(item.current_stock, cUnit);
    }

    const baseRow = [
      String(idx + 1),
      item.category       || '—',
      item.material_code  || '—',
      item.material_name  || '—',
      item.size_thickness || '—',
      cStock,
      item.unit           || '—',
      qty(req),
    ];

    const qtyRow  = isPM ? [] : [qty(recd), qty(pend)];
    const rateRow = [Number(item.order_rate || 0).toFixed(2)];

    return [...baseRow, ...qtyRow, ...rateRow];
  });

  autoTable(doc, {
    head: tableHeaders,
    body: tableRows,
    startY: curY,
    margin: { left: 14, right: 14 },
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
      font: 'helvetica',
      textColor: GRAY_DARK,
      lineColor: [253, 220, 220],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: RED_MAIN,
      textColor: WHITE,
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: { top: 4.5, bottom: 4.5, left: 4, right: 4 },
    },
    alternateRowStyles: {
      fillColor: [255, 248, 248], // very light red tint rows
    },
    columnStyles: (() => {
      const s: any = {
        0: { halign: 'center', cellWidth: 8 },
        1: { cellWidth: 26 },
        2: { cellWidth: 26 },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 28 },
        5: { halign: 'right',  cellWidth: 24 },
        6: { halign: 'center', cellWidth: 16 },
        7: { halign: 'right',  cellWidth: 18 },
      };
      let n = 8;
      if (!isPM) {
        s[n++] = { halign: 'right', cellWidth: 18 };
        s[n++] = { halign: 'right', cellWidth: 18 };
      }
      s[n] = { halign: 'right', cellWidth: 24, fontStyle: 'bold' };
      return s;
    })(),
    didDrawCell: (data: any) => {
      const pendColIdx = isPM ? -1 : 9;
      if (!isPM && data.section === 'body' && data.column.index === pendColIdx) {
        const raw = tableRows[data.row.index]?.[pendColIdx];
        if (raw && parseFloat(raw) > 0) {
          doc.setTextColor(...RED_SOFT);
          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'bold');
          doc.text(raw, data.cell.x + data.cell.width - 4, data.cell.y + 7.5, { align: 'right' });
        }
      }
    },
  });

  // ══════════════════════════════════════════════════════════════════════════
  // FOOTER — on every page
  // ══════════════════════════════════════════════════════════════════════════
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let pg = 1; pg <= pageCount; pg++) {
    doc.setPage(pg);

    // Footer red bar
    setFill(doc, RED_MAIN);
    doc.rect(0, H - 11, W, 11, 'F');

    // Gold accent on top of footer
    setFill(doc, GOLD);
    doc.rect(0, H - 11, W, 0.8, 'F');

    setFont(doc, [255, 200, 200], 6.5, 'normal');
    doc.text('VIKING RUBBERS PVT. LTD.  |  Confidential Procurement Document  |  Internal Use Only', 14, H - 5);
    setFont(doc, [255, 230, 200], 6.5, 'normal');
    doc.text(`Generated: ${nowIST()}  |  Page ${pg} of ${pageCount}`, W - 14, H - 5, { align: 'right' });
  }

  doc.save(`PO_${po.po_number}_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}
