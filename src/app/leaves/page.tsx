'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, differenceInCalendarDays, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

export default function LeaveApplicationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Custom Action Popup State
  const [actionPopup, setActionPopup] = useState<{show: boolean; message: string; type: 'success' | 'error'}>({ show: false, message: '', type: 'success' });

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    department: '',
    leave_type: 'Annual Leave',
    start_date: '',
    end_date: '',
    reason: '',
    supervisor_id: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const sessionRes = await fetch('/api/auth/me');
      if (!sessionRes.ok) throw new Error('Not logged in');
      const session = await sessionRes.json();
      setUser(session.user);

      const leavesRes = await fetch('/api/leaves');
      if (leavesRes.ok) {
        const data = await leavesRes.json();
        setLeaves(data.leaves || []);
      }

      if (session.user.role === 'worker') {
        try {
          const usersRes = await fetch('/api/leaves/supervisors');
          if (usersRes.ok) {
            const uData = await usersRes.json();
            setSupervisors(uData.supervisors || []);
          }
        } catch (err) {
          console.warn('Could not fetch supervisors', err);
        }
      }
    } catch (err) {
      console.error(err);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    if (e < s) return 0;
    return differenceInCalendarDays(e, s) + 1;
  };

  const totalDays = calculateTotalDays(formData.start_date, formData.end_date);

  const calculateLeavesThisMonth = () => {
    if (!user) return 0;
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    
    return leaves
      .filter(l => l.user_id === user.id && l.status === 'approved')
      .filter(l => isWithinInterval(new Date(l.start_date), { start, end }))
      .reduce((sum, l) => sum + l.total_days, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, total_days: totalDays })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit application');
      
      setShowForm(false);
      setFormData({
        department: '',
        leave_type: 'Annual Leave',
        start_date: '',
        end_date: '',
        reason: '',
        supervisor_id: ''
      });
      fetchData();
      alert('Leave Application Submitted Successfully!');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (id: number, action: string) => {
    try {
      const res = await fetch(`/api/leaves/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, remarks: '' })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update status');
      }
      const data = await res.json();
      
      // Determine message and next stage based on action and new status
      let msg = '';
      if (action === 'approve') {
        if (data.newStatus === 'pending_pm') msg = 'Leave Pre-Approved. Next stage: PM Approval.';
        else if (data.newStatus === 'pending_admin') msg = 'Leave Approved. Next stage: Final Sanction (Admin).';
        else if (data.newStatus === 'approved') msg = 'Leave Successfully Sanctioned.';
        else msg = 'Leave Approved.';
      } else if (action === 'return') {
        msg = 'Leave Application Returned.';
      } else {
        msg = 'Leave Application Rejected.';
      }

      setActionPopup({ show: true, message: msg, type: 'success' });
      setTimeout(() => setActionPopup({ show: false, message: '', type: 'success' }), 4000);

      // Optimistically remove or update the leave from the UI list
      setLeaves(prev => prev.filter(l => l.id !== id));
      
    } catch (err: any) {
      setActionPopup({ show: true, message: err.message, type: 'error' });
      setTimeout(() => setActionPopup({ show: false, message: '', type: 'success' }), 4000);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
        <div className="loading-dot" />
        <span style={{ color: 'var(--text-ghost)', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Loading Module...</span>
      </div>
    );
  }

  return (
    <div className="fade-up" style={{ 
      display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '1000px', margin: '0 auto', 
      paddingBottom: '40px', fontFamily: '"Inter", "Segoe UI", sans-serif', position: 'relative'
    }}>
      
      {/* ── ACTION POPUP (Custom) ── */}
      {actionPopup.show && (
        <div style={{
          position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)',
          background: actionPopup.type === 'success' ? '#0f172a' : '#ef4444', 
          color: '#ffffff', padding: '16px 24px', borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)', zIndex: 99999,
          display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 700,
          animation: 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <span style={{ fontSize: '20px' }}>{actionPopup.type === 'success' ? '✅' : '⚠️'}</span>
          {actionPopup.message}
        </div>
      )}
      
      {/* ── HEADER ── */}
      <div style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px',
        background: 'linear-gradient(145deg, #ffffff, #f8fafc)', padding: '24px 32px', borderRadius: '24px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.03), inset 0 2px 0 rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.05)'
      }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 900, margin: 0, color: '#0f172a', letterSpacing: '-0.5px' }}>Leave Management</h1>
          <p style={{ fontSize: '14px', color: '#64748b', marginTop: '4px', fontWeight: 500 }}>Streamlined Time-Off Requests & Approvals</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {(user?.role === 'admin' || user?.role === 'pm') && (
            <Link href="/leaves/history" style={{
              background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1',
              padding: '12px 24px', borderRadius: '12px', fontWeight: 800, fontSize: '14px',
              textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
              📊 History
            </Link>
          )}
          <button 
            onClick={() => { setShowForm(!showForm); setErrorMsg(''); }}
            style={{ 
              background: showForm ? '#f1f5f9' : 'linear-gradient(135deg, #e11d48, #be123c)',
              color: showForm ? '#475569' : '#ffffff',
              border: showForm ? '1px solid #cbd5e1' : 'none',
              padding: '12px 24px', borderRadius: '12px', fontWeight: 800, fontSize: '14px',
              cursor: 'pointer', boxShadow: showForm ? 'none' : '0 8px 20px rgba(225,29,72,0.3)',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}
            onMouseEnter={e => !showForm && (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={e => !showForm && (e.currentTarget.style.transform = 'none')}
          >
            {showForm ? '✕ Close Form' : '➕ Create Application'}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div style={{ background: '#fef2f2', borderLeft: '4px solid #ef4444', color: '#b91c1c', padding: '16px', borderRadius: '12px', fontWeight: 600 }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {/* ── THE APPLICATION FORM ── */}
      {showForm && (
        <div style={{ 
          background: '#ffffff', borderRadius: '24px', padding: '0', 
          boxShadow: '0 20px 40px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)', 
          border: '1px solid #e2e8f0', overflow: 'hidden', position: 'relative'
        }}>
          {/* Top Edge Accent */}
          <div style={{ height: '6px', width: '100%', background: 'linear-gradient(90deg, #e11d48, #f43f5e, #fbbf24)' }} />
          
          <div style={{ padding: '40px 48px' }}>
            {/* Corporate Header Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #f1f5f9', paddingBottom: '32px', marginBottom: '32px', flexWrap: 'wrap', gap: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
                  <img src="/lunars-logo.png" alt="Lunar's Viking" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                <div>
                  <h2 style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a', letterSpacing: '0.05em', textTransform: 'uppercase', margin: 0 }}>Lunar's Viking</h2>
                  <p style={{ color: '#e11d48', fontSize: '11px', fontWeight: 800, letterSpacing: '0.2em', marginTop: '6px', textTransform: 'uppercase' }}>Official Leave Application</p>
                </div>
              </div>
              <div style={{ background: '#f8fafc', padding: '16px 24px', borderRadius: '16px', border: '1px dashed #cbd5e1', textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Current Date</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{format(new Date(), 'dd MMM yyyy')}</div>
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Approved This Month</div>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#e11d48', marginTop: '2px' }}>{calculateLeavesThisMonth()} <span style={{ fontSize: '12px', fontWeight: 700, color: '#f43f5e' }}>Days</span></div>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              
              {/* Applicant Info Banner */}
              <div style={{ 
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px',
                background: '#f8fafc', padding: '24px', borderRadius: '16px', borderLeft: '4px solid #3b82f6'
              }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Applicant Name</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{user?.full_name}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Contact Number</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#334155' }}>{user?.phone || 'Not Provided'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>System Role</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#2563eb', textTransform: 'capitalize' }}>{user?.role}</div>
                </div>
              </div>

              {/* Form Inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Department</label>
                  <input required type="text" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})}
                    placeholder="e.g. Production, HR, Sales"
                    style={{ padding: '16px', border: '1.5px solid #cbd5e1', borderRadius: '12px', fontSize: '14px', fontWeight: 600, outline: 'none', transition: 'border-color 0.2s', width: '100%', boxSizing: 'border-box' }}
                    onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'}
                    onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Leave Category</label>
                  <select required value={formData.leave_type} onChange={e => setFormData({...formData, leave_type: e.target.value})}
                    style={{ padding: '16px', border: '1.5px solid #cbd5e1', borderRadius: '12px', fontSize: '14px', fontWeight: 600, outline: 'none', transition: 'border-color 0.2s', width: '100%', boxSizing: 'border-box', backgroundColor: '#fff', cursor: 'pointer' }}
                    onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'}
                    onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                  >
                    <option>Annual Leave</option>
                    <option>Sick Leave</option>
                    <option>Casual Leave</option>
                    <option>Maternity/Paternity Leave</option>
                    <option>Unpaid Leave</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>From Date</label>
                  <input required type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})}
                    style={{ padding: '16px', border: '1.5px solid #cbd5e1', borderRadius: '12px', fontSize: '14px', fontWeight: 600, outline: 'none', transition: 'border-color 0.2s', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }}
                    onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'}
                    onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>To Date</label>
                  <input required type="date" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})}
                    style={{ padding: '16px', border: '1.5px solid #cbd5e1', borderRadius: '12px', fontSize: '14px', fontWeight: 600, outline: 'none', transition: 'border-color 0.2s', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }}
                    onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'}
                    onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Duration</label>
                  <div style={{ padding: '14px 16px', border: '1.5px solid #e2e8f0', background: '#f8fafc', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a' }}>{totalDays > 0 ? totalDays : '-'}</span>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>Days</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Detailed Reason</label>
                <textarea required rows={4} value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})}
                  placeholder="Please provide clear justification for your leave request..."
                  style={{ padding: '16px', border: '1.5px solid #cbd5e1', borderRadius: '12px', fontSize: '14px', fontWeight: 500, outline: 'none', transition: 'border-color 0.2s', width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
                  onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'}
                  onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                />
              </div>

              {user?.role === 'worker' && (
                <div style={{ background: '#eff6ff', border: '1.5px dashed #bfdbfe', borderRadius: '16px', padding: '24px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Required: Select Approving Supervisor</label>
                  <select required value={formData.supervisor_id} onChange={e => setFormData({...formData, supervisor_id: e.target.value})}
                    style={{ padding: '16px', border: '1.5px solid #93c5fd', borderRadius: '12px', fontSize: '14px', fontWeight: 700, color: '#1e3a8a', outline: 'none', transition: 'border-color 0.2s', width: '100%', boxSizing: 'border-box', backgroundColor: '#ffffff', cursor: 'pointer' }}
                  >
                    <option value="">-- Click to Assign Supervisor --</option>
                    {supervisors.map(s => (
                      <option key={s.id} value={s.id}>{s.full_name} ({s.role.toUpperCase()})</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ paddingTop: '24px', borderTop: '2px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
                <button 
                  type="submit" 
                  disabled={submitting || totalDays <= 0}
                  style={{ 
                    background: (submitting || totalDays <= 0) ? '#cbd5e1' : 'linear-gradient(135deg, #0f172a, #334155)',
                    color: '#ffffff', border: 'none', padding: '16px 40px', borderRadius: '12px', fontWeight: 800, fontSize: '14px',
                    cursor: (submitting || totalDays <= 0) ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em',
                    boxShadow: (submitting || totalDays <= 0) ? 'none' : '0 10px 25px rgba(15,23,42,0.2)',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                  onMouseEnter={e => !(submitting || totalDays <= 0) && (e.currentTarget.style.transform = 'translateY(-2px)')}
                  onMouseLeave={e => !(submitting || totalDays <= 0) && (e.currentTarget.style.transform = 'none')}
                >
                  {submitting ? 'Processing...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── HISTORY / LEDGER ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Application Ledger</h2>
          <div style={{ flex: 1, height: '2px', background: 'linear-gradient(90deg, #e2e8f0, transparent)' }} />
        </div>

        {leaves.length === 0 ? (
          <div style={{ background: '#ffffff', borderRadius: '24px', padding: '64px 24px', textAlign: 'center', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>📂</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#475569' }}>No Leave Records Found</div>
            <div style={{ fontSize: '14px', color: '#94a3b8', marginTop: '8px' }}>Applications you submit or receive for approval will appear here.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {leaves.map((leave) => (
              <div key={leave.id} style={{ 
                background: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0',
                padding: '24px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
                display: 'flex', flexDirection: 'column', gap: '20px'
              }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  
                  {/* Left block: Days + Info */}
                  <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', flex: 1 }}>
                    <div style={{ 
                      width: '80px', height: '80px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <span style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{leave.total_days}</span>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '4px' }}>Days</span>
                    </div>

                    <div style={{ flex: 1, minWidth: '250px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        <span style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{leave.emp_name}</span>
                        <span style={{ padding: '4px 10px', background: '#f1f5f9', borderRadius: '20px', fontSize: '10px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{leave.role}</span>
                        <span style={{ padding: '4px 10px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '20px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{leave.leave_type}</span>
                        {(user?.role === 'admin' || user?.role === 'pm') && leave.this_month_taken !== undefined && (
                          <span style={{ padding: '4px 10px', background: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', borderRadius: '20px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Taken This Month: {leave.this_month_taken} Days
                          </span>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '12px' }}>
                        <span>🗓 {format(new Date(leave.start_date), 'dd MMM yyyy')}</span>
                        <span>→</span>
                        <span>{format(new Date(leave.end_date), 'dd MMM yyyy')}</span>
                      </div>

                      <div style={{ background: '#f8fafc', borderLeft: '3px solid #cbd5e1', padding: '12px 16px', borderRadius: '0 8px 8px 0', fontSize: '13px', color: '#475569', fontStyle: 'italic', lineHeight: 1.5 }}>
                        "{leave.reason}"
                      </div>

                      {leave.supervisor_name && (
                        <div style={{ marginTop: '12px', fontSize: '12px', fontWeight: 600, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3b82f6' }} />
                          Routing via Supervisor: {leave.supervisor_name}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right block: Status & Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '16px', minWidth: '180px' }}>
                    <StatusBadge status={leave.status} />

                    {canActionLeave(user, leave) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                        <button onClick={() => handleAction(leave.id, 'approve')} style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '10px 16px', borderRadius: '10px', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s', width: '100%' }} onMouseEnter={e => e.currentTarget.style.background = '#dcfce7'} onMouseLeave={e => e.currentTarget.style.background = '#f0fdf4'}>✓ Approve</button>
                        <button onClick={() => handleAction(leave.id, 'return')} style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', padding: '10px 16px', borderRadius: '10px', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s', width: '100%' }} onMouseEnter={e => e.currentTarget.style.background = '#fef3c7'} onMouseLeave={e => e.currentTarget.style.background = '#fffbeb'}>↺ Return</button>
                        <button onClick={() => handleAction(leave.id, 'reject')} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '10px 16px', borderRadius: '10px', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s', width: '100%' }} onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'} onMouseLeave={e => e.currentTarget.style.background = '#fef2f2'}>✕ Reject</button>
                      </div>
                    )}
                  </div>
                </div>

                {(leave.supervisor_remarks || leave.pm_remarks || leave.admin_remarks) && (
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    {leave.supervisor_remarks && (
                      <div style={{ background: '#fffbeb', padding: '12px 16px', borderRadius: '12px', border: '1px solid #fef3c7' }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Supervisor Remarks</div>
                        <div style={{ fontSize: '13px', color: '#92400e' }}>{leave.supervisor_remarks}</div>
                      </div>
                    )}
                    {leave.pm_remarks && (
                      <div style={{ background: '#eff6ff', padding: '12px 16px', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>PM Remarks</div>
                        <div style={{ fontSize: '13px', color: '#1e3a8a' }}>{leave.pm_remarks}</div>
                      </div>
                    )}
                    {leave.admin_remarks && (
                      <div style={{ background: '#fef2f2', padding: '12px 16px', borderRadius: '12px', border: '1px solid #fee2e2' }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Admin Remarks</div>
                        <div style={{ fontSize: '13px', color: '#991b1b' }}>{leave.admin_remarks}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

// Helpers
function canActionLeave(user: any, leave: any) {
  if (!user) return false;
  if (user.role === 'admin' && ['pending_admin', 'pending_pm', 'pending_supervisor'].includes(leave.status)) return true;
  if (user.role === 'pm' && leave.status === 'pending_pm') return true;
  if (user.role === 'supervisor' && leave.supervisor_id === user.id && leave.status === 'pending_supervisor') return true;
  return false;
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { bg: string, color: string, border: string, label: string }> = {
    'pending_supervisor': { bg: '#fef9c3', color: '#a16207', border: '#fef08a', label: 'Pending Supervisor' },
    'pending_pm': { bg: '#e0e7ff', color: '#4338ca', border: '#c7d2fe', label: 'Pending PM' },
    'pending_admin': { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', label: 'Pending Admin' },
    'approved': { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', label: 'Approved' },
    'rejected_by_supervisor': { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', label: 'Rejected (Supervisor)' },
    'rejected_by_pm': { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', label: 'Rejected (PM)' },
    'rejected_by_admin': { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', label: 'Rejected (Admin)' },
    'returned_by_supervisor': { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', label: 'Returned (Supervisor)' },
    'returned_by_pm': { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', label: 'Returned (PM)' },
    'returned_by_admin': { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', label: 'Returned (Admin)' },
  };

  const config = configs[status] || { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', label: status };

  return (
    <div style={{ 
      background: config.bg, color: config.color, border: `1px solid ${config.border}`,
      padding: '8px 16px', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '8px'
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: config.color, display: 'inline-block' }} />
      <span style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{config.label}</span>
    </div>
  );
}
