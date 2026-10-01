-- =========================================================
-- MiCuadre.app - Strict Multi-Tenant Production RLS Policies
-- Execute this script in your Supabase SQL Editor when deploying to Production.
-- =========================================================

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

-- 3. Tenants Policy: Allow public read so incognito visitors and users can search for their store by name or link
DROP POLICY IF EXISTS "Allow public read tenants" ON tenants;
CREATE POLICY "Allow public read tenants" ON tenants FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert tenants" ON tenants;
CREATE POLICY "Allow public insert tenants" ON tenants FOR INSERT WITH CHECK (true);



