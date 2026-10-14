# Especificacion de Diseno: Modulo de Restaurantes, Comedores y Cafeterias (Food & Beverage)

**Fecha:** 2026-10-14  
**Estado:** Propuesta de Diseno / Brainstorming Finalizado  
**Modulo:** Menú Gastronomico, Mesas (Dine-in), Pedidos para Llevar, Domicilios y Liquidacion de Repartidores  

---

## 1. Contexto y Problema de Negocio

Los comercios del rubro gastronomico (comedores populares, pequenos restaurantes, cafeterias, puestos de comida rapida y taquerias) operan con dinamicas muy diferentes al comercio minorista tradicional (pulperias y ferreterias):

1. **No manejan inventario rigido para la comida:** No ingresan "40 platos de carne asada" por factura de compra con Kardex CPP. Cocinan a demanda segun los insumos del dia. Lo mismo ocurre con jugos naturales (maracuya, horchata, tamarindo) que se preparan en jarras por la manana.
2. **Disponibilidad dinamica:** Los menus cambian a diario o los platillos se agotan conforme avanza el turno (ej. a la 1:30 PM se termino la sopa). Exigen un switch de 1 toque para apagar el producto y que no estorbe en la toma de pedidos.
3. **Multiples modalidades de entrega:**
   - **Comer en el local (`DINE_IN`):** Ocupa una mesa; los clientes ordenan, comen, agregan rondas adicionales de consumo y pagan hasta el final ("La cuenta").
   - **Para llevar (`TAKE_OUT`):** Se prepara y entrega en mostrador.
   - **A domicilio (`DELIVERY`):** Sale con un repartidor y se cobra contra entrega en la puerta.
4. **Desacoplamiento entre pedido y caja:** Un pedido o mesa abierta NO toca el turno de caja ni emite factura fiscal hasta el momento en que el cliente realiza el pago. Si una mesa se cancela antes de comer, no afecta el arqueo del cajero.
5. **Doble modalidad de repartidores:**
   - **Repartidor interno (Empleado con sueldo fijo):** No cobra comision por viaje. Al volver, entrega a caja el 100% de lo cobrado (alimentos y costo de envio si el negocio lo cobro).
   - **Mandadito / Externo:** El cliente le paga el flete de envio directamente al motorista en la puerta. El mandadito entrega a la caja unicamente el valor exacto de los alimentos consumidos.
6. **Extras y complementos con cobro:** Necesidad de sumar adicionales al platillo (+L 30.00 carne extra, +L 15.00 ensalada) que aumentan el total del ticket y se destacan en la comanda de cocina.

---

## 2. Decision Arquitectonica: Modulo Nativo Integrado con Feature Flag

Se descarta crear una aplicacion independiente. Se integrara como modulo nativo en MiCuadre habilitado mediante la bandera `isFoodEnabled: boolean` en la configuracion del comercio (`Tenant`).

### Ventajas:
* Reutilizacion total del motor fiscal hondureno (SAR/CAI), cajas, turnos, arqueos ciegos, cierres Z, impresion termica calibrada de 58 mm / 80 mm y soporte Offline PWA.
* Soporte nativo para comercios hibridos (ej. restaurante que vende comida preparada pero tambien refrescos y cervezas de inventario con control de unidades).

---

## 3. Modelo de Datos e Interfaces Propuestas (`src/types/index.ts`)

### 3.1 Entidad `MenuItem` (Separada de `Product`)
```typescript
export interface MenuItemExtra {
  id: string;
  name: string;        // ej. "Extra Carne", "Extra Ensalada", "Tamano Litro"
  price: number;       // ej. 30.00, 15.00
}

export interface MenuItem {
  id: string;
  tenantId: string;
  name: string;        // ej. "Pollo Chuco con Tajadas", "Jugo de Maracuya"
  category: string;    // ej. "Almuerzos", "Desayunos", "Bebidas Naturales"
  price: number;
  isAvailable: boolean; // Switch de disponibilidad del dia
  availableExtras?: MenuItemExtra[];
  defaultNotes?: string[]; // ej. ["Sin cebolla", "Tajadas verdes", "Poco hielo"]
  createdAt: string;
}
```

### 3.2 Entidad `FoodOrder` (Comanda de Mesa o Delivery)
```typescript
export type FoodOrderDeliveryType = 'DINE_IN' | 'TAKE_OUT' | 'DELIVERY';
export type FoodOrderStatus = 'ORDERED' | 'PREPARING' | 'SERVED' | 'DELIVERED' | 'CANCELLED';
export type DriverType = 'INTERNAL' | 'EXTERNAL_MANDADITO';

export interface FoodOrderItemExtraSelected {
  name: string;
  price: number;
}

export interface FoodOrderItem {
  menuItemId?: string;
  productId?: string;  // Si agregan un refresco o cerveza de inventario
  name: string;
  quantity: number;
  unitPrice: number;
  selectedExtras?: FoodOrderItemExtraSelected[];
  notes?: string;      // ej. "Sin cebolla, aderezo aparte"
  subtotal: number;
}

export interface FoodOrder {
  id: string;
  tenantId: string;
  orderNumber: string; // ej. "#042"
  deliveryType: FoodOrderDeliveryType;
  status: FoodOrderStatus;
  
  // Mesa (DINE_IN)
  tableNumber?: string; // ej. "Mesa 4"
  
  // Domicilio (DELIVERY)
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  deliveryFee?: number;
  driverId?: string;
  driverName?: string;
  driverType?: DriverType;
  driverSettled?: boolean;
  
  items: FoodOrderItem[];
  subtotal: number;
  total: number;
  isPaid: boolean;
  saleId?: string;     // Vinculo a la venta fiscal final en `sales`
  createdAt: string;
}
```

### 3.3 Repartidores (`DeliveryDriver`)
```typescript
export interface DeliveryDriver {
  id: string;
  tenantId: string;
  fullName: string;
  phone?: string;
  driverType: DriverType; // 'INTERNAL' o 'EXTERNAL_MANDADITO'
  isActive: boolean;
}
```

---

## 4. Flujos Operativos y Experiencia de Usuario (UI/UX)

### 4.1 Modulo Dedicado "Menú"
* Pestana en la barra lateral exclusiva para restaurantes.
* Permite crear platillos y bebidas naturales con su precio y categoria.
* Cada item tiene un interruptor **"Disponible Hoy"**.
* En el Punto de Venta (POS), **solo se renderizan los platillos marcados como disponibles**, manteniendo la botonera ligera y rapida.

### 4.2 Seleccion de Extras con Cobro en POS
* Al tocar un platillo (ej. "Pollo Chuco"):
  * Se abre un modal ligero con casillas: `[+ L 30.00 Extra Carne]`, `[+ L 15.00 Extra Ensalada]`.
  * Seccion de preferencias: `Sin cebolla`, `Aderezo aparte`.
  * Boton de confirmacion rapida de 1 toque.
* En el ticket fiscal se desglosa el costo; en la comanda de cocina se imprime en negrita para el cocinero.

### 4.3 Cuentas Activas y Mesas
* Vista de cuadricula visual de mesas:
  * Verde: Mesa libre.
  * Azul: Mesa ocupada (con tiempo transcurrido y total acumulado).
* Permite seguir agregando pedidos a la misma mesa.
* Boton "Cobrar Mesa": Pasa el total de la mesa al modal de cobro del POS (Efectivo/Tarjeta/Transferencia), emite la factura SAR y libera la mesa.

### 4.4 Repartos a Domicilio y Liquidacion de Efectivo
* Al crear un pedido "A Domicilio", se asigna el motorista.
* **Liquidacion en Caja al Final del Turno:**
  * Si el repartidor es **Interno**: Entrega el total completo (Comida + Envio).
  * Si es **Mandadito**: El cliente le pago el envio directamente en mano; el mandadito entrega a caja unicamente el valor de la comida.
  * Se presiona "Liquidar Repartidor", ingresando el efectivo formalmente al turno de caja activo para cuadrar con el Cierre Z nocturno.

---

## 5. Impresion Termica Diferenciada (SAT Q15U 58mm / 80mm)

1. **Ticket de Comanda (Cocina / Barra):**
   * Muestra: Mesa o Numero de Pedido, Hora, Lista de platillos, notas y extras destacados.
   * Sin precios ni datos fiscales.
2. **Ticket Fiscal / Simple (Cliente):**
   * El recibo final emitido al cobrar la cuenta con desglose de comida, extras y numeracion SAR/CAI.
3. **Ticket de Liquidacion de Repartidor:**
   * Detalle de pedidos entregados y total en efectivo entregado a caja, con firmas de recibo conforme.
