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

  it('should strictly isolate sales and cash counts between Caja 1 and Caja 2 terminals', () => {
    const store = useAppStore.getState();

    const testProduct: Product = {
      id: 'prod-iso-1',
      tenantId: store.tenant.id,
      sku: 'ISO-01',
      name: 'Item Aislado',
      category: 'General',
      unitOfMeasure: 'UND',
      salePrice: 100,
      costPrice: 50,
      currentStock: 100,
      minStockAlert: 5,
      taxClassification: 'EXENTO',
      isActive: true
    };

    useAppStore.setState({
      products: [testProduct],
      fiscalRanges: [
        {
          id: 'caja-1-id',
          tenantId: store.tenant.id,
          name: 'Caja 1 - Principal',
          cai: 'CAI-001',
          prefix: '000-001-01-',
          rangeStart: 1,
          rangeEnd: 1000,
          currentNumber: 1,
          deadline: '2027-12-31',
          documentType: '01',
          isActive: true
        },
        {
          id: 'caja-2-id',
          tenantId: store.tenant.id,
          name: 'Caja 2 - Expreso',
          cai: 'CAI-002',
          prefix: '000-002-01-',
          rangeStart: 1,
          rangeEnd: 1000,
          currentNumber: 1,
          deadline: '2027-12-31',
          documentType: '01',
          isActive: true
        }
      ]
    });

    // 1. Open Shift on CAJA 1 with L. 1000 opening amount
    useAppStore.setState({ selectedFiscalRangeId: 'caja-1-id' });
    store.openCashShift(1000);

    // Make a sale of L. 300 on Caja 1
    store.addToCart({ product: testProduct, quantity: 3 });
    const saleCaja1 = store.processSale('CASH');
    expect(saleCaja1?.cajaName).toBe('Caja 1 - Principal');

    // Close Shift on CAJA 1 (Declared L. 1300 -> Perfect balance)
    const resultCaja1 = store.closeCashShift(1300);
    expect(resultCaja1.closingSystem).toBe(1300); // 1000 opening + 300 sales
    expect(resultCaja1.difference).toBe(0);

    // 2. Open Shift on CAJA 2 with L. 500 opening amount
    useAppStore.setState({ selectedFiscalRangeId: 'caja-2-id' });
    store.openCashShift(500);

    // Make a sale of L. 200 on Caja 2
    store.addToCart({ product: testProduct, quantity: 2 });
    const saleCaja2 = store.processSale('CASH');
    expect(saleCaja2?.cajaName).toBe('Caja 2 - Expreso');

    // Close Shift on CAJA 2 (Declared L. 700)
    // CRITICAL ASSERTION: System cash MUST be 700 (500 opening + 200 Caja 2 sale) and MUST NOT include the 300 from Caja 1!
    const resultCaja2 = store.closeCashShift(700);
    expect(resultCaja2.closingSystem).toBe(700);
    expect(resultCaja2.difference).toBe(0);
  });

  it('should apply global discounts (such as 25% Senior Citizen Tercera Edad) to cart items proportionally', () => {
    const store = useAppStore.getState();

    const productA: Product = {
      id: 'prod-disc-1',
      tenantId: store.tenant.id,
      sku: 'DISC-A',
      name: 'Producto A',
      category: 'General',
      unitOfMeasure: 'UND',
      salePrice: 100,
      costPrice: 50,
      currentStock: 20,
      minStockAlert: 5,
      taxClassification: 'EXENTO',
      isActive: true
    };

    useAppStore.setState({ products: [productA] });

    // Add 2 units: Gross = L. 200
    store.addToCart({ product: productA, quantity: 2 });
    expect(useAppStore.getState().cartLines[0].total).toBe(200);

    // Apply Senior Citizen discount: 25%
    store.applyGlobalCartDiscount(25, true);

    const discountedLines = useAppStore.getState().cartLines;
    expect(discountedLines[0].discountAmount).toBe(50); // 25% of 200 = 50
    expect(discountedLines[0].total).toBe(150);

    // Clear discount (0%)
    store.applyGlobalCartDiscount(0, false);
    const clearedLines = useAppStore.getState().cartLines;
    expect(clearedLines[0].discountAmount).toBe(0);
    expect(clearedLines[0].total).toBe(200);
  });

  it('should void a sale, restoring stock and registering a cash outflow in active shift', () => {
    const store = useAppStore.getState();
    store.openCashShift(500);

    const product: Product = {
      id: 'prod-void-1',
      tenantId: store.tenant.id,
      sku: 'VOID-01',
      name: 'Articulo Anulable',
      category: 'General',
      unitOfMeasure: 'UND',
      salePrice: 100,
      costPrice: 60,
      currentStock: 10,
      minStockAlert: 2,
      taxClassification: 'EXENTO',
      isActive: true
    };

    useAppStore.setState({ products: [product] });

    // Sell 2 units in cash (Total = L. 200)
    useAppStore.getState().addToCart({ product, quantity: 2 });
    const sale = useAppStore.getState().processSale('CASH');
    expect(sale).not.toBeNull();
    expect(sale?.total).toBe(200);

    // Stock should be 8
    const stockAfterSale = useAppStore.getState().products.find(p => p.id === product.id)?.currentStock;
    expect(stockAfterSale).toBe(8);

    // Void the sale
    const voidSuccess = store.voidSale(sale!.id, 'Error de cobro cajero');
    expect(voidSuccess).toBe(true);

    // Stock must be restored to 10
    const stockAfterVoid = useAppStore.getState().products.find(p => p.id === product.id)?.currentStock;
    expect(stockAfterVoid).toBe(10);

    // Sale status must be VOIDED
    const voidedSale = useAppStore.getState().sales.find(s => s.id === sale!.id);
    expect(voidedSale?.status).toBe('VOIDED');
    expect(voidedSale?.voidReason).toBe('Error de cobro cajero');

    // A cash movement of type SALIDA for L. 200 must be registered
    const movements = useAppStore.getState().cashMovements;
    const voidMovement = movements.find(m => m.referenceId === sale!.id && m.type === 'SALIDA');
    expect(voidMovement).toBeDefined();
    expect(voidMovement?.amount).toBe(200);

    // Attempting to void again should fail
    const secondVoid = store.voidSale(sale!.id, 'Duplicado intento');
    expect(secondVoid).toBe(false);
  });

  it('should process product return for defective/damaged waste without returning to sellable stock', () => {
    const store = useAppStore.getState();
    store.openCashShift(500);

    const product: Product = {
      id: 'prod-waste-1',
      tenantId: store.tenant.id,
      sku: 'WASTE-01',
      name: 'Leche Pasteurizada',
      category: 'Lácteos',
      unitOfMeasure: 'UND',
      salePrice: 30,
      costPrice: 20,
      currentStock: 10,
      minStockAlert: 2,
      taxClassification: 'EXENTO',
      isActive: true
    };

    useAppStore.setState({ products: [product] });

    // Sell 2 units (Total = L. 60)
    store.addToCart({ product, quantity: 2 });
    const sale = store.processSale('CASH');
    expect(sale).not.toBeNull();

    // Current stock is 8
    expect(useAppStore.getState().products.find(p => p.id === product.id)?.currentStock).toBe(8);

    // Customer returns 1 defective unit (isDamagedWaste = true)
    const refundSuccess = store.refundSale({
      saleId: sale!.id,
      reason: 'Empaque inflado / producto descompuesto',
      refundMethod: 'CASH',
      isDamagedWaste: true,
      items: [{
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: 30,
        subtotal: 30,
        isDamaged: true
      }]
    });

    expect(refundSuccess).toBe(true);

    // CRITICAL: Stock must REMAIN 8 (the damaged unit must NOT go back to sellable inventory)
    const stockAfterRefund = useAppStore.getState().products.find(p => p.id === product.id)?.currentStock;
    expect(stockAfterRefund).toBe(8);

    // An inventory adjustment of type MERMA_DANADO must be registered
    const adjustments = useAppStore.getState().inventoryAdjustments;
    expect(adjustments.length).toBeGreaterThan(0);
    expect(adjustments[0].type).toBe('MERMA_DANADO');
    expect(adjustments[0].quantity).toBe(1);

    // Sale must be marked as REFUNDED
    const refundedSale = useAppStore.getState().sales.find(s => s.id === sale!.id);
    expect(refundedSale?.status).toBe('REFUNDED');

    // Sales returns record exists
    const returns = useAppStore.getState().salesReturns;
    expect(returns.length).toBeGreaterThan(0);
    expect(returns[0].total).toBe(30);
  });

  it('should register manual inventory write-off adjustments (mermas / vencidos)', () => {
    const store = useAppStore.getState();

    const product: Product = {
      id: 'prod-adj-1',
      tenantId: store.tenant.id,
      sku: 'ADJ-01',
      name: 'Yogurt Fresa',
      category: 'Lácteos',
      unitOfMeasure: 'UND',
      salePrice: 25,
      costPrice: 15,
      currentStock: 15,
      minStockAlert: 2,
      taxClassification: 'EXENTO',
      isActive: true
    };

    useAppStore.setState({ products: [product] });

    store.addInventoryAdjustment({
      productId: product.id,
      productName: product.name,
      type: 'VENCIDO',
      quantity: 3,
      notes: 'Lote caducado en vitrina'
    });

    // Stock must be reduced from 15 to 12
    const updatedStock = useAppStore.getState().products.find(p => p.id === product.id)?.currentStock;
    expect(updatedStock).toBe(12);

    // Record must be stored in inventoryAdjustments
    const adjustments = useAppStore.getState().inventoryAdjustments;
    const adj = adjustments.find(a => a.productId === product.id);
    expect(adj).toBeDefined();
    expect(adj?.type).toBe('VENCIDO');
    expect(adj?.previousStock).toBe(15);
    expect(adj?.newStock).toBe(12);
  });

  it('should force EXENTO tax classification and zero ISV when tenant has isFiscalEnabled set to false', () => {
    useAppStore.setState({
      tenant: { ...useAppStore.getState().tenant, isFiscalEnabled: false }
    });

    const testProduct: Product = {
      id: 'prod-nonfiscal-1',
      tenantId: useAppStore.getState().tenant.id,
      sku: 'TAX-01',
      name: 'Producto Gravable',
      category: 'General',
      unitOfMeasure: 'UND',
      salePrice: 115,
      costPrice: 80,
      currentStock: 10,
      minStockAlert: 1,
      taxClassification: 'GRAVADO_15',
      isActive: true
    };

    useAppStore.setState({ products: [testProduct] });
    useAppStore.getState().addToCart({ product: testProduct, quantity: 1 });

    const cart = useAppStore.getState().cartLines;
    expect(cart.length).toBe(1);
    expect(cart[0].taxClassification).toBe('EXENTO');
    expect(cart[0].taxAmount).toBe(0);
    expect(cart[0].subtotal).toBe(115);
  });

  it('should deduct linked service supplies from inventory upon completing sale', () => {
    const store = useAppStore.getState();
    store.openCashShift(1000);

    const supplyProduct: Product = {
      id: 'prod-supply-1',
      tenantId: store.tenant.id,
      sku: 'SUP-01',
      name: 'Tinte Profesional',
      category: 'Insumos',
      unitOfMeasure: 'UND',
      salePrice: 150,
      costPrice: 80,
      currentStock: 10,
      minStockAlert: 2,
      taxClassification: 'EXENTO',
      isActive: true
    };

    const service = {
      id: 'serv-hair-1',
      tenantId: store.tenant.id,
      name: 'Tinte y Peinado',
      durationMinutes: 60,
      price: 500,
      commissionType: 'FIXED' as const,
      commissionValue: 100,
      isActive: true,
      supplies: [{ productId: supplyProduct.id, quantity: 2 }]
    };

    useAppStore.setState({
      products: [supplyProduct],
      services: [service]
    });

    // Add service to cart
    store.addToCart({ service, quantity: 1 });
    expect(useAppStore.getState().cartLines.length).toBe(1);

    // Process sale
    const sale = store.processSale('CASH');
    expect(sale).not.toBeNull();

    // Verify supply stock is deducted by 2 (10 - 2 = 8)
    const updatedSupply = useAppStore.getState().products.find(p => p.id === supplyProduct.id);
    expect(updatedSupply?.currentStock).toBe(8);
  });

  it('should register a cash movement SALIDA in active shift when liquidating commissions with payFromActiveShift', () => {
    const store = useAppStore.getState();
    store.openCashShift(2000);
    const activeShift = useAppStore.getState().activeShift;
    expect(activeShift).not.toBeNull();

    const pendingCommission = {
      id: 'comm-test-1',
      tenantId: store.tenant.id,
      saleId: 'sale-test-1',
      staffId: 'staff-carlos-1',
      staffName: 'Carlos Barbero',
      serviceId: 'serv-1',
      serviceName: 'Corte Caballero',
      saleAmount: 200,
      commissionAmount: 50,
      status: 'PENDING' as const,
      createdAt: new Date().toISOString()
    };

    useAppStore.setState({
      commissions: [pendingCommission]
    });

    // Liquidate commissions from active cash shift
    store.payStaffCommissions('staff-carlos-1', { payFromActiveShift: true });

    // Verify commission is marked as PAID
    const comm = useAppStore.getState().commissions.find(c => c.id === 'comm-test-1');
    expect(comm?.status).toBe('PAID');
    expect(comm?.paidFromShiftId).toBe(activeShift?.id);

    // Verify SALIDA cash movement was registered
    const movements = useAppStore.getState().cashMovements;
    const salidaMov = movements.find(m => m.type === 'SALIDA' && m.referenceId === 'comm-payout-staff-carlos-1');
    expect(salidaMov).toBeDefined();
    expect(salidaMov?.amount).toBe(50);
    expect(salidaMov?.cashShiftId).toBe(activeShift?.id);
  });

  it('should add and manage schedule blocks (BLOCK type) in appointments', () => {
    const store = useAppStore.getState();

    store.addAppointment({
      type: 'BLOCK',
      blockReason: 'Almuerzo',
      customerName: '[Bloqueo] Almuerzo',
      staffId: 'staff-ana-1',
      staffName: 'Ana Estilista',
      serviceId: 'block',
      serviceName: 'Bloqueo: Almuerzo',
      scheduledAt: new Date().toISOString(),
      durationMinutes: 60,
      status: 'SCHEDULED',
      notes: 'Horario bloqueado: Almuerzo'
    });

    const appointments = useAppStore.getState().appointments;
    const blockApp = appointments.find(a => a.type === 'BLOCK');
    expect(blockApp).toBeDefined();
    expect(blockApp?.blockReason).toBe('Almuerzo');
    expect(blockApp?.durationMinutes).toBe(60);
    expect(blockApp?.status).toBe('SCHEDULED');
  });

  it('should add packaging presentation to cart and deduct multiplied base units upon sale', () => {
    const store = useAppStore.getState();
    store.openCashShift(500);

    const testProduct: Product = {
      id: 'prod-pack-1',
      tenantId: store.tenant.id,
      sku: 'JAB-PACK',
      name: 'Jabón Protex',
      category: 'Cuidado Personal',
      unitOfMeasure: 'UND',
      salePrice: 25,
      costPrice: 15,
      currentStock: 20,
      minStockAlert: 5,
      taxClassification: 'EXENTO',
      isActive: true,
      presentations: [
        {
          id: 'pres-pack-3',
          name: 'Pack x3',
          unitsCount: 3,
          salePrice: 65,
          barcode: '7501002003'
        }
      ]
    };

    useAppStore.setState({ products: [testProduct] });

    // Add 2 packs of 3 to cart (requires 2 * 3 = 6 base units)
    store.addToCart({
      product: testProduct,
      presentation: testProduct.presentations![0],
      quantity: 2
    });

    const cart = useAppStore.getState().cartLines;
    expect(cart.length).toBe(1);
    expect(cart[0].name).toBe('Jabón Protex [Pack x3]');
    expect(cart[0].unitPrice).toBe(65);
    expect(cart[0].quantity).toBe(2);
    expect(cart[0].unitsPerPackage).toBe(3);
    expect(cart[0].total).toBe(130);

    // Process sale
    const sale = store.processSale('CASH');
    expect(sale).not.toBeNull();

    // Verify product currentStock: 20 - 6 = 14
    const updatedProd = useAppStore.getState().products.find(p => p.id === 'prod-pack-1');
    expect(updatedProd?.currentStock).toBe(14);
  });

  it('should block adding packaging presentation when base units are insufficient', () => {
    useAppStore.setState({
      tenant: { ...useAppStore.getState().tenant, allowNegativeStock: false }
    });

    const testProduct: Product = {
      id: 'prod-pack-2',
      tenantId: useAppStore.getState().tenant.id,
      sku: 'JAB-PACK-2',
      name: 'Jabón Palmolive',
      category: 'Cuidado Personal',
      unitOfMeasure: 'UND',
      salePrice: 20,
      costPrice: 12,
      currentStock: 2, // Only 2 units in stock
      minStockAlert: 1,
      taxClassification: 'EXENTO',
      isActive: true,
      presentations: [
        {
          id: 'pres-pack-3b',
          name: 'Pack x3',
          unitsCount: 3, // Requires 3 units
          salePrice: 55
        }
      ]
    };

    useAppStore.setState({ products: [testProduct] });

    // Trying to add 1 Pack x3 (needs 3 units, only 2 available)
    useAppStore.getState().addToCart({
      product: testProduct,
      presentation: testProduct.presentations![0],
      quantity: 1
    });

    expect(useAppStore.getState().cartLines.length).toBe(0);
  });

  it('should support having both individual units and pack presentations in cart simultaneously', () => {
    const store = useAppStore.getState();
    store.openCashShift(500);

    const testProduct: Product = {
      id: 'prod-pack-3',
      tenantId: store.tenant.id,
      sku: 'JAB-PACK-3',
      name: 'Jabón Dove',
      category: 'Cuidado Personal',
      unitOfMeasure: 'UND',
      salePrice: 30,
      costPrice: 20,
      currentStock: 10,
      minStockAlert: 2,
      taxClassification: 'EXENTO',
      isActive: true,
      presentations: [
        {
          id: 'pres-pack-3c',
          name: 'Pack x3',
          unitsCount: 3,
          salePrice: 80
        }
      ]
    };

    useAppStore.setState({ products: [testProduct] });

    // Add 1 individual unit
    store.addToCart({ product: testProduct, quantity: 1 });
    // Add 1 pack of 3
    store.addToCart({ product: testProduct, presentation: testProduct.presentations![0], quantity: 1 });

    const cart = useAppStore.getState().cartLines;
    expect(cart.length).toBe(2);
    expect(cart[0].name).toBe('Jabón Dove');
    expect(cart[1].name).toBe('Jabón Dove [Pack x3]');

    // Process sale: 1 unit + 3 units = 4 base units deducted
    store.processSale('CASH');

    const updatedProd = useAppStore.getState().products.find(p => p.id === 'prod-pack-3');
    expect(updatedProd?.currentStock).toBe(6); // 10 - 4 = 6
  });

  it('should correctly increment base units and update CPP when purchasing packaging presentations', () => {
    const store = useAppStore.getState();

    const testProduct: Product = {
      id: 'prod-pack-pur',
      tenantId: store.tenant.id,
      sku: 'JAB-PUR',
      name: 'Jabón Rexona',
      category: 'Cuidado Personal',
      unitOfMeasure: 'UND',
      salePrice: 20,
      costPrice: 10,
      currentStock: 0,
      minStockAlert: 5,
      taxClassification: 'EXENTO',
      isActive: true,
      presentations: [
        {
          id: 'pres-rex-3',
          name: 'Pack x3',
          unitsCount: 3,
          salePrice: 55
        }
      ]
    };

    useAppStore.setState({ products: [testProduct] });

    // Purchase 5 packs of 3 at L. 45 per pack (5 * 3 = 15 units received, base unit cost = 45 / 3 = 15)
    store.processPurchase(
      {
        supplierId: 'supp-1',
        supplierName: 'Distribuidora Central',
        invoiceNumber: 'FAC-001',
        issueDate: '2026-10-10',
        dueDate: '2026-11-10',
        subtotal: 225,
        taxAmount: 0,
        total: 225,
        paidAmount: 0,
        paymentTerms: 'CREDIT',
        paymentStatus: 'UNPAID'
      },
      [
        {
          productId: 'prod-pack-pur',
          quantity: 5,
          unitCost: 45,
          unitsPerPackage: 3,
          presentationId: 'pres-rex-3',
          presentationName: 'Pack x3'
        }
      ]
    );

    const updatedProd = useAppStore.getState().products.find(p => p.id === 'prod-pack-pur');
    expect(updatedProd?.currentStock).toBe(15);
    expect(updatedProd?.costPrice).toBe(15);
  });

  it('should restitute multiplied packaging units when a sale is voided', () => {
    const store = useAppStore.getState();
    store.openCashShift(500);

    const testProduct: Product = {
      id: 'prod-pack-void',
      tenantId: store.tenant.id,
      sku: 'JAB-VOID',
      name: 'Jabón Zote',
      category: 'Lavandería',
      unitOfMeasure: 'UND',
      salePrice: 30,
      costPrice: 15,
      currentStock: 10,
      minStockAlert: 2,
      taxClassification: 'EXENTO',
      isActive: true,
      presentations: [
        {
          id: 'pres-zote-2',
          name: 'Dúo Pack (x2)',
          unitsCount: 2,
          salePrice: 55
        }
      ]
    };

    useAppStore.setState({ products: [testProduct] });

    // Sell 2 Dúo Packs (4 units)
    store.addToCart({
      product: testProduct,
      presentation: testProduct.presentations![0],
      quantity: 2
    });

    const sale = store.processSale('CASH');
    expect(sale).not.toBeNull();

    // Stock should be 10 - 4 = 6
    let prod = useAppStore.getState().products.find(p => p.id === 'prod-pack-void');
    expect(prod?.currentStock).toBe(6);

    // Void the sale
    store.voidSale(sale!.id, 'Cliente devolvió el producto');

    // Stock should be back to 10
    prod = useAppStore.getState().products.find(p => p.id === 'prod-pack-void');
    expect(prod?.currentStock).toBe(10);
  });
});

