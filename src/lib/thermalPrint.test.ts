import { describe, it, expect } from 'vitest';
import {
  generateSaleReceiptHtml,
  generateKitchenTicketHtml,
  generatePaymentReceiptHtml,
  generateZReportHtml,
  generateInvoiceLetterHtml,
  printSaleReceipt,
  printSaleInvoiceLetter
} from './thermalPrint';
import { Sale, Tenant } from '../types';

describe('Thermal Print Engine (thermalPrint.ts)', () => {
  const sampleTenant: Tenant = {
    id: 'tenant-001',
    name: 'Pulperia Camila',
    rtn: '08011990123456',
    address: 'Col. Kennedy, Tegucigalpa',
    phone: '96349896',
    businessType: 'RETAIL',
    isFiscalEnabled: true,
    allowNegativeStock: false,
    currencySymbol: 'L'
  };

  const sampleSimpleSale: Sale = {
    id: 'sale-001',
    tenantId: 'tenant-001',
    documentNumber: 'TICK-952617',
    isFiscal: false,
    customerName: 'Cliente Domicilio',
    subtotal: 480.0,
    discountAmount: 0,
    exemptAmount: 0,
    exoneratedAmount: 0,
    taxable15: 0,
    tax15: 0,
    taxable18: 0,
    tax18: 0,
    total: 480.0,
    paymentMethod: 'CASH',
    createdAt: '2026-10-15T17:39:00.000Z',
    items: [
      {
        sku: 'DES-01',
        name: 'desayuno',
        quantity: 4,
        unitPrice: 120.0,
        originalUnitPrice: 120.0,
        discountAmount: 0,
        taxClassification: 'EXENTO',
        subtotal: 480.0,
        taxAmount: 0,
        total: 480.0
      }
    ]
  };

  it('should generate clean, readable HTML for a simple ticket without raw binary control codes', () => {
    const html = generateSaleReceiptHtml(sampleSimpleSale, sampleTenant);

    expect(html).toContain('Pulperia Camila');
    expect(html).toContain('96349896');
    expect(html).toContain('TICK-952617');
    expect(html).toContain('Cliente Domicilio');
    expect(html).toContain('4x desayuno');
    expect(html).toContain('480.00');
    expect(html).toContain('EFECTIVO');
    expect(html).toContain('Gracias por su compra');

    // Never contain raw ESC/POS command chars
    expect(html).not.toContain('\x1b');
    expect(html).not.toContain('\x1d');
    expect(html).not.toContain('@a!');
  });

  it('should generate fiscal invoice HTML compliant with SAR Honduras when isFiscal is true', () => {
    const fiscalSale: Sale = {
      ...sampleSimpleSale,
      isFiscal: true,
      documentNumber: '000-001-01-00000045',
      cai: 'ABCDEF-123456-7890AB-CDEF12-345678-90',
      caiDeadline: '2027-01-01',
      caiRangeStart: '000-001-01-00000001',
      caiRangeEnd: '000-001-01-00050000',
      taxable15: 100.0,
      tax15: 15.0
    };

    const htmlOriginal = generateSaleReceiptHtml(fiscalSale, sampleTenant, 'ORIGINAL');
    expect(htmlOriginal).toContain('FACTURA FISCAL');
    expect(htmlOriginal).toContain('ORIGINAL: CLIENTE');
    expect(htmlOriginal).toContain('ABCDEF-123456-7890AB-CDEF12-345678-90');
    expect(htmlOriginal).toContain('000-001-01-00000045');
    expect(htmlOriginal).toContain('ISV 15%:');
    expect(htmlOriginal).toContain('La factura es beneficio de todos, exijala.');

    const htmlCopia = generateSaleReceiptHtml(fiscalSale, sampleTenant, 'COPIA');
    expect(htmlCopia).toContain('COPIA: OBLIGADO TRIBUTARIO EMISOR / SAR');
  });

  it('should generate clean kitchen ticket HTML with extras and notes', () => {
    const kitchenHtml = generateKitchenTicketHtml({
      orderNumber: 'ORD-102',
      tableNumber: 'Mesa 4',
      deliveryType: 'DINE_IN',
      customerName: 'Mario Bros',
      items: [
        {
          name: 'Hamburguesa Clasica',
          quantity: 2,
          notes: 'Sin cebolla',
          extras: [{ name: 'Extra Queso', price: 20 }]
        }
      ]
    });

    expect(kitchenHtml).toContain('*** ORDEN DE COCINA ***');
    expect(kitchenHtml).toContain('MESA: Mesa 4');
    expect(kitchenHtml).toContain('[ 2 ] Hamburguesa Clasica');
    expect(kitchenHtml).toContain('+ EXTRA: Extra Queso');
    expect(kitchenHtml).toContain('>> NOTA: Sin cebolla');
    expect(kitchenHtml).toContain('FIN DE COMANDA');
  });

  it('should generate clean payment receipt HTML for credit abonos', () => {
    const paymentHtml = generatePaymentReceiptHtml({
      tenant: sampleTenant,
      payment: {
        id: 'PAY-009',
        customerName: 'Doña Santos',
        amount: 200,
        paymentMethod: 'CASH',
        createdAt: '2026-10-15T12:00:00.000Z',
        createdBy: 'Admin'
      },
      prevBalance: 500,
      newBalance: 300
    });

    expect(paymentHtml).toContain('COMPROBANTE DE ABONO A FIADO');
    expect(paymentHtml).toContain('PAY-009');
    expect(paymentHtml).toContain('Doña Santos');
    expect(paymentHtml).toContain('200.00');
    expect(paymentHtml).toContain('Saldo Anterior:');
    expect(paymentHtml).toContain('Nuevo Saldo Pendiente:');
  });

  it('should generate clean Z-report HTML for shift cash closing', () => {
    const zHtml = generateZReportHtml({
      tenant: sampleTenant,
      cajaName: 'Caja 1',
      zReport: {
        openingAmount: 500,
        totalCashSales: 1200,
        totalCardSales: 450,
        totalTransferSales: 300,
        totalIngresos: 100,
        totalEgresos: 50,
        closingSystem: 1750,
        closingDeclared: 1750,
        difference: 0
      }
    });

    expect(zHtml).toContain('REPORTE DE CIERRE Z');
    expect(zHtml).toContain('Caja 1');
    expect(zHtml).toContain('Ventas Efectivo:');
    expect(zHtml).toContain('DIFERENCIA DE CAJA:');
    expect(zHtml).toContain('CIERRE DE CAJA EXITOSO');
  });

  describe('Letter & Half-Letter Format Generation (generateInvoiceLetterHtml)', () => {
    const fiscalSale: Sale = {
      ...sampleSimpleSale,
      isFiscal: true,
      documentNumber: '000-001-01-00000045',
      cai: 'ABCDEF-123456-7890AB-CDEF12-345678-90',
      caiDeadline: '2027-01-01',
      caiRangeStart: '000-001-01-00000001',
      caiRangeEnd: '000-001-01-00050000',
      subtotal: 1000.0,
      discountAmount: 100.0,
      taxable15: 900.0,
      tax15: 135.0,
      total: 1035.0,
      items: [
        {
          sku: 'SERV-01',
          name: 'Consultoria Profesional',
          quantity: 1,
          unitPrice: 1000.0,
          originalUnitPrice: 1000.0,
          discountAmount: 100.0,
          taxClassification: 'GRAVADO_15',
          subtotal: 900.0,
          taxAmount: 135.0,
          total: 1035.0
        }
      ]
    };

    it('should generate complete SAR-compliant Letter format invoice', () => {
      const letterHtml = generateInvoiceLetterHtml(fiscalSale, sampleTenant, 'ORIGINAL', false);

      // Header & Fiscal Identifiers
      expect(letterHtml).toContain('FACTURA');
      expect(letterHtml).toContain('ORIGINAL: CLIENTE');
      expect(letterHtml).toContain('Pulperia Camila');
      expect(letterHtml).toContain('08011990123456');
      expect(letterHtml).toContain('ABCDEF-123456-7890AB-CDEF12-345678-90');
      expect(letterHtml).toContain('000-001-01-00000045');
      expect(letterHtml).toContain('2027-01-01');
      expect(letterHtml).toContain('000-001-01-00000001');
      expect(letterHtml).toContain('000-001-01-00050000');

      // Product Table
      expect(letterHtml).toContain('Consultoria Profesional');
      expect(letterHtml).toContain('1,035.00');

      // Amount in words
      expect(letterHtml).toContain('SON: UN MIL TREINTA Y CINCO LEMPIRAS CON 00/100');

      // SAR required legal text and signatures
      expect(letterHtml).toContain('LA FACTURA ES BENEFICIO DE TODOS, EXÍJALA');
      expect(letterHtml).toContain('Entregado Conforme');
      expect(letterHtml).toContain('Recibido Conforme');
    });

    it('should generate Half-Letter format with proper CSS flag', () => {
      const halfHtml = generateInvoiceLetterHtml(fiscalSale, sampleTenant, 'COPIA', true);

      expect(halfHtml).toContain('COPIA: OBLIGADO TRIBUTARIO EMISOR / SAR');
      expect(halfHtml).toContain('half-letter');
      expect(halfHtml).toContain('LA FACTURA ES BENEFICIO DE TODOS, EXÍJALA');
    });

    it('should handle non-fiscal sale in Letter format as formal receipt/remission note', () => {
      const nonFiscalHtml = generateInvoiceLetterHtml(sampleSimpleSale, sampleTenant, 'ORIGINAL', false);

      expect(nonFiscalHtml).toContain('COMPROBANTE DE VENTA');
      expect(nonFiscalHtml).toContain('TICK-952617');
      expect(nonFiscalHtml).toContain('desayuno');
      expect(nonFiscalHtml).toContain('SON: CUATROCIENTOS OCHENTA LEMPIRAS CON 00/100');
      expect(nonFiscalHtml).toContain('Recibido Conforme');
    });

    it('should dispatch printSaleReceipt with CARTA and MEDIA_CARTA without throwing', () => {
      expect(() => {
        printSaleReceipt(fiscalSale, sampleTenant, 'ORIGINAL', 'CARTA');
      }).not.toThrow();

      expect(() => {
        printSaleReceipt(fiscalSale, sampleTenant, 'COPIA', 'MEDIA_CARTA');
      }).not.toThrow();

      expect(() => {
        printSaleInvoiceLetter(fiscalSale, sampleTenant, 'ORIGINAL', 'CARTA');
      }).not.toThrow();
    });

    it('should dispatch printSaleReceipt with 80mm and 58mm thermal rolls without throwing', () => {
      expect(() => {
        printSaleReceipt(fiscalSale, sampleTenant, 'ORIGINAL', '80mm');
      }).not.toThrow();

      expect(() => {
        printSaleReceipt(fiscalSale, { ...sampleTenant, ticketPaperWidth: '80mm' }, 'COPIA');
      }).not.toThrow();

      expect(() => {
        printSaleReceipt(sampleSimpleSale, sampleTenant, 'ORIGINAL', '58mm');
      }).not.toThrow();
    });

    it('should include business logo in ticket and letter invoice when tenant.logoUrl is present', () => {
      const tenantWithLogo: Tenant = {
        ...sampleTenant,
        logoUrl: 'data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoAAP7/2QAA'
      };

      const simpleHtml = generateSaleReceiptHtml(sampleSimpleSale, tenantWithLogo);
      expect(simpleHtml).toContain('<img src="data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoAAP7/2QAA"');

      const fiscalHtml = generateSaleReceiptHtml(fiscalSale, tenantWithLogo, 'ORIGINAL');
      expect(fiscalHtml).toContain('<img src="data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoAAP7/2QAA"');

      const letterHtml = generateInvoiceLetterHtml(fiscalSale, tenantWithLogo, 'ORIGINAL');
      expect(letterHtml).toContain('<img src="data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoAAP7/2QAA"');
    });

    it('should not render broken img tag when logo is undefined or missing', () => {
      const tenantWithoutLogo: Tenant = {
        ...sampleTenant,
        logoUrl: undefined
      };

      const simpleHtml = generateSaleReceiptHtml(sampleSimpleSale, tenantWithoutLogo);
      expect(simpleHtml).not.toContain('<img');

      const letterHtml = generateInvoiceLetterHtml(fiscalSale, tenantWithoutLogo, 'ORIGINAL');
      expect(letterHtml).not.toContain('<img');
    });
  });
});
