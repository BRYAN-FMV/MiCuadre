-- =========================================================================
-- MiCuadre.app - Migration: Columnas de Módulos SaaS y Fidelización en Tenants
-- Ejecutar en Supabase -> SQL Editor para actualizar el esquema de producción
-- =========================================================================

-- 1. Agregar columnas de módulos y configuración si no existen
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_loyalty_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_services_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_wholesale_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS access_password VARCHAR(100);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS allow_negative_stock BOOLEAN DEFAULT FALSE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS currency_symbol VARCHAR(5) DEFAULT 'L.';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 2. Recargar caché de esquema de PostgREST en Supabase de forma inmediata
NOTIFY pgrst, 'reload schema';
