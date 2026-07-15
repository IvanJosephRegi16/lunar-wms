import { AsyncLocalStorage } from 'async_hooks';
// @ts-ignore
import { Pool } from 'pg';

// ─────────────────────────────────────────────────────────────────────────────
// 1. PostgreSQL Connection Pool
//    Reads DATABASE_URL from environment (Railway injects this automatically).
// ─────────────────────────────────────────────────────────────────────────────
export const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:ivan@localhost:5432/Lunar',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pgPool.on('error', (err: any) => {
  console.error('[PG POOL ERROR] Unexpected error on idle client', err.message);
});

console.log(`[DATABASE SETUP] Connected to PostgreSQL via DATABASE_URL`);

// ─────────────────────────────────────────────────────────────────────────────
// 2. Self-Healing PostgreSQL Schema Migrations
//    Runs once at boot. All tables are created with IF NOT EXISTS so it is
//    completely safe to run on every cold start.
// ─────────────────────────────────────────────────────────────────────────────
async function ensureDatabaseSchema() {
  const client = await pgPool.connect();
  try {
    console.log('[DATABASE] Running schema migrations...');

    // ── Core System Tables ────────────────────────────────────────────────
    await client.query(`-- ==========================================
-- LUNAR'S FOOTWEAR ERP
-- POSTGRESQL / SUPABASE MIGRATION SCHEMA
-- ==========================================
-- Instructions: Copy and paste this entire script into the Supabase SQL Editor and click "Run".
-- This preserves all inventory, scanning, carton generation, and PO workflow structures.

-- 0. SET TIMEZONE TO IST (Crucial for Operational Timestamps)
ALTER DATABASE postgres SET timezone TO 'Asia/Kolkata';

-- 1. USERS & AUTHENTICATION
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','supervisor','operator','pm','accountant','worker')),
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  phone TEXT,
  plain_password TEXT
);

-- 2. LOGIN ACTIVITY
CREATE TABLE IF NOT EXISTS login_activity (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username TEXT,
  action TEXT,
  ip_address TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- 4. DAILY SHEETS & STOCK
CREATE TABLE IF NOT EXISTS daily_sheets (
  sheet_date TEXT PRIMARY KEY,
  status TEXT DEFAULT 'open' CHECK(status IN ('open','submitted','approved','locked')),
  locked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_stock (
  id SERIAL PRIMARY KEY,
  sheet_date TEXT NOT NULL REFERENCES daily_sheets(sheet_date) ON DELETE CASCADE,
  article_code TEXT NOT NULL,
  colour TEXT NOT NULL,
  size TEXT NOT NULL,
  opening_stock NUMERIC DEFAULT 0,
  inward_stock NUMERIC DEFAULT 0,
  machine_return_stock NUMERIC DEFAULT 0,
  semi_finished_stock NUMERIC DEFAULT 0,
  total_available NUMERIC GENERATED ALWAYS AS (opening_stock + inward_stock + machine_return_stock + semi_finished_stock) STORED,
  outward_stock NUMERIC DEFAULT 0,
  closing_stock NUMERIC GENERATED ALWAYS AS (opening_stock + inward_stock + machine_return_stock + semi_finished_stock - outward_stock) STORED,
  remarks TEXT,
  is_duplicate INTEGER DEFAULT 0,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ds_date ON daily_stock(sheet_date);
CREATE INDEX IF NOT EXISTS idx_ds_article ON daily_stock(article_code, colour, size);

-- 5. V-STRAP
CREATE TABLE IF NOT EXISTS v_strap (
  id SERIAL PRIMARY KEY,
  entry_date TEXT NOT NULL,
  article_code TEXT,
  colour TEXT,
  opening_stock NUMERIC DEFAULT 0,
  inward_qty NUMERIC DEFAULT 0,
  outward_qty NUMERIC DEFAULT 0,
  closing_stock NUMERIC GENERATED ALWAYS AS (opening_stock + inward_qty - outward_qty) STORED,
  remarks TEXT,
  status TEXT DEFAULT 'draft',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ
);

-- 6. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username TEXT,
  action TEXT NOT NULL,
  module TEXT,
  record_id INTEGER,
  record_date TEXT,
  old_value TEXT,
  new_value TEXT,
  description TEXT,
  ip_address TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 7. PACKING MODULE (CARTONS & INVENTORY)
CREATE TABLE IF NOT EXISTS carton_generation (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  total_pairs INTEGER NOT NULL,
  is_custom INTEGER DEFAULT 0,
  article_code TEXT,
  colour TEXT,
  is_deleted INTEGER DEFAULT 0,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS carton_generation_sizes (
  id SERIAL PRIMARY KEY,
  config_id INTEGER NOT NULL REFERENCES carton_generation(id) ON DELETE CASCADE,
  size TEXT NOT NULL,
  quantity INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS inward_inventory_transactions (
  id SERIAL PRIMARY KEY,
  article_code TEXT NOT NULL,
  colour TEXT NOT NULL,
  size TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  operator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  type TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outward_transactions (
  id SERIAL PRIMARY KEY,
  transaction_id TEXT UNIQUE NOT NULL,
  article_code TEXT NOT NULL,
  colour TEXT NOT NULL,
  config_id INTEGER NOT NULL REFERENCES carton_generation(id),
  num_cartons INTEGER NOT NULL,
  total_pairs INTEGER NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outward_items (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER NOT NULL REFERENCES outward_transactions(id) ON DELETE CASCADE,
  size TEXT NOT NULL,
  quantity_per_carton INTEGER NOT NULL,
  total_quantity INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS packed_cartons (
  id SERIAL PRIMARY KEY,
  carton_id TEXT UNIQUE NOT NULL,
  transaction_id INTEGER NOT NULL REFERENCES outward_transactions(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scan_history (
  id SERIAL PRIMARY KEY,
  barcode TEXT NOT NULL,
  article_code TEXT NOT NULL,
  colour TEXT NOT NULL,
  size TEXT NOT NULL,
  operator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'success',
  carton_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intake_barcode_pool (
  barcode TEXT PRIMARY KEY,
  article_code TEXT NOT NULL,
  colour TEXT NOT NULL,
  size TEXT NOT NULL,
  status TEXT DEFAULT 'available',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  outward_scanned_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS outward_scan_sessions (
  id SERIAL PRIMARY KEY,
  carton_generation_id INTEGER REFERENCES carton_generation(id),
  operator_id INTEGER REFERENCES users(id),
  article_code TEXT,
  colour TEXT,
  status TEXT DEFAULT 'in_progress',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS outward_scan_items (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES outward_scan_sessions(id) ON DELETE CASCADE,
  article_code TEXT NOT NULL,
  colour TEXT NOT NULL,
  size TEXT NOT NULL,
  scanned_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_pool (
  id SERIAL PRIMARY KEY,
  article_code TEXT NOT NULL,
  colour TEXT NOT NULL,
  size_5 INTEGER DEFAULT 0,
  size_6 INTEGER DEFAULT 0,
  size_7 INTEGER DEFAULT 0,
  size_8 INTEGER DEFAULT 0,
  size_9 INTEGER DEFAULT 0,
  size_10 INTEGER DEFAULT 0,
  size_11 INTEGER DEFAULT 0,
  size_12 INTEGER DEFAULT 0,
  size_13 INTEGER DEFAULT 0,
  total_qty INTEGER DEFAULT 0,
  UNIQUE(article_code, colour)
);
ALTER TABLE inventory_pool ADD COLUMN IF NOT EXISTS size_13 INTEGER DEFAULT 0;

-- 8. PURCHASE ORDER (PO) WORKFLOW
CREATE TABLE IF NOT EXISTS purchase_orders (
  id SERIAL PRIMARY KEY,
  po_number TEXT UNIQUE NOT NULL,
  vendor TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'pending_pm_approval', 'pending_admin_approval', 'returned_by_pm', 'returned_by_admin', 'returned_for_edit', 'rejected', 'accountant_processing', 'supervisor_review', 'completed')),
  rejection_reason TEXT,
  correction_notes TEXT,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at_date TEXT,
  approved_at_time TEXT,
  approved_timestamp TEXT,
  invoice_number TEXT,
  transport_charge NUMERIC DEFAULT 0,
  gross_amount NUMERIC NOT NULL DEFAULT 0,
  discount_percent NUMERIC DEFAULT 0,
  net_amount NUMERIC NOT NULL DEFAULT 0,
  grand_total NUMERIC NOT NULL DEFAULT 0,
  amount_paid NUMERIC DEFAULT 0,
  balance_amount NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid', 'partial', 'paid')),
  shipping_method TEXT,
  delivery_status TEXT DEFAULT 'pending' CHECK(delivery_status IN ('pending', 'in_transit', 'delivered')),
  accountant_updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  accountant_updated_at TEXT,
  remarks TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  po_date TEXT,
  terms_delivery TEXT,
  terms_payment TEXT,
  terms_pan_gst TEXT,
  terms_validity TEXT,
  terms_other TEXT,
  vendor_place TEXT
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id SERIAL PRIMARY KEY,
  po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  material_code TEXT NOT NULL,
  material_name TEXT NOT NULL,
  size_thickness TEXT NOT NULL,
  order_rate NUMERIC NOT NULL,
  current_stock NUMERIC NOT NULL DEFAULT 0,
  current_stock_unit TEXT DEFAULT 'Pair',
  required_qty NUMERIC NOT NULL,
  unit TEXT DEFAULT 'Pair',
  amount NUMERIC NOT NULL,
  vendor TEXT,
  remarks TEXT,
  original_order_rate NUMERIC
);

CREATE TABLE IF NOT EXISTS po_approval_history (
  id SERIAL PRIMARY KEY,
  po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK(action IN ('submit', 'approve', 'reject', 'return')),
  actor_id INTEGER NOT NULL REFERENCES users(id),
  actor_name TEXT NOT NULL,
  comments TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  ist_timestamp TEXT
);

-- Safely add new columns to purchase_orders and purchase_order_items if they don't exist
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS original_order_rate NUMERIC;
UPDATE purchase_order_items SET original_order_rate = order_rate WHERE original_order_rate IS NULL;

-- Safely add new columns to purchase_orders if they don't exist
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS terms_delivery TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS terms_payment TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS terms_pan_gst TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS terms_validity TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS terms_other TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS vendor_place TEXT;

CREATE TABLE IF NOT EXISTS po_activity_logs (
  id SERIAL PRIMARY KEY,
  po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  username TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS po_notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  po_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
  po_number TEXT,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. OTP VERIFICATIONS
CREATE TABLE IF NOT EXISTS otp_verifications (
  id SERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  otp TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  verified INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. DEFAULT ADMIN & ROLE SEEDING
-- Make sure to seed the system admin so you can log in after switching the database!
-- Password hash below is 'admin123' using bcrypt (cost 10)
INSERT INTO users (username, password_hash, full_name, role, plain_password) 
VALUES ('admin', '$2b$10$heeWtl8.Dv6FeiXmJOl3kOH1uiRw/g3G90lxmV2XvAnq5gcP9wLqG', 'System Admin', 'admin', 'admin123')
ON CONFLICT (username) DO NOTHING;
`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_entries (
        id SERIAL PRIMARY KEY,
        sheet_date TEXT NOT NULL,
        sl_no INTEGER,
        article_code TEXT NOT NULL,
        description TEXT,
        colour TEXT NOT NULL,
        size_6 REAL DEFAULT 0,
        size_7 REAL DEFAULT 0,
        size_8 REAL DEFAULT 0,
        size_9 REAL DEFAULT 0,
        size_10 REAL DEFAULT 0,
        size_11 REAL DEFAULT 0,
        size_12 REAL DEFAULT 0,
        entry_type TEXT DEFAULT 'inward',
        remarks TEXT,
        status TEXT DEFAULT 'draft',
        is_duplicate INTEGER DEFAULT 0,
        is_deleted INTEGER DEFAULT 0,
        approved_by INTEGER,
        approved_at TEXT,
        created_by INTEGER,
        updated_by INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS inward_outward (
        id SERIAL PRIMARY KEY,
        entry_date TEXT NOT NULL,
        article_code TEXT NOT NULL,
        description TEXT,
        colour TEXT NOT NULL,
        size TEXT,
        opening_stock REAL DEFAULT 0,
        inward_qty REAL DEFAULT 0,
        outward_qty REAL DEFAULT 0,
        remarks TEXT,
        entry_type TEXT DEFAULT 'inward',
        is_deleted INTEGER DEFAULT 0,
        created_by INTEGER,
        updated_by INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sidebar_access_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        role TEXT NOT NULL,
        module_key TEXT NOT NULL,
        module_name TEXT NOT NULL,
        reason TEXT,
        status TEXT DEFAULT 'pending',
        is_notified_user INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        processed_at TEXT,
        processed_by INTEGER
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS pm_messages (
        id SERIAL PRIMARY KEY,
        po_id INTEGER NOT NULL,
        po_number TEXT NOT NULL,
        pm_id INTEGER NOT NULL REFERENCES users(id),
        supervisor_id INTEGER NOT NULL REFERENCES users(id),
        supervisor_name TEXT NOT NULL,
        remarks TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── AI / ML Tables (migrated from SQLite) ──────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_anomaly_alerts (
        id SERIAL PRIMARY KEY,
        severity TEXT DEFAULT 'medium',
        module TEXT NOT NULL,
        description TEXT NOT NULL,
        anomaly_score REAL DEFAULT 0.0,
        is_resolved INTEGER DEFAULT 0,
        resolved_by INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_forecast_cache (
        id SERIAL PRIMARY KEY,
        target_date TEXT NOT NULL,
        article_code TEXT NOT NULL,
        colour TEXT NOT NULL,
        predicted_demand REAL NOT NULL,
        lower_bound REAL,
        upper_bound REAL,
        confidence_score REAL,
        model_version TEXT DEFAULT 'v1.0.0-Prophet',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_vendor_scorecard (
        vendor_name TEXT PRIMARY KEY,
        reliability_score REAL DEFAULT 100.0,
        average_lead_time_hours REAL DEFAULT 0.0,
        completion_efficiency REAL DEFAULT 100.0,
        pricing_stability REAL DEFAULT 100.0,
        overall_grade TEXT DEFAULT 'A',
        last_updated TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── Articles & BOM ────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id SERIAL PRIMARY KEY,
        article_code TEXT UNIQUE NOT NULL,
        article_name TEXT,
        description TEXT,
        colour TEXT,
        sizes TEXT,
        planned_price REAL DEFAULT 0.0,
        actual_price REAL DEFAULT 0.0,
        image_base64 TEXT,
        is_deleted INTEGER DEFAULT 0,
        status TEXT DEFAULT 'Active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS article_bom (
        id SERIAL PRIMARY KEY,
        article_code TEXT NOT NULL,
        material_code TEXT NOT NULL,
        material_name TEXT,
        quantity REAL NOT NULL,
        unit TEXT DEFAULT 'kg',
        price_per_unit REAL DEFAULT 0.0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── Materials & Vendors Registry ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS materials (
        id SERIAL PRIMARY KEY,
        material_code TEXT NOT NULL,
        material_name TEXT NOT NULL,
        category TEXT DEFAULT 'Uncategorized',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Drop the unique constraint on material_code if it exists (allow duplicates)
    try {
      await client.query(`ALTER TABLE materials DROP CONSTRAINT IF EXISTS materials_material_code_key`);
      console.log('[MIGRATION] Dropped unique constraint on materials.material_code');
    } catch (e: any) { console.warn('[MIGRATION] materials_material_code_key drop skipped:', e.message); }

    await client.query(`
      CREATE TABLE IF NOT EXISTS vendors (
        id SERIAL PRIMARY KEY,
        vendor_name TEXT UNIQUE NOT NULL,
        company_name TEXT,
        address TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── Enterprise Materials Management System ────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS mat_units (
        id SERIAL PRIMARY KEY,
        unit_name TEXT UNIQUE NOT NULL,
        abbreviation TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS mat_categories (
        id SERIAL PRIMARY KEY,
        category_name TEXT UNIQUE NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS mat_suppliers (
        id SERIAL PRIMARY KEY,
        supplier_name TEXT UNIQUE NOT NULL,
        contact_person TEXT,
        contact_number TEXT,
        email TEXT,
        address TEXT,
        gstin TEXT,
        status TEXT DEFAULT 'Active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS mat_inventory (
        id SERIAL PRIMARY KEY,
        material_name TEXT NOT NULL,
        category_id INTEGER NOT NULL,
        colour TEXT,
        unit_id INTEGER NOT NULL,
        current_stock REAL DEFAULT 0.0,
        min_stock_level REAL DEFAULT 0.0,
        warning_threshold REAL DEFAULT 0.0,
        last_supplier_id INTEGER,
        last_rate REAL DEFAULT 0.0,
        status TEXT DEFAULT 'Active',
        is_deleted INTEGER DEFAULT 0,
        created_by INTEGER,
        updated_by INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS mat_purchases (
        id SERIAL PRIMARY KEY,
        invoice_no TEXT,
        purchase_date TEXT NOT NULL,
        material_id INTEGER NOT NULL,
        supplier_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        rate REAL NOT NULL,
        total_amount REAL NOT NULL,
        remarks TEXT,
        created_by INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS mat_movements (
        id SERIAL PRIMARY KEY,
        material_id INTEGER NOT NULL,
        movement_type TEXT NOT NULL,
        before_qty REAL NOT NULL,
        after_qty REAL NOT NULL,
        change_qty REAL NOT NULL,
        source_reference TEXT,
        remarks TEXT,
        created_by INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── HR & Payroll Enterprise Architecture ──────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_employees (
        id SERIAL PRIMARY KEY,
        emp_code TEXT UNIQUE NOT NULL,
        punch_code TEXT UNIQUE,
        name TEXT NOT NULL,
        unit TEXT,
        department TEXT,
        section TEXT,
        line TEXT,
        designation TEXT,
        grade TEXT,
        skill_category TEXT,
        employment_type TEXT,
        status TEXT DEFAULT 'Active',
        join_date TEXT,
        shift_group_id INTEGER,
        weekly_off_pattern TEXT,
        salary_group_id INTEGER,
        payroll_category TEXT,
        created_by INTEGER,
        updated_by INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        is_deleted INTEGER DEFAULT 0
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_attendance_daily (
        id SERIAL PRIMARY KEY,
        emp_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        shift_id INTEGER,
        in_time TEXT,
        out_time TEXT,
        status TEXT NOT NULL DEFAULT 'P',
        ot_hours REAL DEFAULT 0.0,
        ot_minutes_total INTEGER DEFAULT 0,
        late_minutes INTEGER DEFAULT 0,
        early_exit_minutes INTEGER DEFAULT 0,
        remarks TEXT,
        is_locked INTEGER DEFAULT 0,
        created_by INTEGER,
        updated_by INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(emp_id, date)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_attendance_monthly (
        id SERIAL PRIMARY KEY,
        emp_id INTEGER NOT NULL,
        month_year TEXT NOT NULL,
        total_present REAL DEFAULT 0.0,
        total_absent REAL DEFAULT 0.0,
        total_leave REAL DEFAULT 0.0,
        total_wo REAL DEFAULT 0.0,
        total_holiday REAL DEFAULT 0.0,
        total_half_days REAL DEFAULT 0.0,
        total_ot_hours REAL DEFAULT 0.0,
        payable_days REAL DEFAULT 0.0,
        is_locked INTEGER DEFAULT 0,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(emp_id, month_year)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_salary_components (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        is_statutory INTEGER DEFAULT 0,
        formula_expression TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_salary_structures (
        id SERIAL PRIMARY KEY,
        emp_id INTEGER UNIQUE NOT NULL,
        basic_wage REAL DEFAULT 0.0,
        da_wage REAL DEFAULT 0.0,
        hra_wage REAL DEFAULT 0.0,
        other_allowances REAL DEFAULT 0.0,
        ot_rate_per_hour REAL DEFAULT 0.0,
        pf_eligible INTEGER DEFAULT 1,
        esi_eligible INTEGER DEFAULT 1,
        pt_eligible INTEGER DEFAULT 1,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_payroll_runs (
        id SERIAL PRIMARY KEY,
        month_year TEXT NOT NULL,
        unit TEXT,
        stage TEXT DEFAULT 'Draft',
        total_gross REAL DEFAULT 0.0,
        total_net REAL DEFAULT 0.0,
        processed_by INTEGER,
        locked_by INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(month_year, unit)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_payroll_slips (
        id SERIAL PRIMARY KEY,
        payroll_run_id INTEGER NOT NULL,
        emp_id INTEGER NOT NULL,
        payable_days REAL DEFAULT 0.0,
        ot_hours REAL DEFAULT 0.0,
        gross_earnings REAL DEFAULT 0.0,
        total_deductions REAL DEFAULT 0.0,
        net_payable REAL DEFAULT 0.0,
        snapshot_json TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(payroll_run_id, emp_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_deductions_additions (
        id SERIAL PRIMARY KEY,
        emp_id INTEGER NOT NULL,
        month_year TEXT NOT NULL,
        type TEXT NOT NULL,
        label TEXT,
        amount REAL DEFAULT 0.0,
        is_deduction INTEGER DEFAULT 1,
        remarks TEXT,
        created_by INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_advances (
        id SERIAL PRIMARY KEY,
        emp_id INTEGER NOT NULL,
        request_date TEXT NOT NULL,
        amount_requested REAL NOT NULL,
        amount_approved REAL DEFAULT 0.0,
        status TEXT DEFAULT 'pending',
        approved_by INTEGER,
        approval_timestamp TEXT,
        remarks TEXT,
        proof_document_path TEXT,
        outstanding_balance REAL DEFAULT 0.0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_advance_deductions (
        id SERIAL PRIMARY KEY,
        advance_id INTEGER NOT NULL,
        payroll_run_id INTEGER NOT NULL,
        amount_deducted REAL NOT NULL,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS leave_applications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        department TEXT,
        leave_type TEXT,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        total_days REAL NOT NULL,
        reason TEXT,
        supervisor_id INTEGER REFERENCES users(id),
        status TEXT DEFAULT 'pending_supervisor' CHECK(status IN (
          'pending_supervisor', 
          'returned_by_supervisor', 
          'rejected_by_supervisor', 
          'pending_pm',
          'returned_by_pm',
          'rejected_by_pm',
          'pending_admin', 
          'returned_by_admin', 
          'rejected_by_admin', 
          'approved'
        )),
        supervisor_remarks TEXT,
        admin_remarks TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── Column-level migrations (safe ADD COLUMN IF NOT EXISTS) ───────────
    const columnMigrations = [
      { table: 'purchase_orders',     column: 'is_deleted',              type: 'INTEGER DEFAULT 0' },
      { table: 'purchase_order_items',column: 'received_qty',            type: 'REAL DEFAULT 0' },
      { table: 'purchase_order_items',column: 'category',                type: 'TEXT DEFAULT \'\'' },
      { table: 'purchase_orders',     column: 'supervisor_verified_by',  type: 'INTEGER' },
      { table: 'purchase_orders',     column: 'supervisor_verified_at',  type: 'TEXT' },
      { table: 'purchase_orders',     column: 'remarks',                 type: 'TEXT DEFAULT \'\''},
      { table: 'purchase_orders',     column: 'discount_percent',        type: 'REAL DEFAULT 0.0' },
      { table: 'purchase_orders',     column: 'approved_at_date',        type: 'TEXT' },
      { table: 'purchase_orders',     column: 'approved_at_time',        type: 'TEXT' },
      { table: 'purchase_orders',     column: 'correction_notes',        type: 'TEXT' },
      { table: 'packed_cartons',      column: 'is_deleted',              type: 'INTEGER DEFAULT 0' },
      { table: 'outward_transactions',column: 'is_deleted',              type: 'INTEGER DEFAULT 0' },
      { table: 'scan_history',        column: 'is_deleted',              type: 'INTEGER DEFAULT 0' },
      { table: 'inventory_pool',      column: 'is_deleted',              type: 'INTEGER DEFAULT 0' },
      { table: 'v_strap',             column: 'is_deleted',              type: 'INTEGER DEFAULT 0' },
      { table: 'users',               column: 'plain_password',          type: 'TEXT' },
      { table: 'outward_scan_sessions', column: 'article_code',          type: 'TEXT' },
      { table: 'outward_scan_sessions', column: 'colour',                type: 'TEXT' },
      { table: 'inventory_pool',      column: 'mrp',                     type: 'REAL' },
      { table: 'scan_history',        column: 'mrp',                     type: 'REAL' },
      { table: 'scan_history',        column: 'scan_type',               type: "TEXT DEFAULT 'intake'" },
      { table: 'packed_cartons',      column: 'scanned_at',              type: 'TEXT' },
      { table: 'vendors',             column: 'company_name',            type: 'TEXT' },
      { table: 'vendors',             column: 'address',                 type: 'TEXT' },
      { table: 'materials',           column: 'size_thickness',          type: 'TEXT' },
      { table: 'materials',           column: 'rate',                    type: 'REAL DEFAULT 0' },
      { table: 'leave_applications',  column: 'pm_remarks',              type: 'TEXT' },
      { table: 'carton_generation',   column: 'is_deleted',              type: 'INTEGER DEFAULT 0' },
      { table: 'carton_generation',   column: 'article_code',            type: 'TEXT' },
      { table: 'carton_generation',   column: 'colour',                  type: 'TEXT' },
      { table: 'carton_generation',   column: 'created_by',              type: 'INTEGER' },
      { table: 'outward_scan_items',  column: 'barcode',                 type: 'TEXT' },
    ];

    for (const m of columnMigrations) {
      try {
        await client.query(
          `ALTER TABLE ${m.table} ADD COLUMN IF NOT EXISTS ${m.column} ${m.type}`
        );
      } catch {
        // Column already exists or table not created yet — safe to ignore
      }
    }

    // Backfill NULL is_deleted values to 0 for carton_generation
    try {
      await client.query(`UPDATE carton_generation SET is_deleted = 0 WHERE is_deleted IS NULL`);
    } catch { /* table may not exist yet */ }

    // ── Constraint migrations (fix CHECK constraints for new status values) ──
    try {
      await client.query(`ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check`);
      await client.query(`ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_status_check CHECK(status IN ('draft', 'pending_pm_approval', 'pending_admin_approval', 'returned_by_pm', 'returned_by_admin', 'returned_for_edit', 'rejected', 'accountant_processing', 'supervisor_review', 'completed'))`);
      console.log('[MIGRATION] purchase_orders status constraint updated with supervisor_review');
      
      await client.query(`ALTER TABLE leave_applications DROP CONSTRAINT IF EXISTS leave_applications_status_check`);
      await client.query(`ALTER TABLE leave_applications ADD CONSTRAINT leave_applications_status_check CHECK(status IN ('pending_supervisor', 'returned_by_supervisor', 'rejected_by_supervisor', 'pending_pm', 'returned_by_pm', 'rejected_by_pm', 'pending_admin', 'returned_by_admin', 'rejected_by_admin', 'approved'))`);
      console.log('[MIGRATION] leave_applications status constraint updated with pm statuses');

      await client.query(`ALTER TABLE po_approval_history DROP CONSTRAINT IF EXISTS po_approval_history_action_check`);
      await client.query(`ALTER TABLE po_approval_history ADD CONSTRAINT po_approval_history_action_check CHECK(action IN ('submit', 'approve', 'reject', 'return', 'supervisor_verified', 'supervisor_returned', 'partial_entry'))`);
      console.log('[MIGRATION] po_approval_history constraint updated');
    } catch (e: any) {
      console.warn('[MIGRATION] status constraint update skipped:', e.message);
    }

    try {
      await client.query(`ALTER TABLE po_notifications ALTER COLUMN po_id DROP NOT NULL`);
      await client.query(`ALTER TABLE po_notifications ALTER COLUMN po_number DROP NOT NULL`);
      console.log('[MIGRATION] po_notifications constraints relaxed');
    } catch (e: any) {
      console.warn('[MIGRATION] po_notifications constraints relax skipped:', e.message);
    }

    // ── Seed default data (idempotent) ────────────────────────────────────
    try {
      const { rows: [uc] } = await client.query(`SELECT COUNT(*) as cnt FROM mat_units`);
      if (Number(uc.cnt) === 0) {
        await client.query(`
          INSERT INTO mat_units (unit_name, abbreviation) VALUES 
          ('Meter','m'),('Kilogram','kg'),('Piece','pc'),('Roll','rl'),
          ('Pair','pr'),('Sheet','sh'),('Box','bx'),('Bundle','bdl'),
          ('Liter','l'),('Gram','g')
          ON CONFLICT DO NOTHING
        `);
      }
    } catch (e: any) { console.warn('[SEED] mat_units skipped:', e.message); }

    try {
      const { rows: [cc] } = await client.query(`SELECT COUNT(*) as cnt FROM mat_categories`);
      if (Number(cc.cnt) === 0) {
        await client.query(`
          INSERT INTO mat_categories (category_name) VALUES
          ('Rexin'),('Insole'),('Eva'),('Lyckra'),('Lace'),('Niwar'),
          ('Click Die'),('Embossing'),('PVC Tube'),('Thread'),('Loopy'),
          ('Binding'),('Hot Melt Gum'),('Velcro'),('PVC Angutta Pin'),('Others')
          ON CONFLICT DO NOTHING
        `);
      }
    } catch (e: any) { console.warn('[SEED] mat_categories skipped:', e.message); }

    // ── Custom Material Categories (PO workflow) ─────────────────────────
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS custom_material_categories (
          id SERIAL PRIMARY KEY,
          category_name TEXT UNIQUE NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
    } catch (e: any) { console.warn('[MIGRATION] custom_material_categories skipped:', e.message); }

    // Seed base PO categories into custom_material_categories (so all are manageable/deletable)
    try {
      const basePOCats = ['Rexins', 'Eva', 'Insoles', 'Buckles', 'Lace/Niwar', 'PVC Tube', 'Thread', 'Velcro'];
      for (const cat of basePOCats) {
        await client.query(
          `INSERT INTO custom_material_categories (category_name) VALUES ($1) ON CONFLICT (category_name) DO NOTHING`,
          [cat]
        );
      }
      console.log('[SEED] Base PO categories seeded into custom_material_categories');
    } catch (e: any) { console.warn('[SEED] base PO categories skipped:', e.message); }

    // Remove 'Others' from both mat_categories and custom_material_categories
    try {
      await client.query(`DELETE FROM mat_categories WHERE LOWER(category_name) LIKE '%others%'`);
      await client.query(`DELETE FROM custom_material_categories WHERE LOWER(category_name) LIKE '%others%'`);
      console.log('[MIGRATION] Removed Others categories');
    } catch (e: any) { console.warn('[MIGRATION] Others cleanup skipped:', e.message); }

    try {
      const { rows: [sc] } = await client.query(`SELECT COUNT(*) as cnt FROM hr_salary_components`);
      if (Number(sc.cnt) === 0) {
        await client.query(`
          INSERT INTO hr_salary_components (code, name, type, is_statutory) VALUES
          ('BASIC','Basic Wage','EARNING',1),
          ('DA','Dearness Allowance','EARNING',1),
          ('HRA','House Rent Allowance','EARNING',0),
          ('OT','Overtime Earnings','EARNING',0),
          ('OTHER_EARN','Other Allowances','EARNING',0),
          ('PF','Provident Fund (12%)','DEDUCTION',1),
          ('ESI','ESI Contribution (0.75%)','DEDUCTION',1),
          ('PT','Professional Tax','DEDUCTION',1),
          ('ADVANCE','Salary Advance','DEDUCTION',0),
          ('FINE','Fine / Penalty','DEDUCTION',0),
          ('FOOD','Food / Canteen Deduction','DEDUCTION',0),
          ('WELFARE','Welfare Fund','DEDUCTION',0)
          ON CONFLICT DO NOTHING
        `);
      }
    } catch (e: any) { console.warn('[SEED] hr_salary_components skipped:', e.message); }

    // ── Performance Indexes ───────────────────────────────────────────────
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_mat_inventory_cat ON mat_inventory (category_id)`,
      `CREATE INDEX IF NOT EXISTS idx_mat_inventory_status ON mat_inventory (status, is_deleted)`,
      `CREATE INDEX IF NOT EXISTS idx_mat_purchases_date ON mat_purchases (purchase_date)`,
      `CREATE INDEX IF NOT EXISTS idx_mat_movements_mat ON mat_movements (material_id, created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_hr_attendance_daily_lookup ON hr_attendance_daily (date, emp_id)`,
      `CREATE INDEX IF NOT EXISTS idx_hr_attendance_monthly_lookup ON hr_attendance_monthly (month_year, emp_id)`,
      `CREATE INDEX IF NOT EXISTS idx_daily_entries_lookup ON daily_entries (sheet_date, article_code, colour, is_deleted)`,
      `CREATE INDEX IF NOT EXISTS idx_inward_outward_lookup ON inward_outward (entry_date, article_code, is_deleted)`,
      `CREATE INDEX IF NOT EXISTS idx_scan_history_lookup ON scan_history (article_code, is_deleted)`,
      `CREATE INDEX IF NOT EXISTS idx_articles_lookup ON articles (article_code, is_deleted)`,
    ];
    for (const idx of indexes) {
      try { await client.query(idx); } catch { /* index already exists */ }
    }

    console.log('[DATABASE] Schema migration complete.');
  } catch (err: any) {
    console.error('[DATABASE MIGRATION ERROR]', err.message);
  } finally {
    client.release();
  }
}

// Run migrations at module load (Next.js server start)
ensureDatabaseSchema().catch(console.error);

// ─────────────────────────────────────────────────────────────────────────────
// One-time password migration: forces admin password to 'admin124536'
// Uses a system_settings flag so this ONLY runs once and never again.
// ─────────────────────────────────────────────────────────────────────────────
async function runOneTimePasswordMigration() {
  const bcrypt = (await import('bcryptjs')).default;
  const client = await pgPool.connect();
  try {
    // Check if already done
    const { rows: [flag] } = await client.query(
      `SELECT value FROM system_settings WHERE key = 'pw_migration_admin124536_done'`
    );
    if (flag?.value === '1') {
      console.log('[PW MIGRATION] Already applied, skipping.');
      return;
    }

    // Force-set admin password to admin124536
    const hash = bcrypt.hashSync('admin124536', 10);
    await client.query(
      `UPDATE users SET password_hash = $1, plain_password = $2 WHERE username = 'admin'`,
      [hash, 'admin124536']
    );
    console.log('[PW MIGRATION] ✅ Admin password forced to admin124536 on Railway server.');

    // Mark as done so it never runs again
    await client.query(`
      INSERT INTO system_settings (key, value) VALUES ('pw_migration_admin124536_done', '1')
      ON CONFLICT (key) DO UPDATE SET value = '1'
    `);
    console.log('[PW MIGRATION] Flag set. Will not run again.');
  } catch (err: any) {
    console.error('[PW MIGRATION ERROR]', err.message);
  } finally {
    client.release();
  }
}
runOneTimePasswordMigration().catch(console.error);


// ─────────────────────────────────────────────────────────────────────────────
// 3. SQL Translation Helper
//    Translates SQLite-style ? placeholders → PostgreSQL $1, $2, … and
//    appends RETURNING id to INSERT statements so callers can get lastInsertRowid.
// ─────────────────────────────────────────────────────────────────────────────
// Tables that do NOT have a serial 'id' column – never append RETURNING id
// intake_barcode_pool uses barcode TEXT PRIMARY KEY (no id column)
const NO_ID_TABLES = new Set([
  'system_settings', 'daily_sheets', 'intake_barcode_pool',
]);

function translateToPg(sql: string): { text: string; needsReturning: boolean } {
  let paramCount = 1;
  let converted = sql.replace(/\?/g, () => `$${paramCount++}`);

  let needsReturning = false;
  if (/^\s*INSERT\s+INTO/i.test(converted) && !/RETURNING\s+/i.test(converted)) {
    // Extract the table name from INSERT INTO <table>
    const tableMatch = converted.match(/INSERT\s+INTO\s+["']?(\w+)["']?/i);
    const tableName = tableMatch ? tableMatch[1].toLowerCase() : '';
    if (!NO_ID_TABLES.has(tableName)) {
      converted += ' RETURNING id';
      needsReturning = true;
    }
  }

  return { text: converted, needsReturning };
}

const DEBUG = process.env.NODE_ENV !== 'production';

// ─────────────────────────────────────────────────────────────────────────────
// 4. Database Adapter
//    Exposes the same prepare/get/all/run/exec/transaction API that every
//    API route in the project uses — now backed exclusively by PostgreSQL.
// ─────────────────────────────────────────────────────────────────────────────
const asyncLocalStorage = new AsyncLocalStorage<DatabaseAdapter>();

class DatabaseAdapter {
  private pgClient: any = null;

  setPgClient(client: any) {
    this.pgClient = client;
  }

  private get pool() {
    return this.pgClient || pgPool;
  }

  prepare(sql: string) {
    const { text: translatedSql, needsReturning } = translateToPg(sql);
    const start = Date.now();
    const pool = this.pool;

    return {
      get: async (...params: any[]) => {
        const sanitized = params.map(p => (p === undefined ? null : p));
        try {
          const res = await pool.query(translatedSql, sanitized);
          if (DEBUG) console.log(`[PG GET] ${Date.now() - start}ms`);
          return res.rows[0] ?? null;
        } catch (err: any) {
          console.error('[PG GET FAILED]', translatedSql, err.message);
          throw err;
        }
      },

      all: async (...params: any[]) => {
        const sanitized = params.map(p => (p === undefined ? null : p));
        try {
          const res = await pool.query(translatedSql, sanitized);
          if (DEBUG) console.log(`[PG ALL] ${Date.now() - start}ms`);
          return res.rows;
        } catch (err: any) {
          console.error('[PG ALL FAILED]', translatedSql, err.message);
          throw err;
        }
      },

      run: async (...params: any[]) => {
        const sanitized = params.map(p => (p === undefined ? null : p));
        try {
          const res = await pool.query(translatedSql, sanitized);
          if (DEBUG) console.log(`[PG RUN] ${Date.now() - start}ms`);
          const lastInsertRowid =
            needsReturning && res.rows.length > 0 ? res.rows[0].id : null;
          return { lastInsertRowid, changes: res.rowCount };
        } catch (err: any) {
          console.error('[PG RUN FAILED]', translatedSql, err.message);
          throw err;
        }
      },
    };
  }

  /** exec() is used for DDL statements (CREATE TABLE, ALTER TABLE, etc.).
   *  It runs the SQL directly against Postgres.  */
  async exec(sql: string): Promise<void> {
    // Silently skip SQLite-only pragmas
    if (/PRAGMA/i.test(sql)) return;
    try {
      await this.pool.query(sql);
    } catch (err: any) {
      // Non-fatal: log but do not crash the server
      console.error('[PG EXEC WARN]', err.message, sql.slice(0, 120));
    }
  }

  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    const client = await pgPool.connect();
    const txAdapter = new DatabaseAdapter();
    txAdapter.setPgClient(client);
    try {
      await client.query('BEGIN');
      const result = await asyncLocalStorage.run(txAdapter, callback);
      await client.query('COMMIT');
      return result;
    } catch (e: any) {
      await client.query('ROLLBACK');
      console.error('[DB TRANSACTION ROLLBACK]', e.message);
      throw e;
    } finally {
      client.release();
    }
  }
}

const baseDbInstance = new DatabaseAdapter();

export function getDb(): DatabaseAdapter {
  return asyncLocalStorage.getStore() ?? baseDbInstance;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Global Audit Log Utility
// ─────────────────────────────────────────────────────────────────────────────
export async function logAudit({
  userId, username, action, module, recordId,
  oldValue, newValue, oldVal, newVal, description,
}: any) {
  try {
    await pgPool.query(
      `INSERT INTO audit_logs (user_id, username, action, module, record_id, old_value, new_value, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, username, action, module, recordId, oldValue ?? oldVal ?? null, newValue ?? newVal ?? null, description ?? null]
    );
  } catch (e) {
    console.error('Audit log failed', e);
  }
}


