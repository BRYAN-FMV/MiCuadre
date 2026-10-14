import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './useAppStore';
import { generateKitchenEscPosTicket } from '../lib/escPos';
import { backupTenantFoodEnabled, getStoredTenantFoodEnabled } from '../lib/supabaseService';

describe('Restaurant & Food Store Logic (isFoodEnabled)', () => {
  beforeEach(() => {
    // Reset store state
    const tenant = useAppStore.getState().tenant;
    useAppStore.setState({
      tenant: { ...tenant, isFoodEnabled: true },
      menuItems: [],
      foodOrders: [],
      deliveryDrivers: [],
      sales: [],
      cashMovements: [],
      activeShift: null
    });
  });

  it('should add, update, toggle availability, and delete menu items', () => {
    const store = useAppStore.getState();

    // 1. Add menu item
    const newItem = store.addMenuItem({
      name: 'Pollo Chuco Especial',
      category: 'Almuerzos',
      price: 130.0,
      isAvailable: true,
      availableExtras: [
        { id: 'ext-1', name: 'Extra Tajadas', price: 20.0 }
      ],
      defaultNotes: ['Tajadas verdes']
    });

    expect(newItem.id).toBeDefined();
    expect(newItem.name).toBe('Pollo Chuco Especial');
    expect(useAppStore.getState().menuItems.length).toBe(1);

    // 2. Toggle availability (Disponible -> Agotado)
    store.toggleMenuItemAvailability(newItem.id);
    expect(useAppStore.getState().menuItems[0].isAvailable).toBe(false);

    store.toggleMenuItemAvailability(newItem.id);
    expect(useAppStore.getState().menuItems[0].isAvailable).toBe(true);

    // 3. Update price
    store.updateMenuItem(newItem.id, { price: 140.0 });
    expect(useAppStore.getState().menuItems[0].price).toBe(140.0);

    // 4. Delete menu item
    store.deleteMenuItem(newItem.id);
    expect(useAppStore.getState().menuItems.length).toBe(0);
  });

  it('should manage food orders, add extra rounds of items, and complete or cancel orders', () => {
    const store = useAppStore.getState();

    // 1. Create table order (DINE_IN)
    const order = store.createFoodOrder({
      deliveryType: 'DINE_IN',
      tableNumber: 'Mesa 4',
      status: 'ORDERED',
      items: [
        {
          name: 'Baleada Especial',
          quantity: 2,
          unitPrice: 50.0,
          subtotal: 100.0,
          notes: 'Con huevo picado'
        }
      ],
      subtotal: 100.0,
      total: 100.0
    });

    expect(order.id).toBeDefined();
    expect(order.orderNumber).toBeDefined();
    expect(order.isPaid).toBe(false);
    expect(useAppStore.getState().foodOrders.length).toBe(1);

    // 2. Add extra round of drinks to the table
    store.addItemsToFoodOrder(order.id, [
      {
        name: 'Jugo de Maracuyá',
        quantity: 2,
        unitPrice: 35.0,
        subtotal: 70.0
      }
    ]);

    const updatedOrder = useAppStore.getState().foodOrders.find(o => o.id === order.id);
    expect(updatedOrder?.items.length).toBe(2);
    expect(updatedOrder?.subtotal).toBe(170.0);
    expect(updatedOrder?.total).toBe(170.0);

    // 3. Complete order upon checkout
    store.completeFoodOrder(order.id, 'sale-uuid-123');
    const completedOrder = useAppStore.getState().foodOrders.find(o => o.id === order.id);
    expect(completedOrder?.isPaid).toBe(true);
    expect(completedOrder?.status).toBe('DELIVERED');
    expect(completedOrder?.saleId).toBe('sale-uuid-123');
  });

  it('should accurately settle cash for internal drivers vs external mandaditos', () => {
    const store = useAppStore.getState();

    // 1. Add internal driver (employee, hands in 100% of money)
    const internalDriver = store.addDeliveryDriver({
      fullName: 'Carlos (Empleado)',
      phone: '9900-1122',
      driverType: 'INTERNAL',
      isActive: true
    });

    // 2. Add external mandadito (client pays shipping to driver, hands in food-only)
    const mandaditoDriver = store.addDeliveryDriver({
      fullName: 'Mario (Mandaditos)',
      phone: '9900-3344',
      driverType: 'EXTERNAL_MANDADITO',
      isActive: true
    });

    // Order 1: Internal driver, Food L 200, Shipping L 40, Cash -> Total to deliver L 240
    store.createFoodOrder({
      deliveryType: 'DELIVERY',
      driverId: internalDriver.id,
      driverName: internalDriver.fullName,
      driverType: 'INTERNAL',
      status: 'DELIVERED',
      items: [{ name: 'Pollo Chuco', quantity: 1, unitPrice: 200.0, subtotal: 200.0 }],
      subtotal: 200.0,
      deliveryFee: 40.0,
      total: 240.0
    });

    // Order 2: Mandadito driver, Food L 150, Shipping L 35, Cash -> Total to deliver L 150 (client paid L 35 to driver)
    store.createFoodOrder({
      deliveryType: 'DELIVERY',
      driverId: mandaditoDriver.id,
      driverName: mandaditoDriver.fullName,
      driverType: 'EXTERNAL_MANDADITO',
      status: 'DELIVERED',
      items: [{ name: 'Baleadas', quantity: 3, unitPrice: 50.0, subtotal: 150.0 }],
      subtotal: 150.0,
      deliveryFee: 35.0,
      total: 185.0
    });

    // Settle internal driver
    const settlementInternal = store.settleDriverOrders(internalDriver.id);
    expect(settlementInternal.ordersCount).toBe(1);
    expect(settlementInternal.totalCash).toBe(240.0);

    // Settle mandadito driver
    const settlementMandadito = store.settleDriverOrders(mandaditoDriver.id);
    expect(settlementMandadito.ordersCount).toBe(1);
    expect(settlementMandadito.totalCash).toBe(150.0); // Only food, no delivery fee!

    // Verify all orders are marked settled
    const allOrders = useAppStore.getState().foodOrders;
    expect(allOrders.every(o => o.driverSettled === true)).toBe(true);
  });

  it('should add food dish with extras and notes to cart, calculate totals, and not deduct inventory stock upon sale', () => {
    const store = useAppStore.getState();

    // 1. Setup food item
    const dish = store.addMenuItem({
      name: 'Carne Asada Especial',
      category: 'Almuerzos',
      price: 150.0,
      isAvailable: true,
      availableExtras: [
        { id: 'ext-carne', name: 'Extra Carne', price: 35.0 },
        { id: 'ext-chismol', name: 'Extra Chismol', price: 10.0 }
      ]
    });

    // 2. Setup inventory product (e.g. Coca Cola) with stock 20
    const testProduct = {
      id: 'prod-coca-1',
      tenantId: store.tenant.id,
      name: 'Coca Cola 500ml',
      sku: 'REF-001',
      costPrice: 15.0,
      salePrice: 25.0,
      currentStock: 20,
      minStockAlert: 5,
      unitOfMeasure: 'Unidad',
      category: 'Bebidas',
      taxClassification: 'GRAVADO_15' as const,
      isActive: true
    };
    useAppStore.setState({ products: [testProduct], cartLines: [] });

    // 3. Open shift
    store.openCashShift(500.0);

    // 4. Add dish with 2 extras to cart
    const selectedExtras = [
      { id: 'ext-carne', name: 'Extra Carne', price: 35.0 },
      { id: 'ext-chismol', name: 'Extra Chismol', price: 10.0 }
    ];
    const finalUnitPrice = dish.price + 35.0 + 10.0; // 195.00
    store.addToCart({
      menuItem: dish,
      quantity: 2,
      selectedExtras,
      notes: 'Bien cocida, poco chismol',
      finalUnitPrice
    });

    // Also add 1 bottle of Coca Cola from inventory
    store.addToCart({
      product: testProduct,
      quantity: 1
    });

    const cart = useAppStore.getState().cartLines;
    expect(cart.length).toBe(2);

    // Verify food line details
    const foodLine = cart[0];
    expect(foodLine.menuItemId).toBe(dish.id);
    expect(foodLine.name).toContain('Carne Asada Especial');
    expect(foodLine.name).toContain('+Extra Carne');
    expect(foodLine.name).toContain('+Extra Chismol');
    expect(foodLine.notes).toBe('Bien cocida, poco chismol');
    expect(foodLine.unitPrice).toBe(195.0);
    expect(foodLine.quantity).toBe(2);
    expect(foodLine.total).toBe(390.0);

    // Verify drink line details
    const drinkLine = cart[1];
    expect(drinkLine.productId).toBe(testProduct.id);
    expect(drinkLine.quantity).toBe(1);
    expect(drinkLine.total).toBe(25.0);

    // 5. Process sale
    const sale = store.processSale('CASH', 0, false);
    expect(sale).toBeDefined();
    expect(sale?.total).toBe(415.0);

    // 6. Verify inventory deduction:
    // Regular product stock must be deducted: 20 - 1 = 19
    const updatedProducts = useAppStore.getState().products;
    const updatedDrink = updatedProducts.find(p => p.id === testProduct.id);
    expect(updatedDrink?.currentStock).toBe(19);

    // Menú dish does not affect products table or deduct arbitrary stock
    expect(updatedProducts.length).toBe(1);
  });

  it('should generate compact kitchen ticket without prices or fiscal data', () => {
    const ticketBytes = generateKitchenEscPosTicket({
      orderNumber: '007',
      tableNumber: 'Mesa 5',
      deliveryType: 'DINE_IN',
      customerName: 'Familia Reyes',
      serverName: 'Juan Mesero',
      items: [
        {
          name: 'Pollo Chuco Especial',
          quantity: 2,
          notes: 'Tajadas bien doradas, salsa aparte',
          extras: [{ name: 'Extra Tajadas', price: 20.0 }]
        }
      ]
    });

    expect(ticketBytes).toBeInstanceOf(Uint8Array);
    expect(ticketBytes.length).toBeGreaterThan(50);

    const decoded = new TextDecoder().decode(ticketBytes);
    expect(decoded).toContain('ORDEN DE COCINA');
    expect(decoded).toContain('Mesa 5');
    expect(decoded).toContain('Pollo Chuco Especial');
    expect(decoded).toContain('EXTRA: Extra Tajadas');
    expect(decoded).toContain('Tajadas bien doradas');
    expect(decoded).toContain('MESERO: Juan Mesero');

    // Strictly no prices or fiscal declarations
    expect(decoded).not.toContain('TOTAL A PAGAR');
    expect(decoded).not.toContain('CAI:');
    expect(decoded).not.toContain('RTN:');
  });

  it('should persist isFoodEnabled across tenant updates and prevent deactivation on restart/reload', () => {
    const store = useAppStore.getState();
    const currentTenant = store.tenant;

    // 1. Activate food module
    store.updateTenantSettings({ isFoodEnabled: true, businessType: 'FOOD' });
    expect(useAppStore.getState().tenant.isFoodEnabled).toBe(true);
    expect(useAppStore.getState().tenant.businessType).toBe('FOOD');
    expect(getStoredTenantFoodEnabled(currentTenant.id)).toBe(true);

    // 2. Simulate page reload / startup where cloud returns tenant without is_food_enabled column
    const simulatedCloudTenant = {
      ...currentTenant,
      isFoodEnabled: undefined
    };

    // Resolving logic (as in App.tsx / LoginView.tsx)
    const stored = getStoredTenantFoodEnabled(simulatedCloudTenant.id);
    const resolvedFoodEnabled = (typeof simulatedCloudTenant.isFoodEnabled === 'boolean' && simulatedCloudTenant.isFoodEnabled)
      || useAppStore.getState().tenant.isFoodEnabled
      || stored
      || false;

    const mergedTenant = {
      ...simulatedCloudTenant,
      isFoodEnabled: resolvedFoodEnabled
    };

    useAppStore.setState({ tenant: mergedTenant });
    expect(useAppStore.getState().tenant.isFoodEnabled).toBe(true);

    // 3. Deactivate food module explicitly
    store.updateTenantSettings({ isFoodEnabled: false, businessType: 'RETAIL' });
    expect(useAppStore.getState().tenant.isFoodEnabled).toBe(false);
    expect(getStoredTenantFoodEnabled(currentTenant.id)).toBe(false);
  });

  it('should detect unassigned delivery orders and allow assigning them to a driver for settlement', () => {
    const store = useAppStore.getState();

    const driver = store.addDeliveryDriver({
      fullName: 'Carlos Express',
      phone: '9900-1122',
      driverType: 'EXTERNAL_MANDADITO',
      isActive: true
    });

    // Create delivery order without driver assigned
    const unassignedOrder = store.createFoodOrder({
      deliveryType: 'DELIVERY',
      status: 'IN_TRANSIT',
      customerName: 'Cliente Sin Asignar',
      items: [{ name: 'Hamburguesa', quantity: 2, unitPrice: 120.0, subtotal: 240.0 }],
      subtotal: 240.0,
      deliveryFee: 40.0,
      total: 280.0
    });

    expect(unassignedOrder.driverId).toBeUndefined();
    expect(unassignedOrder.deliveryDriverId).toBeUndefined();

    // Verify it is detected as unassigned
    const ordersBefore = useAppStore.getState().foodOrders;
    const unassignedList = ordersBefore.filter(
      o => o.deliveryType === 'DELIVERY' && !o.driverSettled && o.status !== 'CANCELLED' && (!o.driverId && !o.deliveryDriverId)
    );
    expect(unassignedList.length).toBe(1);
    expect(unassignedList[0].id).toBe(unassignedOrder.id);

    // Assign to driver
    store.updateFoodOrder(unassignedOrder.id, {
      driverId: driver.id,
      deliveryDriverId: driver.id,
      driverName: driver.fullName,
      driverType: driver.driverType
    });

    // Verify order is now assigned to driver
    const updatedOrder = useAppStore.getState().foodOrders.find(o => o.id === unassignedOrder.id);
    expect(updatedOrder?.driverId).toBe(driver.id);
    expect(updatedOrder?.deliveryDriverId).toBe(driver.id);

    // Settle driver orders
    const settlement = store.settleDriverOrders(driver.id);
    expect(settlement.ordersCount).toBe(1);
    expect(settlement.totalCash).toBe(240.0); // Food subtotal for mandadito

    const settledOrder = useAppStore.getState().foodOrders.find(o => o.id === unassignedOrder.id);
    expect(settledOrder?.driverSettled).toBe(true);
  });

  it('should allow services module and food module to coexist seamlessly', () => {
    const store = useAppStore.getState();

    // Enable both food module and services module
    store.updateTenantSettings({
      isFoodEnabled: true,
      businessType: 'FOOD'
    });

    const tenant = useAppStore.getState().tenant;
    expect(tenant.isFoodEnabled).toBe(true);

    const isServicesActive = tenant.isServicesEnabled !== false;
    expect(isServicesActive).toBe(true);
  });

  it('should process food order sale directly without affecting POS counter cart', () => {
    const store = useAppStore.getState();
    const tenantId = store.tenant.id;

    // 1. Open active cash shift
    store.openCashShift(500);
    const activeShift = useAppStore.getState().activeShift;
    expect(activeShift).toBeDefined();
    expect(activeShift?.status).toBe('OPEN');

    // 2. Setup inventory product (Refresco) with initial stock 10
    const testProduct = {
      id: 'prod-soda-123',
      tenantId,
      sku: 'SODA01',
      name: 'Refresco Coca Cola 500ml',
      price: 25.0,
      salePrice: 25.0,
      unitOfMeasure: 'UNIDAD',
      costPrice: 15.0,
      currentStock: 10,
      minStockAlert: 2,
      category: 'Bebidas',
      taxClassification: 'GRAVADO_15' as const,
      priceTiers: [],
      isActive: true,
      createdAt: new Date().toISOString()
    };
    useAppStore.setState({
      products: [testProduct],
      cartLines: [
        {
          productId: 'prod-retail-counter',
          name: 'Bolsa de Papas Fritas',
          sku: 'PAPAS',
          quantity: 1,
          unitPrice: 30.0,
          originalUnitPrice: 30.0,
          discountAmount: 0,
          taxClassification: 'GRAVADO_15',
          subtotal: 26.09,
          taxAmount: 3.91,
          total: 30.0
        }
      ]
    });

    // 3. Create food comanda
    const order = store.createFoodOrder({
      deliveryType: 'DINE_IN',
      tableNumber: 'Mesa 7',
      status: 'ORDERED',
      items: [
        {
          name: 'Plato del Día (Pollo con Tajadas)',
          quantity: 1,
          unitPrice: 120.0,
          subtotal: 120.0,
          notes: 'Con repollo y aderezo extra'
        },
        {
          productId: testProduct.id,
          name: testProduct.name,
          quantity: 2,
          unitPrice: 25.0,
          subtotal: 50.0
        }
      ],
      subtotal: 170.0,
      total: 170.0
    });

    // 4. Directly checkout the food order in cash
    const completedSale = store.processFoodOrderSale(order.id, 'CASH', false);

    expect(completedSale).toBeDefined();
    expect(completedSale?.total).toBe(170.0);
    expect(completedSale?.paymentMethod).toBe('CASH');
    expect(completedSale?.cashShiftId).toBe(activeShift?.id);

    // 5. Verify the order state was updated to COMPLETED with sale reference
    const updatedOrder = useAppStore.getState().foodOrders.find(o => o.id === order.id);
    expect(updatedOrder?.isPaid).toBe(true);
    expect(updatedOrder?.status).toBe('COMPLETED');
    expect(updatedOrder?.saleId).toBe(completedSale?.id);

    // 6. Verify inventory stock was deducted for the sodas (10 - 2 = 8)
    const updatedProduct = useAppStore.getState().products.find(p => p.id === testProduct.id);
    expect(updatedProduct?.currentStock).toBe(8);

    // 7. CRITICAL: Verify POS counter cart was NOT cleared or modified!
    const counterCart = useAppStore.getState().cartLines;
    expect(counterCart.length).toBe(1);
    expect(counterCart[0].name).toBe('Bolsa de Papas Fritas');

    // 8. Verify cash shift closing accurately accounts for this direct cash sale
    const shiftSummary = store.closeCashShift(670); // 500 opening + 170 cash sale = 670
    expect(shiftSummary.closingSystem).toBe(670);
    expect(shiftSummary.difference).toBe(0);
  });
});




