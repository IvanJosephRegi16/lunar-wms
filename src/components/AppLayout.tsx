'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { formatTodayHeader } from '@/lib/utils';

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
  po_section: false,
  po_dashboard: true,
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
};

export default function AppLayout({ children, user }: { children: React.ReactNode, user: any }) {
  const router = useRouter();
  const pathname = usePathname();
  const [upperStockOpen, setUpperStockOpen] = useState(false);
  const [packingOpen, setPackingOpen] = useState(false);
  const [poOpen, setPoOpen] = useState(false);
  const [hrOpen, setHrOpen] = useState(false);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [menuVisibility, setMenuVisibility] = useState<any>(DEFAULT_MENU_VISIBILITY);
  const [personalMenuVisibility, setPersonalMenuVisibility] = useState<Record<string, boolean>>({});

  // Floating AI Copilot panel states (admin-only — rendered conditionally in JSX below)
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotInput, setCopilotInput] = useState('');
  const [copilotMessages, setCopilotMessages] = useState<any[]>([
    { sender: 'ai', text: '👋 Hi! I\'m LUNAR\'S CHAT BOT. Ask me anything about inventory, purchase orders, scan activity, or vendor performance.' }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [copilotContext, setCopilotContext] = useState<any>({ turnCount: 0 });
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && user?.id) {
      const stored = localStorage.getItem(`personal_menu_visibility_${user.id}`);
      if (stored) {
        try {
          setPersonalMenuVisibility(JSON.parse(stored));
        } catch {}
      }
      // Load avatar
      fetch('/api/auth/profile').then(r => r.json()).then(data => {
        if (data?.user?.avatar_url) setAvatarUrl(data.user.avatar_url);
      }).catch(() => {});
    }
  }, [user]);

  // Accordion toggle triggers
  const togglePacking = () => {
    if (packingOpen) {
      setPackingOpen(false);
    } else {
      setPackingOpen(true);
      setUpperStockOpen(false);
      setPoOpen(false);
      setMaterialsOpen(false);
    }
  };

  const toggleUpperStock = () => {
    if (upperStockOpen) {
      setUpperStockOpen(false);
    } else {
      setUpperStockOpen(true);
      setPackingOpen(false);
      setPoOpen(false);
      setMaterialsOpen(false);
    }
  };

  const togglePo = () => {
    if (poOpen) {
      setPoOpen(false);
    } else {
      setPoOpen(true);
      setPackingOpen(false);
      setUpperStockOpen(false);
      setMaterialsOpen(false);
      setHrOpen(false);
    }
  };

  const toggleHr = () => {
    if (hrOpen) {
      setHrOpen(false);
    } else {
      setHrOpen(true);
      setPackingOpen(false);
      setUpperStockOpen(false);
      setPoOpen(false);
      setMaterialsOpen(false);
    }
  };

  const toggleMaterials = () => {
    if (materialsOpen) {
      setMaterialsOpen(false);
    } else {
      setMaterialsOpen(true);
      setPackingOpen(false);
      setUpperStockOpen(false);
      setPoOpen(false);
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
    const isMaterialsPath = pathname.startsWith('/materials');

    if (isPackingPath) {
      setPackingOpen(true);
      setUpperStockOpen(false);
      setPoOpen(false);
      setMaterialsOpen(false);
    } else if (isUpperStockPath) {
      setUpperStockOpen(true);
      setPackingOpen(false);
      setPoOpen(false);
      setMaterialsOpen(false);
    } else if (isMaterialsPath) {
      setMaterialsOpen(true);
      setPackingOpen(false);
      setUpperStockOpen(false);
      setPoOpen(false);
    } else if (isPoPath) {
      setPoOpen(true);
      setPackingOpen(false);
      setUpperStockOpen(false);
      setMaterialsOpen(false);
    } else {
      // Main dashboard / or other non-dropdown pages
      setPackingOpen(false);
      setUpperStockOpen(false);
      setPoOpen(false);
      setMaterialsOpen(false);
    }
  }, [pathname]);

  // Redirect Accountant to PO Dashboard if landing at root "/"
  useEffect(() => {
    if (pathname === '/' && user?.role === 'accountant') {
      router.push('/po');
    }
  }, [pathname, user, router]);

  const getCopilotShortcuts = () => {
    if (pathname === '/') {
      return [
        { label: "📝 Summarize stock risks", query: "Can you analyze general stockout risks and reorder thresholds?" },
        { label: "⚡ Evaluate throughput ratios", query: "What is today's outward throughput and efficiency score?" },
        { label: "🔍 Scan system anomalies", query: "Have any system anomalies or physical stock deficits been scanned?" }
      ];
    } else if (pathname === '/inventory-pool') {
      return [
        { label: "📊 Show shortage run-outs", query: "Which staging articles are approaching critical shortage?" },
        { label: "📦 Size probability curves", query: "What are the recommended size distributions for PO drafts?" }
      ];
    } else if (pathname === '/carton-generation') {
      return [
        { label: "⚙️ Scan packaging configurations", query: "What is the optimal carton configuration to clear loose staging?" },
        { label: "🤖 Run packing optimizer", query: "Compute carton generation rules feasibility score." }
      ];
    } else if (pathname?.startsWith('/po')) {
      return [
        { label: "💰 Supplier delay scorecard", query: "Which vendor presents the highest lead-time risk?" },
        { label: "🛸 Check War Room parity", query: "Take me to the AI War Room system and summarize current briefings." }
      ];
    }
    return [
      { label: "🛸 Open Executive War Room", query: "Open the AI Command War Room." },
      { label: "🛡️ Run full WMS anomaly scan", query: "Scan the entire system for late-night logs or negative stock." }
    ];
  };

  const handleCopilotSend = async (text: string) => {
    const q = text.trim();
    if (!q || isTyping) return;
    setCopilotInput('');

    const cleanQ = q.toLowerCase();
    if (cleanQ === 'clear chat' || cleanQ === 'clear' || cleanQ === 'delete all') {
      setCopilotMessages([{ sender: 'ai', text: '👋 Hi! I\'m LUNAR\'S CHAT BOT. Ask me anything about inventory, purchase orders, scan activity, or vendor performance.' }]);
      setIsTyping(false);
      return;
    }

    setCopilotMessages(prev => [...prev, { sender: 'user', text: q, type: 'text' }]);
    setIsTyping(true);
    try {
      const res = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, context: copilotContext }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCopilotContext(data.context || copilotContext);
        setCopilotMessages(prev => [...prev, {
          sender: 'ai',
          type: data.type || 'text',
          title: data.title,
          text: data.summary || data.reply || '',
          rows: data.rows,
          kpis: data.kpis,
          hint: data.hint,
        }]);
      } else {
        setCopilotMessages(prev => [...prev, { sender: 'ai', type: 'text', text: `⚠️ ${data.error || 'Could not retrieve data.'}` }]);
      }
    } catch {
      setCopilotMessages(prev => [...prev, { sender: 'ai', type: 'text', text: '⚠️ Connection error. Please try again.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Microphone voice recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }
    
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setCopilotInput('');
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setCopilotInput(transcript);
      handleCopilotSend(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      if (event.error === 'not-allowed') {
        alert("Microphone access was blocked. Please allow microphone permissions in your browser settings (usually the lock icon in the URL bar) and try again.");
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  };

  // ── Admin: pending PO count bell ────────────────────────────────────────
  const [pendingCount, setPendingCount]   = useState(0);
  const [bellSeen,     setBellSeen]       = useState(false);
  const [bellOpen,     setBellOpen]       = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  // ── Sidebar Access Requests flow states ────────────────────────────
  const [accessRequests, setAccessRequests] = useState<any[]>([]);
  const [pendingAccessCount, setPendingAccessCount] = useState(0);
  const [requestingKey, setRequestingKey] = useState<string | null>(null);
  const [accessReason, setAccessReason] = useState('');

  // ── User (PM / Accountant): notification bell ───────────────────────────
  const [userNotifs,      setUserNotifs]      = useState<any[]>([]);
  const [userUnread,      setUserUnread]      = useState(0);
  const [userBellOpen,    setUserBellOpen]    = useState(false);
  const userBellRef = useRef<HTMLDivElement>(null);

  const isAdmin     = user?.role === 'admin';
  const isPM        = user?.role === 'pm';
  const isAcct      = user?.role === 'accountant';
  const isSupervisor= user?.role === 'supervisor';
  const hasUserBell = isPM || isAcct || isAdmin || isSupervisor;

  // Map page pathnames to Dynamic UI Permission Keys for URL access guards
  let permissionKey: string | null = null;
  if (pathname === '/admin') permissionKey = 'users_management';
  else if (pathname === '/') permissionKey = 'dashboard';
  else if (pathname.startsWith('/packing/scanning')) permissionKey = 'scanning_intake';
  else if (pathname.startsWith('/packing/manual')) permissionKey = 'manual_entry';
  else if (pathname.startsWith('/inventory-pool')) permissionKey = 'inventory_pool';
  else if (pathname.startsWith('/carton-generation')) permissionKey = 'carton_generation';
  else if (pathname.startsWith('/packed-inventory')) permissionKey = 'packed_inventory';
  else if (pathname.startsWith('/scan-history')) permissionKey = 'scan_history';
  else if (pathname.startsWith('/daily')) permissionKey = 'daily_activity';
  else if (pathname.startsWith('/inventory')) permissionKey = 'live_inventory';
  else if (pathname.startsWith('/inward-outward')) permissionKey = 'stock_movement';
  else if (pathname.startsWith('/v-strap')) permissionKey = 'v_strap_entry';
  else if (pathname.startsWith('/reports')) permissionKey = 'reports_sheets';
  else if (pathname === '/po') permissionKey = 'po_dashboard';
  else if (pathname.startsWith('/po/create')) permissionKey = 'po_create';
  else if (pathname.startsWith('/po/pending')) permissionKey = 'po_pending';
  else if (pathname.startsWith('/po/returned')) permissionKey = 'po_returned';
  else if (pathname.startsWith('/po/approved')) permissionKey = 'po_approved';
  else if (pathname.startsWith('/po/rejected')) permissionKey = 'po_rejected';
  else if (pathname.startsWith('/po/accountant')) permissionKey = 'po_accountant';
  else if (pathname.startsWith('/po/supervisor')) permissionKey = 'po_supervisor';
  else if (pathname.startsWith('/po/completed')) permissionKey = 'po_completed';
  else if (pathname.startsWith('/po/history')) permissionKey = 'po_history';
  else if (pathname.startsWith('/po/payment-status')) permissionKey = 'po_payment_status';
  else if (pathname.startsWith('/hr')) permissionKey = 'hr_section';
  else if (pathname.startsWith('/materials/inventory')) permissionKey = 'materials_inventory';
  else if (pathname.startsWith('/materials/buying')) permissionKey = 'materials_buying';
  else if (pathname.startsWith('/materials')) permissionKey = 'materials_section';

  const isAiPage = false;

  // Admin bypass: always allowed. Non-admin on AI page: always blocked.
  // Non-admin on /admin page: always blocked. Otherwise: respect menuVisibility.
  const isAllowed = isAdmin
    || (!permissionKey)
    || (!isAiPage && permissionKey !== 'users_management' && menuVisibility[permissionKey] !== false);

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
          if (data.user.avatar_url) setAvatarUrl(data.user.avatar_url);
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

  // Fetch PO counts and Sidebar Access Requests for Admin, PM, and Accountant roles
  useEffect(() => {
    if (!user) return;
    
    const fetchCounts = async () => {
      if (user.role === 'worker') return;
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

    const fetchAccessRequests = async () => {
      try {
        const res = await fetch('/api/admin/access-requests');
        if (res.ok) {
          const data = await res.json();
          setAccessRequests(data.requests || []);
          if (user.role === 'admin') {
            setPendingAccessCount(data.pendingCount || 0);
          }
        }
      } catch { /* ignore */ }
    };

    fetchCounts();
    fetchAccessRequests();
    const t = setInterval(() => {
      fetchCounts();
      fetchAccessRequests();
    }, 30000); // Check every 30s
    return () => clearInterval(t);
  }, [user]);

  // Fetch custom menu visibility configs with sessionStorage cache
  useEffect(() => {
    const loadVisibility = async () => {
      // 1. Load from sessionStorage cache first for instant UI response
      if (typeof window !== 'undefined') {
        const cached = sessionStorage.getItem('menu_visibility_cache');
        if (cached) {
          try {
            setMenuVisibility(JSON.parse(cached));
          } catch {}
        }
      }

      // 2. Fetch fresh config asynchronously in background
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.menuVisibility) {
            setMenuVisibility(data.menuVisibility);
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('menu_visibility_cache', JSON.stringify(data.menuVisibility));
            }
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

    const handleUpdate = () => {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('menu_visibility_cache');
      }
      loadVisibility();
    };

    window.addEventListener('menu_settings_updated', handleUpdate);
    return () => window.removeEventListener('menu_settings_updated', handleUpdate);
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
    // 1. Invalidate session via API
    await fetch('/api/auth/logout', { method: 'POST' });
    
    // 2. Broadcast to other tabs immediately
    const channel = new BroadcastChannel('lunar_session');
    channel.postMessage({ type: 'LOGOUT' });
    channel.close();
    
    // 3. Fallback for older browsers
    localStorage.setItem('lunar_logout_event', Date.now().toString());
    
    // 4. Redirect current tab safely
    router.push('/login');
    router.refresh();
  };

  const markAllRead = async () => {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ markAllRead: true }) });
    setUserNotifs(prev => prev.map(n => ({ ...n, is_read: 1 })));
    setUserUnread(0);
  };

  const deleteSingleNotification = async (id: number) => {
    try {
      await fetch(`/api/notifications?id=${id}`, { method: 'DELETE' });
      setUserNotifs(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error('Failed to delete notification', err);
    }
  };

  const clearAllNotifications = async () => {
    try {
      await fetch('/api/notifications?clearAll=true', { method: 'DELETE' });
      setUserNotifs([]);
      setUserUnread(0);
    } catch (err) {
      console.error('Failed to clear notifications', err);
    }
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
    if (n.type === 'pending_admin_approval') {
      router.push('/po/pending');
    } else if (user?.role === 'accountant' && n.type === 'approved') {
      router.push('/po/accountant');
    } else if (user?.role === 'pm' && n.type === 'returned_for_edit') {
      router.push('/po/returned');
    } else if (n.type === 'rejected') {
      router.push('/po/rejected');
    } else {
      router.push('/po');
    }
  };


  // Nav link with optional red badge and permission key checks
  const NavLink = ({ 
    href, 
    icon, 
    label, 
    exact = false, 
    badge,
    permissionKey
  }: { 
    href: string, 
    icon: string, 
    label: string, 
    exact?: boolean, 
    badge?: number,
    permissionKey?: string
  }) => {
    const isActive = exact ? pathname === href : pathname.startsWith(href);
    
    // Check role-level permission approved by admin
    const isApprovedByAdmin = isAdmin || !permissionKey || menuVisibility[permissionKey] !== false;
    
    // Check personal preference visibility if approved by admin
    const isSelfEnabled = !permissionKey || personalMenuVisibility[permissionKey] !== false;

    // If the admin turned it off, we completely hide it to keep the sidebar perfectly clean and clutter-free
    if (!isApprovedByAdmin) {
      return null;
    }

    // If it is approved by admin but the user chose to close/hide it, we don't render it at all!
    if (!isSelfEnabled) {
      return null;
    }

    return (
      <Link 
        href={href} 
        onClick={() => setMobileSidebarOpen(false)}
        className={`nav-btn ${isActive ? 'active' : ''}`} 
        style={{ position: 'relative' }}
      >
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

  const totalAdminActions = pendingCount + pendingAccessCount;
  const showAdminBell = isAdmin && totalAdminActions > 0 && !bellSeen;

  const notifIcon = (type: string) =>
    type === 'approved' ? '✅' : type === 'rejected' ? '❌' : type === 'pending_admin_approval' ? '⏳' : '🔄';

  return (
    <>
      {/* ── MOBILE HEADER (VISIBLE < 992px) ──────────────────────────── */}
      <header className="mobile-header no-print">
        <button 
          onClick={() => setMobileSidebarOpen(prev => !prev)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-main)',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ☰
        </button>
        
        <img src="/lunars-logo.png" alt="Lunar's Logo" style={{ height: '32px', width: 'auto', objectFit: 'contain' }} />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {hasUserBell && userUnread > 0 && (
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', boxShadow: '0 0 6px #3b82f6' }} />
          )}
          <div style={{ width: '28px', height: '28px', background: 'var(--primary)', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px' }}>
            {user.full_name?.[0]?.toUpperCase()}
          </div>
        </div>
      </header>

      {/* Mobile Backdrop Overlay */}
      {mobileSidebarOpen && (
        <div className="mobile-sidebar-backdrop" onClick={() => setMobileSidebarOpen(false)} />
      )}

      <div className="app-container">
        {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
        <aside className={`sidebar-corporate no-print ${mobileSidebarOpen ? 'open' : ''}`}>
        <div className="mb-10 px-4" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <img src="/lunars-logo.png" alt="Lunar's Logo" style={{ width: '100%', maxWidth: '180px', height: 'auto', objectFit: 'contain' }} />
            {mobileSidebarOpen && (
              <button 
                onClick={() => setMobileSidebarOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '28px', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ×
              </button>
            )}
          </div>
        </div>

        <nav style={{ flex: 1 }}>
          <div style={{ fontSize: '11px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', marginLeft: '16px' }}>Overview</div>
          <NavLink href="/" icon="📊" label="Dashboard" exact permissionKey="dashboard" />

          {/* Workforce (HR & Payroll) */}
          {(isAdmin || menuVisibility.hr_section !== false) && personalMenuVisibility.hr_section !== false && (
            <>
              <div onClick={toggleHr} style={{ fontSize: '12px', color: '#f1f5f9', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', margin: '24px 8px 12px 8px', padding: '12px 16px', border: '1px solid rgba(255, 255, 255, 0.05)', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)', backdropFilter: 'blur(10px)' }} className="hr-toggle">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ fontSize: '16px' }}>👷</span><span>Workforce</span></div>
                <span style={{ fontSize: '10px', opacity: 0.5 }}>{hrOpen ? '▼' : '▶'}</span>
              </div>
              {hrOpen && (
                <div className="fade-up" style={{ paddingLeft: '8px' }}>
                  <NavLink href="/hr/employees" icon="🪪" label="Identity Matrix" permissionKey="hr_employees" />
                  <NavLink href="/hr/attendance" icon="📅" label="Attendance Grid" permissionKey="hr_attendance" />
                  <NavLink href="/hr/adjustments" icon="⚖️" label="Adjustments" permissionKey="hr_adjustments" />
                  <NavLink href="/hr/payroll" icon="💸" label="Payroll Engine" permissionKey="hr_payroll" />
                  <NavLink href="/hr/salary-slips" icon="📄" label="Salary Slips" permissionKey="hr_salary_slips" />
                </div>
              )}
            </>
          )}

          {/* Admin Block in Sidebar */}
          {isAdmin && (
            <>
              <div style={{ fontSize: '11px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '24px', marginBottom: '12px', marginLeft: '16px' }}>Administration</div>
              <NavLink href="/admin" icon="👥" label="Users Management" badge={pendingAccessCount} permissionKey="users_management" />
            </>
          )}

          {/* PM Master Data */}
          {(isAdmin || menuVisibility.pm_section !== false) && personalMenuVisibility.pm_section !== false && (
            <>
              <div onClick={() => {
                 const el = document.getElementById('pm-master-menu');
                 if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
              }} style={{ fontSize: '12px', color: '#f1f5f9', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', margin: '24px 8px 12px 8px', padding: '12px 16px', border: '1px solid rgba(255, 255, 255, 0.05)', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)', backdropFilter: 'blur(10px)' }} className="pm-master-toggle">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ fontSize: '16px' }}>👑</span><span>PM Master Data</span></div>
                <span style={{ fontSize: '10px', opacity: 0.5 }}>▼</span>
              </div>
              <div id="pm-master-menu" className="fade-up" style={{ paddingLeft: '8px', display: 'block' }}>
                <NavLink href="/pm/articles?view=manage" icon="📚" label="Manage Articles" permissionKey="pm_manage_articles" />
                <NavLink href="/pm/articles?view=create" icon="✨" label="Create Article" permissionKey="pm_create_article" />
                <NavLink href="/pm/articles?view=deleted" icon="🗑️" label="Deleted Articles" permissionKey="pm_deleted_articles" />
                <NavLink href="/pm/articles?view=materials" icon="🧵" label="Material Library" permissionKey="pm_material_library" />
                <NavLink href="/pm/articles?view=costing" icon="💰" label="Cost Analysis" permissionKey="pm_cost_analysis" />
              </div>
            </>
          )}

          {/* Purchasing Order section (Moved to top for PM and Admin) */}
          {(isPM || isAdmin) && (isAdmin || menuVisibility.po_section !== false) && personalMenuVisibility.po_section !== false && (
            <>
              <div onClick={togglePo} style={{ fontSize: '12px', color: '#f1f5f9', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', margin: '24px 8px 12px 8px', padding: '12px 16px', border: '1px solid rgba(255, 255, 255, 0.05)', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)', backdropFilter: 'blur(10px)' }} className="po-toggle">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ fontSize: '16px' }}>📄</span><span>Purchasing Order</span></div>
                <span style={{ fontSize: '10px', opacity: 0.5 }}>{poOpen ? '▼' : '▶'}</span>
              </div>
              {poOpen && (
                <div className="fade-up" style={{ paddingLeft: '8px' }}>
                  <NavLink href="/po" icon="📊" label="PO Dashboard" exact permissionKey="po_dashboard" />
                  <NavLink href="/po/materials-hub" icon="📦" label="Materials Hub" permissionKey="po_materials_hub" />
                  <NavLink href="/po/create" icon="✍️" label="Create PO" permissionKey="po_create" />
                  <NavLink href="/po/pending" icon="⏳" label="Pending Approval" badge={pendingCount} permissionKey="po_pending" />
                  <NavLink href="/po/returned" icon="🔄" label="Returned POs" badge={returnedCount} permissionKey="po_returned" />
                  <NavLink href="/po/approved" icon="✅" label="Approved PO" permissionKey="po_approved" />
                  <NavLink href="/po/rejected" icon="❌" label="Rejected PO" permissionKey="po_rejected" />
                  <NavLink href="/po/accountant" icon="💸" label="Accountant Processing" badge={accountantCount} permissionKey="po_accountant" />
                  <NavLink href="/po/supervisor" icon="🔍" label="Supervisor Verification" permissionKey="po_supervisor" />
                  <NavLink href="/po/completed" icon="📁" label="Completed PO" permissionKey="po_completed" />
                  <NavLink href="/po/history" icon="🕒" label="PO History" permissionKey="po_history" />
                  <NavLink href="/po/payment-status" icon="💰" label="Payment Completed" permissionKey="po_payment_status" />
                </div>
              )}
            </>
          )}

          {/* Packing section */}
          {(isAdmin || menuVisibility.packing_section !== false) && personalMenuVisibility.packing_section !== false && (
            <>
              <div onClick={togglePacking} style={{ fontSize: '12px', color: '#f1f5f9', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', margin: '24px 8px 12px 8px', padding: '12px 16px', border: '1px solid rgba(255, 255, 255, 0.05)', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)', backdropFilter: 'blur(10px)' }} className="packing-toggle">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ fontSize: '16px' }}>📦</span><span>Packing</span></div>
                <span style={{ fontSize: '10px', opacity: 0.5 }}>{packingOpen ? '▼' : '▶'}</span>
              </div>
              {packingOpen && (
                <div className="fade-up" style={{ paddingLeft: '8px' }}>
                  <NavLink href="/packing/scanning" icon="⚡" label="Scanning Intake" permissionKey="scanning_intake" />
                  <NavLink href="/packing/manual"   icon="📝" label="Manual Entry" permissionKey="manual_entry" />
                  <NavLink href="/inventory-pool"   icon="📥" label="Inventory" permissionKey="inventory_pool" />
                  <NavLink href="/carton-generation" icon="⚙️" label="Carton Generation" permissionKey="carton_generation" />
                  <NavLink href="/packed-inventory" icon="📦" label="Packed Inventory" permissionKey="packed_inventory" />
                  <NavLink href="/scan-history"     icon="📋" label="Scan History" permissionKey="scan_history" />
                </div>
              )}
            </>
          )}

          {/* Upper Stock section */}
          {(isAdmin || menuVisibility.upper_stock_section !== false) && personalMenuVisibility.upper_stock_section !== false && (
            <>
              <div onClick={toggleUpperStock} style={{ fontSize: '12px', color: '#f1f5f9', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', margin: '24px 8px 12px 8px', padding: '12px 16px', border: '1px solid rgba(255, 255, 255, 0.05)', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)', backdropFilter: 'blur(10px)' }} className="upper-stock-toggle">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ fontSize: '16px' }}>⚡</span><span>Upper Stock</span></div>
                <span style={{ fontSize: '10px', opacity: 0.5 }}>{upperStockOpen ? '▼' : '▶'}</span>
              </div>
              {upperStockOpen && (
                <div className="fade-up" style={{ paddingLeft: '8px' }}>
                  <NavLink href="/daily"          icon="📅" label="Daily Activity" permissionKey="daily_activity" />
                  <NavLink href="/inventory"      icon="📦" label="Live Inventory" permissionKey="live_inventory" />
                  <NavLink href="/inward-outward" icon="🔄" label="Stock Movement" permissionKey="stock_movement" />
                  <NavLink href="/v-strap"        icon="🩴" label="V-Strap Entry" permissionKey="v_strap_entry" />
                  <NavLink href="/reports"        icon="📝" label="Reports & Sheets" permissionKey="reports_sheets" />
                </div>
              )}
            </>
          )}

          {/* Materials section */}
          {(isAdmin || menuVisibility.materials_section !== false) && personalMenuVisibility.materials_section !== false && (
            <>
              <div onClick={toggleMaterials} style={{ fontSize: '12px', color: '#f1f5f9', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', margin: '24px 8px 12px 8px', padding: '12px 16px', border: '1px solid rgba(255, 255, 255, 0.05)', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)', backdropFilter: 'blur(10px)' }} className="materials-toggle">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ fontSize: '16px' }}>🧵</span><span>Materials</span></div>
                <span style={{ fontSize: '10px', opacity: 0.5 }}>{materialsOpen ? '▼' : '▶'}</span>
              </div>
              {materialsOpen && (
                <div className="fade-up" style={{ paddingLeft: '8px' }}>
                  <NavLink href="/materials/inventory" icon="📦" label="Inventory of Materials" permissionKey="materials_inventory" />
                  <NavLink href="/materials/buying" icon="🛒" label="Material Buying" permissionKey="materials_buying" />
                </div>
              )}
            </>
          )}
          {/* Purchasing Order section (Standard layout for non-PMs and non-Admins) */}
          {!(isPM || isAdmin) && (isAdmin || menuVisibility.po_section !== false) && personalMenuVisibility.po_section !== false && (
            <>
              <div onClick={togglePo} style={{ fontSize: '12px', color: '#f1f5f9', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', margin: '24px 8px 12px 8px', padding: '12px 16px', border: '1px solid rgba(255, 255, 255, 0.05)', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)', backdropFilter: 'blur(10px)' }} className="po-toggle">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ fontSize: '16px' }}>📄</span><span>Purchasing Order</span></div>
                <span style={{ fontSize: '10px', opacity: 0.5 }}>{poOpen ? '▼' : '▶'}</span>
              </div>
              {poOpen && (
                <div className="fade-up" style={{ paddingLeft: '8px' }}>
                  <NavLink href="/po" icon="📊" label="PO Dashboard" exact permissionKey="po_dashboard" />
                  <NavLink href="/po/materials-hub" icon="📦" label="Materials Hub" permissionKey="po_materials_hub" />
                  <NavLink href="/po/create" icon="✍️" label="Create PO" permissionKey="po_create" />
                  <NavLink href="/po/pending" icon="⏳" label="Pending Approval" badge={pendingCount} permissionKey="po_pending" />
                  <NavLink href="/po/returned" icon="🔄" label="Returned POs" badge={returnedCount} permissionKey="po_returned" />
                  <NavLink href="/po/approved" icon="✅" label="Approved PO" permissionKey="po_approved" />
                  <NavLink href="/po/rejected" icon="❌" label="Rejected PO" permissionKey="po_rejected" />
                  <NavLink href="/po/accountant" icon="💸" label="Accountant Processing" badge={accountantCount} permissionKey="po_accountant" />
                  <NavLink href="/po/supervisor" icon="🔍" label="Supervisor Verification" permissionKey="po_supervisor" />
                  <NavLink href="/po/completed" icon="📁" label="Completed PO" permissionKey="po_completed" />
                  <NavLink href="/po/history" icon="🕒" label="PO History" permissionKey="po_history" />
                  <NavLink href="/po/payment-status" icon="💰" label="Payment Completed" permissionKey="po_payment_status" />
                </div>
              )}
            </>
          )}


        </nav>

        {/* User info + logout */}
        <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 8px' }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
            ) : (
              <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', fontSize: '14px', flexShrink: 0 }}>
                {user.full_name?.[0]?.toUpperCase()}
              </div>
            )}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.full_name}</div>
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
                {formatTodayHeader()}
              </div>
            </div>
          </div>

          {/* ── Bell buttons row ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

            {/* ── PM / Accountant notification bell ───────────────────── */}
            {hasUserBell && (
              <div ref={userBellRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => {
                    const willOpen = !userBellOpen;
                    setUserBellOpen(willOpen);
                    if (willOpen) {
                      markAllRead();
                    }
                  }}
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
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button onClick={markAllRead} style={{ background: 'none', border: 'none', fontSize: '11px', color: '#3b82f6', fontWeight: 700, cursor: 'pointer' }}>Mark all read</button>
                          <span style={{ color: 'var(--border)' }}>|</span>
                          <button onClick={clearAllNotifications} style={{ background: 'none', border: 'none', fontSize: '11px', color: '#ef4444', fontWeight: 700, cursor: 'pointer' }}>Clear all</button>
                        </div>
                      )}
                    </div>
                    {userNotifs.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-ghost)', fontSize: '13px' }}>No notifications yet</div>
                    ) : (
                      userNotifs.map((n: any) => (
                        <div 
                          key={n.id} 
                          style={{ 
                            padding: '12px 18px', 
                            borderBottom: '1px solid var(--border)', 
                            background: n.is_read ? 'white' : '#f0f9ff', 
                            display: 'flex', 
                            gap: '10px', 
                            alignItems: 'flex-start',
                            position: 'relative',
                            transition: 'background-color 0.15s'
                          }}
                          className="notif-row-hover"
                        >
                          <div 
                            onClick={() => handleNotifClick(n)}
                            style={{ display: 'flex', gap: '10px', flex: 1, cursor: 'pointer' }}
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
                              {isAdmin && n.type === 'pending_admin_approval' && (
                                <span style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 700, display: 'inline-block', marginTop: '6px' }}>
                                  ⏳ Review & Approve →
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Delete controls */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, alignSelf: 'center' }}>
                            {!n.is_read && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} />}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSingleNotification(n.id);
                              }}
                              title="Delete Notification"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#94a3b8',
                                fontSize: '16px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                              onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                            >
                              ×
                            </button>
                          </div>
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
                  title={totalAdminActions > 0 ? `${totalAdminActions} pending item${totalAdminActions !== 1 ? 's' : ''} require action` : 'No pending items'}
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
                      {totalAdminActions}
                    </span>
                  )}
                </button>

                {bellOpen && (
                  <div style={{ position: 'absolute', right: '0', top: 'calc(100% + 8px)', background: 'white', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', minWidth: '320px', zIndex: 9999, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 18px', background: totalAdminActions > 0 ? '#fffbeb' : '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '16px' }}>{totalAdminActions > 0 ? '⏳' : '✅'}</span>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>
                          {totalAdminActions > 0 ? `${totalAdminActions} Action Item${totalAdminActions !== 1 ? 's' : ''} Pending` : 'All Action Items Clean'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-ghost)', marginTop: '2px' }}>
                          {totalAdminActions > 0 ? 'System items require admin attention' : 'No items require immediate attention'}
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px' }}>
                      {pendingCount > 0 && (
                        <Link 
                          href="/po/pending" 
                          onClick={() => { setBellSeen(true); setBellOpen(false); }}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', textDecoration: 'none', background: '#fffbeb', transition: 'background-color 0.2s', border: '1px solid #fde68a' }}
                          className="admin-bell-row"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '16px' }}>📋</span>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#b45309' }}>{pendingCount} POs Pending Approval</span>
                          </div>
                          <span style={{ fontSize: '12px', color: '#b45309', fontWeight: 700 }}>Review →</span>
                        </Link>
                      )}

                      {pendingAccessCount > 0 && (
                        <Link 
                          href="/admin?tab=requests" 
                          onClick={() => { 
                            setBellSeen(true); 
                            setBellOpen(false); 
                            if (typeof window !== 'undefined') {
                              window.dispatchEvent(new CustomEvent('admin_select_tab', { detail: 'requests' }));
                            }
                          }}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', textDecoration: 'none', background: '#eff6ff', transition: 'background-color 0.2s', border: '1px solid #bfdbfe' }}
                          className="admin-bell-row"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '16px' }}>🔔</span>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#1d4ed8' }}>{pendingAccessCount} Access Requests Pending</span>
                          </div>
                          <span style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 700 }}>Review →</span>
                        </Link>
                      )}

                      {totalAdminActions === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-ghost)', fontSize: '12px' }}>
                          🎉 All clean! No pending approvals.
                        </div>
                      )}
                    </div>
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
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--border)' }} />
                ) : (
                  <div style={{
                    width: '28px',
                    height: '28px',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
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
                )}
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

        <div className="fade-up">
          {isAllowed ? children : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '20px' }}>
              <div className="card-clean fade-up" style={{
                maxWidth: '520px',
                textAlign: 'center',
                padding: '40px',
                borderTop: '4px solid #ef4444',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '20px',
                background: 'white'
              }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  background: '#fef2f2',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '32px',
                  border: '1.5px solid #fecaca',
                  color: '#ef4444'
                }}>
                  🛡️
                </div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>Access Denied</h2>
                <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: '1.6', margin: 0 }}>
                  Dynamic Security Policy: Your current user role profile does not have visibility authorization for this module.
                </p>
                <div style={{ background: '#f8fafc', border: '1px solid var(--border)', padding: '16px', borderRadius: '12px', width: '100%', fontSize: '12px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ color: 'var(--text-ghost)', fontWeight: 700, letterSpacing: '0.05em' }}>SECURITY DETAILS:</div>
                  <div style={{ color: 'var(--text-main)', fontWeight: 600 }}>User Role: <span style={{ textTransform: 'capitalize', color: 'var(--primary)' }}>{user.role}</span></div>
                  <div style={{ color: 'var(--text-main)', fontWeight: 600 }}>Restricted Key: <code style={{ color: '#ef4444', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>{permissionKey}</code></div>
                  <div style={{ color: 'var(--text-muted)', marginTop: '4px' }}>If you require access, please contact the System Administrator to modify your sidebar configurations.</div>
                </div>
                <Link href="/" className="btn-corp btn-primary-corp" style={{ textDecoration: 'none', width: '100%', textAlign: 'center', fontWeight: 700, padding: '10px 0' }}>
                  ← Return to Dashboard
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Floating Scroll Navigator (Up & Down Arrow Navigation for ALL Sheets & Pages) */}
        <div 
          style={{ 
            position: 'fixed', 
            bottom: '24px', 
            right: '24px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px', 
            zIndex: 99999,
            pointerEvents: 'auto'
          }}
        >
          {/* Scroll to Top */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            title="Scroll to Top"
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.9)',
              border: '1.5px solid #cbd5e1',
              boxShadow: '0 8px 32px rgba(15, 23, 42, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '18px',
              color: '#0f172a',
              transition: 'all 0.2s',
              backdropFilter: 'blur(8px)',
              fontWeight: 'bold'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.background = '#2563eb';
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.borderColor = '#2563eb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)';
              e.currentTarget.style.color = '#0f172a';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
          >
            ▲
          </button>

          {/* Scroll to Bottom */}
          <button
            onClick={() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })}
            title="Scroll to Bottom"
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.9)',
              border: '1.5px solid #cbd5e1',
              boxShadow: '0 8px 32px rgba(15, 23, 42, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '18px',
              color: '#0f172a',
              transition: 'all 0.2s',
              backdropFilter: 'blur(8px)',
              fontWeight: 'bold'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(3px)';
              e.currentTarget.style.background = '#2563eb';
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.borderColor = '#2563eb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)';
              e.currentTarget.style.color = '#0f172a';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
          >
            ▼
          </button>
        </div>
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
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
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
            <form onSubmit={handleModalSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1 }}>
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
                  {/* Profile Picture Upload */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed var(--border)' }}>
                    <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', alignSelf: 'flex-start' }}>PROFILE PICTURE (Optional)</label>
                    <div style={{ position: 'relative', width: '72px', height: '72px' }}>
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Profile" style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: '3px solid white', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }} />
                      ) : (
                        <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '28px', fontWeight: 700, border: '3px solid white', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
                          {user.full_name?.[0]?.toUpperCase()}
                        </div>
                      )}
                      <label
                        htmlFor="avatar-upload"
                        style={{ position: 'absolute', bottom: '-4px', right: '-4px', width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '14px', border: '2px solid white', boxShadow: '0 2px 6px rgba(0,0,0,0.15)', transition: 'transform 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        📷
                      </label>
                      <input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 512000) {
                            setModalError('Image must be under 500KB');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = async (ev) => {
                            const base64 = ev.target?.result as string;
                            setAvatarUrl(base64);
                            try {
                              await fetch('/api/auth/profile', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ avatar_url: base64 })
                              });
                              setModalSuccess('Profile picture updated!');
                            } catch {
                              setModalError('Failed to upload picture');
                            }
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-ghost)', fontWeight: 500 }}>Click the camera icon to upload (Max 500KB)</span>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={async () => {
                          setAvatarUrl(null);
                          try {
                            await fetch('/api/auth/profile', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ avatar_url: '' })
                            });
                            setModalSuccess('Profile picture removed');
                          } catch {}
                        }}
                        style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}
                      >
                        Remove Picture
                      </button>
                    )}
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '4px 0' }} />
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

                  <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '4px 0' }} />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Sidebar Preferences
                    </label>
                    <p style={{ fontSize: '11.5px', color: 'var(--text-ghost)', margin: '0 0 8px 0', lineHeight: 1.4 }}>
                      Toggle which approved sidebar navigation sheets to show or hide in your workspace.
                    </p>
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '8px', 
                      maxHeight: '180px', 
                      overflowY: 'auto', 
                      paddingRight: '6px',
                      background: '#f8fafc',
                      padding: '12px',
                      borderRadius: '10px',
                      border: '1px solid var(--border)'
                    }}>
                      {[
                        {
                          category: 'Overview', mainKey: 'dashboard_section', icon: '👁️',
                          items: [ { key: 'dashboard', label: 'Overview Dashboard', icon: '📊' } ]
                        },
                        {
                          category: 'Workforce', mainKey: 'hr_section', icon: '👷',
                          items: [
                            { key: 'hr_employees', label: 'Identity Matrix', icon: '🪪' },
                            { key: 'hr_attendance', label: 'Attendance Grid', icon: '📅' },
                            { key: 'hr_adjustments', label: 'Adjustments', icon: '⚖️' },
                            { key: 'hr_payroll', label: 'Payroll Engine', icon: '💸' },
                            { key: 'hr_salary_slips', label: 'Salary Slips', icon: '📄' }
                          ]
                        },
                        {
                          category: 'PM Master Data', mainKey: 'pm_section', icon: '👑',
                          items: [
                            { key: 'pm_manage_articles', label: 'Manage Articles', icon: '📚' },
                            { key: 'pm_create_article', label: 'Create Article', icon: '✨' },
                            { key: 'pm_deleted_articles', label: 'Deleted Articles', icon: '🗑️' },
                            { key: 'pm_material_library', label: 'Material Library', icon: '🧵' },
                            { key: 'pm_cost_analysis', label: 'Cost Analysis', icon: '💰' }
                          ]
                        },
                        {
                          category: 'Packing', mainKey: 'packing_section', icon: '📦',
                          items: [
                            { key: 'scanning_intake', label: 'Scanning Intake', icon: '⚡' },
                            { key: 'manual_entry', label: 'Manual Entry', icon: '📝' },
                            { key: 'inventory_pool', label: 'Inventory', icon: '📥' },
                            { key: 'carton_generation', label: 'Carton Gen', icon: '⚙️' },
                            { key: 'packed_inventory', label: 'Packed Inv', icon: '📦' },
                            { key: 'scan_history', label: 'Scan History', icon: '📋' }
                          ]
                        },
                        {
                          category: 'Upper Stock', mainKey: 'upper_stock_section', icon: '⚡',
                          items: [
                            { key: 'daily_activity', label: 'Daily Activity', icon: '📅' },
                            { key: 'live_inventory', label: 'Live Inventory', icon: '📦' },
                            { key: 'stock_movement', label: 'Stock Movement', icon: '🔄' },
                            { key: 'v_strap_entry', label: 'V-Strap Entry', icon: '🩴' },
                            { key: 'reports_sheets', label: 'Reports & Sheets', icon: '📝' }
                          ]
                        },
                        {
                          category: 'Materials', mainKey: 'materials_section', icon: '🧵',
                          items: [
                            { key: 'materials_inventory', label: 'Materials Inventory', icon: '📦' },
                            { key: 'materials_buying', label: 'Material Buying', icon: '🛒' }
                          ]
                        },
                        {
                          category: 'Purchasing Order', mainKey: 'po_section', icon: '📄',
                          items: [
                            { key: 'po_dashboard', label: 'PO Dashboard', icon: '📊' },
                            { key: 'po_create', label: 'Create PO', icon: '✍️' },
                            { key: 'po_pending', label: 'Pending Approval', icon: '⏳' },
                            { key: 'po_returned', label: 'Returned POs', icon: '🔄' },
                            { key: 'po_approved', label: 'Approved PO', icon: '✅' },
                            { key: 'po_rejected', label: 'Rejected PO', icon: '❌' },
                            { key: 'po_accountant', label: 'Acct Processing', icon: '💸' },
                            { key: 'po_completed', label: 'Completed PO', icon: '📁' },
                            { key: 'po_history', label: 'PO History', icon: '🕒' },
                            { key: 'po_payment_status', label: 'Payment Completed', icon: '💰' }
                          ]
                        }
                      ].filter(group => {
                        if (group.mainKey === 'dashboard_section') return isAdmin || menuVisibility.dashboard !== false;
                        if (group.mainKey === 'pm_section') return isAdmin || menuVisibility[group.mainKey] !== false;
                        return isAdmin || menuVisibility[group.mainKey] !== false;
                      }).map((group) => {
                        const isMainChecked = personalMenuVisibility[group.mainKey] !== false;
                        const approvedItems = group.items.filter(item => isAdmin || menuVisibility[item.key] !== false);
                        if (approvedItems.length === 0 && group.mainKey !== 'dashboard_section') return null;

                        return (
                          <div key={group.mainKey} style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'white', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: isMainChecked ? '1px solid #f1f5f9' : 'none', paddingBottom: isMainChecked ? '8px' : '0' }}>
                              <span style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>{group.icon}</span>
                                <span>{group.category}</span>
                              </span>
                              <label style={{ position: 'relative', display: 'inline-block', width: '34px', height: '18px', margin: 0 }}>
                                <input
                                  type="checkbox"
                                  checked={isMainChecked}
                                  onChange={e => {
                                    const updated = { ...personalMenuVisibility, [group.mainKey]: e.target.checked };
                                    setPersonalMenuVisibility(updated);
                                    localStorage.setItem(`personal_menu_visibility_${user.id}`, JSON.stringify(updated));
                                  }}
                                  style={{ opacity: 0, width: 0, height: 0 }}
                                />
                                <span style={{
                                  position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                                  backgroundColor: isMainChecked ? '#22c55e' : '#cbd5e1',
                                  borderRadius: '18px', transition: 'all 0.2s'
                                }}>
                                  <span style={{
                                    position: 'absolute', height: '14px', width: '14px', left: '2px', bottom: '2px',
                                    backgroundColor: 'white', borderRadius: '50%', transition: 'all 0.2s',
                                    transform: isMainChecked ? 'translateX(16px)' : 'none'
                                  }}></span>
                                </span>
                              </label>
                            </div>
                            
                            {isMainChecked && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '8px', paddingTop: '4px' }}>
                                {approvedItems.map(item => {
                                  const isChecked = personalMenuVisibility[item.key] !== false;
                                  return (
                                    <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '13px' }}>{item.icon}</span>
                                        <span>{item.label}</span>
                                      </span>
                                      <label style={{ position: 'relative', display: 'inline-block', width: '28px', height: '14px', margin: 0 }}>
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={e => {
                                            const updated = { ...personalMenuVisibility, [item.key]: e.target.checked };
                                            setPersonalMenuVisibility(updated);
                                            localStorage.setItem(`personal_menu_visibility_${user.id}`, JSON.stringify(updated));
                                          }}
                                          style={{ opacity: 0, width: 0, height: 0 }}
                                        />
                                        <span style={{
                                          position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                                          backgroundColor: isChecked ? '#3b82f6' : '#e2e8f0',
                                          borderRadius: '14px', transition: 'all 0.2s'
                                        }}>
                                          <span style={{
                                            position: 'absolute', height: '10px', width: '10px', left: '2px', bottom: '2px',
                                            backgroundColor: 'white', borderRadius: '50%', transition: 'all 0.2s',
                                            transform: isChecked ? 'translateX(14px)' : 'none'
                                          }}></span>
                                        </span>
                                      </label>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
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

      {/* GLOBAL FLOATING AI COPILOT OVERLAY — Admin Only */}
      {isAdmin && (
        <>
          <button
            className="ai-copilot-button ai-pulse-glow"
            onClick={() => setCopilotOpen(prev => !prev)}
            title="Open LUNAR'S CHAT BOT"
          >
            <span style={{ fontSize: '18px' }}>🧠</span>
            <span>LUNAR'S CHAT BOT</span>
          </button>

          {copilotOpen && (
            <div className="ai-copilot-desk ai-hologram-panel fade-up">
              <div className="ai-copilot-desk-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🧠</div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>LUNAR'S CHAT BOT</div>
                    <div style={{ fontSize: '10px', opacity: 0.65 }}>Live warehouse data · Admin access</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    onClick={() => setCopilotMessages([{ sender: 'ai', text: '👋 Hi! I\'m your ERP Operations Copilot. Ask me anything about inventory, purchase orders, scan activity, or vendor performance.' }])}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                    title="Clear chat history"
                  >
                    🗑️ Clear
                  </button>
                  <button
                    onClick={() => setCopilotOpen(false)}
                    style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: '20px', fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="ai-copilot-desk-body">
                {copilotMessages.map((msg, index) => (
                  <div
                    key={index}
                    style={{
                      alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                      background: msg.sender === 'user'
                        ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                        : 'rgba(248, 250, 252, 0.98)',
                      color: msg.sender === 'user' ? 'white' : 'var(--text-main)',
                      padding: '11px 15px',
                      borderRadius: '14px',
                      borderTopRightRadius: msg.sender === 'user' ? '3px' : '14px',
                      borderTopLeftRadius: msg.sender === 'ai' ? '3px' : '14px',
                      maxWidth: '92%',
                      width: msg.sender === 'ai' && (msg.type === 'table' || msg.type === 'kpi') ? '92%' : undefined,
                      fontSize: '12.5px',
                      lineHeight: 1.55,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      border: msg.sender === 'ai' ? '1px solid rgba(99, 102, 241, 0.10)' : 'none',
                      whiteSpace: 'pre-line'
                    }}
                  >
                    {/* Title */}
                    {msg.sender === 'ai' && msg.title && (
                      <div style={{ fontWeight: 800, fontSize: '12px', color: '#4f46e5', marginBottom: '6px' }}>{msg.title}</div>
                    )}
                    {/* Text/summary */}
                    {msg.text && <div style={{ marginBottom: msg.kpis || msg.rows ? '8px' : 0 }}>{msg.text}</div>}
                    {/* KPI cards */}
                    {msg.kpis && msg.kpis.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                        {msg.kpis.map((k: any, ki: number) => (
                          <div key={ki} style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.14)', borderRadius: '8px', padding: '6px 10px', minWidth: '80px' }}>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>{k.label}</div>
                            <div style={{ fontSize: '14px', fontWeight: 800, color: k.color || '#0f172a' }}>{k.value}</div>
                            {k.sub && <div style={{ fontSize: '10px', color: '#94a3b8' }}>{k.sub}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Data table */}
                    {msg.rows && msg.rows.length > 0 && (
                      <div style={{ overflowX: 'auto', marginBottom: '4px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                          <thead>
                            <tr>
                              {Object.keys(msg.rows[0]).map((col: string) => (
                                <th key={col} style={{ textAlign: 'left', padding: '4px 6px', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 700, whiteSpace: 'nowrap' }}>{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {msg.rows.map((row: any, ri: number) => (
                              <tr key={ri} style={{ background: ri % 2 === 0 ? 'transparent' : 'rgba(99,102,241,0.03)' }}>
                                {Object.values(row).map((cell: any, ci: number) => (
                                  <td key={ci} style={{ padding: '4px 6px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>{String(cell ?? '—')}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {/* Hint */}
                    {msg.hint && msg.sender === 'ai' && (
                      <div style={{ marginTop: '6px', fontSize: '10.5px', color: '#6366f1', fontStyle: 'italic' }}>💡 {msg.hint}</div>
                    )}
                  </div>
                ))}
                {isTyping && (
                  <div style={{ alignSelf: 'flex-start', background: '#f1f5f9', padding: '10px 14px', borderRadius: '14px', borderTopLeftRadius: '3px', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ display: 'inline-flex', gap: 3 }}>
                      <span style={{ animation: 'dotPulse 1.2s infinite', animationDelay: '0s' }}>●</span>
                      <span style={{ animation: 'dotPulse 1.2s infinite', animationDelay: '0.2s' }}>●</span>
                      <span style={{ animation: 'dotPulse 1.2s infinite', animationDelay: '0.4s' }}>●</span>
                    </span>
                    Querying ERP data...
                  </div>
                )}
              </div>

              {/* Quick Ask Shortcuts */}
              <div style={{ padding: '0 16px 10px 16px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Quick Ask</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {[
                    'Show low stock',
                    'Pending approvals',
                    'Cartons today',
                    'Top vendor',
                    'Scan activity today'
                  ].map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleCopilotSend(q)}
                      style={{
                        background: 'rgba(99,102,241,0.07)',
                        border: '1px solid rgba(99,102,241,0.18)',
                        borderRadius: '20px',
                        padding: '4px 11px',
                        fontSize: '11px',
                        color: '#6366f1',
                        cursor: 'pointer',
                        fontWeight: 500,
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.16)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.07)'; }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ai-copilot-desk-footer" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  className="ai-copilot-input"
                  placeholder="Ask about inventory, orders, vendors..."
                  value={copilotInput}
                  onChange={e => setCopilotInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCopilotSend(copilotInput); }}
                  style={{ flex: 1 }}
                />
                <button
                  className={`ai-copilot-mic ${isListening ? 'listening' : ''}`}
                  onClick={handleVoiceInput}
                  title="Use Voice Input"
                  style={{
                    background: isListening ? '#ef4444' : '#f1f5f9',
                    color: isListening ? 'white' : '#64748b',
                    border: 'none',
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '16px',
                    transition: 'all 0.2s',
                    boxShadow: isListening ? '0 0 12px rgba(239, 68, 68, 0.6)' : 'none'
                  }}
                >
                  {isListening ? '🛑' : '🎙️'}
                </button>
                <button
                  className="ai-copilot-send"
                  onClick={() => handleCopilotSend(copilotInput)}
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'transform 0.15s'
                  }}
                >
                  ➔
                </button>
              </div>
            </div>
          )}
        </>
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
    </>
  );
}
