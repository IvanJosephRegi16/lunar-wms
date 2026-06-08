'use client';

import { useState, useRef, useEffect } from 'react';
import { downloadCSV } from '@/lib/exportCSV';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as ExcelJS from 'exceljs';

interface ExportDropdownProps {
  filename: string;
  headers: string[];
  rows: any[][];
}

export default function ExportDropdown({ filename, headers, rows }: ExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExportCSV = () => {
    downloadCSV(`${filename}.csv`, headers, rows);
    setIsOpen(false);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('landscape');
    doc.text(`Export: ${filename}`, 14, 15);
    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15, 23, 42] }
    });
    doc.save(`${filename}.pdf`);
    setIsOpen(false);
  };

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data');
    
    worksheet.addRow(headers);
    worksheet.getRow(1).font = { bold: true };
    
    rows.forEach(row => {
      worksheet.addRow(row);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setIsOpen(false);
  };

  return (
    <div className="export-dropdown" ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'var(--primary, #0f172a)',
          color: 'white',
          border: 'none',
          borderRadius: '10px',
          padding: '10px 18px',
          fontWeight: 700,
          fontSize: '13px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          transition: 'all 0.2s'
        }}
      >
        📥 Export Data ▾
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '8px',
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          zIndex: 50,
          minWidth: '160px',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '4px' }}>
            <button onClick={handleExportPDF} className="export-option" style={{ ...optionStyle, color: '#dc2626' }}>
              📄 Export as PDF
            </button>
            <button onClick={handleExportExcel} className="export-option" style={{ ...optionStyle, color: '#16a34a' }}>
              📊 Export as Excel
            </button>
            <button onClick={handleExportCSV} className="export-option" style={{ ...optionStyle, color: '#2563eb' }}>
              📝 Export as CSV
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const optionStyle: React.CSSProperties = {
  width: '100%',
  textAlign: 'left',
  padding: '10px 16px',
  background: 'none',
  border: 'none',
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  borderRadius: '8px',
  transition: 'background 0.2s'
};
