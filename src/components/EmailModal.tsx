'use client';

import { useState, useRef } from 'react';

interface Props {
  po: any;
  items: any[];
  onClose: () => void;
}

// The full-resolution bill content, shared between visible preview and hidden capture target
function BillContent({ po, items, today, vendorDetails }: { po: any; items: any[]; today: string; vendorDetails?: any }) {
  return (
    <div style={{ background: 'white', fontFamily: 'Arial, sans-serif' }}>
      {/* Bill Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 60%, #0ea5e9 100%)',
        padding: '32px 36px', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: '-30px', left: '40%', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ background: 'white', padding: '6px 12px', borderRadius: '8px', display: 'inline-block', alignSelf: 'flex-start' }}>
              <img src="/lunars-logo.png" alt="Lunar's Logo" style={{ height: '36px', width: 'auto', display: 'block', objectFit: 'contain' }} />
            </div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '11px', fontWeight: 700, marginTop: '4px', letterSpacing: '0.08em' }}>PROCUREMENT DIVISION</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ background: 'rgba(255,255,255,0.15)', padding: '8px 18px', borderRadius: '20px', color: 'white', fontWeight: 800, fontSize: '13px' }}>PURCHASE ORDER</div>
            <div style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: '22px', marginTop: '8px' }}>{po?.po_number}</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', marginTop: '4px' }}>{today}</div>
          </div>
        </div>
      </div>

      {/* Vendor & Meta */}
      <div style={{ background: '#f8fafc', padding: '20px 36px', display: 'flex', gap: '32px', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 250px' }}>
          <div style={{ fontSize: '10px', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Vendor / Supplier</div>
          <div style={{ fontWeight: 800, fontSize: '15px', color: '#111827', lineHeight: '1.4' }}>
            {vendorDetails?.company_name ? `${vendorDetails.company_name}, ${po?.vendor || ''}` : (po?.vendor || '—')}
            {vendorDetails?.address && `, ${vendorDetails.address}`}
          </div>
        </div>
        <div style={{ flex: '1 1 150px' }}>
          <div style={{ fontSize: '10px', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>PO Date</div>
          <div style={{ fontWeight: 700, fontSize: '14px', color: '#374151' }}>{po?.po_date || today}</div>
        </div>
        <div style={{ flex: '1 1 150px' }}>
          <div style={{ fontSize: '10px', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Approved Date</div>
          <div style={{ fontWeight: 700, fontSize: '14px', color: '#374151' }}>{po?.approved_timestamp || '—'}</div>
        </div>
        {po?.remarks && (
          <div style={{ flex: '2 1 300px' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>PM Remarks / Instructions</div>
            <div style={{ fontWeight: 600, fontSize: '13px', color: '#92400e', background: '#fffbeb', padding: '8px 12px', borderRadius: '6px', borderLeft: '3px solid #f59e0b' }}>{po.remarks}</div>
          </div>
        )}
      </div>

      {/* Items Table — includes Rexin sub-category badge */}
      <div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'auto' }}>
          <thead>
            <tr style={{ background: '#1e3a5f' }}>
              {['#', 'Material Code', 'Material Name', 'Category / Type', 'Size / Thickness', 'Req. Qty', 'Unit', 'Vendor'].map((h, i) => (
                <th key={i} style={{
                  padding: '11px 12px', color: 'white', fontWeight: 700,
                  textAlign: i === 5 ? 'right' : 'left',
                  fontSize: '10px', letterSpacing: '0.04em', textTransform: 'uppercase',
                  whiteSpace: 'nowrap'
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const qty = Number(item.required_qty ?? item.required_quantity) || 0;
              const isRexin = (item.category || '').startsWith('Rexins -');
              const rexinSubType = isRexin ? (item.category || '').replace('Rexins - ', '') : null;
              const categoryLabel = isRexin ? 'Rexins' : (item.category || '—');
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '11px 12px', color: '#9ca3af', fontWeight: 600, whiteSpace: 'nowrap' }}>{i + 1}</td>
                  <td style={{ padding: '11px 12px', fontWeight: 800, color: '#1d4ed8', fontFamily: 'monospace', fontSize: '11px', whiteSpace: 'nowrap' }}>{item.material_code || '—'}</td>
                  <td style={{ padding: '11px 12px', fontWeight: 700, color: '#111827' }}>{item.material_name || '—'}</td>
                  <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#374151' }}>{categoryLabel}</span>
                    {rexinSubType && (
                      <span style={{
                        display: 'inline-block', marginLeft: '6px',
                        background: rexinSubType === 'Insoles' ? '#dbeafe' : '#fef3c7',
                        color: rexinSubType === 'Insoles' ? '#1d4ed8' : '#92400e',
                        border: `1px solid ${rexinSubType === 'Insoles' ? '#93c5fd' : '#fbbf24'}`,
                        borderRadius: '4px', padding: '1px 7px',
                        fontSize: '10px', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase'
                      }}>
                        {rexinSubType}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '11px 12px', color: '#374151', whiteSpace: 'nowrap' }}>{item.size_thickness || '—'}</td>
                  <td style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', color: '#111827', whiteSpace: 'nowrap' }}>{qty.toLocaleString()}</td>
                  <td style={{ padding: '11px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{item.unit || 'Pair'}</td>
                  <td style={{ padding: '11px 12px', color: '#374151', whiteSpace: 'nowrap' }}>{item.vendor || po?.vendor || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bill Footer */}
      <div style={{ background: '#1e3a5f', padding: '18px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>Generated by Lunar's Procurement System</div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>{po?.po_number} • {today}</div>
      </div>
    </div>
  );
}

export default function EmailModal({ po, items, onClose }: Props) {
  const [to, setTo] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [vendorDetails, setVendorDetails] = useState<any>(null);

  // Fetch vendor details when modal opens
  import('react').then(React => {
    React.useEffect(() => {
      async function fetchVendor() {
        if (!po?.vendor) return;
        try {
          const res = await fetch('/api/po/materials');
          const data = await res.json();
          if (data.success && data.vendors) {
            const v = data.vendors.find((vd: any) => vd.vendor_name === po.vendor);
            if (v) setVendorDetails(v);
          }
        } catch (err) {
          console.error("Failed to fetch vendor details", err);
        }
      }
      fetchVendor();
    }, [po?.vendor]);
  });

  // This ref is for the HIDDEN full-width capture target (off-screen, not clipped)
  const captureRef = useRef<HTMLDivElement>(null);

  const today = new Date().toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'long', year: 'numeric'
  });

  const captureFullBill = async () => {
    const html2canvas = (await import('html2canvas')).default;
    if (!captureRef.current) throw new Error('Capture ref not ready');

    const canvas = await html2canvas(captureRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      // Capture full scrollable width/height
      scrollX: 0,
      scrollY: 0,
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
        body: JSON.stringify({ to, po, imageBase64 })
      });
      const data = await res.json();
      if (data.error) { alert('Email Error: ' + data.error); setSending(false); return; }

      setSending(false);
      setSent(true);
      if (data.method === 'ethereal' && data.previewUrl) {
        setPreviewUrl(data.previewUrl);
      } else {
        setTimeout(onClose, 2000);
      }
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
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          alert('✅ Full PO Image Copied to Clipboard!\n\nGmail is opening... Just press Ctrl+V (or Cmd+V) to paste the complete image into the email body.');
          window.open(gmailUrl, '_blank');
        } catch (err) {
          console.error('Clipboard write failed:', err);
          alert('Could not copy image automatically (Browser permission denied). Downloading instead. Please drag the downloaded image into Gmail.');
          const link = document.createElement('a');
          link.download = `PO_${po?.po_number}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
          window.open(gmailUrl, '_blank');
        }
      }, 'image/png');
    } catch (err) {
      console.error(err);
      alert('Failed to generate image or open Gmail.');
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(10,10,30,0.65)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '16px'
    }}>
      {/* Hidden full-width capture container — off-screen, renders at 1200px, never clipped */}
      <div
        ref={captureRef}
        style={{
          position: 'fixed',
          top: '-9999px',
          left: '-9999px',
          width: '1200px',
          zIndex: -1,
          pointerEvents: 'none',
        }}
      >
        <BillContent po={po} items={items} today={today} vendorDetails={vendorDetails} />
      </div>

      {/* Visible modal */}
      <div style={{
        background: 'white', borderRadius: '16px',
        width: '100%', maxWidth: '860px',
        maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 32px 80px rgba(0,0,0,0.35)',
        display: 'flex', flexDirection: 'column'
      }}>

        {/* Modal Header */}
        <div style={{
          padding: '20px 28px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg,#1e3a5f,#2563eb)',
          borderRadius: '16px 16px 0 0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px' }}>📧</span>
            <div>
              <div style={{ color: 'white', fontWeight: 800, fontSize: '18px' }}>Send Purchase Order</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>Full PO with all details will be captured as image</div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.15)', border: 'none',
            color: 'white', fontSize: '20px', width: '36px', height: '36px',
            borderRadius: '50%', cursor: 'pointer', lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>✕</button>
        </div>

        {/* Email To Field */}
        <div style={{ padding: '20px 28px 0' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recipient Email (Optional for Gmail)</label>
          <input
            type="email"
            placeholder="vendor@example.com"
            value={to}
            onChange={e => setTo(e.target.value)}
            style={{
              width: '100%', marginTop: '8px',
              padding: '12px 16px', borderRadius: '10px',
              border: '2px solid #e5e7eb', fontSize: '14px',
              fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
              transition: 'border-color 0.2s'
            }}
            onFocus={e => e.currentTarget.style.borderColor = '#2563eb'}
            onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}
          />
        </div>

        {/* Scaled preview — CSS transform scale so ALL columns fit inside the modal without clipping */}
        <div style={{ margin: '20px 28px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ minWidth: '900px' }}>
              <BillContent po={po} items={items} today={today} vendorDetails={vendorDetails} />
            </div>
          </div>
          <div style={{ background: '#f0f9ff', padding: '8px 16px', borderTop: '1px solid #bae6fd', fontSize: '11px', color: '#0369a1', fontWeight: 600 }}>
            ℹ️ Scroll right to see all columns. The image sent/copied will include ALL columns at full resolution.
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ padding: '0 28px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {sent && previewUrl && (
            <div className="fade-up" style={{
              background: '#f0fdf4', border: '1.5px solid #bbf7d0',
              borderRadius: '12px', padding: '16px 20px',
              color: '#166534', fontSize: '13.5px', lineHeight: '1.5'
            }}>
              <div style={{ fontWeight: 800, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                ✅ Email Dispatched to Test Server
              </div>
              <div>
                Since no real email provider is configured, the system generated a live test inbox. You can view exactly what the vendor would receive here:
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-block', fontFamily: 'monospace',
                    background: '#dcfce7', padding: '8px 12px', borderRadius: '8px',
                    marginTop: '8px', fontWeight: 700, fontSize: '13px',
                    color: '#15803d', textDecoration: 'none', border: '1px solid #bbf7d0'
                  }}
                >
                  🔗 Open Live Email Preview
                </a>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
            {sent && previewUrl ? (
              <button onClick={onClose} style={{
                padding: '12px 28px', borderRadius: '10px', border: 'none',
                background: '#166534', color: 'white', fontWeight: 800, cursor: 'pointer', fontSize: '14px',
                boxShadow: '0 4px 14px rgba(22,101,52,0.3)'
              }}>
                Done (Close)
              </button>
            ) : (
              <>
                <button onClick={onClose} style={{
                  padding: '12px 24px', borderRadius: '10px', border: '2px solid #e5e7eb',
                  background: 'white', color: '#374151', fontWeight: 700, cursor: 'pointer', fontSize: '14px'
                }}>Cancel</button>

                <button onClick={openGmail} style={{
                  padding: '12px 24px', borderRadius: '10px', border: '1px solid #d1d5db',
                  background: 'white', color: '#ea4335', fontWeight: 800, cursor: 'pointer', fontSize: '14px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335"/>
                  </svg>
                  Send via Gmail
                </button>

                <button onClick={handleSend} disabled={sending || sent} style={{
                  padding: '12px 28px', borderRadius: '10px', border: 'none',
                  background: sent ? '#10b981' : 'linear-gradient(135deg,#2563eb,#0ea5e9)',
                  color: 'white', fontWeight: 800, cursor: 'pointer', fontSize: '14px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  opacity: sending ? 0.8 : 1, transition: 'all 0.2s',
                  boxShadow: '0 4px 14px rgba(37,99,235,0.4)'
                }}>
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
