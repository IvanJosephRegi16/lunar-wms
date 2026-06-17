'use client';

import React from 'react';
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

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000,
      background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
    }}>
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

        <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: 'white', textAlign: 'right' }}>
          <button onClick={onClose} className="btn-corp" style={{ padding: '10px 20px' }}>Close Preview</button>
        </div>
      </div>
    </div>
  );
}
