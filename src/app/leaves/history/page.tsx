'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function LeaveHistoryPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [allLeaves, setAllLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [viewModal, setViewModal] = useState<{show: boolean; leave: any}>({ show: false, leave: null });

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/leaves/history');
        if (!res.ok) {
          throw new Error('Failed to load leave history. You may not be authorized.');
        }
        const data = await res.json();
        setUsers(data.users || []);
        setAllLeaves(data.leaves || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '16px' }}>
        <div className="loading-dot" />
        <span style={{ color: 'var(--text-ghost)', fontWeight: 600, fontSize: '13px' }}>Aggregating leave history...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: '#dc2626', fontWeight: 600 }}>
        {error}
      </div>
    );
  }

  const toggleUser = (userId: number) => {
    setExpandedUserId(prev => prev === userId ? null : userId);
  };

  const getStatusColor = (status: string) => {
    if (status === 'approved') return { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', label: 'Approved' };
    if (status.includes('rejected')) return { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', label: 'Rejected' };
    if (status.includes('returned')) return { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', label: 'Returned' };
    return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', label: 'Pending' };
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <Link href="/leaves" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: '#475569', fontSize: '18px', fontWeight: 800, transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          ←
        </Link>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.03em' }}>Leave History & Insights</h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>Comprehensive month-to-date and historical leave ledger</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {users.map(u => {
          const userLeaves = allLeaves.filter(l => l.user_id === u.user_id);
          const isExpanded = expandedUserId === u.user_id;

          return (
            <div key={u.user_id} className="card-clean" style={{ padding: 0, overflow: 'hidden', border: isExpanded ? '2px solid #3b82f6' : '1px solid var(--border)', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
              
              {/* Header Row (Clickable) */}
              <div 
                onClick={() => toggleUser(u.user_id)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', cursor: 'pointer', background: isExpanded ? '#f8fafc' : '#fff' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '16px' }}>
                    {u.emp_name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{u.emp_name}</div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{u.role}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '24px', fontWeight: 900, color: u.this_month_taken > 0 ? '#b91c1c' : '#0f172a', lineHeight: 1 }}>
                      {u.this_month_taken}
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>
                      Days Taken (This Month)
                    </div>
                  </div>
                  <div style={{ color: isExpanded ? '#3b82f6' : '#cbd5e1', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'all 0.3s' }}>
                    ▼
                  </div>
                </div>
              </div>

              {/* Expanded Timeline */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '24px', background: '#fafafa' }}>
                  <h3 style={{ fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px 0' }}>Detailed Application History</h3>
                  
                  {userLeaves.length === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>No leave applications found for this user.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {userLeaves.map(leave => {
                        const style = getStatusColor(leave.status);
                        return (
                          <div 
                            key={leave.id} 
                            onClick={() => setViewModal({ show: true, leave: { ...leave, emp_name: u.emp_name, role: u.role, department: leave.department || 'N/A' } })}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', cursor: 'pointer', transition: 'all 0.2s' }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{leave.leave_type}</span>
                                <span style={{ padding: '2px 8px', borderRadius: '20px', background: style.bg, color: style.color, border: `1px solid ${style.border}`, fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  {style.label}
                                </span>
                              </div>
                              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                                📅 {new Date(leave.start_date).toLocaleDateString('en-GB')} to {new Date(leave.end_date).toLocaleDateString('en-GB')} 
                                <span style={{ margin: '0 8px', color: '#cbd5e1' }}>|</span> 
                                ⏳ {leave.total_days} Days
                              </div>
                              <div style={{ fontSize: '13px', color: '#475569', marginTop: '8px', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                                "{leave.reason}"
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                Applied: {new Date(leave.created_at).toLocaleDateString('en-GB')}
                              </div>
                              <div style={{ fontSize: '11px', fontWeight: 800, color: '#3b82f6', background: '#eff6ff', padding: '4px 8px', borderRadius: '4px' }}>
                                👁️ View Full Form
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── FULL SCREEN VIEW MODAL ── */}
      {viewModal.show && viewModal.leave && (
        <div style={{
          position: 'fixed', top: '0', left: '0', right: '0', bottom: '0',
          background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div className="fade-up" style={{ width: '100%', maxWidth: '800px', maxHeight: '95vh', overflowY: 'auto', background: 'white', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', padding: '40px', position: 'relative' }}>
            <button onClick={() => setViewModal({ show: false, leave: null })} style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', fontSize: '28px', cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}>×</button>
            
            <div style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '24px', marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Official Leave Application Form</div>
                <h2 style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a', margin: 0 }}>{viewModal.leave.emp_name}</h2>
                <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 600, marginTop: '8px' }}>Role: {viewModal.leave.role.toUpperCase()} | Department: {viewModal.leave.department}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Status</div>
                <div style={{ marginTop: '4px', padding: '6px 12px', borderRadius: '20px', background: getStatusColor(viewModal.leave.status).bg, color: getStatusColor(viewModal.leave.status).color, border: `1px solid ${getStatusColor(viewModal.leave.status).border}`, fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {getStatusColor(viewModal.leave.status).label}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
              <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Leave Type</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{viewModal.leave.leave_type}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Duration</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{viewModal.leave.total_days} Days</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Start Date</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{new Date(viewModal.leave.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>End Date</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{new Date(viewModal.leave.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
              </div>
            </div>

            <div style={{ marginBottom: '40px' }}>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Applicant's Reason</div>
              <div style={{ background: '#fefce8', padding: '24px', borderRadius: '16px', border: '1px solid #fef08a', fontSize: '16px', color: '#854d0e', lineHeight: 1.6, fontStyle: 'italic' }}>
                "{viewModal.leave.reason}"
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', borderTop: '2px solid #f1f5f9', paddingTop: '32px' }}>
              <button onClick={() => window.print()} style={{ padding: '16px 40px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🖨️ Print Application View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
