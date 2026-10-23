import { Sale, Tenant } from '../types';
import { formatCurrency, formatPaymentMethod } from './monetary';

/**
 * Encodes a Sale receipt into raw ESC/POS Uint8Array bytes for thermal printers (58mm / 80mm).
 * - Factura Fiscal: Formato legal completo conforme al SAR (CAI, rangos, fechas, desgloses tributarios).
 * - Ticket Interno: Formato ultra simple y compacto para mercaditos/pulperías (ahorro de papel y lectura rápida).
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

  if (sale.isFiscal) {
    // =========================================================================
    // MODO FACTURA FISCAL (SAR HONDURAS)
    // =========================================================================

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
    if (sale.exemptAmount > 0 || sale.exoneratedAmount > 0) {
      buffer.push(...encoder.encode(`EXENTO/EXONERADO: ${formatCurrency((sale.exemptAmount || 0) + (sale.exoneratedAmount || 0), tenant.currencySymbol)}\n`));
    }
    if (sale.taxable15 > 0) buffer.push(...encoder.encode(`GRAVADO 15%: ${formatCurrency(sale.taxable15, tenant.currencySymbol)}\n`));
    if (sale.tax15 > 0) buffer.push(...encoder.encode(`ISV 15%: ${formatCurrency(sale.tax15, tenant.currencySymbol)}\n`));
    if (sale.taxable18 > 0) buffer.push(...encoder.encode(`GRAVADO 18%: ${formatCurrency(sale.taxable18, tenant.currencySymbol)}\n`));
    if (sale.tax18 > 0) buffer.push(...encoder.encode(`ISV 18%: ${formatCurrency(sale.tax18, tenant.currencySymbol)}\n`));

    // Bold & Large Total
    buffer.push(0x1B, 0x45, 0x01); // Emphasized mode ON
    buffer.push(...encoder.encode(`TOTAL A PAGAR: ${formatCurrency(sale.total, tenant.currencySymbol)}\n`));
    buffer.push(0x1B, 0x45, 0x00); // Emphasized mode OFF

    buffer.push(...encoder.encode(`FORMA DE PAGO: ${formatPaymentMethod(sale.paymentMethod, true)}\n`));
    buffer.push(...encoder.encode('--------------------------------\n'));

    // Center align footer
    buffer.push(0x1B, 0x61, 0x01);
    buffer.push(...encoder.encode('"La factura es beneficio de todos, exijala."\n'));
    buffer.push(...encoder.encode(`${copyType === 'ORIGINAL' ? 'ORIGINAL: CLIENTE' : 'COPIA: OBLIGADO TRIBUTARIO EMISOR / SAR'}\n`));
    buffer.push(...encoder.encode('¡Gracias por su compra!\n'));
    buffer.push(...encoder.encode('Sistema impulsado por MiCuadre.app\n\n\n\n'));
  } else {
    // =========================================================================
    // MODO TICKET SIMPLE / COMPROBANTE INTERNO (ULTRACOMPACTO)
    // =========================================================================

    // ESC a 1 - Center Align
    buffer.push(0x1B, 0x61, 0x01);

    // Double height & width for business name
    buffer.push(0x1D, 0x21, 0x11);
    buffer.push(...encoder.encode(`${tenant.name}\n`));

    // Normal text size
    buffer.push(0x1D, 0x21, 0x00);
    if (tenant.phone) buffer.push(...encoder.encode(`TEL: ${tenant.phone}\n`));

    buffer.push(...encoder.encode('--------------------------------\n'));

    // Compact Ticket & Date line
    const saleDate = new Date(sale.createdAt);
    const dateStr = saleDate.toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const timeStr = saleDate.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' });
    buffer.push(...encoder.encode(`TICKET: ${sale.documentNumber}   ${dateStr} ${timeStr}\n`));

    if (sale.customerName && sale.customerName !== 'Consumidor Final') {
      buffer.push(...encoder.encode(`CLIENTE: ${sale.customerName}\n`));
    }

    buffer.push(...encoder.encode('--------------------------------\n'));

    // Left align items table (clean list)
    buffer.push(0x1B, 0x61, 0x00);
    if (sale.items) {
      for (const item of sale.items) {
        const name = item.name.length > 17 ? item.name.slice(0, 17) : item.name.padEnd(17, ' ');
        const qty = `${item.quantity}x`.padStart(3, ' ');
        const tot = formatCurrency(item.total, '').trim().padStart(8, ' ');
        buffer.push(...encoder.encode(`${qty} ${name} ${tot}\n`));
      }
    }

    buffer.push(...encoder.encode('--------------------------------\n'));

    // Right align totals
    buffer.push(0x1B, 0x61, 0x02);
    if (sale.discountAmount > 0) {
      buffer.push(...encoder.encode(`DESCUENTO: -${formatCurrency(sale.discountAmount, tenant.currencySymbol)}\n`));
    }

    // Bold Total
    buffer.push(0x1B, 0x45, 0x01); // Emphasized mode ON
    buffer.push(...encoder.encode(`TOTAL: ${formatCurrency(sale.total, tenant.currencySymbol)}\n`));
    buffer.push(0x1B, 0x45, 0x00); // Emphasized mode OFF

    buffer.push(...encoder.encode(`PAGO: ${formatPaymentMethod(sale.paymentMethod, true)}\n`));
    buffer.push(...encoder.encode('--------------------------------\n'));

    // Center align footer
    buffer.push(0x1B, 0x61, 0x01);
    buffer.push(...encoder.encode('¡Gracias por su compra!\n\n\n\n\n'));
  }

  // GS V 66 0 - Paper Cut
  buffer.push(0x1D, 0x56, 0x42, 0x00);

  return new Uint8Array(buffer);
}

export interface KitchenTicketData {
  orderNumber: string | number;
  tableNumber?: string;
  deliveryType: 'DINE_IN' | 'TAKE_OUT' | 'DELIVERY';
  customerName?: string;
  serverName?: string;
  createdAt?: string;
  notes?: string;
  items: Array<{
    name: string;
    quantity: number;
    notes?: string;
    extras?: Array<{ name: string; price?: number }>;
  }>;
}

/**
 * Encodes a Kitchen / Bar ticket into raw ESC/POS Uint8Array bytes for thermal printers (58mm / 80mm).
 * Strictly non-fiscal, without prices, highlighting dish quantities, extras and preparation notes.
 */
export function generateKitchenEscPosTicket(data: KitchenTicketData): Uint8Array {
  const encoder = new TextEncoder();
  const buffer: number[] = [];

  // ESC @ - Initialize printer
  buffer.push(0x1B, 0x40);

  // ESC a 1 - Center Align
  buffer.push(0x1B, 0x61, 0x01);

  // Double height & width
  buffer.push(0x1D, 0x21, 0x11);
  buffer.push(...encoder.encode('*** ORDEN DE COCINA ***\n'));

  // Normal text size
  buffer.push(0x1D, 0x21, 0x00);
  buffer.push(...encoder.encode('--------------------------------\n'));

  // Order identifier & Type
  buffer.push(0x1D, 0x21, 0x11);
  if (data.deliveryType === 'DINE_IN') {
    buffer.push(...encoder.encode(`${data.tableNumber || 'MESA'}\n`));
  } else if (data.deliveryType === 'TAKE_OUT') {
    buffer.push(...encoder.encode(`PARA LLEVAR #${data.orderNumber}\n`));
  } else {
    buffer.push(...encoder.encode(`DOMICILIO #${data.orderNumber}\n`));
  }

  // Normal text size
  buffer.push(0x1D, 0x21, 0x00);
  const now = data.createdAt ? new Date(data.createdAt) : new Date();
  const timeStr = now.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit' });
  buffer.push(...encoder.encode(`HORA: ${timeStr}  FECHA: ${dateStr}\n`));

  if (data.customerName && data.customerName !== 'Consumidor Final') {
    buffer.push(...encoder.encode(`CLIENTE: ${data.customerName}\n`));
  }
  if (data.serverName) {
    buffer.push(...encoder.encode(`MESERO: ${data.serverName}\n`));
  }

  buffer.push(...encoder.encode('================================\n'));

  // Items list (Left aligned)
  buffer.push(0x1B, 0x61, 0x00);

  for (const item of data.items) {
    // Large font for dish and quantity
    buffer.push(0x1D, 0x21, 0x01); // Double height
    buffer.push(...encoder.encode(`[ ${item.quantity} ] ${item.name}\n`));
    buffer.push(0x1D, 0x21, 0x00); // Normal text

    // Extras in bold / emphasized
    if (item.extras && item.extras.length > 0) {
      buffer.push(0x1B, 0x45, 0x01); // Bold ON
      for (const extra of item.extras) {
        buffer.push(...encoder.encode(`   + EXTRA: ${extra.name}\n`));
      }
      buffer.push(0x1B, 0x45, 0x00); // Bold OFF
    }

    // Notes
    if (item.notes) {
      buffer.push(...encoder.encode(`   >> NOTA: ${item.notes}\n`));
    }

    buffer.push(...encoder.encode('--------------------------------\n'));
  }

  if (data.notes) {
    buffer.push(...encoder.encode(`NOTA GENERAL: ${data.notes}\n`));
    buffer.push(...encoder.encode('--------------------------------\n'));
  }

  // Center align bottom
  buffer.push(0x1B, 0x61, 0x01);
  buffer.push(...encoder.encode('FIN DE COMANDA\n\n\n\n\n'));

  // GS V 66 0 - Paper Cut
  buffer.push(0x1D, 0x56, 0x42, 0x00);

  return new Uint8Array(buffer);
}

