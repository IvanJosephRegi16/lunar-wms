'use client';

import { useState, useEffect } from 'react';

export default function PaymentStatusPage() {
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'completed' | 'pending'>('completed');

  useEffect(() => {
    fetch('/api/po')
      .then(res => res.json())
      .then(data => {
        const completedList = (data.pos || []).filter((p: any) => p.status === 'completed');
        setPos(completedList);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const paid    = pos.filter(p => p.payment_status === 'paid');
  const pending = pos.filter(p => p.payment_status !== 'paid');
  const totalPaid    = paid.reduce((s, p) => s + (p.grand_total || 0), 0);
  const totalPending = pending.reduce((s, p) => s + (p.balance_amount || 0), 0);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '16px' }}>
        <div className="loading-dot" />
        <span style={{ color: 'var(--text-ghost)', fontWeight: 600, fontSize: '13px' }}>Loading Payment Records...</span>
      </div>
    );
  }

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* Page Header */}
      <div>
        <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Payment Status</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Track all completed and pending vendor payments from procurement orders.
        </p>
      </div>

      {/* Summary Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        {/* Total POs */}
        <div style={{
          background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
          borderRadius: '16px', padding: '24px', color: 'white',
          boxShadow: '0 8px 24px rgba(59, 130, 246, 0.2)'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.8 }}>Total Completed POs</div>
          <div style={{ fontSize: '36px', fontWeight: 900, fontFamily: 'monospace', marginTop: '8px' }}>{pos.length}</div>
          <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '8px', opacity: 0.85 }}>
            Grand Value: ₹{pos.reduce((s, p) => s + (p.grand_total || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>

        {/* Paid */}
        <div style={{
          background: 'linear-gradient(135deg, #065f46, #10b981)',
          borderRadius: '16px', padding: '24px', color: 'white',
          boxShadow: '0 8px 24px rgba(16, 185, 129, 0.2)'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.8 }}>✅ Payments Complete</div>
          <div style={{ fontSize: '36px', fontWeight: 900, fontFamily: 'monospace', marginTop: '8px' }}>{paid.length}</div>
          <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '8px', opacity: 0.85 }}>
            ₹{totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })} paid out
          </div>
        </div>

        {/* Pending */}
        <div style={{
          background: pending.length > 0
            ? 'linear-gradient(135deg, #92400e, #f59e0b)'
            : 'linear-gradient(135deg, #374151, #6b7280)',
          borderRadius: '16px', padding: '24px', color: 'white',
          boxShadow: pending.length > 0 ? '0 8px 24px rgba(245,158,11,0.2)' : 'none'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.8 }}>⏳ Pending Settlement</div>
          <div style={{ fontSize: '36px', fontWeight: 900, fontFamily: 'monospace', marginTop: '8px' }}>{pending.length}</div>
          <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '8px', opacity: 0.85 }}>
            {pending.length > 0 ? `₹${totalPending.toLocaleString(undefined, { minimumFractionDigits: 2 })} due` : 'All cleared! 🎉'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '2px solid var(--border)' }}>
        {(['completed', 'pending'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 28px', border: 'none', cursor: 'pointer', fontWeight: 700,
              fontSize: '13px', textTransform: 'capitalize', transition: 'all 0.2s',
              background: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--primary)' : 'var(--text-muted)',
              marginBottom: '-2px'
            }}
          >
            {tab === 'completed' ? `✅ Payments Completed (${paid.length})` : `⏳ Pending Payments (${pending.length})`}
          </button>
        ))}
      </div>

      {/* Completed Tab */}
      {activeTab === 'completed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {paid.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-ghost)', fontWeight: 600 }}>
              No fully paid orders yet.
            </div>
          ) : (
            paid.map(po => (
              <div key={po.id} style={{
                background: 'white', borderRadius: '14px', padding: '20px 24px',
                border: '1.5px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '20px',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.06)', transition: 'all 0.2s'
              }}>
                {/* Status dot */}
                <div style={{
                  width: '44px', height: '44px', borderRadius: '50%', background: '#dcfce7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
                  flexShrink: 0
                }}>✅</div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 900, fontSize: '15px', color: '#065f46' }}>{po.po_number}</span>
                    <span style={{ fontSize: '10px', fontWeight: 800, background: '#dcfce7', color: '#14532d', padding: '2px 8px', borderRadius: '10px', textTransform: 'uppercase' }}>PAID</span>
                    {po.invoice_number && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>Inv: {po.invoice_number}</span>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {po.vendor} · {po.delivery_status || 'Delivered'} · {po.shipping_method || 'Local Transit'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-ghost)', textTransform: 'uppercase' }}>Grand Total</div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '16px', color: 'var(--text-main)' }}>₹{po.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-ghost)', textTransform: 'uppercase' }}>Amount Paid</div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '16px', color: '#10b981' }}>₹{po.amount_paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-ghost)', textTransform: 'uppercase' }}>Balance</div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '15px', color: '#10b981' }}>₹0.00</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Pending Tab */}
      {activeTab === 'pending' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {pending.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
              <div style={{ fontWeight: 800, fontSize: '18px', color: '#065f46' }}>All Payments Cleared!</div>
              <div style={{ color: 'var(--text-muted)', marginTop: '8px', fontSize: '13px' }}>No pending vendor bills. Great work!</div>
            </div>
          ) : (
            pending.map(po => (
              <div key={po.id} style={{
                background: 'white', borderRadius: '14px', padding: '20px 24px',
                border: '1.5px solid #fcd34d', display: 'flex', alignItems: 'center', gap: '20px',
                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.08)', transition: 'all 0.2s'
              }}>
                {/* Status dot */}
                <div style={{
                  width: '44px', height: '44px', borderRadius: '50%', background: '#fef3c7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
                  flexShrink: 0
                }}>⏳</div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 900, fontSize: '15px', color: '#92400e' }}>{po.po_number}</span>
                    <span style={{ fontSize: '10px', fontWeight: 800, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '10px', textTransform: 'uppercase' }}>
                      {po.payment_status === 'partial' ? 'PARTIAL' : 'UNPAID'}
                    </span>
                    {po.invoice_number && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>Inv: {po.invoice_number}</span>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {po.vendor} · {po.delivery_status || 'Delivered'} · {po.shipping_method || 'Local Transit'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-ghost)', textTransform: 'uppercase' }}>Grand Total</div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '16px', color: 'var(--text-main)' }}>₹{po.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-ghost)', textTransform: 'uppercase' }}>Paid So Far</div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '16px', color: '#10b981' }}>₹{(po.amount_paid || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-ghost)', textTransform: 'uppercase' }}>Balance Due</div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '17px', color: '#dc2626' }}>₹{(po.balance_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  </div>
                  <a href="/po/completed" style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white',
                    border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: 800,
                    cursor: 'pointer', fontSize: '12px', textDecoration: 'none', whiteSpace: 'nowrap',
                    boxShadow: '0 4px 8px rgba(16,185,129,0.2)', display: 'inline-flex', alignItems: 'center', gap: '6px'
                  }}>
                    ⚡ Pay Now
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      )}

    </div>
  );
}
