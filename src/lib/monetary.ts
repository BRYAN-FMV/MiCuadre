import Decimal from 'decimal.js';
import { CartLine, TaxClassification, PriceTier } from '../types';

// Configure Decimal precision for financial calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Format currency value with symbol (e.g., "L. 1,250.00")
 */
export function formatCurrency(amount: number | string, symbol = 'L.'): string {
  const dec = new Decimal(amount || 0);
  const formatted = dec.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${symbol} ${formatted}`;
}

/**
 * Calculates line totals including wholesale price tier matching, discounts, and tax classification (ISV 15%, 18%)
 */
export function calculateLineTotals(
  unitPrice: number,
  quantity: number,
  taxClassification: TaxClassification,
  discountAmount = 0,
  priceTiers?: PriceTier[],
  pricesIncludeTax = false
): {
  unitPrice: number;
  originalUnitPrice: number;
  appliedTierName?: string;
  subtotal: number;
  taxAmount: number;
  total: number;
} {
  const qty = new Decimal(quantity);
  let effectiveUnitPrice = new Decimal(unitPrice);
  const originalUnitPrice = new Decimal(unitPrice);
  let appliedTierName: string | undefined;

  // 1. Evaluate Wholesale Tiers if available
  if (priceTiers && priceTiers.length > 0) {
    const sortedTiers = [...priceTiers].sort((a, b) => b.minQuantity - a.minQuantity);
    const matchedTier = sortedTiers.find(tier => {
      const minOk = quantity >= tier.minQuantity;
      const maxOk = tier.maxQuantity ? quantity <= tier.maxQuantity : true;
      return minOk && maxOk;
    });

    if (matchedTier) {
      effectiveUnitPrice = new Decimal(matchedTier.unitPrice);
      appliedTierName = matchedTier.tierName;
    }
  }

  // 2. Gross Line
  const lineGross = effectiveUnitPrice.times(qty);
  const disc = new Decimal(discountAmount || 0);

  // 3. Calculate Tax Rate based on classification
  let taxRate = new Decimal(0);
  if (taxClassification === 'GRAVADO_15') {
    taxRate = new Decimal(0.15);
  } else if (taxClassification === 'GRAVADO_18') {
    taxRate = new Decimal(0.18);
  }

  // 4. Tax Calculation Mode (ISV Included vs Tax Added)
  if (pricesIncludeTax && taxRate.greaterThan(0)) {
    // Total line amount after discount:
    const totalLine = Decimal.max(0, lineGross.minus(disc)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    // Base = totalLine / (1 + taxRate)
    const taxableBase = totalLine.div(new Decimal(1).plus(taxRate)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const taxAmount = totalLine.minus(taxableBase).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    return {
      unitPrice: effectiveUnitPrice.toNumber(),
      originalUnitPrice: originalUnitPrice.toNumber(),
      appliedTierName,
      subtotal: taxableBase.toNumber(),
      taxAmount: taxAmount.toNumber(),
      total: totalLine.toNumber()
    };
  } else {
    // Tax Added on top of unit price
    const taxableBase = Decimal.max(0, lineGross.minus(disc));
    const taxAmount = taxableBase.times(taxRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const total = taxableBase.plus(taxAmount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    return {
      unitPrice: effectiveUnitPrice.toNumber(),
      originalUnitPrice: originalUnitPrice.toNumber(),
      appliedTierName,
      subtotal: taxableBase.toNumber(),
      taxAmount: taxAmount.toNumber(),
      total: total.toNumber()
    };
  }
}

/**
 * Calculates cart header totals by accumulating cart lines
 */
export function calculateCartTotals(lines: CartLine[]) {
  let subtotal = new Decimal(0);
  let discountAmount = new Decimal(0);
  let exemptAmount = new Decimal(0);
  let exoneratedAmount = new Decimal(0);
  let taxable15 = new Decimal(0);
  let tax15 = new Decimal(0);
  let taxable18 = new Decimal(0);
  let tax18 = new Decimal(0);

  for (const line of lines) {
    const lineSubtotal = new Decimal(line.subtotal);
    const lineTax = new Decimal(line.taxAmount);
    const lineDisc = new Decimal(line.discountAmount || 0);

    subtotal = subtotal.plus(lineSubtotal);
    discountAmount = discountAmount.plus(lineDisc);

    if (line.taxClassification === 'EXENTO') {
      exemptAmount = exemptAmount.plus(lineSubtotal);
    } else if (line.taxClassification === 'EXONERADO') {
      exoneratedAmount = exoneratedAmount.plus(lineSubtotal);
    } else if (line.taxClassification === 'GRAVADO_15') {
      taxable15 = taxable15.plus(lineSubtotal);
      tax15 = tax15.plus(lineTax);
    } else if (line.taxClassification === 'GRAVADO_18') {
      taxable18 = taxable18.plus(lineSubtotal);
      tax18 = tax18.plus(lineTax);
    }
  }

  const total = subtotal.plus(tax15).plus(tax18).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    subtotal: subtotal.toNumber(),
    discountAmount: discountAmount.toNumber(),
    exemptAmount: exemptAmount.toNumber(),
    exoneratedAmount: exoneratedAmount.toNumber(),
    taxable15: taxable15.toNumber(),
    tax15: tax15.toNumber(),
    taxable18: taxable18.toNumber(),
    tax18: tax18.toNumber(),
    total: total.toNumber()
  };
}

/**
 * Computes Weighted Average Cost (CPP - Costo Promedio Ponderado)
 */
export function calculateCPP(
  currentStock: number,
  currentCost: number,
  purchasedQty: number,
  purchasedCost: number
): { newCost: number; newStock: number } {
  const stock = new Decimal(currentStock);
  const cost = new Decimal(currentCost);
  const inQty = new Decimal(purchasedQty);
  const inCost = new Decimal(purchasedCost);

  const totalQty = stock.plus(inQty);

  if (totalQty.lessThanOrEqualTo(0)) {
    return { newCost: inCost.toNumber(), newStock: totalQty.toNumber() };
  }

  const totalValue = stock.times(cost).plus(inQty.times(inCost));
  const newCost = totalValue.div(totalQty).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    newCost: newCost.toNumber(),
    newStock: totalQty.toNumber()
  };
}

/**
 * Formats SAR Document Number: e.g. prefix="000-001-01-", currentNum=845 -> "000-001-01-00000845"
 */
export function formatSARDocumentNumber(prefix: string, consecutive: number): string {
  const padded = String(consecutive).padStart(8, '0');
  return `${prefix}${padded}`;
}
