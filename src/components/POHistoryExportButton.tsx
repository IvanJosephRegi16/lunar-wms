'use client';

import { useState, useRef, useEffect } from 'react';
import { exportPOHistoryPDF } from '@/lib/poPdfExport';
import { downloadCSV } from '@/lib/exportCSV';
import * as ExcelJS from 'exceljs';

interface POHistoryExportButtonProps {
  po: any; // full PO object including po.items[]
}

export default function POHistoryExportButton({ po }: POHistoryExportButtonProps) {
  const [isOpen, setIsOpen]       = useState(false);
  const [loading, setLoading]     = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Unique-row de-duplicator ───────────────────────────────────────────────
  const getUniqueItems = () => {
    const seen = new Set<string>();
    return (po.items || []).filter((item: any) => {
      const key = [item.material_code, item.material_name, item.size_thickness, item.required_qty, item.order_rate, item.unit, item.category].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  // ── CSV ────────────────────────────────────────────────────────────────────
  const handleCSV = () => {
    const items = getUniqueItems();
    const headers = ['#', 'Category', 'Material Code', 'Material Name', 'Size / Thickness', 'Unit', 'Req Qty', 'Received Qty', 'Pending Qty', 'Order Rate (INR)', 'Amount (INR)'];
    const rows = items.map((item: any, idx: number) => {
      const req  = Number(item.required_qty || 0);
      const recd = Number(item.received_qty || 0);
      return [
        idx + 1,
        item.category       || '',
        item.material_code  || '',
        item.material_name  || '',
        item.size_thickness || '',
        item.unit           || '',
        req,
        recd,
        Math.max(0, req - recd),
        Number(item.order_rate || 0).toFixed(2),
        Number(item.amount     || 0).toFixed(2),
      ];
    });
    downloadCSV(`PO_${po.po_number}_Report_${new Date().toISOString().slice(0,10)}.csv`, headers, rows);
    setIsOpen(false);
  };

  // ── Excel ──────────────────────────────────────────────────────────────────
  const handleExcel = async () => {
    setLoading('excel');
    try {
      const items = getUniqueItems();
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Viking Rubbers WMS';
      wb.created = new Date();

      // ── Summary Sheet ────────────────────────────────────────────────────
      const summary = wb.addWorksheet('PO Summary');
      summary.getColumn(1).width = 28;
      summary.getColumn(2).width = 38;

      const titleRow = summary.addRow(['VIKING RUBBERS - PURCHASE ORDER REPORT', '']);
      titleRow.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      summary.mergeCells('A1:B1');
      titleRow.height = 28;
      titleRow.alignment = { vertical: 'middle', horizontal: 'center' };

      summary.addRow([]);

      const addField = (label: string, value: string | number, accent = false) => {
        const row = summary.addRow([label, value]);
        row.getCell(1).font = { bold: true, color: { argb: accent ? 'FF1E3A5F' : 'FF475569' }, size: 10 };
        row.getCell(2).font = { size: 10, bold: accent };
        row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        return row;
      };

      addField('PO Number',       po.po_number || '—', true);
      addField('Vendor / Supplier', po.vendor || '—', true);
      addField('PO Date',         po.po_date || po.created_at?.slice(0, 10) || '—');
      addField('Status',          (po.status || '').replace(/_/g, ' ').toUpperCase(), true);
      addField('Payment Status',  (po.payment_status || 'unpaid').toUpperCase());
      addField('Gross Amount',    `INR ${Number(po.gross_amount || 0).toFixed(2)}`);
      addField('Discount',        `${po.discount_percent || 0}%`);
      addField('Transport',       `INR ${Number(po.transport_charge || 0).toFixed(2)}`);
      addField('Grand Total',     `INR ${Number(po.grand_total || 0).toFixed(2)}`, true);
      addField('Terms - Delivery', po.terms_delivery || '—');
      addField('Terms - Payment',  po.terms_payment  || '—');
      addField('PAN / GST',        po.terms_pan_gst  || '—');

      // ── Materials Sheet ──────────────────────────────────────────────────
      const ws = wb.addWorksheet('Material Details');
      const colDefs = [
        { header: '#',                key: 'idx',       width: 6  },
        { header: 'Category',         key: 'cat',       width: 20 },
        { header: 'Material Code',    key: 'code',      width: 18 },
        { header: 'Material Name',    key: 'name',      width: 28 },
        { header: 'Size / Thickness', key: 'size',      width: 18 },
        { header: 'Unit',             key: 'unit',      width: 10 },
        { header: 'Req Qty',          key: 'req',       width: 12 },
        { header: 'Received Qty',     key: 'recd',      width: 14 },
        { header: 'Pending Qty',      key: 'pend',      width: 14 },
        { header: 'Order Rate (INR)', key: 'rate',      width: 18 },
        { header: 'Amount (INR)',     key: 'amount',    width: 18 },
      ];
      ws.columns = colDefs;

      const hdr = ws.getRow(1);
      hdr.height = 22;
      hdr.font   = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
      hdr.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      hdr.alignment = { vertical: 'middle', horizontal: 'center' };

      items.forEach((item: any, i: number) => {
        const req  = Number(item.required_qty || 0);
        const recd = Number(item.received_qty || 0);
        const pend = Math.max(0, req - recd);
        const row  = ws.addRow({
          idx:    i + 1,
          cat:    item.category       || '',
          code:   item.material_code  || '',
          name:   item.material_name  || '',
          size:   item.size_thickness || '',
          unit:   item.unit           || '',
          req,
          recd,
          pend,
          rate:   Number(item.order_rate || 0).toFixed(2),
          amount: Number(item.amount     || 0).toFixed(2),
        });
        row.font = { size: 9 };
        if (i % 2 === 0) {
          row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        }
        // Highlight pending in red
        if (pend > 0) {
          row.getCell('pend').font = { color: { argb: 'FFDC2626' }, bold: true, size: 9 };
        }
        // Bold amount
        row.getCell('amount').font = { bold: true, size: 9 };
      });

      // Totals row
      ws.addRow({});
      const totals = ws.addRow({
        idx: '', cat: '', code: '', name: '', size: '', unit: 'GRAND TOTAL',
        req: items.reduce((a: number, x: any) => a + Number(x.required_qty || 0), 0),
        recd: '', pend: '',
        rate: '',
        amount: `INR ${Number(po.grand_total || 0).toFixed(2)}`,
      });
      totals.font = { bold: true, size: 9 };
      totals.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      totals.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };

      const buf  = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `PO_${po.po_number}_Report_${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setLoading(null);
      setIsOpen(false);
    }
  };

  // ── PDF ────────────────────────────────────────────────────────────────────
  const handlePDF = () => {
    setLoading('pdf');
    try {
      exportPOHistoryPDF(po);
    } finally {
      setLoading(null);
      setIsOpen(false);
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setIsOpen(p => !p)}
        style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
          color: 'white', border: 'none', borderRadius: '10px',
          padding: '8px 14px', fontWeight: 700, fontSize: '12px',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
          boxShadow: '0 4px 12px rgba(37,99,235,0.3)', transition: 'all 0.2s',
        }}
      >
        📥 Export ▾
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 9999,
          background: 'white', border: '1px solid #e2e8f0', borderRadius: '14px',
          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.15)', minWidth: '220px', overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{ background: '#0f172a', padding: '12px 16px' }}>
            <div style={{ color: 'white', fontWeight: 800, fontSize: '12px' }}>Export PO {po.po_number}</div>
            <div style={{ color: '#94a3b8', fontSize: '10px', marginTop: '2px' }}>{(po.items || []).length} line items</div>
          </div>

          <div style={{ padding: '8px' }}>
            {/* PDF */}
            <button onClick={handlePDF} disabled={!!loading} style={optStyle('#fef2f2', '#dc2626')}>
              <span style={{ fontSize: '18px' }}>📄</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 800, fontSize: '12px', color: '#dc2626' }}>Premium PDF Report</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>Fortune-500 grade, full dashboard</div>
              </div>
              {loading === 'pdf' && <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#94a3b8' }}>⏳</span>}
            </button>

            {/* Excel */}
            <button onClick={handleExcel} disabled={!!loading} style={optStyle('#f0fdf4', '#16a34a')}>
              <span style={{ fontSize: '18px' }}>📊</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 800, fontSize: '12px', color: '#16a34a' }}>Excel Workbook</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>Summary + Material Details sheets</div>
              </div>
              {loading === 'excel' && <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#94a3b8' }}>⏳</span>}
            </button>

            {/* CSV */}
            <button onClick={handleCSV} disabled={!!loading} style={optStyle('#eff6ff', '#2563eb')}>
              <span style={{ fontSize: '18px' }}>📝</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 800, fontSize: '12px', color: '#2563eb' }}>CSV Spreadsheet</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>Raw data, all columns</div>
              </div>
            </button>
          </div>

          <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <div style={{ fontSize: '9px', color: '#94a3b8', textAlign: 'center' }}>
              🔒 Confidential — Viking Rubbers Internal Use
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const optStyle = (bg: string, accent: string): React.CSSProperties => ({
  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
  padding: '10px 12px', background: 'transparent', border: 'none',
  borderRadius: '10px', cursor: 'pointer', transition: 'background 0.15s',
  marginBottom: '4px',
  // We can't do hover via inline style easily, so we rely on bg on active
});
