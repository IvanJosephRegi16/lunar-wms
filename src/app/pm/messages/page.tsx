'use client';

import { useState, useEffect } from 'react';

export default function PmMessagesPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [poDetails, setPoDetails] = useState<any>(null);
  const [poLoading, setPoLoading] = useState(false);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pm/messages');
      const data = await res.json();
      if (res.ok) {
        setMessages(data.messages || []);
      } else {
        setError(data.error || 'Failed to fetch messages');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await fetch('/api/pm/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      setMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: 1 } : m));
    } catch (err) {
      console.error(err);
    }
  };

  const markAllRead = async () => {
    try {
      await fetch('/api/pm/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true })
      });
      setMessages(prev => prev.map(m => ({ ...m, is_read: 1 })));
    } catch (err) {
      console.error(err);
    }
  };

  const deleteMessage = async (id: number) => {
    try {
      await fetch(`/api/pm/messages?id=${id}`, { method: 'DELETE' });
      setMessages(prev => prev.filter(m => m.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const clearAllMessages = async () => {
    try {
      await fetch('/api/pm/messages?clearAll=true', { method: 'DELETE' });
      setMessages([]);
      setExpandedId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleExpand = async (message: any) => {
    if (expandedId === message.id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(message.id);
    
    // Mark as read if not read
    if (message.is_read === 0) {
      markAsRead(message.id);
    }

    // Fetch PO Details
    setPoLoading(true);
    try {
      const res = await fetch(`/api/po/${message.po_id}`);
      const data = await res.json();
      if (res.ok) {
        setPoDetails(data.po);
      } else {
        setPoDetails(null);
      }
    } catch (err) {
      console.error(err);
      setPoDetails(null);
    } finally {
      setPoLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="card-clean fade-up" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-ghost)' }}>
        Loading messages...
      </div>
    );
  }

  return (
    <div className="fade-up">
      <div className="flex-between mb-4">
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Supervisor Remarks</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-ghost)', margin: 0 }}>Messages from supervisors during PO material verification</p>
        </div>
        {messages.length > 0 && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={markAllRead} className="btn-corp" style={{ background: '#f0f9ff', color: '#0ea5e9', border: '1px solid #bae6fd', fontSize: '12px', padding: '6px 12px' }}>
              ✓ Mark All Read
            </button>
            <button onClick={clearAllMessages} className="btn-corp" style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', fontSize: '12px', padding: '6px 12px' }}>
              🗑️ Clear All
            </button>
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: '16px', background: '#fef2f2', color: '#ef4444', borderRadius: '12px', marginBottom: '20px', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      {messages.length === 0 ? (
        <div className="card-clean" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-ghost)' }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>📭</div>
          <h3 style={{ fontSize: '16px', margin: '0 0 8px 0', color: 'var(--text-main)' }}>No Messages</h3>
          <p style={{ margin: 0, fontSize: '13px' }}>You have no remarks from supervisors at the moment.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {messages.map(msg => {
            const isExpanded = expandedId === msg.id;
            const isUnread = msg.is_read === 0;

            return (
              <div key={msg.id} className="card-clean" style={{ 
                overflow: 'hidden', 
                borderLeft: isUnread ? '4px solid #3b82f6' : '1px solid var(--border)',
                transition: 'all 0.2s',
                background: isUnread ? '#f8fafc' : 'white'
              }}>
                <div 
                  onClick={() => toggleExpand(msg)}
                  style={{ 
                    padding: '16px 20px', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', background: '#e0f2fe', color: '#0284c7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 800 }}>
                        {msg.supervisor_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {msg.supervisor_name}
                          <span style={{ fontSize: '10px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '10px', color: 'var(--text-ghost)' }}>Supervisor</span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {new Date(msg.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ 
                        fontSize: '11px', 
                        fontWeight: 800, 
                        background: '#fef3c7', 
                        color: '#d97706', 
                        padding: '4px 10px', 
                        borderRadius: '20px',
                        border: '1px solid #fde68a'
                      }}>
                        PO: {msg.po_number}
                      </span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteMessage(msg.id); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-ghost)', fontSize: '16px', padding: '4px' }}
                        title="Delete Message"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <div style={{ 
                    fontSize: '13px', 
                    color: 'var(--text-main)', 
                    lineHeight: '1.5',
                    background: '#f1f5f9',
                    padding: '12px',
                    borderRadius: '8px',
                    borderLeft: '3px solid #94a3b8',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {msg.remarks}
                  </div>

                  <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 700, textAlign: 'right', marginTop: '-4px' }}>
                    {isExpanded ? 'Hide PO Details ▲' : 'View PO Details ▼'}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '20px', background: '#fafafa' }}>
                    {poLoading ? (
                      <div style={{ fontSize: '12px', color: 'var(--text-ghost)', textAlign: 'center' }}>Loading Purchase Order details...</div>
                    ) : !poDetails ? (
                      <div style={{ fontSize: '12px', color: '#ef4444', textAlign: 'center' }}>Could not load PO details or PO was deleted.</div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800 }}>Purchase Order Summary</h4>
                          <span style={{ fontSize: '11px', fontWeight: 700, background: '#e0e7ff', color: '#4f46e5', padding: '4px 8px', borderRadius: '6px' }}>
                            Status: {poDetails.status.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px', fontSize: '12px' }}>
                          <div style={{ background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <div style={{ color: 'var(--text-ghost)', marginBottom: '4px' }}>Vendor</div>
                            <div style={{ fontWeight: 700 }}>{poDetails.vendor}</div>
                          </div>
                          <div style={{ background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <div style={{ color: 'var(--text-ghost)', marginBottom: '4px' }}>Date created</div>
                            <div style={{ fontWeight: 700 }}>{poDetails.po_date || new Date(poDetails.created_at).toLocaleDateString()}</div>
                          </div>
                        </div>

                        <h5 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 800 }}>Materials Received</h5>
                        <div style={{ overflowX: 'auto', background: 'white', borderRadius: '8px', border: '1px solid var(--border)' }}>
                          <table className="corporate-table" style={{ margin: 0 }}>
                            <thead>
                              <tr>
                                <th>Code</th>
                                <th>Material</th>
                                <th>Size/Thick</th>
                                <th style={{ textAlign: 'right' }}>Req Qty</th>
                                <th style={{ textAlign: 'right' }}>Recv Qty</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {poDetails.items && poDetails.items.length > 0 ? (
                                poDetails.items.map((item: any) => {
                                  const req = Number(item.required_qty) || 0;
                                  const recv = Number(item.received_qty) || 0;
                                  let statusBadge = <span style={{ color: '#ef4444', fontWeight: 700 }}>Missing</span>;
                                  if (recv >= req) statusBadge = <span style={{ color: '#10b981', fontWeight: 700 }}>Complete</span>;
                                  else if (recv > 0) statusBadge = <span style={{ color: '#f59e0b', fontWeight: 700 }}>Partial</span>;

                                  return (
                                    <tr key={item.id}>
                                      <td style={{ fontWeight: 700, fontSize: '11px' }}>{item.material_code}</td>
                                      <td style={{ fontSize: '12px' }}>{item.material_name}</td>
                                      <td style={{ fontSize: '12px' }}>{item.size_thickness}</td>
                                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{req} {item.unit}</td>
                                      <td style={{ textAlign: 'right', fontWeight: 800, color: recv >= req ? '#10b981' : '#f59e0b' }}>
                                        {recv} {item.unit}
                                      </td>
                                      <td>{statusBadge}</td>
                                    </tr>
                                  );
                                })
                              ) : (
                                <tr><td colSpan={6} style={{ textAlign: 'center' }}>No items found</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
