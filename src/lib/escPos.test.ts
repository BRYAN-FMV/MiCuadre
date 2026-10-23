import { describe, it, expect } from 'vitest';
import { generateEscPosReceipt } from './escPos';
import { Sale, Tenant } from '../types';

describe('ESC/POS Receipt Generator (escPos.ts)', () => {
  const sampleTenant: Tenant = {
    id: 'tenant-001',
    name: 'Mercadito y Pulperia La Bendicion',
    rtn: '08011990123456',
    address: 'Bo. El Centro, Tegucigalpa',
    phone: '2233-4455',
    businessType: 'RETAIL',
    isFiscalEnabled: true,
    allowNegativeStock: false,
    currencySymbol: 'L'
  };

  const sampleNonFiscalSale: Sale = {
    id: 'sale-001',
    tenantId: 'tenant-001',
    documentNumber: 'TKT-00045',
    isFiscal: false,
    customerName: 'Consumidor Final',
    subtotal: 50.0,
    discountAmount: 0,
    exemptAmount: 0,
    exoneratedAmount: 0,
    taxable15: 0,
    tax15: 0,
    taxable18: 0,
    tax18: 0,
    total: 50.0,
    paymentMethod: 'CASH',
    createdAt: '2026-10-13T10:30:00.000Z',
    items: [
      {
        sku: 'LECHE-01',
        name: 'Leche Sula 1L',
        quantity: 1,
        unitPrice: 28.0,
        originalUnitPrice: 28.0,
        discountAmount: 0,
        taxClassification: 'EXENTO',
        subtotal: 28.0,
        taxAmount: 0,
        total: 28.0
      },
      {
        sku: 'COCA-01',
        name: 'Refresco Coca Cola 500ml',
        quantity: 1,
        unitPrice: 22.0,
        originalUnitPrice: 22.0,
        discountAmount: 0,
        taxClassification: 'GRAVADO_15',
        subtotal: 22.0,
        taxAmount: 0,
        total: 22.0
      }
    ]
  };

  const sampleFiscalSale: Sale = {
    ...sampleNonFiscalSale,
    documentNumber: '000-001-01-00000045',
    isFiscal: true,
    cai: 'ABCDEF-123456-7890AB-CDEF12-345678-90',
    caiDeadline: '2027-01-01',
    caiRangeStart: '000-001-01-00000001',
    caiRangeEnd: '000-001-01-00050000',
    customerName: 'Juan Perez',
    customerRtn: '08011985012345',
    taxable15: 19.13,
    tax15: 2.87,
    exemptAmount: 28.0
  };

  it('should generate an ultra-compact simple ticket when sale is not fiscal', () => {
    const bytes = generateEscPosReceipt(sampleNonFiscalSale, sampleTenant);
    const text = new TextDecoder().decode(bytes);

    // Debe contener datos esenciales
    expect(text).toContain('Mercadito y Pulperia La Bendicion');
    expect(text).toContain('TICKET: TKT-00045');
    expect(text).toContain('Leche Sula 1L');
    expect(text).toContain('Refresco Coca Col');
    expect(text).toContain('TOTAL: L 50.00');
    expect(text).toContain('PAGO: EFECTIVO');
    expect(text).toContain('Gracias por su compra');

    // NO debe contener datos extensos del SAR
    expect(text).not.toContain('FACTURA FISCAL');
    expect(text).not.toContain('CAI:');
    expect(text).not.toContain('FECHA LIMITE');
    expect(text).not.toContain('RANGO:');
    expect(text).not.toContain('ISV 15%:');
    expect(text).not.toContain('GRAVADO 15%:');
    expect(text).not.toContain('ORIGINAL: CLIENTE');
    expect(text).not.toContain('La factura es beneficio de todos, exijala.');
    // No debe imprimir RTN del comercio en ticket simple
    expect(text).not.toContain('RTN: 08011990123456');
  });

  it('should generate full fiscal invoice with SAR requirements when sale is fiscal', () => {
    const bytesOriginal = generateEscPosReceipt(sampleFiscalSale, sampleTenant, 'ORIGINAL');
    const textOriginal = new TextDecoder().decode(bytesOriginal);

    // Debe contener encabezado fiscal completo
    expect(textOriginal).toContain('Mercadito y Pulperia La Bendicion');
    expect(textOriginal).toContain('RTN: 08011990123456');
    expect(textOriginal).toContain('FACTURA FISCAL');
    expect(textOriginal).toContain('FACTURA #: 000-001-01-00000045');
    expect(textOriginal).toContain('CAI: ABCDEF-123456-7890AB-CDEF12-345678-90');
    expect(textOriginal).toContain('FECHA LIMITE EMISION: 2027-01-01');
    expect(textOriginal).toContain('000-001-01-00000001');
    expect(textOriginal).toContain('000-001-01-00050000');
    expect(textOriginal).toContain('CLIENTE: Juan Perez');
    expect(textOriginal).toContain('RTN CLIENTE: 08011985012345');

    // Desglose impositivo SAR
    expect(textOriginal).toContain('ISV 15%:');
    expect(textOriginal).toContain('GRAVADO 15%:');
    expect(textOriginal).toContain('EXENTO/EXONERADO:');

    // Leyendas obligatorias
    expect(textOriginal).toContain('ORIGINAL: CLIENTE');
    expect(textOriginal).toContain('La factura es beneficio de todos, exijala.');

    // Validar copia SAR
    const bytesCopia = generateEscPosReceipt(sampleFiscalSale, sampleTenant, 'COPIA');
    const textCopia = new TextDecoder().decode(bytesCopia);
    expect(textCopia).toContain('COPIA: OBLIGADO TRIBUTARIO EMISOR / SAR');
  });
});
