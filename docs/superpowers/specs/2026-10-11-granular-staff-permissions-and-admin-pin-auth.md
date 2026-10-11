# Especificación de Diseño: Permisos Granulares de Personal y Autorización por PIN de Administrador (Mecanismo B)

## 1. Resumen Ejecutivo
Permitir al administrador de cada comercio asignar permisos manuales e individuales a cajeros y colaboradores (`canApplyDiscounts`, `canSellCredit`, `canVoidSales`, `canViewCostPrices`, `canEditCatalog`, `canRegisterAdjustments`, `canOpenDrawerNoSale`). 

Cuando un cajero intente realizar una acción para la cual no tiene permiso directo, el sistema no bloqueará la operación de forma definitiva, sino que activará el **Mecanismo B**: un modal emergente de **Autorización al Instante con PIN de Administrador**, permitiendo que el encargado autorice la transacción en segundos sin cerrar la sesión del cajero.

---

## 2. Modelo de Datos y Tipos (`src/types/index.ts`)

```typescript
export interface UserPermissions {
  // Ventas & POS
  canApplyDiscounts?: boolean;       // Aplicar descuentos manuales o de tercera edad
  canSellCredit?: boolean;           // Vender al crédito / fiado
  canVoidSales?: boolean;            // Anular facturas o devoluciones
  canOpenDrawerNoSale?: boolean;     // Salidas manuales de caja chica / apertura de gaveta

  // Inventario & Catálogo
  canViewCostPrices?: boolean;       // Visualizar costos de compra y margen comercial
  canEditCatalog?: boolean;          // Crear o editar productos, precios y categorías
  canRegisterAdjustments?: boolean;  // Registrar mermas o ajustes manuales de stock
}

export interface UserProfile {
  id: string;
  tenantId: string;
  fullName: string;
  role: UserRole;
  pinCode?: string;
  isActive: boolean;
  permissions?: UserPermissions;
}
```

### Reglas de Negocio para Permisos:
1. **Rol `ADMIN`**: Tiene todos los permisos habilitados implícitamente (`true`). No se le solicita PIN de autorización a sí mismo.
2. **Rol `CAJERO` / `STAFF`**:
   - Si el permiso específico está explícitamente en `true`, la acción se ejecuta de inmediato.
   - Si el permiso está en `false` o `undefined`, se invoca la solicitud de PIN de Administrador.

---

## 3. Componente de Autorización: `AdminPinModal`

### 3.1 Ubicación e Interfaz
- Archivo: `src/components/common/AdminPinModal.tsx`
- Propiedades:
  ```typescript
  interface AdminPinModalProps {
    isOpen: boolean;
    title: string;              // Ej: "Autorizar Descuento en Venta"
    actionDescription?: string; // Ej: "Se requiere autorización de Administrador para aplicar un descuento del 25%."
    onSuccess: (adminProfile: UserProfile) => void;
    onCancel: () => void;
  }
  ```

### 3.2 Lógica de Validación
- Obtiene todos los perfiles del tenant activo con `role === 'ADMIN'` y `isActive === true`.
- Valida el PIN ingresado (comparando hash SHA-256 o texto plano según esté almacenado).
- Si coincide con algún Administrador activo del comercio:
  - Invoca `onSuccess(matchedAdmin)` y cierra el modal.
  - Muestra notificación toast de éxito: *"Acción autorizada por [Nombre de Admin]"*.
- Si no coincide:
  - Muestra error: *"PIN de Administrador inválido"*.
  - Limpia el campo para reintentar.

---

## 4. Puntos de Integración en la Aplicación

### 4.1 Punto de Venta (`PosContainer.tsx`)
1. **Descuentos (`handleApplySeniorDiscount`, `handleApplyCustomDiscount`)**:
   - Si el usuario activo no es Admin ni tiene `canApplyDiscounts`: abre `AdminPinModal` con título *"Autorizar Descuento"*. Al validar, aplica el descuento.
2. **Ventas al Fiado / Crédito (`processSale` con método `CREDIT`)**:
   - Si el usuario activo no es Admin ni tiene `canSellCredit`: solicita PIN de Administrador antes de procesar la venta a crédito.
3. **Anulación de Facturas (`voidSale`)**:
   - Si el usuario activo no es Admin ni tiene `canVoidSales`: solicita PIN de Administrador antes de devolver el stock y marcar la factura como anulada.

### 4.2 Inventario y Catálogo (`InventoryManager.tsx`)
1. **Protección de Costos y Márgenes (`canViewCostPrices`)**:
   - Si el usuario no tiene permiso, las columnas de `Costo Unitario` y `Margen Comercial` muestran `***`.
   - Botón en barra superior: *"Desbloquear Costos"* que solicita PIN de Admin para revelar temporalmente los costos durante la sesión.
2. **Crear / Editar Productos (`canEditCatalog`)**:
   - Al presionar *"Nuevo Producto"* o el botón de edición en una fila: si no tiene permiso, solicita PIN de Admin para abrir el formulario.
3. **Mermas y Ajustes (`canRegisterAdjustments`)**:
   - Al presionar *"Mermas & Ajustes"*: si no tiene permiso, solicita PIN de Admin antes de abrir el modal de ajuste.

### 4.3 Configuración y Administración de Personal (`SettingsView.tsx`)
- En la pestaña de **Usuarios / Colaboradores**:
  - Modal o sección para configurar permisos individuales de cada perfil.
  - Toggles individuales para cada uno de los 7 permisos con descripciones explicativas.
  - Persistencia en Supabase: actualizar la tabla `profiles` agregando la columna `permissions JSONB DEFAULT '{}'::jsonb`.

---

## 5. Estrategia de Migración y Persistencia en Supabase
- Migración SQL (`supabase/migration_add_missing_tenant_columns.sql`):
  ```sql
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;
  ```
- Soporte offline garantizado vía LocalStorage en Zustand (`useAppStore.ts`).

---

## 6. Pruebas y Validación
1. **Pruebas Unitarias (`useAppStore.test.ts`)**:
   - Verificación de asignación y actualización de `permissions` en perfiles.
   - Comprobación de que el rol `ADMIN` no requiere autorización de terceros.
2. **Pruebas E2E (`e2e/pos-workflow.spec.ts`)**:
   - Flujo de cajero sin permiso intentando aplicar descuento: aparición del modal de PIN de admin, ingreso de PIN y autorización exitosa.
   - Flujo de ocultación de costos de compra para cajero sin permiso en catálogo.
