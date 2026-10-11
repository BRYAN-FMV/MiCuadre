-- =========================================================================
-- MiCuadre.app - Migration: Columnas SaaS y Politicas RLS para Tenants
-- Ejecutar en Supabase -> SQL Editor para actualizar el esquema de produccion
-- =========================================================================

-- 1. Agregar columnas de modulos y configuracion si no existen
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_loyalty_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_services_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_wholesale_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS access_password VARCHAR(100);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS allow_negative_stock BOOLEAN DEFAULT FALSE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS currency_symbol VARCHAR(5) DEFAULT 'L.';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 2. Asegurar politicas RLS completas en 'tenants' (lectura, insercion, actualizacion y eliminacion)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read tenants" ON tenants;
DROP POLICY IF EXISTS "Allow public insert tenants" ON tenants;
DROP POLICY IF EXISTS "Allow public update tenants" ON tenants;
DROP POLICY IF EXISTS "Allow public delete tenants" ON tenants;
DROP POLICY IF EXISTS "Allow public full access tenants" ON tenants;

CREATE POLICY "Allow public full access tenants" ON tenants
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 3. Agregar columna de presentaciones de empaque a la tabla 'products'
ALTER TABLE products ADD COLUMN IF NOT EXISTS presentations JSONB DEFAULT '[]'::jsonb;

-- 4. Recargar cache de esquema de PostgREST en Supabase de forma inmediata
NOTIFY pgrst, 'reload schema';
