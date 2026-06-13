'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from './page.module.css';

export default function PMArticlesPage() {
  const searchParams = useSearchParams();
  const view = searchParams.get('view') || 'manage'; 

  const [articles, setArticles] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Advanced Filter States (Articles)
  const [fCode, setFCode] = useState('');
  const [fName, setFName] = useState('');
  const [fColour, setFColour] = useState('');
  const [fSize, setFSize] = useState('');
  const [fMat, setFMat] = useState('');
  const [fDate, setFDate] = useState('');

  // Material Library States
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedMatCategory, setSelectedMatCategory] = useState('');
  const [isMatFormOpen, setIsMatFormOpen] = useState(false);
  const [newMatCode, setNewMatCode] = useState('');
  const [newMatName, setNewMatName] = useState('');
  const [newMatCategory, setNewMatCategory] = useState('');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  
  // Dropdown menus for cards
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Form State
  const [isEditMode, setIsEditMode] = useState(false);
  const [originalCode, setOriginalCode] = useState('');
  
  const [articleCode, setArticleCode] = useState('');
  const [articleName, setArticleName] = useState('');
  const [description, setDescription] = useState('');
  const [colour, setColour] = useState('');
  const [sizes, setSizes] = useState('');
  const [plannedPrice, setPlannedPrice] = useState('');
  const [actualPrice, setActualPrice] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  
  const [bom, setBom] = useState<any[]>([{ material_code: '' }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchArticles();
    fetchMaterials();
    
    // Fix navigation bug: Close modals if we switch views via sidebar
    if (view === 'create') {
      openCreateForm();
    } else {
      setIsFormModalOpen(false);
      setIsViewModalOpen(false);
    }
  }, [view]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClick = () => setOpenDropdown(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const isDeleted = view === 'deleted' ? 'true' : 'false';
      const res = await fetch(`/api/pm/articles?deleted=${isDeleted}`);
      if (res.ok) {
        const data = await res.json();
        setArticles(data.articles || []);
      }
    } catch (err) {
      console.error('Failed to fetch articles', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMaterials = async () => {
    try {
      const [matRes, catRes] = await Promise.all([
        fetch('/api/po/materials'),
        fetch('/api/po/categories')
      ]);
      
      if (matRes.ok) {
        const data = await matRes.json();
        setMaterials(data.materials || []);
      }
      
      if (catRes.ok) {
        const catData = await catRes.json();
        const cats = catData.categories || [];
        setCategories(cats);
        if (cats.length > 0) {
          setSelectedMatCategory(cats[0]);
          setNewMatCategory(cats[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch materials/categories', err);
    }
  };

  // ── Operations ─────────────────────────────────────────────────────────

  const openCreateForm = () => {
    setIsEditMode(false);
    setArticleCode('');
    setArticleName('');
    setDescription('');
    setColour('');
    setSizes('');
    setPlannedPrice('');
    setActualPrice('');
    setImageBase64(null);
    setBom([{ category: '', material_code: '' }]);
    setIsFormModalOpen(true);
  };

  const openEditForm = (article: any) => {
    setIsEditMode(true);
    setOriginalCode(article.article_code);
    
    setArticleCode(article.article_code);
    setArticleName(article.article_name || '');
    setDescription(article.description || '');
    setColour(article.colour || '');
    setSizes(article.sizes || '');
    setPlannedPrice(article.planned_price || '');
    setActualPrice(article.actual_price || '');
    setImageBase64(article.image_base64 || null);
    
    if (article.bom && article.bom.length > 0) {
      // Reconstruct category from materials list for existing BOMs
      const enhancedBom = article.bom.map((b: any) => {
        const mat = materials.find(m => m.material_code === b.material_code);
        return { ...b, category: mat ? (mat.category || 'Others') : 'Others' };
      });
      setBom(enhancedBom);
    } else {
      setBom([{ category: '', material_code: '' }]);
    }
    
    setIsFormModalOpen(true);
  };

  const openDuplicateForm = (article: any) => {
    openEditForm(article);
    setIsEditMode(false);
    setArticleCode(`${article.article_code}-COPY`);
  };

  const handleDelete = async (code: string) => {
    if (!confirm('Are you sure you want to delete this article?')) return;
    try {
      const hard = view === 'deleted' ? '&hard=true' : '';
      await fetch(`/api/pm/articles?code=${code}${hard}`, { method: 'DELETE' });
      fetchArticles();
    } catch (e) {
      console.error(e);
    }
  };

  const openViewModal = (article: any) => {
    setSelectedArticle(article);
    setIsViewModalOpen(true);
  };

  // ── Form Handlers ──────────────────────────────────────────────────────

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setImageBase64(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAddBomRow = () => {
    setBom([...bom, { category: '', material_code: '' }]);
  };

  const handleRemoveBomRow = (index: number) => {
    const newBom = [...bom];
    newBom.splice(index, 1);
    setBom(newBom);
  };

  const handleBomChange = (index: number, value: string) => {
    const newBom = [...bom];
    newBom[index].material_code = value;
    const mat = materials.find(m => m.material_code === value);
    if (mat) newBom[index].material_name = mat.material_name;
    setBom(newBom);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!articleCode) return alert('Article Code is required');
    
    const validBom = bom.filter(b => b.material_code);
    setSaving(true);
    try {
      const payload = {
        original_article_code: isEditMode ? originalCode : undefined,
        article_code: articleCode.toUpperCase(),
        article_name: articleName,
        description,
        colour,
        sizes,
        planned_price: plannedPrice,
        actual_price: actualPrice,
        image_base64: imageBase64,
        bom: validBom
      };

      const res = await fetch('/api/pm/articles', {
        method: isEditMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        setIsFormModalOpen(false);
        fetchArticles();
      } else {
        alert(data.error || 'Failed to save article');
      }
    } catch (err) {
      alert('Network Error');
    } finally {
      setSaving(false);
    }
  };

  // ── Material Library Handlers ──────────────────────────────────────────
  
  const handleCreateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatCode || !newMatName) return alert('Code and Name are required');
    setSaving(true);
    try {
      const res = await fetch('/api/po/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'material',
          material_code: newMatCode,
          material_name: newMatName,
          category: newMatCategory
        })
      });
      const data = await res.json();
      if (res.ok) {
        setIsMatFormOpen(false);
        setNewMatCode('');
        setNewMatName('');
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

  // ── Filters ───────────────────────────────────────────────────────────

  const filteredArticles = useMemo(() => {
    return articles.filter(a => {
      if (fCode && !a.article_code?.toLowerCase().includes(fCode.toLowerCase())) return false;
      if (fName && !a.article_name?.toLowerCase().includes(fName.toLowerCase())) return false;
      if (fColour && !a.colour?.toLowerCase().includes(fColour.toLowerCase())) return false;
      if (fSize && !a.sizes?.toLowerCase().includes(fSize.toLowerCase())) return false;
      if (fDate && !a.created_at?.includes(fDate)) return false;
      if (fMat) {
        const hasMat = a.bom?.some((b: any) => 
          b.material_code.toLowerCase().includes(fMat.toLowerCase()) || 
          b.material_name.toLowerCase().includes(fMat.toLowerCase())
        );
        if (!hasMat) return false;
      }
      return true;
    });
  }, [articles, fCode, fName, fColour, fSize, fMat, fDate]);

  const filteredMaterials = useMemo(() => {
    return materials.filter(m => (m.category || 'Others') === selectedMatCategory);
  }, [materials, selectedMatCategory]);


  // ── Renders ───────────────────────────────────────────────────────────

  if (view === 'costing') {
    return (
      <div className={styles.container} style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Cost Analysis</h2>
        <p style={{ color: '#64748b' }}>Module is under construction for advanced analytics.</p>
      </div>
    );
  }

  if (view === 'materials') {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.titleBox}>
            <h1>Material Library</h1>
            <p>Enterprise Raw Material Categorization & Management</p>
          </div>
          <button className={styles.btnPrimary} onClick={() => setIsMatFormOpen(true)}>
            <span style={{ fontSize: '16px' }}>+</span> Create Material
          </button>
        </header>

        {/* Category Tabs */}
        <div className={styles.tabsContainer}>
          {categories.map(cat => (
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
            <div key={mat.id} className={styles.materialCard}>
              <div className={styles.matCode}>{mat.material_code}</div>
              <div className={styles.matName}>{mat.material_name}</div>
              <div className={styles.matDate}>Added: {new Date(mat.created_at || Date.now()).toLocaleDateString()}</div>
            </div>
          ))}
          {filteredMaterials.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              No materials found in {selectedMatCategory}.
            </div>
          )}
        </div>

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
                      {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div className={styles.fieldGroup}>
                    <label>Material Code *</label>
                    <input required className={styles.input} placeholder="e.g. RXN-001" value={newMatCode} onChange={e => setNewMatCode(e.target.value)} />
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
      </div>
    );
  }

  // ── MANAGE ARTICLES VIEW ──
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleBox}>
          <h1>{view === 'deleted' ? 'Deleted Catalog' : 'Master Article Catalog'}</h1>
          <p>Enterprise Product Data & Material Mapping</p>
        </div>
        {view !== 'deleted' && (
          <button className={styles.btnPrimary} onClick={openCreateForm}>
            <span style={{ fontSize: '16px' }}>+</span> Create Article
          </button>
        )}
      </header>

      {/* Advanced Filter Bar */}
      <div className={styles.filterBar}>
        <input className={styles.filterInput} placeholder="Code..." value={fCode} onChange={e=>setFCode(e.target.value)} />
        <input className={styles.filterInput} placeholder="Name..." value={fName} onChange={e=>setFName(e.target.value)} />
        <input className={styles.filterInput} placeholder="Colour..." value={fColour} onChange={e=>setFColour(e.target.value)} />
        <input className={styles.filterInput} placeholder="Sizes..." value={fSize} onChange={e=>setFSize(e.target.value)} />
        <input className={styles.filterInput} placeholder="Material..." value={fMat} onChange={e=>setFMat(e.target.value)} />
        <input type="date" className={styles.filterInput} value={fDate} onChange={e=>setFDate(e.target.value)} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>Loading Catalog Data...</div>
      ) : (
        <div className={styles.grid}>
          {filteredArticles.map(article => (
            <div key={article.id} className={styles.card}>
              
              {/* Dropdown Operations */}
              <div className={styles.actionsMenu} onClick={(e) => e.stopPropagation()}>
                <button className={styles.menuBtn} onClick={() => setOpenDropdown(openDropdown === article.article_code ? null : article.article_code)}>⋮</button>
                {openDropdown === article.article_code && (
                  <div className={styles.dropdown}>
                    <button className={styles.dropdownItem} onClick={() => { openViewModal(article); setOpenDropdown(null); }}>👁️ View Details</button>
                    {view !== 'deleted' && <button className={styles.dropdownItem} onClick={() => { openEditForm(article); setOpenDropdown(null); }}>✏️ Edit</button>}
                    {view !== 'deleted' && <button className={styles.dropdownItem} onClick={() => { openDuplicateForm(article); setOpenDropdown(null); }}>📋 Duplicate</button>}
                    <button className={`${styles.dropdownItem} ${styles.delete}`} onClick={() => { handleDelete(article.article_code); setOpenDropdown(null); }}>🗑️ {view === 'deleted' ? 'Hard Delete' : 'Delete'}</button>
                  </div>
                )}
              </div>

              <div className={styles.imageBox} onClick={() => openViewModal(article)}>
                {article.image_base64 ? (
                  <img src={article.image_base64} alt={article.article_code} />
                ) : (
                  <div className={styles.noImage}>
                    <span style={{ fontSize: '28px' }}>📸</span>
                    <span>No Image Available</span>
                  </div>
                )}
              </div>

              <div className={styles.cardContent}>
                <div className={styles.cardHeader}>
                  <div>
                    <h3 className={styles.cardTitle}>{article.article_code}</h3>
                    <p className={styles.cardSub}>{article.article_name || 'Unnamed Article'}</p>
                  </div>
                </div>
                
                <div className={styles.metaGrid}>
                  <div className={styles.metaItem}><span className={styles.metaLabel}>Colour</span><span className={styles.metaValue}>{article.colour || '—'}</span></div>
                  <div className={styles.metaItem}><span className={styles.metaLabel}>Sizes</span><span className={styles.metaValue}>{article.sizes || '—'}</span></div>
                  <div className={styles.metaItem}><span className={styles.metaLabel}>Planned Cost</span><span className={styles.metaValue} style={{color: '#059669'}}>₹{article.planned_price || '0.00'}</span></div>
                  <div className={styles.metaItem}><span className={styles.metaLabel}>Actual Cost</span><span className={styles.metaValue} style={{color: '#dc2626'}}>₹{article.actual_price || '0.00'}</span></div>
                  <div className={styles.metaItem}><span className={styles.metaLabel}>Created</span><span className={styles.metaValue}>{new Date(article.created_at).toLocaleDateString()}</span></div>
                </div>
                
                <div className={styles.bomList}>
                  <div className={styles.bomTitle}>Materials Used <span>({article.bom?.length || 0})</span></div>
                  {article.bom?.slice(0, 3).map((b: any, idx: number) => (
                    <div key={idx} className={styles.bomItem}>
                      <span className={styles.bomMatCode}>{b.material_code}</span>
                      <span className={styles.bomMatName} title={b.material_name}>{b.material_name || ''}</span>
                    </div>
                  ))}
                  {article.bom?.length > 3 && (
                    <div style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>+{article.bom.length - 3} more items...</div>
                  )}
                  {!article.bom?.length && (
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '4px 0' }}>No materials mapped</div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {filteredArticles.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px', color: '#64748b', background: 'white', borderRadius: '20px', border: '1px dashed #cbd5e1' }}>
              No articles match your criteria.
            </div>
          )}
        </div>
      )}

      {/* ── CREATE / EDIT FORM MODAL ── */}
      {isFormModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsFormModalOpen(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{isEditMode ? 'Edit Article' : 'Create Article'}</h2>
              <button className={styles.closeBtn} onClick={() => setIsFormModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className={styles.modalBody}>
                
                <div className={styles.formGrid}>
                  <div className={styles.fieldGroup}>
                    <label>Article Code *</label>
                    <input required className={styles.input} placeholder="e.g. LUNAR-X1" value={articleCode} onChange={e => setArticleCode(e.target.value)} />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label>Article Name</label>
                    <input className={styles.input} placeholder="Product name..." value={articleName} onChange={e => setArticleName(e.target.value)} />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label>Colour</label>
                    <input className={styles.input} placeholder="e.g. Olive Green" value={colour} onChange={e => setColour(e.target.value)} />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label>Sizes Planned</label>
                    <input className={styles.input} placeholder="e.g. 6-10" value={sizes} onChange={e => setSizes(e.target.value)} />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label>Planned Cost (₹)</label>
                    <input type="number" step="0.01" className={styles.input} placeholder="0.00" value={plannedPrice} onChange={e => setPlannedPrice(e.target.value)} />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label>Actual Cost (₹)</label>
                    <input type="number" step="0.01" className={styles.input} placeholder="0.00" value={actualPrice} onChange={e => setActualPrice(e.target.value)} />
                  </div>
                </div>
                
                <div className={styles.fieldGroup}>
                  <label>Description</label>
                  <textarea className={styles.input} rows={2} placeholder="Notes..." value={description} onChange={e => setDescription(e.target.value)} />
                </div>

                <div className={styles.fieldGroup}>
                  <label>Full Sandal Preview Image</label>
                  <label className={styles.imageUploadBox}>
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
                    {imageBase64 ? (
                      <img src={imageBase64} alt="Preview" className={styles.previewImage} />
                    ) : (
                      <div style={{ color: '#64748b', fontSize: '14px', fontWeight: 600 }}>
                        <span style={{ fontSize: '32px', display: 'block', marginBottom: '12px' }}>📤</span>
                        Click to upload product photo
                      </div>
                    )}
                  </label>
                </div>

                <div className={styles.fieldGroup}>
                  <label>Materials Used Mapping</label>
                  <div className={styles.bomBuilder}>
                    {bom.map((row, index) => {
                      // Filter materials based on the selected category for this row
                      const availableMaterials = row.category 
                        ? materials.filter(m => (m.category || 'Others') === row.category)
                        : [];

                      return (
                        <div key={index} className={styles.bomRowInteractive}>
                          <div className={styles.bomSelectWrapper}>
                            <select 
                              className={styles.bomSelect} 
                              value={row.category || ''} 
                              onChange={e => {
                                const newBom = [...bom];
                                newBom[index].category = e.target.value;
                                newBom[index].material_code = ''; // Reset material when category changes
                                setBom(newBom);
                              }}
                            >
                              <option value="">Choose Category...</option>
                              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                          </div>
                          
                          <div className={styles.bomSelectWrapper}>
                            <select 
                              className={styles.bomSelect} 
                              value={row.material_code || ''} 
                              onChange={e => handleBomChange(index, e.target.value)}
                              disabled={!row.category}
                            >
                              <option value="">
                                {!row.category ? 'Select a Category first' : `Choose ${row.category}...`}
                              </option>
                              {availableMaterials.map(m => (
                                <option key={m.material_code} value={m.material_code}>
                                  {m.material_name} ({m.material_code})
                                </option>
                              ))}
                            </select>
                          </div>

                          <button type="button" className={styles.bomRemoveBtn} onClick={() => handleRemoveBomRow(index)} title="Remove Material">✖</button>
                        </div>
                      );
                    })}
                    <button type="button" className={styles.addBomBtnInteractive} onClick={handleAddBomRow}>
                      <span className={styles.addBomIcon}>+</span> Map Another Material
                    </button>
                  </div>
                </div>

              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnPrimary} style={{ background: 'white', color: '#0f172a', border: '1px solid #cbd5e1' }} onClick={() => setIsFormModalOpen(false)}>Cancel</button>
                <button type="submit" className={styles.btnPrimary} disabled={saving}>{saving ? 'Saving...' : 'Save Article'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── FULL VIEW DETAILS MODAL ── */}
      {isViewModalOpen && selectedArticle && (
        <div className={styles.modalOverlay} onClick={() => setIsViewModalOpen(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '1000px' }}>
            <div className={styles.modalHeader}>
              <div>
                <h2>{selectedArticle.article_code}</h2>
                <div style={{ color: '#64748b', marginTop: '4px', fontSize: '16px' }}>{selectedArticle.article_name || 'Unnamed Article'}</div>
              </div>
              <button className={styles.closeBtn} onClick={() => setIsViewModalOpen(false)}>×</button>
            </div>
            <div className={styles.modalBody} style={{ padding: '32px' }}>
              <div className={styles.viewerContainer}>
                
                {/* Hero Image Section */}
                <div className={styles.viewerImageHero}>
                  {selectedArticle.image_base64 ? (
                    <img src={selectedArticle.image_base64} alt={selectedArticle.article_code} />
                  ) : (
                    <div style={{ padding: '100px', background: '#f1f5f9', borderRadius: '16px', textAlign: 'center', color: '#94a3b8' }}>
                      <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>📸</span>
                      No image available
                    </div>
                  )}
                </div>

                <div className={styles.viewerGrid}>
                  
                  {/* Left Column: Details */}
                  <div className={styles.viewerDetails}>
                    <h3 className={styles.sectionTitle}>Product Details</h3>
                    <div className={styles.viewerMetaGrid}>
                      <div><div className={styles.metaLabel}>Colour</div><div className={styles.viewerMetaValue}>{selectedArticle.colour || 'N/A'}</div></div>
                      <div><div className={styles.metaLabel}>Sizes</div><div className={styles.viewerMetaValue}>{selectedArticle.sizes || 'N/A'}</div></div>
                      <div><div className={styles.metaLabel}>Created Date</div><div className={styles.viewerMetaValue}>{new Date(selectedArticle.created_at).toLocaleDateString()}</div></div>
                      <div><div className={styles.metaLabel}>Status</div><div className={styles.viewerMetaValue}>{selectedArticle.status || 'Active'}</div></div>
                    </div>

                    <h3 className={styles.sectionTitle} style={{ marginTop: '24px' }}>Costing Summary</h3>
                    <div className={styles.viewerMetaGrid}>
                      <div><div className={styles.metaLabel}>Planned Cost</div><div className={styles.viewerMetaValue} style={{color: '#059669'}}>₹{selectedArticle.planned_price || '0.00'}</div></div>
                      <div><div className={styles.metaLabel}>Actual Cost</div><div className={styles.viewerMetaValue} style={{color: '#dc2626'}}>₹{selectedArticle.actual_price || '0.00'}</div></div>
                    </div>

                    {selectedArticle.description && (
                      <div style={{ marginTop: '24px' }}>
                        <div className={styles.metaLabel}>Description</div>
                        <p style={{ margin: '8px 0 0 0', color: '#475569', lineHeight: '1.6' }}>{selectedArticle.description}</p>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Material Mapping */}
                  <div className={styles.viewerMaterials}>
                    <h3 className={styles.sectionTitle}>Materials Used</h3>
                    <div className={styles.viewerBomList}>
                      {selectedArticle.bom?.map((b: any, idx: number) => (
                        <div key={idx} className={styles.viewerBomItem}>
                          <span className={styles.bomMatCode} style={{ minWidth: '100px', color: '#64748b' }}>{b.material_code}</span>
                          <span className={styles.bomMatNameFull}>{b.material_name}</span>
                        </div>
                      ))}
                      {!selectedArticle.bom?.length && (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px' }}>
                          No materials mapped to this article.
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
