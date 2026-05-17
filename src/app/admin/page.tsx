'use client';

import { useState, useEffect } from 'react';
import { formatToIST } from '@/lib/dateUtils';

export default function AdminPage() {
  // Users list data states
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter states for Users table
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Eyeball password reveal state
  const [revealedPasswords, setRevealedPasswords] = useState<Record<number, boolean>>({});

  // System Audit Logs timeline states
  const [logs, setLogs] = useState<any[]>([]);
  const [logLoading, setLogLoading] = useState(true);
  const [logModuleFilter, setLogModuleFilter] = useState('all');

  // Create User Form Dialog Modal State
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', full_name: '', password: '', phone: '', role: 'operator' });

  // Edit User Form Dialog Modal State
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    username: '',
    full_name: '',
    phone: '',
    password: '',
    role: '',
    is_active: true
  });

  // Sidebar Navigation Visibility configurations
  const [menuConfig, setMenuConfig] = useState<any>({
    dashboard: true,
    users_management: true,
    scanning_intake: false,
    manual_entry: false,
    inventory_pool: true,
    carton_generation: false,
    packed_inventory: true,
    scan_history: true,
    daily_activity: false,
    live_inventory: false,
    stock_movement: false,
    v_strap_entry: false,
    reports_sheets: false,
    po_section: false,
    po_dashboard: true,
    po_create: false,
    po_accountant: true,
    po_completed: true,
    po_history: true,
    po_payment_status: true
  });

  const loadMenuConfig = () => {
    fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_menu_visibility' })
    })
      .then(res => res.json())
      .then(d => {
        if (d.config) {
          setMenuConfig({
            dashboard: true,
            users_management: true,
            scanning_intake: false,
            manual_entry: false,
            inventory_pool: true,
            carton_generation: false,
            packed_inventory: true,
            scan_history: true,
            daily_activity: false,
            live_inventory: false,
            stock_movement: false,
            v_strap_entry: false,
            reports_sheets: false,
            po_section: false,
            po_dashboard: true,
            po_create: false,
            po_accountant: true,
            po_completed: true,
            po_history: true,
            po_payment_status: true,
            ...d.config
          });
        }
      })
      .catch(e => console.error('Failed to load menu visibility configs', e));
  };

  const handleSaveMenuConfig = async (newConfig: any) => {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_menu_visibility', config: newConfig })
      });
      if (res.ok) {
        setMenuConfig(newConfig);
        alert('Sidebar menu visibility settings saved successfully! Navigation sidebar updated.');
        // Dispatch event to instantly refresh Sidebar layout
        window.dispatchEvent(new Event('menu_settings_updated'));
      } else {
        alert('Failed to save settings');
      }
    } catch {
      alert('Network error');
    }
  };

  const loadUsers = () => {
    fetch('/api/admin')
      .then(res => res.json())
      .then(d => { setUsers(d.users || []); setLoading(false); })
      .catch(e => console.error('Failed to load users', e));
  };

  const loadAuditLogs = () => {
    setLogLoading(true);
    fetch('/api/audit?limit=50')
      .then(res => res.json())
      .then(d => { setLogs(d.logs || []); setLogLoading(false); })
      .catch(e => { console.error('Failed to load audit logs', e); setLogLoading(false); });
  };

  useEffect(() => {
    loadUsers();
    loadAuditLogs();
    loadMenuConfig();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_user', ...form })
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ username: '', full_name: '', password: '', phone: '', role: 'operator' });
        loadUsers();
        loadAuditLogs();
      } else {
        alert('Failed to create user');
      }
    } catch {
      alert('Network error');
    }
  };

  const handleEditClick = (user: any) => {
    setEditingUser(user);
    setEditForm({
      username: user.username,
      full_name: user.full_name,
      phone: user.phone || '',
      password: '',
      role: user.role,
      is_active: user.is_active === 1
    });
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_user',
          user_id: editingUser.id,
          username: editForm.username,
          full_name: editForm.full_name,
          phone: editForm.phone || null,
          role: editForm.role,
          is_active: editForm.is_active,
          ...(editForm.password ? { password: editForm.password } : {})
        })
      });
      if (res.ok) {
        setEditingUser(null);
        loadUsers();
        loadAuditLogs();
      } else {
        alert('Failed to update user');
      }
    } catch {
      alert('Network error');
    }
  };

  const handleDeactivateUser = async (id: number) => {
    if (!confirm('Deactivate this user account? The operator will lose system access.')) return;
    await fetch('/api/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deactivate_user', user_id: id })
    });
    loadUsers();
    loadAuditLogs();
  };

  const handleDeleteUser = async (id: number, username: string) => {
    if (!confirm(`⚠️ WARNING: Are you sure you want to PERMANENTLY delete user account "${username}"?\nThis action is irreversible and will completely erase their operational access.`)) return;
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_user', user_id: id })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.message) {
          alert(data.message);
        } else {
          alert(`User "${username}" has been permanently deleted.`);
        }
        loadUsers();
        loadAuditLogs();
      } else {
        alert(data.error || 'Failed to delete user.');
      }
    } catch {
      alert('Network error');
    }
  };

  const handleReactivateUser = async (id: number) => {
    if (!confirm('Reactivate this user account? Restore full access protocols.')) return;
    await fetch('/api/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_user', user_id: id, is_active: true })
    });
    loadUsers();
    loadAuditLogs();
  };

  const togglePasswordReveal = (userId: number) => {
    setRevealedPasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  // Client side user filtering
  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.phone && u.phone.includes(searchTerm));
      
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    
    const matchesStatus = 
      statusFilter === 'all' || 
      (statusFilter === 'active' && u.is_active === 1) ||
      (statusFilter === 'inactive' && u.is_active === 0);

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Client side audit log filtering
  const filteredLogs = logs.filter((log: any) => {
    if (logModuleFilter === 'all') return true;
    return log.module === logModuleFilter;
  });

  // Dynamic statistics
  const statTotal = users.length;
  const statActive = users.filter(u => u.is_active === 1).length;
  const statInactive = users.filter(u => u.is_active !== 1).length;
  const statManagers = users.filter(u => ['admin', 'pm', 'accountant'].includes(u.role)).length;

  if (loading) return <div className="loading-dot" style={{ fontSize: '24px', margin: '100px auto', display: 'table' }}>Loading security systems...</div>;

  return (
    <div style={{ animation: 'fadeInPage 0.4s ease-out' }}>
      
      {/* ── SECURITY NOTICE BANNER ──────────────────────────────────────── */}
      <div className="card mb-6" style={{
        background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
        border: '1px solid #fca5a5',
        borderRadius: '16px',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        animation: 'slideIn 0.3s ease-out',
        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.05)'
      }}>
        <span style={{ fontSize: '28px' }}>🛡️</span>
        <div>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Local Network Security Notice</h4>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#7f1d1d', fontWeight: 600, lineHeight: 1.4 }}>
            System is configured for offline/private local network operation. All core databases are saved securely inside the <code>data/lunars.db</code> folder. Complete system physical backups should cover this workspace folder daily.
          </p>
        </div>
      </div>

      {/* ── STATS COUNTER BLOCKS ────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '20px',
        marginBottom: '24px',
        animation: 'slideIn 0.35s ease-out'
      }}>
        {/* Card 1: Total Accounts */}
        <div className="card" style={{
          padding: '18px 24px',
          background: 'white',
          borderRadius: '16px',
          border: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'none'}
        >
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Users</div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-main)', marginTop: '4px' }}>{statTotal}</div>
          </div>
          <div style={{ fontSize: '32px', background: '#f8fafc', width: '56px', height: '56px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>👥</div>
        </div>

        {/* Card 2: Active Accounts */}
        <div className="card" style={{
          padding: '18px 24px',
          background: 'white',
          borderRadius: '16px',
          border: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'none'}
        >
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Active Access</div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#166534', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {statActive}
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 10px #22c55e', animation: 'pulseDot 1.5s infinite' }}></span>
            </div>
          </div>
          <div style={{ fontSize: '32px', background: '#f0fdf4', width: '56px', height: '56px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>🟢</div>
        </div>

        {/* Card 3: Inactive Accounts */}
        <div className="card" style={{
          padding: '18px 24px',
          background: 'white',
          borderRadius: '16px',
          border: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'none'}
        >
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Inactive Accounts</div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#991b1b', marginTop: '4px' }}>{statInactive}</div>
          </div>
          <div style={{ fontSize: '32px', background: '#fef2f2', width: '56px', height: '56px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>🚫</div>
        </div>

        {/* Card 4: Management Accounts */}
        <div className="card" style={{
          padding: '18px 24px',
          background: 'white',
          borderRadius: '16px',
          border: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'none'}
        >
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Admin & Managers</div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#3730a3', marginTop: '4px' }}>{statManagers}</div>
          </div>
          <div style={{ fontSize: '32px', background: '#e0e7ff', width: '56px', height: '56px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>🔑</div>
        </div>
      </div>

      {/* ── SEARCH & FILTER CONTROLS TOOLBAR ────────────────────────────── */}
      <div className="card mb-4" style={{
        padding: '18px 24px',
        background: 'white',
        borderRadius: '16px',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        animation: 'slideIn 0.4s ease-out'
      }}>
        {/* Left Side: Filter Forms */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '300px' }}>
          {/* Search bar */}
          <div style={{ position: 'relative', flex: 1, maxWidth: '280px' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', pointerEvents: 'none' }}>🔍</span>
            <input
              type="text"
              placeholder="Search users, phones..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px 10px 36px',
                border: '1.5px solid var(--border)',
                borderRadius: '10px',
                fontSize: '13px',
                outline: 'none',
                transition: 'all 0.15s'
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
            />
          </div>

          {/* Role Filter dropdown */}
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            style={{
              padding: '10px 14px',
              border: '1.5px solid var(--border)',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 600,
              background: 'white',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="all">All Roles</option>
            <option value="admin">Administrators</option>
            <option value="supervisor">Supervisors</option>
            <option value="pm">Purchase Managers (PM)</option>
            <option value="accountant">Accountants</option>
            <option value="operator">Operators</option>
            <option value="worker">Workers</option>
          </select>

          {/* Status Filter dropdown */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              padding: '10px 14px',
              border: '1.5px solid var(--border)',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 600,
              background: 'white',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>

        {/* Right Side: + Create User Button */}
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(true)}
          style={{
            borderRadius: '10px',
            padding: '10px 20px',
            fontWeight: 700,
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 4px 10px rgba(15,23,42,0.1)'
          }}
        >
          ➕ Create User Account
        </button>
      </div>

      {/* ── USER ACCOUNTS DIRECTORY TABLE ────────────────────────────────── */}
      <div className="card" style={{
        background: 'white',
        borderRadius: '16px',
        border: '1px solid var(--border)',
        overflow: 'hidden',
        animation: 'slideIn 0.45s ease-out',
        boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
      }}>
        <div className="table-wrapper">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid var(--border)' }}>
                <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: 800, color: 'var(--text-ghost)', textTransform: 'uppercase' }}>ID</th>
                <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: 800, color: 'var(--text-ghost)', textTransform: 'uppercase' }}>User Credentials</th>
                <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: 800, color: 'var(--text-ghost)', textTransform: 'uppercase' }}>Linked Phone</th>
                <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: 800, color: 'var(--text-ghost)', textTransform: 'uppercase' }}>Security Role</th>
                <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: 800, color: 'var(--text-ghost)', textTransform: 'uppercase' }}>Credential Card (Admin View)</th>
                <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: 800, color: 'var(--text-ghost)', textTransform: 'uppercase' }}>Access Status</th>
                <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: 800, color: 'var(--text-ghost)', textTransform: 'uppercase' }}>Last Access Connection</th>
                <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: 800, color: 'var(--text-ghost)', textTransform: 'uppercase', textAlign: 'right' }}>Management Options</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-ghost)', fontSize: '14px', fontWeight: 600 }}>
                    No system operator accounts match your active search filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u, index) => {
                  // Role Badge Colors
                  let roleBg = '#f1f5f9';
                  let roleColor = '#475569';
                  let roleBorder = '#cbd5e1';

                  if (u.role === 'admin') {
                    roleBg = '#fee2e2'; roleColor = '#991b1b'; roleBorder = '#fca5a5';
                  } else if (u.role === 'supervisor') {
                    roleBg = '#dcfce7'; roleColor = '#166534'; roleBorder = '#86efac';
                  } else if (u.role === 'pm') {
                    roleBg = '#e0e7ff'; roleColor = '#3730a3'; roleBorder = '#a5b4fc';
                  } else if (u.role === 'accountant') {
                    roleBg = '#fef3c7'; roleColor = '#92400e'; roleBorder = '#fde68a';
                  } else if (u.role === 'operator') {
                    roleBg = '#e0f2fe'; roleColor = '#075985'; roleBorder = '#7dd3fc';
                  }

                  return (
                    <tr key={u.id} style={{
                      borderBottom: '1px solid var(--border)',
                      transition: 'background 0.15s',
                      background: index % 2 === 0 ? 'white' : '#fafafa'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = index % 2 === 0 ? 'white' : '#fafafa'}
                    >
                      {/* 1. ID */}
                      <td className="mono" style={{ padding: '16px 20px', color: 'var(--text-ghost)', fontWeight: 700 }}>{u.id}</td>
                      
                      {/* 2. Full Name */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '13.5px' }}>{u.full_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-ghost)', fontWeight: 600, marginTop: '2px' }}>U: @{u.username}</div>
                      </td>
                      
                      {/* 3. Phone */}
                      <td className="mono" style={{ padding: '16px 20px', fontWeight: 600, color: '#334155' }}>
                        {u.phone || <span style={{ color: 'var(--text-ghost)', fontStyle: 'italic', fontWeight: 500, fontSize: '11px' }}>Unlinked</span>}
                      </td>
                      
                      {/* 4. Role */}
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{
                          display: 'inline-block',
                          fontSize: '10px',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          background: roleBg,
                          color: roleColor,
                          border: `1px solid ${roleBorder}`,
                          padding: '3px 8px',
                          borderRadius: '12px',
                          letterSpacing: '0.05em'
                        }}>
                          {u.role}
                        </span>
                      </td>
                      
                      {/* 5. Credentials Viewer */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          padding: '6px 10px',
                          display: 'inline-flex',
                          flexDirection: 'column',
                          gap: '3px',
                          minWidth: '150px'
                        }}>
                          <div style={{ fontSize: '10px', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>User</span>
                            <strong style={{ color: '#334155', fontFamily: 'monospace' }}>{u.username}</strong>
                          </div>
                          <div style={{ fontSize: '10px', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                            <span>Pass</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <strong style={{ color: '#334155', fontFamily: 'monospace' }}>
                                {revealedPasswords[u.id] ? u.plain_password || 'admin123' : '••••••••'}
                              </strong>
                              <button
                                onClick={() => togglePasswordReveal(u.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '2px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  outline: 'none',
                                  fontSize: '11px',
                                  opacity: 0.6,
                                  transition: 'opacity 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                                title={revealedPasswords[u.id] ? 'Hide Credentials' : 'Reveal Credentials'}
                              >
                                {revealedPasswords[u.id] ? '🙈' : '👁️'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                      
                      {/* 6. Status */}
                      <td style={{ padding: '16px 20px' }}>
                        {u.is_active ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 700, color: '#166534', background: '#dcfce7', padding: '4px 10px', borderRadius: '20px', border: '1px solid #86efac' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 8px #22c55e', animation: 'pulseDot 1.5s infinite' }}></span>
                            Active
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 700, color: '#991b1b', background: '#fee2e2', padding: '4px 10px', borderRadius: '20px', border: '1px solid #fca5a5' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}></span>
                            Inactive
                          </span>
                        )}
                      </td>
                      
                      {/* 7. Last Login */}
                      <td className="text-xs text-muted" style={{ padding: '16px 20px', fontFamily: 'monospace' }}>
                        {u.last_login ? formatToIST(u.last_login) : <span style={{ color: 'var(--text-ghost)', fontStyle: 'italic' }}>Never Connected</span>}
                      </td>
                      
                      {/* 8. Action buttons */}
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleEditClick(u)}
                            style={{
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              borderRadius: '8px',
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = '#dbeafe';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = '#eff6ff';
                              e.currentTarget.style.transform = 'none';
                            }}
                          >
                            ✏️ Edit
                          </button>
                          
                          {u.username !== 'admin' && (
                            <>
                              {u.is_active ? (
                                <button
                                  onClick={() => handleDeactivateUser(u.id)}
                                  style={{
                                    background: '#fff7ed',
                                    color: '#c2410c',
                                    border: '1px solid #ffedd5',
                                    borderRadius: '8px',
                                    padding: '6px 12px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    transition: 'all 0.15s'
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.background = '#ffedd5';
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.background = '#fff7ed';
                                    e.currentTarget.style.transform = 'none';
                                  }}
                                >
                                  🚫 Deactivate
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleReactivateUser(u.id)}
                                  style={{
                                    background: '#f0fdf4',
                                    color: '#15803d',
                                    border: '1px solid #bbf7d0',
                                    borderRadius: '8px',
                                    padding: '6px 12px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    transition: 'all 0.15s'
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.background = '#dcfce7';
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.background = '#f0fdf4';
                                    e.currentTarget.style.transform = 'none';
                                  }}
                                >
                                  ⚡ Reactivate
                                </button>
                              )}

                              <button
                                onClick={() => handleDeleteUser(u.id, u.username)}
                                style={{
                                  background: '#fef2f2',
                                  color: '#dc2626',
                                  border: '1px solid #fecaca',
                                  borderRadius: '8px',
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'all 0.15s'
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.background = '#fee2e2';
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.background = '#fef2f2';
                                  e.currentTarget.style.transform = 'none';
                                }}
                              >
                                🗑️ Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SIDEBAR NAVIGATION VISIBILITY CONTROLLER ──────────────────── */}
      <div className="card mt-8" style={{
        padding: '28px',
        background: 'linear-gradient(135deg, #ffffff 0%, #fcfdfd 100%)',
        borderRadius: '20px',
        border: '1px solid var(--border)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.02)',
        animation: 'slideIn 0.45s ease-out'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              ⚙️ Sidebar Navigation Control Settings
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--text-ghost)', margin: '4px 0 0 0', fontWeight: 600 }}>
              Toggle visibility of any sidebar module or link. Perfect for streamlining roles and decluttering operators' screens.
            </p>
          </div>
          <button
            onClick={() => handleSaveMenuConfig(menuConfig)}
            style={{
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 24px',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
              transition: 'all 0.2s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.3)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.2)';
            }}
          >
            💾 Save Navigation Layout
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          {/* Section 1: Overview */}
          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px 0', borderBottom: '2px solid #cbd5e1', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📊</span> General & Dashboard
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>📊</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>Overview Dashboard</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-ghost)', marginTop: '2px' }}>General stock statistics dashboard</div>
                  </div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px' }}>
                  <input
                    type="checkbox"
                    checked={!!menuConfig.dashboard}
                    onChange={e => setMenuConfig({ ...menuConfig, dashboard: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: menuConfig.dashboard ? '#22c55e' : '#cbd5e1',
                    borderRadius: '24px', transition: 'all 0.3s',
                    boxShadow: menuConfig.dashboard ? 'inset 0 2px 4px rgba(0,0,0,0.1)' : 'none'
                  }}>
                    <span style={{
                      position: 'absolute', height: '18px', width: '18px', left: '3px', bottom: '3px',
                      backgroundColor: 'white', borderRadius: '50%', transition: 'all 0.3s',
                      transform: menuConfig.dashboard ? 'translateX(22px)' : 'none',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}></span>
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Section 2: Packing */}
          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px 0', borderBottom: '2px solid #cbd5e1', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📦</span> Packing Section
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Item: Scanning Intake */}
              <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>⚡</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>Scanning Intake</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-ghost)', marginTop: '2px' }}>Inward scan verification</div>
                  </div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px' }}>
                  <input
                    type="checkbox"
                    checked={!!menuConfig.scanning_intake}
                    onChange={e => setMenuConfig({ ...menuConfig, scanning_intake: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: menuConfig.scanning_intake ? '#22c55e' : '#cbd5e1',
                    borderRadius: '24px', transition: 'all 0.3s',
                    boxShadow: menuConfig.scanning_intake ? 'inset 0 2px 4px rgba(0,0,0,0.1)' : 'none'
                  }}>
                    <span style={{
                      position: 'absolute', height: '18px', width: '18px', left: '3px', bottom: '3px',
                      backgroundColor: 'white', borderRadius: '50%', transition: 'all 0.3s',
                      transform: menuConfig.scanning_intake ? 'translateX(22px)' : 'none',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}></span>
                  </span>
                </label>
              </div>

              {/* Item: Manual Entry */}
              <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>📝</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>Manual Entry</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-ghost)', marginTop: '2px' }}>Manual inventory logs</div>
                  </div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px' }}>
                  <input
                    type="checkbox"
                    checked={!!menuConfig.manual_entry}
                    onChange={e => setMenuConfig({ ...menuConfig, manual_entry: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: menuConfig.manual_entry ? '#22c55e' : '#cbd5e1',
                    borderRadius: '24px', transition: 'all 0.3s',
                    boxShadow: menuConfig.manual_entry ? 'inset 0 2px 4px rgba(0,0,0,0.1)' : 'none'
                  }}>
                    <span style={{
                      position: 'absolute', height: '18px', width: '18px', left: '3px', bottom: '3px',
                      backgroundColor: 'white', borderRadius: '50%', transition: 'all 0.3s',
                      transform: menuConfig.manual_entry ? 'translateX(22px)' : 'none',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}></span>
                  </span>
                </label>
              </div>

              {/* Item: Inventory */}
              <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>📥</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>Inventory</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-ghost)', marginTop: '2px' }}>Intake inventory pool</div>
                  </div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px' }}>
                  <input
                    type="checkbox"
                    checked={!!menuConfig.inventory_pool}
                    onChange={e => setMenuConfig({ ...menuConfig, inventory_pool: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: menuConfig.inventory_pool ? '#22c55e' : '#cbd5e1',
                    borderRadius: '24px', transition: 'all 0.3s',
                    boxShadow: menuConfig.inventory_pool ? 'inset 0 2px 4px rgba(0,0,0,0.1)' : 'none'
                  }}>
                    <span style={{
                      position: 'absolute', height: '18px', width: '18px', left: '3px', bottom: '3px',
                      backgroundColor: 'white', borderRadius: '50%', transition: 'all 0.3s',
                      transform: menuConfig.inventory_pool ? 'translateX(22px)' : 'none',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}></span>
                  </span>
                </label>
              </div>

              {/* Item: Carton Generation */}
              <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>⚙️</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>Carton Generation</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-ghost)', marginTop: '2px' }}>Generate master packaging barcodes</div>
                  </div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px' }}>
                  <input
                    type="checkbox"
                    checked={!!menuConfig.carton_generation}
                    onChange={e => setMenuConfig({ ...menuConfig, carton_generation: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: menuConfig.carton_generation ? '#22c55e' : '#cbd5e1',
                    borderRadius: '24px', transition: 'all 0.3s',
                    boxShadow: menuConfig.carton_generation ? 'inset 0 2px 4px rgba(0,0,0,0.1)' : 'none'
                  }}>
                    <span style={{
                      position: 'absolute', height: '18px', width: '18px', left: '3px', bottom: '3px',
                      backgroundColor: 'white', borderRadius: '50%', transition: 'all 0.3s',
                      transform: menuConfig.carton_generation ? 'translateX(22px)' : 'none',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}></span>
                  </span>
                </label>
              </div>

              {/* Item: Packed Inventory */}
              <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>📦</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>Packed Inventory</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-ghost)', marginTop: '2px' }}>Completed packages & cartons</div>
                  </div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px' }}>
                  <input
                    type="checkbox"
                    checked={!!menuConfig.packed_inventory}
                    onChange={e => setMenuConfig({ ...menuConfig, packed_inventory: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: menuConfig.packed_inventory ? '#22c55e' : '#cbd5e1',
                    borderRadius: '24px', transition: 'all 0.3s',
                    boxShadow: menuConfig.packed_inventory ? 'inset 0 2px 4px rgba(0,0,0,0.1)' : 'none'
                  }}>
                    <span style={{
                      position: 'absolute', height: '18px', width: '18px', left: '3px', bottom: '3px',
                      backgroundColor: 'white', borderRadius: '50%', transition: 'all 0.3s',
                      transform: menuConfig.packed_inventory ? 'translateX(22px)' : 'none',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}></span>
                  </span>
                </label>
              </div>

              {/* Item: Scan History */}
              <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>📋</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>Scan History</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-ghost)', marginTop: '2px' }}>Operational barcode scan logs</div>
                  </div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px' }}>
                  <input
                    type="checkbox"
                    checked={!!menuConfig.scan_history}
                    onChange={e => setMenuConfig({ ...menuConfig, scan_history: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: menuConfig.scan_history ? '#22c55e' : '#cbd5e1',
                    borderRadius: '24px', transition: 'all 0.3s',
                    boxShadow: menuConfig.scan_history ? 'inset 0 2px 4px rgba(0,0,0,0.1)' : 'none'
                  }}>
                    <span style={{
                      position: 'absolute', height: '18px', width: '18px', left: '3px', bottom: '3px',
                      backgroundColor: 'white', borderRadius: '50%', transition: 'all 0.3s',
                      transform: menuConfig.scan_history ? 'translateX(22px)' : 'none',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}></span>
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Section 3: Upper Stock */}
          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px 0', borderBottom: '2px solid #cbd5e1', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚡</span> Upper Stock Section
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Item: Daily Activity */}
              <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>📅</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>Daily Activity</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-ghost)', marginTop: '2px' }}>Daily production sheets</div>
                  </div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px' }}>
                  <input
                    type="checkbox"
                    checked={!!menuConfig.daily_activity}
                    onChange={e => setMenuConfig({ ...menuConfig, daily_activity: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: menuConfig.daily_activity ? '#22c55e' : '#cbd5e1',
                    borderRadius: '24px', transition: 'all 0.3s',
                    boxShadow: menuConfig.daily_activity ? 'inset 0 2px 4px rgba(0,0,0,0.1)' : 'none'
                  }}>
                    <span style={{
                      position: 'absolute', height: '18px', width: '18px', left: '3px', bottom: '3px',
                      backgroundColor: 'white', borderRadius: '50%', transition: 'all 0.3s',
                      transform: menuConfig.daily_activity ? 'translateX(22px)' : 'none',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}></span>
                  </span>
                </label>
              </div>

              {/* Item: Live Inventory */}
              <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>📦</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>Live Inventory</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-ghost)', marginTop: '2px' }}>Live stock ledger balances</div>
                  </div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px' }}>
                  <input
                    type="checkbox"
                    checked={!!menuConfig.live_inventory}
                    onChange={e => setMenuConfig({ ...menuConfig, live_inventory: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: menuConfig.live_inventory ? '#22c55e' : '#cbd5e1',
                    borderRadius: '24px', transition: 'all 0.3s',
                    boxShadow: menuConfig.live_inventory ? 'inset 0 2px 4px rgba(0,0,0,0.1)' : 'none'
                  }}>
                    <span style={{
                      position: 'absolute', height: '18px', width: '18px', left: '3px', bottom: '3px',
                      backgroundColor: 'white', borderRadius: '50%', transition: 'all 0.3s',
                      transform: menuConfig.live_inventory ? 'translateX(22px)' : 'none',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}></span>
                  </span>
                </label>
              </div>

              {/* Item: Stock Movement */}
              <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>🔄</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>Stock Movement</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-ghost)', marginTop: '2px' }}>Inward & outward transactions</div>
                  </div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px' }}>
                  <input
                    type="checkbox"
                    checked={!!menuConfig.stock_movement}
                    onChange={e => setMenuConfig({ ...menuConfig, stock_movement: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: menuConfig.stock_movement ? '#22c55e' : '#cbd5e1',
                    borderRadius: '24px', transition: 'all 0.3s',
                    boxShadow: menuConfig.stock_movement ? 'inset 0 2px 4px rgba(0,0,0,0.1)' : 'none'
                  }}>
                    <span style={{
                      position: 'absolute', height: '18px', width: '18px', left: '3px', bottom: '3px',
                      backgroundColor: 'white', borderRadius: '50%', transition: 'all 0.3s',
                      transform: menuConfig.stock_movement ? 'translateX(22px)' : 'none',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}></span>
                  </span>
                </label>
              </div>

              {/* Item: V-Strap Entry */}
              <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>🩴</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>V-Strap Entry</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-ghost)', marginTop: '2px' }}>Strap manufacturing inventory</div>
                  </div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px' }}>
                  <input
                    type="checkbox"
                    checked={!!menuConfig.v_strap_entry}
                    onChange={e => setMenuConfig({ ...menuConfig, v_strap_entry: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: menuConfig.v_strap_entry ? '#22c55e' : '#cbd5e1',
                    borderRadius: '24px', transition: 'all 0.3s',
                    boxShadow: menuConfig.v_strap_entry ? 'inset 0 2px 4px rgba(0,0,0,0.1)' : 'none'
                  }}>
                    <span style={{
                      position: 'absolute', height: '18px', width: '18px', left: '3px', bottom: '3px',
                      backgroundColor: 'white', borderRadius: '50%', transition: 'all 0.3s',
                      transform: menuConfig.v_strap_entry ? 'translateX(22px)' : 'none',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}></span>
                  </span>
                </label>
              </div>

              {/* Item: Reports & Sheets */}
              <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>📝</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>Reports & Sheets</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-ghost)', marginTop: '2px' }}>Excel sheets & print reports</div>
                  </div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px' }}>
                  <input
                    type="checkbox"
                    checked={!!menuConfig.reports_sheets}
                    onChange={e => setMenuConfig({ ...menuConfig, reports_sheets: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: menuConfig.reports_sheets ? '#22c55e' : '#cbd5e1',
                    borderRadius: '24px', transition: 'all 0.3s',
                    boxShadow: menuConfig.reports_sheets ? 'inset 0 2px 4px rgba(0,0,0,0.1)' : 'none'
                  }}>
                    <span style={{
                      position: 'absolute', height: '18px', width: '18px', left: '3px', bottom: '3px',
                      backgroundColor: 'white', borderRadius: '50%', transition: 'all 0.3s',
                      transform: menuConfig.reports_sheets ? 'translateX(22px)' : 'none',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}></span>
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Section 4: PO */}
          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0', gridColumn: 'span 2' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px 0', borderBottom: '2px solid #cbd5e1', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📄</span> Purchase Orders & Subdivisions
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Parent Toggle: PO Section */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'white', borderRadius: '10px', border: '1.5px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '20px' }}>📄</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>PO Procurement Section</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-ghost)', marginTop: '2px' }}>Toggles the entire Purchasing Order block in the sidebar</div>
                  </div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px' }}>
                  <input
                    type="checkbox"
                    checked={!!menuConfig.po_section}
                    onChange={e => setMenuConfig({ ...menuConfig, po_section: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: menuConfig.po_section ? '#22c55e' : '#cbd5e1',
                    borderRadius: '24px', transition: 'all 0.3s',
                    boxShadow: menuConfig.po_section ? 'inset 0 2px 4px rgba(0,0,0,0.1)' : 'none'
                  }}>
                    <span style={{
                      position: 'absolute', height: '18px', width: '18px', left: '3px', bottom: '3px',
                      backgroundColor: 'white', borderRadius: '50%', transition: 'all 0.3s',
                      transform: menuConfig.po_section ? 'translateX(22px)' : 'none',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}></span>
                  </span>
                </label>
              </div>

              {/* Subdivisions Grid (Indented & only enabled if PO Section is checked) */}
              <div style={{
                paddingLeft: '20px',
                borderLeft: '3px solid #e2e8f0',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '16px',
                opacity: menuConfig.po_section ? 1 : 0.5,
                pointerEvents: menuConfig.po_section ? 'auto' : 'none',
                transition: 'all 0.3s'
              }}>
                {/* ── ALWAYS ENABLED SUBDIVISIONS (🔒) ── */}
                <div style={{ background: '#f1f5f9', padding: '12px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px dashed #cbd5e1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>⏳</span>
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#475569' }}>Pending Approval</div>
                      <div style={{ fontSize: '10.5px', color: '#64748b' }}>Admin review queue</div>
                    </div>
                  </div>
                  <span style={{ background: '#e2e8f0', color: '#475569', fontSize: '9px', fontWeight: 900, padding: '3px 8px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    🔒 ALWAYS ON
                  </span>
                </div>

                <div style={{ background: '#f1f5f9', padding: '12px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px dashed #cbd5e1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>🔄</span>
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#475569' }}>Returned POs</div>
                      <div style={{ fontSize: '10.5px', color: '#64748b' }}>PM revision feedback</div>
                    </div>
                  </div>
                  <span style={{ background: '#e2e8f0', color: '#475569', fontSize: '9px', fontWeight: 900, padding: '3px 8px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    🔒 ALWAYS ON
                  </span>
                </div>

                <div style={{ background: '#f1f5f9', padding: '12px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px dashed #cbd5e1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>✅</span>
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#475569' }}>Approved PO</div>
                      <div style={{ fontSize: '10.5px', color: '#64748b' }}>Active verified PO list</div>
                    </div>
                  </div>
                  <span style={{ background: '#e2e8f0', color: '#475569', fontSize: '9px', fontWeight: 900, padding: '3px 8px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    🔒 ALWAYS ON
                  </span>
                </div>

                <div style={{ background: '#f1f5f9', padding: '12px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px dashed #cbd5e1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>❌</span>
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#475569' }}>Rejected PO</div>
                      <div style={{ fontSize: '10.5px', color: '#64748b' }}>Declined orders registry</div>
                    </div>
                  </div>
                  <span style={{ background: '#e2e8f0', color: '#475569', fontSize: '9px', fontWeight: 900, padding: '3px 8px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    🔒 ALWAYS ON
                  </span>
                </div>

                {/* ── INTERACTIVE PO SUB-TOGGLES ── */}
                {/* Create PO */}
                <div style={{ background: 'white', padding: '12px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>✍️</span>
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-main)' }}>Create PO</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-ghost)' }}>Admin + PM creation screen</div>
                    </div>
                  </div>
                  <label style={{ position: 'relative', display: 'inline-block', width: '38px', height: '20px' }}>
                    <input
                      type="checkbox"
                      checked={!!menuConfig.po_create}
                      onChange={e => setMenuConfig({ ...menuConfig, po_create: e.target.checked })}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: menuConfig.po_create ? '#22c55e' : '#cbd5e1',
                      borderRadius: '20px', transition: 'all 0.3s'
                    }}>
                      <span style={{
                        position: 'absolute', height: '14px', width: '14px', left: '3px', bottom: '3px',
                        backgroundColor: 'white', borderRadius: '50%', transition: 'all 0.3s',
                        transform: menuConfig.po_create ? 'translateX(18px)' : 'none'
                      }}></span>
                    </span>
                  </label>
                </div>

                {/* PO Dashboard */}
                <div style={{ background: 'white', padding: '12px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>📊</span>
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-main)' }}>PO Dashboard</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-ghost)' }}>Summary totals & charts</div>
                    </div>
                  </div>
                  <label style={{ position: 'relative', display: 'inline-block', width: '38px', height: '20px' }}>
                    <input
                      type="checkbox"
                      checked={!!menuConfig.po_dashboard}
                      onChange={e => setMenuConfig({ ...menuConfig, po_dashboard: e.target.checked })}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: menuConfig.po_dashboard ? '#22c55e' : '#cbd5e1',
                      borderRadius: '20px', transition: 'all 0.3s'
                    }}>
                      <span style={{
                        position: 'absolute', height: '14px', width: '14px', left: '3px', bottom: '3px',
                        backgroundColor: 'white', borderRadius: '50%', transition: 'all 0.3s',
                        transform: menuConfig.po_dashboard ? 'translateX(18px)' : 'none'
                      }}></span>
                    </span>
                  </label>
                </div>

                {/* Accountant Processing */}
                <div style={{ background: 'white', padding: '12px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>💸</span>
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-main)' }}>Accountant Processing</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-ghost)' }}>Finance edit & payouts</div>
                    </div>
                  </div>
                  <label style={{ position: 'relative', display: 'inline-block', width: '38px', height: '20px' }}>
                    <input
                      type="checkbox"
                      checked={!!menuConfig.po_accountant}
                      onChange={e => setMenuConfig({ ...menuConfig, po_accountant: e.target.checked })}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: menuConfig.po_accountant ? '#22c55e' : '#cbd5e1',
                      borderRadius: '20px', transition: 'all 0.3s'
                    }}>
                      <span style={{
                        position: 'absolute', height: '14px', width: '14px', left: '3px', bottom: '3px',
                        backgroundColor: 'white', borderRadius: '50%', transition: 'all 0.3s',
                        transform: menuConfig.po_accountant ? 'translateX(18px)' : 'none'
                      }}></span>
                    </span>
                  </label>
                </div>

                {/* Completed PO */}
                <div style={{ background: 'white', padding: '12px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>📁</span>
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-main)' }}>Completed PO</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-ghost)' }}>Fully paid orders sheet</div>
                    </div>
                  </div>
                  <label style={{ position: 'relative', display: 'inline-block', width: '38px', height: '20px' }}>
                    <input
                      type="checkbox"
                      checked={!!menuConfig.po_completed}
                      onChange={e => setMenuConfig({ ...menuConfig, po_completed: e.target.checked })}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: menuConfig.po_completed ? '#22c55e' : '#cbd5e1',
                      borderRadius: '20px', transition: 'all 0.3s'
                    }}>
                      <span style={{
                        position: 'absolute', height: '14px', width: '14px', left: '3px', bottom: '3px',
                        backgroundColor: 'white', borderRadius: '50%', transition: 'all 0.3s',
                        transform: menuConfig.po_completed ? 'translateX(18px)' : 'none'
                      }}></span>
                    </span>
                  </label>
                </div>

                {/* PO History */}
                <div style={{ background: 'white', padding: '12px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>🕒</span>
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-main)' }}>PO History</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-ghost)' }}>Historical archive timeline</div>
                    </div>
                  </div>
                  <label style={{ position: 'relative', display: 'inline-block', width: '38px', height: '20px' }}>
                    <input
                      type="checkbox"
                      checked={!!menuConfig.po_history}
                      onChange={e => setMenuConfig({ ...menuConfig, po_history: e.target.checked })}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: menuConfig.po_history ? '#22c55e' : '#cbd5e1',
                      borderRadius: '20px', transition: 'all 0.3s'
                    }}>
                      <span style={{
                        position: 'absolute', height: '14px', width: '14px', left: '3px', bottom: '3px',
                        backgroundColor: 'white', borderRadius: '50%', transition: 'all 0.3s',
                        transform: menuConfig.po_history ? 'translateX(18px)' : 'none'
                      }}></span>
                    </span>
                  </label>
                </div>

                {/* Payment Completed */}
                <div style={{ background: 'white', padding: '12px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>💰</span>
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-main)' }}>Payment Completed</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-ghost)' }}>Accountant closed ledger</div>
                    </div>
                  </div>
                  <label style={{ position: 'relative', display: 'inline-block', width: '38px', height: '20px' }}>
                    <input
                      type="checkbox"
                      checked={!!menuConfig.po_payment_status}
                      onChange={e => setMenuConfig({ ...menuConfig, po_payment_status: e.target.checked })}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: menuConfig.po_payment_status ? '#22c55e' : '#cbd5e1',
                      borderRadius: '20px', transition: 'all 0.3s'
                    }}>
                      <span style={{
                        position: 'absolute', height: '14px', width: '14px', left: '3px', bottom: '3px',
                        backgroundColor: 'white', borderRadius: '50%', transition: 'all 0.3s',
                        transform: menuConfig.po_payment_status ? 'translateX(18px)' : 'none'
                      }}></span>
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECURITY & SYSTEM AUDIT LOGS STREAM TIMELINE ───────────────── */}
      <div className="card mt-8" style={{
        padding: '24px',
        background: 'white',
        borderRadius: '16px',
        border: '1px solid var(--border)',
        animation: 'slideIn 0.5s ease-out',
        boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              🛡️ Security & System Audit Logs
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-ghost)', margin: '4px 0 0 0', fontWeight: 600 }}>
              Audit timeline records logins, credentials changes, profile updates, and master administrator operations
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select
              value={logModuleFilter}
              onChange={e => setLogModuleFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                fontSize: '12px',
                fontWeight: 700,
                background: 'white',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Modules</option>
              <option value="auth">Auth & Sessions</option>
              <option value="admin">User Administration</option>
              <option value="po">Material Procurement (PO)</option>
              <option value="daily">Daily production</option>
            </select>
            <button
              onClick={loadAuditLogs}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                fontSize: '12px',
                fontWeight: 800,
                background: '#f8fafc',
                cursor: 'pointer',
                transition: 'background 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
              onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
            >
              🔄 Refresh Stream
            </button>
          </div>
        </div>

        <div style={{ maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
          {logLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-ghost)', fontSize: '13px', fontWeight: 600 }}>
              Loading operational logs timeline...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-ghost)', fontSize: '13px', fontWeight: 600 }}>
              No critical system security records match the module filter.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredLogs.map((log: any) => {
                let badgeColor = '#475569';
                let badgeBg = '#f1f5f9';
                let borderCol = '#cbd5e1';

                if (log.module === 'auth') {
                  badgeColor = '#3730a3'; badgeBg = '#e0e7ff'; borderCol = '#a5b4fc';
                } else if (log.module === 'admin') {
                  badgeColor = '#991b1b'; badgeBg = '#fee2e2'; borderCol = '#fca5a5';
                } else if (log.module === 'po') {
                  badgeColor = '#075985'; badgeBg = '#e0f2fe'; borderCol = '#7dd3fc';
                }

                return (
                  <div key={log.id} style={{
                    display: 'flex',
                    gap: '16px',
                    padding: '12px 16px',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    alignItems: 'center',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                  onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                  >
                    <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64748b', minWidth: '135px', fontWeight: 600 }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                    
                    <span style={{
                      fontSize: '9px',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      color: badgeColor,
                      background: badgeBg,
                      border: `1px solid ${borderCol}`,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      textAlign: 'center',
                      minWidth: '75px',
                      letterSpacing: '0.05em'
                    }}>
                      {log.module}
                    </span>

                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>{log.full_name || log.username}</span>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginLeft: '8px', fontWeight: 600 }}>{log.description}</span>
                    </div>

                    <span style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      color: '#475569',
                      background: '#e2e8f0',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontFamily: 'monospace',
                      letterSpacing: '0.02em'
                    }}>
                      {log.action}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── CREATE USER MODAL DIALOG ────────────────────────────────────── */}
      {showForm && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '500px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            overflow: 'hidden',
            border: '1px solid var(--border)',
            animation: 'scaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc'
            }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                👤 Create New System Operator
              </h3>
              <button
                onClick={() => setShowForm(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: 'var(--text-ghost)', fontWeight: 'bold', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateUser} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>USERNAME</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter login username..."
                    value={form.username}
                    onChange={e => setForm({...form, username: e.target.value})}
                    style={{ padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '13px', outline: 'none', width: '100%' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>FULL NAME</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter operator's name..."
                    value={form.full_name}
                    onChange={e => setForm({...form, full_name: e.target.value})}
                    style={{ padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '13px', outline: 'none', width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>PASSWORD</label>
                  <input
                    type="password"
                    required
                    placeholder="Set login password..."
                    value={form.password}
                    onChange={e => setForm({...form, password: e.target.value})}
                    style={{ padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '13px', outline: 'none', width: '100%' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>PHONE NUMBER (OPTIONAL)</label>
                  <input
                    type="tel"
                    placeholder="e.g. +919876543210"
                    value={form.phone}
                    onChange={e => setForm({...form, phone: e.target.value})}
                    style={{ padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '13px', outline: 'none', width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>ASSIGNED SYSTEM ROLE</label>
                <select
                  value={form.role}
                  onChange={e => setForm({...form, role: e.target.value})}
                  style={{ padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '13px', outline: 'none', width: '100%', height: '40px', background: 'white' }}
                >
                  <option value="operator">Operator (Data Entry)</option>
                  <option value="supervisor">Supervisor (Review & Approve)</option>
                  <option value="pm">Purchase Manager (PM)</option>
                  <option value="accountant">Accountant</option>
                  <option value="worker">Worker (Restricted)</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              {/* Modal Footer */}
              <div style={{
                marginTop: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '10px'
              }}>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: 'var(--text-main)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: 'var(--primary)', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: 'white' }}
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT USER MODAL DIALOG ──────────────────────────────────────── */}
      {editingUser && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '500px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            overflow: 'hidden',
            border: '1px solid var(--border)',
            animation: 'scaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc'
            }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                ✏️ Edit Account: {editingUser.full_name}
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: 'var(--text-ghost)', fontWeight: 'bold', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleUpdateUser} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>USERNAME</label>
                  <input
                    type="text"
                    required
                    value={editForm.username}
                    onChange={e => setEditForm({...editForm, username: e.target.value})}
                    style={{ padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '13px', outline: 'none', width: '100%' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>FULL NAME</label>
                  <input
                    type="text"
                    required
                    value={editForm.full_name}
                    onChange={e => setEditForm({...editForm, full_name: e.target.value})}
                    style={{ padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '13px', outline: 'none', width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>PHONE NUMBER</label>
                  <input
                    type="tel"
                    placeholder="e.g. +919876543210"
                    value={editForm.phone}
                    onChange={e => setEditForm({...editForm, phone: e.target.value})}
                    style={{ padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '13px', outline: 'none', width: '100%' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>ROLE</label>
                  <select
                    value={editForm.role}
                    onChange={e => setEditForm({...editForm, role: e.target.value})}
                    style={{ padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '13px', outline: 'none', width: '100%', height: '40px', background: 'white' }}
                  >
                    <option value="operator">Operator (Data Entry)</option>
                    <option value="supervisor">Supervisor (Review & Approve)</option>
                    <option value="pm">Purchase Manager (PM)</option>
                    <option value="accountant">Accountant</option>
                    <option value="worker">Worker (Restricted)</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>RESET PASSWORD (OPTIONAL)</label>
                <input
                  type="password"
                  placeholder="Enter new password to force update..."
                  value={editForm.password}
                  onChange={e => setEditForm({...editForm, password: e.target.value})}
                  style={{ padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '13px', outline: 'none', width: '100%' }}
                />
              </div>

              {editingUser.username !== 'admin' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginTop: '8px' }}>
                  <input
                    type="checkbox"
                    id="edit_is_active"
                    checked={editForm.is_active}
                    onChange={e => setEditForm({...editForm, is_active: e.target.checked})}
                  />
                  <label htmlFor="edit_is_active" style={{ cursor: 'pointer', userSelect: 'none' }}>Account Active Status</label>
                </div>
              )}

              {/* Modal Footer */}
              <div style={{
                marginTop: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '10px'
              }}>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: 'var(--text-main)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: 'var(--primary)', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: 'white' }}
                >
                  Save Updates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CUSTOM INLINE STYLES ────────────────────────────────────────── */}
      <style>{`
        @keyframes fadeInPage {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateY(12px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes pulseDot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.6; }
        }
      `}</style>

    </div>
  );
}
