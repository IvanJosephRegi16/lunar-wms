-- ==========================================
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
  total_qty INTEGER DEFAULT 0,
  UNIQUE(article_code, colour)
);

-- 8. PURCHASE ORDER (PO) WORKFLOW
CREATE TABLE IF NOT EXISTS purchase_orders (
  id SERIAL PRIMARY KEY,
  po_number TEXT UNIQUE NOT NULL,
  vendor TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'pending_admin_approval', 'returned_for_edit', 'rejected', 'accountant_processing', 'supervisor_review', 'completed')),
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
  po_date TEXT
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
  remarks TEXT
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
  po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  po_number TEXT NOT NULL,
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
VALUES ('admin', '$2a$10$WpQpG7hGgqj0iNfN7AOY2ewb2F6p.4w/0zJb7q3yQd2f8rW9z1BGy', 'System Admin', 'admin', 'admin123')
ON CONFLICT DO NOTHING;
