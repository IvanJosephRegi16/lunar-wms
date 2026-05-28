'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styles from './page.module.css';

interface Employee {
  id: number;
  emp_code: string;
  name: string;
  unit?: string;
  punch_code?: string;
}

interface AttendanceRecord {
  status: string;
  is_dirty?: boolean;
}

// Strictly Memoized Cell to prevent full matrix re-renders
const Cell = React.memo(({ empId, dateStr, value, cellData, onChange, onKeyDown, onDoubleClick }: {
  empId: number, dateStr: string, value: string, cellData: any, onChange: any, onKeyDown: any, onDoubleClick: any
}) => {
  const otDisplay = cellData?.ot_minutes_total > 0 
    ? `${Math.floor(cellData.ot_minutes_total / 60)}h ${cellData.ot_minutes_total % 60}m`
    : cellData?.ot_hours > 0 ? `${cellData.ot_hours}h` : '';

  return (
    <td key={dateStr}>
      <input
        type="text"
        className={`${styles.cellInput} ${styles[`status_${value}`] || ''}`}
        value={value}
        onChange={(e) => onChange(empId, dateStr, e.target.value.toUpperCase())}
        onKeyDown={(e) => onKeyDown(e, empId, dateStr)}
        onDoubleClick={(e) => onDoubleClick(empId, dateStr, cellData)}
        title={otDisplay ? `OT: ${otDisplay}` : ''}
        style={{ borderBottom: otDisplay ? '2px solid #3b82f6' : undefined }}
        data-emp={empId}
        data-date={dateStr}
        maxLength={2}
      />
    </td>
  );
}, (prev, next) => prev.value === next.value && prev.cellData?.ot_minutes_total === next.cellData?.ot_minutes_total && prev.cellData?.ot_hours === next.cellData?.ot_hours && prev.cellData?.late_minutes === next.cellData?.late_minutes && prev.cellData?.early_exit_minutes === next.cellData?.early_exit_minutes && prev.cellData?.remarks === next.cellData?.remarks);
Cell.displayName = 'Cell';

export default function AttendanceMatrixPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  // Store matrix state as a dictionary mapping: empId -> { dateStr: status }
  const [matrix, setMatrix] = useState<Record<number, Record<string, any>>>({});
  const [dirtyQueue, setDirtyQueue] = useState<any[]>([]);
  
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Manual Detail Edit Modal
  const [editModal, setEditModal] = useState<any>(null);

  const [unitFilter, setUnitFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Generate date columns based on selected month
  const daysInMonth = useMemo(() => {
    if (!currentMonth) return [];
    const [year, month] = currentMonth.split('-');
    const daysCount = new Date(parseInt(year), parseInt(month), 0).getDate();
    return Array.from({ length: daysCount }, (_, i) => String(i + 1).padStart(2, '0'));
  }, [currentMonth]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hr/attendance?month=${currentMonth}`);
      const data = await res.json();
      
      setEmployees(data.employees || []);
      
      // Map API matrix (which contains full objects) to our flat string matrix state
      const flatMatrix: Record<number, Record<string, any>> = {};
      data.employees?.forEach((emp: any) => {
        flatMatrix[emp.id] = {};
        daysInMonth.forEach(day => {
          const dateStr = `${currentMonth}-${day}`;
          const existing = data.matrix[emp.id]?.[dateStr];
          flatMatrix[emp.id][dateStr] = existing ? { status: existing.status, ot_hours: existing.ot_hours || 0, ot_minutes_total: existing.ot_minutes_total || 0, late_minutes: existing.late_minutes || 0, early_exit_minutes: existing.early_exit_minutes || 0, remarks: existing.remarks || '' } : { status: '' };
        });
      });
      
      setMatrix(flatMatrix);
      setDirtyQueue([]);
    } catch (err) {
      alert('Failed to load matrix');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentMonth, daysInMonth]); // eslint-disable-line react-hooks/exhaustive-deps

    // Cell Change Handler (Fast Updates)
  const handleCellChange = useCallback((empId: number, dateStr: string, newValue: string, extraData?: any) => {
    const validStatuses = ['P', 'A', 'WO', 'HL', 'OT', 'CL', 'SL', 'HD', ''];
    if (!validStatuses.includes(newValue) && newValue !== '') return;

    setMatrix(prev => {
      const existingCell = prev[empId]?.[dateStr] || { status: '' };
      return {
        ...prev,
        [empId]: {
          ...prev[empId],
          [dateStr]: { ...existingCell, status: newValue, ...(extraData || {}) }
        }
      };
    });

    setDirtyQueue(prev => {
      const existing = prev.findIndex(q => q.emp_id === empId && q.date === dateStr);
      if (existing > -1) {
        const newQ = [...prev];
        newQ[existing] = { ...newQ[existing], status: newValue, ...(extraData || {}) };
        return newQ;
      }
      return [...prev, { emp_id: empId, date: dateStr, status: newValue, ...(extraData || {}) }];
    });
  }, []);

  const handleCellDoubleClick = useCallback((empId: number, dateStr: string, cellData: any) => {
    const emp = employees.find(e => e.id === empId);
    setEditModal({ empId, dateStr, empName: emp?.name, data: { ...cellData } });
  }, [employees]);


  // Keyboard DOM Navigation Engine
  const handleKeyDown = useCallback((e: React.KeyboardEvent, empId: number, dateStr: string) => {
    const target = e.target as HTMLInputElement;
    const isArrow = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key);
    
    // Quick Status Hotkeys (without needing to press enter)
    const hotkeys: Record<string, string> = {
      'p': 'P', 'a': 'A', 'w': 'WO', 'h': 'HL', 'o': 'OT', 'c': 'CL', 's': 'SL', 'd': 'HD'
    };

    if (hotkeys[e.key.toLowerCase()] && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      handleCellChange(empId, dateStr, hotkeys[e.key.toLowerCase()]);
      // Auto-advance down
      focusCell(empId, dateStr, 'ArrowDown');
      return;
    }

    if (isArrow) {
      e.preventDefault();
      focusCell(empId, dateStr, e.key);
    }
  }, [handleCellChange]);

  const focusCell = (empId: number, dateStr: string, direction: string) => {
    const empIndex = employees.findIndex(e => e.id === empId);
    const dateIndex = daysInMonth.indexOf(dateStr.split('-')[2]);
    
    let nextEmpIndex = empIndex;
    let nextDateIndex = dateIndex;

    if (direction === 'ArrowUp') nextEmpIndex = Math.max(0, empIndex - 1);
    if (direction === 'ArrowDown' || direction === 'Enter') nextEmpIndex = Math.min(employees.length - 1, empIndex + 1);
    if (direction === 'ArrowLeft') nextDateIndex = Math.max(0, dateIndex - 1);
    if (direction === 'ArrowRight') nextDateIndex = Math.min(daysInMonth.length - 1, dateIndex + 1);

    const nextEmp = employees[nextEmpIndex];
    const nextDate = `${currentMonth}-${daysInMonth[nextDateIndex]}`;
    
    const nextInput = document.querySelector(`input[data-emp="${nextEmp?.id}"][data-date="${nextDate}"]`) as HTMLInputElement;
    if (nextInput) {
      nextInput.focus();
      nextInput.select();
    }
  };

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchUnit = unitFilter === 'all' || emp.unit === unitFilter;
      const matchSearch = emp.punch_code?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          emp.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchUnit && matchSearch;
    });
  }, [employees, unitFilter, searchQuery]);

  const markAllPresent = () => {
    if (!confirm('Mark all empty/unmarked cells as Present (P) for the currently filtered employees?')) return;
    
    let updates = 0;
    setMatrix(prev => {
      const next = { ...prev };
      filteredEmployees.forEach(emp => {
        daysInMonth.forEach(day => {
          const dateStr = `${currentMonth}-${day}`;
          if (!next[emp.id]) next[emp.id] = {};
          
          const currentVal = next[emp.id][dateStr];
          if (!currentVal || currentVal === 'A') { // Convert empty and Absent to Present
            next[emp.id] = { ...next[emp.id], [dateStr]: 'P' };
            
            // Queue for save
            setDirtyQueue(q => {
              const existing = q.findIndex(i => i.emp_id === emp.id && i.date === dateStr);
              if (existing > -1) {
                const nq = [...q];
                nq[existing] = { emp_id: emp.id, date: dateStr, status: 'P' };
                return nq;
              }
              return [...q, { emp_id: emp.id, date: dateStr, status: 'P' }];
            });
            updates++;
          }
        });
      });
      return next;
    });
  };

  const copyPreviousDay = () => {
    const dayToCopyStr = prompt("Enter the DAY number to copy FROM (e.g. 05):");
    if (!dayToCopyStr) return;
    const targetDayStr = prompt(`Enter the DAY number to paste TO (e.g. ${String(parseInt(dayToCopyStr)+1).padStart(2,'0')}):`);
    if (!targetDayStr) return;

    const dayFrom = `${currentMonth}-${dayToCopyStr.padStart(2, '0')}`;
    const dayTo = `${currentMonth}-${targetDayStr.padStart(2, '0')}`;

    let updates = 0;
    setMatrix(prev => {
      const next = { ...prev };
      filteredEmployees.forEach(emp => {
        const valToCopy = prev[emp.id]?.[dayFrom];
        if (valToCopy) {
          if (!next[emp.id]) next[emp.id] = {};
          next[emp.id] = { ...next[emp.id], [dayTo]: valToCopy };
          
          setDirtyQueue(q => {
            const existing = q.findIndex(i => i.emp_id === emp.id && i.date === dayTo);
            if (existing > -1) {
              const nq = [...q];
              nq[existing] = { emp_id: emp.id, date: dayTo, status: valToCopy };
              return nq;
            }
            return [...q, { emp_id: emp.id, date: dayTo, status: valToCopy }];
          });
          updates++;
        }
      });
      return next;
    });
  };

  const handleSave = async () => {
    if (dirtyQueue.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch('/api/hr/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: currentMonth, updates: dirtyQueue })
      });
      const data = await res.json();
      if (data.success) {
        setDirtyQueue([]);
      } else {
        alert('Failed to save batch: ' + data.error);
      }
    } catch (e) {
      alert('Network error while saving attendance.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>Attendance Matrix Engine</h1>
          <p>Industrial High-Speed Workforce Operations</p>
        </div>
        <div className={styles.controls}>
          <input
            type="text"
            placeholder="Search Name or Punch Code..."
            className={styles.monthPicker}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '180px' }}
          />
          <select 
            className={styles.monthPicker} 
            value={unitFilter} 
            onChange={e => setUnitFilter(e.target.value)}
          >
            <option value="all">All Units</option>
            <option value="Unit 1">Unit 1</option>
            <option value="Unit 2">Unit 2</option>
          </select>
          <input 
            type="month" 
            className={styles.monthPicker} 
            value={currentMonth} 
            onChange={e => setCurrentMonth(e.target.value)}
          />
          <button 
            className={styles.saveBtn} 
            onClick={copyPreviousDay} 
            disabled={employees.length === 0 || loading}
            style={{ background: '#334155' }}
          >
            📋 Copy Day
          </button>
          <button 
            className={styles.saveBtn} 
            onClick={markAllPresent} 
            disabled={employees.length === 0 || loading}
            style={{ background: '#0f172a' }}
          >
            ⚡ Bulk Mark Present
          </button>
          <button 
            className={styles.saveBtn} 
            onClick={handleSave} 
            disabled={dirtyQueue.length === 0 || saving}
          >
            {saving ? 'Saving...' : `💾 Sync ${dirtyQueue.length} Updates`}
          </button>
        </div>
      </div>

      {editModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '16px', width: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 16px 0' }}>Manual Entry Details</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text-ghost)' }}>
              <strong>{editModal.empName}</strong> • {editModal.dateStr}
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>OT (Hours)</label>
                  <input 
                    type="number" 
                    min="0"
                    style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '6px' }}
                    value={editModal.data.ot_h || Math.floor((editModal.data.ot_minutes_total || 0) / 60) || ''}
                    onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, ot_h: parseInt(e.target.value) || 0 } })}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>OT (Minutes)</label>
                  <input 
                    type="number" 
                    min="0"
                    max="59"
                    style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '6px' }}
                    value={(editModal.data.ot_m ?? ((editModal.data.ot_minutes_total || 0) % 60)) || ''}
                    onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, ot_m: parseInt(e.target.value) || 0 } })}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Late (Minutes)</label>
                <input 
                  type="number" 
                  style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '6px' }}
                  value={editModal.data.late_minutes || ''}
                  onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, late_minutes: parseInt(e.target.value) || 0 } })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Early Exit (Minutes)</label>
                <input 
                  type="number" 
                  style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '6px' }}
                  value={editModal.data.early_exit_minutes || ''}
                  onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, early_exit_minutes: parseInt(e.target.value) || 0 } })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Remarks</label>
                <input 
                  type="text" 
                  style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '6px' }}
                  value={editModal.data.remarks || ''}
                  onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, remarks: e.target.value } })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
              <button onClick={() => setEditModal(null)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #ccc', background: 'white', cursor: 'pointer' }}>Cancel</button>
              <button 
                onClick={() => {
                  const h = editModal.data.ot_h ?? Math.floor((editModal.data.ot_minutes_total || 0) / 60);
                  const m = editModal.data.ot_m ?? ((editModal.data.ot_minutes_total || 0) % 60);
                  const totalMins = (h * 60) + m;
                  
                  handleCellChange(editModal.empId, editModal.dateStr, editModal.data.status || 'P', {
                    ot_hours: totalMins / 60, // Legacy support
                    ot_minutes_total: totalMins,
                    late_minutes: editModal.data.late_minutes,
                    early_exit_minutes: editModal.data.early_exit_minutes,
                    remarks: editModal.data.remarks
                  });
                  setEditModal(null);
                }} 
                style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
                Save Details
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.legend}>
        <div className={styles.legendItem}><span className={styles.legendKey}>P</span> Present</div>
        <div className={styles.legendItem}><span className={styles.legendKey}>A</span> Absent</div>
        <div className={styles.legendItem}><span className={styles.legendKey}>W</span> Weekly Off</div>
        <div className={styles.legendItem}><span className={styles.legendKey}>H</span> Holiday</div>
        <div className={styles.legendItem}><span className={styles.legendKey}>HD</span> Half Day</div>
        <div className={styles.legendItem}><span className={styles.legendKey}>O</span> Overtime</div>
        <div className={styles.legendItem}><span className={styles.legendKey}>C</span> Casual L.</div>
        <div className={styles.legendItem}><span className={styles.legendKey}>S</span> Sick L.</div>
        <div className={styles.legendItem} style={{ marginLeft: 'auto', color: 'var(--primary)' }}>
          ⌨️ <strong>Arrow Keys</strong> to Navigate • <strong>Hotkeys</strong> to instant mark
        </div>
      </div>

      <div className={styles.matrixWrapper}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', fontWeight: 600 }}>Loading Workforce Matrix...</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.empHeader}>Employee Profile</th>
                {daysInMonth.map(day => (
                  <th key={day}>{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map(emp => (
                <tr key={emp.id}>
                  <td className={styles.empCell}>
                    <div className={styles.empCode}>{emp.emp_code}</div>
                    <div className={styles.empName}>{emp.name}</div>
                  </td>
                  {daysInMonth.map(day => {
                    const dateStr = `${currentMonth}-${day}`;
                    const cellData = matrix[emp.id]?.[dateStr] || { status: '' };
                    const val = cellData.status;
                    return (
                      <Cell
                        key={dateStr}
                        empId={emp.id}
                        dateStr={dateStr}
                        value={val}
                        cellData={cellData}
                        onChange={handleCellChange}
                        onKeyDown={handleKeyDown}
                        onDoubleClick={handleCellDoubleClick}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
