-- =========================================================================
-- MiCuadre.app - Migration: Modulo Gastronomico (Restaurantes, Comedores y Cafeterias)
-- Ejecutar en Supabase -> SQL Editor para actualizar la base de datos
-- =========================================================================

-- 1. Habilitar la bandera del modulo en la tabla tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_food_enabled BOOLEAN DEFAULT FALSE;

-- 2. Tabla de Platos y Bebidas del Menu (menu_items)
CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'General',
    price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tax_classification VARCHAR(20) DEFAULT 'EXENTO',
    is_available BOOLEAN DEFAULT TRUE,
    available_extras JSONB DEFAULT '[]'::jsonb,
    default_notes TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices para busqueda rapida y filtro de disponibilidad diaria
CREATE INDEX IF NOT EXISTS idx_menu_items_tenant_id ON menu_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_availability ON menu_items(tenant_id, is_available);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(tenant_id, category);

-- 3. Tabla de Repartidores (delivery_drivers)
CREATE TABLE IF NOT EXISTS delivery_drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(30),
    driver_type VARCHAR(30) NOT NULL DEFAULT 'INTERNAL', -- 'INTERNAL' o 'EXTERNAL_MANDADITO'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices para repartidores
CREATE INDEX IF NOT EXISTS idx_delivery_drivers_tenant ON delivery_drivers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_delivery_drivers_active ON delivery_drivers(tenant_id, is_active);

-- 4. Tabla de Cuentas y Comandas Gastronomicas (food_orders)
CREATE TABLE IF NOT EXISTS food_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_number VARCHAR(30) NOT NULL,
    delivery_type VARCHAR(30) NOT NULL DEFAULT 'DINE_IN', -- 'DINE_IN' | 'TAKE_OUT' | 'DELIVERY'
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN',          -- 'OPEN' | 'ORDERED' | 'PREPARING' | 'SERVED' | 'IN_TRANSIT' | 'COMPLETED' | 'DELIVERED' | 'CANCELLED'
    
    -- Atributos para consumo en local
    table_number VARCHAR(50),
    
    -- Atributos para pedidos a domicilio o para llevar
    customer_name VARCHAR(150),
    customer_phone VARCHAR(30),
    delivery_phone VARCHAR(30),
    delivery_address TEXT,
    delivery_fee NUMERIC(12, 2) DEFAULT 0.00,
    
    -- Asignacion y liquidacion de repartidores
    driver_id UUID REFERENCES delivery_drivers(id) ON DELETE SET NULL,
    driver_name VARCHAR(150),
    driver_type VARCHAR(30),
    driver_settled BOOLEAN DEFAULT FALSE,
    
    -- Detalle de platos, complementos y notas en formato JSONB
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    
    -- Cobro y facturacion final
    payment_method VARCHAR(20),
    is_paid BOOLEAN DEFAULT FALSE,
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices para ordenes y comandas
CREATE INDEX IF NOT EXISTS idx_food_orders_tenant_status ON food_orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_food_orders_tenant_delivery ON food_orders(tenant_id, delivery_type);
CREATE INDEX IF NOT EXISTS idx_food_orders_driver ON food_orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_food_orders_created_at ON food_orders(tenant_id, created_at DESC);

-- 5. Habilitar Seguridad a Nivel de Fila (Row Level Security - RLS)
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_orders ENABLE ROW LEVEL SECURITY;

-- Politicas para acceso publico / desarrollo
DROP POLICY IF EXISTS "Allow public full access menu_items" ON menu_items;
CREATE POLICY "Allow public full access menu_items" ON menu_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public full access delivery_drivers" ON delivery_drivers;
CREATE POLICY "Allow public full access delivery_drivers" ON delivery_drivers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public full access food_orders" ON food_orders;
CREATE POLICY "Allow public full access food_orders" ON food_orders FOR ALL USING (true) WITH CHECK (true);

-- Politicas estrictas de aislamiento multi-tenant si existe la funcion current_tenant_id()
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_tenant_id') THEN
    DROP POLICY IF EXISTS "Strict Tenant Isolation Menu Items" ON menu_items;
    CREATE POLICY "Strict Tenant Isolation Menu Items" ON menu_items
      FOR ALL
      USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL)
      WITH CHECK (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);

    DROP POLICY IF EXISTS "Strict Tenant Isolation Delivery Drivers" ON delivery_drivers;
    CREATE POLICY "Strict Tenant Isolation Delivery Drivers" ON delivery_drivers
      FOR ALL
      USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL)
      WITH CHECK (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);

    DROP POLICY IF EXISTS "Strict Tenant Isolation Food Orders" ON food_orders;
    CREATE POLICY "Strict Tenant Isolation Food Orders" ON food_orders
      FOR ALL
      USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL)
      WITH CHECK (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);
  END IF;
END $$;

-- 6. Recargar cache de PostgREST en Supabase de forma inmediata
NOTIFY pgrst, 'reload schema';
