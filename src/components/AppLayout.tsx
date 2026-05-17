'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';

const DEFAULT_MENU_VISIBILITY = {
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
  po_section: false
};

export default function AppLayout({ children, user }: { children: React.ReactNode, user: any }) {
  const router = useRouter();
  const pathname = usePathname();
  const [upperStockOpen, setUpperStockOpen] = useState(false);
  const [packingOpen, setPackingOpen] = useState(false);
  const [poOpen, setPoOpen] = useState(false);
  const [menuVisibility, setMenuVisibility] = useState<any>(DEFAULT_MENU_VISIBILITY);

  // Accordion toggle triggers
  const togglePacking = () => {
    if (packingOpen) {
      setPackingOpen(false);
    } else {
      setPackingOpen(true);
      setUpperStockOpen(false);
      setPoOpen(false);
    }
  };

  const toggleUpperStock = () => {
    if (upperStockOpen) {
      setUpperStockOpen(false);
    } else {
      setUpperStockOpen(true);
      setPackingOpen(false);
      setPoOpen(false);
    }
  };

  const togglePo = () => {
    if (poOpen) {
      setPoOpen(false);
    } else {
      setPoOpen(true);
      setPackingOpen(false);
      setUpperStockOpen(false);
    }
  };

  // Sync active path with accordion state
  useEffect(() => {
    const isPackingPath = pathname.startsWith('/packing') || 
                          pathname === '/inventory-pool' || 
                          pathname === '/carton-generation' || 
                          pathname === '/packed-inventory' || 
                          pathname === '/scan-history';

    const isUpperStockPath = pathname.startsWith('/daily') || 
                            pathname === '/inventory' || 
                            pathname === '/inward-outward' || 
                            pathname === '/v-strap' || 
                            pathname === '/reports';

    const isPoPath = pathname.startsWith('/po');

    if (isPackingPath) {
      setPackingOpen(true);
      setUpperStockOpen(false);
      setPoOpen(false);
    } else if (isUpperStockPath) {
      setUpperStockOpen(true);
      setPackingOpen(false);
      setPoOpen(false);
    } else if (isPoPath) {
      setPoOpen(true);
      setPackingOpen(false);
      setUpperStockOpen(false);
    } else {
      // Main dashboard / or other non-dropdown pages
      setPackingOpen(false);
      setUpperStockOpen(false);
      setPoOpen(false);
    }
  }, [pathname]);

  // ── Admin: pending PO count bell ────────────────────────────────────────
  const [pendingCount, setPendingCount]   = useState(0);
  const [bellSeen,     setBellSeen]       = useState(false);
  const [bellOpen,     setBellOpen]       = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  // ── User (PM / Accountant): notification bell ───────────────────────────
  const [userNotifs,      setUserNotifs]      = useState<any[]>([]);
  const [userUnread,      setUserUnread]      = useState(0);
  const [userBellOpen,    setUserBellOpen]    = useState(false);
  const userBellRef = useRef<HTMLDivElement>(null);

  const isAdmin     = user?.role === 'admin';
  const isPM        = user?.role === 'pm';
  const isAcct      = user?.role === 'accountant';
  const hasUserBell = isPM || isAcct;

  const [returnedCount, setReturnedCount] = useState(0);
  const [accountantCount, setAccountantCount] = useState(0);

  // ── Profile Dropdown and Modals states ────────────────────────────────────
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const [activeModal, setActiveModal] = useState<'change_name' | 'settings' | null>(null);
  const [newName, setNewName] = useState(user?.full_name || '');
  const [newUsername, setNewUsername] = useState(user?.username || '');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [usePhoneAsUsername, setUsePhoneAsUsername] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  const openModal = async (type: 'change_name' | 'settings') => {
    setActiveModal(type);
    setModalError('');
    setModalSuccess('');
    setNewPassword('');
    setConfirmPassword('');
    if (type === 'change_name') {
      setNewName(user.full_name);
    }
    if (type === 'settings') {
      try {
        const res = await fetch('/api/auth/profile');
        if (res.ok) {
          const data = await res.json();
          setNewUsername(data.user.username);
          setNewPhone(data.user.phone || '');
          setUsePhoneAsUsername(data.user.username === data.user.phone);
        }
      } catch (e) {
        console.error('Failed to load profile details', e);
      }
    }
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setModalSuccess('');
    setModalLoading(true);

    if (activeModal === 'settings' && newPassword && newPassword !== confirmPassword) {
      setModalError('Passwords do not match');
      setModalLoading(false);
      return;
    }

    try {
      const payload: any = {};
      if (activeModal === 'change_name') {
        payload.full_name = newName;
      } else {
        payload.phone = newPhone || null;
        payload.username = newUsername;
        if (newPassword) payload.password = newPassword;
      }

      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setModalSuccess('Updated successfully!');
        setTimeout(() => {
          setActiveModal(null);
          window.location.reload();
        }, 1000);
      } else {
        const data = await res.json().catch(() => ({}));
        setModalError(data.error || 'Failed to update profile settings.');
      }
    } catch (err: any) {
      setModalError(`Network error: ${err.message}`);
    } finally {
      setModalLoading(false);
    }
  };

  // Fetch PO counts for Admin, PM, and Accountant roles
  useEffect(() => {
    if (!user || user.role === 'worker') return;
    const fetchCounts = async () => {
      try {
        const res  = await fetch('/api/po');
        const data = await res.json();
        if (Array.isArray(data.pos)) {
          if (user.role === 'admin') {
            const pnd = data.pos.filter((p: any) => p.status === 'pending_admin_approval').length;
            const ret = data.pos.filter((p: any) => p.status === 'returned_for_edit').length;
            const acct = data.pos.filter((p: any) => p.status === 'accountant_processing').length;
            setPendingCount(pnd);
            setReturnedCount(ret);
            setAccountantCount(acct);
          } else if (user.role === 'pm') {
            const ret = data.pos.filter((p: any) => p.status === 'returned_for_edit').length;
            setReturnedCount(ret);
          } else if (user.role === 'accountant') {
            const acct = data.pos.filter((p: any) => p.status === 'accountant_processing').length;
            setAccountantCount(acct);
          }
        }
      } catch { /* ignore */ }
    };
    fetchCounts();
    const t = setInterval(fetchCounts, 30000); // Check every 30s
    return () => clearInterval(t);
  }, [user]);

  // Fetch custom menu visibility configs
  useEffect(() => {
    const loadVisibility = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.menuVisibility) {
            setMenuVisibility(data.menuVisibility);
          } else {
            setMenuVisibility(DEFAULT_MENU_VISIBILITY);
          }
        } else {
          setMenuVisibility(DEFAULT_MENU_VISIBILITY);
        }
      } catch {
        setMenuVisibility(DEFAULT_MENU_VISIBILITY);
      }
    };
    loadVisibility();
    window.addEventListener('menu_settings_updated', loadVisibility);
    return () => window.removeEventListener('menu_settings_updated', loadVisibility);
  }, []);

  // Admin bell: mark seen when visiting /po/pending
  useEffect(() => {
    if (isAdmin && pathname === '/po/pending') { setBellSeen(true); setBellOpen(false); }
  }, [pathname, isAdmin]);

  // Admin bell: un-see when new items arrive
  useEffect(() => {
    if (isAdmin && pendingCount > 0) setBellSeen(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCount]);

  // PM / Accountant: fetch notifications every 30 s
  useEffect(() => {
    if (!hasUserBell) return;
    const fetch_ = async () => {
      try {
        const res  = await fetch('/api/notifications');
        const data = await res.json();
        setUserNotifs(data.notifications || []);
        setUserUnread(data.unreadCount  || 0);
      } catch { /* ignore */ }
    };
    fetch_();
    const t = setInterval(fetch_, 30000);
    return () => clearInterval(t);
  }, [hasUserBell]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current     && !bellRef.current.contains(e.target as Node))     setBellOpen(false);
      if (userBellRef.current && !userBellRef.current.contains(e.target as Node)) setUserBellOpen(false);
      if (profileRef.current  && !profileRef.current.contains(e.target as Node))  setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const markAllRead = async () => {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ markAllRead: true }) });
    setUserNotifs(prev => prev.map(n => ({ ...n, is_read: 1 })));
    setUserUnread(0);
  };

  const handleNotifClick = async (n: any) => {
    if (!n.is_read) {
      try {
        await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: n.id })
        });
        setUserNotifs(prev => prev.map(item => item.id === n.id ? { ...item, is_read: 1 } : item));
        setUserUnread(prev => Math.max(0, prev - 1));
      } catch (err) {
        console.error('Failed to mark notification as read', err);
      }
    }
    setUserBellOpen(false);

    // Redirect based on role and notification type
    if (user?.role === 'accountant' && n.type === 'approved') {
      router.push('/po/accountant');
    } else if (user?.role === 'pm' && n.type === 'returned_for_edit') {
      router.push('/po/returned');
    } else if (n.type === 'rejected') {
      router.push('/po/rejected');
    } else {
      router.push('/po');
    }
  };

  // Nav link with optional red badge
  const NavLink = ({ href, icon, label, exact = false, badge }: { href: string, icon: string, label: string, exact?: boolean, badge?: number }) => {
    const isActive = exact ? pathname === href : pathname.startsWith(href);
    return (
      <Link href={href} className={`nav-btn ${isActive ? 'active' : ''}`} style={{ position: 'relative' }}>
        <span style={{ fontSize: '18px' }}>{icon}</span>
        <span style={{ flex: 1 }}>{label}</span>
        {badge !== undefined && badge > 0 && (
          <span style={{ background: '#ef4444', color: 'white', fontSize: '10px', fontWeight: 800, padding: '2px 7px', borderRadius: '20px', minWidth: '20px', textAlign: 'center', lineHeight: '16px' }}>
            {badge}
          </span>
        )}
      </Link>
    );
  };

  if (!user) return <>{children}</>;

  const showAdminBell = isAdmin && pendingCount > 0 && !bellSeen;

  const notifIcon = (type: string) =>
    type === 'approved' ? '✅' : type === 'rejected' ? '❌' : '🔄';

  return (
    <div className="app-container">
      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <aside className="sidebar-corporate no-print">
        <div className="mb-10 px-4" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
          <img src="/lunars-logo.png" alt="Lunar's Logo" style={{ width: '100%', maxWidth: '180px', height: 'auto', objectFit: 'contain' }} />
        </div>

        <nav style={{ flex: 1 }}>
          <div style={{ fontSize: '11px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', marginLeft: '16px' }}>Overview</div>
          {menuVisibility.dashboard !== false && <NavLink href="/" icon="📊" label="Dashboard" exact />}

          {/* Admin Block in Sidebar */}
          {isAdmin && (
            <>
              <div style={{ fontSize: '11px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '24px', marginBottom: '12px', marginLeft: '16px' }}>Administration</div>
              <NavLink href="/admin" icon="👥" label="Users Management" />
            </>
          )}

          {/* Packing section */}
          {!isAcct && (
            <>
              {(menuVisibility.scanning_intake !== false ||
                menuVisibility.manual_entry !== false ||
                menuVisibility.inventory_pool !== false ||
                menuVisibility.carton_generation !== false ||
                menuVisibility.packed_inventory !== false ||
                menuVisibility.scan_history !== false) && (
                <>
                  <div onClick={togglePacking} style={{ fontSize: '12px', color: 'var(--text-main)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', borderRadius: '8px', margin: '24px 8px 12px 8px', padding: '12px 16px', border: '1px solid var(--border)', transition: 'all 0.2s' }} className="packing-toggle">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ fontSize: '16px' }}>📦</span><span>Packing</span></div>
                    <span style={{ fontSize: '10px', opacity: 0.5 }}>{packingOpen ? '▼' : '▶'}</span>
                  </div>
                  {packingOpen && (
                    <div className="fade-up" style={{ paddingLeft: '8px' }}>
                      {menuVisibility.scanning_intake !== false && <NavLink href="/packing/scanning" icon="⚡" label="Scanning Intake" />}
                      {menuVisibility.manual_entry !== false && <NavLink href="/packing/manual"   icon="📝" label="Manual Entry" />}
                      {menuVisibility.inventory_pool !== false && <NavLink href="/inventory-pool"   icon="📥" label="Inventory" />}
                      {menuVisibility.carton_generation !== false && <NavLink href="/carton-generation" icon="⚙️" label="Carton Generation" />}
                      {menuVisibility.packed_inventory !== false && <NavLink href="/packed-inventory" icon="📦" label="Packed Inventory" />}
                      {menuVisibility.scan_history !== false && <NavLink href="/scan-history"     icon="📋" label="Scan History" />}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Upper Stock section */}
          {!isAcct && (
            <>
              {(menuVisibility.daily_activity !== false ||
                menuVisibility.live_inventory !== false ||
                menuVisibility.stock_movement !== false ||
                menuVisibility.v_strap_entry !== false ||
                menuVisibility.reports_sheets !== false) && (
                <>
                  <div onClick={toggleUpperStock} style={{ fontSize: '12px', color: 'var(--text-main)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', borderRadius: '8px', margin: '24px 8px 12px 8px', padding: '12px 16px', border: '1px solid var(--border)', transition: 'all 0.2s' }} className="upper-stock-toggle">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ fontSize: '16px' }}>⚡</span><span>Upper Stock</span></div>
                    <span style={{ fontSize: '10px', opacity: 0.5 }}>{upperStockOpen ? '▼' : '▶'}</span>
                  </div>
                  {upperStockOpen && (
                    <div className="fade-up" style={{ paddingLeft: '8px' }}>
                      {menuVisibility.daily_activity !== false && <NavLink href="/daily"          icon="📅" label="Daily Activity" />}
                      {menuVisibility.live_inventory !== false && <NavLink href="/inventory"      icon="📦" label="Live Inventory" />}
                      {menuVisibility.stock_movement !== false && <NavLink href="/inward-outward" icon="🔄" label="Stock Movement" />}
                      {menuVisibility.v_strap_entry !== false && <NavLink href="/v-strap"        icon="🩴" label="V-Strap Entry" />}
                      {menuVisibility.reports_sheets !== false && <NavLink href="/reports"        icon="📝" label="Reports & Sheets" />}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Purchasing Order section (non-workers only) */}
          {user.role !== 'worker' && (
            <>
              {menuVisibility.po_section !== false && (
                <>
                  <div onClick={togglePo} style={{ fontSize: '12px', color: 'var(--text-main)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', borderRadius: '8px', margin: '24px 8px 12px 8px', padding: '12px 16px', border: '1px solid var(--border)', transition: 'all 0.2s' }} className="po-toggle">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ fontSize: '16px' }}>📄</span><span>Purchasing Order</span></div>
                    <span style={{ fontSize: '10px', opacity: 0.5 }}>{poOpen ? '▼' : '▶'}</span>
                  </div>
                  {poOpen && (
                    <div className="fade-up" style={{ paddingLeft: '8px' }}>
                      {/* PO Dashboard — togglable */}
                      {menuVisibility.po_dashboard !== false && (
                        <NavLink href="/po" icon="📊" label="PO Dashboard" exact />
                      )}

                      {/* Create PO — Admin + PM only (togglable) */}
                      {menuVisibility.po_create !== false && (isAdmin || isPM) && (
                        <NavLink href="/po/create" icon="✍️" label="Create PO" />
                      )}

                      {/* Pending Approval — Admin ONLY (Always ON) */}
                      {isAdmin && <NavLink href="/po/pending" icon="⏳" label="Pending Approval" badge={pendingCount} />}
                      
                      {/* Returned POs — Admin + PM only (Always ON) */}
                      {(isAdmin || isPM) && <NavLink href="/po/returned" icon="🔄" label="Returned POs" badge={returnedCount} />}

                      {/* Approved PO — Always ON */}
                      <NavLink href="/po/approved" icon="✅" label="Approved PO" />

                      {/* Rejected PO — hidden from Accountant (Always ON) */}
                      {!isAcct && <NavLink href="/po/rejected" icon="❌" label="Rejected PO" />}

                      {/* Accountant Processing — Accountant + Admin (togglable) */}
                      {menuVisibility.po_accountant !== false && (isAdmin || isAcct) && (
                        <NavLink href="/po/accountant" icon="💸" label="Accountant Processing" badge={accountantCount} />
                      )}

                      {/* Completed PO — togglable */}
                      {menuVisibility.po_completed !== false && (
                        <NavLink href="/po/completed" icon="📁" label="Completed PO" />
                      )}

                      {/* PO History — togglable */}
                      {menuVisibility.po_history !== false && (
                        <NavLink href="/po/history" icon="🕒" label="PO History" />
                      )}

                      {/* Payment Completed — Accountant only (togglable) */}
                      {menuVisibility.po_payment_status !== false && isAcct && (
                        <NavLink href="/po/payment-status" icon="💰" label="Payment Completed" />
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </nav>

        {/* User info + logout */}
        <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 8px' }}>
            <div style={{ width: '36px', height: '36px', background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--text-main)', fontSize: '14px' }}>
              {user.full_name?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>{user.full_name}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-ghost)', textTransform: 'capitalize' }}>{user.role}</div>
            </div>
            <button onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-ghost)', fontSize: '18px' }}>×</button>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <main className="main-content">
        <header className="flex-between mb-8 no-print" style={{ alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {pathname !== '/' && (
              <button
                onClick={() => router.back()}
                style={{
                  background: 'white',
                  border: '1.5px solid var(--border)',
                  borderRadius: '10px',
                  width: '38px',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  color: 'var(--text-main)',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.borderColor = 'var(--text-ghost)';
                  e.currentTarget.style.transform = 'translateX(-3px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.transform = 'none';
                }}
                title="Back to Previous Sheet"
              >
                ←
              </button>
            )}
            <div>
              <h1 className="title-main" style={{ margin: 0 }}>
                {pathname === '/'                        ? 'Dashboard'              :
                 pathname.startsWith('/daily')           ? 'Daily Operations'       :
                 pathname.startsWith('/inward-outward')  ? 'Stock Movement'         :
                 pathname.startsWith('/v-strap')         ? 'V-Strap Entry'          :
                 pathname.startsWith('/packing')         ? 'Packing Operations'     :
                 pathname.startsWith('/po')              ? 'Purchasing Order System':
                 pathname.startsWith('/reports')         ? 'Reporting'              :
                 pathname.startsWith('/admin')           ? 'Administration'         : 'System'}
              </h1>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>

          {/* ── Bell buttons row ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

            {/* ── PM / Accountant notification bell ───────────────────── */}
            {hasUserBell && (
              <div ref={userBellRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setUserBellOpen(prev => !prev)}
                  title={userUnread > 0 ? `${userUnread} new notification${userUnread !== 1 ? 's' : ''}` : 'Notifications'}
                  style={{
                    position: 'relative',
                    background: userUnread > 0 ? '#eff6ff' : '#f8fafc',
                    border: userUnread > 0 ? '1.5px solid #3b82f6' : '1.5px solid var(--border)',
                    borderRadius: '12px', width: '44px', height: '44px',
                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '20px', transition: 'all 0.2s',
                    boxShadow: userUnread > 0 ? '0 0 0 3px rgba(59,130,246,0.12)' : 'none',
                    animation: userUnread > 0 ? 'bellRing 1.2s ease-in-out 2' : 'none'
                  }}
                >
                  🔔
                  {userUnread > 0 && (
                    <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#3b82f6', color: 'white', fontSize: '10px', fontWeight: 900, borderRadius: '20px', padding: '1px 6px', minWidth: '18px', textAlign: 'center', lineHeight: '16px', border: '2px solid white', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>
                      {userUnread}
                    </span>
                  )}
                </button>

                {userBellOpen && (
                  <div style={{ position: 'absolute', right: '0', top: 'calc(100% + 8px)', background: 'white', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', minWidth: '320px', maxHeight: '400px', overflowY: 'auto', zIndex: 9999 }}>
                    <div style={{ padding: '14px 18px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>🔔 Notifications</div>
                      {userNotifs.length > 0 && (
                        <button onClick={markAllRead} style={{ background: 'none', border: 'none', fontSize: '11px', color: '#3b82f6', fontWeight: 700, cursor: 'pointer' }}>Mark all read</button>
                      )}
                    </div>
                    {userNotifs.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-ghost)', fontSize: '13px' }}>No notifications yet</div>
                    ) : (
                      userNotifs.map((n: any) => (
                        <div 
                          key={n.id} 
                          onClick={() => handleNotifClick(n)}
                          style={{ 
                            padding: '12px 18px', 
                            borderBottom: '1px solid var(--border)', 
                            background: n.is_read ? 'white' : '#f0f9ff', 
                            display: 'flex', 
                            gap: '10px', 
                            alignItems: 'flex-start',
                            cursor: 'pointer',
                            transition: 'background-color 0.15s'
                          }}
                          className="notif-row-hover"
                        >
                          <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '2px' }}>{notifIcon(n.type)}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '12px', fontWeight: n.is_read ? 500 : 700, color: 'var(--text-main)', lineHeight: '1.5' }}>{n.message}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-ghost)', marginTop: '4px' }}>{n.created_at}</div>
                            {isPM && n.type === 'returned_for_edit' && (
                              <span style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 700, display: 'inline-block', marginTop: '6px' }}>
                                ✏️ Edit & Resubmit →
                              </span>
                            )}
                            {isAcct && n.type === 'approved' && (
                              <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700, display: 'inline-block', marginTop: '6px' }}>
                                💸 Process Order →
                              </span>
                            )}
                          </div>
                          {!n.is_read && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', flexShrink: 0, marginTop: '4px' }} />}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Admin pending-approval bell ──────────────────────────── */}
            {isAdmin && (
              <div ref={bellRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setBellOpen(prev => !prev)}
                  title={pendingCount > 0 ? `${pendingCount} pending PO${pendingCount !== 1 ? 's' : ''} awaiting approval` : 'No pending approvals'}
                  style={{
                    position: 'relative',
                    background: showAdminBell ? '#fef3c7' : '#f8fafc',
                    border: showAdminBell ? '1.5px solid #f59e0b' : '1.5px solid var(--border)',
                    borderRadius: '12px', width: '44px', height: '44px',
                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '20px', transition: 'all 0.2s',
                    boxShadow: showAdminBell ? '0 0 0 3px rgba(245,158,11,0.15)' : 'none',
                    animation: showAdminBell ? 'bellRing 1s ease-in-out infinite' : 'none'
                  }}
                >
                  📋
                  {showAdminBell && (
                    <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ef4444', color: 'white', fontSize: '10px', fontWeight: 900, borderRadius: '20px', padding: '1px 6px', minWidth: '18px', textAlign: 'center', lineHeight: '16px', border: '2px solid white', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>
                      {pendingCount}
                    </span>
                  )}
                </button>

                {bellOpen && (
                  <div style={{ position: 'absolute', right: '0', top: 'calc(100% + 8px)', background: 'white', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', minWidth: '280px', zIndex: 9999, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 18px', background: pendingCount > 0 ? '#fffbeb' : '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '16px' }}>{pendingCount > 0 ? '⏳' : '✅'}</span>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>
                          {pendingCount > 0 ? `${pendingCount} PO${pendingCount !== 1 ? 's' : ''} Awaiting Approval` : 'No Pending Approvals'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-ghost)', marginTop: '2px' }}>
                          {pendingCount > 0 ? 'Purchase Orders require admin review' : 'All purchase orders are up to date'}
                        </div>
                      </div>
                    </div>
                    {pendingCount > 0 && (
                      <div style={{ padding: '12px 18px' }}>
                        <Link href="/po/pending" onClick={() => { setBellSeen(true); setBellOpen(false); }}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f59e0b', color: 'white', padding: '10px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: 700, fontSize: '13px' }}>
                          <span>📋</span> Review Pending Approvals →
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Profile Dropdown Button ──────────────────────────────── */}
            <div ref={profileRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setProfileOpen(prev => !prev)}
                title="Profile & Settings"
                style={{
                  background: 'white',
                  border: '1.5px solid var(--border)',
                  borderRadius: '12px',
                  height: '44px',
                  padding: '0 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  boxShadow: profileOpen ? '0 0 0 3px rgba(15,23,42,0.06)' : 'none',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
                onMouseLeave={e => { if (!profileOpen) e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                <div style={{
                  width: '28px',
                  height: '28px',
                  background: 'var(--primary)',
                  color: 'white',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '13px'
                }}>
                  {user.full_name?.[0]?.toUpperCase() || 'U'}
                </div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                  {user.full_name.split(' ')[0]}
                </span>
                <span style={{ fontSize: '9px', color: 'var(--text-ghost)', transform: profileOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
              </button>

              {profileOpen && (
                <div style={{
                  position: 'absolute',
                  right: '0',
                  top: 'calc(100% + 8px)',
                  background: 'white',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                  minWidth: '220px',
                  zIndex: 9999,
                  padding: '6px'
                }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', marginBottom: '4px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.full_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-ghost)', textTransform: 'capitalize' }}>{user.role}</div>
                  </div>
                  
                  <button
                    onClick={() => { setProfileOpen(false); openModal('change_name'); }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-main)',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    ✏️ Change Name
                  </button>
                  
                  <button
                    onClick={() => { setProfileOpen(false); openModal('settings'); }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-main)',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    ⚙️ Settings
                  </button>

                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setProfileOpen(false)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        display: 'flex',
                        background: 'none',
                        border: 'none',
                        padding: '8px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--text-main)',
                        textDecoration: 'none',
                        cursor: 'pointer',
                        borderRadius: '6px',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      👥 Users Management
                    </Link>
                  )}

                  <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '4px 0' }} />

                  <button
                    onClick={() => { setProfileOpen(false); handleLogout(); }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#ef4444',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="fade-up">{children}</div>
      </main>

      {/* ── PROFILE & SETTINGS MODALS ──────────────────────────────────── */}
      {activeModal && (
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
            maxWidth: '440px',
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
                {activeModal === 'change_name' ? '✏️ Change Full Name' : '⚙️ Account Settings'}
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: 'var(--text-ghost)', fontWeight: 'bold', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleModalSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {modalError && (
                <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700 }}>
                  ⚠️ {modalError}
                </div>
              )}
              {modalSuccess && (
                <div style={{ background: '#dcfce7', color: '#15803d', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700 }}>
                  ✅ {modalSuccess}
                </div>
              )}

              {activeModal === 'change_name' ? (
                <div className="silk-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: 0 }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>FULL NAME</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    style={{
                      padding: '10px 14px',
                      border: '1.5px solid var(--border)',
                      borderRadius: '8px',
                      fontSize: '13px',
                      outline: 'none',
                      width: '100%'
                    }}
                  />
                </div>
              ) : (
                <>
                  <div className="silk-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: 0 }}>
                    <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>PHONE NUMBER</label>
                    <input
                      type="tel"
                      placeholder="e.g. +919876543210"
                      value={newPhone}
                      onChange={e => {
                        const val = e.target.value;
                        setNewPhone(val);
                        if (usePhoneAsUsername) setNewUsername(val);
                      }}
                      style={{
                        padding: '10px 14px',
                        border: '1.5px solid var(--border)',
                        borderRadius: '8px',
                        fontSize: '13px',
                        outline: 'none',
                        width: '100%'
                      }}
                    />
                  </div>

                  <div className="silk-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: 0 }}>
                    <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>USERNAME</label>
                    <input
                      type="text"
                      required
                      disabled={usePhoneAsUsername}
                      value={newUsername}
                      onChange={e => setNewUsername(e.target.value)}
                      style={{
                        padding: '10px 14px',
                        border: '1.5px solid var(--border)',
                        borderRadius: '8px',
                        fontSize: '13px',
                        outline: 'none',
                        width: '100%',
                        background: usePhoneAsUsername ? '#f1f5f9' : 'white',
                        color: usePhoneAsUsername ? '#64748b' : 'var(--text-main)',
                      }}
                    />
                  </div>

                  {newPhone && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={usePhoneAsUsername}
                        onChange={e => {
                          const checked = e.target.checked;
                          setUsePhoneAsUsername(checked);
                          if (checked) setNewUsername(newPhone);
                        }}
                      />
                      Use Phone Number as Username
                    </label>
                  )}

                  <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '4px 0' }} />

                  <div className="silk-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: 0 }}>
                    <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>NEW PASSWORD</label>
                    <input
                      type="password"
                      placeholder="Leave blank to keep current..."
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      style={{
                        padding: '10px 14px',
                        border: '1.5px solid var(--border)',
                        borderRadius: '8px',
                        fontSize: '13px',
                        outline: 'none',
                        width: '100%'
                      }}
                    />
                  </div>

                  <div className="silk-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: 0 }}>
                    <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>CONFIRM NEW PASSWORD</label>
                    <input
                      type="password"
                      placeholder="Confirm new password..."
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      style={{
                        padding: '10px 14px',
                        border: '1.5px solid var(--border)',
                        borderRadius: '8px',
                        fontSize: '13px',
                        outline: 'none',
                        width: '100%'
                      }}
                    />
                  </div>
                </>
              )}

              {/* Modal Footer */}
              <div style={{
                marginTop: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '10px'
              }}>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  style={{
                    background: 'white',
                    border: '1.5px solid var(--border)',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    color: 'var(--text-main)'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  style={{
                    background: 'var(--primary)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    color: 'white',
                    opacity: modalLoading ? 0.7 : 1
                  }}
                >
                  {modalLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        @keyframes bellRing {
          0%, 100% { transform: rotate(0deg); }
          10%, 30%  { transform: rotate(-12deg); }
          20%, 40%  { transform: rotate(12deg); }
          50%       { transform: rotate(0deg); }
        }
      `}</style>
    </div>
  );
}
