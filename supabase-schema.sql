-- ============================================================================
-- LUNAR'S WMS — FULL POSTGRESQL SCHEMA
-- Run this ONCE in Supabase SQL Editor to create all tables
-- ============================================================================

-- 1. USERS & AUTHENTICATION
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'operator',
    phone TEXT,
    plain_password TEXT,
    is_active INTEGER DEFAULT 1,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS login_activity (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    username TEXT,
    action TEXT,
    ip_address TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS otp_verifications (
    id SERIAL PRIMARY KEY,
    phone TEXT NOT NULL,
    otp TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    verified INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(id)
);

-- 3. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    username TEXT,
    action TEXT NOT NULL,
    module TEXT,
    record_id INTEGER,
    old_value TEXT,
    new_value TEXT,
    description TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. DAILY STOCK MANAGEMENT
CREATE TABLE IF NOT EXISTS daily_sheets (
    id SERIAL PRIMARY KEY,
    sheet_date TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'open',
    locked_by INTEGER REFERENCES users(id),
    locked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_stock (
    id SERIAL PRIMARY KEY,
    sheet_date TEXT NOT NULL,
    article_code TEXT NOT NULL,
    colour TEXT NOT NULL,
    size TEXT NOT NULL,
    opening_stock NUMERIC DEFAULT 0,
    inward_stock NUMERIC DEFAULT 0,
    outward_stock NUMERIC DEFAULT 0,
    machine_return_stock NUMERIC DEFAULT 0,
    semi_finished_stock NUMERIC DEFAULT 0,
    closing_stock NUMERIC DEFAULT 0,
    total_available NUMERIC DEFAULT 0,
    remarks TEXT,
    is_duplicate INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_entries (
    id SERIAL PRIMARY KEY,
    sheet_date TEXT NOT NULL,
    sl_no INTEGER,
    article_code TEXT NOT NULL,
    description TEXT,
    colour TEXT NOT NULL,
    size_6 NUMERIC DEFAULT 0,
    size_7 NUMERIC DEFAULT 0,
    size_8 NUMERIC DEFAULT 0,
    size_9 NUMERIC DEFAULT 0,
    size_10 NUMERIC DEFAULT 0,
    size_11 NUMERIC DEFAULT 0,
    size_12 NUMERIC DEFAULT 0,
    entry_type TEXT DEFAULT 'inward',
    remarks TEXT,
    status TEXT DEFAULT 'draft',
    is_duplicate INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    approved_by INTEGER,
    approved_at TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. V-STRAP TRACKING
CREATE TABLE IF NOT EXISTS v_strap (
    id SERIAL PRIMARY KEY,
    entry_date TEXT NOT NULL,
    article_code TEXT NOT NULL,
    colour TEXT NOT NULL,
    opening_stock NUMERIC DEFAULT 0,
    inward_qty NUMERIC DEFAULT 0,
    outward_qty NUMERIC DEFAULT 0,
    remarks TEXT,
    is_deleted INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. INWARD / OUTWARD REGISTER
CREATE TABLE IF NOT EXISTS inward_outward (
    id SERIAL PRIMARY KEY,
    entry_date TEXT NOT NULL,
    article_code TEXT NOT NULL,
    description TEXT,
    colour TEXT NOT NULL,
    size TEXT,
    opening_stock NUMERIC DEFAULT 0,
    inward_qty NUMERIC DEFAULT 0,
    outward_qty NUMERIC DEFAULT 0,
    remarks TEXT,
    entry_type TEXT DEFAULT 'inward',
    is_deleted INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. INVENTORY POOL (Staging Loose Stock)
CREATE TABLE IF NOT EXISTS inventory_pool (
    id SERIAL PRIMARY KEY,
    article_code TEXT NOT NULL,
    colour TEXT NOT NULL,
    total_qty NUMERIC DEFAULT 0,
    size_5 NUMERIC DEFAULT 0,
    size_6 NUMERIC DEFAULT 0,
    size_7 NUMERIC DEFAULT 0,
    size_8 NUMERIC DEFAULT 0,
    size_9 NUMERIC DEFAULT 0,
    size_10 NUMERIC DEFAULT 0,
    size_11 NUMERIC DEFAULT 0,
    size_12 NUMERIC DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(article_code, colour)
);

-- 8. INWARD INVENTORY TRANSACTIONS
CREATE TABLE IF NOT EXISTS inward_inventory_transactions (
    id SERIAL PRIMARY KEY,
    article_code TEXT NOT NULL,
    colour TEXT NOT NULL,
    size TEXT NOT NULL,
    quantity NUMERIC DEFAULT 0,
    operator_id INTEGER REFERENCES users(id),
    type TEXT DEFAULT 'scan',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. SCAN HISTORY
CREATE TABLE IF NOT EXISTS scan_history (
    id SERIAL PRIMARY KEY,
    barcode TEXT,
    article_code TEXT NOT NULL,
    colour TEXT NOT NULL,
    size TEXT NOT NULL,
    operator_id INTEGER REFERENCES users(id),
    carton_id TEXT,
    status TEXT DEFAULT 'accepted',
    is_deleted INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. CARTON GENERATION CONFIGS
CREATE TABLE IF NOT EXISTS carton_generation (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    total_pairs INTEGER NOT NULL,
    is_custom INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS carton_generation_sizes (
    id SERIAL PRIMARY KEY,
    config_id INTEGER REFERENCES carton_generation(id) ON DELETE CASCADE,
    size TEXT NOT NULL,
    quantity INTEGER NOT NULL
);

-- 11. PACKING TRANSACTIONS (Scanner Mode)
CREATE TABLE IF NOT EXISTS packing_transactions (
    id SERIAL PRIMARY KEY,
    transaction_id TEXT UNIQUE NOT NULL,
    article_code TEXT NOT NULL,
    colour TEXT NOT NULL,
    config_id INTEGER REFERENCES carton_generation(id),
    num_cartons INTEGER DEFAULT 1,
    total_pairs INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS packing_items (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER REFERENCES packing_transactions(id) ON DELETE CASCADE,
    size TEXT NOT NULL,
    quantity_per_carton INTEGER DEFAULT 0,
    total_quantity INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cartons (
    id SERIAL PRIMARY KEY,
    carton_id TEXT UNIQUE NOT NULL,
    transaction_id INTEGER,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. OUTWARD TRANSACTIONS (Carton Generation)
CREATE TABLE IF NOT EXISTS outward_transactions (
    id SERIAL PRIMARY KEY,
    transaction_id TEXT UNIQUE NOT NULL,
    article_code TEXT NOT NULL,
    colour TEXT NOT NULL,
    config_id INTEGER REFERENCES carton_generation(id),
    num_cartons INTEGER DEFAULT 1,
    total_pairs INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    is_deleted INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS outward_items (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER REFERENCES outward_transactions(id) ON DELETE CASCADE,
    size TEXT NOT NULL,
    quantity_per_carton INTEGER DEFAULT 0,
    total_quantity INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS packed_cartons (
    id SERIAL PRIMARY KEY,
    carton_id TEXT UNIQUE NOT NULL,
    transaction_id INTEGER REFERENCES outward_transactions(id),
    status TEXT DEFAULT 'completed',
    is_deleted INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. PURCHASE ORDERS
CREATE TABLE IF NOT EXISTS purchase_orders (
    id SERIAL PRIMARY KEY,
    po_number TEXT UNIQUE NOT NULL,
    po_date TEXT,
    vendor TEXT,
    status TEXT DEFAULT 'draft',
    created_by INTEGER REFERENCES users(id),
    created_by_username TEXT,
    
    -- Financial Fields (Accountant)
    invoice_number TEXT,
    transport_charge NUMERIC DEFAULT 0,
    gross_amount NUMERIC DEFAULT 0,
    net_amount NUMERIC DEFAULT 0,
    grand_total NUMERIC DEFAULT 0,
    amount_paid NUMERIC DEFAULT 0,
    balance_amount NUMERIC DEFAULT 0,
    payment_status TEXT DEFAULT 'unpaid',
    shipping_method TEXT,
    delivery_status TEXT DEFAULT 'pending',
    
    -- Approval Fields
    approved_by INTEGER,
    approved_timestamp TEXT,
    rejection_reason TEXT,
    
    -- Accountant Fields
    accountant_updated_by INTEGER,
    accountant_updated_at TIMESTAMP,
    
    -- Metadata
    is_deleted INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id SERIAL PRIMARY KEY,
    po_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
    sl_no INTEGER,
    material_code TEXT,
    material_name TEXT,
    description TEXT,
    size_thickness TEXT,
    unit TEXT,
    current_stock NUMERIC DEFAULT 0,
    required_qty NUMERIC DEFAULT 0,
    required_quantity NUMERIC DEFAULT 0,
    order_rate NUMERIC DEFAULT 0,
    amount NUMERIC DEFAULT 0,
    vendor TEXT,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 14. PO APPROVAL & ACTIVITY TRACKING
CREATE TABLE IF NOT EXISTS po_approval_history (
    id SERIAL PRIMARY KEY,
    po_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    actor_id INTEGER,
    actor_name TEXT,
    comments TEXT,
    ist_timestamp TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS po_activity_logs (
    id SERIAL PRIMARY KEY,
    po_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
    user_id INTEGER,
    username TEXT,
    action TEXT NOT NULL,
    description TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 15. PO NOTIFICATIONS
CREATE TABLE IF NOT EXISTS po_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    po_id INTEGER,
    po_number TEXT,
    type TEXT,
    message TEXT,
    is_read INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_daily_stock_lookup ON daily_stock(article_code, colour, size, sheet_date);
CREATE INDEX IF NOT EXISTS idx_daily_stock_date ON daily_stock(sheet_date);
CREATE INDEX IF NOT EXISTS idx_daily_entries_date ON daily_entries(sheet_date);
CREATE INDEX IF NOT EXISTS idx_inventory_pool_article ON inventory_pool(article_code, colour);
CREATE INDEX IF NOT EXISTS idx_scan_history_barcode ON scan_history(barcode);
CREATE INDEX IF NOT EXISTS idx_scan_history_date ON scan_history(created_at);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_deleted ON purchase_orders(is_deleted);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_po_activity_po ON po_activity_logs(po_id);
CREATE INDEX IF NOT EXISTS idx_po_notifications_user ON po_notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_v_strap_date ON v_strap(entry_date);

-- ============================================================================
-- SEED DEFAULT ADMIN USER (password: admin123)
-- ============================================================================
INSERT INTO users (username, password_hash, full_name, role, phone, plain_password)
VALUES ('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'System Administrator', 'admin', NULL, 'admin123')
ON CONFLICT (username) DO NOTHING;

-- ============================================================================
-- SEED DAILY SHEETS FOR MAY 2026
-- ============================================================================
INSERT INTO daily_sheets (sheet_date, status) VALUES
('2026-05-01', 'open'), ('2026-05-02', 'open'), ('2026-05-03', 'open'),
('2026-05-04', 'open'), ('2026-05-05', 'open'), ('2026-05-06', 'open'),
('2026-05-07', 'open'), ('2026-05-08', 'open'), ('2026-05-09', 'open'),
('2026-05-10', 'open'), ('2026-05-11', 'open'), ('2026-05-12', 'open'),
('2026-05-13', 'open'), ('2026-05-14', 'open'), ('2026-05-15', 'open'),
('2026-05-16', 'open'), ('2026-05-17', 'open'), ('2026-05-18', 'open'),
('2026-05-19', 'open'), ('2026-05-20', 'open'), ('2026-05-21', 'open'),
('2026-05-22', 'open'), ('2026-05-23', 'open'), ('2026-05-24', 'open'),
('2026-05-25', 'open'), ('2026-05-26', 'open'), ('2026-05-27', 'open'),
('2026-05-28', 'open'), ('2026-05-29', 'open'), ('2026-05-30', 'open'),
('2026-05-31', 'open')
ON CONFLICT (sheet_date) DO NOTHING;

-- ============================================================================
-- DONE! Your database is ready for Lunar's WMS.
-- ============================================================================
