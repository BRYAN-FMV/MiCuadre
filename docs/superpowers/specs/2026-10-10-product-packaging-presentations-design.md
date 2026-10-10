# Especificacion de Diseno: Presentaciones de Empaque y Venta Fraccionada (Paquetes y Unidades)

**Fecha:** 2026-10-10  
**Estado:** Aprobado para implementacion  
**Modulo:** Inventario, POS, Kardex y Compras a Proveedores  

---

## 1. Contexto y Problema de Negocio

En el comercio minorista (pulperias, mercaditos, abarroterias, farmacias), es estandar adquirir y almacenar productos en empaques o presentaciones agrupadas (por ejemplo: paquete de 3 jabones, fardo de 24 refrescos, caja de 12 leches, paquete de 4 rollos de papel higienico).

Actualmente, el sistema maneja productos con una sola unidad y precio base, mas tiers de descuento por volumen. Sin embargo, no permite:
1. Vender un paquete completo con su propio precio, factor de unidades y codigo de barras exterior.
2. Vender unidades sueltas que descuenten exactamente el inventario de la unidad base, sin descuadrar el stock fisico del estante ni requerir procesos manuales engorrosos de desempaque.
3. Ingresar compras a proveedores en paquetes (ej. 10 paquetes de 3) y convertir automaticamente a unidades base (30 unidades) en el inventario.

---

## 2. Decision de Diseno: Modelo Unificado con Presentaciones

Se adopta el enfoque de **Un solo producto con presentaciones de venta y compras**:
- El inventario maestro (`currentStock`) se controla siempre en **unidades base** (piezas o unidades individuales).
- Cada producto puede definir 0 o mas **Presentaciones de Empaque** (`ProductPresentation`), cada una con su factor multiplicador (`unitsCount`), precio de venta (`salePrice`), costo referencial (`costPrice`) y codigo de barras opcional (`barcode`).

### Ventajas Clave
- **Sin descuadre por olvido:** No depende de que el cajero recuerde registrar un desempaque manual en el sistema al abrir un paquete.
- **Doble codigo de barra:** Si se escanea el codigo del paquete exterior se cobra el paquete; si se escanea la barra del jabon individual se cobra la unidad.
- **Trazabilidad en Kardex:** Cada venta o compra descuenta o suma en unidades base, registrando la presentacion utilizada en el concepto del movimiento.

---

## 3. Modelo de Datos e Interfaces

### 3.1 `ProductPresentation` (TypeScript en `src/types/index.ts`)
```typescript
export interface ProductPresentation {
  id: string;
  name: string;        // Ej: "Pack x3", "Fardo x24", "Caja x12"
  unitsCount: number;  // Multiplicador / unidades contenidas (ej. 3, 24, 12)
  salePrice: number;   // Precio de venta del paquete
  costPrice?: number;  // Costo de compra referencial del paquete
  barcode?: string;    // Codigo de barras propio del paquete exterior
}
```

### 3.2 Modificaciones en Entidades Existentes
- **`Product`**:
  ```typescript
  export interface Product {
    // ... campos existentes ...
    presentations?: ProductPresentation[];
  }
  ```
- **`CartLine`**:
  ```typescript
  export interface CartLine {
    // ... campos existentes ...
    presentationId?: string;
    presentationName?: string;
    unitsPerPackage?: number; // Factor multiplicador (default: 1)
  }
  ```
- **`PurchaseInvoiceItem`**:
  ```typescript
  export interface PurchaseInvoiceItem {
    // ... campos existentes ...
    presentationId?: string;
    presentationName?: string;
    unitsPerPackage?: number; // Factor multiplicador para sumar unidades al stock
  }
  ```

### 3.3 Persistencia en Supabase
- Se anade la columna `presentations` tipo `JSONB` a la tabla `products`:
  ```sql
  ALTER TABLE products ADD COLUMN IF NOT EXISTS presentations JSONB DEFAULT '[]'::jsonb;
  ```
- Esto garantiza compatibilidad offline nativa en LocalStorage y sincronizacion directa con Supabase sin migraciones complejas ni joins costosos.

---

## 4. Flujos Operativos y Experiencia de Usuario

### 4.1 Modulo de Inventario (`InventoryManager.tsx`)
1. **Edicion y Creacion de Producto:**
   - Se anade la seccion "Presentaciones y Empaques (Venta por Paquete)".
   - El comerciante puede anadir filas de presentaciones indicando:
     - Nombre de la presentacion (ej. "Pack de 3").
     - Unidades contenidas (ej. 3).
     - Precio de venta del paquete (ej. L. 60.00).
     - Codigo de barra propio del paquete exterior (opcional).
2. **Visualizacion de Stock:**
   - Si el producto tiene presentaciones configuradas, la tabla de inventario muestra la equivalencia visual:
     - `35 Unidades (11 packs y 2 sueltas)`.

### 4.2 Punto de Venta (POS)
1. **Lector de Codigo de Barras:**
   - Si se escanea el codigo de barra del producto base: se agrega la unidad al carrito.
   - Si se escanea el codigo de barra registrado en una de sus presentaciones: se agrega directamente el paquete al carrito con el precio de la presentacion.
2. **Seleccion Tactil / Busqueda por Nombre:**
   - Si el producto tiene presentaciones configuradas, al tocarlo en la cuadricula de ventas se abre un modal rapido selector de presentacion:
     - `[ Unidad Individual - L. 22.00 ]`
     - `[ Pack x3 - L. 60.00 (3 unidades) ]`
3. **Cobro y Descuento en Inventario (`processSale`):**
   - El descuento en inventario se calcula: `line.quantity * (line.unitsPerPackage || 1)`.
   - Si se vende 1 "Pack x3", se descuentan 3 unidades del stock principal.
   - El ticket refleja el nombre de la presentacion vendida.

### 4.3 Compras a Proveedores (`PurchaseInvoicesManager.tsx`)
- Al agregar un producto a una factura de compras:
  - Si tiene presentaciones, el usuario puede seleccionar si compra "Unidades" o "Pack x3".
  - Al recibir la compra de 5 "Pack x3", se incrementan `5 * 3 = 15 unidades` al stock principal.
  - El Kardex registra la entrada con la referencia exacta.

---

## 5. Estrategia de Pruebas

1. **Pruebas Unitarias (`useAppStore.test.ts` y nuevo archivo de pruebas):**
   - Calculo correcto de unidades a descontar al cobrar paquetes y unidades mixtas.
   - Registro en Kardex reflejando el empaque.
   - Persistencia de presentaciones en productos.
2. **Pruebas E2E (Playwright):**
   - Flujo de venta en POS seleccionando una presentacion de paquete.
   - Verificacion de reduccion del stock maestro.
