'use client';

import { useState, useRef, useEffect } from 'react';

interface Props {
  po: any;
  items: any[];
  onClose: () => void;
}

interface TermsState {
  deliveryDirection: string;
  payment: string;
  panGst: string;
  validity: string;
  otherDirections: string;
  vendorName: string;
  vendorPlace: string;
}

function BillContent({ po, items, today, terms }: { po: any; items: any[]; today: string; terms: TermsState }) {
  const labelStyle: React.CSSProperties = {
    fontSize: '10px', fontWeight: 800, color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '2px'
  };
  const valueStyle: React.CSSProperties = { fontWeight: 700, fontSize: '13px', color: '#111827' };

  return (
    <div style={{ background: 'white', fontFamily: "'Arial', sans-serif", width: '100%' }}>

      {/* === COMPANY HEADER === */}
      <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 60%, #0ea5e9 100%)', padding: '0' }}>
        {/* Viking Rubbers Address Bar */}
        <div style={{ background: '#ffffff', borderBottom: '4px solid #1d4ed8', padding: '14px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <img src="/lunars-logo.png" alt="Logo" style={{ height: '42px', width: 'auto', objectFit: 'contain' }} />
            <div style={{ borderLeft: '2px solid #e5e7eb', paddingLeft: '20px' }}>
              <div style={{ fontSize: '16px', fontWeight: 900, color: '#1e3a5f', letterSpacing: '0.03em' }}>VIKING RUBBERS PVT. LTD.</div>
              <div style={{ fontSize: '11px', color: '#374151', marginTop: '2px', lineHeight: '1.6' }}>
                37/8, Nethajipuram, Velanthavalam Road, K.G.Chavadi, Coimbatore - 641 105.
              </div>
              <div style={{ fontSize: '11px', color: '#374151', lineHeight: '1.6' }}>
                Phone: 0422 2656271/331 &nbsp;|&nbsp; Fax: 0422-2656271 &nbsp;|&nbsp; E-Mail: vikingcbe@lunars.com
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ background: '#1e3a5f', color: 'white', fontWeight: 900, fontSize: '14px', padding: '6px 18px', borderRadius: '6px', letterSpacing: '0.08em' }}>PURCHASE ORDER</div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#1d4ed8', marginTop: '6px', fontFamily: 'monospace' }}>{po?.po_number}</div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>Date: {po?.po_date || today}</div>
          </div>
        </div>
      </div>

      {/* === VENDOR & META === */}
      <div style={{ padding: '16px 36px', background: '#f8fafc', borderBottom: '1.5px solid #e5e7eb', display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px' }}>
          <div style={labelStyle}>To / Vendor</div>
          <div style={{ fontWeight: 800, fontSize: '15px', color: '#111827' }}>{po?.vendor || '—'}</div>
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <div style={labelStyle}>PO Date</div>
          <div style={valueStyle}>{po?.po_date || today}</div>
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <div style={labelStyle}>Validity of Order</div>
          <div style={valueStyle}>{terms.validity}</div>
        </div>
      </div>

      {/* === ITEMS TABLE === */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'auto' }}>
          <thead>
            <tr style={{ background: '#1e3a5f' }}>
              {['#', 'Material Code', 'Material Name', 'Category / Type', 'Size / Thickness', 'Req. Qty', 'Unit', 'Rate (₹)'].map((h, i) => (
                <th key={i} style={{
                  padding: '11px 12px', color: 'white', fontWeight: 700,
                  textAlign: i >= 5 ? 'right' : 'left',
                  fontSize: '10px', letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap'
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const qty = Number(item.required_qty ?? item.required_quantity) || 0;
              const rate = Number(item.order_rate) || 0;
              const isRexin = (item.category || '').startsWith('Rexins -');
              const rexinSubType = isRexin ? (item.category || '').replace('Rexins - ', '') : null;
              const categoryLabel = isRexin ? 'Rexins' : (item.category || '—');
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 12px', color: '#9ca3af', fontWeight: 600 }}>{i + 1}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 800, color: '#1d4ed8', fontFamily: 'monospace', fontSize: '11px', whiteSpace: 'nowrap' }}>{item.material_code || '—'}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: '#111827' }}>{item.material_name || '—'}</td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#374151' }}>{categoryLabel}</span>
                    {rexinSubType && (
                      <span style={{
                        display: 'inline-block', marginLeft: '6px',
                        background: rexinSubType === 'Insoles' ? '#dbeafe' : '#fef3c7',
                        color: rexinSubType === 'Insoles' ? '#1d4ed8' : '#92400e',
                        border: `1px solid ${rexinSubType === 'Insoles' ? '#93c5fd' : '#fbbf24'}`,
                        borderRadius: '4px', padding: '1px 7px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase'
                      }}>{rexinSubType}</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#374151', whiteSpace: 'nowrap' }}>{item.size_thickness || '—'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', color: '#111827', whiteSpace: 'nowrap' }}>{qty.toLocaleString()}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#6b7280', whiteSpace: 'nowrap' }}>{item.unit || 'Pair'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: '#1d4ed8', whiteSpace: 'nowrap' }}>{rate > 0 ? `₹${rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* === TERMS & CONDITIONS === */}
      <div style={{ padding: '20px 36px', borderTop: '2px solid #1e3a5f', background: '#f8fafc' }}>
        <div style={{ fontSize: '11px', fontWeight: 900, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px', borderBottom: '1px solid #d1d5db', paddingBottom: '6px' }}>
          Terms & Conditions
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <tbody>
            {[
              ['Delivery Direction', terms.deliveryDirection],
              ['Payment', terms.payment || '—'],
              ['Our PAN & GST No.', terms.panGst],
              ['Validity of Order', terms.validity],
              ['Other Directions', terms.otherDirections],
            ].map(([label, value], i) => (
              <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '7px 12px 7px 0', fontWeight: 800, color: '#374151', width: '180px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{label}</td>
                <td style={{ padding: '7px 0', color: '#111827', fontWeight: 500, lineHeight: '1.6' }}>: {value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* === VENDOR SIGNATURE SECTION === */}
      <div style={{ padding: '20px 36px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1.5px solid #e5e7eb', background: 'white' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Vendor Acknowledgment</div>
          <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>{terms.vendorName || '____________________________'}</div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{terms.vendorPlace || '____________________________'}</div>
          <div style={{ marginTop: '24px', borderTop: '1.5px solid #374151', paddingTop: '6px', fontSize: '10px', color: '#6b7280', width: '200px' }}>Vendor Signature & Stamp</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>For Viking Rubbers Pvt. Ltd.</div>
          <div style={{ marginTop: '40px', borderTop: '1.5px solid #374151', paddingTop: '6px', fontSize: '10px', color: '#6b7280', width: '200px', textAlign: 'right' }}>Authorized Signatory</div>
        </div>
      </div>

      {/* === FOOTER === */}
      <div style={{ background: '#1e3a5f', padding: '12px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '10px' }}>Generated by Viking Rubbers Procurement System</div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}>{po?.po_number} • {today}</div>
      </div>
    </div>
  );
}

export default function EmailModal({ po, items, onClose }: Props) {
  const [to, setTo] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  const defaultTerms: TermsState = {
    deliveryDirection: 'Delivery through APS',
    payment: '',
    panGst: 'PAN-AAACV7922R  |  GST-33AAACV7922R1ZS',
    validity: '2 Weeks',
    otherDirections: '1) Enclose copy of our purchase order along with your delivery documents.\n2) Our PAN and GST Number should be shown in the Dispatch documents.\n3) This PO NO. should be noted in your bill.',
    vendorName: po?.vendor || '',
    vendorPlace: '',
  };

  const [terms, setTerms] = useState<TermsState>(defaultTerms);

  const captureRef = useRef<HTMLDivElement>(null);

  const today = new Date().toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'long', year: 'numeric'
  });

  const captureFullBill = async () => {
    const html2canvas = (await import('html2canvas')).default;
    if (!captureRef.current) throw new Error('Capture ref not ready');
    const canvas = await html2canvas(captureRef.current, {
      scale: 2, useCORS: true, backgroundColor: '#ffffff',
      scrollX: 0, scrollY: 0,
      windowWidth: captureRef.current.scrollWidth,
      windowHeight: captureRef.current.scrollHeight,
      width: captureRef.current.scrollWidth,
      height: captureRef.current.scrollHeight,
    });
    return canvas;
  };

  const handleSend = async () => {
    if (!to.trim()) { alert('Please enter recipient email'); return; }
    setSending(true);
    try {
      const canvas = await captureFullBill();
      const imageBase64 = canvas.toDataURL('image/png');
      const res = await fetch('/api/po/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, po, imageBase64, invoiceNumber: '' })
      });
      const data = await res.json();
      if (data.error) { alert('Email Error: ' + data.error); setSending(false); return; }
      setSending(false); setSent(true);
      if (data.method === 'ethereal' && data.previewUrl) setPreviewUrl(data.previewUrl);
      else setTimeout(onClose, 2000);
    } catch (e: any) {
      alert('Network Error: ' + (e.message || 'Failed to dispatch email'));
      setSending(false);
    }
  };

  const openGmail = async () => {
    try {
      const canvas = await captureFullBill();
      canvas.toBlob(async (blob) => {
        if (!blob) throw new Error('Failed to generate image blob');
        const subject = encodeURIComponent(`Purchase Order ${po?.po_number}`);
        const toParam = to.trim() ? `&to=${to}` : '';
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1${toParam}&su=${subject}`;
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          alert('✅ Full PO Image Copied to Clipboard!\n\nGmail is opening... Just press Ctrl+V to paste the complete image into the email body.');
          window.open(gmailUrl, '_blank');
        } catch {
          const link = document.createElement('a');
          link.download = `PO_${po?.po_number}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
          window.open(gmailUrl, '_blank');
        }
      }, 'image/png');
    } catch (err) {
      alert('Failed to generate image or open Gmail.');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: '8px',
    border: '2px solid #e5e7eb', fontSize: '13px', fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s'
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '11px', fontWeight: 800, color: '#374151',
    textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '5px'
  };

  const updateTerm = (key: keyof TermsState, val: string) => setTerms(prev => ({ ...prev, [key]: val }));

  const focusBorder = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => e.currentTarget.style.borderColor = '#3b82f6';
  const blurBorder = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => e.currentTarget.style.borderColor = '#e5e7eb';

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(10,10,30,0.65)',
      backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 9999, padding: '16px'
    }}>
      {/* Hidden capture target */}
      <div ref={captureRef} style={{ position: 'fixed', top: '-9999px', left: '-9999px', width: '1200px', zIndex: -1, pointerEvents: 'none' }}>
        <BillContent po={po} items={items} today={today} terms={terms} />
      </div>

      {/* Modal */}
      <div style={{
        background: 'white', borderRadius: '16px', width: '100%', maxWidth: '920px',
        maxHeight: '94vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.35)',
        display: 'flex', flexDirection: 'column'
      }}>

        {/* Header */}
        <div style={{ padding: '20px 28px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', borderRadius: '16px 16px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '26px' }}>📧</span>
            <div>
              <div style={{ color: 'white', fontWeight: 800, fontSize: '17px' }}>Send Purchase Order</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>Full PO image will be generated and sent to vendor</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: '18px', width: '34px', height: '34px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Recipient */}
          <div>
            <label style={labelStyle}>Recipient Email <span style={{ color: '#9ca3af', textTransform: 'none', fontWeight: 500 }}>(Optional for Gmail)</span></label>
            <input type="email" placeholder="vendor@example.com" value={to} onChange={e => setTo(e.target.value)} style={inputStyle} onFocus={focusBorder} onBlur={blurBorder} />
          </div>

          {/* Editable Terms Section */}
          <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 900, color: '#1e3a5f', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1.5px solid #e2e8f0', paddingBottom: '10px' }}>
              📋 Terms & Conditions <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500, textTransform: 'none' }}>(editable — will appear on the PO)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Delivery Direction</label>
                <input type="text" value={terms.deliveryDirection} onChange={e => updateTerm('deliveryDirection', e.target.value)} style={inputStyle} onFocus={focusBorder} onBlur={blurBorder} />
              </div>
              <div>
                <label style={labelStyle}>Payment</label>
                <input type="text" placeholder="e.g. Net 30 days" value={terms.payment} onChange={e => updateTerm('payment', e.target.value)} style={inputStyle} onFocus={focusBorder} onBlur={blurBorder} />
              </div>
              <div>
                <label style={labelStyle}>Our PAN & GST No.</label>
                <input type="text" value={terms.panGst} onChange={e => updateTerm('panGst', e.target.value)} style={inputStyle} onFocus={focusBorder} onBlur={blurBorder} />
              </div>
              <div>
                <label style={labelStyle}>Validity of Order</label>
                <input type="text" value={terms.validity} onChange={e => updateTerm('validity', e.target.value)} style={inputStyle} onFocus={focusBorder} onBlur={blurBorder} />
              </div>
            </div>
            <div style={{ marginTop: '14px' }}>
              <label style={labelStyle}>Other Directions</label>
              <textarea rows={3} value={terms.otherDirections} onChange={e => updateTerm('otherDirections', e.target.value)} style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }} onFocus={focusBorder} onBlur={blurBorder} />
            </div>
          </div>

          {/* Vendor Signature */}
          <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '12px', padding: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 900, color: '#1e3a5f', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1.5px solid #bfdbfe', paddingBottom: '10px' }}>
              🏢 Vendor Acknowledgment Details <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500, textTransform: 'none' }}>(for signature section)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Vendor Name</label>
                <input type="text" placeholder="e.g. ABC Suppliers Pvt. Ltd." value={terms.vendorName} onChange={e => updateTerm('vendorName', e.target.value)} style={inputStyle} onFocus={focusBorder} onBlur={blurBorder} />
              </div>
              <div>
                <label style={labelStyle}>Vendor Place / Address</label>
                <input type="text" placeholder="e.g. Coimbatore, Tamil Nadu" value={terms.vendorPlace} onChange={e => updateTerm('vendorPlace', e.target.value)} style={inputStyle} onFocus={focusBorder} onBlur={blurBorder} />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
            <div style={{ background: '#1e3a5f', padding: '8px 16px', fontSize: '11px', fontWeight: 700, color: 'white' }}>📄 PO Preview</div>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ minWidth: '900px' }}>
                <BillContent po={po} items={items} today={today} terms={terms} />
              </div>
            </div>
            <div style={{ background: '#f0f9ff', padding: '8px 16px', borderTop: '1px solid #bae6fd', fontSize: '11px', color: '#0369a1', fontWeight: 600 }}>
              ℹ️ Scroll right to see all columns. The image sent will include all content at full resolution.
            </div>
          </div>

          {/* Action Buttons */}
          {sent && previewUrl && (
            <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: '12px', padding: '16px 20px', color: '#166534', fontSize: '13px' }}>
              <div style={{ fontWeight: 800, fontSize: '15px', marginBottom: '4px' }}>✅ Email Dispatched!</div>
              <a href={previewUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', fontFamily: 'monospace', background: '#dcfce7', padding: '8px 12px', borderRadius: '8px', marginTop: '8px', fontWeight: 700, color: '#15803d', textDecoration: 'none', border: '1px solid #bbf7d0' }}>
                🔗 Open Live Email Preview
              </a>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {sent && previewUrl ? (
              <button onClick={onClose} style={{ padding: '12px 28px', borderRadius: '10px', border: 'none', background: '#166534', color: 'white', fontWeight: 800, cursor: 'pointer', fontSize: '14px' }}>Done (Close)</button>
            ) : (
              <>
                <button onClick={onClose} style={{ padding: '12px 24px', borderRadius: '10px', border: '2px solid #e5e7eb', background: 'white', color: '#374151', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
                <button onClick={openGmail} style={{ padding: '12px 24px', borderRadius: '10px', border: '1px solid #d1d5db', background: 'white', color: '#ea4335', fontWeight: 800, cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335"/></svg>
                  Send via Gmail
                </button>
                <button onClick={handleSend} disabled={sending || sent} style={{ padding: '12px 28px', borderRadius: '10px', border: 'none', background: sent ? '#10b981' : 'linear-gradient(135deg,#2563eb,#0ea5e9)', color: 'white', fontWeight: 800, cursor: 'pointer', fontSize: '14px', opacity: sending ? 0.8 : 1 }}>
                  {sent ? '✅ Sent!' : sending ? '⏳ Sending...' : '📤 Send Auto-Email'}
                </button>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
