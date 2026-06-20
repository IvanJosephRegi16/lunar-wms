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
      // 1. Fetch User Session
      const sessionRes = await fetch('/api/auth/session');
      if (!sessionRes.ok) throw new Error('Not logged in');
      const session = await sessionRes.json();
      setUser(session.user);

      // 2. Fetch Leaves
      const leavesRes = await fetch('/api/leaves');
      if (leavesRes.ok) {
        const data = await leavesRes.json();
        setLeaves(data.leaves || []);
      }

      // 3. Fetch Supervisors (Only needed if worker)
      if (session.user.role === 'worker') {
        const usersRes = await fetch('/api/user/list'); // Assuming an endpoint exists, or we might need one
        if (usersRes.ok) {
          const uData = await usersRes.json();
          setSupervisors(uData.users.filter((u: any) => u.role === 'supervisor' || u.role === 'admin'));
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
    setSubmitting(true);
    try {
      const res = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          total_days: totalDays
        })
      });

      if (!res.ok) throw new Error('Failed to submit application');
      
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
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (id: number, action: string) => {
    const remarks = prompt(`Enter remarks for ${action.toUpperCase()} (optional):`);
    if (remarks === null) return; // Cancelled

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

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-md">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Leave Management</h1>
            <p className="text-gray-400 mt-1">Manage and track your leave applications systematically.</p>
          </div>
          <button 
            onClick={() => setShowForm(!showForm)}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)] hover:shadow-[0_0_30px_rgba(220,38,38,0.5)]"
          >
            {showForm ? 'Cancel Application' : '+ New Leave Application'}
          </button>
        </div>

        {/* Dynamic Form Area */}
        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${showForm ? 'opacity-100 max-h-[2000px] mb-8' : 'opacity-0 max-h-0'}`}>
          {showForm && (
            <div className="bg-[#111] border border-white/10 rounded-2xl p-8 relative shadow-2xl">
              {/* Corporate Header */}
                <div className="flex flex-col md:flex-row justify-between items-center border-b border-white/10 pb-6 mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center p-2">
                      <img src="/lunars-logo.png" alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white tracking-widest uppercase">Lunar's Viking</h2>
                      <p className="text-xs text-gray-400 tracking-wider">OFFICIAL LEAVE APPLICATION FORM</p>
                    </div>
                  </div>
                  <div className="text-right mt-4 md:mt-0">
                    <p className="text-sm text-gray-400">Date: {format(new Date(), 'dd MMM yyyy')}</p>
                    <p className="text-sm text-gray-400">Approved Leaves This Month: <span className="text-red-500 font-bold">{calculateLeavesThisMonth()} Days</span></p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Applicant Details (Auto-filled) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white/5 p-5 rounded-xl border border-white/5">
                    <div>
                      <label className="block text-xs uppercase text-gray-500 mb-1">Applicant Name</label>
                      <div className="text-lg font-medium">{user?.full_name}</div>
                    </div>
                    <div>
                      <label className="block text-xs uppercase text-gray-500 mb-1">Phone Number</label>
                      <div className="text-lg font-medium">{user?.phone || 'N/A'}</div>
                    </div>
                    <div>
                      <label className="block text-xs uppercase text-gray-500 mb-1">Role</label>
                      <div className="text-lg font-medium capitalize">{user?.role}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Department</label>
                      <input 
                        required
                        type="text" 
                        value={formData.department}
                        onChange={e => setFormData({...formData, department: e.target.value})}
                        className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-red-500 outline-none transition-all"
                        placeholder="e.g., Production, HR, Sales"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Leave Type</label>
                      <select 
                        required
                        value={formData.leave_type}
                        onChange={e => setFormData({...formData, leave_type: e.target.value})}
                        className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-red-500 outline-none transition-all"
                      >
                        <option>Annual Leave</option>
                        <option>Sick Leave</option>
                        <option>Casual Leave</option>
                        <option>Maternity/Paternity Leave</option>
                        <option>Unpaid Leave</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">From Date</label>
                      <input 
                        required
                        type="date" 
                        value={formData.start_date}
                        onChange={e => setFormData({...formData, start_date: e.target.value})}
                        className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-red-500 outline-none [color-scheme:dark]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">To Date</label>
                      <input 
                        required
                        type="date" 
                        value={formData.end_date}
                        onChange={e => setFormData({...formData, end_date: e.target.value})}
                        className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-red-500 outline-none [color-scheme:dark]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Total Days</label>
                      <div className="w-full bg-[#1a1a1a]/50 border border-white/5 rounded-xl px-4 py-3 text-red-500 font-bold text-xl flex items-center">
                        {totalDays > 0 ? `${totalDays} Days` : '-'}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Reason for Leave</label>
                    <textarea 
                      required
                      rows={3}
                      value={formData.reason}
                      onChange={e => setFormData({...formData, reason: e.target.value})}
                      className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-red-500 outline-none transition-all resize-none"
                      placeholder="Please provide a detailed reason..."
                    />
                  </div>

                  {user?.role === 'worker' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Select Supervisor for Approval</label>
                      <select 
                        required
                        value={formData.supervisor_id}
                        onChange={e => setFormData({...formData, supervisor_id: e.target.value})}
                        className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-red-500 outline-none transition-all"
                      >
                        <option value="">-- Choose Supervisor --</option>
                        {supervisors.map(s => (
                          <option key={s.id} value={s.id}>Supervisor - {s.full_name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex justify-end pt-4 border-t border-white/10">
                    <button 
                      type="submit" 
                      disabled={submitting || totalDays <= 0}
                      className="px-8 py-4 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg flex items-center gap-2 uppercase tracking-wider text-sm"
                    >
                      {submitting ? 'Submitting...' : 'Submit Application Form'}
                    </button>
                  </div>
                </form>
            </div>
          )}
        </div>

        {/* Applications List */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold border-b border-white/10 pb-4">Recent Applications</h2>
          
          <div className="grid grid-cols-1 gap-4">
            {leaves.length === 0 ? (
              <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/10 text-gray-500">
                No leave applications found.
              </div>
            ) : leaves.map((leave) => (
              <div key={leave.id} className="bg-[#111] border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all shadow-lg">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  
                  {/* Info Section */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold">{leave.emp_name}</h3>
                      <span className="px-2 py-0.5 bg-white/10 rounded text-xs text-gray-300 capitalize">{leave.role}</span>
                      <span className="px-2 py-0.5 bg-red-500/10 text-red-400 rounded text-xs font-semibold">{leave.leave_type}</span>
                    </div>
                    <div className="text-sm text-gray-400 mb-3 space-y-1">
                      <p>🗓 {format(new Date(leave.start_date), 'dd MMM yyyy')} to {format(new Date(leave.end_date), 'dd MMM yyyy')} ({leave.total_days} Days)</p>
                      <p className="text-gray-300">"{leave.reason}"</p>
                    </div>
                    {leave.supervisor_name && (
                      <p className="text-xs text-gray-500">Assigned Supervisor: {leave.supervisor_name}</p>
                    )}
                  </div>

                  {/* Status & Actions Section */}
                  <div className="flex flex-col items-end gap-3 min-w-[200px]">
                    <StatusBadge status={leave.status} />
                    
                    {/* Action Buttons for Supervisors / Admins */}
                    {canActionLeave(user, leave) && (
                      <div className="flex gap-2 w-full mt-2">
                        <button onClick={() => handleAction(leave.id, 'approve')} className="flex-1 py-1.5 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded font-medium text-sm transition-colors">Approve</button>
                        <button onClick={() => handleAction(leave.id, 'return')} className="flex-1 py-1.5 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 rounded font-medium text-sm transition-colors">Return</button>
                        <button onClick={() => handleAction(leave.id, 'reject')} className="flex-1 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded font-medium text-sm transition-colors">Reject</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Remarks Display */}
                {(leave.supervisor_remarks || leave.admin_remarks) && (
                  <div className="mt-4 pt-4 border-t border-white/5 bg-black/20 p-4 rounded-xl text-sm">
                    {leave.supervisor_remarks && <p><span className="text-yellow-500 font-semibold">Supervisor Remarks:</span> {leave.supervisor_remarks}</p>}
                    {leave.admin_remarks && <p className="mt-1"><span className="text-red-500 font-semibold">Admin Remarks:</span> {leave.admin_remarks}</p>}
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
  const colors: Record<string, string> = {
    'pending_supervisor': 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20',
    'pending_admin': 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    'approved': 'bg-green-500/10 text-green-400 border border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.2)]',
    'rejected_by_supervisor': 'bg-red-500/10 text-red-500 border border-red-500/20',
    'rejected_by_admin': 'bg-red-500/10 text-red-500 border border-red-500/20',
    'returned_by_supervisor': 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
    'returned_by_admin': 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  };

  const labels: Record<string, string> = {
    'pending_supervisor': 'Pending Supervisor',
    'pending_admin': 'Pending Admin',
    'approved': 'Approved',
    'rejected_by_supervisor': 'Rejected (Supervisor)',
    'rejected_by_admin': 'Rejected (Admin)',
    'returned_by_supervisor': 'Returned (Supervisor)',
    'returned_by_admin': 'Returned (Admin)',
  };

  return (
    <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${colors[status] || 'bg-gray-500/10 text-gray-400'}`}>
      {labels[status] || status}
    </div>
  );
}
