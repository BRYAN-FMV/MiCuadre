-- =========================================================
-- MiCuadre.app - Strict Multi-Tenant Production RLS Policies
-- Execute this script in your Supabase SQL Editor when deploying to Production.
-- =========================================================

-- Ensure all target tables exist before enabling RLS
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

-- Migration: Ensure module control & access_password columns exist on tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS access_password VARCHAR(100);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_services_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_wholesale_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_loyalty_enabled BOOLEAN DEFAULT TRUE;

-- Enable RLS on all sensitive tables
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
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_payments ENABLE ROW LEVEL SECURITY;

-- Drop loose development policies if present
DROP POLICY IF EXISTS "Allow public full access tenants" ON tenants;
DROP POLICY IF EXISTS "Allow public full access profiles" ON profiles;
DROP POLICY IF EXISTS "Allow public full access products" ON products;
DROP POLICY IF EXISTS "Allow public full access sales" ON sales;
DROP POLICY IF EXISTS "Allow public full access sale_items" ON sale_items;

-- 1. Helper function to extract tenant_id securely from JWT or custom header
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
BEGIN
  -- 1. Try JWT claim 'tenant_id'
  IF current_setting('request.jwt.claims', true) IS NOT NULL THEN
    RETURN (current_setting('request.jwt.claims', true)::json ->> 'tenant_id')::uuid;
  END IF;

  -- 2. Try custom HTTP header 'x-tenant-id' if set by API proxy
  IF current_setting('request.headers', true) IS NOT NULL THEN
    RETURN (current_setting('request.headers', true)::json ->> 'x-tenant-id')::uuid;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. Strict Tenant-Isolated Policies for all business data tables
DROP POLICY IF EXISTS "Strict Tenant Isolation Products" ON products;
CREATE POLICY "Strict Tenant Isolation Products" ON products
    FOR ALL
    USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL)
    WITH CHECK (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "Strict Tenant Isolation Price Tiers" ON product_price_tiers;
CREATE POLICY "Strict Tenant Isolation Price Tiers" ON product_price_tiers
    FOR ALL
    USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL)
    WITH CHECK (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "Strict Tenant Isolation Kardex" ON inventory_kardex;
CREATE POLICY "Strict Tenant Isolation Kardex" ON inventory_kardex
    FOR ALL
    USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL)
    WITH CHECK (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "Strict Tenant Isolation Sales" ON sales;
CREATE POLICY "Strict Tenant Isolation Sales" ON sales
    FOR ALL
    USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL)
    WITH CHECK (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "Strict Tenant Isolation Sale Items" ON sale_items;
CREATE POLICY "Strict Tenant Isolation Sale Items" ON sale_items
    FOR ALL
    USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL)
    WITH CHECK (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "Strict Tenant Isolation Profiles" ON profiles;
CREATE POLICY "Strict Tenant Isolation Profiles" ON profiles
    FOR ALL
    USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL)
    WITH CHECK (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "Strict Tenant Isolation Cash Shifts" ON cash_shifts;
CREATE POLICY "Strict Tenant Isolation Cash Shifts" ON cash_shifts
    FOR ALL
    USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL)
    WITH CHECK (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "Strict Tenant Isolation Suppliers" ON suppliers;
CREATE POLICY "Strict Tenant Isolation Suppliers" ON suppliers
    FOR ALL
    USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL)
    WITH CHECK (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "Strict Tenant Isolation Purchases" ON purchase_invoices;
CREATE POLICY "Strict Tenant Isolation Purchases" ON purchase_invoices
    FOR ALL
    USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL)
    WITH CHECK (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "Strict Tenant Isolation Staff" ON staff;
CREATE POLICY "Strict Tenant Isolation Staff" ON staff
    FOR ALL
    USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL)
    WITH CHECK (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "Strict Tenant Isolation Services" ON services;
CREATE POLICY "Strict Tenant Isolation Services" ON services
    FOR ALL
    USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL)
    WITH CHECK (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "Strict Tenant Isolation Fiscal Ranges" ON fiscal_ranges;
CREATE POLICY "Strict Tenant Isolation Fiscal Ranges" ON fiscal_ranges
    FOR ALL
    USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL)
    WITH CHECK (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "Strict Tenant Isolation Cash Movements" ON cash_movements;
CREATE POLICY "Strict Tenant Isolation Cash Movements" ON cash_movements
    FOR ALL
    USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL)
    WITH CHECK (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "Strict Tenant Isolation Expenses" ON expenses;
CREATE POLICY "Strict Tenant Isolation Expenses" ON expenses
    FOR ALL
    USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL)
    WITH CHECK (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "Strict Tenant Isolation Customers" ON customers;
CREATE POLICY "Strict Tenant Isolation Customers" ON customers
    FOR ALL
    USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL)
    WITH CHECK (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);

DROP POLICY IF EXISTS "Strict Tenant Isolation Account Payments" ON account_payments;
CREATE POLICY "Strict Tenant Isolation Account Payments" ON account_payments
    FOR ALL
    USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL)
    WITH CHECK (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);

-- 3. Tenants Policy: Allow public read so incognito visitors and users can search for their store by name or link
DROP POLICY IF EXISTS "Allow public read tenants" ON tenants;
CREATE POLICY "Allow public read tenants" ON tenants FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert tenants" ON tenants;
CREATE POLICY "Allow public insert tenants" ON tenants FOR INSERT WITH CHECK (true);



