'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function MyLeaveProfilePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/leaves/my-profile');
        if (!res.ok) {
          throw new Error('Failed to load personal leave profile.');
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '16px' }}>
        <div className="loading-dot" />
        <span style={{ color: 'var(--text-ghost)', fontWeight: 600, fontSize: '13px' }}>Loading your profile...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: '#dc2626', fontWeight: 600 }}>
        {error || 'An error occurred'}
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    if (status === 'approved') return { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', label: 'Approved' };
    if (status.includes('rejected')) return { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', label: 'Rejected' };
    if (status.includes('returned')) return { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', label: 'Returned' };
    return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', label: 'Pending' };
  };

  const { user, stats, leaves } = data;

  return (
    <div className="fade-up" style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', fontFamily: '"Inter", "Segoe UI", sans-serif' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <Link href="/leaves" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: '#475569', fontSize: '18px', fontWeight: 800, transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          ←
        </Link>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.03em' }}>My Leave Profile</h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>Your personal time-off ledger (Private to you)</p>
        </div>
      </div>

      {/* STATS CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <div style={{ background: 'linear-gradient(135deg, #ffffff, #f8fafc)', padding: '24px', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
             <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '24px', boxShadow: '0 8px 16px rgba(59,130,246,0.3)' }}>
                {user.full_name?.[0]?.toUpperCase()}
             </div>
             <div>
               <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a' }}>{user.full_name}</div>
               <div style={{ fontSize: '12px', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '4px' }}>{user.role}</div>
             </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1, background: '#fef2f2', padding: '24px', borderRadius: '24px', border: '1px solid #fee2e2', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', fontWeight: 900, color: '#e11d48', lineHeight: 1 }}>{stats.this_month_taken}</div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#9f1239', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '8px' }}>Taken This Month</div>
          </div>
          <div style={{ flex: 1, background: '#f8fafc', padding: '24px', borderRadius: '24px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{stats.this_year_taken}</div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '8px' }}>Taken This Year</div>
          </div>
        </div>
      </div>

      {/* LEAVES LIST */}
      <h2 style={{ fontSize: '14px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px' }}>Application History</h2>
      
      {leaves.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', background: '#f8fafc', borderRadius: '24px', border: '1px dashed #cbd5e1' }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>🏖️</div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>No leaves found</div>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>You haven't submitted any leave applications yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {leaves.map((leave: any) => {
            const style = getStatusColor(leave.status);
            return (
              <div key={leave.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', background: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>{leave.leave_type}</span>
                    <span style={{ padding: '4px 10px', borderRadius: '20px', background: style.bg, color: style.color, border: `1px solid ${style.border}`, fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {style.label}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px', color: '#475569', fontWeight: 600, marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ opacity: 0.5 }}>📅</span> {new Date(leave.start_date).toLocaleDateString('en-GB')} → {new Date(leave.end_date).toLocaleDateString('en-GB')}
                    </div>
                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#cbd5e1' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a', fontWeight: 800 }}>
                      <span style={{ opacity: 0.5 }}>⏳</span> {leave.total_days} {leave.total_days === 1 ? 'Day' : 'Days'}
                    </div>
                  </div>

                  <div style={{ fontSize: '14px', color: '#334155', background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1px solid #f1f5f9', fontStyle: 'italic' }}>
                    "{leave.reason}"
                  </div>

                  {(leave.supervisor_remarks || leave.pm_remarks || leave.admin_remarks) && (
                    <div style={{ marginTop: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      {leave.supervisor_remarks && (
                        <div style={{ background: '#fffbeb', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', color: '#92400e', fontWeight: 600 }}>
                          <span style={{ color: '#d97706', marginRight: '6px' }}>Supervisor:</span>{leave.supervisor_remarks}
                        </div>
                      )}
                      {leave.pm_remarks && (
                        <div style={{ background: '#eff6ff', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', color: '#1e3a8a', fontWeight: 600 }}>
                          <span style={{ color: '#2563eb', marginRight: '6px' }}>PM:</span>{leave.pm_remarks}
                        </div>
                      )}
                      {leave.admin_remarks && (
                        <div style={{ background: '#fef2f2', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', color: '#991b1b', fontWeight: 600 }}>
                          <span style={{ color: '#dc2626', marginRight: '6px' }}>Admin:</span>{leave.admin_remarks}
                        </div>
                      )}
                    </div>
                  )}

                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Applied
                  </div>
                  <div style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>
                    {new Date(leave.created_at).toLocaleDateString('en-GB')}
                  </div>
                  {leave.supervisor_name && (
                    <div style={{ marginTop: '16px', fontSize: '10px', color: '#cbd5e1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Routing: {leave.supervisor_name}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
