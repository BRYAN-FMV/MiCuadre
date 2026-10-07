import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './useAppStore';
import { Product } from '../types';

describe('App Zustand Store Business Logic', () => {
  beforeEach(() => {
    // Reset state before each test
    useAppStore.getState().resetToDefaultData();
  });

  it('should open a cash shift successfully for active tenant', () => {
    const store = useAppStore.getState();
    store.openCashShift(1000);

    const activeShift = useAppStore.getState().activeShift;
    expect(activeShift).not.toBeNull();
    expect(activeShift?.openingAmount).toBe(1000);
    expect(activeShift?.status).toBe('OPEN');
    expect(activeShift?.tenantId).toBe(store.tenant.id);
  });

  it('should block adding products to cart when stock is insufficient and allowNegativeStock is false', () => {
    useAppStore.setState({
      tenant: { ...useAppStore.getState().tenant, allowNegativeStock: false }
    });

    const testProduct: Product = {
      id: 'prod-test-1',
      tenantId: useAppStore.getState().tenant.id,
      sku: 'REF-3L',
      name: 'Refresco 3L',
      category: 'Bebidas',
      unitOfMeasure: 'UND',
      salePrice: 50,
      costPrice: 35,
      currentStock: 2,
      minStockAlert: 1,
      taxClassification: 'GRAVADO_15',
      isActive: true
    };

    useAppStore.setState({ products: [testProduct] });

    // Attempting to add 5 units when current stock is only 2
    useAppStore.getState().addToCart({ product: testProduct, quantity: 5 });

    const cartLines = useAppStore.getState().cartLines;
    expect(cartLines.length).toBe(0);
  });

  it('should deduct product stock when a sale is processed', () => {
    const store = useAppStore.getState();
    store.openCashShift(500);

    const initialStock = 10;
    const testProduct: Product = {
      id: 'prod-test-2',
      tenantId: store.tenant.id,
      sku: 'JAB-01',
      name: 'Jabón Líquido',
      category: 'Limpieza',
      unitOfMeasure: 'UND',
      salePrice: 100,
      costPrice: 60,
      currentStock: initialStock,
      minStockAlert: 2,
      taxClassification: 'EXENTO',
      isActive: true
    };

    useAppStore.setState({ products: [testProduct] });

    // Add 3 units to cart
    useAppStore.getState().addToCart({ product: testProduct, quantity: 3 });
    expect(useAppStore.getState().cartLines.length).toBe(1);

    // Process sale
    const sale = useAppStore.getState().processSale('CASH');
    expect(sale).not.toBeNull();
    expect(sale?.total).toBe(300);

    // Verify product stock is updated to 7 (10 - 3)
    const updatedProducts = useAppStore.getState().products;
    const updatedProd = updatedProducts.find(p => p.id === testProduct.id);
    expect(updatedProd?.currentStock).toBe(7);

    // Verify cart is cleared
    expect(useAppStore.getState().cartLines.length).toBe(0);
  });

  it('should block adding products belonging to another tenant (Multi-tenant security guard)', () => {
    const foreignTenantProduct: Product = {
      id: 'prod-foreign-1',
      tenantId: 'other-tenant-999',
      sku: 'AJ-001',
      name: 'Producto Ajeno',
      category: 'Otros',
      unitOfMeasure: 'UND',
      salePrice: 200,
      costPrice: 100,
      currentStock: 50,
      minStockAlert: 5,
      taxClassification: 'EXENTO',
      isActive: true
    };

    useAppStore.getState().addToCart({ product: foreignTenantProduct, quantity: 1 });

    const cartLines = useAppStore.getState().cartLines;
    expect(cartLines.length).toBe(0);
  });

  it('should register an operational expense and create cash movement when paid from active cash shift', () => {
    const store = useAppStore.getState();
    store.openCashShift(1000);

    const initialMovements = useAppStore.getState().cashMovements?.length || 0;

    store.addExpense({
      category: 'LIMPIEZA',
      description: 'Compra de detergente y escoba',
      amount: 45.00,
      fundId: 'ACTIVE_CASH_SHIFT',
      fundName: 'Caja Registradora',
      paymentSource: 'ACTIVE_CASH_SHIFT',
      expenseDate: '2026-10-07'
    });

    const expenses = useAppStore.getState().expenses;
    const movements = useAppStore.getState().cashMovements;

    expect(expenses.length).toBeGreaterThan(0);
    expect(expenses[0].amount).toBe(45.00);

    // Movement must be registered as SALIDA
    expect(movements.length).toBe(initialMovements + 1);
    expect(movements[0].type).toBe('SALIDA');
    expect(movements[0].amount).toBe(45.00);
  });
});
