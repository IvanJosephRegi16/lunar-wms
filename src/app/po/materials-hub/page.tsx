'use client';

import { useState, useEffect, useMemo } from 'react';
import styles from '../../pm/articles/page.module.css'; // Reuse the exact same premium styles
import ExportDropdown from '@/components/ExportDropdown';

const MATERIAL_CATEGORIES = ['Rexins', 'Eva', 'Insoles', 'Buckles', 'Lace/Niwar', 'PVC Tube', 'Thread', 'Velcro', 'Others'];

export default function MaterialsHub() {
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Material Library States
  const [activeMainTab, setActiveMainTab] = useState<'materials' | 'vendors'>('materials');
  const [selectedMatCategory, setSelectedMatCategory] = useState(MATERIAL_CATEGORIES[0]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorCompany, setNewVendorCompany] = useState('');
  const [newVendorAddress, setNewVendorAddress] = useState('');
  const [isVendorFormOpen, setIsVendorFormOpen] = useState(false);
  const [isMatFormOpen, setIsMatFormOpen] = useState(false);
  const [newMatCode, setNewMatCode] = useState('');
  const [newMatName, setNewMatName] = useState('');
  const [newMatCategory, setNewMatCategory] = useState(MATERIAL_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/po/materials');
      if (res.ok) {
        const data = await res.json();
        setMaterials(data.materials || []);
        setVendors(data.vendors || []);
      }
    } catch (err) {
      console.error('Failed to fetch hub data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatName) return alert('Material Name is required');
    
    let finalCategory = newMatCategory;
    if (newMatCategory === 'Others' && customCategory.trim() !== '') {
      finalCategory = `Others - ${customCategory.trim()}`;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/po/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'material',
          material_code: newMatCode,
          material_name: newMatName,
          category: finalCategory
        })
      });
      const data = await res.json();
      if (res.ok) {
        setIsMatFormOpen(false);
        setNewMatCode('');
        setNewMatName('');
        setCustomCategory('');
        fetchMaterials();
      } else {
        alert(data.error || 'Failed to create material');
      }
    } catch (err) {
      alert('Network Error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, type: 'material' | 'vendor') => {
    if (!confirm(`Are you sure you want to delete this ${type}? This action cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/po/materials?id=${id}&type=${type}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        fetchMaterials();
      } else {
        alert(data.error || `Failed to delete ${type}`);
      }
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
        body: JSON.stringify({
          type: 'vendor',
          vendor_name: newVendorName,
          company_name: newVendorCompany,
          address: newVendorAddress
        })
      });
      const data = await res.json();
      if (res.ok) {
        setIsVendorFormOpen(false);
        setNewVendorName('');
        setNewVendorCompany('');
        setNewVendorAddress('');
        fetchMaterials();
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
    return materials.filter(m => (m.category || 'Others') === selectedMatCategory);
  }, [materials, selectedMatCategory]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>Loading Registry...</div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleBox}>
          <h1>Master Hub Data</h1>
          <p>Enterprise Registry for Raw Materials & Vendor Suppliers</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className={styles.btnPrimary} 
            style={{ background: activeMainTab === 'materials' ? 'var(--primary)' : 'white', color: activeMainTab === 'materials' ? 'white' : 'var(--text-main)', border: '1px solid var(--border)' }}
            onClick={() => setActiveMainTab('materials')}
          >
            📦 Materials
          </button>
          <button 
            className={styles.btnPrimary} 
            style={{ background: activeMainTab === 'vendors' ? '#8b5cf6' : 'white', color: activeMainTab === 'vendors' ? 'white' : 'var(--text-main)', border: '1px solid var(--border)' }}
            onClick={() => setActiveMainTab('vendors')}
          >
            🏢 Vendors
          </button>
        </div>
      </header>

      {activeMainTab === 'materials' ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <ExportDropdown
              filename={`Materials_Hub_${selectedMatCategory}_${new Date().toISOString().slice(0,10)}`}
              headers={['Material Code', 'Material Name', 'Category', 'Date Added']}
              rows={filteredMaterials.map(m => [
                m.material_code,
                m.material_name,
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
            {MATERIAL_CATEGORIES.map(cat => (
              <button 
                key={cat}
                className={`${styles.tabBtn} ${selectedMatCategory === cat ? styles.tabActive : ''}`}
                onClick={() => setSelectedMatCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Materials Grid */}
          <div className={styles.materialsGrid}>
            {filteredMaterials.map(mat => (
              <div key={mat.id} className={styles.materialCard} style={{ position: 'relative' }}>
                <div className={styles.matCode}>{mat.material_code}</div>
                <div className={styles.matName}>{mat.material_name}</div>
                <div className={styles.matDate}>Added: {new Date(mat.created_at || Date.now()).toLocaleDateString()}</div>
                <button 
                  onClick={() => handleDelete(mat.id, 'material')}
                  style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px' }}
                  title="Delete Material"
                >🗑️</button>
              </div>
            ))}
            {filteredMaterials.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                No materials found in {selectedMatCategory}.
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <ExportDropdown
              filename={`Vendors_Hub_${new Date().toISOString().slice(0,10)}`}
              headers={['Vendor / Supplier Name', 'Date Added']}
              rows={vendors.map(v => [
                v.vendor_name,
                new Date(v.created_at || Date.now()).toLocaleDateString('en-IN')
              ])}
            />
            <button className={styles.btnPrimary} style={{ background: '#8b5cf6' }} onClick={() => setIsVendorFormOpen(true)}>
              <span style={{ fontSize: '16px' }}>+</span> Register Vendor
            </button>
          </div>
          <div className={styles.materialsGrid}>
            {vendors.map(v => (
              <div key={v.id} className={styles.materialCard} style={{ borderLeftColor: '#8b5cf6', position: 'relative' }}>
                <div className={styles.matCode} style={{ color: '#8b5cf6' }}>VENDOR</div>
                <div className={styles.matName}>{v.vendor_name}</div>
                <div className={styles.matDate}>Added: {new Date(v.created_at || Date.now()).toLocaleDateString()}</div>
                <button 
                  onClick={() => handleDelete(v.id, 'vendor')}
                  style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px' }}
                  title="Delete Vendor"
                >🗑️</button>
              </div>
            ))}
            {vendors.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                No vendors registered.
              </div>
            )}
          </div>
        </>
      )}

      {/* Create Material Modal */}
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
                    {MATERIAL_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                {newMatCategory === 'Others' && (
                  <div className={styles.fieldGroup}>
                    <label>Specify Category Name</label>
                    <input className={styles.input} placeholder="e.g. Adhesives" value={customCategory} onChange={e => setCustomCategory(e.target.value)} />
                  </div>
                )}
                <div className={styles.fieldGroup}>
                  <label>Material Code (Optional)</label>
                  <input className={styles.input} placeholder="e.g. RXN-001" value={newMatCode} onChange={e => setNewMatCode(e.target.value)} />
                </div>
                <div className={styles.fieldGroup}>
                  <label>Material Name *</label>
                  <input required className={styles.input} placeholder="e.g. Black Rexin Premium" value={newMatName} onChange={e => setNewMatName(e.target.value)} />
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

      {/* Create Vendor Modal */}
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
    </div>
  );
}
