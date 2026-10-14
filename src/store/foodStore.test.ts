import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './useAppStore';

describe('Restaurant & Food Store Logic (isFoodEnabled)', () => {
  beforeEach(() => {
    // Reset store state
    const tenant = useAppStore.getState().tenant;
    useAppStore.setState({
      tenant: { ...tenant, isFoodEnabled: true },
      menuItems: [],
      foodOrders: [],
      deliveryDrivers: []
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
});
