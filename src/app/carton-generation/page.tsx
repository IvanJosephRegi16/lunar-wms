'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

function SearchableDropdown({ options, value, onChange, placeholder }: { options: {value: string, label: string}[], value: string, onChange: (val: string) => void, placeholder: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  const selectedOption = options.find(o => o.value === value);
  const filteredOptions = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <div 
      style={{ position: 'relative', width: '100%' }}
      tabIndex={0}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsOpen(false);
        }
      }}
    >
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{ padding: '10px 14px', border: '2px solid #cbd5e1', borderRadius: '10px', background: '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', fontWeight: 500 }}
      >
        <span style={{ color: selectedOption ? '#0f172a' : '#64748b' }}>{selectedOption ? selectedOption.label : placeholder}</span>
        <span style={{ fontSize: '12px', color: '#64748b' }}>▼</span>
      </div>
      {isOpen && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#fff', border: '2px solid #cbd5e1', borderRadius: '10px', marginTop: '4px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', maxHeight: '300px', display: 'flex', flexDirection: 'column' }}>
          <input 
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            style={{ padding: '12px 14px', border: 'none', borderBottom: '1px solid #e2e8f0', outline: 'none', fontSize: '14px', borderRadius: '10px 10px 0 0' }}
            onClick={e => e.stopPropagation()}
            autoFocus
          />
          <div style={{ overflowY: 'auto' }}>
            {filteredOptions.length > 0 ? filteredOptions.map(o => (
              <div 
                key={o.value}
                onClick={() => { onChange(o.value); setIsOpen(false); setSearch(''); }}
                style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '14px', color: '#334155' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {o.label}
              </div>
            )) : <div style={{ padding: '10px 14px', color: '#94a3b8', fontSize: '14px', textAlign: 'center' }}>No results found</div>}
          </div>
        </div>
      )}
    </div>
  );
}

interface Config {
  id: number;
  name: string;
  total_pairs: number;
  sizes: Record<string, number>;
  is_custom: number;
}

interface PoolItem {
  id: number;
  article_code: string;
  colour: string;
  size_5: number;
  size_6: number;
  size_7: number;
  size_8: number;
  size_9: number;
  size_10: number;
  size_11: number;
  size_12: number;
  total_qty: number;
}

export default function CartonGenerationPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'generate' | 'rules'>('generate');
  const [configs, setConfigs] = useState<Config[]>([]);
  const [pool, setPool] = useState<PoolItem[]>([]);
  const [loading, setLoading] = useState(true);

  const handleStartScanOutward = async () => {
    if (!activeConfigId || !activePoolId) {
      alert("Please select a Staging Pool Item and Master Configuration Rule first.");
      return;
    }

    const activePool = pool.find(p => p.id.toString() === activePoolId);
    if (!activePool) return;
    
    setIsGenerating(true);
    try {
      const res = await fetch('/api/packing/outward/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          carton_generation_id: activeConfigId,
          article_code: activePool.article_code,
          colour: activePool.colour
        })
      });
      const data = await res.json();
      if (res.ok) {
        router.push(`/packing/scan-outward?session_id=${data.session_id}`);
      } else {
        alert(data.error || 'Failed to start scan session');
      }
    } catch (err) {
      console.error(err);
      alert('Error starting scan session');
    } finally {
      setIsGenerating(false);
    }
  };

  // Carton Generation Form State
  const [activeConfigId, setActiveConfigId] = useState<string>('');
  const [activePoolId, setActivePoolId] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Rule Builder Form State (Edit / Create)
  const [editMode, setEditMode] = useState(false);
  const [editConfigId, setEditConfigId] = useState<number | null>(null);
  const [newRuleName, setNewRuleName] = useState('');
  const [sizeInputs, setSizeInputs] = useState<Record<string, number>>({
    '5': 0, '6': 0, '7': 0, '8': 0, '9': 0, '10': 0, '11': 0, '12': 0
  });
  const [isSavingRule, setIsSavingRule] = useState(false);

  // Search & Sort State (Simplified)
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('default');

  const fetchInitialData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/packing/configs').then(r => r.json()),
      fetch('/api/inventory-pool').then(r => r.json())
    ]).then(([confData, poolData]) => {
      if (confData.configs) setConfigs(confData.configs);
      if (poolData.inventory) setPool(poolData.inventory);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const activeConfig = configs.find(c => c.id.toString() === activeConfigId);
  const activePool = pool.find(p => p.id.toString() === activePoolId);

  const calculateMaxCartons = () => {
    if (!activeConfig || !activePool) return 0;
    
    let max = Infinity;
    for (const [size, reqQty] of Object.entries(activeConfig.sizes)) {
      if (reqQty === 0) continue;
      const available = activePool[`size_${size}` as keyof PoolItem] as number || 0;
      const possibleForThisSize = Math.floor(available / (reqQty as number));
      if (possibleForThisSize < max) max = possibleForThisSize;
    }
    return max === Infinity ? 0 : max;
  };

  const maxPossible = calculateMaxCartons();

  // Removed auto generate handling

  // Rule Builder Helpers
  const handleSizeInputChange = (size: string, val: string) => {
    const num = parseInt(val) || 0;
    setSizeInputs(prev => ({
      ...prev,
      [size]: Math.max(0, num)
    }));
  };

  const totalRulePairs = Object.values(sizeInputs).reduce((acc, curr) => acc + curr, 0);

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim()) {
      alert('Please provide a Configuration Rule Name.');
      return;
    }
    if (totalRulePairs <= 0) {
      alert('A Carton Configuration Rule must contain at least 1 pair.');
      return;
    }

    setIsSavingRule(true);
    try {
      const url = '/api/packing/configs';
      const method = editMode ? 'PUT' : 'POST';
      const body = {
        id: editConfigId,
        name: newRuleName.trim(),
        total_pairs: totalRulePairs,
        sizes: sizeInputs
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      if (res.ok) {
        alert(editMode ? 'Master Configuration Rule successfully updated!' : 'Master Configuration Rule successfully created!');
        resetRuleForm();
        // Refetch configs
        const confRes = await fetch('/api/packing/configs').then(r => r.json());
        if (confRes.configs) {
          setConfigs(confRes.configs);
          // Auto-select new rule and switch to generate tab
          if (!editMode && data.configId) {
            setActiveConfigId(String(data.configId));
            setActiveTab('generate');
          }
        }
      } else {
        alert(data.error || 'Failed to save configuration rule');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred while saving rule');
    } finally {
      setIsSavingRule(false);
    }
  };

  const handleStartEdit = (config: Config) => {
    setEditMode(true);
    setEditConfigId(config.id);
    setNewRuleName(config.name);
    
    const sizeMap = { '5': 0, '6': 0, '7': 0, '8': 0, '9': 0, '10': 0, '11': 0, '12': 0 };
    Object.entries(config.sizes).forEach(([sz, qty]) => {
      sizeMap[sz as keyof typeof sizeMap] = qty;
    });
    setSizeInputs(sizeMap);
    
    // Smooth scroll up to form card
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  const resetRuleForm = () => {
    setEditMode(false);
    setEditConfigId(null);
    setNewRuleName('');
    setSizeInputs({
      '5': 0, '6': 0, '7': 0, '8': 0, '9': 0, '10': 0, '11': 0, '12': 0
    });
  };

  const handleDeleteRule = async (id: number) => {
    if (!confirm('Are you sure you want to delete this configuration rule?')) return;

    try {
      const res = await fetch(`/api/packing/configs?id=${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        alert('Configuration rule deleted.');
        // Refetch configs
        const confRes = await fetch('/api/packing/configs').then(r => r.json());
        if (confRes.configs) setConfigs(confRes.configs);
        if (editConfigId === id) resetRuleForm();
      } else {
        alert(data.error || 'Failed to delete config');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting config');
    }
  };

  // Live client-side searching & sorting logic
  const filteredAndSortedConfigs = configs
    .filter(config => {
      return config.name.toLowerCase().includes(searchTerm.toLowerCase());
    })
    .sort((a, b) => {
      if (sortBy === 'name-asc') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'name-desc') {
        return b.name.localeCompare(a.name);
      }
      if (sortBy === 'pairs-desc') {
        return b.total_pairs - a.total_pairs;
      }
      if (sortBy === 'pairs-asc') {
        return a.total_pairs - b.total_pairs;
      }
      return 0; // Default ordering
    });

  return (
    <div className={styles.container}>
      {/* 1. Header Control Panel */}
      <div className={styles.header}>
        <div className={styles.titleSection} style={{ marginBottom: '12px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>Master Carton Configuration Control</h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-ghost)', fontSize: '14px' }}>
            Define packaging rules and compile loose staging pool stock into physical outward cartons.
          </p>
        </div>

        {/* TABS CONTAINER */}
        <div className={styles.tabsContainer}>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'generate' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('generate')}
          >
            📦 Carton Generation
          </button>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'rules' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('rules')}
          >
            ⚙️ Master Rules Builder
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', background: 'white', borderRadius: '16px', border: '1px solid var(--border)', color: '#94a3b8' }}>
          Loading control panel modules...
        </div>
      ) : activeTab === 'generate' ? (
        /* TAB 1: CARTON GENERATION */
        <div className={styles.mainGrid}>
          <div className={styles.selectionPanel}>
            <h2>1. Select Pool & Rule</h2>
            
            <div className={styles.formGroup}>
              <label>Select Staging Pool Item (Article + Colour)</label>
              <SearchableDropdown
                options={pool.map(p => ({
                  value: p.id.toString(),
                  label: `${p.article_code} - ${p.colour} (${p.total_qty} total loose pairs)`
                }))}
                value={activePoolId}
                onChange={setActivePoolId}
                placeholder="-- Select Inventory Pool --"
              />
            </div>

            <div className={styles.formGroup}>
              <label>Select Master Configuration Rule</label>
              <SearchableDropdown
                options={configs.map(c => ({
                  value: c.id.toString(),
                  label: `${c.name} (${c.total_pairs} pairs/carton)`
                }))}
                value={activeConfigId}
                onChange={setActiveConfigId}
                placeholder="-- Select Rule --"
              />
            </div>

            {/* Removed AI Feasibility Advisor */}

            {activeConfig && activePool && (
              <div className={styles.generationBox} style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    className={styles.generateBtn}
                    onClick={handleStartScanOutward}
                    disabled={isGenerating}
                    style={{ width: '100%', background: 'var(--neon-violet)', border: 'none', color: 'white', padding: '16px', fontSize: '16px' }}
                  >
                    🔍 Start Scan Outward
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className={styles.previewPanel}>
            <h2>Live Generation Preview</h2>
            {!activeConfig || !activePool ? (
              <div className={styles.emptyPreview}>Select a pool and rule to see feasibility preview.</div>
            ) : (
              <>
                <table className={styles.previewTable}>
                  <thead>
                    <tr>
                      <th>Size</th>
                      <th>Required / Carton</th>
                      <th>Available Pool</th>
                      <th>Remaining Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['5','6','7','8','9','10','11','12'].map(size => {
                      const reqPerCarton = activeConfig.sizes[size] as number || 0;
                      if (reqPerCarton === 0) return null;
                      
                      const totalReq = reqPerCarton; // cartonsToGenerate is fixed to 1
                      const available = activePool[`size_${size}` as keyof PoolItem] as number || 0;
                      const remaining = available - totalReq;
                      const isShort = remaining < 0;

                      return (
                        <tr key={size} className={isShort ? styles.rowShort : ''}>
                          <td><strong>{size}</strong></td>
                          <td>{reqPerCarton}</td>
                          <td>{available}</td>
                          <td className={isShort ? styles.shortText : styles.safeText}>{remaining}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className={styles.statsSummary}>
                  <div className={styles.statBox}>
                    <span>Total Pairs Consumed</span>
                    <strong>{activeConfig.total_pairs}</strong>
                  </div>
                  <div className={styles.statBox}>
                    <span>Pool Pairs Remaining</span>
                    <strong>{activePool.total_qty - activeConfig.total_pairs}</strong>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* TAB 2: MASTER RULES BUILDER - VERTI-STACK LAYOUT */
        <div className={styles.vertiStack}>
          
          {/* TOP CARD: CREATE OR EDIT MASTER RULE FORM */}
          <div className={styles.builderCard}>
            <h2>{editMode ? '⚙️ Edit Master Configuration Rule' : '➕ Create New Master Configuration Rule'}</h2>
            <form onSubmit={handleSaveRule} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Form Input Row (Only Rule Name) */}
              <div className={styles.formGroup}>
                <label>Rule Name (e.g. 10 Pairs Standard)</label>
                <input 
                  type="text" 
                  placeholder="Enter unique rule name..." 
                  value={newRuleName} 
                  onChange={e => setNewRuleName(e.target.value)}
                  required
                />
              </div>

              {/* Size Distributions */}
              <div className={styles.formGroup}>
                <label>Size Distributions (Pairs)</label>
                <div className={styles.sizeInputsGrid}>
                  {['5','6','7','8','9','10','11','12'].map(size => (
                    <div key={size} className={styles.sizeInputBox}>
                      <label>Size {size}</label>
                      <input 
                        type="number" 
                        min="0"
                        value={sizeInputs[size] || ''} 
                        onChange={e => handleSizeInputChange(size, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom controls */}
              <div className={styles.builderBottom}>
                <div className={styles.builderTotalBox}>
                  <div className={styles.builderTotalLabel}>Total:</div>
                  <div className={styles.builderTotalVal}>{totalRulePairs} Pair{totalRulePairs !== 1 ? 's' : ''}</div>
                </div>

                <div className={styles.actionBtns}>
                  {editMode && (
                    <button 
                      type="button" 
                      className={styles.cancelBtn} 
                      onClick={resetRuleForm}
                    >
                      ❌ Cancel Edit
                    </button>
                  )}
                  <button 
                    type="submit" 
                    className={styles.saveBtn} 
                    disabled={isSavingRule || totalRulePairs <= 0}
                  >
                    {isSavingRule ? 'Saving Rule...' : editMode ? '💾 Update Master Configuration Rule' : '➕ Save Master Configuration Rule'}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* BOTTOM CARD: MASTER RULE FILTERING & ACTIVE MATRIX */}
          <div className={styles.builderCard}>
            <h2>Active Master Rules Matrix</h2>

            {/* SEARCH & SORT PANEL */}
            <div className={styles.filterPanel}>
              
              <div className={styles.filterGroup}>
                <label>🔍 Search Rule Name</label>
                <input 
                  type="text" 
                  className={styles.filterInput}
                  placeholder="Type rule name to filter..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>

              <div className={styles.filterGroup} style={{ flex: 'initial' }}>
                <label>🔃 Sort By</label>
                <select 
                  className={styles.filterSelect}
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                >
                  <option value="default">Default Order</option>
                  <option value="name-asc">Rule Name (A-Z)</option>
                  <option value="name-desc">Rule Name (Z-A)</option>
                  <option value="pairs-desc">Total Pairs (High to Low)</option>
                  <option value="pairs-asc">Total Pairs (Low to High)</option>
                </select>
              </div>

            </div>

            {/* SPREADSHEET RULES MATRIX TABLE */}
            <div style={{ overflowX: 'auto' }}>
              <table className={styles.rulesTable}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Rule Name</th>
                    {['5','6','7','8','9','10','11','12'].map(sz => (
                      <th key={sz} className={styles.sizeCol}>Size {sz}</th>
                    ))}
                    <th className={styles.sizeCol} style={{ fontWeight: '800' }}>Total Pairs</th>
                    <th style={{ textAlign: 'center', width: '180px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedConfigs.map(c => (
                    <tr key={c.id}>
                      <td style={{ textAlign: 'left' }}><strong>{c.name}</strong></td>
                      {['5','6','7','8','9','10','11','12'].map(sz => {
                        const qty = c.sizes[sz] || 0;
                        return (
                          <td key={sz} className={styles.sizeCol}>
                            {qty > 0 ? (
                              <span className={styles.sizeValActive}>{qty}</span>
                            ) : (
                              <span className={styles.sizeValEmpty}>-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className={styles.sizeCol} style={{ fontWeight: '900', color: 'var(--text-main)', fontSize: '15px' }}>
                        {c.total_pairs} prs
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <button 
                            className={styles.editBtn}
                            onClick={() => handleStartEdit(c)}
                          >
                            ✏️ Edit
                          </button>
                          <button 
                            className={styles.deleteBtn}
                            onClick={() => handleDeleteRule(c.id)}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredAndSortedConfigs.length === 0 && (
                    <tr>
                      <td colSpan={11} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-ghost)' }}>
                        No master configuration rules match your active search name.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}
