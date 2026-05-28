'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

interface Employee {
  id: number;
  emp_code: string;
  punch_code: string;
  name: string;
  unit: string;
  department: string;
  designation: string;
  skill_category: string;
  employment_type: string;
  status: string;
  join_date: string;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('Active');
  
  const [showAdd, setShowAdd] = useState(false);
  const [newEmp, setNewEmp] = useState<Partial<Employee>>({
    status: 'Active',
    employment_type: 'Direct'
  });

  const loadEmployees = async () => {
    setLoading(true);
    const res = await fetch(`/api/hr/employees?search=${search}&unit=${unitFilter}&status=${statusFilter}`);
    const data = await res.json();
    setEmployees(data.employees || []);
    setLoading(false);
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      loadEmployees();
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [search, unitFilter, statusFilter]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/hr/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEmp)
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      setShowAdd(false);
      setNewEmp({ status: 'Active', employment_type: 'Direct' });
      loadEmployees();
    } catch (err) {
      alert('Failed to save employee.');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>Workforce Identity Matrix</h1>
          <p>Enterprise employee directory and workforce operations mapping.</p>
        </div>
        <button className={styles.actionBtn} onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? 'Cancel' : '+ Onboard Employee'}
        </button>
      </div>

      {showAdd && (
        <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>New Employee Onboarding</h2>
          <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <input required placeholder="Full Name" className={styles.inputField} onChange={e => setNewEmp({...newEmp, name: e.target.value})} />
            <input placeholder="Punch Code (Manual Ref)" className={styles.inputField} onChange={e => setNewEmp({...newEmp, punch_code: e.target.value})} />
            <input placeholder="Department" className={styles.inputField} onChange={e => setNewEmp({...newEmp, department: e.target.value})} />
            <input placeholder="Designation" className={styles.inputField} onChange={e => setNewEmp({...newEmp, designation: e.target.value})} />
            <input placeholder="Unit" className={styles.inputField} onChange={e => setNewEmp({...newEmp, unit: e.target.value})} />
            <select className={styles.selectField} onChange={e => setNewEmp({...newEmp, employment_type: e.target.value})}>
              <option value="Direct">Direct Worker</option>
              <option value="Contractor">Contractor</option>
              <option value="Staff">Staff</option>
            </select>
            <button type="submit" className={styles.actionBtn}>Save Employee</button>
          </form>
        </div>
      )}

      <div className={styles.filters}>
        <input 
          type="text" 
          placeholder="Search by Code, Punch Code or Name..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={`${styles.inputField} ${styles.searchBox}`}
        />
        <select value={unitFilter} onChange={e => setUnitFilter(e.target.value)} className={styles.selectField}>
          <option value="all">All Units</option>
          <option value="Unit 1">Unit 1</option>
          <option value="Unit 2">Unit 2</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={styles.selectField}>
          <option value="all">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Hold">Hold</option>
        </select>
      </div>

      <div className={styles.gridWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Emp Code</th>
              <th>Punch Code</th>
              <th>Employee Name</th>
              <th>Department</th>
              <th>Designation</th>
              <th>Unit</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}>Loading workforce data...</td></tr>
            ) : employees.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}>No employees found.</td></tr>
            ) : (
              employees.map(emp => (
                <tr key={emp.id}>
                  <td className={styles.mono}><strong>{emp.emp_code}</strong></td>
                  <td className={styles.mono}>{emp.punch_code || '-'}</td>
                  <td><strong>{emp.name}</strong></td>
                  <td>{emp.department || '-'}</td>
                  <td>{emp.designation || '-'}</td>
                  <td>{emp.unit || '-'}</td>
                  <td>{emp.employment_type || '-'}</td>
                  <td>
                    <span className={
                      emp.status === 'Active' ? styles.badgeActive : 
                      emp.status === 'Inactive' ? styles.badgeInactive : styles.badgeHold
                    }>
                      {emp.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
