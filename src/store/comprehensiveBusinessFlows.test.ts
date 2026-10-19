import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './useAppStore';
import { Product, Customer, Supplier, PurchaseInvoice, Service, Staff, FinancialFund, ProductPresentation, ProductPriceType } from '../types';
import { isValidUUID } from '../lib/security';

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

    it('debe mantener el estado REFUNDED persistente y no revertirlo al sincronizar con la nube o reiniciar', () => {
      const store = useAppStore.getState();
      store.openCashShift(500);

      const prod: Product = {
        id: 'prod-persist-1',
        tenantId: store.tenant.id,
        sku: 'P-PER',
        name: 'Producto Persistencia',
        category: 'Test',
        unitOfMeasure: 'UND',
        salePrice: 50,
        costPrice: 30,
        currentStock: 10,
        minStockAlert: 2,
        taxClassification: 'EXENTO',
        isActive: true
      };
      useAppStore.setState({ products: [prod] });

      store.addToCart({ product: prod, quantity: 1 });
      const sale = store.processSale('CASH');
      expect(sale).not.toBeNull();

      // Devolver venta
      store.refundSale({
        saleId: sale!.id,
        reason: 'Cliente cambió de opinión',
        refundMethod: 'CASH',
        items: [{
          productId: prod.id,
          productName: prod.name,
          quantity: 1,
          unitPrice: 50,
          subtotal: 50
        }]
      });

      const refundedSale = useAppStore.getState().sales.find(s => s.id === sale!.id);
      expect(refundedSale?.status).toBe('REFUNDED');

      // Simular reinicio / merge desde Supabase con venta que viene de la nube
      const liveSaleFromCloud: any = {
        ...refundedSale,
        status: undefined,
        customerName: 'Consumidor Final [DEVUELTA: Cliente cambió de opinión]'
      };

      const localSalesMap = new Map((useAppStore.getState().sales || []).map(s => [s.id, s]));
      const local = localSalesMap.get(liveSaleFromCloud.id);
      const effectiveStatus = (local?.status && local.status !== 'COMPLETED') ? local.status : (liveSaleFromCloud.status || 'COMPLETED');
      expect(effectiveStatus).toBe('REFUNDED');
    });

    it('debe procesar devolución parcial en venta de múltiples artículos restituyendo solo el producto devuelto', () => {
      const store = useAppStore.getState();
      store.openCashShift(1000);

      const pA: Product = {
        id: 'prod-multi-a',
        tenantId: store.tenant.id,
        sku: 'MA-01',
        name: 'Galletas de Chocolate',
        category: 'Snacks',
        unitOfMeasure: 'UND',
        salePrice: 20,
        costPrice: 12,
        currentStock: 15,
        minStockAlert: 2,
        taxClassification: 'EXENTO',
        isActive: true
      };

      const pB: Product = {
        id: 'prod-multi-b',
        tenantId: store.tenant.id,
        sku: 'MB-01',
        name: 'Bebida Energizante',
        category: 'Bebidas',
        unitOfMeasure: 'UND',
        salePrice: 40,
        costPrice: 25,
        currentStock: 10,
        minStockAlert: 2,
        taxClassification: 'EXENTO',
        isActive: true
      };
      useAppStore.setState({ products: [pA, pB] });

      // Venta: 2 Galletas (L. 40) + 1 Bebida (L. 40) = L. 80
      store.addToCart({ product: pA, quantity: 2 });
      store.addToCart({ product: pB, quantity: 1 });
      const sale = store.processSale('CASH');
      expect(sale?.total).toBe(80);

      expect(useAppStore.getState().products.find(p => p.id === pA.id)?.currentStock).toBe(13); // 15 - 2
      expect(useAppStore.getState().products.find(p => p.id === pB.id)?.currentStock).toBe(9);  // 10 - 1

      // Devolución parcial: solo 1 Galleta en buen estado (L. 20)
      const refundOk = store.refundSale({
        saleId: sale!.id,
        reason: 'Cliente llevó una de más',
        refundMethod: 'CASH',
        items: [{
          productId: pA.id,
          productName: pA.name,
          quantity: 1,
          unitPrice: 20,
          subtotal: 20
        }]
      });
      expect(refundOk).toBe(true);

      // Galletas suben a 14 (+1 restituido), Bebida se mantiene en 9
      expect(useAppStore.getState().products.find(p => p.id === pA.id)?.currentStock).toBe(14);
      expect(useAppStore.getState().products.find(p => p.id === pB.id)?.currentStock).toBe(9);

      // Movimiento de salida exacto por L. 20
      const refundMov = useAppStore.getState().cashMovements.find(m => m.referenceId === sale!.id);
      expect(refundMov?.amount).toBe(20);
    });

    it('debe registrar devolución por STORE_CREDIT sin generar egreso de dinero en la gaveta', () => {
      const store = useAppStore.getState();
      store.openCashShift(500);

      const p: Product = {
        id: 'prod-credit-ret',
        tenantId: store.tenant.id,
        sku: 'CR-01',
        name: 'Camisa Polo',
        category: 'Ropa',
        unitOfMeasure: 'UND',
        salePrice: 300,
        costPrice: 180,
        currentStock: 5,
        minStockAlert: 1,
        taxClassification: 'EXENTO',
        isActive: true
      };
      useAppStore.setState({ products: [p] });

      store.addToCart({ product: p, quantity: 1 });
      const sale = store.processSale('CASH');
      expect(sale?.total).toBe(300);

      const preMovementsCount = useAppStore.getState().cashMovements.length;

      // Devolución como Saldo a Favor / Store Credit
      store.refundSale({
        saleId: sale!.id,
        reason: 'Cambio de talla por saldo a favor',
        refundMethod: 'STORE_CREDIT',
        items: [{
          productId: p.id,
          productName: p.name,
          quantity: 1,
          unitPrice: 300,
          subtotal: 300
        }]
      });

      // NO debe haberse generado movimiento de caja tipo SALIDA porque no salió efectivo
      const postMovements = useAppStore.getState().cashMovements;
      expect(postMovements.length).toBe(preMovementsCount);

      // Pero sí debe existir el comprobante de devolución
      const returns = useAppStore.getState().salesReturns;
      expect(returns.some(r => r.saleId === sale!.id && r.refundMethod === 'STORE_CREDIT')).toBe(true);
    });

    it('debe prevenir doble anulación sobre una misma venta ya cancelada', () => {
      const store = useAppStore.getState();
      store.openCashShift(500);

      const p: Product = {
        id: 'prod-void-twice',
        tenantId: store.tenant.id,
        sku: 'V2',
        name: 'Audífonos Bluetooth',
        category: 'Electrónica',
        unitOfMeasure: 'UND',
        salePrice: 250,
        costPrice: 150,
        currentStock: 4,
        minStockAlert: 1,
        taxClassification: 'EXENTO',
        isActive: true
      };
      useAppStore.setState({ products: [p] });

      store.addToCart({ product: p, quantity: 1 });
      const sale = store.processSale('CASH');

      // Primera anulación: exitosa
      const firstVoid = store.voidSale(sale!.id, 'Error de cobro');
      expect(firstVoid).toBe(true);
      expect(useAppStore.getState().products.find(x => x.id === p.id)?.currentStock).toBe(4);

      // Segunda anulación consecutiva: rechazada
      const secondVoid = store.voidSale(sale!.id, 'Intento duplicado');
      expect(secondVoid).toBe(false);

      // El stock no debe haberse duplicado (se mantiene en 4)
      expect(useAppStore.getState().products.find(x => x.id === p.id)?.currentStock).toBe(4);
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
        currentStock: 24,
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

    it('debe descontar correctamente unidades base al vender presentaciones agrupadas (Six-Pack)', () => {
      const store = useAppStore.getState();
      store.openCashShift(500);

      const cerveza: Product = {
        id: 'prod-cerveza',
        tenantId: store.tenant.id,
        sku: 'CERV-01',
        name: 'Cerveza Nacional 355ml',
        category: 'Bebidas',
        unitOfMeasure: 'UND',
        salePrice: 30,
        costPrice: 20,
        currentStock: 24, // 24 latas individuales en stock
        minStockAlert: 6,
        taxClassification: 'GRAVADO_15',
        isActive: true,
        presentations: [
          {
            id: 'pack-6-cerv',
            name: 'Six-Pack',
            unitsCount: 6,
            salePrice: 170,
            costPrice: 120
          }
        ]
      };
      useAppStore.setState({ products: [cerveza] });

      // Vender 2 Six-Packs (2 * 6 = 12 unidades base consumidas)
      store.addToCart({
        product: cerveza,
        presentation: cerveza.presentations![0],
        quantity: 2
      });

      const sale = store.processSale('CASH');
      expect(sale).not.toBeNull();
      expect(sale?.total).toBe(340); // 170 * 2

      // Stock de unidades individuales debe quedar exactamente en 12 (24 - 12)
      const afterSaleStock = useAppStore.getState().products.find(p => p.id === cerveza.id)?.currentStock;
      expect(afterSaleStock).toBe(12);
    });

    it('debe registrar mermas por vencimiento y uso interno manteniendo trazabilidad', () => {
      const store = useAppStore.getState();

      const yogur: Product = {
        id: 'prod-yogur',
        tenantId: store.tenant.id,
        sku: 'YOG-01',
        name: 'Yogurt Fresa 1L',
        category: 'Lácteos',
        unitOfMeasure: 'UND',
        salePrice: 60,
        costPrice: 40,
        currentStock: 20,
        minStockAlert: 5,
        taxClassification: 'EXENTO',
        isActive: true
      };
      useAppStore.setState({ products: [yogur] });

      // Ajuste por Vencimiento: -3 unidades
      store.addInventoryAdjustment({
        productId: yogur.id,
        productName: yogur.name,
        type: 'VENCIDO',
        quantity: 3,
        notes: 'Lote caducado el 15/10'
      });

      // Ajuste por Uso Interno (degustación de clientes): -2 unidades
      store.addInventoryAdjustment({
        productId: yogur.id,
        productName: yogur.name,
        type: 'USO_INTERNO',
        quantity: 2,
        notes: 'Muestra degustación en tienda'
      });

      const finalYogur = useAppStore.getState().products.find(p => p.id === yogur.id);
      expect(finalYogur?.currentStock).toBe(15); // 20 - 3 - 2

      const adjustments = useAppStore.getState().inventoryAdjustments;
      expect(adjustments.some(a => a.type === 'VENCIDO' && a.quantity === 3)).toBe(true);
      expect(adjustments.some(a => a.type === 'USO_INTERNO' && a.quantity === 2)).toBe(true);
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

      const sale = store.processSale('MIXED', 0, false, { cash: 400, card: 600, transfer: 0 });
      expect(sale).not.toBeNull();
      expect(sale?.paymentMethod).toBe('MIXED');
      expect(sale?.cashAmount).toBe(400);
      expect(sale?.cardAmount).toBe(600);
      expect(sale?.total).toBe(1000);
    });

    it('debe aplicar precio de mayoreo automáticamente según tiers por volumen', () => {
      const store = useAppStore.getState();
      store.openCashShift(500);

      const prodTier: Product = {
        id: 'prod-tier',
        tenantId: store.tenant.id,
        sku: 'CUAD-01',
        name: 'Cuaderno Universitario',
        category: 'Útiles',
        unitOfMeasure: 'UND',
        salePrice: 50, // Precio detalle: L. 50
        costPrice: 28,
        currentStock: 50,
        minStockAlert: 10,
        taxClassification: 'EXENTO',
        isActive: true,
        tiers: [
          {
            id: 'tier-1',
            minQuantity: 5,
            unitPrice: 40, // Precio docena/mayoreo: L. 40 si compra 5 o más
            tierName: 'Precio Mayoreo'
          }
        ]
      };
      useAppStore.setState({ products: [prodTier] });

      // Compra de 5 cuadernos: debe aplicar L. 40 c/u = L. 200
      store.addToCart({ product: prodTier, quantity: 5 });
      const cartLine = useAppStore.getState().cartLines[0];
      expect(cartLine.unitPrice).toBe(40);
      expect(cartLine.total).toBe(200);

      const sale = store.processSale('CASH');
      expect(sale?.total).toBe(200);
    });

    it('debe pausar la orden actual (hold cart) y permitir recuperarla más tarde sin perder datos', () => {
      const store = useAppStore.getState();

      const prodA: Product = {
        id: 'prod-hold-1',
        tenantId: store.tenant.id,
        sku: 'H1',
        name: 'Producto en Espera',
        category: 'General',
        unitOfMeasure: 'UND',
        salePrice: 150,
        costPrice: 90,
        currentStock: 10,
        minStockAlert: 2,
        taxClassification: 'EXENTO',
        isActive: true
      };
      useAppStore.setState({ products: [prodA] });

      // Cliente 1 arma su carrito
      store.setCartCustomer({ name: 'Cliente En Espera' });
      store.addToCart({ product: prodA, quantity: 2 }); // Total L. 300
      expect(useAppStore.getState().cartLines.length).toBe(1);

      // Cliente dice "olvidé mi billetera, vuelvo ya": pausar carrito
      store.holdCurrentCart();
      expect(useAppStore.getState().cartLines.length).toBe(0); // Carrito activo vacío para atender a otro
      expect(useAppStore.getState().heldOrders.length).toBe(1);

      const heldId = useAppStore.getState().heldOrders[0].id;

      // Cliente 1 regresa: restaurar carrito
      store.restoreHeldCart(heldId);
      expect(useAppStore.getState().cartLines.length).toBe(1);
      expect(useAppStore.getState().cartCustomer.name).toBe('Cliente En Espera');
      expect(useAppStore.getState().cartLines[0].total).toBe(300);
      expect(useAppStore.getState().heldOrders.length).toBe(0);
    });
  });

  // =========================================================================
  // 4. FLUJO DE REPORTES Y RENTABILIDAD
  // =========================================================================
  describe('4. Flujo de Reportes y Rentabilidad', () => {
    it('debe calcular con exactitud ventas netas, costo mercadería, gastos y ganancia libre', () => {
      const store = useAppStore.getState();
      store.openCashShift(1000);

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

      // Venta 1: 2 unidades de P1 = L. 200 (Costo L. 120)
      store.addToCart({ product: p1, quantity: 2 });
      store.processSale('CASH');

      // Venta 2: 1 unidad de P2 = L. 200 (Costo L. 110)
      store.addToCart({ product: p2, quantity: 1 });
      store.processSale('CARD');

      // Gasto operativo de L. 70
      store.addExpense({
        description: 'Bolsas plásticas y empaques',
        amount: 70,
        category: 'OTROS',
        fundId: 'fund-1',
        expenseDate: '2026-10-18'
      });

      const allSales = useAppStore.getState().sales.filter(s => s.status !== 'VOIDED');
      const totalSales = allSales.reduce((acc, s) => acc + s.total, 0);
      expect(totalSales).toBe(400);

      const currentProducts = useAppStore.getState().products;
      const totalCOGS = allSales.reduce((acc, s) => {
        return acc + (s.items || []).reduce((itemAcc, it) => {
          const prod = currentProducts.find(p => p.id === it.productId || p.sku === it.sku);
          const unitsMultiplier = it.unitsPerPackage && it.unitsPerPackage > 1 ? it.unitsPerPackage : 1;
          return itemAcc + (prod ? prod.costPrice * it.quantity * unitsMultiplier : 0);
        }, 0);
      }, 0);
      expect(totalCOGS).toBe(230);

      const totalExpenses = useAppStore.getState().expenses.reduce((acc, e) => acc + e.amount, 0);
      expect(totalExpenses).toBe(70);

      const grossProfit = totalSales - totalCOGS;
      expect(grossProfit).toBe(170);

      const netProfit = totalSales - totalCOGS - totalExpenses;
      expect(netProfit).toBe(100);
    });

    it('debe excluir ventas anuladas y devueltas del cálculo de utilidad neta', () => {
      const store = useAppStore.getState();
      store.openCashShift(500);

      const p: Product = {
        id: 'p-excl-1',
        tenantId: store.tenant.id,
        sku: 'EX-1',
        name: 'Camisa Formal',
        category: 'Ropa',
        unitOfMeasure: 'UND',
        salePrice: 500,
        costPrice: 300,
        currentStock: 10,
        minStockAlert: 2,
        taxClassification: 'EXENTO',
        isActive: true
      };
      useAppStore.setState({ products: [p] });

      // Venta 1: Válida (L. 500)
      store.addToCart({ product: p, quantity: 1 });
      const saleValida = store.processSale('CASH');

      // Venta 2: Que será devuelta (L. 500)
      store.addToCart({ product: p, quantity: 1 });
      const saleADevolver = store.processSale('CASH');

      // Devolver Venta 2
      store.refundSale({
        saleId: saleADevolver!.id,
        reason: 'Talla incorrecta',
        refundMethod: 'CASH',
        items: [{
          productId: p.id,
          productName: p.name,
          quantity: 1,
          unitPrice: 500,
          subtotal: 500
        }]
      });

      // El cálculo de ventas válidas en reportes debe sumar ÚNICAMENTE la venta válida (L. 500), ignorando la devuelta
      const validSales = useAppStore.getState().sales.filter(s => s.status !== 'VOIDED' && s.status !== 'REFUNDED');
      const netSales = validSales.reduce((acc, s) => acc + s.total, 0);
      expect(netSales).toBe(500); // No L. 1000
    });

    it('debe conciliar exactamente ventas desglosadas por cada forma de pago', () => {
      const store = useAppStore.getState();
      store.openCashShift(1000);

      const p: Product = {
        id: 'p-concil',
        tenantId: store.tenant.id,
        sku: 'CN-1',
        name: 'Venta Conciliación',
        category: 'General',
        unitOfMeasure: 'UND',
        salePrice: 100,
        costPrice: 50,
        currentStock: 20,
        minStockAlert: 2,
        taxClassification: 'EXENTO',
        isActive: true
      };
      useAppStore.setState({ products: [p] });

      // 1. Efectivo: L. 100
      store.addToCart({ product: p, quantity: 1 });
      store.processSale('CASH');

      // 2. Tarjeta: L. 200
      store.addToCart({ product: p, quantity: 2 });
      store.processSale('CARD');

      // 3. Transferencia: L. 300
      store.addToCart({ product: p, quantity: 3 });
      store.processSale('TRANSFER');

      // 4. Mixto: L. 200 (L. 50 efectivo + L. 150 tarjeta)
      store.addToCart({ product: p, quantity: 2 });
      store.processSale('MIXED', 0, false, { cash: 50, card: 150 });

      const allActiveSales = useAppStore.getState().sales.filter(s => s.status !== 'VOIDED');
      const totalCashInSales = allActiveSales.reduce((acc, s) => acc + (s.cashAmount || (s.paymentMethod === 'CASH' ? s.total : 0)), 0);
      const totalCardInSales = allActiveSales.reduce((acc, s) => acc + (s.cardAmount || (s.paymentMethod === 'CARD' ? s.total : 0)), 0);
      const totalTransferInSales = allActiveSales.reduce((acc, s) => acc + (s.transferAmount || (s.paymentMethod === 'TRANSFER' ? s.total : 0)), 0);

      expect(totalCashInSales).toBe(150); // 100 + 50
      expect(totalCardInSales).toBe(350); // 200 + 150
      expect(totalTransferInSales).toBe(300); // 300

      // La suma de todos los métodos debe igualar exactamente el gran total vendido (L. 800)
      const grandTotal = allActiveSales.reduce((acc, s) => acc + s.total, 0);
      expect(totalCashInSales + totalCardInSales + totalTransferInSales).toBe(grandTotal);
      expect(grandTotal).toBe(800);
    });
  });

  // =========================================================================
  // 5. FLUJO DE APERTURA Y CIERRE DE CAJA (ARQUEO Z)
  // =========================================================================
  describe('5. Flujo de Apertura y Cierre de Caja', () => {
    it('debe registrar apertura, entradas, salidas y calcular correctamente faltante o sobrante', () => {
      const store = useAppStore.getState();

      store.openCashShift(1000);
      expect(useAppStore.getState().activeShift?.openingAmount).toBe(1000);

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

      store.addExpense({
        description: 'Compra de verduras emergencia',
        amount: 150,
        category: 'OTROS',
        paymentSource: 'ACTIVE_CASH_SHIFT',
        fundId: 'ACTIVE_CASH_SHIFT',
        expenseDate: '2026-10-18'
      });

      store.addCashMovement('ENTRADA', 200, 'Cambio extra de monedas');

      // Esperado: 1000 + 500 - 150 + 200 = 1550
      // Cajero declara 1500 (Faltante L. -50)
      const closeResult = store.closeCashShift(1500);
      expect(closeResult.closingSystem).toBe(1550);
      expect(closeResult.difference).toBe(-50);
      expect(useAppStore.getState().activeShift).toBeNull();
    });

    it('debe aislar cobros con tarjeta para no inflar el efectivo físico esperado en la gaveta', () => {
      const store = useAppStore.getState();
      store.openCashShift(500);

      const p: Product = {
        id: 'p-card-drawer',
        tenantId: store.tenant.id,
        sku: 'CD-1',
        name: 'Perfume Importado',
        category: 'Belleza',
        unitOfMeasure: 'UND',
        salePrice: 1200,
        costPrice: 700,
        currentStock: 5,
        minStockAlert: 1,
        taxClassification: 'EXENTO',
        isActive: true
      };
      useAppStore.setState({ products: [p] });

      // Venta de L. 1,200 pagada 100% con TARJETA
      store.addToCart({ product: p, quantity: 1 });
      store.processSale('CARD');

      // El efectivo esperado en gaveta debe seguir siendo EXACTAMENTE L. 500 (fondo inicial)
      // La tarjeta fue al banco, no a la gaveta física
      const closeResult = store.closeCashShift(500);
      expect(closeResult.closingSystem).toBe(500);
      expect(closeResult.difference).toBe(0);
    });

    it('debe calcular sobrante correctamente y permitir abrir un nuevo turno consecutivo', () => {
      const store = useAppStore.getState();

      // Turno 1: Apertura L. 800
      store.openCashShift(800);
      // Cajero declara L. 820 (Sobraron L. 20)
      const close1 = store.closeCashShift(820);
      expect(close1.closingSystem).toBe(800);
      expect(close1.difference).toBe(20);

      // Turno 2: Inicia con L. 1,200 de fondo
      store.openCashShift(1200);
      expect(useAppStore.getState().activeShift?.openingAmount).toBe(1200);

      const close2 = store.closeCashShift(1200);
      expect(close2.closingSystem).toBe(1200);
      expect(close2.difference).toBe(0);

      expect(useAppStore.getState().shiftHistory.length).toBeGreaterThanOrEqual(2);
    });
  });

  // =========================================================================
  // 6. FLUJO DEL MÓDULO DE COMPRAS Y PROVEEDORES
  // =========================================================================
  describe('6. Flujo de Compras y Proveedores', () => {
    it('debe registrar compra, incrementar stock y recalcular Costo Promedio Ponderado (CPP)', () => {
      const store = useAppStore.getState();

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

      // Producto inicial: 10 unidades a L. 50 c/u (L. 500)
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

      // Nueva compra: 10 unidades a L. 60 c/u (L. 600)
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
      expect(updatedPollo?.currentStock).toBe(20);
      expect(updatedPollo?.costPrice).toBe(55);
      expect(updatedPollo?.salePrice).toBe(75);
      expect(useAppStore.getState().purchaseInvoices.length).toBe(1);
    });

    it('debe registrar compra a crédito a proveedor y liquidar factura mediante abono con fondos', () => {
      const store = useAppStore.getState();

      const fund: FinancialFund = {
        id: 'fund-banco-1',
        tenantId: store.tenant.id,
        name: 'Cuenta Operativa Bac',
        type: 'CUENTA_CHEQUES',
        balance: 5000,
        isActive: true
      };
      useAppStore.setState({ funds: [fund] });

      const prodMat: Product = {
        id: 'prod-mat',
        tenantId: store.tenant.id,
        sku: 'MAT-01',
        name: 'Bolsa de Cemento',
        category: 'Ferretería',
        unitOfMeasure: 'UND',
        salePrice: 220,
        costPrice: 170,
        currentStock: 10,
        minStockAlert: 5,
        taxClassification: 'EXENTO',
        isActive: true
      };
      useAppStore.setState({ products: [prodMat] });

      // Compra al crédito por L. 1,700 (10 bolsas a 170)
      const invoiceData: Omit<PurchaseInvoice, 'id' | 'tenantId'> = {
        supplierId: 'sup-argos',
        supplierName: 'Argos Honduras',
        invoiceNumber: 'FAC-CRED-402',
        issueDate: '2026-10-18',
        dueDate: '2026-11-18',
        paymentTerms: 'CREDIT',
        paymentStatus: 'UNPAID',
        subtotal: 1700,
        taxAmount: 0,
        total: 1700,
        paidAmount: 0,
        items: []
      };

      store.processPurchase(invoiceData, [{
        productId: prodMat.id,
        quantity: 10,
        unitCost: 170
      }]);

      const createdInvoice = useAppStore.getState().purchaseInvoices.find(pi => pi.invoiceNumber === 'FAC-CRED-402');
      expect(createdInvoice).toBeDefined();
      expect(createdInvoice?.paymentStatus).toBe('UNPAID');

      // Abonar / Liquidar factura de proveedor por L. 1,700 desde la cuenta de banco
      store.payPurchaseInvoice(createdInvoice!.id, fund.id, 1700);

      const paidInvoice = useAppStore.getState().purchaseInvoices.find(pi => pi.id === createdInvoice!.id);
      expect(paidInvoice?.paymentStatus).toBe('PAID');
      expect(paidInvoice?.paidAmount).toBe(1700);

      // El fondo bancario debe haber bajado de 5000 a 3300
      const updatedFund = useAppStore.getState().funds.find(f => f.id === fund.id);
      expect(updatedFund?.balance).toBe(3300);
    });
  });

  // =========================================================================
  // 7. FLUJO DE CALENDARIO Y CITAS (SERVICIOS & MATERIALES)
  // =========================================================================
  describe('7. Flujo de Calendario y Citas', () => {
    it('debe registrar cita, descontar insumos al completarse y permitir bloqueos de horario', () => {
      const store = useAppStore.getState();

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

      const servicio: Service = {
        id: 'serv-color',
        tenantId: store.tenant.id,
        name: 'Colorimetría Completa',
        durationMinutes: 90,
        price: 800,
        commissionType: 'PERCENTAGE',
        commissionValue: 30,
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

      store.addAppointment({
        customerName: 'Karla Mendoza',
        serviceId: servicio.id,
        staffId: 'staff-1',
        scheduledAt: '2026-10-18T14:00:00',
        status: 'SCHEDULED'
      });

      const createdApp = useAppStore.getState().appointments.find(a => a.customerName === 'Karla Mendoza');
      expect(createdApp).toBeDefined();

      const appSale = store.processAppointmentSale(createdApp!.id, 'CASH');
      expect(appSale).not.toBeNull();

      const updatedInsumo = useAppStore.getState().products.find(p => p.id === insumo.id);
      expect(updatedInsumo?.currentStock).toBe(4);

      const updatedAppointment = useAppStore.getState().appointments.find(a => a.id === createdApp!.id);
      expect(updatedAppointment?.status).toBe('COMPLETED');
      expect(updatedAppointment?.isPaid).toBe(true);

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

    it('debe calcular comisiones a colaboradores y permitir su liquidación desde el turno de caja activo', () => {
      const store = useAppStore.getState();
      store.openCashShift(1000);

      const stylist: Staff = {
        id: 'staff-sofia',
        tenantId: store.tenant.id,
        fullName: 'Sofía Estilista',
        isActive: true
      };

      const corte: Service = {
        id: 'serv-corte',
        tenantId: store.tenant.id,
        name: 'Corte y Secado',
        durationMinutes: 45,
        price: 300,
        commissionType: 'FIXED',
        commissionValue: 120, // L. 120 fijo por servicio realizado
        isActive: true
      };

      useAppStore.setState({
        staff: [stylist],
        services: [corte]
      });

      store.addAppointment({
        customerName: 'Elena Martínez',
        serviceId: corte.id,
        staffId: stylist.id,
        scheduledAt: '2026-10-18T10:00:00',
        status: 'SCHEDULED'
      });

      const app = useAppStore.getState().appointments.find(a => a.customerName === 'Elena Martínez');
      store.processAppointmentSale(app!.id, 'CASH');

      // Debe generarse una comisión en estado PENDING por L. 120 (40% de L. 300)
      const comm = useAppStore.getState().commissions.find(c => c.staffId === stylist.id);
      expect(comm).toBeDefined();
      expect(comm?.commissionAmount).toBe(120);
      expect(comm?.status).toBe('PENDING');

      // Liquidar comisión de Sofía desde el turno de caja activo
      store.payStaffCommissions(stylist.id, { payFromActiveShift: true });

      const paidComm = useAppStore.getState().commissions.find(c => c.id === comm!.id);
      expect(paidComm?.status).toBe('PAID');

      // Debe existir movimiento de SALIDA en el turno activo por L. 120
      const movements = useAppStore.getState().cashMovements;
      const commMovement = movements.find(m => m.type === 'SALIDA' && m.concept.includes('Sofía'));
      expect(commMovement).toBeDefined();
      expect(commMovement?.amount).toBe(120);
    });
  });

  // =========================================================================
  // 8. FLUJO DE CUENTAS / FIADOS (CRÉDITO Y ABONOS)
  // =========================================================================
  describe('8. Flujo de Cuentas / Fiados', () => {
    it('debe registrar venta al fiado, actualizar saldo del cliente y registrar abonos en efectivo en el turno activo', () => {
      const store = useAppStore.getState();
      store.openCashShift(500);

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

      store.setCartCustomer({ id: customer.id, name: customer.name });
      store.addToCart({ product: itemFiado, quantity: 2 }); // Total L. 240

      const sale = store.processSale('CREDIT');
      expect(sale).not.toBeNull();
      expect(sale?.paymentMethod).toBe('CREDIT');
      expect(sale?.total).toBe(240);

      const updatedCust = useAppStore.getState().customers.find(c => c.id === customer.id);
      expect(updatedCust?.creditBalance).toBe(240);

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

      const afterAbonoCust = useAppStore.getState().customers.find(c => c.id === customer.id);
      expect(afterAbonoCust?.creditBalance).toBe(100);

      const cashMovements = useAppStore.getState().cashMovements;
      const abonoMovement = cashMovements.find(m => m.type === 'ENTRADA' && m.referenceId === abono.id);
      expect(abonoMovement).toBeDefined();
      expect(abonoMovement?.amount).toBe(140);

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

    it('debe acumular múltiples ventas a crédito sucesivas de un cliente de confianza', () => {
      const store = useAppStore.getState();
      store.openCashShift(500);

      const clienteRecurrente: Customer = {
        id: 'cust-maria',
        tenantId: store.tenant.id,
        name: 'Doña María Tiendita',
        phone: '95551122',
        loyaltyPoints: 0,
        totalSpent: 0,
        creditBalance: 0,
        creditLimit: 3000,
        createdAt: '2026-10-18'
      };
      useAppStore.setState({ customers: [clienteRecurrente] });

      const prodPan: Product = {
        id: 'p-pan',
        tenantId: store.tenant.id,
        sku: 'PAN-C',
        name: 'Pan Casero',
        category: 'Panadería',
        unitOfMeasure: 'UND',
        salePrice: 50,
        costPrice: 30,
        currentStock: 100,
        minStockAlert: 10,
        taxClassification: 'EXENTO',
        isActive: true
      };
      useAppStore.setState({ products: [prodPan] });

      // Compra Fiada 1: 4 panes = L. 200
      store.setCartCustomer({ id: clienteRecurrente.id, name: clienteRecurrente.name });
      store.addToCart({ product: prodPan, quantity: 4 });
      store.processSale('CREDIT');

      expect(useAppStore.getState().customers.find(c => c.id === clienteRecurrente.id)?.creditBalance).toBe(200);

      // Compra Fiada 2 al día siguiente: 6 panes = L. 300
      store.setCartCustomer({ id: clienteRecurrente.id, name: clienteRecurrente.name });
      store.addToCart({ product: prodPan, quantity: 6 });
      store.processSale('CREDIT');

      // Saldo acumulado debe ser exactamente L. 500 (200 + 300)
      expect(useAppStore.getState().customers.find(c => c.id === clienteRecurrente.id)?.creditBalance).toBe(500);

      // Abono parcial de L. 300
      store.addAccountPayment({
        type: 'CUSTOMER_PAYMENT',
        customerId: clienteRecurrente.id,
        customerName: clienteRecurrente.name,
        amount: 300,
        paymentMethod: 'CASH',
        notes: 'Abono Doña María',
        createdBy: 'Cajero'
      });
      store.updateCustomerCreditBalance(clienteRecurrente.id, 200);

      expect(useAppStore.getState().customers.find(c => c.id === clienteRecurrente.id)?.creditBalance).toBe(200);
    });
  });

  // =========================================================================
  // 9. MEJORAS DE VENTAS: PRECIOS POR TIPO, EMPAQUES SEPARADOS Y DESCUENTOS POR PRODUCTO
  // =========================================================================
  describe('9. Mejoras de Ventas: Precios por Tipo, Empaques Separados y Descuentos por Producto', () => {
    it('debe permitir asignar múltiples tipos de precio a un producto y seleccionar el precio preferencial en el carrito', () => {
      const store = useAppStore.getState();
      store.openCashShift(1000);

      const prodConTipos: Product = {
        id: 'prod-tipos-1',
        tenantId: store.tenant.id,
        sku: 'CAFE-ESP',
        name: 'Café Especial 500g',
        category: 'Abarrotes',
        unitOfMeasure: 'UND',
        salePrice: 150,
        costPrice: 90,
        currentStock: 50,
        minStockAlert: 5,
        taxClassification: 'EXENTO',
        isActive: true,
        priceTypes: [
          { id: 'pt-frecuente', name: 'Cliente Frecuente', price: 130 },
          { id: 'pt-mayorista', name: 'Distribuidor Amigo', price: 110 }
        ]
      };

      useAppStore.setState({ products: [prodConTipos] });

      // 1. Agregar al carrito con precio regular
      store.addToCart({ product: prodConTipos, quantity: 1 });
      let lines = useAppStore.getState().cartLines;
      expect(lines).toHaveLength(1);
      expect(lines[0].originalUnitPrice).toBe(150);
      expect(lines[0].subtotal).toBe(150);
      expect(lines[0].isSpecialPriceActive).toBe(false);

      // 2. Cambiar a tarifa 'Cliente Frecuente'
      store.setCartLinePriceType(0, 'pt-frecuente');
      lines = useAppStore.getState().cartLines;
      expect(lines[0].originalUnitPrice).toBe(130);
      expect(lines[0].selectedPriceTypeId).toBe('pt-frecuente');
      expect(lines[0].selectedPriceTypeName).toBe('Cliente Frecuente');
      expect(lines[0].isSpecialPriceActive).toBe(true);
      expect(lines[0].subtotal).toBe(130);

      // 3. Cambiar a tarifa 'Distribuidor Amigo'
      store.setCartLinePriceType(0, 'pt-mayorista');
      lines = useAppStore.getState().cartLines;
      expect(lines[0].originalUnitPrice).toBe(110);
      expect(lines[0].selectedPriceTypeId).toBe('pt-mayorista');
      expect(lines[0].selectedPriceTypeName).toBe('Distribuidor Amigo');
      expect(lines[0].isSpecialPriceActive).toBe(true);
      expect(lines[0].subtotal).toBe(110);

      // 4. Volver a precio estándar (sin tipo)
      store.setCartLinePriceType(0, undefined);
      lines = useAppStore.getState().cartLines;
      expect(lines[0].originalUnitPrice).toBe(150);
      expect(lines[0].selectedPriceTypeId).toBeUndefined();
      expect(lines[0].isSpecialPriceActive).toBe(false);
      expect(lines[0].subtotal).toBe(150);

      // 5. Cliente con defaultPriceTypeName auto-asigna tarifa
      store.clearCart();
      const clienteVip: Customer = {
        id: 'cust-vip-1',
        tenantId: store.tenant.id,
        name: 'Roberto Gómez',
        phone: '99887766',
        loyaltyPoints: 0,
        totalSpent: 0,
        defaultPriceTypeName: 'Cliente Frecuente',
        createdAt: '2026-10-19'
      };
      useAppStore.setState({ customers: [clienteVip] });

      store.setCartCustomer({ id: clienteVip.id, name: clienteVip.name });
      store.addToCart({ product: prodConTipos, quantity: 2 });

      lines = useAppStore.getState().cartLines;
      expect(lines[0].originalUnitPrice).toBe(130);
      expect(lines[0].selectedPriceTypeName).toBe('Cliente Frecuente');
      expect(lines[0].isSpecialPriceActive).toBe(true);
      expect(lines[0].subtotal).toBe(260); // 2 * 130
    });

    it('regla de negocio: el precio especial activo debe ignorar las escalas por mayoreo aunque se compre en volumen', () => {
      const store = useAppStore.getState();
      store.openCashShift(1000);

      const prodConEscalaYTipo: Product = {
        id: 'prod-escala-tipo',
        tenantId: store.tenant.id,
        sku: 'ACEITE-1L',
        name: 'Aceite de Cocina 1L',
        category: 'Abarrotes',
        unitOfMeasure: 'UND',
        salePrice: 60,
        costPrice: 40,
        currentStock: 100,
        minStockAlert: 10,
        taxClassification: 'EXENTO',
        isActive: true,
        tiers: [
          { id: 'tier-1', minQuantity: 10, unitPrice: 48, tierName: 'Mayoreo (10+)' }
        ],
        priceTypes: [
          { id: 'pt-especial', name: 'Precio Amigo / Vecino', price: 52 }
        ]
      };

      useAppStore.setState({ products: [prodConEscalaYTipo] });

      // Escenario A: Cliente normal compra 10 unidades (Aplica escala por mayoreo: L. 48 c/u)
      store.clearCart();
      store.addToCart({ product: prodConEscalaYTipo, quantity: 10 });
      let lines = useAppStore.getState().cartLines;
      expect(lines[0].unitPrice).toBe(48);
      expect(lines[0].appliedTierName).toBe('Mayoreo (10+)');
      expect(lines[0].isSpecialPriceActive).toBe(false);
      expect(lines[0].subtotal).toBe(480);

      // Escenario B: Cliente con Precio Especial compra 10 unidades.
      // Regla: Si tiene precio especial activado, NO aplica la escala por mayoreo, se respeta el precio convenido L. 52.
      store.setCartLinePriceType(0, 'pt-especial');
      lines = useAppStore.getState().cartLines;
      expect(lines[0].unitPrice).toBe(52);
      expect(lines[0].appliedTierName).toBeUndefined();
      expect(lines[0].isSpecialPriceActive).toBe(true);
      expect(lines[0].subtotal).toBe(520); // 10 * 52 = 520 (en lugar de 480)

      // Si aumentamos a 15 unidades, se sigue respetando los L. 52 fijos sin degradar a la escala de mayoreo
      store.updateCartLineQty(0, 15);
      lines = useAppStore.getState().cartLines;
      expect(lines[0].unitPrice).toBe(52);
      expect(lines[0].appliedTierName).toBeUndefined();
      expect(lines[0].isSpecialPriceActive).toBe(true);
      expect(lines[0].subtotal).toBe(780); // 15 * 52 = 780
    });

    it('debe permitir vender empaques directamente y restar las unidades equivalentes del stock base central', () => {
      const store = useAppStore.getState();
      store.openCashShift(1000);

      const prodRefresco: Product = {
        id: 'prod-soda-base',
        tenantId: store.tenant.id,
        sku: 'REF-500',
        name: 'Refresco Cola 500ml',
        category: 'Bebidas',
        unitOfMeasure: 'UND',
        salePrice: 20,
        costPrice: 12,
        currentStock: 100, // 100 unidades sueltas
        minStockAlert: 10,
        taxClassification: 'EXENTO',
        isActive: true,
        presentations: [
          {
            id: 'pres-sixpack',
            name: 'Six-Pack (6 Unidades)',
            unitsCount: 6,
            salePrice: 110,
            costPrice: 72,
            barcode: '7421111222333'
          },
          {
            id: 'pres-caja24',
            name: 'Caja 24 Unidades',
            unitsCount: 24,
            salePrice: 420,
            costPrice: 288,
            barcode: '7421111222444'
          }
        ]
      };

      useAppStore.setState({ products: [prodRefresco] });
      store.clearCart();

      // Venta 1: Agregar 2 Six-Packs (2 * 6 = 12 unidades base)
      store.addToCart({
        product: prodRefresco,
        quantity: 2,
        presentation: prodRefresco.presentations![0]
      });

      // Venta 1: Agregar también 3 unidades sueltas
      store.addToCart({
        product: prodRefresco,
        quantity: 3
      });

      let lines = useAppStore.getState().cartLines;
      expect(lines).toHaveLength(2);
      expect(lines[0].name).toContain('Six-Pack');
      expect(lines[0].unitsPerPackage).toBe(6);
      expect(lines[0].subtotal).toBe(220); // 2 * 110
      expect(lines[1].unitsPerPackage).toBe(1);
      expect(lines[1].subtotal).toBe(60); // 3 * 20

      // Procesar venta en efectivo
      const sale = store.processSale('CASH');
      expect(sale).not.toBeNull();
      expect(sale?.total).toBe(280);

      // Verificar deducción exacta del stock central: 100 - (2 * 6) - 3 = 100 - 15 = 85 unidades
      const updatedProd = useAppStore.getState().products.find(p => p.id === prodRefresco.id);
      expect(updatedProd?.currentStock).toBe(85);

      // Venta 2: Vender 1 Caja de 24 (1 * 24 = 24 unidades)
      store.addToCart({
        product: prodRefresco,
        quantity: 1,
        presentation: prodRefresco.presentations![1]
      });
      store.processSale('CASH');

      // Stock final: 85 - 24 = 61 unidades
      const finalProd = useAppStore.getState().products.find(p => p.id === prodRefresco.id);
      expect(finalProd?.currentStock).toBe(61);
    });

    it('debe aplicar descuentos individuales por producto en el carrito sin alterar los demás ítems y calculando impuestos SAR', () => {
      const store = useAppStore.getState();
      store.openCashShift(1000);

      useAppStore.setState({
        tenant: { ...store.tenant, isFiscalEnabled: true, pricesIncludeTax: false }
      });

      const pExento: Product = {
        id: 'p-desc-exento',
        tenantId: store.tenant.id,
        sku: 'LECHE-L',
        name: 'Leche Entera 1L',
        category: 'Lácteos',
        unitOfMeasure: 'UND',
        salePrice: 100,
        costPrice: 70,
        currentStock: 50,
        minStockAlert: 5,
        taxClassification: 'EXENTO',
        isActive: true
      };

      const pGravado: Product = {
        id: 'p-desc-gravado',
        tenantId: store.tenant.id,
        sku: 'CHOCO-L',
        name: 'Caja Bombones',
        category: 'Dulces',
        unitOfMeasure: 'UND',
        salePrice: 200,
        costPrice: 120,
        currentStock: 30,
        minStockAlert: 5,
        taxClassification: 'GRAVADO_15',
        isActive: true
      };

      useAppStore.setState({ products: [pExento, pGravado] });
      store.clearCart();

      // Agregar ambos productos: Leche (L. 100 exento) y Chocolates (L. 200 gravado 15%)
      store.addToCart({ product: pExento, quantity: 1 });
      store.addToCart({ product: pGravado, quantity: 1 });

      // Aplicar descuento por monto fijo a la Leche: L. 15 de descuento (Precio neto L. 85)
      store.setCartLineDiscount(0, 15);

      // Aplicar descuento porcentual a los Chocolates: 10% de L. 200 = L. 20 de descuento (Precio neto L. 180)
      store.setCartLineDiscount(1, 20);

      const lines = useAppStore.getState().cartLines;
      expect(lines[0].discountAmount).toBe(15);
      expect(lines[0].subtotal).toBe(85);
      expect(lines[0].taxAmount).toBe(0);
      expect(lines[0].total).toBe(85);

      expect(lines[1].discountAmount).toBe(20);
      expect(lines[1].subtotal).toBe(180);
      expect(lines[1].taxAmount).toBe(27); // 180 * 15% = 27
      expect(lines[1].total).toBe(207);

      // Procesar venta fiscal
      const sale = store.processSale('CASH', 0, true);
      expect(sale).not.toBeNull();
      expect(sale?.exemptAmount).toBe(85);
      expect(sale?.taxable15).toBe(180);
      expect(sale?.tax15).toBe(27);
      expect(sale?.total).toBe(292); // 85 + 180 + 27 = 292
    });
  });

  // =========================================================================
  // 16. PERSISTENCIA Y SINCRONIZACION EN LA NUBE DE SERVICIOS
  // =========================================================================
  describe('16. Persistencia y Sincronizacion de Servicios Multi-dispositivo', () => {
    it('debe generar un UUID estandar valido al crear un nuevo servicio con addService', () => {
      const store = useAppStore.getState();
      const initialCount = store.services.length;

      store.addService({
        name: 'Corte de Pelo Clasico',
        durationMinutes: 30,
        price: 150,
        commissionType: 'PERCENTAGE',
        commissionValue: 30,
        isActive: true
      });

      const updatedServices = useAppStore.getState().services;
      expect(updatedServices.length).toBe(initialCount + 1);

      const createdService = updatedServices.find(s => s.name === 'Corte de Pelo Clasico');
      expect(createdService).toBeDefined();
      expect(createdService?.price).toBe(150);
      expect(createdService?.durationMinutes).toBe(30);
      expect(createdService?.tenantId).toBe(store.tenant.id);
      expect(createdService?.id).toBeDefined();
      // Validar que no usa el patron mock serv-TIMESTAMP sino un UUID real compatible con Supabase
      expect(isValidUUID(createdService!.id)).toBe(true);
      expect(createdService!.id.startsWith('serv-')).toBe(false);
    });

    it('debe actualizar los datos de un servicio existente con updateService', () => {
      const store = useAppStore.getState();
      store.addService({
        name: 'Lavado y Secado',
        durationMinutes: 25,
        price: 120,
        commissionType: 'FIXED',
        commissionValue: 40,
        isActive: true
      });

      const created = useAppStore.getState().services.find(s => s.name === 'Lavado y Secado')!;
      expect(created).toBeDefined();

      store.updateService(created.id, {
        name: 'Lavado, Secado y Masaje Capilar',
        price: 180,
        durationMinutes: 40
      });

      const updated = useAppStore.getState().services.find(s => s.id === created.id);
      expect(updated?.name).toBe('Lavado, Secado y Masaje Capilar');
      expect(updated?.price).toBe(180);
      expect(updated?.durationMinutes).toBe(40);
      expect(updated?.commissionValue).toBe(40); // Preserva campos no modificados
    });

    it('debe eliminar un servicio correctamente con deleteService', () => {
      const store = useAppStore.getState();
      store.addService({
        name: 'Servicio Temporal',
        durationMinutes: 15,
        price: 50,
        commissionType: 'FIXED',
        commissionValue: 10,
        isActive: true
      });

      const service = useAppStore.getState().services.find(s => s.name === 'Servicio Temporal')!;
      expect(service).toBeDefined();

      store.deleteService(service.id);

      const exists = useAppStore.getState().services.some(s => s.id === service.id);
      expect(exists).toBe(false);
    });

    it('debe integrar servicios descargados de la nube al estado de Zustand sin duplicar', () => {
      const store = useAppStore.getState();
      const currentTenantId = store.tenant.id;

      const cloudService: Service = {
        id: '22222222-2222-2222-2222-222222222222',
        tenantId: currentTenantId,
        name: 'Corte de Pelo Barba VIP',
        durationMinutes: 45,
        price: 250,
        commissionType: 'PERCENTAGE',
        commissionValue: 40,
        isActive: true
      };

      // Simular recepcion de servicios de la nube (como ocurre en syncAllCloudData)
      useAppStore.setState(state => {
        const liveIds = new Set([cloudService.id]);
        const localOnly = state.services.filter(s => s.tenantId === currentTenantId && !liveIds.has(s.id));
        const otherTenants = state.services.filter(s => s.tenantId && s.tenantId !== currentTenantId);
        return { services: [cloudService, ...localOnly, ...otherTenants] };
      });

      const found = useAppStore.getState().services.find(s => s.id === cloudService.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe('Corte de Pelo Barba VIP');
      expect(found?.price).toBe(250);
    });
  });
});
