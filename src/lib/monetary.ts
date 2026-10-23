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
  pricesIncludeTax = false,
  hasSpecialPriceActive = false
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

  // 1. Evaluate Wholesale Tiers ONLY if no special price type is active
  if (!hasSpecialPriceActive && priceTiers && priceTiers.length > 0) {
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

/**
 * Converts a numeric amount to formal Spanish words with currency name and cents fraction.
 * Example: 1520.50 -> "SON: UN MIL QUINIENTOS VEINTE LEMPIRAS CON 50/100"
 */
export function numberToSpanishWords(
  amount: number,
  currencyName = 'LEMPIRAS',
  centsFraction = true
): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return `SON: CERO ${currencyName} CON 00/100`;
  }

  const dec = new Decimal(amount).abs();
  const integerPart = Math.floor(dec.toNumber());
  const centsPart = Math.round(dec.minus(integerPart).times(100).toNumber());
  const centsStr = String(centsPart).padStart(2, '0');

  function convertGroup(n: number): string {
    const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const ESPECIALES = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
    const DECENAS = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

    if (n === 0) return '';
    if (n === 100) return 'CIEN';

    let res = '';
    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;

    if (c > 0) {
      res += CENTENAS[c] + ' ';
    }

    const du = n % 100;
    if (du >= 10 && du <= 19) {
      res += ESPECIALES[du - 10];
    } else if (du === 20) {
      res += 'VEINTE';
    } else if (du > 20 && du < 30) {
      res += 'VEINTI' + (u === 1 ? 'UN' : UNIDADES[u]);
    } else if (d > 0) {
      res += DECENAS[d];
      if (u > 0) {
        res += ' Y ' + (u === 1 ? 'UN' : UNIDADES[u]);
      }
    } else if (u > 0) {
      res += (u === 1 ? 'UN' : UNIDADES[u]);
    }

    return res.trim();
  }

  function convertNumber(num: number): string {
    if (num === 0) return 'CERO';

    const millions = Math.floor(num / 1000000);
    const thousands = Math.floor((num % 1000000) / 1000);
    const remainder = num % 1000;

    const parts: string[] = [];

    if (millions > 0) {
      if (millions === 1) {
        parts.push('UN MILLON');
      } else {
        parts.push(convertGroup(millions) + ' MILLONES');
      }
    }

    if (thousands > 0) {
      if (thousands === 1) {
        parts.push('UN MIL');
      } else {
        parts.push(convertGroup(thousands) + ' MIL');
      }
    }

    if (remainder > 0) {
      parts.push(convertGroup(remainder));
    }

    return parts.join(' ').trim();
  }

  let words = convertNumber(integerPart);
  // Ensure "VEINTIUNO" / "UNO" before noun becomes "VEINTIUN" / "UN"
  if (words.endsWith('UNO')) {
    words = words.slice(0, -1);
  }

  const singularCurrency = currencyName.endsWith('S') ? currencyName.slice(0, -1) : currencyName;
  const currencyLabel = integerPart === 1 ? singularCurrency : currencyName;

  if (centsFraction) {
    return `SON: ${words} ${currencyLabel} CON ${centsStr}/100`;
  }
  return `SON: ${words} ${currencyLabel}`;
}

/**
 * Translates payment method codes ('CASH', 'CARD', 'TRANSFER', 'CREDIT', 'MIXED')
 * to standard Spanish labels.
 * If uppercase is true, returns 'EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CRÉDITO', 'PAGO MIXTO'.
 * Otherwise returns 'Efectivo', 'Tarjeta', 'Transferencia', 'Al Crédito', 'Pago Mixto'.
 */
export function formatPaymentMethod(method?: string, uppercase = false): string {
  if (!method) return uppercase ? 'EFECTIVO' : 'Efectivo';
  switch (method.toUpperCase()) {
    case 'CASH':
      return uppercase ? 'EFECTIVO' : 'Efectivo';
    case 'CARD':
      return uppercase ? 'TARJETA' : 'Tarjeta';
    case 'TRANSFER':
      return uppercase ? 'TRANSFERENCIA' : 'Transferencia';
    case 'CREDIT':
      return uppercase ? 'CRÉDITO' : 'Al Crédito';
    case 'MIXED':
      return uppercase ? 'PAGO MIXTO' : 'Pago Mixto';
    default:
      return method;
  }
}

