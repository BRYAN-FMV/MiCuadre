import { describe, it, expect } from 'vitest';
import { formatCurrency, calculateCPP, calculateLineTotals, calculateCartTotals, formatSARDocumentNumber } from './monetary';
import { CartLine, PriceTier } from '../types';

describe('Monetary & Financial Utility Functions', () => {
  it('should format currency correctly with default symbol (L.)', () => {
    expect(formatCurrency(1250)).toBe('L. 1,250.00');
    expect(formatCurrency(0)).toBe('L. 0.00');
    expect(formatCurrency('99.5')).toBe('L. 99.50');
  });

  it('should format currency with custom symbol ($)', () => {
    expect(formatCurrency(50.25, '$')).toBe('$ 50.25');
  });

  it('should compute Weighted Average Cost (CPP) accurately', () => {
    // 10 units at L. 50 cost + 10 units at L. 70 cost = 20 units at L. 60 cost
    const result = calculateCPP(10, 50, 10, 70);
    expect(result.newStock).toBe(20);
    expect(result.newCost).toBe(60.00);

    // Initial 0 stock -> new cost equals purchased cost
    const zeroStockResult = calculateCPP(0, 0, 5, 120);
    expect(zeroStockResult.newStock).toBe(5);
    expect(zeroStockResult.newCost).toBe(120.00);
  });

  it('should calculate line totals with tax added (GRAVADO_15)', () => {
    const res = calculateLineTotals(100, 2, 'GRAVADO_15', 0, undefined, false);
    expect(res.subtotal).toBe(200);
    expect(res.taxAmount).toBe(30); // 15% of 200 = 30
    expect(res.total).toBe(230);
  });

  it('should calculate line totals when price includes tax (ISV Incluido)', () => {
    // Total 115 included tax = 100 subtotal + 15 ISV
    const res = calculateLineTotals(115, 1, 'GRAVADO_15', 0, undefined, true);
    expect(res.total).toBe(115);
    expect(res.subtotal).toBe(100);
    expect(res.taxAmount).toBe(15);
  });

  it('should apply wholesale price tier when quantity meets threshold', () => {
    const tiers: PriceTier[] = [
      { id: 'tier-1', minQuantity: 6, maxQuantity: 11, unitPrice: 80, tierName: 'Mayoreo' }
    ];
    // 10 units falls into Mayoreo tier (unitPrice: 80)
    const res = calculateLineTotals(100, 10, 'EXENTO', 0, tiers, false);
    expect(res.unitPrice).toBe(80);
    expect(res.appliedTierName).toBe('Mayoreo');
    expect(res.subtotal).toBe(800);
  });

  it('should format SAR document numbers with 8-digit padding', () => {
    const formatted = formatSARDocumentNumber('000-001-01-', 45);
    expect(formatted).toBe('000-001-01-00000045');
  });

  it('should accumulate cart totals for mixed tax classifications', () => {
    const lines: CartLine[] = [
      {
        productId: 'prod-1',
        sku: 'SKU-001',
        name: 'Producto A',
        unitPrice: 100,
        originalUnitPrice: 100,
        quantity: 1,
        discountAmount: 0,
        taxClassification: 'GRAVADO_15',
        subtotal: 100,
        taxAmount: 15,
        total: 115
      },
      {
        productId: 'prod-2',
        sku: 'SKU-002',
        name: 'Producto B',
        unitPrice: 50,
        originalUnitPrice: 50,
        quantity: 1,
        discountAmount: 0,
        taxClassification: 'EXENTO',
        subtotal: 50,
        taxAmount: 0,
        total: 50
      }
    ];

    const cartTotals = calculateCartTotals(lines);
    expect(cartTotals.subtotal).toBe(150);
    expect(cartTotals.taxable15).toBe(100);
    expect(cartTotals.tax15).toBe(15);
    expect(cartTotals.exemptAmount).toBe(50);
    expect(cartTotals.total).toBe(165);
  });
});
