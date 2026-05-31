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

  // Tab control state
  const [activeTab, setActiveTab] = useState<'users' | 'signups' | 'requests' | 'audit' | 'backups'>('users');
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);

  // Backup & Restore system states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgressMsg, setRestoreProgressMsg] = useState('');
  
  // Cloud Backup States
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupReport, setBackupReport] = useState<any>(null);

  // Sidebar access requests review states
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [reqLoading, setReqLoading] = useState(true);
  
  // Backup & Reset states
  const [backups, setBackups] = useState<any[]>([]);
  const [selectedBackup, setSelectedBackup] = useState<any>(null);
  const [viewingBackup, setViewingBackup] = useState<boolean>(false);
  const [selectedTableData, setSelectedTableData] = useState<any>(null);
  const [isViewingTableData, setIsViewingTableData] = useState<boolean>(false);
  const [fetchingTable, setFetchingTable] = useState<string | null>(null);
  
  const [resetTables, setResetTables] = useState<any[]>([]);
  const [selectedResetTables, setSelectedResetTables] = useState<string[]>([]);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Create User Form Dialog Modal State
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', full_name: '', password: '', phone: '', role: 'operator' });
  const [showFormPassword, setShowFormPassword] = useState(false);

  // Edit User Form Dialog Modal State
  const [showEditPassword, setShowEditPassword] = useState(false);
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
  const [selectedConfigRole, setSelectedConfigRole] = useState('operator');
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
    po_materials_hub: true,
    po_create: false,
    po_pending: true,
    po_returned: true,
    po_approved: true,
    po_rejected: true,
    po_accountant: true,
    po_completed: true,
    po_history: true,
    po_payment_status: true,
    hr_section: false,
    packing_section: false,
    upper_stock_section: false,
    materials_section: false,
    materials_inventory: true,
    materials_buying: true
  });

  const loadMenuConfig = (role: string = 'operator') => {
    fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_menu_visibility', role })
    })
      .then(res => {
        if (!res.ok) {
          if (res.status === 403 || res.status === 401) {
            return { config: {} };
          }
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then(d => {
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
          po_materials_hub: true,
          po_create: false,
          po_pending: true,
          po_returned: true,
          po_approved: true,
          po_rejected: true,
          po_accountant: true,
          po_completed: true,
          po_history: true,
          po_payment_status: true,
          hr_section: false,
          packing_section: false,
          upper_stock_section: false,
          materials_section: false,
          materials_inventory: true,
          materials_buying: true,
          ...d.config
        });
      })
      .catch(e => {
        if (!e.message?.includes('403') && !e.message?.includes('401')) {
          console.error('Failed to load menu visibility configs', e);
        }
      });
  };

  const handleSaveMenuConfig = async (role: string, newConfig: any) => {
    // Safety check: Prevent disabling all modules simultaneously
    const activeModules = Object.keys(newConfig).filter(k => newConfig[k] === true);
    if (activeModules.length === 0) {
      alert('⚠️ Security Guard Alert: You cannot disable all navigation links simultaneously. Each role must retain access to at least one system view.');
      return;
    }

    // Safety check: Admin must retain all permissions
    if (role === 'admin') {
      alert('🔒 Safety Notice: Administrator system privileges are locked as active and cannot be modified.');
      return;
    }

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_menu_visibility', role, config: newConfig })
      });
      if (res.ok) {
        setMenuConfig(newConfig);
        alert(`Sidebar menu visibility settings saved successfully for role "${role.toUpperCase()}"!`);
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
      .then(res => {
        if (!res.ok) {
          if (res.status === 403 || res.status === 401) {
            setLoading(false);
            return { users: [] };
          }
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then(d => { setUsers(d.users || []); setLoading(false); })
      .catch(e => {
        if (!e.message?.includes('403') && !e.message?.includes('401')) {
          console.error('Failed to load users', e);
        }
      });
  };

  const loadAuditLogs = () => {
    setLogLoading(true);
    fetch('/api/audit?limit=50')
      .then(res => {
        if (!res.ok) {
          if (res.status === 403 || res.status === 401) {
            setLogLoading(false);
            return { logs: [] };
          }
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then(d => { setLogs(d.logs || []); setLogLoading(false); })
      .catch(e => {
        if (!e.message?.includes('403') && !e.message?.includes('401')) {
          console.error('Failed to load audit logs', e);
        }
        setLogLoading(false);
      });
  };

  const loadAccessRequests = async () => {
    setReqLoading(true);
    try {
      const res = await fetch('/api/admin/access-requests');
      if (res.ok) {
        const data = await res.json();
        setPendingRequests(data.requests || []);
      }
    } catch (err) { /* ignore */ }
    setReqLoading(false);
  };

  const handleProcessRequest = async (requestId: number, status: 'approved' | 'rejected') => {
    try {
      const res = await fetch('/api/admin/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process', requestId, status })
      });
      if (res.ok) {
        loadAccessRequests();
        loadAuditLogs();
        loadMenuConfig(selectedConfigRole);
        alert(`Access request successfully ${status}!`);
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'Failed to process request');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const loadBackups = async () => {
    try {
      const res = await fetch('/api/admin/backup');
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups || []);
      }
    } catch (e) {
      console.error('Failed to load backups', e);
    }
  };

  const loadResetTables = async () => {
    try {
      const res = await fetch('/api/admin/backup/reset');
      if (res.ok) {
        const data = await res.json();
        setResetTables(data.tables || []);
      }
    } catch (e) {
      console.error('Failed to load reset tables', e);
    }
  };

  const handleViewBackup = async (fileName: string) => {
    setViewingBackup(true);
    setSelectedBackup(null);
    try {
      const res = await fetch(`/api/admin/backup/view?file=${fileName}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedBackup(data);
      } else {
        alert('Failed to read backup file.');
        setViewingBackup(false);
      }
    } catch (e) {
      alert('Network error while reading backup.');
      setViewingBackup(false);
    }
  };

  const handleViewTableData = async (fileName: string, tableName: string) => {
    setFetchingTable(tableName);
    try {
      const res = await fetch(`/api/admin/backup/view?file=${fileName}&table=${tableName}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSelectedTableData(data);
      setIsViewingTableData(true);
    } catch (err: any) {
      alert(err.message || 'Failed to fetch table data');
    } finally {
      setFetchingTable(null);
    }
  };

  const handleExecuteReset = async () => {
    if (selectedResetTables.length === 0) {
      alert('Please select at least one table to clean.');
      return;
    }
    
    const confirmMessage = `🛑 CRITICAL WARNING 🛑\n\nYou are about to PERMANENTLY ERASE data from ${selectedResetTables.length} tables.\nThis action CANNOT BE UNDONE.\n\nType "CONFIRM" to proceed with the database factory reset.`;
    const userPrompt = window.prompt(confirmMessage);
    
    if (userPrompt !== 'CONFIRM') {
      alert('Factory reset cancelled.');
      return;
    }

    setIsResetting(true);
    try {
      const res = await fetch('/api/admin/backup/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tables: selectedResetTables })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Success: ${data.message}`);
        setIsResetModalOpen(false);
        setSelectedResetTables([]);
        loadResetTables(); // Refresh counts
      } else {
        alert('Factory reset failed: ' + data.error);
      }
    } catch (e) {
      alert('Network error during reset.');
    } finally {
      setIsResetting(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadAuditLogs();
    loadMenuConfig();
    loadAccessRequests();
    loadBackups();
    loadResetTables();

    // Check URL queries
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const t = params.get('tab');
      if (t === 'requests') {
        setActiveTab('requests');
      }
    }

    // Handle Custom Event tab selection
    const handleSelect = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) setActiveTab(detail);
    };
    window.addEventListener('admin_select_tab', handleSelect);
    return () => window.removeEventListener('admin_select_tab', handleSelect);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleRestoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('⚠️ Please select or drop a valid backup database file first.');
      return;
    }
    if (!confirmRestore) {
      alert('⚠️ You must explicitly check the confirmation checkbox to continue.');
      return;
    }
    
    const doubleConfirm = confirm(
      '⚠️⚠️ DANGER ZONE DETECTED ⚠️⚠️\n\n' +
      'Are you absolutely 100% sure you want to perform this system restore?\n' +
      'This will completely overwrite all active warehouse ledgers, quantities, scan history, and user settings.\n' +
      'System will shut down concurrent operations during restore. This is your final warning!'
    );
    if (!doubleConfirm) return;

    setIsRestoring(true);
    setRestoreProgressMsg('Preparing system rollback point (stock.db.bak)...');
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      setRestoreProgressMsg('Uploading backup binary to server & unlinking WAL cache...');
      const res = await fetch('/api/system/restore', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Server rejected database swap.');
      }

      setRestoreProgressMsg('Integrity verified! Database re-initialized successfully.');
      alert('✅ SUCCESS: Database successfully restored from backup! The console will now reload to synchronize live states.');
      
      // Clean up inputs
      setSelectedFile(null);
      setConfirmRestore(false);
      
      // Reload state / logs
      loadUsers();
      loadAuditLogs();
      
      // Refresh browser page to reload all context
      window.location.reload();
    } catch (err: any) {
      console.error('[RESTORE FAILURE]', err);
      alert(`❌ RESTORE FAILURE: ${err.message || 'System failed to execute binary overwrite. Connection rolled back.'}`);
    } finally {
      setIsRestoring(false);
      setRestoreProgressMsg('');
    }
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
      {/* ── ENTERPRISE STORAGE & BACKUP CENTER ────────────────────────────── */}
      <div className="card mb-6" style={{
        background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
        border: '1px solid #334155',
        borderRadius: '16px',
        padding: '24px',
        color: 'white',
        animation: 'slideIn 0.3s ease-out',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          
          <div style={{ flex: '1 1 300px' }}>
            <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '24px' }}>☁️</span> Cloud Archive & Recovery
            </h4>
            <p style={{ margin: '6px 0 16px 0', fontSize: '13px', color: '#94a3b8', lineHeight: 1.5, maxWidth: '400px' }}>
              Securely serialize and transmit the entire relational database (PostgreSQL) and legacy archives (SQLite) to your designated encrypted external cloud provider.
            </p>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#cbd5e1', fontWeight: 800, letterSpacing: '0.05em' }}>PostgreSQL Pool</div>
                <div style={{ fontSize: '16px', fontWeight: 900, color: '#38bdf8', marginTop: '4px' }}>Healthy (Active)</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#cbd5e1', fontWeight: 800, letterSpacing: '0.05em' }}>Est. Archive Size</div>
                <div style={{ fontSize: '16px', fontWeight: 900, color: '#4ade80', marginTop: '4px' }}>~12.4 MB (Compressed)</div>
              </div>
            </div>

            <button 
              disabled={isBackingUp}
              onClick={async () => {
                setIsBackingUp(true);
                setBackupReport(null);
                try {
                  const res = await fetch('/api/admin/backup', { method: 'POST' });
                  const data = await res.json();
                  if (res.ok) setBackupReport(data);
                  else alert('Backup failed: ' + data.error);
                } catch (err) {
                  alert('Network error during backup.');
                } finally {
                  setIsBackingUp(false);
                }
              }}
              style={{
                background: isBackingUp ? '#475569' : 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: 800,
                cursor: isBackingUp ? 'wait' : 'pointer',
                boxShadow: isBackingUp ? 'none' : '0 4px 16px rgba(37, 99, 235, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.3s'
              }}>
              {isBackingUp ? (
                <>
                  <span className="spinner" style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  TRANSMITTING TO CLOUD...
                </>
              ) : (
                <>
                  🚀 INITIATE FULL CLOUD BACKUP
                </>
              )}
            </button>
          </div>

          <div style={{ flex: '1 1 300px', background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', minHeight: '160px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {backupReport ? (
              <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ background: '#16a34a', color: 'white', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    ✓
                  </div>
                  <h5 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#4ade80' }}>Backup Successfully Verified</h5>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Archive File</div>
                    <div style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 600, wordBreak: 'break-all' }}>{backupReport.file}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Total Payload</div>
                    <div style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 600 }}>{backupReport.size}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Dest. Cloud Provider</div>
                    <div style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 600 }}>{backupReport.cloudProvider}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Timestamp</div>
                    <div style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 600 }}>{new Date().toLocaleTimeString()}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#64748b' }}>
                <span style={{ fontSize: '32px', display: 'block', marginBottom: '12px', opacity: 0.5 }}>📡</span>
                <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Standby Mode</div>
                <div style={{ fontSize: '11px', marginTop: '4px' }}>Awaiting manual trigger or scheduled cron execution.</div>
              </div>
            )}
          </div>
        </div>

        {/* Backup History & Reset Tools */}
        <div style={{ marginTop: '24px', borderTop: '1px solid #334155', paddingTop: '24px', display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
          
          {/* Recent Archives List */}
          <div style={{ flex: '1 1 300px' }}>
            <h5 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 800, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🗄️</span> Recent Cloud Archives
            </h5>
            {backups.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '8px' }}>
                {backups.slice(0, 5).map(b => (
                  <div key={b.file} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#cbd5e1' }}>{new Date(b.createdAt).toLocaleDateString()} {new Date(b.createdAt).toLocaleTimeString()}</div>
                      <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{b.size} compressed</div>
                    </div>
                    <button 
                      onClick={() => handleViewBackup(b.file)}
                      style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#2563eb'}
                      onMouseLeave={e => e.currentTarget.style.background = '#3b82f6'}
                    >
                      View Contents
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>No archives found in storage.</div>
            )}
          </div>

          {/* Database Factory Reset */}
          <div style={{ flex: '1 1 300px' }}>
            <h5 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 800, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🛑</span> Danger Zone
            </h5>
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '16px', borderRadius: '12px' }}>
              <div style={{ fontSize: '12px', color: '#fca5a5', marginBottom: '12px', lineHeight: 1.5 }}>
                Database Factory Reset allows administrators to permanently purge operational data tables. Use only for full system resets after successfully securing a cloud backup.
              </div>
              <button
                onClick={() => setIsResetModalOpen(true)}
                style={{ background: '#ef4444', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#dc2626'}
                onMouseLeave={e => e.currentTarget.style.background = '#ef4444'}
              >
                <span>⚠️</span> CONFIGURE DATABASE CLEAN
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Backup Viewer Modal */}
      {viewingBackup && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease-out', padding: '20px' }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: 'white', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🔍</span> Archive Content Inspector
              </h3>
              <button onClick={() => setViewingBackup(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>&times;</button>
            </div>
            
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, color: '#cbd5e1' }}>
              {!selectedBackup ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '16px' }}>
                  <span className="spinner" style={{ width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.1)', borderTop: '3px solid #38bdf8', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>Decompressing and analyzing archive...</div>
                </div>
              ) : (
                <div style={{ animation: 'slideIn 0.3s ease-out' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 800 }}>Archive File</div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'white', marginTop: '4px', wordBreak: 'break-all' }}>{selectedBackup.file}</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 800 }}>Total Payload Size</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>{selectedBackup.size}</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 800 }}>Total Tables Backed Up</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#4ade80', marginTop: '4px' }}>{selectedBackup.totalTables}</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 800 }}>Total Rows Restorable</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#a78bfa', marginTop: '4px' }}>{selectedBackup.totalRows.toLocaleString()}</div>
                    </div>
                  </div>

                  <h4 style={{ fontSize: '13px', color: 'white', fontWeight: 800, marginBottom: '12px', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>Table Breakdown</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                    {Object.entries(selectedBackup.tables).map(([tableName, info]: [string, any]) => (
                      <div key={tableName} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0', marginBottom: '4px' }}>{tableName}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                          <span style={{ color: '#64748b' }}>Records Saved:</span>
                          <span style={{ color: '#4ade80', fontWeight: 800 }}>{info.rows.toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '2px' }}>
                          <span style={{ color: '#64748b' }}>Columns:</span>
                          <span style={{ color: '#cbd5e1', fontWeight: 700 }}>{info.columns.length}</span>
                        </div>
                        <button
                          onClick={() => handleViewTableData(selectedBackup.file, tableName)}
                          disabled={fetchingTable === tableName || info.rows === 0}
                          style={{
                            marginTop: '10px', width: '100%', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8',
                            border: '1px solid rgba(56, 189, 248, 0.3)', padding: '6px', borderRadius: '6px',
                            fontSize: '11px', fontWeight: 700, cursor: (fetchingTable === tableName || info.rows === 0) ? 'not-allowed' : 'pointer',
                            opacity: (fetchingTable === tableName || info.rows === 0) ? 0.5 : 1, transition: 'all 0.2s'
                          }}
                          onMouseEnter={e => { if (fetchingTable !== tableName && info.rows > 0) e.currentTarget.style.background = 'rgba(56, 189, 248, 0.2)'; }}
                          onMouseLeave={e => { if (fetchingTable !== tableName && info.rows > 0) e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)'; }}
                        >
                          {fetchingTable === tableName ? 'Loading...' : '🔍 View Data'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Specific Table Data Viewer Modal */}
      {isViewingTableData && selectedTableData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.95)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease-out', padding: '20px' }}>
          <div style={{ background: '#0f172a', border: '1px solid #38bdf8', borderRadius: '16px', width: '100%', maxWidth: '1200px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 0 40px rgba(56, 189, 248, 0.1)' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, color: 'white', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📊</span> Raw Data: <span style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{selectedTableData.table}</span>
                </h3>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>From archive: {selectedTableData.file} ({selectedTableData.data.length} records)</div>
              </div>
              <button onClick={() => setIsViewingTableData(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
            </div>
            
            <div style={{ padding: '20px', overflow: 'auto', flex: 1 }}>
              {selectedTableData.data.length === 0 ? (
                <div style={{ color: '#94a3b8', textAlign: 'center', marginTop: '40px' }}>No records found in this table.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', color: '#e2e8f0', fontFamily: 'monospace' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#1e293b', zIndex: 1 }}>
                    <tr>
                      {selectedTableData.columns.map((col: string) => (
                        <th key={col} style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #334155', color: '#38bdf8', whiteSpace: 'nowrap' }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTableData.data.slice(0, 100).map((row: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid #1e293b', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                        {selectedTableData.columns.map((col: string) => (
                          <td key={col} style={{ padding: '10px 12px', whiteSpace: 'nowrap', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {row[col] !== null && row[col] !== undefined ? String(row[col]) : <span style={{ color: '#64748b', fontStyle: 'italic' }}>NULL</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {selectedTableData.data.length > 100 && (
                <div style={{ textAlign: 'center', padding: '16px', color: '#94a3b8', fontSize: '12px', borderTop: '1px solid #1e293b', marginTop: '10px' }}>
                  Showing first 100 records for performance.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Database Factory Reset Modal */}
      {isResetModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease-out', padding: '20px', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#0f172a', border: '1px solid #ef4444', borderRadius: '16px', width: '100%', maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 0 50px rgba(239, 68, 68, 0.2)' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(239, 68, 68, 0.1)' }}>
              <h3 style={{ margin: 0, color: '#fca5a5', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 900 }}>
                <span>⚠️</span> SYSTEM FACTORY RESET
              </h3>
              <button onClick={() => setIsResetModalOpen(false)} style={{ background: 'none', border: 'none', color: '#fca5a5', fontSize: '20px', cursor: 'pointer' }}>&times;</button>
            </div>
            
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              <div style={{ background: '#1e293b', borderLeft: '4px solid #ef4444', padding: '12px 16px', borderRadius: '0 8px 8px 0', fontSize: '12px', color: '#cbd5e1', marginBottom: '20px', lineHeight: 1.6 }}>
                <strong>CRITICAL WARNING:</strong> Selecting tables below will execute a TRUNCATE CASCADE command, immediately and permanently deleting all records. Core infrastructure tables (users, system_settings) are locked and cannot be wiped. Ensure you have verified a cloud backup before proceeding.
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
                <h4 style={{ margin: 0, color: 'white', fontSize: '13px', fontWeight: 800 }}>Select Targets for Deletion</h4>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setSelectedResetTables(resetTables.filter(t => !['users', 'system_settings'].includes(t.name)).map(t => t.name))} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}>Select All</button>
                  <button onClick={() => setSelectedResetTables([])} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}>Clear</button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {resetTables.map(t => {
                  const isProtected = ['users', 'system_settings'].includes(t.name);
                  const isSelected = selectedResetTables.includes(t.name);
                  return (
                    <label key={t.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isSelected ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isSelected ? '#ef4444' : 'rgba(255,255,255,0.05)'}`, padding: '12px 16px', borderRadius: '8px', cursor: isProtected ? 'not-allowed' : 'pointer', transition: 'all 0.2s', opacity: isProtected ? 0.5 : 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <input 
                          type="checkbox" 
                          checked={isSelected || isProtected} 
                          disabled={isProtected}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedResetTables([...selectedResetTables, t.name]);
                            else setSelectedResetTables(selectedResetTables.filter(name => name !== t.name));
                          }}
                          style={{ width: '16px', height: '16px', accentColor: '#ef4444' }}
                        />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: isSelected ? '#fca5a5' : 'white' }}>{t.name}</div>
                          {isProtected && <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>🔒 Protected Core Table</div>}
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: isProtected ? '#94a3b8' : (t.rows > 0 ? '#fbbf24' : '#64748b') }}>
                        {t.rows.toLocaleString()} rows
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ padding: '20px', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: 'rgba(0,0,0,0.2)' }}>
              <button 
                onClick={() => setIsResetModalOpen(false)}
                style={{ background: 'transparent', color: 'white', border: '1px solid #475569', padding: '10px 20px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleExecuteReset}
                disabled={selectedResetTables.length === 0 || isResetting}
                style={{ background: '#ef4444', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: (selectedResetTables.length === 0 || isResetting) ? 'not-allowed' : 'pointer', opacity: (selectedResetTables.length === 0 || isResetting) ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {isResetting ? 'EXECUTING WIPE...' : `WIPE ${selectedResetTables.length} TABLES`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STATS COUNTER BLOCKS ────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
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

        {/* Card 3: Pending Approvals / Inactive Accounts */}
        <div className="card" style={{
          padding: '18px 24px',
          background: statInactive > 0 ? '#fff1f2' : 'white', // highlight if there are pending users
          borderRadius: '16px',
          border: statInactive > 0 ? '1px solid #fda4af' : '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transition: 'transform 0.2s',
          position: 'relative'
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'none'}
        >
          {statInactive > 0 && (
            <div style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', background: '#e11d48', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', boxShadow: '0 0 10px rgba(225, 29, 72, 0.5)', animation: 'pulseDot 1.5s infinite' }}>
              {statInactive}
            </div>
          )}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: statInactive > 0 ? '#be123c' : 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {statInactive > 0 ? 'Pending Approvals' : 'Inactive Accounts'}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: statInactive > 0 ? '#9f1239' : '#991b1b', marginTop: '4px' }}>{statInactive}</div>
          </div>
          <div style={{ fontSize: '32px', background: statInactive > 0 ? '#ffe4e6' : '#fef2f2', width: '56px', height: '56px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', animation: statInactive > 0 ? 'swing 2s infinite ease-in-out' : 'none' }}>
            {statInactive > 0 ? '🔔' : '🚫'}
          </div>
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

      {/* ── HIGH FIDELITY TAB SWITCHER ─────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: '#f1f5f9', padding: '5px', borderRadius: '14px', width: '100%', maxWidth: 'fit-content', border: '1px solid var(--border)', overflowX: 'auto', whiteSpace: 'nowrap' }}>
        <button 
          onClick={() => setActiveTab('users')} 
          style={{
            background: activeTab === 'users' ? 'white' : 'transparent',
            border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '13px', fontWeight: 800,
            color: activeTab === 'users' ? 'var(--text-main)' : 'var(--text-ghost)', cursor: 'pointer',
            boxShadow: activeTab === 'users' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          👥 User Directory & Permissions
        </button>
        <button 
          onClick={() => setActiveTab('requests')} 
          style={{
            background: activeTab === 'requests' ? 'white' : 'transparent',
            border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '13px', fontWeight: 800,
            color: activeTab === 'requests' ? 'var(--text-main)' : 'var(--text-ghost)', cursor: 'pointer',
            boxShadow: activeTab === 'requests' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          🔔 Access Requests
          {pendingRequests.length > 0 && (
            <span style={{ background: '#ef4444', color: 'white', fontSize: '10px', fontWeight: 900, borderRadius: '10px', padding: '2px 6px', lineHeight: 1 }}>
              {pendingRequests.length}
            </span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('signups')} 
          style={{
            background: activeTab === 'signups' ? 'white' : 'transparent',
            border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '13px', fontWeight: 800,
            color: activeTab === 'signups' ? 'var(--text-main)' : 'var(--text-ghost)', cursor: 'pointer',
            boxShadow: activeTab === 'signups' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: '6px', position: 'relative'
          }}
        >
          🆕 New Signups
          {statInactive > 0 && (
            <span style={{ background: '#e11d48', color: 'white', fontSize: '10px', fontWeight: 900, borderRadius: '10px', padding: '2px 7px', lineHeight: 1, animation: 'pulseDot 1.5s infinite' }}>
              {statInactive}
            </span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('audit')} 
          style={{
            background: activeTab === 'audit' ? 'white' : 'transparent',
            border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '13px', fontWeight: 800,
            color: activeTab === 'audit' ? 'var(--text-main)' : 'var(--text-ghost)', cursor: 'pointer',
            boxShadow: activeTab === 'audit' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          🛡️ System Audit Logs
        </button>
        <button 
          onClick={() => setActiveTab('backups')} 
          style={{
            background: activeTab === 'backups' ? 'white' : 'transparent',
            border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '13px', fontWeight: 800,
            color: activeTab === 'backups' ? 'var(--text-main)' : 'var(--text-ghost)', cursor: 'pointer',
            boxShadow: activeTab === 'backups' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          💾 Backup & Restore
        </button>
      </div>

      {activeTab === 'users' && (
        <>
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
        <div className="table-wrapper" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
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
              Define exactly what modules, sheets, and pages are visible for each user security role.
            </p>
            
            {/* Beautiful role selection pill dropdown */}
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc', padding: '10px 16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                👤 Select Role to Configure:
              </span>
              <select
                value={selectedConfigRole}
                onChange={e => {
                  setSelectedConfigRole(e.target.value);
                  loadMenuConfig(e.target.value);
                }}
                style={{
                  padding: '6px 12px',
                  border: '2px solid var(--primary)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 800,
                  background: 'white',
                  cursor: 'pointer',
                  outline: 'none',
                  color: 'var(--primary)',
                  transition: 'all 0.15s'
                }}
              >
                <option value="operator">Operator</option>
                <option value="accountant">Accountant</option>
                <option value="pm">Purchase Manager (PM)</option>
                <option value="supervisor">Supervisor</option>
                <option value="worker">Worker</option>
                <option value="admin">Administrator (Admin)</option>
              </select>
            </div>
          </div>
          <button
            onClick={() => handleSaveMenuConfig(selectedConfigRole, menuConfig)}
            style={{
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              padding: '12px 28px',
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
            💾 Save Role Permissions
          </button>
        </div>

        {/* Admin Safety Lock Banner */}
        {selectedConfigRole === 'admin' && (
          <div className="fade-up" style={{
            background: '#f0fdf4',
            border: '1.5px dashed #10b981',
            padding: '14px 20px',
            borderRadius: '12px',
            marginBottom: '20px',
            color: '#15803d',
            fontSize: '13px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span>🔒</span>
            <span><strong>Admin Safety Lock Active</strong>: Core system overrides are enabled. The Administrator role always retains full access to all system modules, data sheets, and granular operational permissions.</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {(() => {
            const sidebarGroups = [
              {
                category: 'Overview', mainKey: 'dashboard_section', icon: '👁️',
                items: [
                  { key: 'dashboard', label: 'Overview Dashboard', icon: '📊', desc: 'General stock statistics dashboard' },
                  { key: 'users_management', label: 'Users Management', icon: '👥', desc: 'Manage system accounts & profiles' }
                ]
              },
              {
                category: 'Workforce', mainKey: 'hr_section', icon: '👷',
                items: [
                  { key: 'hr_employees', label: 'Identity Matrix', icon: '🪪', desc: 'Employee data management' },
                  { key: 'hr_attendance', label: 'Attendance Grid', icon: '📅', desc: 'Track employee presence' },
                  { key: 'hr_adjustments', label: 'Adjustments', icon: '⚖️', desc: 'Advances and penalties' },
                  { key: 'hr_payroll', label: 'Payroll Engine', icon: '💸', desc: 'Generate salary data' },
                  { key: 'hr_salary_slips', label: 'Salary Slips', icon: '📄', desc: 'Printable worker payslips' }
                ]
              },
              {
                category: 'PM Master Data', mainKey: 'pm_section', icon: '👑',
                items: [
                  { key: 'pm_manage_articles', label: 'Manage Articles', icon: '📚', desc: 'Manage master articles' },
                  { key: 'pm_create_article', label: 'Create Article', icon: '✨', desc: 'Create new core designs' },
                  { key: 'pm_deleted_articles', label: 'Deleted Articles', icon: '🗑️', desc: 'View deleted articles' },
                  { key: 'pm_material_library', label: 'Material Library', icon: '🧵', desc: 'Manage material assets' },
                  { key: 'pm_cost_analysis', label: 'Cost Analysis', icon: '💰', desc: 'Article costings and margins' }
                ]
              },
              {
                category: 'Packing', mainKey: 'packing_section', icon: '📦',
                items: [
                  { key: 'scanning_intake', label: 'Scanning Intake', icon: '⚡', desc: 'Live barcode scanning engine' },
                  { key: 'manual_entry', label: 'Manual Entry', icon: '📝', desc: 'Offline batch registration' },
                  { key: 'inventory_pool', label: 'Inventory Pool', icon: '📥', desc: 'Unpacked pair holding area' },
                  { key: 'carton_generation', label: 'Carton Generation', icon: '⚙️', desc: 'Generate master packaging barcodes' },
                  { key: 'packed_inventory', label: 'Packed Inventory', icon: '📦', desc: 'Completed packages & cartons' },
                  { key: 'scan_history', label: 'Scan History', icon: '📋', desc: 'System-wide scan audit logs' }
                ]
              },
              {
                category: 'Upper Stock', mainKey: 'upper_stock_section', icon: '🩴',
                items: [
                  { key: 'daily_activity', label: 'Daily Activity', icon: '📅', desc: 'Track daily stock ops' },
                  { key: 'live_inventory', label: 'Live Inventory', icon: '📦', desc: 'Current available stock' },
                  { key: 'stock_movement', label: 'Stock Movement', icon: '🔄', desc: 'Internal stock transfers' },
                  { key: 'v_strap_entry', label: 'V-Strap Entry', icon: '🩴', desc: 'Strap specific operations' },
                  { key: 'reports_sheets', label: 'Reports & Sheets', icon: '📝', desc: 'Downloadable sheets' }
                ]
              },
              {
                category: 'Materials', mainKey: 'materials_section', icon: '🧵',
                items: [
                  { key: 'materials_inventory', label: 'Materials Inventory', icon: '📦', desc: 'Raw materials tracking' },
                  { key: 'materials_buying', label: 'Material Buying', icon: '🛒', desc: 'Material procurement' }
                ]
              },
              {
                category: 'Purchasing Order', mainKey: 'po_section', icon: '📄',
                items: [
                  { key: 'po_dashboard', label: 'PO Dashboard', icon: '📊', desc: 'Purchasing overview' },
                  { key: 'po_materials_hub', label: 'Materials Hub', icon: '📦', desc: 'Material definitions' },
                  { key: 'po_create', label: 'Create PO', icon: '✍️', desc: 'Draft new purchase order' },
                  { key: 'po_pending', label: 'Pending Approval', icon: '⏳', desc: 'POs awaiting clearance' },
                  { key: 'po_returned', label: 'Returned POs', icon: '🔄', desc: 'POs sent back for revision' },
                  { key: 'po_approved', label: 'Approved PO', icon: '✅', desc: 'Cleared for processing' },
                  { key: 'po_rejected', label: 'Rejected PO', icon: '❌', desc: 'Permanently denied POs' },
                  { key: 'po_accountant', label: 'Acct Processing', icon: '💸', desc: 'Ledger payment posting' },
                  { key: 'po_supervisor', label: 'PO Material Receive', icon: '🔍', desc: 'Verify materials' },
                  { key: 'po_completed', label: 'Completed PO', icon: '📁', desc: 'Closed purchasing records' },
                  { key: 'po_history', label: 'PO History', icon: '🕒', desc: 'Full PO audit timeline' },
                  { key: 'po_payment_status', label: 'Payment Completed', icon: '💰', desc: 'Accountant closed ledger' }
                ]
              }
            ];
            return sidebarGroups.map(group => {
              const isMainChecked = selectedConfigRole === 'admin' ? true : !!menuConfig[group.mainKey];
              return (
                <div key={group.mainKey} style={{ background: '#f8fafc', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #cbd5e1', paddingBottom: '12px', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{group.icon}</span> {group.category}
                    </h3>
                    {group.mainKey !== 'dashboard_section' && (
                      <label style={{ position: 'relative', display: 'inline-block', width: '42px', height: '24px' }}>
                        <input
                          type="checkbox"
                          checked={isMainChecked}
                          disabled={selectedConfigRole === 'admin'}
                          onChange={e => setMenuConfig({ ...menuConfig, [group.mainKey]: e.target.checked })}
                          style={{ opacity: 0, width: 0, height: 0 }}
                        />
                        <span style={{
                          position: 'absolute', cursor: selectedConfigRole === 'admin' ? 'default' : 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                          backgroundColor: isMainChecked ? '#22c55e' : '#cbd5e1',
                          borderRadius: '24px', transition: 'all 0.3s',
                          boxShadow: isMainChecked ? 'inset 0 2px 4px rgba(0,0,0,0.1)' : 'none'
                        }}>
                          <span style={{
                            position: 'absolute', height: '18px', width: '18px', left: '3px', bottom: '3px',
                            backgroundColor: 'white', borderRadius: '50%', transition: 'all 0.3s',
                            transform: isMainChecked ? 'translateX(18px)' : 'none',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                          }}></span>
                        </span>
                      </label>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', opacity: (selectedConfigRole === 'admin' || isMainChecked) ? 1 : 0.4, pointerEvents: (selectedConfigRole === 'admin' || isMainChecked) ? 'auto' : 'none', transition: 'opacity 0.3s' }}>
                    {group.items.map(item => {
                      const isChecked = selectedConfigRole === 'admin' ? true : !!menuConfig[item.key];
                      return (
                        <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '16px' }}>{item.icon}</span>
                            <div>
                              <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-main)' }}>{item.label}</div>
                              <div style={{ fontSize: '10.5px', color: 'var(--text-ghost)', marginTop: '1px' }}>{item.desc}</div>
                            </div>
                          </div>
                          <label style={{ position: 'relative', display: 'inline-block', width: '38px', height: '20px', flexShrink: 0 }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={selectedConfigRole === 'admin'}
                              onChange={e => setMenuConfig({ ...menuConfig, [item.key]: e.target.checked })}
                              style={{ opacity: 0, width: 0, height: 0 }}
                            />
                            <span style={{
                              position: 'absolute', cursor: selectedConfigRole === 'admin' ? 'default' : 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                              backgroundColor: isChecked ? '#3b82f6' : '#cbd5e1',
                              borderRadius: '20px', transition: 'all 0.3s'
                            }}>
                              <span style={{
                                position: 'absolute', height: '14px', width: '14px', left: '3px', bottom: '3px',
                                backgroundColor: 'white', borderRadius: '50%', transition: 'all 0.3s',
                                transform: isChecked ? 'translateX(18px)' : 'none'
                              }}></span>
                            </span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>
      </>
      )}

      {/* ── MODULE ACCESS REQUESTS TAB ─────────────────────────────────── */}
      {activeTab === 'requests' && (
        <div className="card" style={{ background: 'white', borderRadius: '16px', border: '1px solid var(--border)', padding: '24px', animation: 'slideIn 0.3s ease-out' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🔔 Pending Module Access Requests
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-ghost)', margin: '0 0 20px 0', fontWeight: 600 }}>
            Process non-admin request queues to grant dynamic module unlocks on specific operational roles
          </p>
          
          {reqLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-ghost)' }}>Loading request lists...</div>
          ) : pendingRequests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 40px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed var(--border)' }}>
              <span style={{ fontSize: '36px', display: 'block', marginBottom: '10px' }}>🎉</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>All caught up!</span>
              <p style={{ fontSize: '12px', color: 'var(--text-ghost)', margin: '4px 0 0 0' }}>There are no active module access requests from standard accounts at this time.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {pendingRequests.map((req: any) => (
                <div key={req.id} style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: '#f8fafc', border: '1.5px solid var(--border)', borderRadius: '14px', transition: 'all 0.2s', flexWrap: 'wrap', gap: '16px' }}>
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '24px', background: '#eff6ff', width: '48px', height: '48px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>{req.username}</span>
                        <span style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '12px', textTransform: 'uppercase' }}>
                          {req.role}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-main)', marginTop: '4px', fontWeight: 700 }}>
                        Requested access to: <span style={{ color: '#10b981' }}>{req.module_name}</span> (<code>{req.module_key}</code>)
                      </div>
                      {req.reason && (
                        <div style={{ background: 'white', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', color: '#475569', marginTop: '8px', fontStyle: 'italic' }}>
                          &ldquo;{req.reason}&rdquo;
                        </div>
                      )}
                      <div style={{ fontSize: '10.5px', color: 'var(--text-ghost)', marginTop: '6px', fontWeight: 600 }}>
                        Submitted on: {formatToIST(req.created_at)}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => handleProcessRequest(req.id, 'rejected')}
                      style={{
                        background: '#fee2e2', border: 'none', color: '#991b1b', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fca5a5'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fee2e2'}
                    >
                      ❌ Deny Request
                    </button>
                    <button
                      onClick={() => handleProcessRequest(req.id, 'approved')}
                      style={{
                        background: '#dcfce7', border: 'none', color: '#166534', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#86efac'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = '#dcfce7'}
                    >
                      ✅ Approve Request
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── NEW USER SIGNUPS APPROVAL HUB ──────────────────────────────── */}
      {activeTab === 'signups' && (() => {
        const pendingSignups = users.filter(u => u.is_active === 0);
        const approveUser = async (id: number, name: string) => {
          setApprovingId(id);
          await fetch('/api/admin', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update_user', user_id: id, is_active: true })
          });
          loadUsers(); loadAuditLogs();
          setApprovingId(null);
        };
        const rejectUser = async (id: number, name: string) => {
          if (!confirm(`Permanently delete "${name}"'s signup request? They will need to re-register.`)) return;
          setRejectingId(id);
          await fetch('/api/admin', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete_user', user_id: id })
          });
          loadUsers(); loadAuditLogs();
          setRejectingId(null);
        };

        const avatarColors = [
          ['#667eea','#764ba2'], ['#f093fb','#f5576c'], ['#4facfe','#00f2fe'],
          ['#43e97b','#38f9d7'], ['#fa709a','#fee140'], ['#a18cd1','#fbc2eb'],
          ['#fda085','#f6d365'], ['#96fbc4','#f9f7ff'],
        ];

        return (
          <div style={{ animation: 'fadeInPage 0.4s ease-out' }}>
            {/* Hero Banner */}
            <div style={{
              background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
              borderRadius: '24px',
              padding: '36px 40px',
              marginBottom: '28px',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(15,12,41,0.4)'
            }}>
              {/* Animated orbs */}
              <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(102,126,234,0.3) 0%, transparent 70%)', borderRadius: '50%', animation: 'pulse 3s ease-in-out infinite' }} />
              <div style={{ position: 'absolute', bottom: '-30px', left: '30%', width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(240,147,251,0.2) 0%, transparent 70%)', borderRadius: '50%', animation: 'pulse 4s ease-in-out infinite 1s' }} />

              <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
                    <div style={{ width: '48px', height: '48px', background: 'rgba(255,255,255,0.1)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.15)' }}>🛡️</div>
                    <div>
                      <div style={{ fontSize: '22px', fontWeight: 900, color: 'white', letterSpacing: '-0.3px' }}>Access Approval Center</div>
                      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', fontWeight: 500, marginTop: '2px' }}>Review and grant system access to new registrants</div>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '16px', padding: '14px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', fontWeight: 900, color: '#f87171', lineHeight: 1 }}>{pendingSignups.length}</div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '4px' }}>Awaiting</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '16px', padding: '14px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', fontWeight: 900, color: '#34d399', lineHeight: 1 }}>{users.filter(u => u.is_active === 1).length}</div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '4px' }}>Active</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Cards Grid */}
            {pendingSignups.length === 0 ? (
              <div style={{
                background: 'white', borderRadius: '24px', border: '1px solid var(--border)',
                padding: '80px 40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
              }}>
                <div style={{ fontSize: '64px', marginBottom: '16px', filter: 'drop-shadow(0 4px 12px rgba(34,197,94,0.3))' }}>✅</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>All Clear — No Pending Signups</div>
                <div style={{ fontSize: '14px', color: 'var(--text-ghost)', fontWeight: 500 }}>Every registered applicant has been reviewed. The system is fully up to date.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                {pendingSignups.map((u, idx) => {
                  const [c1, c2] = avatarColors[idx % avatarColors.length];
                  const initials = (u.full_name || u.username).split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0,2);
                  const isApproving = approvingId === u.id;
                  const isRejecting = rejectingId === u.id;
                  const signedAt = u.created_at ? formatToIST(u.created_at) : 'Unknown';

                  return (
                    <div key={u.id} style={{
                      background: 'white',
                      borderRadius: '20px',
                      border: '1px solid #f0f0f0',
                      overflow: 'hidden',
                      boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                      transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s ease',
                      animation: `slideIn 0.4s ease-out ${idx * 0.07}s both`,
                      cursor: 'default'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = '0 16px 48px rgba(0,0,0,0.12)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.06)'; }}
                    >
                      {/* Top gradient band */}
                      <div style={{ height: '6px', background: `linear-gradient(90deg, ${c1}, ${c2})` }} />

                      <div style={{ padding: '24px' }}>
                        {/* Header row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                          {/* Avatar */}
                          <div style={{
                            width: '56px', height: '56px', borderRadius: '16px', flexShrink: 0,
                            background: `linear-gradient(135deg, ${c1}, ${c2})`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '20px', fontWeight: 900, color: 'white',
                            boxShadow: `0 8px 20px ${c1}55`,
                            letterSpacing: '-0.5px'
                          }}>
                            {initials}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {u.full_name || u.username}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>@{u.username}</div>
                          </div>
                          {/* Status pill */}
                          <div style={{
                            background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '20px',
                            padding: '4px 10px', fontSize: '10px', fontWeight: 800, color: '#c2410c',
                            textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap',
                            display: 'flex', alignItems: 'center', gap: '5px'
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f97316', display: 'inline-block', animation: 'pulseDot 1.5s infinite' }} />
                            Pending
                          </div>
                        </div>

                        {/* Info rows */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', background: '#f8fafc', borderRadius: '12px', padding: '14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Phone</span>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155', fontFamily: 'monospace' }}>{u.phone || <span style={{ color: '#cbd5e1', fontStyle: 'italic', fontWeight: 500 }}>Not provided</span>}</span>
                          </div>
                          <div style={{ height: '1px', background: '#e2e8f0' }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Password</span>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155', fontFamily: 'monospace', background: '#e2e8f0', padding: '2px 8px', borderRadius: '6px' }}>
                              {revealedPasswords[u.id] ? (u.plain_password || '—') : '••••••••'}
                              <button onClick={() => togglePasswordReveal(u.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', marginLeft: '6px', opacity: 0.6 }} title="Reveal">
                                {revealedPasswords[u.id] ? '🙈' : '👁️'}
                              </button>
                            </span>
                          </div>
                          <div style={{ height: '1px', background: '#e2e8f0' }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Applied</span>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', fontFamily: 'monospace' }}>{signedAt}</span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button
                            disabled={isApproving || isRejecting}
                            onClick={() => approveUser(u.id, u.full_name || u.username)}
                            style={{
                              flex: 1,
                              padding: '11px',
                              borderRadius: '12px',
                              border: 'none',
                              background: isApproving ? '#d1fae5' : 'linear-gradient(135deg, #22c55e, #16a34a)',
                              color: isApproving ? '#166534' : 'white',
                              fontSize: '13px',
                              fontWeight: 800,
                              cursor: isApproving ? 'wait' : 'pointer',
                              transition: 'all 0.2s',
                              boxShadow: isApproving ? 'none' : '0 4px 14px rgba(34,197,94,0.35)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                            }}
                            onMouseEnter={e => { if (!isApproving && !isRejecting) { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(34,197,94,0.5)'; }}}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(34,197,94,0.35)'; }}
                          >
                            {isApproving ? <><span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>⏳</span> Approving…</> : <>✅ Approve Access</>}
                          </button>
                          <button
                            disabled={isApproving || isRejecting}
                            onClick={() => rejectUser(u.id, u.full_name || u.username)}
                            style={{
                              padding: '11px 16px',
                              borderRadius: '12px',
                              border: '1.5px solid #fecaca',
                              background: isRejecting ? '#fee2e2' : 'white',
                              color: '#dc2626',
                              fontSize: '13px',
                              fontWeight: 800,
                              cursor: isRejecting ? 'wait' : 'pointer',
                              transition: 'all 0.2s',
                              display: 'flex', alignItems: 'center', gap: '6px'
                            }}
                            onMouseEnter={e => { if (!isApproving && !isRejecting) { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.transform = 'scale(1.03)'; }}}
                            onMouseLeave={e => { e.currentTarget.style.background = isRejecting ? '#fee2e2' : 'white'; e.currentTarget.style.transform = 'none'; }}
                          >
                            {isRejecting ? '…' : '🗑️'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── SECURITY & SYSTEM AUDIT LOGS STREAM TIMELINE ───────────────── */}
      {activeTab === 'audit' && (
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
      )}

      {/* ── DATABASE BACKUPS & DISASTER RECOVERY PANEL ───────────────────── */}
      {activeTab === 'backups' && (
      <div className="card mt-8" style={{
        padding: '24px',
        background: 'white',
        borderRadius: '16px',
        border: '1px solid var(--border)',
        animation: 'slideIn 0.5s ease-out',
        boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
      }}>
        {/* Tab Title Area */}
        <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            💾 Database Backups & Disaster Recovery Command Console
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-ghost)', margin: '4px 0 0 0', fontWeight: 600 }}>
            Configure and run local offline backups, or deploy secure checkpoint rollback recovery points on host warehouse hardware.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          
          {/* LEFT COLUMN: DOWNLOAD / GENERATE BACKUP */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span style={{ fontSize: '24px' }}>📦</span>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>Generate Local Database Backup</h3>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '20px', fontWeight: 500 }}>
                Compiles the active warehouse SQLite ledger (<code>data/stock.db</code>) into a single downloadable binary file.
                This contains all current inventory quantities, historic scanning records, user access credentials, and PO logs.
              </p>
              <div style={{
                background: '#f1f5f9',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '20px'
              }}>
                ℹ️ File is named in the format: <code>upperstock_backup_DD-MM-YYYY_HH-MM.db</code>
              </div>
            </div>
            
            <button
              onClick={() => window.open('/api/system/backup')}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                background: 'var(--primary)',
                color: 'white',
                border: 'none',
                fontWeight: 800,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'opacity 0.15s, transform 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              📥 Generate & Download Backup File
            </button>
          </div>

          {/* RIGHT COLUMN: RESTORE BACKUP */}
          <div style={{
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            borderRadius: '14px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span style={{ fontSize: '24px' }}>⚠️</span>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#991b1b' }}>Safe-Rollback Database Restore</h3>
              </div>
              <p style={{ fontSize: '13px', color: '#9f1239', lineHeight: 1.5, marginBottom: '16px', fontWeight: 600 }}>
                Overwrites the active warehouse state with the chosen backup. The server will run internal binary validation headers checks and automatically construct a temporary backup snapshot (<code>data/stock.db.bak</code>) before performing the swap.
              </p>

              {/* Warning Alert Panel */}
              <div style={{
                background: '#fee2e2',
                border: '1px solid #fca5a5',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '12px',
                color: '#7f1d1d',
                fontWeight: 700,
                lineHeight: 1.4,
                marginBottom: '20px'
              }}>
                🚨 CRITICAL NOTICE: Overwriting active ledgers immediately logs out concurrent client terminals and resets inventory mappings to the point of backup compilation.
              </div>

              {/* File Input and Confirm */}
              <form onSubmit={handleRestoreSubmit}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#991b1b', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Select Backup Database File (.db)
                  </label>
                  <input
                    type="file"
                    accept=".db,.sqlite,.sqlite3"
                    onChange={handleFileChange}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '8px',
                      border: '1px dashed #fda4af',
                      background: 'white',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#475569',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  />
                  {selectedFile && (
                    <div style={{ fontSize: '11px', color: '#15803d', fontWeight: 800, marginTop: '4px' }}>
                      ✓ Selected File: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '20px' }}>
                  <input
                    type="checkbox"
                    id="confirmRestoreCheckbox"
                    checked={confirmRestore}
                    onChange={e => setConfirmRestore(e.target.checked)}
                    style={{ marginTop: '2px', cursor: 'pointer' }}
                  />
                  <label htmlFor="confirmRestoreCheckbox" style={{ fontSize: '12px', color: '#9f1239', fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}>
                    I confirm I want to restore this backup file and overwrite active database ledgers.
                  </label>
                </div>

                {isRestoring ? (
                  <div style={{
                    padding: '12px',
                    borderRadius: '10px',
                    background: '#fda4af',
                    color: '#991b1b',
                    textAlign: 'center',
                    fontWeight: 800,
                    fontSize: '13px',
                    animation: 'pulseDot 1.5s infinite'
                  }}>
                    ⏳ {restoreProgressMsg || 'Swapping active database files...'}
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={!selectedFile || !confirmRestore}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '10px',
                      background: (!selectedFile || !confirmRestore) ? '#fca5a5' : '#e11d48',
                      color: 'white',
                      border: 'none',
                      fontWeight: 800,
                      fontSize: '13px',
                      cursor: (!selectedFile || !confirmRestore) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'opacity 0.15s'
                    }}
                  >
                    🔥 Execute Database Restore
                  </button>
                )}
              </form>

            </div>
          </div>

        </div>
      </div>
      )}

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
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showFormPassword ? "text" : "password"}
                      required
                      placeholder="Set login password..."
                      value={form.password}
                      onChange={e => setForm({...form, password: e.target.value})}
                      style={{ padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '13px', outline: 'none', width: '100%', paddingRight: '48px' }}
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowFormPassword(!showFormPassword)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', border: 'none', color: 'rgba(148, 163, 184, 0.8)', cursor: 'pointer', padding: '4px 8px', fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.05em', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', zIndex: 10 }}
                      title={showFormPassword ? 'Hide Password' : 'Show Password'}
                    >
                      {showFormPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
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
                <div style={{ position: 'relative' }}>
                  <input
                    type={showEditPassword ? "text" : "password"}
                    placeholder="Enter new password to force update..."
                    value={editForm.password}
                    onChange={e => setEditForm({...editForm, password: e.target.value})}
                    style={{ padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '13px', outline: 'none', width: '100%', paddingRight: '48px' }}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', border: 'none', color: 'rgba(148, 163, 184, 0.8)', cursor: 'pointer', padding: '4px 8px', fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.05em', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', zIndex: 10 }}
                    title={showEditPassword ? 'Hide Password' : 'Show Password'}
                  >
                    {showEditPassword ? '🙈' : '👁️'}
                  </button>
                </div>
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
