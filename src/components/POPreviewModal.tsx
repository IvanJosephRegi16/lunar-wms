'use client';

import React, { useState, useRef } from 'react';
import { BillContent } from './EmailModal';

interface POPreviewModalProps {
  po: any;
  items: any[];
  onClose: () => void;
}

export default function POPreviewModal({ po, items, onClose }: POPreviewModalProps) {
  const terms = {
    deliveryDirection: po.terms_delivery || 'To be delivered directly to our Central Store',
    payment: po.terms_payment || '',
    panGst: po.terms_pan_gst || 'PAN-AAACV7922R  |  GST-33AAACV7922R1ZS',
    validity: po.terms_validity || '2 Weeks',
    otherDirections: po.terms_other || '1) Enclose copy of our purchase order along with your delivery documents.\n2) Our PAN and GST Number should be shown in the Dispatch documents.\n3) This PO NO. should be noted in your bill.',
    vendorName: po.vendor || '',
    vendorPlace: po.vendor_place || '',
  };

  const today = po.po_date || new Date(po.created_at || Date.now()).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'long', year: 'numeric'
  });

  const [pdfWidth, setPdfWidth] = useState('800');
  const [pdfHeight, setPdfHeight] = useState('1100');
  const [isDownloading, setIsDownloading] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);

  const handleDownloadPDF = async () => {
    try {
      setIsDownloading(true);
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      if (!captureRef.current) throw new Error('Capture ref not ready');
      
      const widthNum = parseInt(pdfWidth) || 800;
      const heightNum = parseInt(pdfHeight) || 1100;

      const canvas = await html2canvas(captureRef.current, {
        scale: 3, 
        useCORS: true, 
        backgroundColor: '#ffffff',
        width: captureRef.current.scrollWidth,
        height: captureRef.current.scrollHeight,
      });

      const imageDataUrl = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: widthNum > heightNum ? 'landscape' : 'portrait',
        unit: 'px',
        format: [widthNum, heightNum]
      });

      const ratio = canvas.height / canvas.width;
      const imgHeight = widthNum * ratio;
      
      pdf.addImage(imageDataUrl, 'PNG', 0, 0, widthNum, imgHeight);
      
      const vendorSlug = (terms.vendorName || po?.vendor || 'Vendor').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
      const dateSlug = new Date().toISOString().slice(0, 10);
      pdf.save(`PO_${po?.po_number}_${vendorSlug}_${dateSlug}.pdf`);

    } catch (error) {
      console.error('PDF Export failed:', error);
      alert('Failed to download PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000,
      background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
    }}>
      {/* Hidden capture target for high-res PDF generation */}
      <div ref={captureRef} style={{ position: 'fixed', top: '-9999px', left: '-9999px', width: '850px', zIndex: -1, pointerEvents: 'none' }}>
        <BillContent po={po} items={items} today={today} terms={terms} />
      </div>

      <div className="card-clean fade-up" style={{
        width: '100%', maxWidth: '900px', maxHeight: '90vh', background: 'white',
        borderRadius: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#1e293b' }}>📄 Accountant Emailed PO Preview</h2>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>This is the exact PO image formatted by the Accountant.</p>
          </div>
          <button onClick={onClose} style={{ fontSize: '24px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>×</button>
        </div>

        <div style={{ overflowY: 'auto', padding: '24px', background: '#e2e8f0' }}>
          <div style={{ background: 'white', border: '1px solid #cbd5e1', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', overflowX: 'auto' }}>
             <div style={{ minWidth: '800px' }}>
                <BillContent po={po} items={items} today={today} terms={terms} />
             </div>
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#f1f5f9', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Custom PDF Size (px):</span>
            <input 
              type="number" 
              value={pdfWidth} 
              onChange={e => setPdfWidth(e.target.value)}
              placeholder="Width"
              style={{ width: '80px', padding: '6px', borderRadius: '6px', border: '1px solid #94a3b8', fontSize: '13px', textAlign: 'center' }}
            />
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>×</span>
            <input 
              type="number" 
              value={pdfHeight} 
              onChange={e => setPdfHeight(e.target.value)}
              placeholder="Height"
              style={{ width: '80px', padding: '6px', borderRadius: '6px', border: '1px solid #94a3b8', fontSize: '13px', textAlign: 'center' }}
            />
            <button 
              onClick={handleDownloadPDF} 
              disabled={isDownloading}
              style={{ background: '#2563eb', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '13px', marginLeft: '4px' }}
            >
              {isDownloading ? '⏳ Generating...' : '💾 Download PDF'}
            </button>
          </div>
          <button onClick={onClose} className="btn-corp" style={{ padding: '10px 20px' }}>Close Preview</button>
        </div>
      </div>
    </div>
  );
}
