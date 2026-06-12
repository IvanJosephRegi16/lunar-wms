'use client';

import { useState, useEffect, Suspense, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const MATERIAL_CATEGORIES = ['Rexins', 'Eva', 'Insoles', 'Buckles', 'Lace/Niwar', 'PVC Tube', 'Thread', 'Velcro', 'Others'];

// Custom, highly attractive, search-supported premium dropdown component
function PremiumSearchDropdown({
  value,
  onChange,
  options,
  onSelectOption,
  placeholder,
  required = false,
  style = {}
}: any) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(value || '');
  const containerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync search state when external value changes
  useEffect(() => {
    setSearch(value || '');
  }, [value]);

  // Click outside detection
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement;
        if (target.closest('.dropdown-fixed-portal')) return;

        setIsOpen(false);
        const matched = options.find((o: any) => o.value.toUpperCase() === (value || '').toUpperCase());
        setSearch(matched ? matched.value : value);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value, options]);

  // Position calculation dynamically on open, scroll or resize
  useEffect(() => {
    function updateCoords() {
      if (isOpen && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCoords({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width
        });
      }
    }

    if (isOpen) {
      updateCoords();
      // Recalculate positions on scroll or resize events
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
    }
    return () => {
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
    };
  }, [isOpen]);

  // Filter options based on search input
  const filtered = options.filter((o: any) =>
    (o.value || '').toLowerCase().includes((search || '').toLowerCase()) ||
    (o.label || '').toLowerCase().includes((search || '').toLowerCase())
  );

  const handleSelect = (val: string) => {
    onChange(val);
    if (onSelectOption) {
      onSelectOption(val);
    }
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    onChange(val); // Update live as they type
    setIsOpen(true);
  };

  const isExactMatch = options.some((o: any) => (o.value || '').toUpperCase() === (search || '').toUpperCase());

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', ...style }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type="text"
          placeholder={placeholder}
          required={required}
          value={search}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          style={{
            width: '100%',
            padding: '10px 36px 10px 14px',
            border: isOpen ? '2px solid var(--primary)' : '1px solid var(--border)',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            background: 'white',
            outline: 'none',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            boxShadow: isOpen ? '0 0 0 3px rgba(99, 102, 241, 0.15)' : 'none'
          }}
        />
        
        {/* Animated Chevron Arrow */}
        <div
          onClick={() => setIsOpen(!isOpen)}
          style={{
            position: 'absolute',
            right: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-ghost)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            pointerEvents: 'auto',
            fontSize: '10px'
          }}
        >
          ▼
        </div>
      </div>

      {isOpen && mounted && typeof document !== 'undefined' && createPortal(
        <div
          className="dropdown-fixed-portal"
          style={{
            position: 'absolute',
            top: `${coords.top + 6}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            background: 'white',
            border: '1px solid rgba(0, 0, 0, 0.15)',
            borderRadius: '12px',
            boxShadow: '0 20px 45px rgba(0, 0, 0, 0.18), 0 10px 20px rgba(0, 0, 0, 0.08)',
            maxHeight: '320px', // Substantially taller options list
            overflowY: 'auto',
            zIndex: 999999999, // Floating on top of everything!
            padding: '6px'
          }}
        >
          {filtered.length > 0 ? (
            filtered.map((opt: any, idx: number) => {
              const isSelected = (opt.value || '').toUpperCase() === (value || '').toUpperCase();
              return (
                <div
                  key={idx}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(opt.value);
                  }}
                  style={{
                    padding: '10px 14px', // Bigger touch target
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                    color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                    fontWeight: isSelected ? 700 : 600,
                    fontSize: '13px',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'background 0.15s ease',
                    marginBottom: '3px'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = '#f1f5f9';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{opt.value}</span>
                    {isSelected && <span style={{ fontSize: '10.5px', color: 'var(--primary)' }}>✓ Active</span>}
                  </div>
                  {opt.label && (
                    <span style={{ fontSize: '11px', color: 'var(--text-ghost)', marginTop: '2px', fontWeight: 500 }}>
                      {opt.label}
                    </span>
                  )}
                </div>
              );
            })
          ) : (
            <div style={{ padding: '12px 14px', color: 'var(--text-ghost)', fontSize: '12.5px', fontWeight: 500, textAlign: 'center' }}>
              No matches found
            </div>
          )}

          {/* Special option to type a custom code if search is not empty and not an exact match */}
          {search.trim() !== '' && !isExactMatch && (
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(search.trim());
              }}
              style={{
                padding: '11px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                background: 'rgba(16, 185, 129, 0.08)',
                color: '#059669',
                fontWeight: 700,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '4px',
                borderTop: '1px dashed rgba(0, 0, 0, 0.1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.08)';
              }}
            >
              <span>✨ Use custom code:</span>
              <span style={{ fontFamily: 'monospace', background: 'white', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                {search}
              </span>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

function CreatePOFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showNewMaterialModal, setShowNewMaterialModal] = useState(false);
  const [newMaterialData, setNewMaterialData] = useState({ category: '', material_code: '', material_name: '', date: '' });
  const [savingMaterial, setSavingMaterial] = useState(false);
  const [showNewVendorModal, setShowNewVendorModal] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorCompany, setNewVendorCompany] = useState('');
  const [newVendorAddress, setNewVendorAddress] = useState('');
  const [savingVendor, setSavingVendor] = useState(false);
  const [customMaterialCategory, setCustomMaterialCategory] = useState('');

  // Registered Hub Data Lists
  const [materialsList, setMaterialsList] = useState<any[]>([]);
  const [vendorsList, setVendorsList] = useState<any[]>([]);
  const [historicalPoItems, setHistoricalPoItems] = useState<any[]>([]);
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  // PO Header Details
  const [vendor, setVendor] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [remarks, setRemarks] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [poDate, setPoDate] = useState('');

  // Spreadsheet Dynamic Rows
  const [items, setItems] = useState<any[]>([
    { category: '', material_code: '', material_name: '', size_thickness: '', order_rate: 0, current_stock: '', current_stock_unit: '', custom_current_stock_unit: '', required_qty: 0, unit: '', custom_unit: '', remarks: '', vendor: '' }
  ]);

  // Derived dynamic categories: base + custom from DB + any already in materials list
  const dynamicCategories = useMemo(() => {
    const cats = new Set(MATERIAL_CATEGORIES.filter(c => c !== 'Others'));
    customCategories.forEach(c => cats.add(c));
    materialsList.forEach(m => {
      if (m.category && m.category.trim() !== '' && !m.category.startsWith('Others - ')) {
        cats.add(m.category);
      }
    });
    return Array.from(cats).sort();
  }, [materialsList, customCategories]);

  // Fetch session and prefill edit details if applicable
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        // Verify User Auth
        const meRes = await fetch('/api/auth/me');
        const meData = await meRes.json();
        if (meData.error || (meData.user.role !== 'pm' && meData.user.role !== 'admin')) {
          setError('Unauthorized Access: Only Purchase Managers or System Administrators can create/edit POs.');
          setLoading(false);
          return;
        }
        setUser(meData.user);

        // Fetch dynamic registry lists (Materials, Vendors & Custom Categories)
        const [registryRes, catRes] = await Promise.all([
          fetch('/api/po/materials'),
          fetch('/api/po/categories')
        ]);
        const registryData = await registryRes.json();
        if (registryData.success) {
          setMaterialsList(registryData.materials || []);
          setVendorsList(registryData.vendors || []);
        }
        if (catRes.ok) {
          const catData = await catRes.json();
          setCustomCategories(catData.categories || []);
        }

        // Fetch Historical PO Items for bottom grid
        const historyRes = await fetch('/api/po');
        const historyData = await historyRes.json();
          if (historyData.pos) {
            const allItems: any[] = [];
            historyData.pos.forEach((po: any) => {
              if (po.status === 'draft') return; // Exclude drafts from historical ledger
              if (Array.isArray(po.items)) {
                po.items.forEach((it: any) => {
                allItems.push({
                  ...it,
                  po_number: po.po_number,
                  vendor: po.vendor || it.vendor || po.vendor_name,
                  status: po.status
                });
              });
            }
          });
          setHistoricalPoItems(allItems);
        }

        // Auto-generate default PO number based on today's IST date
        const nowIST = new Date().toLocaleString('en-CA', { timeZone: 'Asia/Kolkata' });
        const todayIST = nowIST.split(',')[0].trim(); // YYYY-MM-DD
        const dateParts = todayIST.replace(/-/g, '');
        const yy = dateParts.slice(2, 4);
        const mm = dateParts.slice(4, 6);
        const dd = dateParts.slice(6, 8);
        setPoDate(todayIST);
        
        if (!editId) {
          // Leave poNumber blank so the backend generates a sequential DDMMYY-N number
          setPoNumber('');

          // Check for AI Draft prefilling
          const aiCode = searchParams.get('article_code');
          const aiColour = searchParams.get('colour');
          const aiQty = searchParams.get('quantity');
          const aiVendor = searchParams.get('vendor');
          const isDraftAi = searchParams.get('is_draft_ai');

          if (isDraftAi && aiCode) {
            setVendor(aiVendor || '');
            setRemarks(`Advisory Draft PO compiled by AI/ML Intelligence for Article ${aiCode} (${aiColour}).`);
            setItems([
              {
                category: aiCode.startsWith('PU') ? 'Others' : 'Eva',
                material_code: aiCode,
                material_name: `Polymer Compound - Article ${aiCode}`,
                size_thickness: '9mm Standard',
                order_rate: 120, // standard baseline rate
                current_stock: 0,
                current_stock_unit: 'Pair',
                custom_current_stock_unit: '',
                required_qty: Number(aiQty) || 600,
                unit: 'Pair',
                custom_unit: '',
                remarks: `AI Recommended Safety Stock replenishment.`,
                vendor: aiVendor || ''
              }
            ]);
          }
        }

        if (editId) {
          const res = await fetch(`/api/po/${editId}`);
          const data = await res.json();
          if (data.error) {
            setError(data.error);
            return;
          }
          const po = data.po;
          
          // Enforce locking rules on approved states
          if (po.status !== 'draft' && po.status !== 'returned_for_edit' && meData.user.role !== 'admin') {
            setError(`This PO has moved to the '${po.status}' stage and is completely locked from further PM edits.`);
            setLoading(false);
            return;
          }

          setPoNumber(po.po_number || '');
          setPoDate(po.po_date || todayIST);
          setVendor(po.vendor || '');
          setDiscountPercent(po.discount_percent || 0);
          setRemarks(po.remarks || '');
          if (po.status === 'returned_for_edit') {
            setCorrectionNotes(po.correction_notes || '');
          }

          if (Array.isArray(po.items) && po.items.length > 0) {
            setItems(po.items.map((it: any) => {
              const isPredefined = ['Pair', 'piece', 'Meter'].includes(it.unit);
              const isCsuPredefined = ['Pair', 'piece', 'Meter'].includes(it.current_stock_unit);
              return {
                category: it.category || '',
                material_code: it.material_code || '',
                material_name: it.material_name || '',
                size_thickness: it.size_thickness || '',
                order_rate: Number(it.order_rate) || 0,
                current_stock: Number(it.current_stock) || 0,
                current_stock_unit: isCsuPredefined ? it.current_stock_unit : (it.current_stock_unit ? 'Custom' : ''),
                custom_current_stock_unit: isCsuPredefined ? '' : (it.current_stock_unit || ''),
                required_qty: Number(it.required_qty) || 0,
                unit: isPredefined ? it.unit : (it.unit ? 'Custom' : ''),
                custom_unit: isPredefined ? '' : (it.unit || ''),
                remarks: it.remarks || '',
                vendor: it.vendor || ''
              };
            }));
          }
        }
      } catch (err: any) {
        setError(err.message || 'Error initializing creator workspace');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [editId]);

  // Auto-fill row vendors when main vendor changes
  useEffect(() => {
    if (vendor && items.length > 0) {
      const updated = items.map(it => {
        if (!it.vendor || it.vendor.trim() === '') {
          return { ...it, vendor };
        }
        return it;
      });
      // Only set if different to prevent infinite loop
      const isDifferent = updated.some((u, i) => u.vendor !== items[i].vendor);
      if (isDifferent) {
        setItems(updated);
      }
    }
  }, [vendor, items]);

  // Dynamic Row Actions
  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMaterial(true);
    let finalCategory = newMaterialData.category;
    if (newMaterialData.category === 'Others' && customMaterialCategory.trim() !== '') {
      finalCategory = customMaterialCategory.trim();
    }

    try {
      const res = await fetch('/api/po/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'material',
          material_code: newMaterialData.material_code.toUpperCase() || '',
          material_name: newMaterialData.material_name,
          category: finalCategory
        })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        // Refresh materials list locally to avoid full page reload
        setMaterialsList([...materialsList, {
          material_code: newMaterialData.material_code.toUpperCase(),
          material_name: newMaterialData.material_name,
          category: finalCategory
        }]);
        setShowNewMaterialModal(false);
        setNewMaterialData({ category: '', material_code: '', material_name: '', date: '' });
        setCustomMaterialCategory('');
      }
    } catch (err) {
      alert('Failed to save material');
    } finally {
      setSavingMaterial(false);
    }
  };

  const handleAddVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingVendor(true);
    try {
      const res = await fetch('/api/po/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type: 'vendor', 
          vendor_name: newVendorName,
          company_name: newVendorCompany,
          address: newVendorAddress
        })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        const finalVendorName = newVendorName.trim() || newVendorCompany.trim();
        setVendorsList([...vendorsList, { vendor_name: finalVendorName }]);
        setVendor(finalVendorName);
        setShowNewVendorModal(false);
        setNewVendorName('');
        setNewVendorCompany('');
        setNewVendorAddress('');
      }
    } catch (err) {
      alert('Failed to save vendor');
    } finally {
      setSavingVendor(false);
    }
  };

  const addRow = () => {
    setItems([
      ...items,
      { category: '', material_code: '', material_name: '', size_thickness: '', order_rate: 0, current_stock: '', current_stock_unit: '', custom_current_stock_unit: '', required_qty: 0, unit: '', custom_unit: '', remarks: '', vendor: vendor || '' }
    ]);
  };

  const removeRow = (index: number) => {
    if (items.length <= 1) return;
    const updated = [...items];
    updated.splice(index, 1);
    setItems(updated);
  };

  const clearTable = () => {
    setItems([
      { category: '', material_code: '', material_name: '', size_thickness: '', order_rate: 0, current_stock: '', current_stock_unit: '', custom_current_stock_unit: '', required_qty: 0, unit: '', custom_unit: '', remarks: '', vendor: vendor || '' }
    ]);
  };

  const handleItemChange = (index: number, keyOrObj: string | Record<string, any>, val?: any) => {
    const updated = [...items];
    if (typeof keyOrObj === 'string') {
      updated[index] = { ...updated[index], [keyOrObj]: val };
    } else {
      updated[index] = { ...updated[index], ...keyOrObj };
    }
    setItems(updated);
  };

  // Live spreadsheet formulas calculations
  const grossAmount = items.reduce((sum, item) => {
    const rate = Number(item.order_rate) || 0;
    const qty = Number(item.required_qty) || 0;
    return sum + (rate * qty);
  }, 0);

  const discountVal = Math.min(Math.max(Number(discountPercent) || 0, 0), 100);
  const netAmount = grossAmount * (1 - discountVal / 100);

  const handleAction = async (status: 'draft' | 'pending_admin_approval') => {
    setError('');
    setSuccess('');

    if (!vendor) {
      setError('Please select a Vendor for this procurement order.');
      return;
    }

    // Verify row level items
    if (status !== 'draft') {
      for (const [idx, item] of items.entries()) {
        if (!item.material_name || !item.size_thickness) {
          setError(`Row #${idx + 1} has incomplete material fields. Material Name and Size/Thickness are required.`);
          return;
        }
        if (Number(item.required_qty) <= 0) {
          setError(`Row #${idx + 1} must have a positive Required Quantity.`);
          return;
        }
        const unitValue = item.unit === 'Custom' ? item.custom_unit : item.unit;
        if (!unitValue || !unitValue.trim()) {
          setError(`Row #${idx + 1} requires a unit selection or custom input.`);
          return;
        }
      }
    }

    try {
      setSubmitting(true);
      const url = editId ? `/api/po/${editId}` : '/api/po';
      const method = editId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          po_number: poNumber.trim(),
          po_date: poDate,
          vendor,
          discount_percent: discountVal,
          remarks,
          status,
          items: items.map(it => ({
            ...it,
            unit: it.unit === 'Custom' ? it.custom_unit : it.unit,
            current_stock_unit: it.current_stock_unit === 'Custom' ? it.custom_current_stock_unit : it.current_stock_unit
          }))
        })
      });

      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }

      if (status === 'pending_admin_approval') {
        setShowSuccessPopup(true);
      } else {
        setSuccess('Procurement PO Draft saved successfully!');
        setTimeout(() => {
          router.push('/po');
          router.refresh();
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit PO');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '16px' }}>
        <div className="loading-dot" />
        <span style={{ color: 'var(--text-ghost)', fontWeight: 600, fontSize: '13px' }}>Prefilling Material Procurement Workspace...</span>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="card-clean" style={{ borderLeft: '4px solid var(--danger)', padding: '24px', margin: '20px auto', maxWidth: '600px' }}>
        <h3 style={{ color: 'var(--danger)', fontWeight: 800 }}>Authorization Notice</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>{error}</p>
        <Link href="/po" className="btn-corp" style={{ display: 'inline-block', marginTop: '16px', textDecoration: 'none' }}>Return to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1200px', margin: '0 auto', paddingBottom: '60px' }}>
      
      {/* Back Header */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', background: '#e2e8f0', color: 'var(--text-ghost)', padding: '6px 12px', borderRadius: '8px', fontWeight: 700 }}>
          Logged Role: {user?.role?.toUpperCase()}
        </span>
      </div>

      {correctionNotes && (
        <div className="card-clean fade-up" style={{ borderLeft: '4px solid #3b82f6', background: '#eff6ff', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1d4ed8', fontWeight: 800, fontSize: '15px' }}>
            <span>🔄 Returned by Admin for Correction</span>
          </div>
          <p style={{ color: '#1e40af', fontSize: '13px', lineHeight: '1.5', fontWeight: 600 }}>
            <strong>Admin Suggestion/Remarks:</strong> {correctionNotes}
          </p>
          <div style={{ fontSize: '11px', color: '#2563eb', fontWeight: 500 }}>
            * Note: You can modify the spreadsheet fields below. Submitting will send the updated PO back to the Admin queue for review.
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: '#fef2f2', borderLeft: '4px solid var(--danger)', padding: '16px 20px', borderRadius: '8px', color: '#b91c1c', fontSize: '14px', fontWeight: 600 }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ background: '#f0fdf4', borderLeft: '4px solid var(--success)', padding: '16px 20px', borderRadius: '8px', color: '#15803d', fontSize: '14px', fontWeight: 600 }}>
          {success}
        </div>
      )}

      {/* Main Form Fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Header Metadata Card */}
        <div className="card-clean" style={{ borderTop: '4px solid var(--primary)', padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '20px' }}>
            {editId ? '🛠️ Modify Procurement Purchase Order' : '📝 Create Procurement Purchase Order'}
          </h3>
          
          {/* Row 1: PO No + PO Date + Vendor */}
          <div className="grid grid-3" style={{ gap: '20px', marginBottom: '20px' }}>
            <div className="form-group-lux">
              <label>PO Number * <span style={{ color: '#94a3b8', fontWeight: 500, fontSize: '10px', textTransform: 'none' }}>(Unique Reference)</span></label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder={`e.g. ${poDate ? new Date(poDate).getFullYear().toString().slice(-2) + (new Date(poDate).getMonth() + 1).toString().padStart(2, '0') + new Date(poDate).getDate().toString().padStart(2, '0') : ''}-0001 (Auto-generated on Save)`}
                  required
                  readOnly
                  value={poNumber || ''}
                  style={{ paddingRight: '36px', background: '#f1f5f9', cursor: 'not-allowed', fontWeight: 800 }}
                />
                <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', pointerEvents: 'none' }}>🔑</span>
              </div>
            </div>

            <div className="form-group-lux">
              <label>PO Date * <span style={{ color: '#94a3b8', fontWeight: 500, fontSize: '10px', textTransform: 'none' }}>(Click to set today)</span></label>
              <input
                type="date"
                required
                value={poDate}
                onClick={e => {
                  if (!poDate) {
                    const todayIST = new Date().toLocaleString('en-CA', { timeZone: 'Asia/Kolkata' }).split(',')[0].trim();
                    setPoDate(todayIST);
                  }
                  (e.target as HTMLInputElement).showPicker?.();
                }}
                onChange={e => setPoDate(e.target.value)}
                style={{ cursor: 'pointer' }}
              />
            </div>

            <div className="form-group-lux">
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>Vendor / Supplier *
                <button type="button" onClick={() => setShowNewVendorModal(true)} style={{ fontSize: '10px', fontWeight: 700, color: 'var(--primary)', background: 'none', border: '1px solid var(--primary)', borderRadius: '6px', padding: '2px 8px', cursor: 'pointer', textTransform: 'none', letterSpacing: 0 }}>+ New Vendor</button>
              </label>
              <PremiumSearchDropdown
                value={vendor}
                onChange={(val: string) => setVendor(val)}
                options={vendorsList.map(v => ({ value: v.vendor_name, label: 'Registered Vendor' }))}
                placeholder="Search or select vendor..."
                required
              />
            </div>
          </div>

          {/* Row 2: Remarks */}
          <div className="form-group-lux">
            <label>Remarks (PM Instructions) <span style={{ color: '#94a3b8', fontWeight: 500, fontSize: '10px', textTransform: 'none' }}>— Visible to all approvers</span></label>
            <input type="text" placeholder="Specify order details, delivery terms, or special instructions for Admin/Accountant/Supervisor..." value={remarks} onChange={e => setRemarks(e.target.value)} />
          </div>
        </div>

        {/* Dynamic Spreadsheet Procurement Grid Table */}
        <div className="card-clean" style={{ padding: '0px', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800 }}>Spreadsheet Procurement Dynamic Entry Grid</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Enter required material specifications, quantities, and operational rates.</p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn-corp" onClick={() => setShowNewMaterialModal(true)} style={{ padding: '6px 12px', fontSize: '12px', borderColor: 'var(--primary)', color: 'var(--primary)' }}>
                ✨ Register New Material
              </button>
              <button className="btn-corp" onClick={clearTable} style={{ padding: '6px 12px', fontSize: '12px', borderColor: 'var(--danger)', color: 'var(--danger)' }}>
                🧹 Clear Table
              </button>
              <button className="btn-corp btn-primary-corp" onClick={addRow} style={{ padding: '6px 14px', fontSize: '12px', background: 'var(--primary)', color: 'white' }}>
                ➕ Add Material Row
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px', color: 'var(--text-ghost)', fontWeight: 800, width: '40px' }}>#</th>
                  <th style={{ padding: '12px 12px', color: 'var(--text-ghost)', fontWeight: 800, minWidth: '150px' }}>Category *</th>
                  <th style={{ padding: '12px 12px', color: 'var(--text-ghost)', fontWeight: 800, minWidth: '180px' }}>Material Code <span style={{ fontSize: '10px', fontWeight: 500 }}>(Optional)</span></th>
                  <th style={{ padding: '12px 12px', color: 'var(--text-ghost)', fontWeight: 800, minWidth: '180px' }}>Material Name *</th>
                  <th style={{ padding: '12px 12px', color: 'var(--text-ghost)', fontWeight: 800, minWidth: '100px' }}>Size / Thickness *</th>
                  <th style={{ padding: '12px 12px', color: 'var(--text-ghost)', fontWeight: 800, minWidth: '160px' }}>Current Stock & Unit</th>
                  <th style={{ padding: '12px 12px', color: 'var(--text-ghost)', fontWeight: 800, minWidth: '160px' }}>Required Qty & Unit *</th>
                  <th style={{ padding: '12px 12px', color: 'var(--text-ghost)', fontWeight: 800, minWidth: '100px' }}>Order Rate (₹)</th>
                  <th style={{ padding: '12px 12px', color: 'var(--text-ghost)', fontWeight: 800, minWidth: '110px' }}>Amount (₹)</th>
                  <th style={{ padding: '12px 12px', color: 'var(--text-ghost)', fontWeight: 800, minWidth: '140px' }}>Vendor</th>
                  <th style={{ padding: '12px 12px', color: 'var(--text-ghost)', fontWeight: 800, minWidth: '140px' }}>Remarks</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-ghost)', fontWeight: 800, width: '50px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const itemAmount = (Number(item.order_rate) || 0) * (Number(item.required_qty) || 0);
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }} className="table-row-hover">
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-ghost)', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ padding: '8px' }}>
                        <PremiumSearchDropdown
                          value={(item.category || '').startsWith('Rexins') ? 'Rexins' : (item.category || '')}
                          onChange={(val: string) => {
                            const newCategory = val === 'Rexins' ? 'Rexins - Sandwich' : val;
                            handleItemChange(idx, {
                              category: newCategory,
                              material_code: '', // Reset when category changes
                              material_name: ''
                            });
                          }}
                          options={Array.from(new Set([...MATERIAL_CATEGORIES, ...materialsList.map(m => m.category).filter(c => c)])).map(cat => ({ value: cat, label: 'Category' }))}
                          placeholder="Select or add..."
                          required
                        />
                        {(item.category || '').startsWith('Rexins') && (
                          <div style={{ marginTop: '8px', display: 'flex', gap: '8px', fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', background: '#eff6ff', padding: '6px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                              <input 
                                type="radio" 
                                name={`rexin_type_${idx}`} 
                                checked={item.category === 'Rexins - Sandwich'} 
                                onChange={() => handleItemChange(idx, 'category', 'Rexins - Sandwich')} 
                              /> Sandwich
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                              <input 
                                type="radio" 
                                name={`rexin_type_${idx}`} 
                                checked={item.category === 'Rexins - Insoles'} 
                                onChange={() => handleItemChange(idx, 'category', 'Rexins - Insoles')} 
                              /> Insoles
                            </label>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '8px', minWidth: '220px' }}>
                        <PremiumSearchDropdown
                          value={item.material_code}
                          onChange={(val: string) => {
                            const selected = materialsList.find(m => m.material_code.toUpperCase() === val.toUpperCase());
                            let updates: any = { material_code: val };
                            if (selected) {
                              updates.material_name = selected.material_name;
                              updates.category = selected.category || item.category || 'Others';
                            }

                            // Auto-fill MM Logic
                            const mmMatch = val.match(/(\d+(?:\.\d+)?)\s*[mM][mM]/);
                            if (mmMatch) {
                              updates.size_thickness = mmMatch[0].toUpperCase();
                            }

                            // Auto-fill Rate Logic (digits at the very end of string)
                            const cleanVal = val.trim();
                            const priceMatch = cleanVal.match(/(\d+(?:\.\d+)?)$/);
                            if (priceMatch && !isNaN(parseFloat(priceMatch[1]))) {
                              updates.order_rate = parseFloat(priceMatch[1]);
                            }

                            handleItemChange(idx, updates);
                          }}
                          options={materialsList
                            .filter(m => {
                              if (!item.category) return true;
                              const itemBaseCat = item.category.startsWith('Rexins') ? 'Rexins' : item.category;
                              const mBaseCat = (m.category || 'Others').startsWith('Rexins') ? 'Rexins' : (m.category || 'Others');
                              return itemBaseCat === mBaseCat;
                            })
                            .map(m => ({ value: m.material_code, label: m.material_name }))}
                          placeholder={!item.category ? "Select Category First..." : "Search or type code (optional)..."}
                        />
                      </td>
                      <td style={{ padding: '8px' }}>
                        {(() => {
                          const isRegistered = materialsList.some(m => m.material_code.toUpperCase() === (item.material_code || '').toUpperCase());
                          return (
                            <PremiumSearchDropdown
                              value={item.material_name}
                              onChange={(val: string) => {
                                const selected = materialsList.find(m => m.material_name.toUpperCase() === val.toUpperCase());
                                let updates: any = { material_name: val };
                                
                                if (selected) {
                                  updates.material_code = selected.material_code;
                                  updates.category = selected.category || item.category || 'Others';
                                }

                                // Auto-fill MM Logic
                                const mmMatch = val.match(/(\d+(?:\.\d+)?)\s*[mM][mM]/);
                                if (mmMatch) {
                                  updates.size_thickness = mmMatch[0].toUpperCase();
                                }
                                
                                // Auto-fill Rate Logic (digits at the very end of string)
                                const cleanVal = val.trim();
                                const priceMatch = cleanVal.match(/(\d+(?:\.\d+)?)$/);
                                if (priceMatch && !isNaN(parseFloat(priceMatch[1]))) {
                                  updates.order_rate = parseFloat(priceMatch[1]);
                                }

                                handleItemChange(idx, updates);
                              }}
                              options={materialsList
                                .filter(m => {
                                  if (!item.category) return true;
                                  const itemBaseCat = item.category.startsWith('Rexins') ? 'Rexins' : item.category;
                                  const mBaseCat = (m.category || 'Others').startsWith('Rexins') ? 'Rexins' : (m.category || 'Others');
                                  return itemBaseCat === mBaseCat;
                                })
                                .map(m => ({ value: m.material_name, label: m.material_code }))}
                              placeholder={isRegistered ? "Populated from registry..." : "Search or type name..."}
                              required
                            />
                          );
                        })()}
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input type="text" placeholder="e.g. 5mm" required value={item.size_thickness} onChange={e => handleItemChange(idx, 'size_thickness', e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }} />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <select
                            value={item.current_stock_unit || ''}
                            onChange={e => {
                              const v = e.target.value;
                              handleItemChange(idx, 'current_stock_unit', v);
                              if (!v) handleItemChange(idx, 'current_stock', 0);
                            }}
                            style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', fontWeight: 700, background: '#f8fafc', color: 'var(--text-main)' }}
                          >
                            <option value="">-- Choose Unit --</option>
                            <option value="Pair">Pair</option>
                            <option value="piece">Piece</option>
                            <option value="Meter">Meter</option>
                            <option value="KG">KG</option>
                            <option value="Custom">Custom</option>
                          </select>

                          {item.current_stock_unit === 'Custom' && (
                            <input
                              type="text"
                              placeholder="Write Custom Unit..."
                              value={item.custom_current_stock_unit || ''}
                              onChange={e => handleItemChange(idx, 'custom_current_stock_unit', e.target.value)}
                              style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', fontWeight: 600 }}
                            />
                          )}

                          <input
                            type="number"
                            min="0"
                            step="any"
                            disabled={!item.current_stock_unit}
                            placeholder={!item.current_stock_unit ? 'Select unit first' : `Stock (${item.current_stock_unit === 'Custom' ? (item.custom_current_stock_unit || 'Custom') : item.current_stock_unit})`}
                            value={item.current_stock_unit ? (item.current_stock === '' ? '' : item.current_stock ?? '') : ''}
                            onChange={e => handleItemChange(idx, 'current_stock', e.target.value === '' ? '' : parseFloat(e.target.value) ?? '')}
                            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, background: !item.current_stock_unit ? '#f1f5f9' : 'white', cursor: !item.current_stock_unit ? 'not-allowed' : 'auto' }}
                          />
                        </div>
                      </td>
                      <td style={{ padding: '8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <select
                            value={item.unit || ''}
                            onChange={e => {
                              const newUnit = e.target.value;
                              handleItemChange(idx, 'unit', newUnit);
                              if (!newUnit) {
                                handleItemChange(idx, 'required_qty', 0);
                              }
                            }}
                            style={{ 
                              width: '100%', 
                              padding: '6px 8px', 
                              border: '1px solid var(--border)', 
                              borderRadius: '6px', 
                              fontSize: '11px', 
                              fontWeight: 700, 
                              background: '#f8fafc',
                              color: 'var(--text-main)'
                            }}
                          >
                            <option value="">-- Choose Unit --</option>
                            <option value="Pair">Pair</option>
                            <option value="piece">Piece</option>
                            <option value="Meter">Meter</option>
                            <option value="KG">KG</option>
                            <option value="Custom">Custom</option>
                          </select>

                          {item.unit === 'Custom' && (
                            <input 
                              type="text"
                              placeholder="Write Custom Unit..."
                              required
                              value={item.custom_unit || ''}
                              onChange={e => handleItemChange(idx, 'custom_unit', e.target.value)}
                              style={{ 
                                width: '100%', 
                                padding: '6px 8px', 
                                border: '1px solid var(--border)', 
                                borderRadius: '6px', 
                                fontSize: '11px', 
                                fontWeight: 600 
                              }}
                            />
                          )}

                          <input 
                            type="number" 
                            min="0.01" 
                            step="any" 
                            required 
                            disabled={!item.unit}
                            placeholder={!item.unit ? "Select unit first" : `Qty (${item.unit === 'Custom' ? (item.custom_unit || 'Custom') : item.unit})`}
                            value={item.required_qty || ''} 
                            onChange={e => handleItemChange(idx, 'required_qty', Math.max(parseFloat(e.target.value) || 0, 0))} 
                            style={{ 
                              width: '100%', 
                              padding: '8px 10px', 
                              border: '1px solid var(--border)', 
                              borderRadius: '6px', 
                              fontSize: '13px', 
                              fontWeight: 600, 
                              background: !item.unit ? '#f1f5f9' : '#fffbeb',
                              cursor: !item.unit ? 'not-allowed' : 'auto'
                            }} 
                          />
                        </div>
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input type="number" min="0" step="any" placeholder="Optional" value={item.order_rate || ''} onChange={e => handleItemChange(idx, 'order_rate', Math.max(parseFloat(e.target.value) || 0, 0))} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, background: '#fffbeb' }} />
                      </td>
                      <td style={{ padding: '12px', fontWeight: 800, fontFamily: 'monospace', color: 'var(--primary)' }}>
                        ₹{itemAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input type="text" placeholder="Row Vendor (Optional)" value={item.vendor} onChange={e => handleItemChange(idx, 'vendor', e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }} />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input type="text" placeholder="Remarks (Internal)" value={item.remarks || ''} onChange={e => handleItemChange(idx, 'remarks', e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }} />
                      </td>

                      <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                        <button disabled={items.length <= 1} onClick={() => removeRow(idx)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: items.length > 1 ? 'pointer' : 'not-allowed', fontSize: '16px', opacity: items.length > 1 ? 1 : 0.4 }}>
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dynamic Formula Panel */}
        <div className="grid grid-3" style={{ gap: '32px' }}>
          
          <div style={{ gridColumn: 'span 2' }} />

          {/* live calculations box */}
          <div className="card-clean" style={{ display: 'flex', flexDirection: 'column', gap: '20px', borderLeft: '4px solid var(--primary)' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 800 }}>Spreadsheet Procurement Formula Ledger</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Real-time dynamic calculations on Raw Materials.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button className="btn-corp btn-primary-corp" disabled={submitting} onClick={() => handleAction('pending_admin_approval')} style={{ background: 'var(--primary)', color: 'white', fontWeight: 700, width: '100%' }}>
                {submitting ? 'Processing...' : 'Submit for Admin Review'}
              </button>
              
              <button className="btn-corp" disabled={submitting} onClick={() => handleAction('draft')} style={{ width: '100%' }}>
                Save Draft PO
              </button>
            </div>
          </div>

        </div>

        {/* Historical PO Items reference ledger */}
        <div className="card-clean font-inter" style={{ borderTop: '4px solid #10b981', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📋</span> Historical Purchase Order Ledger Reference (Read Only)
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Review all past items ordered across all approved, completed, or draft purchase orders.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={(e) => {
                e.preventDefault();
                if (historicalPoItems.length === 0) return alert('No historical data to export');
                const headers = ['PO Ref', 'Material Code', 'Material Name', 'Size/Thickness', 'Required Qty', 'Unit', 'Order Rate', 'Amount', 'Vendor', 'Status'];
                const rows = historicalPoItems.map(it => [
                  `"${it.po_number || ''}"`,
                  `"${it.material_code || ''}"`,
                  `"${it.material_name || ''}"`,
                  `"${it.size_thickness || ''}"`,
                  `"${it.required_qty || 0}"`,
                  `"${it.unit || ''}"`,
                  `"${it.order_rate || 0}"`,
                  `"${it.amount || ((it.order_rate || 0) * (it.required_qty || 0))}"`,
                  `"${it.vendor || ''}"`,
                  `"${it.status || ''}"`
                ]);
                const csvStr = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `PO_Historical_Ledger_${new Date().toISOString().split('T')[0]}.csv`;
                link.click();
              }} style={{ fontSize: '12px', background: '#e0e7ff', color: '#3730a3', border: '1px solid #c7d2fe', padding: '4px 10px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}>
                ⬇️ Export CSV
              </button>
              <span style={{ fontSize: '12px', background: '#d1fae5', color: '#065f46', padding: '4px 10px', borderRadius: '6px', fontWeight: 700 }}>
                {historicalPoItems.length} Past Items
              </span>
            </div>
          </div>

          <div style={{ overflowX: 'auto', maxHeight: '350px' }}>
            {historicalPoItems.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-ghost)', fontSize: '13px', fontWeight: 600 }}>
                No historical purchase orders recorded.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: '12px 12px', color: 'var(--text-ghost)', fontWeight: 800 }}>PO Ref</th>
                    <th style={{ padding: '12px 12px', color: 'var(--text-ghost)', fontWeight: 800 }}>Material Code</th>
                    <th style={{ padding: '12px 12px', color: 'var(--text-ghost)', fontWeight: 800 }}>Material Name</th>
                    <th style={{ padding: '12px 12px', color: 'var(--text-ghost)', fontWeight: 800 }}>Size / Thickness</th>
                    <th style={{ padding: '12px 12px', color: 'var(--text-ghost)', fontWeight: 800 }}>Required Qty & Unit</th>
                    <th style={{ padding: '12px 12px', color: 'var(--text-ghost)', fontWeight: 800 }}>Order Rate (₹)</th>
                    <th style={{ padding: '12px 12px', color: 'var(--text-ghost)', fontWeight: 800 }}>Amount (₹)</th>
                    <th style={{ padding: '12px 12px', color: 'var(--text-ghost)', fontWeight: 800 }}>Vendor</th>
                    <th style={{ padding: '12px 12px', color: 'var(--text-ghost)', fontWeight: 800 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {historicalPoItems.map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }} className="table-row-hover">
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text-ghost)' }}>{it.po_number}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#4f46e5' }}>{it.material_code}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{it.material_name}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{it.size_thickness}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700 }}>{it.required_qty} {it.unit}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, fontFamily: 'monospace' }}>₹{Number(it.order_rate).toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 800, fontFamily: 'monospace', color: 'var(--primary)' }}>₹{Number(it.amount).toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{it.vendor}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          fontSize: '10px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontWeight: 800,
                          background: it.status === 'completed' ? '#dcfce7' : it.status === 'pending_admin_approval' ? '#fef9c3' : '#eff6ff',
                          color: it.status === 'completed' ? '#15803d' : it.status === 'pending_admin_approval' ? '#854d0e' : '#1e40af'
                        }}>
                          {it.status?.toUpperCase()?.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      {showSuccessPopup && (
        <div style={{
          position: 'fixed',
          top: '0', left: '0', right: '0', bottom: '0',
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
        }}>
          <div className="card-clean fade-up" style={{
            width: '100%',
            maxWidth: '460px',
            padding: '36px',
            textAlign: 'center',
            borderTop: '5px solid #eab308',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: '#fef9c3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '40px',
              boxShadow: '0 4px 10px rgba(234, 179, 8, 0.2)',
              animation: 'pulse-slow 2s infinite'
            }}>
              ⏳
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-main)' }}>
                Sent to Admin Successfully
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.5 }}>
                Wait for Approval....
              </p>
            </div>

            <div style={{ background: '#f8fafc', padding: '12px 18px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-ghost)', fontWeight: 700 }}>
              PO Number: {poNumber}
            </div>

            <button
              onClick={() => {
                router.push('/po');
                router.refresh();
              }}
              className="btn-corp btn-primary-corp"
              style={{
                width: '100%',
                background: '#eab308',
                borderColor: '#eab308',
                color: 'black',
                fontWeight: 800,
                fontSize: '14px',
                padding: '12px',
                marginTop: '10px'
              }}
            >
              Okay, Go to Dashboard
            </button>
          </div>
        </div>
      )}

      {showNewMaterialModal && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="card-clean fade-up" style={{ width: '90%', maxWidth: '400px', padding: '24px', background: 'white', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800 }}>✨ Register New Material</h3>
              <button onClick={() => setShowNewMaterialModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-ghost)' }}>×</button>
            </div>
            <form onSubmit={handleAddMaterial} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group-lux">
                <label>Date (Auto)</label>
                <input type="text" value={poDate} readOnly style={{ background: '#f1f5f9', cursor: 'not-allowed' }} />
              </div>
              <div className="form-group-lux">
                <label>Category *</label>
                <select
                  value={newMaterialData.category}
                  onChange={e => setNewMaterialData({...newMaterialData, category: e.target.value})}
                  style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', fontWeight: 600, background: 'white' }}
                  required
                >
                  <option value="">-- Select Category --</option>
                  {dynamicCategories.map((cat: string) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              {newMaterialData.category === 'Others' && (
                <div className="form-group-lux">
                  <label>Specify Category Name</label>
                  <input type="text" placeholder="e.g. Adhesives" value={customMaterialCategory} onChange={e => setCustomMaterialCategory(e.target.value)} />
                </div>
              )}
              <div className="form-group-lux">
                <label>Material Code <span style={{ textTransform: 'none', fontWeight: 500 }}>(Optional)</span></label>
                <input type="text" placeholder="e.g. EVA-001" value={newMaterialData.material_code} onChange={e => setNewMaterialData({...newMaterialData, material_code: e.target.value})} />
              </div>
              <div className="form-group-lux">
                <label>Material Name *</label>
                <input type="text" placeholder="e.g. Standard EVA Sheet" required value={newMaterialData.material_name} onChange={e => setNewMaterialData({...newMaterialData, material_name: e.target.value})} />
              </div>
              <button type="submit" disabled={savingMaterial} className="btn-corp btn-primary-corp" style={{ width: '100%', marginTop: '10px', padding: '12px', fontSize: '14px' }}>
                {savingMaterial ? 'Saving...' : 'Register Material'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showNewVendorModal && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="card-clean fade-up" style={{ width: '90%', maxWidth: '380px', padding: '24px', background: 'white', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800 }}>🏭 Register New Vendor</h3>
              <button onClick={() => setShowNewVendorModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-ghost)' }}>×</button>
            </div>
            <form onSubmit={handleAddVendor} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group-lux">
                <label>Company Name *</label>
                <input type="text" placeholder="Official Registered Name" required value={newVendorCompany} onChange={e => setNewVendorCompany(e.target.value)} />
              </div>
              <div className="form-group-lux">
                <label>Vendor / Supplier Name (Optional)</label>
                <input type="text" placeholder="e.g. ABC Traders Pvt Ltd" value={newVendorName} onChange={e => setNewVendorName(e.target.value)} />
              </div>
              <div className="form-group-lux">
                <label>Full Address</label>
                <textarea placeholder="Street, City, State, ZIP (Optional)" value={newVendorAddress} onChange={e => setNewVendorAddress(e.target.value)} style={{ background: '#f8fafc', border: '1px solid var(--border)', padding: '10px 14px', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', fontWeight: 500, outline: 'none', resize: 'vertical', minHeight: '80px' }} />
              </div>
              <button type="submit" disabled={savingVendor} className="btn-corp btn-primary-corp" style={{ width: '100%', marginTop: '10px', padding: '12px', fontSize: '14px' }}>
                {savingVendor ? 'Saving...' : 'Register Vendor'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      <style jsx>{`
        .form-group-lux { display: flex; flex-direction: column; gap: 8px; }
        .form-group-lux label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
        .form-group-lux input { background: #f8fafc; border: 1px solid var(--border); padding: 10px 14px; border-radius: 8px; font-size: 14px; font-family: inherit; font-weight: 500; outline: none; transition: border-color 0.2s; }
        .form-group-lux input:focus { border-color: var(--primary); background: white; }
        .table-row-hover:hover { background: #f8fafc; }
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}

export default function CreatePO() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '16px' }}>
        <div className="loading-dot" />
        <span style={{ color: 'var(--text-ghost)', fontWeight: 600, fontSize: '13px' }}>Loading Workspace...</span>
      </div>
    }>
      <CreatePOFormContent />
    </Suspense>
  );
}
