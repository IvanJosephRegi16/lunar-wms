'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { downloadCSV } from '@/lib/exportCSV';
import POResetExportPanel from '@/components/POResetExportPanel';
import POPreviewModal from '@/components/POPreviewModal';
import POHistoryExportButton from '@/components/POHistoryExportButton';

export default function POHistory() {
  const [logs, setLogs] = useState<any[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'tracker' | 'ledger'>('tracker');
  const [userRole, setUserRole] = useState('');
  const [selectedPo, setSelectedPo] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  const loadData = () => {
    setLoading(true);
    fetch('/api/auth/me').then(r => r.json()).then(d => { if (d.user) setUserRole(d.user.role); }).catch(() => {});
    fetch('/api/po/history')
      .then(res => res.json())
      .then(data => {
        setLogs(data.logs || []);
        setPos(data.pos || []);
        if (data.stats) setStats(data.stats);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  // Map internal DB status values to human-readable display labels
  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      'draft': 'Draft',
      'pending_pm_approval': 'PM Pre-Approval',
      'pending_admin_approval': 'Admin Approval',
      'returned_by_pm': 'Returned by PM',
      'returned_by_admin': 'Returned by Admin',
      'returned_for_edit': 'Returned for Edit',
      'rejected': 'Rejected',
      'accountant_processing': 'Accountant Processing',
      'supervisor_review': 'Store Review',
      'completed': 'Completed',
    };
    return map[status] || status.replace(/_/g, ' ');
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create':
        return { icon: '✍️', bg: '#f1f5f9', color: '#64748b' };
      case 'edit':
        return { icon: '📝', bg: '#eff6ff', color: '#1d4ed8' };
      case 'submit':
        return { icon: '⏳', bg: '#fffbeb', color: '#b45309' };
      case 'approve':
        return { icon: '✅', bg: '#f0fdf4', color: '#15803d' };
      case 'reject':
        return { icon: '❌', bg: '#fef2f2', color: '#b91c1c' };
      case 'return_for_edit':
        return { icon: '🔄', bg: '#eff6ff', color: '#2563eb' };
      case 'accountant_update':
        return { icon: '💸', bg: '#f0fdf4', color: '#16a34a' };
      case 'completion':
        return { icon: '📁', bg: '#faf5ff', color: '#7e22ce' };
      default:
        return { icon: '⚙️', bg: '#f1f5f9', color: '#334155' };
    }
  };

  const filteredLogs = logs.filter(l => 
    l.po_number.toLowerCase().includes(search.toLowerCase()) ||
    (l.vendor && l.vendor.toLowerCase().includes(search.toLowerCase())) ||
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.username.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPos = pos.filter(p => {
    if (!search) return true;
    const s = search.toLowerCase();
    const inPo = p.po_number.toLowerCase().includes(s);
    const inVendor = p.vendor && p.vendor.toLowerCase().includes(s);
    const inItems = p.items && p.items.some((it: any) => 
      (it.material_name && it.material_name.toLowerCase().includes(s)) ||
      (it.material_code && it.material_code.toLowerCase().includes(s)) ||
      (it.category && it.category.toLowerCase().includes(s)) ||
      (it.remarks && it.remarks.toLowerCase().includes(s))
    );
    return inPo || inVendor || inItems;
  }).sort((a, b) => {
    if (!search) return 0;
    const s = search.toLowerCase();
    const aInItems = a.items && a.items.some((it: any) => (it.material_name || '').toLowerCase().includes(s) || (it.material_code || '').toLowerCase().includes(s));
    const bInItems = b.items && b.items.some((it: any) => (it.material_name || '').toLowerCase().includes(s) || (it.material_code || '').toLowerCase().includes(s));
    if (aInItems && !bInItems) return -1;
    if (!aInItems && bInItems) return 1;
    return 0;
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '16px' }}>
        <div className="loading-dot" />
        <span style={{ color: 'var(--text-ghost)', fontWeight: 600, fontSize: '13px' }}>Loading WMS audit log stream...</span>
      </div>
    );
  }

  const getExportData = () => {
    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    if (activeTab === 'ledger') {
      const headers = ['Timestamp (IST)', 'PO Number', 'Vendor', 'Action', 'Description', 'Actor (Username)', 'Export Date/Time'];
      const rows = filteredLogs.map((log: any) => [
        new Date(log.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        log.po_number,
        log.vendor || '',
        log.action,
        log.description,
        log.username,
        now
      ]);
      return { headers, rows, filename: `PO_Audit_Ledger_${new Date().toISOString().slice(0,10)}` };
    } else {
      const headers = ['PO Number', 'Vendor', 'Status', 'Grand Total (Rs)', 'Payment Status', 'Created At (IST)', 'Export Date/Time'];
      const filtered = pos.filter((p: any) =>
        p.po_number.toLowerCase().includes(search.toLowerCase()) ||
        (p.vendor && p.vendor.toLowerCase().includes(search.toLowerCase()))
      );
      const rows = filtered.map((po: any) => [
        po.po_number,
        po.vendor || '',
        po.status?.replace(/_/g, ' ') || '',
        po.grand_total ?? 0,
        po.payment_status || '',
        po.created_at ? new Date(po.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
        now
      ]);
      return { headers, rows, filename: `PO_Tracker_${new Date().toISOString().slice(0,10)}` };
    }
  };

  const exportData = getExportData();

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px', margin: '0 auto' }}>
      
      {/* Header banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>WMS PO History &amp; Tracking</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Complete chronological ledger and step-by-step visual tracker for all PO lifecycles.
          </p>
        </div>
        <POResetExportPanel
          userRole={userRole}
          exportFilename={exportData.filename}
          exportHeaders={exportData.headers}
          exportRows={exportData.rows}
          onResetComplete={loadData}
        />
      </div>

      {/* Statistics Banner */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '24px', fontWeight: 800, color: '#1d4ed8' }}>{stats.pendingPm}</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', marginTop: '4px', textAlign: 'center' }}>PM Approvals<br/>Pending</span>
          </div>
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '24px', fontWeight: 800, color: '#b91c1c' }}>{stats.pendingAdmin}</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', marginTop: '4px', textAlign: 'center' }}>Admin Approvals<br/>Pending</span>
          </div>
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '24px', fontWeight: 800, color: '#b45309' }}>{stats.pendingAccountant}</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', marginTop: '4px', textAlign: 'center' }}>Accountant Review<br/>Pending</span>
          </div>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '24px', fontWeight: 800, color: '#15803d' }}>{stats.pendingStoreKeeper}</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', marginTop: '4px', textAlign: 'center' }}>Store Verifications<br/>Pending</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border)' }}>
        <button 
          onClick={() => setActiveTab('tracker')}
          style={{ padding: '12px 24px', background: 'none', border: 'none', borderBottom: activeTab === 'tracker' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'tracker' ? 'var(--primary)' : 'var(--text-ghost)', fontWeight: activeTab === 'tracker' ? 800 : 600, fontSize: '14px', cursor: 'pointer' }}
        >
          📍 Live PO Tracker
        </button>
        <button 
          onClick={() => setActiveTab('ledger')}
          style={{ padding: '12px 24px', background: 'none', border: 'none', borderBottom: activeTab === 'ledger' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'ledger' ? 'var(--primary)' : 'var(--text-ghost)', fontWeight: activeTab === 'ledger' ? 800 : 600, fontSize: '14px', cursor: 'pointer' }}
        >
          📜 Detailed Audit Ledger
        </button>
      </div>

      {/* Filter and search bar */}
      <div className="card-clean" style={{ padding: '16px 24px' }}>
        <input type="text" placeholder={`🔍 Search ${activeTab === 'tracker' ? 'POs' : 'logs'} by PO Code, Vendor...`} value={search} onChange={e => setSearch(e.target.value)} style={{
          width: '100%',
          background: '#f8fafc',
          border: '1px solid var(--border)',
          padding: '12px 18px',
          borderRadius: '8px',
          fontSize: '14px',
          fontFamily: 'inherit',
          fontWeight: 500,
          outline: 'none'
        }} />
      </div>

      {/* Content */}
      <div className="card-clean" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {activeTab === 'ledger' && (
          <>
            {filteredLogs.length === 0 ? (
              <div style={{ color: 'var(--text-ghost)', textAlign: 'center', padding: '48px', fontWeight: 600 }}>
                No matching logs found in active history.
              </div>
            ) : (
              filteredLogs.map((log, idx) => {
                const act = getActionIcon(log.action);
                return (
                  <div key={log.id} style={{
                    display: 'flex',
                    gap: '20px',
                    borderLeft: idx !== filteredLogs.length - 1 ? '2px dashed var(--border)' : 'none',
                    paddingLeft: '24px',
                    paddingBottom: '8px',
                    position: 'relative'
                  }}>
                    <div style={{
                      position: 'absolute', left: '-17px', top: '0', width: '32px', height: '32px',
                      borderRadius: '50%', background: act.bg, border: `1px solid var(--border)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                    }}>
                      {act.icon}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>{log.po_number}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-ghost)', marginLeft: '8px' }}>({log.vendor || 'No Vendor'})</span>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-ghost)', fontFamily: 'monospace' }}>
                          {new Date(log.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                        </span>
                      </div>
                      <p style={{ fontSize: '14px', color: 'var(--text-main)', lineHeight: '1.5' }}>
                        {log.description}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: act.color }} />
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-ghost)', textTransform: 'uppercase' }}>
                          Actor: {log.username}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}

        {activeTab === 'tracker' && (
          <>
            {filteredPos.length === 0 ? (
              <div style={{ color: 'var(--text-ghost)', textAlign: 'center', padding: '48px', fontWeight: 600 }}>
                No active POs found matching your search.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {filteredPos.map(po => {
                  
                  // Define stages based on PO lifecycle (now with Pre-Approval)
                  const stages = [
                    { id: 'created',               label: `Created By: ${po.creator_first_name || po.creator_name?.split(' ')[0] || '?'} (${po.creator_role || 'user'})`, icon: '✍️' },
                    { id: 'pending_pm_approval',   label: 'Pre-Approval (PM)', icon: '🔍' },
                    { id: 'pending_admin_approval', label: 'Admin Approval', icon: '🔑' },
                    { id: 'accountant_processing', label: 'Accountant', icon: '💸' },
                    { id: 'supervisor_review',     label: 'Store Review', icon: '📦' },
                    { id: 'completed',             label: 'Completed', icon: '✅' }
                  ];

                  // Map PO status to the correct tracker stage index
                  const statusToStage: Record<string, number> = {
                    'draft': 0,
                    'pending_pm_approval': 1,
                    'returned_by_pm': 1,
                    'pending_admin_approval': 2,
                    'returned_by_admin': 2,
                    'returned_for_edit': 2,
                    'rejected': 2,
                    'accountant_processing': 3,
                    'supervisor_review': 4,
                    'completed': 5
                  };
                  const activeIdx = statusToStage[po.status] ?? 0;

                  return (
                    <div key={po.id} onClick={() => setSelectedPo(po)} style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', cursor: 'pointer', transition: 'box-shadow 0.2s' }}
                         onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'}
                         onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary)' }}>{po.po_number}</span>
                          <span style={{ fontSize: '13px', color: 'var(--text-ghost)', marginLeft: '8px' }}>({po.vendor || 'No Vendor'})</span>
                          <div style={{ fontSize: '11px', color: 'var(--text-ghost)', marginTop: '4px', fontWeight: 600 }}>
                            Created by <strong style={{ color: 'var(--text-muted)' }}>{po.creator_first_name || po.creator_name?.split(' ')[0] || '—'}</strong>
                            <span style={{ margin: '0 4px' }}>·</span>
                            <span style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px', fontWeight: 700, textTransform: 'capitalize' }}>{po.creator_role || 'user'}</span>
                            {(po.categories && po.categories.length > 0) && (
                              <><span style={{ margin: '0 4px' }}>·</span>
                              <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>📦 {po.categories.join(', ')}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, padding: '4px 8px', borderRadius: '8px', background: po.status === 'completed' ? '#dcfce7' : po.status === 'supervisor_review' ? '#eff6ff' : po.status.includes('reject') || po.status.includes('return') ? '#fee2e2' : '#f1f5f9', color: po.status === 'completed' ? '#16a34a' : po.status === 'supervisor_review' ? '#1d4ed8' : po.status.includes('reject') || po.status.includes('return') ? '#dc2626' : '#64748b', textTransform: 'uppercase' }}>
                            {getStatusLabel(po.status)}
                          </span>
                          {/* Delete button for draft, returned, and rejected POs */}
                          {['draft', 'returned_by_pm', 'returned_by_admin', 'returned_for_edit', 'rejected'].includes(po.status) && (userRole === 'pm' || userRole === 'admin' || userRole === 'supervisor') && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!confirm(`Delete PO ${po.po_number}? This cannot be undone.`)) return;
                                const res = await fetch(`/api/po/${po.id}`, { method: 'DELETE' });
                                const data = await res.json();
                                if (data.error) { alert(data.error); return; }
                                loadData();
                              }}
                              style={{ fontSize: '11px', padding: '4px 10px', color: '#ef4444', border: '1px solid #fca5a5', background: '#fef2f2', fontWeight: 700, borderRadius: '8px', cursor: 'pointer' }}
                            >
                              🗑️ Delete
                            </button>
                          )}
                        </div>
                      </div>

                        {/* Tracker Visual */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', marginTop: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
                          {/* Connecting Line */}
                          <div style={{ position: 'absolute', top: '16px', left: '30px', right: '30px', height: '4px', background: '#e2e8f0', zIndex: 0, borderRadius: '2px' }}></div>
                          <div style={{ position: 'absolute', top: '16px', left: '30px', width: `${(activeIdx / (stages.length - 1)) * 100}%`, height: '4px', background: po.status.includes('reject') || po.status.includes('return') ? '#ef4444' : '#10b981', zIndex: 1, borderRadius: '2px', transition: 'width 0.5s' }}></div>

                          {stages.map((stage, i) => {
                            const isCompleted = i < activeIdx;
                            const isActive = i === activeIdx;
                            const isError = isActive && (po.status.includes('reject') || po.status.includes('return'));

                            return (
                              <div key={stage.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, minWidth: '70px', flex: 1 }}>
                                <div style={{
                                  width: '34px', height: '34px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px',
                                  background: isCompleted ? '#10b981' : isError ? '#ef4444' : isActive ? '#3b82f6' : '#f8fafc',
                                  border: `2px solid ${isCompleted ? '#10b981' : isError ? '#ef4444' : isActive ? '#3b82f6' : '#cbd5e1'}`,
                                  color: isCompleted || isActive || isError ? 'white' : '#94a3b8',
                                  boxShadow: isActive ? '0 0 0 4px rgba(59, 130, 246, 0.2)' : 'none',
                                  transition: 'all 0.3s'
                                }}>
                                  {isCompleted ? '✓' : isError ? '!' : stage.icon}
                                </div>
                                <span style={{ fontSize: '10px', fontWeight: isActive ? 800 : 600, color: isActive ? 'var(--text-main)' : 'var(--text-ghost)', marginTop: '8px', textAlign: 'center', lineHeight: 1.3 }}>
                                  {stage.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Materials Sheet Details Modal */}
      {selectedPo && (
        <div style={{
          position: 'fixed',
          top: '0', left: '0', right: '0', bottom: '0',
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="card-clean fade-up" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '900px', maxHeight: '90vh', padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-ghost)', fontWeight: 800, textTransform: 'uppercase' }}>Purchase Order Details</span>
                <h3 style={{ fontSize: '18px', fontWeight: 850, color: 'var(--primary)', marginTop: '4px' }}>PO: {selectedPo.po_number}</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <button onClick={() => setShowPreview(true)}
                  style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: '8px', color: '#475569', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📄 View Accountant Verified PO
                </button>
                {/* Show premium export for any PO that has passed accountant stage */}
                {['supervisor_review', 'completed'].includes(selectedPo.status) && (
                  <POHistoryExportButton po={selectedPo} userRole={userRole} />
                )}
                <button onClick={() => setSelectedPo(null)} style={{ background: 'none', border: 'none', fontSize: '28px', cursor: 'pointer', color: 'var(--text-ghost)', lineHeight: '1' }}>×</button>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ flex: '1 1 200px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-ghost)', fontWeight: 700 }}>VENDOR / SUPPLIER</div>
                <div style={{ fontSize: '14px', fontWeight: 750, marginTop: '2px' }}>{selectedPo.vendor || selectedPo.supplier_name || '-'}</div>
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-ghost)', fontWeight: 700 }}>PO DATE / LAST UPDATED</div>
                <div style={{ fontSize: '14px', fontWeight: 750, marginTop: '2px' }}>{selectedPo.po_date || new Date(selectedPo.created_at || Date.now()).toLocaleDateString('en-IN')}</div>
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-ghost)', fontWeight: 700 }}>CURRENT STATUS</div>
                <div style={{ fontSize: '12px', fontWeight: 750, marginTop: '2px', textTransform: 'uppercase', color: selectedPo.status === 'completed' ? '#16a34a' : selectedPo.status === 'supervisor_review' ? '#1d4ed8' : 'var(--primary)' }}>{getStatusLabel(selectedPo.status)}</div>
              </div>
            </div>

            {selectedPo.remarks && (
              <div style={{ background: '#fffbeb', borderLeft: '4px solid #f59e0b', padding: '16px', borderRadius: '8px', fontSize: '13px' }}>
                <div style={{ fontWeight: 800, color: '#d97706', marginBottom: '4px', textTransform: 'uppercase', fontSize: '11px' }}>🔒 Private Remarks / Instructions</div>
                <div style={{ color: '#92400e', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{selectedPo.remarks}</div>
              </div>
            )}

            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '10px 12px' }}>Category</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px' }}>Material</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px' }}>Description</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px' }}>Size</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px' }}>Current Stock</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px' }}>Req Qty</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px' }}>Received Qty</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px' }}>Pending Qty</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px' }}>Rate</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedPo.items || []).map((item: any, i: number) => {
                    const reqQty = Number(item.required_qty || 0);
                    const recQty = Number(item.received_qty || 0);
                    const pendQty = Math.max(0, reqQty - recQty);
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-ghost)', fontSize: '11px' }}>{item.category || '—'}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700 }}>{item.material_code || '—'}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{item.material_name || '—'}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{item.size_thickness}</td>
                        <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{Number(item.current_stock || 0).toLocaleString()} {item.current_stock_unit || ''}</td>
                        <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700, fontFamily: 'monospace' }}>{reqQty.toLocaleString()} {item.unit || 'Pair'}</td>
                        <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700, fontFamily: 'monospace', color: '#16a34a' }}>{recQty.toLocaleString()} {item.unit || 'Pair'}</td>
                        <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700, fontFamily: 'monospace', color: pendQty > 0 ? '#ef4444' : 'var(--text-muted)' }}>{pendQty.toLocaleString()} {item.unit || 'Pair'}</td>
                        <td style={{ textAlign: 'right', padding: '10px 12px', fontFamily: 'monospace' }}>₹{Number(item.order_rate || 0).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 800, fontFamily: 'monospace' }}>₹{Number(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Gross Total: <strong>₹{(selectedPo.gross_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></div>
              <div style={{ fontSize: '13px', color: '#ef4444' }}>Discount: <strong>-{(selectedPo.discount_percent ?? 0)}%</strong></div>
              <div style={{ fontSize: '15px', color: 'var(--primary)', fontWeight: 800 }}>Net Total: <strong>₹{(selectedPo.net_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button className="btn-corp" onClick={() => setSelectedPo(null)}>Close Tracker Details</button>
            </div>
          </div>
        </div>
      )}

      {showPreview && selectedPo && (
        <POPreviewModal
          po={selectedPo}
          items={selectedPo.items}
          onClose={() => setShowPreview(false)}
        />
      )}

    </div>
  );
}
