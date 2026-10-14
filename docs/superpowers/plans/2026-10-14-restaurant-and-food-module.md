# Restaurant & Food Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a native Restaurant, Diner, and Coffee Shop module (`isFoodEnabled`) in MiCuadre featuring a dedicated Menú (prepared dishes & natural drinks without rigid inventory), daily 1-touch availability switches, chargeable extras (+carne, +ensalada), table tabs (dine-in orders decoupled from cash register until checkout), and delivery drivers with cash settlement for internal staff vs external mandaditos.

**Architecture:** Extend `Tenant` with `isFoodEnabled` feature flag. Create dedicated domain types (`MenuItem`, `MenuItemExtra`, `FoodOrder`, `DeliveryDriver`) in `src/types/index.ts`. Add reactive store state in `src/store/useAppStore.ts` with local persistence. Build clean modular UI components in `src/components/food/` that seamlessly integrate with `Sidebar.tsx` and `PosContainer.tsx` without bloating non-food retail stores.

**Tech Stack:** React 18, TypeScript, Zustand, Tailwind CSS, Lucide React, Vitest.

**Spec:** [docs/superpowers/specs/2026-10-14-restaurant-and-food-module-design.md](file:///c:/Users/bryan/OneDrive/Documentos/DevProy/MiCuadre/docs/superpowers/specs/2026-10-14-restaurant-and-food-module-design.md)

## Global Constraints
- Zero emojis anywhere in code, comments, commit messages, or responses.
- Maintain documentation integrity in all touched files.
- All IDs must be valid UUIDs version 4 or standard prefixed IDs.
- Retail businesses without `isFoodEnabled` must see zero changes or clutter in their workflow.
- In the POS, only menu items with `isAvailable: true` are rendered for speed and clarity.

## Review Focus
1. When `isFoodEnabled` is false, the "Menú" tab and food selectors must remain completely hidden.
2. Opening a table tab (`DINE_IN`) or kitchen order must NOT alter the active cash shift balance until final payment.
3. Chargeable extras must correctly increase the item price in the fiscal cart and appear highlighted in kitchen tickets.
4. Mandadito driver settlements must hand in only the food total (client pays shipping to driver), while internal drivers hand in food + shipping.
5. Canceling an open order before payment must delete or void the order without creating negative movements or fiscal voids.

---

### Task 1: Domain Types & State Management (`MenuItem`, `FoodOrder`, `DeliveryDriver`)

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/store/useAppStore.ts`
- Test: `src/store/foodStore.test.ts`

- [ ] Add `isFoodEnabled?: boolean` to `Tenant` interface in `src/types/index.ts`.
- [ ] Define `MenuItem`, `MenuItemExtra`, `FoodOrder`, `FoodOrderItem`, `DeliveryDriver`, and related enums in `src/types/index.ts`.
- [ ] Implement store actions in `src/store/useAppStore.ts`:
  - `menuItems: MenuItem[]`, `foodOrders: FoodOrder[]`, `deliveryDrivers: DeliveryDriver[]`
  - `addMenuItem`, `updateMenuItem`, `toggleMenuItemAvailability`, `deleteMenuItem`
  - `createFoodOrder`, `addItemsToFoodOrder`, `completeFoodOrder`, `cancelFoodOrder`
  - `addDeliveryDriver`, `updateDeliveryDriver`, `settleDriverOrders`
- [ ] Write unit tests in `src/store/foodStore.test.ts` verifying:
  - Menu item creation and availability toggling.
  - Food order creation, adding extra rounds of food, calculating totals.
  - Driver cash settlement calculation (internal 100% vs mandadito food-only).
- [ ] Run `npm test` and verify all tests pass.
- [ ] Commit: `feat(food): agregar modelos de datos y acciones de estado para menu, comandas y repartidores`.

---

### Task 2: Dedicated "Menú" Management View & Sidebar Integration

**Files:**
- Create: `src/components/food/MenuView.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/settings/SettingsView.tsx`

- [ ] Add "Menú" item in `Sidebar.tsx` (using `UtensilsCrossed` icon from `lucide-react`) conditionally shown when `tenant.isFoodEnabled` is true.
- [ ] Add `isFoodEnabled` switch in `SettingsView.tsx` so users can toggle restaurant mode on/off.
- [ ] Build `MenuView.tsx`:
  - Category tabs (Desayunos, Almuerzos, Bebidas Naturales, Postres, etc.).
  - Search bar and category filter.
  - Dish card with price, category, list of extras, and 1-touch switch: "Disponible Hoy" (Verde / Gris).
  - Modal to create / edit menu items with customizable extras (+Carne L 30, +Ensalada L 15).
- [ ] Route `activeTab === 'menu'` in `App.tsx` to render `MenuView`.
- [ ] Run `npx tsc -b` and test rendering.
- [ ] Commit: `feat(food): vista de gestion de menu con switches de disponibilidad diaria`.

---

### Task 3: Item Customizer Modal & POS Food Integration

**Files:**
- Create: `src/components/food/MenuItemCustomizerModal.tsx`
- Modify: `src/components/pos/PosContainer.tsx`

- [ ] Build `MenuItemCustomizerModal.tsx`:
  - Displays dish name and base price.
  - Checkboxes for chargeable extras (+L 30 Extra Carne, +L 15 Extra Ensalada).
  - Quick chips for preferences ("Sin cebolla", "Tajadas verdes", "Poco hielo").
  - Free note input for custom requests.
  - Real-time subtotal calculation.
- [ ] Update `PosContainer.tsx`:
  - When `tenant.isFoodEnabled` is active, show source selector: `[Menú de Cocina]` vs `[Inventario / Bebidas]`.
  - Filter menu items to only show `isAvailable: true` dishes to prevent clutter.
  - Clicking a menu dish opens `MenuItemCustomizerModal`.
  - Adding to cart includes extras in description and unit price.
- [ ] Test cart calculations with single and multiple extras.
- [ ] Commit: `feat(food): modal de modificadores y extras en el punto de venta`.

---

### Task 4: Tables & Active Tabs (`DINE_IN` Orders)

**Files:**
- Create: `src/components/food/TablesGridModal.tsx`
- Modify: `src/components/pos/PosContainer.tsx`

- [ ] Create `TablesGridModal.tsx`:
  - Visual grid of tables (Mesa 1 to Mesa 12, Barra, Terraza).
  - State coloring: Green (Libre), Blue (Ocupada con comanda abierta).
  - Shows order summary, elapsed time, and accumulated total.
  - Actions: "Ver / Agregar Pedido", "Cobrar Cuenta en Caja", "Liberar Mesa".
- [ ] Integrate with POS:
  - In POS header, add delivery mode selector: `[Mesa / En Local]` | `[Para Llevar]` | `[A Domicilio]`.
  - When in `[Mesa]`, button "Guardar Comanda" updates the table without triggering cash checkout.
  - "Cobrar Cuenta" loads the table's items into the POS cart for immediate checkout, fiscal invoice emission, and marks the order as paid.
- [ ] Run `npm test` and verify table workflow.
- [ ] Commit: `feat(food): gestion de mesas y comandas activas sin afectar caja registradora`.

---

### Task 5: Delivery Orders & Driver Cash Settlement

**Files:**
- Create: `src/components/food/DriverSettlementModal.tsx`
- Modify: `src/components/pos/PosContainer.tsx`

- [ ] In POS delivery mode (`DELIVERY`), collect: Customer Name, Phone, Delivery Address, Delivery Fee, and Driver assignment.
- [ ] Build `DriverSettlementModal.tsx`:
  - Filter orders by selected driver for today.
  - Clearly split:
    - Internal Driver: Total delivered = Food + Delivery Fee.
    - Mandadito (External): Total delivered = Food ONLY (client paid fee to driver).
  - Single-click action "Liquidar Efectivo y Registrar en Caja":
    - Registers `CashMovement` (`ENTRADA`) into current `CashShift`.
    - Marks orders as settled (`driverSettled: true`).
- [ ] Verify arithmetic with unit tests in `src/store/foodStore.test.ts`.
- [ ] Commit: `feat(food): modulo de liquidacion de repartidores internos y mandaditos`.

---

### Task 6: Kitchen Ticket Printing & Verification

**Files:**
- Modify: `src/lib/escPos.ts`
- Modify: `src/components/pos/PosContainer.tsx`

- [ ] Add `printKitchenTicket` helper in `src/lib/escPos.ts` and HTML printable view for SAT Q15U (58mm/80mm):
  - Prints: Table # or Order #, Time, Dish names, Extras in bold (`** EXTRA CARNE **`), and notes.
  - Zero prices or fiscal data.
- [ ] Run full test suite: `npx tsc -b && npm test`.
- [ ] Commit: `feat(food): impresion termica de comanda de cocina y validacion completa`.
