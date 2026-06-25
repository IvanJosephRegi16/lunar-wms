'use client';

import { useState, useEffect, useMemo } from 'react';
import styles from '../../pm/articles/page.module.css';
import ExportDropdown from '@/components/ExportDropdown';

export default function MaterialsHub() {
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Categories from DB (all dynamic, no hardcoded base)
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [savingCat, setSavingCat] = useState(false);
  const [showAddCatForm, setShowAddCatForm] = useState(false);

  // Tab control
  const [activeMainTab, setActiveMainTab] = useState<'materials' | 'vendors' | 'categories'>('materials');
  const [selectedMatCategory, setSelectedMatCategory] = useState('');

  // Vendors
  const [vendors, setVendors] = useState<any[]>([]);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorCompany, setNewVendorCompany] = useState('');
  const [newVendorAddress, setNewVendorAddress] = useState('');
  const [isVendorFormOpen, setIsVendorFormOpen] = useState(false);

  // Material form
  const [isMatFormOpen, setIsMatFormOpen] = useState(false);
  const [newMatCode, setNewMatCode] = useState('');
  const [newMatName, setNewMatName] = useState('');
  const [newMatCategory, setNewMatCategory] = useState('');
  const [newMatSizeThickness, setNewMatSizeThickness] = useState('');
  const [newMatRate, setNewMatRate] = useState<number | ''>('');

  // Edit state
  const [editingMat, setEditingMat] = useState<any>(null);
  const [editingVendor, setEditingVendor] = useState<any>(null);

  // All categories from DB + any orphan categories on materials
  const allCategories = useMemo(() => {
    const all = new Set([...customCategories]);
    materials.forEach(m => {
      if (m.category && m.category.trim()) all.add(m.category.trim());
    });
    return Array.from(all).sort();
  }, [customCategories, materials]);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [matRes, catRes] = await Promise.all([
        fetch('/api/po/materials'),
        fetch('/api/po/categories')
      ]);
      if (matRes.ok) {
        const data = await matRes.json();
        setMaterials(data.materials || []);
        setVendors(data.vendors || []);
      }
      if (catRes.ok) {
        const catData = await catRes.json();
        const cats = catData.categories || [];
        setCustomCategories(cats);
        if (!selectedMatCategory && cats.length > 0) setSelectedMatCategory(cats[0]);
        if (!newMatCategory && cats.length > 0) setNewMatCategory(cats[0]);
      }
    } catch (err) {
      console.error('Failed to fetch hub data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCatName.trim();
    if (!name) return alert('Category name is required');
    setSavingCat(true);
    try {
      const res = await fetch('/api/po/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (res.ok) {
        setCustomCategories(prev => [...new Set([...prev, name])].sort());
        setNewCatName('');
        setShowAddCatForm(false);
      } else {
        alert(data.error || 'Failed to add category');
      }
    } catch (err) {
      alert('Network Error');
    } finally {
      setSavingCat(false);
    }
  };

  const handleDeleteCategory = async (name: string) => {
    if (!confirm(`Delete category "${name}"? Materials using it will keep their assigned category.`)) return;
    try {
      await fetch(`/api/po/categories?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
      setCustomCategories(prev => prev.filter(c => c !== name));
    } catch (err) {
      alert('Network Error');
    }
  };

  const handleCreateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/po/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'material', material_code: newMatCode, material_name: newMatName, category: newMatCategory, size_thickness: newMatSizeThickness, rate: newMatRate })
      });
      const data = await res.json();
      if (res.ok) {
        setIsMatFormOpen(false);
        setNewMatCode('');
        setNewMatName('');
        setNewMatSizeThickness('');
        setNewMatRate('');
        setNewMatCategory(allCategories[0] || '');
        fetchAll();
      } else {
        alert(data.error || 'Failed to create material');
      }
    } catch (err) {
      alert('Network Error');
    } finally {
      setSaving(false);
    }
  };

  const handleEditMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMat) return;
    setSaving(true);
    try {
      const res = await fetch('/api/po/materials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'material', id: editingMat.id, material_code: editingMat.material_code, material_name: editingMat.material_name, category: editingMat.category, size_thickness: editingMat.size_thickness, rate: editingMat.rate })
      });
      const data = await res.json();
      if (res.ok) { setEditingMat(null); fetchAll(); }
      else alert(data.error || 'Failed to update material');
    } catch { alert('Network Error'); }
    finally { setSaving(false); }
  };

  const handleEditVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVendor) return;
    setSaving(true);
    try {
      const res = await fetch('/api/po/materials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'vendor', id: editingVendor.id, vendor_name: editingVendor.vendor_name, company_name: editingVendor.company_name, address: editingVendor.address })
      });
      const data = await res.json();
      if (res.ok) { setEditingVendor(null); fetchAll(); }
      else alert(data.error || 'Failed to update vendor');
    } catch { alert('Network Error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number, type: 'material' | 'vendor') => {
    if (!confirm(`Are you sure you want to delete this ${type}? This action cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/po/materials?id=${id}&type=${type}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) fetchAll();
      else alert(data.error || `Failed to delete ${type}`);
    } catch (err) {
      alert('Network Error');
    }
  };

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVendorCompany) return alert('Company Name is required');
    setSaving(true);
    try {
      const res = await fetch('/api/po/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'vendor', vendor_name: newVendorName, company_name: newVendorCompany, address: newVendorAddress })
      });
      const data = await res.json();
      if (res.ok) {
        setIsVendorFormOpen(false);
        setNewVendorName(''); setNewVendorCompany(''); setNewVendorAddress('');
        fetchAll();
      } else {
        alert(data.error || 'Failed to create vendor');
      }
    } catch (err) {
      alert('Network Error');
    } finally {
      setSaving(false);
    }
  };

  const filteredMaterials = useMemo(() => {
    return materials.filter(m => (m.category || 'Uncategorized') === selectedMatCategory);
  }, [materials, selectedMatCategory]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>Loading Registry...</div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleBox}>
          <h1>Master Hub Data</h1>
          <p>Enterprise Registry for Raw Materials, Vendor Suppliers &amp; Categories</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            className={styles.btnPrimary}
            style={{ background: activeMainTab === 'materials' ? 'var(--primary)' : 'white', color: activeMainTab === 'materials' ? 'white' : 'var(--text-main)', border: '1px solid var(--border)' }}
            onClick={() => setActiveMainTab('materials')}
          >📦 Materials</button>
          <button
            className={styles.btnPrimary}
            style={{ background: activeMainTab === 'categories' ? '#10b981' : 'white', color: activeMainTab === 'categories' ? 'white' : 'var(--text-main)', border: '1px solid var(--border)' }}
            onClick={() => setActiveMainTab('categories')}
          >🏷️ Categories</button>
          <button
            className={styles.btnPrimary}
            style={{ background: activeMainTab === 'vendors' ? '#8b5cf6' : 'white', color: activeMainTab === 'vendors' ? 'white' : 'var(--text-main)', border: '1px solid var(--border)' }}
            onClick={() => setActiveMainTab('vendors')}
          >🏢 Vendors</button>
        </div>
      </header>

      {/* ─── MATERIALS TAB ─── */}
      {activeMainTab === 'materials' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <ExportDropdown
              filename={`Materials_Hub_${selectedMatCategory}_${new Date().toISOString().slice(0, 10)}`}
              headers={['Material Code', 'Material Name', 'Size/Thickness', 'Rate', 'Category', 'Date Added']}
              rows={filteredMaterials.map(m => [
                m.material_code,
                m.material_name,
                m.size_thickness || '',
                m.rate || '',
                m.category || 'Others',
                new Date(m.created_at || Date.now()).toLocaleDateString('en-IN')
              ])}
            />
            <button className={styles.btnPrimary} onClick={() => setIsMatFormOpen(true)}>
              <span style={{ fontSize: '16px' }}>+</span> Create Material
            </button>
          </div>
          {/* Category Tabs */}
          <div className={styles.tabsContainer}>
            {allCategories.map(cat => (
              <button
                key={cat}
                className={`${styles.tabBtn} ${selectedMatCategory === cat ? styles.tabActive : ''}`}
                onClick={() => setSelectedMatCategory(cat)}
              >{cat}</button>
            ))}
          </div>
          {/* Materials Grid */}
          <div className={styles.materialsGrid}>
            {filteredMaterials.map(mat => (
              <div key={mat.id} className={styles.materialCard} style={{ position: 'relative', paddingRight: '60px' }}>
                <div className={styles.matCode}>{mat.material_code}</div>
                <div className={styles.matName}>{mat.material_name}</div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', marginBottom: '8px' }}>
                  {mat.size_thickness && <span style={{ marginRight: '8px' }}>📏 {mat.size_thickness}</span>}
                  {mat.rate ? <span>₹ {mat.rate}</span> : null}
                </div>
                <div className={styles.matDate}>Added: {new Date(mat.created_at || Date.now()).toLocaleDateString()}</div>
                <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '8px' }}>
                  <button onClick={() => setEditingMat(mat)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '14px' }} title="Edit Material">✏️</button>
                  <button onClick={() => handleDelete(mat.id, 'material')} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px' }} title="Delete Material">🗑️</button>
                </div>
              </div>
            ))}
            {filteredMaterials.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                No materials found in "{selectedMatCategory}".
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── CATEGORIES TAB ─── */}
      {activeMainTab === 'categories' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '16px', color: '#0f172a' }}>Category Management</div>
              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Add custom categories here. They will appear in the dropdown when creating POs and materials.</div>
            </div>
            <button
              className={styles.btnPrimary}
              style={{ background: '#10b981' }}
              onClick={() => setShowAddCatForm(v => !v)}
            >
              <span style={{ fontSize: '16px' }}>+</span> Add New Category
            </button>
          </div>

          {/* Add Category inline form */}
          {showAddCatForm && (
            <div style={{ background: '#f0fdf4', border: '2px solid #6ee7b7', borderRadius: '14px', padding: '24px', marginBottom: '24px', maxWidth: '480px' }}>
              <div style={{ fontWeight: 800, fontSize: '14px', color: '#065f46', marginBottom: '16px' }}>📁 Create New Category</div>
              <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px', textTransform: 'uppercase' }}>Category Name *</label>
                  <input
                    required
                    className={styles.input}
                    placeholder="e.g. Adhesives, Foam, Lining..."
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    style={{ padding: '10px 14px', border: '1.5px solid #6ee7b7', borderRadius: '8px', fontSize: '14px', fontWeight: 600, outline: 'none', width: '100%' }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingCat}
                  style={{ padding: '11px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 800, fontSize: '13px', cursor: savingCat ? 'wait' : 'pointer' }}
                >{savingCat ? 'Saving...' : '✓ Save'}</button>
                <button
                  type="button"
                  onClick={() => { setShowAddCatForm(false); setNewCatName(''); }}
                  style={{ padding: '11px 16px', background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                >Cancel</button>
              </form>
            </div>
          )}


          {/* Custom categories */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Custom Categories ({customCategories.length})</div>
            {customCategories.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #e2e8f0' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>🏷️</div>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>No custom categories yet</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>Click "+ Add New Category" above to create your first one.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {customCategories.map(cat => (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f0fdf4', border: '1.5px solid #6ee7b7', borderRadius: '10px', padding: '8px 16px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#065f46' }}>🏷️ {cat}</span>
                    <button
                      onClick={() => handleDeleteCategory(cat)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '13px', padding: '0', lineHeight: 1 }}
                      title="Delete category"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── VENDORS TAB ─── */}
      {activeMainTab === 'vendors' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <ExportDropdown
              filename={`Vendors_Hub_${new Date().toISOString().slice(0, 10)}`}
              headers={['Vendor / Supplier Name', 'Date Added']}
              rows={vendors.map(v => [v.vendor_name, new Date(v.created_at || Date.now()).toLocaleDateString('en-IN')])}
            />
            <button className={styles.btnPrimary} style={{ background: '#8b5cf6' }} onClick={() => setIsVendorFormOpen(true)}>
              <span style={{ fontSize: '16px' }}>+</span> Register Vendor
            </button>
          </div>
          <div className={styles.materialsGrid}>
            {vendors.map(v => (
              <div key={v.id} className={styles.materialCard} style={{ borderLeftColor: '#8b5cf6', position: 'relative', paddingRight: '60px' }}>
                <div className={styles.matCode} style={{ color: '#8b5cf6' }}>VENDOR</div>
                <div className={styles.matName}>{v.vendor_name}</div>
                <div className={styles.matDate}>Added: {new Date(v.created_at || Date.now()).toLocaleDateString()}</div>
                <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '8px' }}>
                  <button onClick={() => setEditingVendor(v)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '14px' }} title="Edit Vendor">✏️</button>
                  <button onClick={() => handleDelete(v.id, 'vendor')} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px' }} title="Delete Vendor">🗑️</button>
                </div>
              </div>
            ))}
            {vendors.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No vendors registered.</div>
            )}
          </div>
        </>
      )}

      {/* ─── Create Material Modal ─── */}
      {isMatFormOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsMatFormOpen(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className={styles.modalHeader}>
              <h2>Create New Material</h2>
              <button className={styles.closeBtn} onClick={() => setIsMatFormOpen(false)}>×</button>
            </div>
            <form onSubmit={handleCreateMaterial} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className={styles.modalBody}>
                <div className={styles.fieldGroup}>
                  <label>Material Category</label>
                  <select className={styles.input} value={newMatCategory} onChange={e => setNewMatCategory(e.target.value)}>
                    {allCategories.map((cat: string) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div className={styles.fieldGroup}>
                  <label>Material Code / Material Name (Optional)</label>
                  <input className={styles.input} placeholder="e.g. RXN-001 or Black Rexin Premium" value={newMatCode} onChange={e => setNewMatCode(e.target.value)} />
                </div>
                <div className={styles.fieldGroup}>
                  <label>Material Description (Optional)</label>
                  <input className={styles.input} placeholder="e.g. 1.2mm Black Rexin" value={newMatName} onChange={e => setNewMatName(e.target.value)} />
                </div>
                <div className={styles.fieldGroup}>
                  <label>Size/Thickness (Optional)</label>
                  <input className={styles.input} placeholder="e.g. 5mm" value={newMatSizeThickness} onChange={e => setNewMatSizeThickness(e.target.value)} />
                </div>
                <div className={styles.fieldGroup}>
                  <label>Rate (Optional)</label>
                  <input type="number" step="any" className={styles.input} placeholder="e.g. 150" value={newMatRate} onChange={e => setNewMatRate(e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
                <div className={styles.fieldGroup}>
                  <label>Creation Date</label>
                  <input disabled className={styles.input} value={new Date().toLocaleDateString()} />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnPrimary} style={{ background: 'white', color: '#0f172a', border: '1px solid #cbd5e1' }} onClick={() => setIsMatFormOpen(false)}>Cancel</button>
                <button type="submit" className={styles.btnPrimary} disabled={saving}>{saving ? 'Saving...' : 'Save Material'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Create Vendor Modal ─── */}
      {isVendorFormOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsVendorFormOpen(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className={styles.modalHeader}>
              <h2>Register New Vendor</h2>
              <button className={styles.closeBtn} onClick={() => setIsVendorFormOpen(false)}>×</button>
            </div>
            <form onSubmit={handleCreateVendor} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className={styles.modalBody}>
                <div className={styles.fieldGroup}>
                  <label>Company Name *</label>
                  <input required className={styles.input} placeholder="e.g. Alpha Chemicals Ltd." value={newVendorCompany} onChange={e => setNewVendorCompany(e.target.value)} />
                </div>
                <div className={styles.fieldGroup}>
                  <label>Vendor / Supplier Name (Optional)</label>
                  <input className={styles.input} placeholder="e.g. Alpha Chemicals" value={newVendorName} onChange={e => setNewVendorName(e.target.value)} />
                </div>
                <div className={styles.fieldGroup}>
                  <label>Full Address (Optional)</label>
                  <input className={styles.input} placeholder="e.g. 123 Industrial Area..." value={newVendorAddress} onChange={e => setNewVendorAddress(e.target.value)} />
                </div>
                <div className={styles.fieldGroup}>
                  <label>Registration Date</label>
                  <input disabled className={styles.input} value={new Date().toLocaleDateString()} />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnPrimary} style={{ background: 'white', color: '#0f172a', border: '1px solid #cbd5e1' }} onClick={() => setIsVendorFormOpen(false)}>Cancel</button>
                <button type="submit" className={styles.btnPrimary} style={{ background: '#8b5cf6' }} disabled={saving}>{saving ? 'Saving...' : 'Register Vendor'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Edit Material Modal ─── */}
      {editingMat && (
        <div className={styles.modalOverlay} onClick={() => setEditingMat(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className={styles.modalHeader}>
              <h2>Edit Material</h2>
              <button className={styles.closeBtn} onClick={() => setEditingMat(null)}>×</button>
            </div>
            <form onSubmit={handleEditMaterial} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className={styles.modalBody}>
                <div className={styles.fieldGroup}>
                  <label>Material Category</label>
                  <select className={styles.input} value={editingMat.category || ''} onChange={e => setEditingMat({...editingMat, category: e.target.value})}>
                    {allCategories.map((cat: string) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div className={styles.fieldGroup}>
                  <label>Material Code / Material Name (Optional)</label>
                  <input className={styles.input} value={editingMat.material_code || ''} onChange={e => setEditingMat({...editingMat, material_code: e.target.value})} />
                </div>
                <div className={styles.fieldGroup}>
                  <label>Material Description (Optional)</label>
                  <input className={styles.input} value={editingMat.material_name || ''} onChange={e => setEditingMat({...editingMat, material_name: e.target.value})} />
                </div>
                <div className={styles.fieldGroup}>
                  <label>Size/Thickness</label>
                  <input className={styles.input} value={editingMat.size_thickness || ''} onChange={e => setEditingMat({...editingMat, size_thickness: e.target.value})} />
                </div>
                <div className={styles.fieldGroup}>
                  <label>Rate</label>
                  <input type="number" step="any" className={styles.input} value={editingMat.rate || ''} onChange={e => setEditingMat({...editingMat, rate: e.target.value === '' ? '' : Number(e.target.value)})} />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnPrimary} style={{ background: 'white', color: '#0f172a', border: '1px solid #cbd5e1' }} onClick={() => setEditingMat(null)}>Cancel</button>
                <button type="submit" className={styles.btnPrimary} disabled={saving}>{saving ? 'Saving...' : 'Update Material'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Edit Vendor Modal ─── */}
      {editingVendor && (
        <div className={styles.modalOverlay} onClick={() => setEditingVendor(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className={styles.modalHeader}>
              <h2>Edit Vendor</h2>
              <button className={styles.closeBtn} onClick={() => setEditingVendor(null)}>×</button>
            </div>
            <form onSubmit={handleEditVendor} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className={styles.modalBody}>
                <div className={styles.fieldGroup}>
                  <label>Company Name *</label>
                  <input required className={styles.input} value={editingVendor.company_name || ''} onChange={e => setEditingVendor({...editingVendor, company_name: e.target.value})} />
                </div>
                <div className={styles.fieldGroup}>
                  <label>Vendor Name</label>
                  <input className={styles.input} value={editingVendor.vendor_name || ''} onChange={e => setEditingVendor({...editingVendor, vendor_name: e.target.value})} />
                </div>
                <div className={styles.fieldGroup}>
                  <label>Full Address</label>
                  <input className={styles.input} value={editingVendor.address || ''} onChange={e => setEditingVendor({...editingVendor, address: e.target.value})} />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnPrimary} style={{ background: 'white', color: '#0f172a', border: '1px solid #cbd5e1' }} onClick={() => setEditingVendor(null)}>Cancel</button>
                <button type="submit" className={styles.btnPrimary} style={{ background: '#8b5cf6' }} disabled={saving}>{saving ? 'Saving...' : 'Update Vendor'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
