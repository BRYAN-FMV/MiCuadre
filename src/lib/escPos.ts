import { Sale, Tenant } from '../types';
import { formatCurrency } from './monetary';

/**
 * Encodes a Sale receipt into raw ESC/POS Uint8Array bytes for thermal printers (58mm / 80mm).
 * Supports SAR Honduras rules for ORIGINAL (Cliente) and COPIA (Emisor / SAR).
 */
export function generateEscPosReceipt(
  sale: Sale,
  tenant: Tenant,
  copyType: 'ORIGINAL' | 'COPIA' = 'ORIGINAL'
): Uint8Array {
  const encoder = new TextEncoder();
  const buffer: number[] = [];

  // ESC @ - Initialize printer
  buffer.push(0x1B, 0x40);

  // ESC a 1 - Center Align
  buffer.push(0x1B, 0x61, 0x01);

  // GS ! 0x11 - Double height & width for header
  buffer.push(0x1D, 0x21, 0x11);
  buffer.push(...encoder.encode(`${tenant.name}\n`));

  // Normal text size
  buffer.push(0x1D, 0x21, 0x00);
  if (tenant.rtn) buffer.push(...encoder.encode(`RTN: ${tenant.rtn}\n`));
  if (tenant.address) buffer.push(...encoder.encode(`${tenant.address}\n`));
  if (tenant.phone) buffer.push(...encoder.encode(`TEL: ${tenant.phone}\n`));

  buffer.push(...encoder.encode('--------------------------------\n'));

  // Document details & Copy Legend
  if (sale.isFiscal) {
    const copyLabel = copyType === 'ORIGINAL' ? '=== ORIGINAL: CLIENTE ===' : '=== COPIA: OBLIGADO TRIBUTARIO EMISOR / SAR ===';
    buffer.push(...encoder.encode(`${copyLabel}\n`));
    buffer.push(...encoder.encode('FACTURA FISCAL\n'));
    buffer.push(...encoder.encode(`FACTURA #: ${sale.documentNumber}\n`));
    if (sale.cai) buffer.push(...encoder.encode(`CAI: ${sale.cai}\n`));
    if (sale.caiRangeStart && sale.caiRangeEnd) {
      buffer.push(...encoder.encode(`RANGO: ${sale.caiRangeStart}\n  AL ${sale.caiRangeEnd}\n`));
    }
    if (sale.caiDeadline) {
      buffer.push(...encoder.encode(`FECHA LIMITE EMISION: ${sale.caiDeadline}\n`));
    }
  } else {
    buffer.push(...encoder.encode('COMPROBANTE DE VENTA INTERNO\n'));
    buffer.push(...encoder.encode(`TICKET #: ${sale.documentNumber}\n`));
  }

  buffer.push(...encoder.encode(`FECHA: ${new Date(sale.createdAt).toLocaleString('es-HN')}\n`));
  buffer.push(...encoder.encode(`CAJA: ${sale.cajaName || 'Caja 1'}\n`));
  buffer.push(...encoder.encode(`CLIENTE: ${sale.customerName}\n`));
  if (sale.customerRtn) buffer.push(...encoder.encode(`RTN CLIENTE: ${sale.customerRtn}\n`));

  buffer.push(...encoder.encode('--------------------------------\n'));

  // Left align items table
  buffer.push(0x1B, 0x61, 0x00);
  buffer.push(...encoder.encode('CANT   DESCRIPCION       TOTAL\n'));

  if (sale.items) {
    for (const item of sale.items) {
      const name = item.name.length > 16 ? item.name.slice(0, 16) : item.name.padEnd(16, ' ');
      const qty = String(item.quantity).padStart(4, ' ');
      const tot = formatCurrency(item.total, '').trim().padStart(8, ' ');
      buffer.push(...encoder.encode(`${qty} ${name} ${tot}\n`));
    }
  }

  buffer.push(...encoder.encode('--------------------------------\n'));

  // Right align totals
  buffer.push(0x1B, 0x61, 0x02);
  buffer.push(...encoder.encode(`SUBTOTAL: ${formatCurrency(sale.subtotal, tenant.currencySymbol)}\n`));
  if (sale.discountAmount > 0) buffer.push(...encoder.encode(`DESCUENTO: ${formatCurrency(sale.discountAmount, tenant.currencySymbol)}\n`));
  if (sale.taxable15 > 0) buffer.push(...encoder.encode(`GRAVADO 15%: ${formatCurrency(sale.taxable15, tenant.currencySymbol)}\n`));
  if (sale.tax15 > 0) buffer.push(...encoder.encode(`ISV 15%: ${formatCurrency(sale.tax15, tenant.currencySymbol)}\n`));
  if (sale.taxable18 > 0) buffer.push(...encoder.encode(`GRAVADO 18%: ${formatCurrency(sale.taxable18, tenant.currencySymbol)}\n`));
  if (sale.tax18 > 0) buffer.push(...encoder.encode(`ISV 18%: ${formatCurrency(sale.tax18, tenant.currencySymbol)}\n`));

  // Bold & Large Total
  buffer.push(0x1B, 0x45, 0x01); // Emphasized mode ON
  buffer.push(...encoder.encode(`TOTAL A PAGAR: ${formatCurrency(sale.total, tenant.currencySymbol)}\n`));
  buffer.push(0x1B, 0x45, 0x00); // Emphasized mode OFF

  buffer.push(...encoder.encode(`FORMA DE PAGO: ${sale.paymentMethod}\n`));
  buffer.push(...encoder.encode('--------------------------------\n'));

  // Center align footer
  buffer.push(0x1B, 0x61, 0x01);
  if (sale.isFiscal) {
    buffer.push(...encoder.encode('"La factura es beneficio de todos, exijala."\n'));
    buffer.push(...encoder.encode(`${copyType === 'ORIGINAL' ? 'ORIGINAL: CLIENTE' : 'COPIA: OBLIGADO TRIBUTARIO EMISOR / SAR'}\n`));
  }
  buffer.push(...encoder.encode('¡Gracias por su compra!\n'));
  buffer.push(...encoder.encode('Sistema impulsado por MiCuadre.app\n\n\n\n'));

  // GS V 66 0 - Paper Cut
  buffer.push(0x1D, 0x56, 0x42, 0x00);

  return new Uint8Array(buffer);
}
