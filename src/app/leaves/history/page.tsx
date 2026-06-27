'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function LeaveHistoryPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [allLeaves, setAllLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);

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
                          <div key={leave.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
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
                            <div style={{ textAlign: 'right', fontSize: '11px', color: '#94a3b8' }}>
                              Applied: {new Date(leave.created_at).toLocaleDateString('en-GB')}
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
    </div>
  );
}
