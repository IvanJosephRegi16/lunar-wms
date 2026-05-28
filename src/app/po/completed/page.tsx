'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CompletedPOs() {
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  const loadData = () => {
    setLoading(true);
    fetch('/api/po')
      .then(res => res.json())
      .then(data => {
        const completedList = (data.pos || []).filter((p: any) => p.status === 'completed');
        setPos(completedList);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);



  // Standard Spreadsheet Export Support for multi-row raw materials
  const exportToCSV = () => {
    if (pos.length === 0) return;
    
    const headers = [
      'PO Number', 'PO Date', 'Vendor', 'Material Code', 'Material Name', 'Size / Thickness', 'Current Stock', 'Current Stock Unit',
      'Required Quantity', 'Unit', 'Order Rate', 'Item Amount', 'Item Vendor', 'Gross Amount', 'Discount Percent', 'Net Amount', 
      'Invoice Number', 'Transport Charge', 'Grand Total', 'Amount Paid', 'Balance Amount', 'Payment Status', 
      'Shipping Method', 'Delivery Status', 'Global Remarks', 'Item Remarks', 'Created At', 'Approved At'
    ];

    const rows: any[] = [];
    pos.forEach(p => {
      const items = Array.isArray(p.items) ? p.items : [];
      if (items.length === 0) {
        rows.push([
          p.po_number, p.po_date || '', p.vendor, '', '', '', 0, '', 0, 'Pair', 0, 0, p.vendor, p.gross_amount, p.discount_percent, p.net_amount,
          p.invoice_number || '', p.transport_charge || 0, p.grand_total, p.amount_paid || 0, p.balance_amount || 0,
          p.payment_status, p.shipping_method || '', p.delivery_status, p.remarks || '', '', p.created_at, p.approved_timestamp || ''
        ]);
      } else {
        items.forEach((item: any) => {
          rows.push([
            p.po_number, p.po_date || '', p.vendor, item.material_code, item.material_name, item.size_thickness, item.current_stock || 0, item.current_stock_unit || '',
            item.required_qty || 0, item.unit || 'Pair', item.order_rate || 0, item.amount || 0, item.vendor || p.vendor, p.gross_amount, p.discount_percent, p.net_amount,
            p.invoice_number || '', p.transport_charge || 0, p.grand_total, p.amount_paid || 0, p.balance_amount || 0,
            p.payment_status, p.shipping_method || '', p.delivery_status, p.remarks || '', item.remarks || '', p.created_at, p.approved_timestamp || ''
          ]);
        });
      }
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map((e: any) => e.map((val: any) => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Completed_POs_RawMaterials_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '16px' }}>
        <div className="loading-dot" />
        <span style={{ color: 'var(--text-ghost)', fontWeight: 600, fontSize: '13px' }}>Scanning Completed Archives...</span>
      </div>
    );
  }

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      
      {/* Header banner */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Completed PO Archive</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Fully settled and completed purchase orders with printable bill generators.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-corp" onClick={exportToCSV} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
            📥 Export Spreadsheet (CSV)
          </button>
          
          {selectedInvoice && (
            <button className="btn-corp btn-primary-corp" onClick={() => window.print()} style={{ background: 'var(--primary)', color: 'white', fontWeight: 700 }}>
              🖨️ Print Bill Layout
            </button>
          )}
        </div>
      </div>

      {!selectedInvoice ? (
        // Completed List Table
        <div className="card-clean no-print" style={{ padding: '0' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table-corporate">
              <thead>
                <tr>
                  <th>Date Verified</th>
                  <th>PO Number</th>
                  <th>Material Code & Name</th>
                  <th>Req. Stock</th>
                  <th>Vendor Name</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pos.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-ghost)', fontWeight: 600 }}>
                      No Completed Archives Registered
                    </td>
                  </tr>
                ) : (
                  pos.map(po => {
                    const itemCount = Array.isArray(po.items) ? po.items.length : 0;
                    return (
                      <tr key={po.id} className="tr-hover">
                        <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{new Date(po.supervisor_verified_at || po.updated_at).toLocaleString('en-IN')}</td>
                        <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{po.po_number}</td>
                        <td style={{ fontSize: '13px' }}>
                          {Array.isArray(po.items) && po.items.length > 0 
                            ? po.items.map((i: any) => `${i.material_code} - ${i.material_name}`).join(', ') 
                            : '-'}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {Array.isArray(po.items) && po.items.length > 0 
                            ? po.items.map((i: any) => `${i.required_qty} ${i.unit || 'Units'}`).join(', ') 
                            : '-'}
                        </td>
                        <td>{po.vendor}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>₹{po.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td>
                          <button className="btn-corp btn-primary-corp" onClick={() => setSelectedInvoice(po)} style={{ fontSize: '12px', padding: '6px 12px' }}>
                            📄 View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // Premium Printable Invoice Generator Box
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <button className="btn-corp no-print" onClick={() => setSelectedInvoice(null)} style={{ alignSelf: 'flex-start' }}>
            ← Back to Archive List
          </button>

          {/* Clean Invoice Card Container */}
          <div className="card-clean invoice-print-box" style={{
            background: 'white',
            padding: '48px',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '36px',
            fontFamily: 'serif'
          }}>
            
            {/* Header info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: '24px' }}>
              <div>
                <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a', fontStyle: 'italic' }}>LUNAR'S FOOTWEAR</h1>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'sans-serif' }}>
                  Industrial Area, Phase II, New Delhi, India<br />
                  Support: erp@lunars.com | Tel: +91 11 4059 2910
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'sans-serif' }}>Purchase Bill</h2>
                <div style={{ fontSize: '16px', fontWeight: 900, color: 'var(--primary)', marginTop: '6px', fontFamily: 'monospace' }}>{selectedInvoice.po_number}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'sans-serif' }}>PO Date: {selectedInvoice.po_date || new Date(selectedInvoice.created_at).toLocaleDateString('en-IN')}</div>
              </div>
            </div>

            {/* Billing row */}
            <div className="grid grid-2" style={{ gap: '48px' }}>
              <div>
                <h3 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-ghost)', borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '8px', fontFamily: 'sans-serif' }}>Vendor Details</h3>
                <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>{selectedInvoice.vendor}</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.5' }}>
                  Registered WMS Material Vendor Partner<br />
                  Procurement Module: Raw Materials / Chemicals / Soles
                </p>
              </div>
              <div>
                <h3 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-ghost)', borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '8px', fontFamily: 'sans-serif' }}>Accounting & Transit Ref</h3>
                <table style={{ width: '100%', fontSize: '12px', color: 'var(--text-main)', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '4px 0', fontWeight: 700 }}>PO Date:</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{selectedInvoice.po_date || '-'}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 0', fontWeight: 700 }}>Bill Ref:</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{selectedInvoice.invoice_number || '-'}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 0', fontWeight: 700 }}>Shipping Method:</td>
                      <td style={{ textAlign: 'right' }}>{selectedInvoice.shipping_method || 'Local Transit'} ({selectedInvoice.delivery_status})</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 0', fontWeight: 700 }}>Finalized At:</td>
                      <td style={{ textAlign: 'right' }}>{selectedInvoice.accountant_updated_at || '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Line items table */}
            <div>
              <h3 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-ghost)', borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '12px', fontFamily: 'sans-serif' }}>Procured Material Particulars</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ textAlign: 'left', padding: '12px', fontFamily: 'sans-serif' }}>Code</th>
                    <th style={{ textAlign: 'left', padding: '12px', fontFamily: 'sans-serif' }}>Material Description</th>
                    <th style={{ textAlign: 'left', padding: '12px', fontFamily: 'sans-serif' }}>Size / Thickness</th>
                    <th style={{ textAlign: 'right', padding: '12px', fontFamily: 'sans-serif' }}>Stock</th>
                    <th style={{ textAlign: 'left', padding: '12px', fontFamily: 'sans-serif' }}>Stock Unit</th>
                    <th style={{ textAlign: 'right', padding: '12px', fontFamily: 'sans-serif' }}>Order Rate (₹)</th>
                    <th style={{ textAlign: 'right', padding: '12px', fontFamily: 'sans-serif' }}>Quantity</th>
                    <th style={{ textAlign: 'left', padding: '12px', fontFamily: 'sans-serif' }}>Unit</th>
                    <th style={{ textAlign: 'right', padding: '12px', fontFamily: 'sans-serif' }}>Total (₹)</th>
                    <th style={{ textAlign: 'left', padding: '12px', fontFamily: 'sans-serif' }}>Vendor</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedInvoice.items || []).map((item: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px', fontWeight: 700 }}>{item.material_code}</td>
                      <td style={{ padding: '12px', fontWeight: 600 }}>{item.material_name}</td>
                      <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{item.size_thickness}</td>
                      <td style={{ textAlign: 'right', padding: '12px', fontFamily: 'monospace' }}>{Number(item.current_stock || 0).toLocaleString()}</td>
                      <td style={{ padding: '12px', fontWeight: 700, color: 'var(--text-ghost)', fontSize: '11px' }}>{item.current_stock_unit || '-'}</td>
                      <td style={{ textAlign: 'right', padding: '12px', fontFamily: 'monospace' }}>₹{Number(item.order_rate || 0).toFixed(2)}</td>
                      <td style={{ textAlign: 'right', padding: '12px', fontWeight: 700, fontFamily: 'monospace' }}>{Number(item.required_qty || 0).toLocaleString()}</td>
                      <td style={{ padding: '12px', fontWeight: 700, color: 'var(--text-ghost)' }}>{item.unit || 'Pair'}</td>
                      <td style={{ textAlign: 'right', padding: '12px', fontWeight: 800, fontFamily: 'monospace' }}>₹{Number(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td style={{ padding: '12px', fontWeight: 600 }}>{item.vendor || selectedInvoice.vendor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial summaries */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <div style={{ width: '100%', maxWidth: '350px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 0', color: 'var(--text-muted)', fontFamily: 'sans-serif' }}>Gross Total (Rate × Qty):</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>₹{selectedInvoice.gross_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 0', color: 'var(--text-muted)', fontFamily: 'sans-serif' }}>Global Discount Allowed ({selectedInvoice.discount_percent}%):</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--danger)', fontWeight: 700 }}>-₹{(selectedInvoice.gross_amount - selectedInvoice.net_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 0', color: 'var(--text-muted)', fontFamily: 'sans-serif' }}>Net Value (I):</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>₹{selectedInvoice.net_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                      <td style={{ padding: '8px 0', color: 'var(--text-muted)', fontFamily: 'sans-serif' }}>Transport Carriage (L):</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>+₹{(selectedInvoice.transport_charge || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Signature Block */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '64px', borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
              <div style={{ textAlign: 'center', width: '200px' }}>
                <div style={{ height: '40px' }} />
                <div style={{ borderTop: '1px solid #94a3b8', fontSize: '11px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase', paddingTop: '6px', fontFamily: 'sans-serif' }}>Authorized Admin Sign</div>
              </div>
              <div style={{ textAlign: 'center', width: '200px' }}>
                <div style={{ height: '40px' }} />
                <div style={{ borderTop: '1px solid #94a3b8', fontSize: '11px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase', paddingTop: '6px', fontFamily: 'sans-serif' }}>Supervisor Verification</div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Media Print Specific Overrides */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .invoice-print-box, .invoice-print-box * {
            visibility: visible;
          }
          .invoice-print-box {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes pulse-green {
          0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); }
          100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }
        @keyframes slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .fade-in {
          animation: slide-up 0.3s ease forwards;
        }
        .fade-up {
          animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .pulse-green {
          animation: pulse-green 2s infinite;
        }
      `}</style>


    </div>
  );
}
