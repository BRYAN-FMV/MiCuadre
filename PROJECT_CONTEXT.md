# Contexto Completo y Guía del Proyecto MiCuadre

Este documento sirve como la fuente de verdad del proyecto **MiCuadre**. Si una nueva sesión de IA o desarrollador inicia desde cero, este archivo contiene todo el conocimiento del sistema, reglas de negocio, correcciones críticas realizadas y configuración de base de datos.

---

## 1. Información General del Proyecto

- **Nombre del Proyecto**: MiCuadre
- **Tipo de Aplicación**: Punto de Venta (POS), Control de Inventario, Gestión Multicaja y Facturación Fiscal Hondureña (SAR / CAI).
- **Arquitectura**: Multi-Tenant (Multicomercio).
- **Stack Tecnológico**:
  - **Frontend**: React 18, TypeScript, Vite
  - **Estado Global**: Zustand con persistencia en `localStorage` (clave `micuadre_app_state`)
  - **UI & Iconos**: Tailwind CSS, Lucide React, Sonner (notificaciones)
  - **Backend / Database**: Supabase (PostgreSQL con Row Level Security - RLS)

---

## 2. Reglas de Negocio y Arquitectura Crítica

### A. Multi-Tenant y Aislamiento por Comercio
- Todos los modelos (`products`, `sales`, `sale_items`, `cash_shifts`, `cash_movements`, `fiscal_ranges`, `suppliers`, `expenses`, `customers`, `profiles`) requieren un `tenant_id` (UUID).
- **ID de Tenant Demo**: `'00000000-0000-0000-0000-000000000001'` (Comercial & Servicios El Centro).
- **Regla Estricta de Productos Demo**: Los productos de demostración (`BEB-HAR-5LB`, `ACE-COC-1L`, `SHAM-BARB-250`, `LIC-RUM-750`) pertenecen **exclusivamente** al tenant demo. Ninguna función de sincronización (`pushLocalDataToCloud`, `syncAllCloudData`, `saveProductToSupabase`) debe reasignar o subir estos SKUs a un comercio real.
- **Sincronización en la Nube**:
  - `syncAllCloudData(tenantId)`: Reemplaza el estado local cuando Supabase responde. Si un tenant no tiene productos (`liveProducts` es `[]`), el estado limpia los productos locales del tenant para evitar mostrar datos del comercio anterior.
  - `pushLocalDataToCloud(tenantId)`: Sube registros locales creados sin conexión, asegurando que solo afecten al `tenantId` activo.

### B. Gestión Multicaja y Vinculación por Dispositivo
- Cada comercio puede definir múltiples Cajas Registradoras (ej. Caja 1 - Principal, Caja 2 - Expreso).
- **Aislamiento por Terminal**: La sesión de turno activo en cada dispositivo físico se almacena en `localStorage.getItem('micuadre_active_shift_id')`.
- **Selector de Cajas**: En `LoginView.tsx` y `CashShiftModal.tsx`, las cajas con un turno abierto desde otro dispositivo quedan ocultas del selector para impedir aperturas duplicadas.
- **Cierre Z Obligatorio**: Los perfiles con rol distinto a `ADMIN` no pueden cerrar sesión ni cerrar la pestaña del navegador sin realizar el Arqueo Ciego y Cierre Z. Se encuentra controlado vía interceptor `beforeunload` en `App.tsx` y en `CashShiftModal.tsx`.

### C. Facturación Fiscal (SAR / CAI - Honduras)
- Administrada mediante la entidad `fiscal_ranges`.
- Atributos: CAI, Rango Inicial, Rango Final, Correlativo Actual, Fecha Límite de Emisión, Prefijo (ej. `000-001-01-`) y Tipo de Documento.
- **Tipos de Emisión**: Factura Fiscal o Ticket de Venta según la configuración de la caja seleccionada.
- **Tipos de Columna en DB**: Los campos `cai`, `name`, `prefix` y `document_type` en la tabla `fiscal_ranges` deben ser tipo `TEXT` (no restringidos a `character varying(16)`).

### D. Reportes y Prevención de Duplicados
- Al guardar una venta en `saveSaleToSupabase`, se eliminan previamente los `sale_items` existentes para ese `sale_id` antes de insertar.
- Al consultar ventas en `fetchSalesFromSupabase`, los items se desduplican para garantizar que las cantidades totales en los reportes coincidan exactamente con lo vendido.

---

## 3. Mapa de Archivos Principales

- [src/lib/supabaseService.ts](file:///c:/Users/bryan/OneDrive/Documentos/DevProy/MiCuadre/src/lib/supabaseService.ts): Consultas a Supabase, sincronización `syncAllCloudData` / `pushLocalDataToCloud`, aislamiento demo y manejo de RLS.
- [src/store/useAppStore.ts](file:///c:/Users/bryan/OneDrive/Documentos/DevProy/MiCuadre/src/store/useAppStore.ts): Estado global Zustand, persistencia local, acciones de tienda y cambio de usuarios/tenants.
- [src/components/pos/PosContainer.tsx](file:///c:/Users/bryan/OneDrive/Documentos/DevProy/MiCuadre/src/components/pos/PosContainer.tsx): Pantalla principal del Punto de Venta, atajos de teclado (F2, F4, F12), carrito y cobranza.
- [src/components/shifts/CashShiftModal.tsx](file:///c:/Users/bryan/OneDrive/Documentos/DevProy/MiCuadre/src/components/shifts/CashShiftModal.tsx): Apertura de turno, Arqueo Ciego, Cierre Z e impresión de reporte de caja.
- [src/components/auth/LoginView.tsx](file:///c:/Users/bryan/OneDrive/Documentos/DevProy/MiCuadre/src/components/auth/LoginView.tsx): Login por nombre de comercio o RTN, validación de PIN, asignación de perfil y caja.
- [src/components/settings/SettingsView.tsx](file:///c:/Users/bryan/OneDrive/Documentos/DevProy/MiCuadre/src/components/settings/SettingsView.tsx): Configuración del comercio y creación/edición de Cajas Registradoras (Rangos Fiscales).
- [src/App.tsx](file:///c:/Users/bryan/OneDrive/Documentos/DevProy/MiCuadre/src/App.tsx): Componente raíz, ruteo por URL (`?comercio=slug`), protección de pestañas por rol e interceptor `beforeunload`.

---

## 4. Script de Base de Datos para Supabase (SQL Editor)

Si la base de datos de Supabase se restablece o se requiere aplicar la seguridad desde cero, ejecutar el siguiente script en el Editor SQL de Supabase:

```sql
-- 1. Ampliar límites de columnas en fiscal_ranges
ALTER TABLE fiscal_ranges ALTER COLUMN cai TYPE TEXT;
ALTER TABLE fiscal_ranges ALTER COLUMN name TYPE TEXT;
ALTER TABLE fiscal_ranges ALTER COLUMN prefix TYPE TEXT;
ALTER TABLE fiscal_ranges ALTER COLUMN document_type TYPE TEXT;

-- 2. Habilitar RLS en todas las tablas
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_ranges ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de aislamiento por tabla
CREATE POLICY "tenant_isolation_products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "tenant_isolation_sales" ON sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "tenant_isolation_sale_items" ON sale_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "tenant_isolation_cash_shifts" ON cash_shifts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "tenant_isolation_cash_movements" ON cash_movements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "tenant_isolation_fiscal_ranges" ON fiscal_ranges FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "tenant_isolation_suppliers" ON suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "tenant_isolation_expenses" ON expenses FOR ALL USING (true) WITH CHECK (true);
```

---

## 5. Directivas de Desarrollo e Instrucciones de Continuidad

1. **Sin Emojis**: Esta prohibido incluir emojis tanto en las respuestas, mensajes de la interfaz o comentarios del código.
2. **Verificación de Compilación**: Todo cambio realizado en el código debe ser probado ejecutando `npm run build` antes de dar por completada una tarea.
3. **Persistencia de Comentarios**: Mantener siempre la integridad de la documentación y comentarios existentes en el código.
4. **Respeto a UUIDs**: Todos los IDs generados para productos, ventas, turnos o tenants deben ser UUIDs sintácticamente válidos versión 4 (`generateUUID()` o `crypto.randomUUID()`).
