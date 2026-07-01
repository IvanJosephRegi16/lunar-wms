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

  const handleExportPDF = async () => {
    const doc = new jsPDF('landscape');
    const pageWidth = doc.internal.pageSize.getWidth();

    // ── Company Letterhead ──
    try {
      const imgRes = await fetch('/lunars-logo.png');
      const imgBlob = await imgRes.blob();
      const reader = new FileReader();
      await new Promise<void>(resolve => {
        reader.onloadend = () => resolve();
        reader.readAsDataURL(imgBlob);
      });
      const logoDataUrl = reader.result as string;
      doc.addImage(logoDataUrl, 'PNG', 10, 6, 24, 14);
    } catch { /* logo optional */ }

    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 95);
    doc.text('VIKING RUBBERS PVT. LTD.', 38, 12);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);
    doc.text('37/8, Nethajipuram, Velanthavalam Road, K.G.Chavadi, Coimbatore - 641 105', 38, 18);
    doc.text('Phone: 0422 2656271  |  E-Mail: vikingcbe@lunars.com', 38, 22);

    // Divider line
    doc.setDrawColor(200, 200, 200);
    doc.line(10, 26, pageWidth - 10, 26);

    // Report title
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`Report: ${filename}`, 10, 32);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, pageWidth - 10, 32, { align: 'right' });

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 36,
      styles: { fontSize: 7.5, cellPadding: 3 },
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 10, right: 10 }
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(`Viking Rubbers Pvt. Ltd. — Confidential`, 10, doc.internal.pageSize.getHeight() - 5);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - 10, doc.internal.pageSize.getHeight() - 5, { align: 'right' });
    }

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
