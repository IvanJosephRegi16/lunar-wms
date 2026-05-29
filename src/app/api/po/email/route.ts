import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { getAuthUser } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized Access' }, { status: 401 });
    }

    const { to, po, items } = await req.json();

    if (!to || !po || !items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Missing required parameters: to, po, or items' }, { status: 400 });
    }

    const today = new Date().toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata', day: '2-digit', month: 'long', year: 'numeric'
    });

    const netAmount = po.net_amount ?? 0;
    const transportCharge = Number(po.transport_charge) || 0;
    const grandTotal = netAmount + transportCharge;
    const amountPaid = Number(po.amount_paid) || 0;
    const balanceAmount = grandTotal - amountPaid;

    const logoPath = path.join(process.cwd(), 'public', 'lunars-logo.png');
    let logoBase64 = '';
    if (fs.existsSync(logoPath)) {
      logoBase64 = fs.readFileSync(logoPath, 'base64');
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || '"Lunar\'s WMS" <no-reply@lunars.com>';
    
    const resendApiKey = process.env.RESEND_API_KEY;
    
    const isSmtpConfigured = !!(smtpHost && smtpUser && smtpPass && !smtpUser.includes('your_gmail_here'));
    const isResendConfigured = !!resendApiKey;
    const isConfigured = isSmtpConfigured || isResendConfigured;

    // ────────────────────────────────────────────────────────────────────────
    // 🎨 PIXEL-PERFECT TECH-COMPANY INVOICE HTML TEMPLATE (STRIPE / GMAIL COMPATIBLE)
    // ────────────────────────────────────────────────────────────────────────
    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Purchase Order ${po.po_number}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 40px 0;
    }
    .container {
      max-width: 680px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
      padding: 35px 40px;
      color: #ffffff;
      position: relative;
    }
    .header-logo {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 0.05em;
      color: #ffffff;
      margin: 0;
      text-transform: uppercase;
    }
    .header-subtitle {
      font-size: 11px;
      color: #93c5fd;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin-top: 4px;
      font-weight: 700;
    }
    .header-meta {
      float: right;
      text-align: right;
    }
    .badge-po {
      background-color: rgba(255, 255, 255, 0.15);
      padding: 6px 14px;
      border-radius: 20px;
      color: #ffffff;
      font-size: 12px;
      font-weight: 800;
      display: inline-block;
    }
    .po-num {
      font-size: 20px;
      font-weight: 900;
      color: #ffffff;
      margin-top: 8px;
    }
    .date-str {
      font-size: 11px;
      color: #cbd5e1;
      margin-top: 4px;
    }
    .bill-to-section {
      background-color: #f1f5f9;
      padding: 24px 40px;
      border-bottom: 1px solid #e2e8f0;
    }
    .section-title {
      font-size: 10px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 6px;
    }
    .vendor-name {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
    }
    .table-container {
      padding: 24px 40px 10px 40px;
    }
    .po-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .po-table th {
      padding: 12px 14px;
      text-align: left;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.05em;
      color: #475569;
      border-bottom: 2px solid #e2e8f0;
    }
    .po-table td {
      padding: 16px 14px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
    }
    .code-cell {
      font-family: Consolas, Monaco, monospace;
      font-weight: 800;
      color: #2563eb;
    }
    .name-cell {
      font-weight: 700;
      color: #0f172a;
    }
    .stock-cell {
      font-family: Consolas, Monaco, monospace;
      color: #475569;
    }
    .qty-cell {
      font-family: Consolas, Monaco, monospace;
      font-weight: 800;
      color: #0f172a;
    }
    .vendor-cell {
      color: #64748b;
      font-size: 12px;
    }
    .ledger-section {
      padding: 10px 40px 40px 40px;
      background-color: #ffffff;
    }
    .ledger-card {
      background-color: #f8fafc;
      border-radius: 12px;
      padding: 20px;
      border: 1px solid #e2e8f0;
      max-width: 320px;
      margin-left: auto;
    }
    .ledger-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 13px;
    }
    .ledger-row:last-child {
      margin-bottom: 0;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
    }
    .ledger-label {
      color: #64748b;
      font-weight: 600;
    }
    .ledger-val {
      font-family: Consolas, Monaco, monospace;
      font-weight: 700;
      color: #1e293b;
    }
    .ledger-grand-val {
      font-family: Consolas, Monaco, monospace;
      font-weight: 900;
      color: #1e3a8a;
      font-size: 15px;
    }
    .footer {
      background-color: #0f172a;
      padding: 20px 40px;
      text-align: center;
      color: #94a3b8;
      font-size: 11px;
      letter-spacing: 0.02em;
    }
    .footer a {
      color: #38bdf8;
      text-decoration: none;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      
      <!-- HEADER -->
      <div class="header" style="padding: 25px 40px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="vertical-align: middle;">
              <div style="background-color: white; padding: 6px 12px; border-radius: 8px; display: inline-block;">
                <img src="${isConfigured ? 'cid:lunarslogo' : `data:image/png;base64,${logoBase64}`}" alt="Lunar's Logo" style="height: 38px; width: auto; display: block; object-fit: contain;" />
              </div>
              <div class="header-subtitle" style="margin-top: 6px;">Procurement Division</div>
            </td>
            <td style="text-align: right; vertical-align: middle;">
              <div class="badge-po">PURCHASE ORDER</div>
              <div class="po-num" style="margin-top: 4px;">${po.po_number}</div>
              <div class="date-str" style="margin-top: 4px;">${today}</div>
            </td>
          </tr>
        </table>
      </div>

      <!-- VENDOR META -->
      <div class="bill-to-section">
        <table style="width:100%; border-collapse:collapse;">
          <tr>
            <td>
              <div class="section-title">Vendor / Supplier</div>
              <div class="vendor-name">${po.vendor || 'N/A'}</div>
            </td>
            <td style="text-align: right;">
              <div class="section-title">Grand Total Amount</div>
              <div style="font-size: 18px; font-weight: 900; color: #2563eb; font-family: Consolas, Monaco, monospace;">
                ₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </td>
          </tr>
        </table>
      </div>

      <!-- ITEMS TABLE -->
      <div class="table-container">
        <table class="po-table">
          <thead>
            <tr>
              <th style="width: 15%;">Material Code</th>
              <th style="width: 30%;">Material Name</th>
              <th style="width: 15%;">Size / Thk</th>
              <th style="text-align: right; width: 10%;">Stock</th>
              <th style="text-align: right; width: 10%;">Req Qty</th>
              <th style="width: 20%; text-align: right;">Vendor</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td class="code-cell">${item.material_code || '—'}</td>
                <td class="name-cell">${item.material_name || '—'}</td>
                <td>${item.size_thickness || '—'}</td>
                <td style="text-align: right;" class="stock-cell">${(item.current_stock ?? 0).toLocaleString()}</td>
                <td style="text-align: right;" class="qty-cell">${(item.required_qty ?? item.required_quantity ?? 0).toLocaleString()}</td>
                <td style="text-align: right;" class="vendor-cell">${item.vendor || po.vendor || '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- LEDGER SUMMARY CARD -->
      <div class="ledger-section">
        <div class="ledger-card">
          <div class="ledger-row">
            <span class="ledger-label">Net Total</span>
            <span class="ledger-val">₹${netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div class="ledger-row">
            <span class="ledger-label">Transport Charge</span>
            <span class="ledger-val">₹${transportCharge.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div class="ledger-row" style="margin-top: 8px;">
            <span class="ledger-label" style="color: #0f172a; font-weight: 800;">Grand Total</span>
            <span class="ledger-grand-val">₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      <!-- FOOTER -->
      <div class="footer">
        Generated &amp; Transmitted by <a href="#">Lunar's WMS Corporate Billing Portal</a>. All rights reserved.
      </div>

    </div>
  </div>
</body>
</html>
    `;

    // ────────────────────────────────────────────────────────────────────────
    // ⚙️ MAIL SENDING & OFFLINE FALLBACK ENGINE
    // ────────────────────────────────────────────────────────────────────────
    if (isResendConfigured) {
      const resend = new Resend(resendApiKey);
      const { data, error } = await resend.emails.send({
        from: smtpFrom.includes('@') ? smtpFrom : 'onboarding@resend.dev', // Resend requires a verified domain or onboarding@resend.dev
        to: [to],
        subject: `[Lunar's PO] Purchase Order ${po.po_number} - Invoice / Billing Draft`,
        html: emailHtml,
        attachments: logoBase64 ? [
          {
            filename: 'lunars-logo.png',
            content: logoBase64,
          }
        ] : []
      });

      if (error) {
        throw new Error(error.message);
      }
      return NextResponse.json({ success: true, method: 'resend', recipient: to, id: data?.id });
      
    } else if (isSmtpConfigured) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort || '465'),
        secure: smtpPort === '465' || process.env.SMTP_SECURE === 'true',
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });

      await transporter.sendMail({
        from: smtpFrom,
        to: to,
        subject: `[Lunar's PO] Purchase Order ${po.po_number} - Invoice / Billing Draft`,
        html: emailHtml,
        attachments: [
          {
            filename: 'lunars-logo.png',
            path: logoPath,
            cid: 'lunarslogo'
          }
        ]
      });

      return NextResponse.json({ success: true, method: 'smtp', recipient: to });
    } else {
      // Offline fallback: Write to local HTML file so user can review immediately
      // Use /tmp in production (Railway's filesystem is read-only outside /tmp)
      const baseDir = process.env.NODE_ENV === 'production' ? '/tmp' : process.cwd();
      const sentEmailsDir = path.join(baseDir, 'sent_emails');
      if (!fs.existsSync(sentEmailsDir)) {
        fs.mkdirSync(sentEmailsDir, { recursive: true });
      }

      const fileName = `po_${po.po_number.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.html`;
      const filePath = path.join(sentEmailsDir, fileName);
      
      fs.writeFileSync(filePath, emailHtml, 'utf-8');

      // Return a simulated success response containing the path to open
      return NextResponse.json({ 
        success: true, 
        method: 'local_fallback', 
        savedLocally: true,
        filePath: `sent_emails/${fileName}`,
        absPath: filePath,
        recipient: to
      });
    }

  } catch (error: any) {
    console.error('Email Dispatch Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to dispatch email' }, { status: 500 });
  }
}
