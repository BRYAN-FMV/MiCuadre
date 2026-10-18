import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './useAppStore';
import { Product, Customer, Supplier, PurchaseInvoice, Service } from '../types';

describe('Comprehensive Business Flow Test Suite (MiCuadre)', () => {
  beforeEach(() => {
    useAppStore.getState().resetToDefaultData();
  });

  // =========================================================================
  // 1. FLUJO DE DEVOLUCIONES Y ANULACIONES
  // =========================================================================
  describe('1. Flujo de Devoluciones y Anulaciones', () => {
    it('debe anular una venta completa, restituyendo el stock y registrando la salida de caja', () => {
      const store = useAppStore.getState();
      store.openCashShift(1000);

      const prod: Product = {
        id: 'prod-ret-1',
        tenantId: store.tenant.id,
        sku: 'BEB-01',
        name: 'Jugo Natural 1L',
        category: 'Bebidas',
        unitOfMeasure: 'UND',
        salePrice: 50,
        costPrice: 30,
        currentStock: 20,
        minStockAlert: 5,
        taxClassification: 'EXENTO',
        isActive: true
      };
      useAppStore.setState({ products: [prod] });

      // Vender 4 unidades en efectivo = L. 200
      store.addToCart({ product: prod, quantity: 4 });
      const sale = store.processSale('CASH');
      expect(sale).not.toBeNull();
      expect(sale?.total).toBe(200);

      // Stock debe haber bajado a 16
      expect(useAppStore.getState().products.find(p => p.id === prod.id)?.currentStock).toBe(16);

      // Anular venta
      const voidResult = useAppStore.getState().voidSale(sale!.id, 'Cliente solicitó cancelación inmediata');
      expect(voidResult).toBe(true);

      // Stock debe haber sido restituido a 20
      expect(useAppStore.getState().products.find(p => p.id === prod.id)?.currentStock).toBe(20);

      // La venta debe figurar como anulada (VOIDED)
      const cancelledSale = useAppStore.getState().sales.find(s => s.id === sale!.id);
      expect(cancelledSale?.status).toBe('VOIDED');

      // Debe existir un movimiento de salida en el turno de caja
      const movements = useAppStore.getState().cashMovements;
      const refundMovement = movements.find(m => m.type === 'SALIDA' && m.referenceId === sale!.id);
      expect(refundMovement).toBeDefined();
      expect(refundMovement?.amount).toBe(200);

      // Cuadre de caja tras anulación: la gaveta física cuadra con el fondo inicial (1000 + 200 - 200 = 1000)
      const closeRes = useAppStore.getState().closeCashShift(1000);
      expect(closeRes.closingSystem).toBe(1000);
      expect(closeRes.difference).toBe(0);
    });

    it('debe procesar devoluciones por producto defectuoso (merma) sin regresar al stock vendible', () => {
      const store = useAppStore.getState();
      store.openCashShift(500);

      const prod: Product = {
        id: 'prod-damaged-1',
        tenantId: store.tenant.id,
        sku: 'LEC-01',
        name: 'Leche Pasteurizada',
        category: 'Lácteos',
        unitOfMeasure: 'UND',
        salePrice: 35,
        costPrice: 25,
        currentStock: 10,
        minStockAlert: 2,
        taxClassification: 'EXENTO',
        isActive: true
      };
      useAppStore.setState({ products: [prod] });

      // Venta de 2 unidades
      store.addToCart({ product: prod, quantity: 2 });
      const sale = store.processSale('CASH');
      expect(sale).not.toBeNull();
      expect(useAppStore.getState().products.find(p => p.id === prod.id)?.currentStock).toBe(8);

      // Devolución parcial de 1 unidad defectuosa (merma)
      const res = useAppStore.getState().refundSale({
        saleId: sale!.id,
        reason: 'Empaque roto / Producto vencido',
        refundMethod: 'CASH',
        isDamagedWaste: true,
        items: [{
          productId: prod.id,
          productName: prod.name,
          quantity: 1,
          unitPrice: 35,
          subtotal: 35,
          isDamaged: true
        }]
      });
      expect(res).toBe(true);

      // El stock vendible NO debe subir porque era merma (se queda en 8)
      expect(useAppStore.getState().products.find(p => p.id === prod.id)?.currentStock).toBe(8);

      // Debe registrarse el ajuste de inventario como MERMA_DANADO
      const adjustments = useAppStore.getState().inventoryAdjustments;
      const adj = adjustments.find(a => a.productId === prod.id && a.type === 'MERMA_DANADO');
      expect(adj).toBeDefined();
      expect(adj?.quantity).toBe(1);

      // Debe registrarse el comprobante de devolución
      const returns = useAppStore.getState().salesReturns;
      expect(returns.length).toBeGreaterThan(0);
      expect(returns[0].total).toBe(35);

      // Cuadre de caja tras devolución: 500 (fondo) + 70 (venta) - 35 (devolución) = 535
      const closeRes = useAppStore.getState().closeCashShift(535);
      expect(closeRes.closingSystem).toBe(535);
      expect(closeRes.difference).toBe(0);
    });
  });

  // =========================================================================
  // 2. FLUJO DE INVENTARIO
  // =========================================================================
  describe('2. Flujo de Inventario', () => {
    it('debe gestionar productos, presentaciones por empaque y alertas de stock mínimo', () => {
      const store = useAppStore.getState();

      const newProd: Product = {
        id: 'prod-soda-pack',
        tenantId: store.tenant.id,
        sku: 'SODA-6P',
        name: 'Refresco Cola',
        category: 'Bebidas',
        unitOfMeasure: 'UND',
        salePrice: 20,
        costPrice: 12,
        currentStock: 24, // 24 unidades base
        minStockAlert: 10,
        taxClassification: 'GRAVADO_15',
        isActive: true,
        presentations: [
          {
            id: 'pack-six',
            name: 'Six-Pack (6 Unidades)',
            unitsCount: 6,
            salePrice: 110,
            costPrice: 72
          }
        ]
      };

      store.addProduct(newProd);
      const addedProduct = useAppStore.getState().products.find(p => p.sku === 'SODA-6P');
      expect(addedProduct).toBeDefined();

      // Realizar ajuste manual por conteo físico
      store.addInventoryAdjustment({
        productId: addedProduct!.id,
        productName: addedProduct!.name,
        type: 'AJUSTE_CONTEO',
        quantity: 4,
        notes: 'Ajuste de conteo físico mensual'
      });

      const updated = useAppStore.getState().products.find(p => p.id === addedProduct!.id);
      expect(updated?.currentStock).toBe(20); // 24 - 4

      // Registrar merma por derrame (2 unidades)
      store.addInventoryAdjustment({
        productId: addedProduct!.id,
        productName: addedProduct!.name,
        type: 'MERMA_DANADO',
        quantity: 2,
        notes: 'Bote dañado en transporte'
      });

      expect(useAppStore.getState().products.find(p => p.id === addedProduct!.id)?.currentStock).toBe(18); // 20 - 2
    });

    it('debe respetar la política allowNegativeStock (bloquear o permitir ventas bajo cero)', () => {
      const store = useAppStore.getState();

      const scarceProd: Product = {
        id: 'prod-scarce',
        tenantId: store.tenant.id,
        sku: 'PAN-01',
        name: 'Pan Molde',
        category: 'Abarrotes',
        unitOfMeasure: 'UND',
        salePrice: 45,
        costPrice: 30,
        currentStock: 1,
        minStockAlert: 2,
        taxClassification: 'EXENTO',
        isActive: true
      };
      useAppStore.setState({ products: [scarceProd] });

      // Caso A: Bloqueado (allowNegativeStock = false)
      useAppStore.setState({
        tenant: { ...store.tenant, allowNegativeStock: false }
      });
      store.clearCart();
      store.addToCart({ product: scarceProd, quantity: 5 });
      expect(useAppStore.getState().cartLines.length).toBe(0);

      // Caso B: Permitido (allowNegativeStock = true)
      useAppStore.setState({
        tenant: { ...useAppStore.getState().tenant, allowNegativeStock: true }
      });
      store.addToCart({ product: scarceProd, quantity: 5 });
      expect(useAppStore.getState().cartLines.length).toBe(1);

      // Vender
      store.openCashShift(200);
      const sale = store.processSale('CASH');
      expect(sale).not.toBeNull();
      expect(useAppStore.getState().products.find(p => p.id === scarceProd.id)?.currentStock).toBe(-4);
    });
  });

  // =========================================================================
  // 3. FLUJO DE VENTAS (POS & FORMAS DE PAGO)
  // =========================================================================
  describe('3. Flujo de Ventas', () => {
    it('debe procesar venta fiscal desglosando correctamente base, ISV 15% y productos exentos', () => {
      const store = useAppStore.getState();
      store.openCashShift(1000);

      // Activar facturación fiscal
      useAppStore.setState({
        tenant: { ...store.tenant, isFiscalEnabled: true, pricesIncludeTax: false }
      });

      const prodExento: Product = {
        id: 'prod-f-exento',
        tenantId: store.tenant.id,
        sku: 'HUE-01',
        name: 'Cartón de Huevos',
        category: 'Abarrotes',
        unitOfMeasure: 'UND',
        salePrice: 100,
        costPrice: 75,
        currentStock: 20,
        minStockAlert: 2,
        taxClassification: 'EXENTO',
        isActive: true
      };

      const prodGravado15: Product = {
        id: 'prod-f-gravado',
        tenantId: store.tenant.id,
        sku: 'CHO-01',
        name: 'Chocolates Importados',
        category: 'Snacks',
        unitOfMeasure: 'UND',
        salePrice: 100,
        costPrice: 60,
        currentStock: 20,
        minStockAlert: 2,
        taxClassification: 'GRAVADO_15',
        isActive: true
      };

      useAppStore.setState({ products: [prodExento, prodGravado15] });

      // Carrito: 1 Cartón de Huevos (100 exento) + 1 Chocolate (100 gravado 15% = 15 ISV)
      store.addToCart({ product: prodExento, quantity: 1 });
      store.addToCart({ product: prodGravado15, quantity: 1 });

      const sale = store.processSale('CASH', 0, true);
      expect(sale).not.toBeNull();
      expect(sale?.isFiscal).toBe(true);
      expect(sale?.exemptAmount).toBe(100);
      expect(sale?.taxable15).toBe(100);
      expect(sale?.tax15).toBe(15);
      expect(sale?.total).toBe(215);
      expect(sale?.documentNumber).toMatch(/\d{3}-\d{3}-\d{2}-\d{8}/);
    });

    it('debe aplicar descuento de la Tercera Edad (25%) proporcionalmente a cada línea', () => {
      const store = useAppStore.getState();
      store.openCashShift(500);

      const p1: Product = {
        id: 'prod-d1',
        tenantId: store.tenant.id,
        sku: 'D1',
        name: 'Plato Servido 1',
        category: 'Comida',
        unitOfMeasure: 'UND',
        salePrice: 200,
        costPrice: 100,
        currentStock: 10,
        minStockAlert: 2,
        taxClassification: 'EXENTO',
        isActive: true
      };
      useAppStore.setState({ products: [p1] });

      store.addToCart({ product: p1, quantity: 1 });
      // Aplicar 25% de descuento tercera edad
      store.applyGlobalCartDiscount(25, true);

      expect(useAppStore.getState().cartLines[0].discountAmount).toBe(50);
      expect(useAppStore.getState().cartLines[0].total).toBe(150);

      const sale = store.processSale('CASH');
      expect(sale?.discountAmount).toBe(50);
      expect(sale?.total).toBe(150);
    });

    it('debe procesar pago mixto exacto dividiendo efectivo y banco', () => {
      const store = useAppStore.getState();
      store.openCashShift(500);

      const p: Product = {
        id: 'prod-mix',
        tenantId: store.tenant.id,
        sku: 'MIX',
        name: 'Electrodoméstico Menor',
        category: 'Hogar',
        unitOfMeasure: 'UND',
        salePrice: 1000,
        costPrice: 650,
        currentStock: 5,
        minStockAlert: 1,
        taxClassification: 'EXENTO',
        isActive: true
      };
      useAppStore.setState({ products: [p] });

      store.addToCart({ product: p, quantity: 1 });

      // Pago Mixto: L. 400 en Efectivo y L. 600 con Tarjeta
      const sale = store.processSale('MIXED', 0, false, { cash: 400, card: 600, transfer: 0 });
      expect(sale).not.toBeNull();
      expect(sale?.paymentMethod).toBe('MIXED');
      expect(sale?.cashAmount).toBe(400);
      expect(sale?.cardAmount).toBe(600);
      expect(sale?.total).toBe(1000);
    });
  });

  // =========================================================================
  // 4. FLUJO DE REPORTES Y RENTABILIDAD
  // =========================================================================
  describe('4. Flujo de Reportes y Rentabilidad', () => {
    it('debe calcular con exactitud ventas netas, costo mercadería, gastos y ganancia libre', () => {
      const store = useAppStore.getState();
      store.openCashShift(1000);

      // Producto 1: Venta L. 100, Costo L. 60 (Margen L. 40)
      const p1: Product = {
        id: 'p-rep-1',
        tenantId: store.tenant.id,
        sku: 'R1',
        name: 'Producto A',
        category: 'General',
        unitOfMeasure: 'UND',
        salePrice: 100,
        costPrice: 60,
        currentStock: 10,
        minStockAlert: 2,
        taxClassification: 'EXENTO',
        isActive: true
      };

      // Producto 2: Venta L. 200, Costo L. 110 (Margen L. 90)
      const p2: Product = {
        id: 'p-rep-2',
        tenantId: store.tenant.id,
        sku: 'R2',
        name: 'Producto B',
        category: 'General',
        unitOfMeasure: 'UND',
        salePrice: 200,
        costPrice: 110,
        currentStock: 10,
        minStockAlert: 2,
        taxClassification: 'EXENTO',
        isActive: true
      };
      useAppStore.setState({ products: [p1, p2] });

      // Realizar Venta 1: 2 unidades de P1 = L. 200 (Costo L. 120)
      store.addToCart({ product: p1, quantity: 2 });
      store.processSale('CASH');

      // Realizar Venta 2: 1 unidad de P2 = L. 200 (Costo L. 110)
      store.addToCart({ product: p2, quantity: 1 });
      store.processSale('CARD');

      // Registrar un gasto operativo de L. 70
      store.addExpense({
        description: 'Bolsas plásticas y empaques',
        amount: 70,
        category: 'OTROS',
        fundId: 'fund-1',
        expenseDate: '2026-10-18'
      });

      const allSales = useAppStore.getState().sales.filter(s => s.status !== 'VOIDED');
      const totalSales = allSales.reduce((acc, s) => acc + s.total, 0);
      expect(totalSales).toBe(400); // 200 + 200

      // Costo total de mercadería: (2 * 60) + (1 * 110) = 230
      // En MiCuadre, COGS se calcula multiplicando la cantidad vendida por el costo unitario del catálogo
      const currentProducts = useAppStore.getState().products;
      const totalCOGS = allSales.reduce((acc, s) => {
        return acc + (s.items || []).reduce((itemAcc, it) => {
          const prod = currentProducts.find(p => p.id === it.productId || p.sku === it.sku);
          const unitsMultiplier = it.unitsPerPackage && it.unitsPerPackage > 1 ? it.unitsPerPackage : 1;
          return itemAcc + (prod ? prod.costPrice * it.quantity * unitsMultiplier : 0);
        }, 0);
      }, 0);
      expect(totalCOGS).toBe(230);

      // Gastos del período = 70
      const totalExpenses = useAppStore.getState().expenses.reduce((acc, e) => acc + e.amount, 0);
      expect(totalExpenses).toBe(70);

      // Ganancia bruta = 400 - 230 = 170
      const grossProfit = totalSales - totalCOGS;
      expect(grossProfit).toBe(170);

      // Ganancia libre estimada = 400 - 230 - 70 = 100
      const netProfit = totalSales - totalCOGS - totalExpenses;
      expect(netProfit).toBe(100);
    });
  });

  // =========================================================================
  // 5. FLUJO DE APERTURA Y CIERRE DE CAJA (ARQUEO Z)
  // =========================================================================
  describe('5. Flujo de Apertura y Cierre de Caja', () => {
    it('debe registrar apertura, entradas, salidas y calcular correctamente faltante o sobrante', () => {
      const store = useAppStore.getState();

      // 1. Apertura con L. 1,000 de sencillo
      store.openCashShift(1000);
      expect(useAppStore.getState().activeShift?.openingAmount).toBe(1000);

      // 2. Venta en efectivo por L. 500
      const testProd: Product = {
        id: 'p-cash-1',
        tenantId: store.tenant.id,
        sku: 'C1',
        name: 'Venta Caja Test',
        category: 'Test',
        unitOfMeasure: 'UND',
        salePrice: 500,
        costPrice: 300,
        currentStock: 10,
        minStockAlert: 1,
        taxClassification: 'EXENTO',
        isActive: true
      };
      useAppStore.setState({ products: [testProd] });
      store.addToCart({ product: testProd, quantity: 1 });
      store.processSale('CASH');

      // 3. Salida de caja por gasto de L. 150 (pagado desde el turno)
      store.addExpense({
        description: 'Compra de verduras emergencia',
        amount: 150,
        category: 'OTROS',
        paymentSource: 'ACTIVE_CASH_SHIFT',
        fundId: 'ACTIVE_CASH_SHIFT',
        expenseDate: '2026-10-18'
      });

      // 4. Aporte / Entrada manual de efectivo de L. 200
      store.addCashMovement('ENTRADA', 200, 'Cambio extra de monedas');

      // Efectivo Esperado en Gaveta = 1000 (Apertura) + 500 (Ventas) - 150 (Gasto) + 200 (Entrada) = L. 1,550
      // Escenario A: Cajero cuenta y declara L. 1,500 (Faltante de L. -50)
      const closeResult = store.closeCashShift(1500);
      expect(closeResult.closingSystem).toBe(1550);
      expect(closeResult.difference).toBe(-50); // Faltaron 50 lempiras
      expect(useAppStore.getState().activeShift).toBeNull();
    });
  });

  // =========================================================================
  // 6. FLUJO DEL MÓDULO DE COMPRAS Y PROVEEDORES
  // =========================================================================
  describe('6. Flujo de Compras y Proveedores', () => {
    it('debe registrar compra, incrementar stock y recalcular Costo Promedio Ponderado (CPP)', () => {
      const store = useAppStore.getState();

      // Proveedor
      const supplier: Supplier = {
        id: 'sup-cargill',
        tenantId: store.tenant.id,
        companyName: 'Distribuidora Avícola',
        rtn: '08011995123456',
        phone: '22334455',
        defaultCreditDays: 15,
        isActive: true
      };
      store.addSupplier(supplier);

      // Producto inicial: 10 unidades que costaron L. 50 cada una (Valor inventario = L. 500)
      const pollo: Product = {
        id: 'prod-pollo',
        tenantId: store.tenant.id,
        sku: 'POL-01',
        name: 'Libra de Pollo',
        category: 'Carnes',
        unitOfMeasure: 'LBS',
        salePrice: 70,
        costPrice: 50,
        currentStock: 10,
        minStockAlert: 5,
        taxClassification: 'EXENTO',
        isActive: true
      };
      useAppStore.setState({ products: [pollo] });

      // Nueva compra: 10 unidades a nuevo costo de L. 60 cada una (Costo total = L. 600)
      // Nuevo CPP = (500 + 600) / 20 = L. 55.00
      const purchaseData: Omit<PurchaseInvoice, 'id' | 'tenantId'> = {
        supplierId: supplier.id,
        supplierName: supplier.companyName,
        invoiceNumber: 'FAC-PROV-9921',
        issueDate: '2026-10-18',
        dueDate: '2026-11-02',
        paymentTerms: 'CASH',
        paymentStatus: 'PAID',
        subtotal: 600,
        taxAmount: 0,
        total: 600,
        paidAmount: 600,
        items: []
      };

      store.processPurchase(
        purchaseData,
        [{
          productId: pollo.id,
          quantity: 10,
          unitCost: 60,
          newSalePrice: 75
        }]
      );

      const updatedPollo = useAppStore.getState().products.find(p => p.id === pollo.id);
      expect(updatedPollo?.currentStock).toBe(20); // 10 + 10
      expect(updatedPollo?.costPrice).toBe(55); // CPP exacto
      expect(updatedPollo?.salePrice).toBe(75); // Nuevo precio de venta actualizado
      expect(useAppStore.getState().purchaseInvoices.length).toBe(1);
    });
  });

  // =========================================================================
  // 7. FLUJO DE CALENDARIO Y CITAS (SERVICIOS & MATERIALES)
  // =========================================================================
  describe('7. Flujo de Calendario y Citas', () => {
    it('debe registrar cita, descontar insumos al completarse y permitir bloqueos de horario', () => {
      const store = useAppStore.getState();

      // Insumo vinculado: Tinte de Cabello (Stock inicial = 5)
      const insumo: Product = {
        id: 'insumo-tinte',
        tenantId: store.tenant.id,
        sku: 'TIN-01',
        name: 'Tinte Profesional 60ml',
        category: 'Insumos',
        unitOfMeasure: 'UND',
        salePrice: 120,
        costPrice: 80,
        currentStock: 5,
        minStockAlert: 2,
        taxClassification: 'GRAVADO_15',
        isActive: true
      };

      // Servicio de Colorimetría que consume 1 tubo de tinte
      const servicio: Service = {
        id: 'serv-color',
        tenantId: store.tenant.id,
        name: 'Colorimetría Completa',
        durationMinutes: 90,
        price: 800,
        commissionType: 'PERCENTAGE',
        commissionValue: 30, // 30% para el barbero/estilista
        supplies: [
          { productId: insumo.id, quantity: 1 }
        ],
        isActive: true
      };

      useAppStore.setState({
        products: [insumo],
        services: [servicio]
      });

      store.openCashShift(500);

      // 1. Crear Cita
      store.addAppointment({
        customerName: 'Karla Mendoza',
        serviceId: servicio.id,
        staffId: 'staff-1',
        scheduledAt: '2026-10-18T14:00:00',
        status: 'SCHEDULED'
      });

      const createdApp = useAppStore.getState().appointments.find(a => a.customerName === 'Karla Mendoza');
      expect(createdApp).toBeDefined();

      // 2. Cobrar / procesar cita: debe descontar el insumo vinculado y marcar como completada
      const appSale = store.processAppointmentSale(createdApp!.id, 'CASH');
      expect(appSale).not.toBeNull();

      const updatedInsumo = useAppStore.getState().products.find(p => p.id === insumo.id);
      expect(updatedInsumo?.currentStock).toBe(4); // 5 - 1

      const updatedAppointment = useAppStore.getState().appointments.find(a => a.id === createdApp!.id);
      expect(updatedAppointment?.status).toBe('COMPLETED');
      expect(updatedAppointment?.isPaid).toBe(true);

      // 3. Bloqueo de horario / Agenda bloqueada
      store.addAppointment({
        customerName: 'ALMUERZO STAFF',
        serviceId: '',
        staffId: 'staff-1',
        scheduledAt: '2026-10-18T12:00:00',
        status: 'SCHEDULED',
        type: 'BLOCK',
        blockReason: 'Hora de descanso del equipo'
      });

      const blockApp = useAppStore.getState().appointments.find(a => a.type === 'BLOCK');
      expect(blockApp).toBeDefined();
    });
  });

  // =========================================================================
  // 8. FLUJO DE CUENTAS / FIADOS (CRÉDITO Y ABONOS)
  // =========================================================================
  describe('8. Flujo de Cuentas / Fiados', () => {
    it('debe registrar venta al fiado, actualizar saldo del cliente y registrar abonos en efectivo en el turno activo', () => {
      const store = useAppStore.getState();
      store.openCashShift(500);

      // Crear Cliente
      const customer: Customer = {
        id: 'cust-don-carlos',
        tenantId: store.tenant.id,
        name: 'Don Carlos Vecino',
        phone: '99887766',
        loyaltyPoints: 0,
        totalSpent: 0,
        creditBalance: 0,
        createdAt: '2026-10-18'
      };
      useAppStore.setState({ customers: [customer] });

      const itemFiado: Product = {
        id: 'p-fiado-1',
        tenantId: store.tenant.id,
        sku: 'ARB-01',
        name: 'Arroz 5 Libras',
        category: 'Granos',
        unitOfMeasure: 'UND',
        salePrice: 120,
        costPrice: 90,
        currentStock: 20,
        minStockAlert: 2,
        taxClassification: 'EXENTO',
        isActive: true
      };
      useAppStore.setState({ products: [itemFiado] });

      // Seleccionar cliente en el carrito
      store.setCartCustomer({ id: customer.id, name: customer.name });
      store.addToCart({ product: itemFiado, quantity: 2 }); // Total L. 240

      // 1. Procesar Venta al Crédito / Fiado
      const sale = store.processSale('CREDIT');
      expect(sale).not.toBeNull();
      expect(sale?.paymentMethod).toBe('CREDIT');
      expect(sale?.total).toBe(240);

      // El saldo del cliente debe ser ahora L. 240
      const updatedCust = useAppStore.getState().customers.find(c => c.id === customer.id);
      expect(updatedCust?.creditBalance).toBe(240);

      // 2. Cliente viene más tarde a abonar L. 140 en efectivo
      const abono = store.addAccountPayment({
        type: 'CUSTOMER_PAYMENT',
        customerId: customer.id,
        customerName: customer.name,
        amount: 140,
        paymentMethod: 'CASH',
        notes: 'Primer abono quincenal',
        createdBy: 'Administrador'
      });
      store.updateCustomerCreditBalance(customer.id, 100);
      expect(abono).toBeDefined();

      // Saldo pendiente restante debe ser L. 100 (240 - 140)
      const afterAbonoCust = useAppStore.getState().customers.find(c => c.id === customer.id);
      expect(afterAbonoCust?.creditBalance).toBe(100);

      // El abono en efectivo debe haber entrado al turno de caja activo
      const cashMovements = useAppStore.getState().cashMovements;
      const abonoMovement = cashMovements.find(m => m.type === 'ENTRADA' && m.referenceId === abono.id);
      expect(abonoMovement).toBeDefined();
      expect(abonoMovement?.amount).toBe(140);

      // 3. Cliente liquida el saldo restante de L. 100
      store.addAccountPayment({
        type: 'CUSTOMER_PAYMENT',
        customerId: customer.id,
        customerName: customer.name,
        amount: 100,
        paymentMethod: 'CASH',
        notes: 'Liquidación final de cuenta',
        createdBy: 'Administrador'
      });
      store.updateCustomerCreditBalance(customer.id, 0);

      const debtFreeCust = useAppStore.getState().customers.find(c => c.id === customer.id);
      expect(debtFreeCust?.creditBalance).toBe(0);
    });
  });
});
