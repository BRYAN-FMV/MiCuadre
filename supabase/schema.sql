-- =========================================================
-- MiCuadre.app - Complete PostgreSQL Database Schema
-- Multi-Tenant SaaS, SAR Honduras Compliance, Kardex CPP,
-- Cash Shift Blind Closes, Wholesale Tiers, Services & Commissions
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TENANTS & PROFILES
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    rtn VARCHAR(14),
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    logo_url TEXT,
    business_type VARCHAR(50) DEFAULT 'RETAIL', -- 'RETAIL' | 'SERVICES' | 'WHOLESALE' | 'MIXED'
    is_fiscal_enabled BOOLEAN DEFAULT FALSE,     -- Module 4 Switch (SAR Honduras)
    is_services_enabled BOOLEAN DEFAULT TRUE,
    is_wholesale_enabled BOOLEAN DEFAULT TRUE,
    is_loyalty_enabled BOOLEAN DEFAULT TRUE,
    allow_negative_stock BOOLEAN DEFAULT FALSE,
    currency_symbol VARCHAR(5) DEFAULT 'L.',
    access_password VARCHAR(100),                -- Store master access password
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'CAJERO', -- 'ADMIN' | 'CAJERO' | 'BODEGUERO' | 'STAFF'
    pin_code VARCHAR(4),                       -- 4-digit fast POS PIN
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. FISCAL CONTROL (SAR HONDURAS)
CREATE TABLE fiscal_ranges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cai VARCHAR(40) NOT NULL,
    prefix VARCHAR(16) NOT NULL,        -- e.g. '000-001-01-'
    range_start INT NOT NULL,            -- e.g. 1
    range_end INT NOT NULL,              -- e.g. 5000
    current_number INT NOT NULL,         -- Last assigned consecutive
    deadline DATE NOT NULL,              -- Limit date
    document_type VARCHAR(10) DEFAULT '01', -- '01' Invoice, '04' Credit Note
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PRODUCTS & WHOLESALE TIERS
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sku VARCHAR(64) NOT NULL,
    barcode VARCHAR(64),
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100) DEFAULT 'General',
    unit_of_measure VARCHAR(20) DEFAULT 'UNID',
    cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,  -- Weighted Average Cost (CPP)
    sale_price NUMERIC(12, 2) NOT NULL,              -- Standard Retail Price
    current_stock INT NOT NULL DEFAULT 0,
    min_stock_alert INT DEFAULT 5,
    tax_classification VARCHAR(20) NOT NULL DEFAULT 'GRAVADO_15', -- 'EXENTO' | 'EXONERADO' | 'GRAVADO_15' | 'GRAVADO_18'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_tenant_barcode UNIQUE(tenant_id, barcode)
);

CREATE TABLE product_price_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    min_quantity INT NOT NULL,
    max_quantity INT, -- NULL means infinity
    unit_price NUMERIC(12, 2) NOT NULL,
    tier_name VARCHAR(50) DEFAULT 'Mayoreo',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. INVENTORY KARDEX
CREATE TABLE inventory_kardex (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    movement_type VARCHAR(20) NOT NULL,     -- 'PURCHASE_IN' | 'SALE_OUT' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'RETURN'
    reference_id UUID,                      -- ID of sales or purchase_invoices
    quantity_changed INT NOT NULL,          -- Positive on IN, negative on OUT
    cost_price NUMERIC(12, 2) NOT NULL,     -- Cost price associated to movement
    stock_after INT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CASH SHIFTS & BLIND CLOSE
CREATE TABLE cash_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id),
    opening_amount NUMERIC(12, 2) NOT NULL,
    closing_declared NUMERIC(12, 2),
    closing_system NUMERIC(12, 2),
    difference NUMERIC(12, 2),
    status VARCHAR(20) DEFAULT 'OPEN',      -- 'OPEN' | 'CLOSED'
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- 6. SUPPLIERS & PURCHASES
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    rtn VARCHAR(14),
    company_name VARCHAR(150) NOT NULL,
    contact_name VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    default_credit_days INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE purchase_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    invoice_number VARCHAR(32) NOT NULL,
    cai VARCHAR(40),
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    payment_terms VARCHAR(20) NOT NULL,         -- 'CASH' | 'CREDIT'
    payment_status VARCHAR(20) DEFAULT 'UNPAID', -- 'UNPAID' | 'PARTIAL' | 'PAID'
    subtotal NUMERIC(12, 2) NOT NULL,
    tax_amount NUMERIC(12, 2) DEFAULT 0.00,
    total NUMERIC(12, 2) NOT NULL,
    paid_amount NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. POS SALES & ITEMS
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cash_shift_id UUID REFERENCES cash_shifts(id),
    document_number VARCHAR(32) NOT NULL,
    is_fiscal BOOLEAN DEFAULT FALSE,
    cai VARCHAR(40),
    customer_rtn VARCHAR(14),
    customer_name VARCHAR(150) DEFAULT 'Consumidor Final',
    idempotency_key UUID UNIQUE,
    subtotal NUMERIC(12, 2) NOT NULL,
    discount_amount NUMERIC(12, 2) DEFAULT 0.00,
    exempt_amount NUMERIC(12, 2) DEFAULT 0.00,
    exonerated_amount NUMERIC(12, 2) DEFAULT 0.00,
    taxable_15 NUMERIC(12, 2) DEFAULT 0.00,
    tax_15 NUMERIC(12, 2) DEFAULT 0.00,
    taxable_18 NUMERIC(12, 2) DEFAULT 0.00,
    tax_18 NUMERIC(12, 2) DEFAULT 0.00,
    total NUMERIC(12, 2) NOT NULL,
    payment_method VARCHAR(20) DEFAULT 'CASH', -- 'CASH' | 'CARD' | 'TRANSFER' | 'MIXED'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    service_id UUID,                             -- Optional for service items
    staff_id UUID,                               -- Optional staff assigned for commissions
    quantity INT NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    discount_amount NUMERIC(12, 2) DEFAULT 0.00,
    tax_classification VARCHAR(20) NOT NULL,
    tax_amount NUMERIC(12, 2) NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL
);

-- 8. RETURNS & CREDIT NOTES (SAR)
CREATE TABLE sales_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES sales(id),
    cash_shift_id UUID REFERENCES cash_shifts(id),
    credit_note_number VARCHAR(32) NOT NULL,
    cai VARCHAR(40),
    reason TEXT NOT NULL,
    refund_method VARCHAR(20) NOT NULL,         -- 'CASH' | 'STORE_CREDIT'
    subtotal NUMERIC(12, 2) NOT NULL,
    tax_15 NUMERIC(12, 2) DEFAULT 0.00,
    tax_18 NUMERIC(12, 2) DEFAULT 0.00,
    total NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. SERVICES, APPOINTMENTS & COMMISSIONS
CREATE TABLE staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id),
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    duration_minutes INT DEFAULT 30,
    price NUMERIC(12, 2) NOT NULL,
    commission_type VARCHAR(20) NOT NULL DEFAULT 'PERCENTAGE', -- 'PERCENTAGE' | 'FIXED'
    commission_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_name VARCHAR(150) NOT NULL,
    customer_phone VARCHAR(20),
    staff_id UUID NOT NULL REFERENCES staff(id),
    service_id UUID NOT NULL REFERENCES services(id),
    scheduled_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'SCHEDULED', -- 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE staff_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff(id),
    sale_id UUID NOT NULL REFERENCES sales(id),
    service_id UUID REFERENCES services(id),
    sale_amount NUMERIC(12, 2) NOT NULL,
    commission_amount NUMERIC(12, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',  -- 'PENDING' | 'PAID'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. CUSTOMERS, CASH MOVEMENTS, EXPENSES & ACCOUNT PAYMENTS
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    rtn VARCHAR(14),
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    loyalty_points INT DEFAULT 0,
    total_spent NUMERIC(12, 2) DEFAULT 0.00,
    credit_limit NUMERIC(12, 2) DEFAULT 2000.00,
    credit_balance NUMERIC(12, 2) DEFAULT 0.00,
    credit_days INT DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cash_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cash_shift_id UUID REFERENCES cash_shifts(id) ON DELETE CASCADE,
    fiscal_range_id UUID,
    type VARCHAR(20) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    concept TEXT NOT NULL,
    registered_by VARCHAR(150),
    reference_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cash_shift_id UUID REFERENCES cash_shifts(id),
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    payment_method VARCHAR(20) DEFAULT 'CASH',
    registered_by VARCHAR(150),
    receipt_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS account_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL,
    customer_id UUID REFERENCES customers(id),
    customer_name VARCHAR(150),
    supplier_id UUID REFERENCES suppliers(id),
    supplier_name VARCHAR(150),
    purchase_invoice_id UUID REFERENCES purchase_invoices(id),
    sale_id UUID REFERENCES sales(id),
    amount NUMERIC(12, 2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL DEFAULT 'CASH',
    notes TEXT,
    cash_shift_id UUID REFERENCES cash_shifts(id),
    created_by VARCHAR(150),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. FINANCIAL CALENDAR & EVENTS
CREATE TABLE IF NOT EXISTS financial_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_type VARCHAR(30) NOT NULL,        -- 'SUPPLIER_PAYMENT' | 'SAR_DECLARATION' | 'SAR_CAI_EXPIRY' | 'COMMISSION_PAYOUT'
    title VARCHAR(150) NOT NULL,
    description TEXT,
    due_date DATE NOT NULL,
    amount NUMERIC(12, 2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'PENDING',   -- 'PENDING' | 'PAID' | 'DISMISSED'
    reference_id UUID,                      -- ID of purchase_invoices, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS POLICIES FOR ALL TABLES (Permite acceso de lectura y escritura para la llave anon pública)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_ranges ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_price_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_kardex ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_events ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso para anon (Desarrollo y Multi-tenant público)
CREATE POLICY "Allow public full access tenants" ON tenants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access profiles" ON profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access fiscal_ranges" ON fiscal_ranges FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access product_price_tiers" ON product_price_tiers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access inventory_kardex" ON inventory_kardex FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access cash_shifts" ON cash_shifts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access suppliers" ON suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access purchase_invoices" ON purchase_invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access sales" ON sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access sale_items" ON sale_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access sales_returns" ON sales_returns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access staff" ON staff FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access services" ON services FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access appointments" ON appointments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access staff_commissions" ON staff_commissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access financial_events" ON financial_events FOR ALL USING (true) WITH CHECK (true);

-- SEED DATA INICIAL
INSERT INTO tenants (id, name, rtn, phone, email, address, business_type, is_fiscal_enabled, allow_negative_stock)
VALUES ('00000000-0000-0000-0000-000000000001', 'MiCuadre Comercio Demo', '08011995123456', '9988-7766', 'contacto@micuadre.app', 'Tegucigalpa, Honduras', 'MIXED', true, false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, tenant_id, sku, barcode, name, category, unit_of_measure, cost_price, sale_price, current_stock, min_stock_alert, tax_classification)
VALUES 
('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'BEB-001', '7401001001', 'Coca-Cola 500ml Retornable', 'Bebidas', 'UNID', 15.00, 20.00, 48, 12, 'GRAVADO_15'),
('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', 'ABAR-002', '7401001002', 'Harina Maseca 1lb', 'Abarrotes', 'LB', 12.50, 16.00, 100, 20, 'EXENTO'),
('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000001', 'ABAR-003', '7401001003', 'Aceite Mazola 750ml', 'Abarrotes', 'UNID', 38.00, 48.00, 30, 8, 'GRAVADO_15')
ON CONFLICT (id) DO NOTHING;

INSERT INTO suppliers (id, tenant_id, rtn, company_name, contact_name, phone, email, default_credit_days)
VALUES 
('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000001', '08019999000111', 'Distribuidora Cervecería Hondureña', 'Carlos Mendoza', '2233-4455', 'pedidos@cerveceria.hn', 15)
ON CONFLICT (id) DO NOTHING;

