'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format, differenceInCalendarDays, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

export default function LeaveApplicationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

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
    const remarks = prompt(`Enter remarks for ${action.toUpperCase()} (optional):`);
    if (remarks === null) return;

    try {
      const res = await fetch(`/api/leaves/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, remarks })
      });
      if (!res.ok) throw new Error('Failed to update status');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-gray-400 font-medium tracking-widest uppercase text-sm">Loading Application...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-4 md:p-8 font-sans relative overflow-x-hidden">
      {/* Premium Background Effects */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-red-900 blur-[150px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900 blur-[180px]"></div>
      </div>

      <div className="max-w-7xl mx-auto space-y-10 relative z-10">
        
        {/* Dynamic Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white/[0.02] p-8 rounded-3xl border border-white/5 backdrop-blur-xl shadow-2xl">
          <div>
            <h1 className="text-4xl font-extrabold bg-gradient-to-br from-white via-gray-200 to-gray-500 bg-clip-text text-transparent mb-2">Leave Management</h1>
            <p className="text-gray-400 text-sm font-medium tracking-wide">Streamlined Time-Off Requests & Approvals</p>
          </div>
          <button 
            onClick={() => { setShowForm(!showForm); setErrorMsg(''); }}
            className={`px-8 py-4 font-bold rounded-xl transition-all duration-300 shadow-xl uppercase tracking-wider text-sm flex items-center gap-3 ${
              showForm 
                ? 'bg-white/10 text-white hover:bg-white/20 border border-white/20' 
                : 'bg-gradient-to-r from-red-600 to-red-800 text-white hover:scale-105 hover:shadow-[0_0_30px_rgba(220,38,38,0.4)] border border-red-500/50'
            }`}
          >
            {showForm ? '✕ Close Form' : '➕ Create Application'}
          </button>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl flex items-center gap-3 font-medium">
            <span>⚠️</span> {errorMsg}
          </div>
        )}

        {/* The Application Form (Premium Design) */}
        <div className={`transition-all duration-500 ease-in-out origin-top ${showForm ? 'opacity-100 scale-y-100 mb-10' : 'opacity-0 scale-y-0 h-0 hidden'}`}>
          <div className="bg-[#111116] border border-white/10 rounded-3xl p-8 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
            
            {/* Form Background Texture */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
            
            {/* Form Header (Corporate Identity) */}
            <div className="flex flex-col md:flex-row justify-between items-center border-b border-white/10 pb-8 mb-8 relative z-10">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center p-3 shadow-lg ring-4 ring-white/5">
                  <img src="/lunars-logo.png" alt="Lunar's Viking" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-white tracking-[0.2em] uppercase">Lunar's Viking</h2>
                  <p className="text-red-500 text-xs font-bold tracking-[0.3em] mt-2">OFFICIAL LEAVE APPLICATION</p>
                </div>
              </div>
              <div className="text-right mt-6 md:mt-0 bg-white/5 p-4 rounded-xl border border-white/10">
                <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Current Date</p>
                <p className="text-lg font-medium text-white">{format(new Date(), 'dd MMM yyyy')}</p>
                <div className="mt-3 pt-3 border-t border-white/10">
                  <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Approved This Month</p>
                  <p className="text-2xl font-black text-red-500">{calculateLeavesThisMonth()} <span className="text-sm font-medium text-red-400">Days</span></p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
              
              {/* Applicant Profile Bar */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gradient-to-r from-white/5 to-transparent p-6 rounded-2xl border-l-4 border-red-600">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 tracking-widest mb-2">Applicant Name</label>
                  <div className="text-xl font-bold text-white">{user?.full_name}</div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 tracking-widest mb-2">Contact Number</label>
                  <div className="text-xl font-bold text-gray-200">{user?.phone || 'Not Provided'}</div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 tracking-widest mb-2">System Role</label>
                  <div className="text-xl font-bold text-red-400 capitalize">{user?.role}</div>
                </div>
              </div>

              {/* Form Inputs Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase text-gray-400 tracking-wider ml-1">Department</label>
                  <input 
                    required
                    type="text" 
                    value={formData.department}
                    onChange={e => setFormData({...formData, department: e.target.value})}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-5 py-4 text-white font-medium focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
                    placeholder="e.g. Production, HR, Sales"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase text-gray-400 tracking-wider ml-1">Leave Category</label>
                  <select 
                    required
                    value={formData.leave_type}
                    onChange={e => setFormData({...formData, leave_type: e.target.value})}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-5 py-4 text-white font-medium focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option>Annual Leave</option>
                    <option>Sick Leave</option>
                    <option>Casual Leave</option>
                    <option>Maternity/Paternity Leave</option>
                    <option>Unpaid Leave</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase text-gray-400 tracking-wider ml-1">From Date</label>
                  <input 
                    required
                    type="date" 
                    value={formData.start_date}
                    onChange={e => setFormData({...formData, start_date: e.target.value})}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-5 py-4 text-white font-medium focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all [color-scheme:dark]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase text-gray-400 tracking-wider ml-1">To Date</label>
                  <input 
                    required
                    type="date" 
                    value={formData.end_date}
                    onChange={e => setFormData({...formData, end_date: e.target.value})}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-5 py-4 text-white font-medium focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all [color-scheme:dark]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase text-gray-400 tracking-wider ml-1">Total Duration</label>
                  <div className="w-full bg-black/20 border border-white/5 rounded-xl px-5 py-4 text-white flex items-center justify-center gap-2">
                    <span className="text-3xl font-black text-red-500">{totalDays > 0 ? totalDays : '-'}</span>
                    <span className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1">Days</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase text-gray-400 tracking-wider ml-1">Detailed Reason</label>
                <textarea 
                  required
                  rows={4}
                  value={formData.reason}
                  onChange={e => setFormData({...formData, reason: e.target.value})}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-5 py-4 text-white font-medium focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all resize-none"
                  placeholder="Please provide clear justification for your leave request..."
                />
              </div>

              {user?.role === 'worker' && (
                <div className="space-y-2 p-6 bg-blue-900/10 border border-blue-500/20 rounded-2xl">
                  <label className="block text-xs font-bold uppercase text-blue-400 tracking-wider ml-1 mb-3">Required: Select Approving Supervisor</label>
                  <select 
                    required
                    value={formData.supervisor_id}
                    onChange={e => setFormData({...formData, supervisor_id: e.target.value})}
                    className="w-full bg-black/50 border border-blue-500/30 rounded-xl px-5 py-4 text-white font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="">-- Click to Assign Supervisor --</option>
                    {supervisors.map(s => (
                      <option key={s.id} value={s.id}>{s.full_name} ({s.role.toUpperCase()})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Submit Footer */}
              <div className="pt-8 border-t border-white/10 flex justify-end">
                <button 
                  type="submit" 
                  disabled={submitting || totalDays <= 0}
                  className="w-full md:w-auto px-12 py-5 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 disabled:from-gray-700 disabled:to-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-black rounded-xl transition-all duration-300 shadow-[0_10px_40px_rgba(220,38,38,0.3)] hover:shadow-[0_15px_50px_rgba(220,38,38,0.5)] disabled:shadow-none uppercase tracking-[0.2em] text-sm flex justify-center items-center gap-3"
                >
                  {submitting ? (
                    <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Processing...</>
                  ) : (
                    'Submit Application'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* History / Applications List */}
        <div className="space-y-6 relative z-10">
          <div className="flex items-center gap-4 mb-8">
            <h2 className="text-2xl font-black uppercase tracking-widest text-white">Application Ledger</h2>
            <div className="flex-1 h-[1px] bg-gradient-to-r from-white/20 to-transparent"></div>
          </div>
          
          <div className="grid grid-cols-1 gap-6">
            {leaves.length === 0 ? (
              <div className="text-center py-20 bg-white/[0.02] rounded-3xl border border-white/5">
                <div className="text-6xl mb-4 opacity-50">📂</div>
                <h3 className="text-xl font-bold text-gray-300">No Leave Records Found</h3>
                <p className="text-gray-500 mt-2 text-sm">Applications you submit or receive for approval will appear here.</p>
              </div>
            ) : leaves.map((leave) => (
              <div key={leave.id} className="bg-[#111116] border border-white/5 rounded-3xl p-6 md:p-8 hover:border-white/20 transition-all duration-300 shadow-xl group">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8">
                  
                  {/* Ledger Info Block */}
                  <div className="flex-1 flex flex-col md:flex-row gap-6 md:gap-10">
                    {/* Date Block */}
                    <div className="flex flex-col items-center justify-center p-4 bg-white/5 rounded-2xl min-w-[120px] border border-white/10 group-hover:border-white/20 transition-colors">
                      <span className="text-3xl font-black text-white">{leave.total_days}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-1">Days</span>
                    </div>

                    {/* Details Block */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <h3 className="text-xl font-bold text-white">{leave.emp_name}</h3>
                        <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold text-gray-300 uppercase tracking-wider">{leave.role}</span>
                        <span className="px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full text-[10px] font-bold uppercase tracking-wider">{leave.leave_type}</span>
                      </div>
                      
                      <div className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                        <span>🗓 {format(new Date(leave.start_date), 'dd MMM yyyy')}</span>
                        <span className="text-gray-600">→</span>
                        <span>{format(new Date(leave.end_date), 'dd MMM yyyy')}</span>
                      </div>
                      
                      <div className="bg-black/40 p-4 rounded-xl border border-white/5 text-gray-300 text-sm leading-relaxed italic">
                        "{leave.reason}"
                      </div>
                      
                      {leave.supervisor_name && (
                        <p className="text-xs font-medium text-blue-400 mt-4 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                          Routing via Supervisor: {leave.supervisor_name}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions & Status Block */}
                  <div className="w-full xl:w-auto flex flex-col items-start xl:items-end gap-5 pl-0 xl:pl-8 xl:border-l border-white/10">
                    <StatusBadge status={leave.status} />
                    
                    {canActionLeave(user, leave) && (
                      <div className="w-full flex gap-3 mt-2">
                        <button onClick={() => handleAction(leave.id, 'approve')} className="flex-1 xl:flex-none px-6 py-3 bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500 hover:text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all">Approve</button>
                        <button onClick={() => handleAction(leave.id, 'return')} className="flex-1 xl:flex-none px-6 py-3 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500 hover:text-black rounded-xl font-bold text-xs uppercase tracking-wider transition-all">Return</button>
                        <button onClick={() => handleAction(leave.id, 'reject')} className="flex-1 xl:flex-none px-6 py-3 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all">Reject</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Remarks Display */}
                {(leave.supervisor_remarks || leave.admin_remarks) && (
                  <div className="mt-6 pt-6 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {leave.supervisor_remarks && (
                      <div className="bg-yellow-500/5 border border-yellow-500/10 p-4 rounded-xl">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-500 mb-1">Supervisor Remarks</p>
                        <p className="text-sm text-gray-300">{leave.supervisor_remarks}</p>
                      </div>
                    )}
                    {leave.admin_remarks && (
                      <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-xl">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-1">Admin Remarks</p>
                        <p className="text-sm text-gray-300">{leave.admin_remarks}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// Helpers
function canActionLeave(user: any, leave: any) {
  if (!user) return false;
  if (user.role === 'admin' && ['pending_admin', 'pending_supervisor'].includes(leave.status)) return true;
  if (user.role === 'supervisor' && leave.supervisor_id === user.id && leave.status === 'pending_supervisor') return true;
  return false;
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { color: string, label: string, glow: string }> = {
    'pending_supervisor': { color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10', glow: 'shadow-[0_0_15px_rgba(234,179,8,0.2)]', label: 'Pending Supervisor' },
    'pending_admin': { color: 'text-blue-400 border-blue-500/30 bg-blue-500/10', glow: 'shadow-[0_0_15px_rgba(59,130,246,0.2)]', label: 'Pending Admin' },
    'approved': { color: 'text-green-400 border-green-500/30 bg-green-500/10', glow: 'shadow-[0_0_20px_rgba(34,197,94,0.3)]', label: 'Approved' },
    'rejected_by_supervisor': { color: 'text-red-500 border-red-500/30 bg-red-500/10', glow: '', label: 'Rejected (Supervisor)' },
    'rejected_by_admin': { color: 'text-red-500 border-red-500/30 bg-red-500/10', glow: '', label: 'Rejected (Admin)' },
    'returned_by_supervisor': { color: 'text-orange-400 border-orange-500/30 bg-orange-500/10', glow: '', label: 'Returned (Supervisor)' },
    'returned_by_admin': { color: 'text-orange-400 border-orange-500/30 bg-orange-500/10', glow: '', label: 'Returned (Admin)' },
  };

  const config = configs[status] || { color: 'text-gray-400 border-gray-500/30 bg-gray-500/10', glow: '', label: status };

  return (
    <div className={`px-4 py-2 rounded-xl border ${config.color} ${config.glow} flex items-center gap-2`}>
      <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'currentColor' }}></span>
      <span className="text-[11px] font-black uppercase tracking-widest">{config.label}</span>
    </div>
  );
}
