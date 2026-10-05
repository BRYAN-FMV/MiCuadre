# MiCuadre - Sistema POS y Gestión de Negocios Multi-Tenant

MiCuadre es una plataforma web moderna para la administración de comercios, control de inventario, gestión multicaja y facturación fiscal adaptada a las normativas de Honduras (SAR / CAI).

---

## Arquitectura y Características Principales

### 1. Multi-Tenant (Aislamiento por Comercio)
- Todos los recursos (productos, ventas, turnos, clientes, proveedores, finanzas) están aislados mediante `tenant_id` (UUID).
- Políticas de Row Level Security (RLS) en Supabase para garantizar la privacidad y separación total entre tiendas.
- Sincronización bidireccional en tiempo real entre el almacenamiento local (`Zustand` + `localStorage`) y la nube (Supabase).
- Reglas estrictas para evitar la filtración de productos o datos de prueba entre comercios.

### 2. Gestión Multicaja y Control de Dispositivos
- Configuración de múltiples Cajas Registradoras (Caja Principal, Caja Expreso, etc.) asignadas por rango fiscal.
- Vinculación de sesiones por terminal/dispositivo (`micuadre_active_shift_id`).
- Selector dinámico de cajas: Oculta las cajas que se encuentran operativas en otros dispositivos.
- Obligatoriedad de Arqueo Ciego y Cierre Z para cajeros antes de salir de la aplicación o cerrar la pestaña del navegador.

### 3. Facturación Fiscal (SAR / CAI) y Tickets
- Administración de Rangos Fiscales: CAI, rango inicial, rango final, correlativo actual, fecha límite de emisión y prefijo.
- Emisión de Facturas Fiscales o Tickets de Venta por caja.
- Impresión de recibos térmicos compatibles con impresoras ESC/POS.

### 4. Punto de Venta (POS)
- Interfaz optimizada para agilidad en caja con atajos de teclado:
  - **F2**: Búsqueda rápida de productos / escaneo de código de barras.
  - **F4**: Selección o registro de cliente / puntos de lealtad.
  - **F12 / Ctrl+Enter**: Procesar cobro.
  - **Esc**: Cerrar ventanas modales.
- Soporte para órdenes en espera (carritos suspendidos).
- Múltiples medios de pago: Efectivo, Tarjeta, Transferencia, Pago Mixto y Crédito.
- Sistema de acumulación y canje de puntos de lealtad por cliente.

### 5. Inventario y Precios Escalonados
- Catálogo de productos con SKU, código de barras, categoría, clasificación fiscal (GRAVADO 15%, GRAVADO 18%, EXENTO) y alertas de stock mínimo.
- Precios por escala o mayoreo basados en rangos de cantidad.
- Sincronización inmediata de stock tras cada venta procesada.

---

## Estructura del Proyecto

```
MiCuadre/
├── src/
│   ├── components/
│   │   ├── auth/            # Login, verificación de PIN y selector de cajas
│   │   ├── pos/             # Interfaz del Punto de Venta (POS) y cobro
│   │   ├── shifts/          # Gestión de Turnos de Caja (Apertura, Arqueo Z)
│   │   ├── inventory/       # Administrador de Productos e Inventario
│   │   ├── purchases/       # Facturas de Compra y Proveedores
│   │   ├── reports/         # Reportes de Ventas, Cierres Z y Utilidad
│   │   ├── settings/        # Configuración del Comercio y Rangos Fiscales
│   │   ├── accounts/        # Cuentas por Cobrar y Créditos de Clientes
│   │   ├── services/        # Servicios, Citas y Personal
│   │   └── superadmin/      # Panel de Administración Global
│   ├── lib/
│   │   ├── supabase.ts      # Cliente y configuración de Supabase
│   │   ├── supabaseService.ts# Servicio de sincronización y consultas a Supabase
│   │   ├── mockData.ts      # Datos iniciales para entorno de demostración
│   │   ├── monetary.ts      # Utilidades financieras y cálculo de impuestos
│   │   ├── escPos.ts        # Generador de comandos ESC/POS para impresión
│   │   └── security.ts      # Funciones de hash, validación UUID y slugs
│   ├── store/
│   │   └── useAppStore.ts   # Estado global Zustand con persistencia local
│   ├── types/
│   │   └── index.ts         # Definiciones de TypeScript
│   ├── App.tsx              # Componente principal y ruteo de la aplicación
│   └── main.tsx             # Punto de entrada de React
├── supabase/
│   ├── schema.sql           # Esquema de tablas de la base de datos PostgreSQL
│   ├── rpc_functions.sql    # Funciones RPC de base de datos
│   └── production_security_rls.sql # Políticas de seguridad RLS
├── package.json
└── vite.config.ts
```

---

## Tecnologías Utilizadas

- **Frontend**: React 18, TypeScript, Vite
- **Estado Global**: Zustand con middleware de persistencia
- **Estilos**: Tailwind CSS, Lucide React Icons
- **Base de Datos & Backend**: Supabase (PostgreSQL, Realtime, RLS)
- **Notificaciones**: Sonner

---

## Comandos de Desarrollo

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Compilar para producción
npm run build

# Previsualizar compilación de producción
npm run preview
```
