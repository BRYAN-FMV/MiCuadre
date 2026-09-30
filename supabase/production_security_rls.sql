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

-- 2. Strict Tenant-Isolated Policies
CREATE POLICY "Strict Tenant Isolation Products" ON products
    FOR ALL
    USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL)
    WITH CHECK (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);

CREATE POLICY "Strict Tenant Isolation Sales" ON sales
    FOR ALL
    USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL)
    WITH CHECK (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);

CREATE POLICY "Strict Tenant Isolation Profiles" ON profiles
    FOR ALL
    USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL)
    WITH CHECK (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);

CREATE POLICY "Strict Tenant Isolation Cash Shifts" ON cash_shifts
    FOR ALL
    USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL)
    WITH CHECK (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);
