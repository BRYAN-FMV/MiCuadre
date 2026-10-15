import { Sale, Tenant } from '../types';
import { formatCurrency } from './monetary';
import { KitchenTicketData } from './escPos';

export interface PaymentReceiptData {
  tenant: Tenant;
  payment: {
    id: string;
    customerName: string;
    amount: number;
    paymentMethod: string;
    createdAt: string;
    createdBy: string;
  };
  prevBalance: number;
  newBalance: number;
}

export interface ZReportPrintData {
  tenant: Tenant;
  cajaName?: string;
  zReport: {
    openingAmount: number;
    totalCashSales: number;
    totalCardSales: number;
    totalTransferSales: number;
    totalCreditSales?: number;
    totalIngresos: number;
    totalEgresos: number;
    closingSystem: number;
    closingDeclared: number;
    difference: number;
  };
}

/**
 * Sends clean HTML content directly to the browser print engine using a hidden iframe.
 * Avoids raw binary ESC/POS corruption and blank screen issues.
 */
export function printHtmlThermal(htmlContent: string): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute(
    'style',
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;'
  );
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    window.print();
    return;
  }

  doc.open();
  doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Ticket MiCuadre</title>
  <style>
    @page {
      margin: 0mm !important;
      size: auto;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      margin: 0;
      padding: 2mm 2.5mm 6mm 2.5mm;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.25;
      color: #000000;
      background: #ffffff;
      width: 48mm;
      max-width: 48mm;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .bold { font-weight: 800; }
    .title { font-size: 13px; font-weight: 800; text-transform: uppercase; }
    .subtitle { font-size: 11px; font-weight: 800; }
    .small { font-size: 9px; line-height: 1.2; }
    .divider { border-bottom: 1px dashed #000000; margin: 4px 0; }
    .double-divider { border-bottom: 2px dashed #000000; margin: 5px 0; }
    .row { display: flex; justify-content: space-between; align-items: baseline; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th, td { padding: 1px 0; vertical-align: top; }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.warn('Error al activar impresion en iframe:', e);
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 1500);
    }
  }, 250);
}

/**
 * Generates thermal receipt HTML for a Sale (Fiscal or Simple).
 */
export function generateSaleReceiptHtml(
  sale: Sale,
  tenant: Tenant,
  copyType: 'ORIGINAL' | 'COPIA' = 'ORIGINAL'
): string {
  const saleDate = new Date(sale.createdAt);
  const dateStr = saleDate.toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = saleDate.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' });

  if (sale.isFiscal) {
    const copyLabel = copyType === 'ORIGINAL'
      ? 'ORIGINAL: CLIENTE'
      : 'COPIA: OBLIGADO TRIBUTARIO EMISOR / SAR';

    const itemsRows = (sale.items || []).map(item => `
      <tr>
        <td style="width: 28px;">${item.quantity}x</td>
        <td style="text-align: left;">${item.name}</td>
        <td style="text-align: right; width: 48px;">${formatCurrency(item.total, '')}</td>
      </tr>
    `).join('');

    return `
      <div class="text-center">
        <div class="title">${tenant.name}</div>
        ${tenant.rtn ? `<div class="small">RTN: ${tenant.rtn}</div>` : ''}
        ${tenant.address ? `<div class="small">${tenant.address}</div>` : ''}
        ${tenant.phone ? `<div class="small">TEL: ${tenant.phone}</div>` : ''}
      </div>

      <div class="divider"></div>

      <div class="text-center">
        <div class="subtitle">FACTURA FISCAL</div>
        <div class="small bold">=== ${copyLabel} ===</div>
      </div>

      <div class="divider"></div>

      <div class="small">
        <div style="word-break: break-all;"><strong>CAI:</strong> ${sale.cai || 'N/A'}</div>
        <div><strong>FACTURA #:</strong> ${sale.documentNumber}</div>
        ${sale.caiDeadline ? `<div><strong>FECHA LIMITE:</strong> ${sale.caiDeadline}</div>` : ''}
        ${sale.caiRangeStart && sale.caiRangeEnd ? `<div><strong>RANGO:</strong> ${sale.caiRangeStart} AL ${sale.caiRangeEnd}</div>` : ''}
        <div><strong>FECHA:</strong> ${dateStr} ${timeStr}</div>
        <div><strong>CAJA:</strong> ${sale.cajaName || 'Caja 1'}</div>
        <div><strong>CLIENTE:</strong> ${sale.customerName}</div>
        ${sale.customerRtn ? `<div><strong>RTN CLIENTE:</strong> ${sale.customerRtn}</div>` : ''}
      </div>

      <div class="divider"></div>

      <table>
        <thead>
          <tr style="border-bottom: 1px solid #000; font-weight: 800;">
            <th style="text-align: left;">CANT</th>
            <th style="text-align: left;">DESCRIPCION</th>
            <th style="text-align: right;">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      <div class="divider"></div>

      <div class="small">
        <div class="row"><span>SUBTOTAL:</span><span>${formatCurrency(sale.subtotal, tenant.currencySymbol)}</span></div>
        ${sale.discountAmount > 0 ? `<div class="row"><span>DESCUENTO:</span><span>-${formatCurrency(sale.discountAmount, tenant.currencySymbol)}</span></div>` : ''}
        ${(sale.exemptAmount || 0) + (sale.exoneratedAmount || 0) > 0 ? `<div class="row"><span>EXENTO/EXONERADO:</span><span>${formatCurrency((sale.exemptAmount || 0) + (sale.exoneratedAmount || 0), tenant.currencySymbol)}</span></div>` : ''}
        ${sale.taxable15 > 0 ? `<div class="row"><span>GRAVADO 15%:</span><span>${formatCurrency(sale.taxable15, tenant.currencySymbol)}</span></div>` : ''}
        ${sale.tax15 > 0 ? `<div class="row"><span>ISV 15%:</span><span>${formatCurrency(sale.tax15, tenant.currencySymbol)}</span></div>` : ''}
        ${sale.taxable18 > 0 ? `<div class="row"><span>GRAVADO 18%:</span><span>${formatCurrency(sale.taxable18, tenant.currencySymbol)}</span></div>` : ''}
        ${sale.tax18 > 0 ? `<div class="row"><span>ISV 18%:</span><span>${formatCurrency(sale.tax18, tenant.currencySymbol)}</span></div>` : ''}
      </div>

      <div class="double-divider"></div>

      <div class="row bold" style="font-size: 13px;">
        <span>TOTAL A PAGAR:</span>
        <span>${formatCurrency(sale.total, tenant.currencySymbol)}</span>
      </div>

      <div class="row small" style="margin-top: 3px;">
        <span>FORMA DE PAGO:</span>
        <span class="bold">${sale.paymentMethod}</span>
      </div>

      <div class="divider"></div>

      <div class="text-center small" style="margin-top: 4px;">
        <div>"La factura es beneficio de todos, exijala."</div>
        <div class="bold">${copyLabel}</div>
        <div style="margin-top: 4px;">Gracias por su compra</div>
        <div style="font-size: 8px; color: #555; margin-top: 2px;">Sistema impulsado por MiCuadre.app</div>
      </div>
    `;
  }

  // MODO SIMPLE / TICKET DE VENTA (Mercadito / Comidas / Servicios)
  const itemsList = (sale.items || []).map(item => `
    <div class="row" style="margin-bottom: 2px;">
      <span style="flex: 1; text-align: left;">${item.quantity}x ${item.name}</span>
      <span style="width: 52px; text-align: right;" class="bold">${formatCurrency(item.total, '')}</span>
    </div>
  `).join('');

  return `
    <div class="text-center">
      <div class="title">${tenant.name}</div>
      ${tenant.phone ? `<div class="small">TEL: ${tenant.phone}</div>` : ''}
    </div>

    <div class="divider"></div>

    <div class="small">
      <div class="row">
        <span><strong>TICKET:</strong> ${sale.documentNumber}</span>
        <span>${dateStr} ${timeStr}</span>
      </div>
      ${sale.customerName && sale.customerName !== 'Consumidor Final' ? `<div><strong>CLIENTE:</strong> ${sale.customerName}</div>` : ''}
    </div>

    <div class="divider"></div>

    <div>
      ${itemsList}
    </div>

    <div class="divider"></div>

    <div class="small">
      ${sale.discountAmount > 0 ? `<div class="row"><span>DESCUENTO:</span><span>-${formatCurrency(sale.discountAmount, tenant.currencySymbol)}</span></div>` : ''}
      <div class="row bold" style="font-size: 13px; margin: 3px 0;">
        <span>TOTAL:</span>
        <span>${formatCurrency(sale.total, tenant.currencySymbol)}</span>
      </div>
      <div class="row">
        <span>PAGO:</span>
        <span>${sale.paymentMethod}</span>
      </div>
    </div>

    <div class="divider"></div>

    <div class="text-center small" style="margin-top: 6px;">
      <div>Gracias por su compra</div>
      <div style="font-size: 8px; color: #666; margin-top: 2px;">MiCuadre.app</div>
    </div>
  `;
}

/**
 * Generates thermal receipt HTML for Kitchen orders.
 */
export function generateKitchenTicketHtml(data: KitchenTicketData): string {
  const now = data.createdAt ? new Date(data.createdAt) : new Date();
  const timeStr = now.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit' });

  let destinationHeader = '';
  if (data.deliveryType === 'DINE_IN') {
    destinationHeader = data.tableNumber ? `MESA: ${data.tableNumber}` : 'COMEDOR / MESA';
  } else if (data.deliveryType === 'TAKE_OUT') {
    destinationHeader = `PARA LLEVAR #${data.orderNumber}`;
  } else {
    destinationHeader = `DOMICILIO #${data.orderNumber}`;
  }

  const itemsHtml = data.items.map(it => `
    <div style="margin-bottom: 5px;">
      <div class="bold" style="font-size: 13px;">[ ${it.quantity} ] ${it.name}</div>
      ${(it.extras || []).map(e => `
        <div class="small bold" style="padding-left: 10px;">+ EXTRA: ${e.name}</div>
      `).join('')}
      ${it.notes ? `
        <div class="small" style="padding-left: 10px; font-style: italic;">>> NOTA: ${it.notes}</div>
      ` : ''}
    </div>
    <div class="divider"></div>
  `).join('');

  return `
    <div class="text-center">
      <div class="title">*** ORDEN DE COCINA ***</div>
      <div class="divider"></div>
      <div class="bold" style="font-size: 14px; margin: 3px 0;">${destinationHeader}</div>
    </div>

    <div class="divider"></div>

    <div class="small">
      <div class="row">
        <span>HORA: ${timeStr}</span>
        <span>FECHA: ${dateStr}</span>
      </div>
      ${data.customerName && data.customerName !== 'Consumidor Final' ? `<div>CLIENTE: ${data.customerName}</div>` : ''}
      ${data.serverName ? `<div>MESERO: ${data.serverName}</div>` : ''}
    </div>

    <div class="double-divider"></div>

    <div>
      ${itemsHtml}
    </div>

    ${data.notes ? `
      <div class="small bold">NOTA GENERAL: ${data.notes}</div>
      <div class="divider"></div>
    ` : ''}

    <div class="text-center small bold" style="margin-top: 4px;">
      FIN DE COMANDA
    </div>
  `;
}

/**
 * Generates thermal receipt HTML for Credit Payment (Abono a Fiado).
 */
export function generatePaymentReceiptHtml(data: PaymentReceiptData): string {
  const { tenant, payment, prevBalance, newBalance } = data;
  const payDate = new Date(payment.createdAt);
  const dateStr = payDate.toLocaleDateString('es-HN');
  const timeStr = payDate.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' });

  return `
    <div class="text-center">
      <div class="title">${tenant.name}</div>
      ${tenant.rtn ? `<div class="small">RTN: ${tenant.rtn}</div>` : ''}
      ${tenant.address ? `<div class="small">${tenant.address}</div>` : ''}
      ${tenant.phone ? `<div class="small">TEL: ${tenant.phone}</div>` : ''}
    </div>

    <div class="divider"></div>

    <div class="text-center bold small">
      COMPROBANTE DE ABONO A FIADO
    </div>

    <div class="divider"></div>

    <div class="small">
      <div><strong>RECIBO #:</strong> ${payment.id}</div>
      <div><strong>FECHA:</strong> ${dateStr} ${timeStr}</div>
      <div><strong>CLIENTE:</strong> ${payment.customerName}</div>
      <div><strong>ATENDIDO POR:</strong> ${payment.createdBy}</div>
      <div><strong>FORMA PAGO:</strong> ${payment.paymentMethod}</div>
    </div>

    <div class="double-divider"></div>

    <div class="row bold" style="font-size: 13px;">
      <span>MONTO ABONADO:</span>
      <span>${formatCurrency(payment.amount, tenant.currencySymbol)}</span>
    </div>

    <div class="divider"></div>

    <div class="small">
      <div class="row">
        <span>Saldo Anterior:</span>
        <span>${formatCurrency(prevBalance, tenant.currencySymbol)}</span>
      </div>
      <div class="row bold" style="color: #000;">
        <span>Nuevo Saldo Pendiente:</span>
        <span>${formatCurrency(newBalance, tenant.currencySymbol)}</span>
      </div>
    </div>

    <div class="divider"></div>

    <div class="text-center small" style="font-size: 8px; color: #444; margin-top: 6px;">
      * Este comprobante respalda el abono realizado a su cuenta de credito. No constituye documento fiscal SAR. *
    </div>
  `;
}

/**
 * Generates thermal receipt HTML for Z-Report (Cierre de Caja).
 */
export function generateZReportHtml(data: ZReportPrintData): string {
  const { tenant, zReport, cajaName } = data;
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-HN');
  const timeStr = now.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' });

  return `
    <div class="text-center">
      <div class="title">${tenant.name}</div>
      <div class="subtitle" style="margin-top: 2px;">REPORTE DE CIERRE Z</div>
      <div class="small">${cajaName || 'Caja Registradora Principal'}</div>
      <div class="small">${dateStr} ${timeStr}</div>
    </div>

    <div class="divider"></div>

    <div class="small">
      <div class="row">
        <span>Apertura (Sencillo Inicial):</span>
        <span>${formatCurrency(zReport.openingAmount, tenant.currencySymbol)}</span>
      </div>
      <div class="row">
        <span>(+) Ventas Efectivo:</span>
        <span>${formatCurrency(zReport.totalCashSales, tenant.currencySymbol)}</span>
      </div>
      ${zReport.totalIngresos > 0 ? `
        <div class="row">
          <span>(+) Ingresos / Aportes Caja:</span>
          <span>${formatCurrency(zReport.totalIngresos, tenant.currencySymbol)}</span>
        </div>
      ` : ''}
      ${zReport.totalEgresos > 0 ? `
        <div class="row">
          <span>(-) Egresos / Gastos Caja:</span>
          <span>-${formatCurrency(zReport.totalEgresos, tenant.currencySymbol)}</span>
        </div>
      ` : ''}
    </div>

    <div class="divider"></div>

    <div class="small">
      <div class="row bold">
        <span>(=) Efectivo Esperado:</span>
        <span>${formatCurrency(zReport.closingSystem, tenant.currencySymbol)}</span>
      </div>
      <div class="row bold">
        <span>Declarado por Cajero:</span>
        <span>${formatCurrency(zReport.closingDeclared, tenant.currencySymbol)}</span>
      </div>
    </div>

    <div class="double-divider"></div>

    <div class="row bold" style="font-size: 13px;">
      <span>DIFERENCIA DE CAJA:</span>
      <span>${formatCurrency(zReport.difference, tenant.currencySymbol)}</span>
    </div>

    <div class="divider"></div>

    <div class="small">
      <div class="bold" style="margin-bottom: 2px;">CONTROL BANCARIO / OTRAS FORMAS:</div>
      <div class="row">
        <span>Ventas con Tarjeta:</span>
        <span>${formatCurrency(zReport.totalCardSales, tenant.currencySymbol)}</span>
      </div>
      <div class="row">
        <span>Ventas Transferencia:</span>
        <span>${formatCurrency(zReport.totalTransferSales, tenant.currencySymbol)}</span>
      </div>
      ${zReport.totalCreditSales !== undefined && zReport.totalCreditSales > 0 ? `
        <div class="row">
          <span>Ventas al Fiado / Credito:</span>
          <span>${formatCurrency(zReport.totalCreditSales, tenant.currencySymbol)}</span>
        </div>
      ` : ''}
    </div>

    <div class="divider"></div>

    <div class="text-center small" style="margin-top: 6px;">
      <div>*** CIERRE DE CAJA EXITOSO ***</div>
      <div style="font-size: 8px; color: #555; margin-top: 2px;">MiCuadre.app</div>
    </div>
  `;
}

/**
 * Convenient high-level helper to print a Sale receipt.
 */
export function printSaleReceipt(
  sale: Sale,
  tenant: Tenant,
  copyType: 'ORIGINAL' | 'COPIA' = 'ORIGINAL'
): void {
  const html = generateSaleReceiptHtml(sale, tenant, copyType);
  printHtmlThermal(html);
}

/**
 * Convenient high-level helper to print a Kitchen ticket.
 */
export function printKitchenTicket(data: KitchenTicketData): void {
  const html = generateKitchenTicketHtml(data);
  printHtmlThermal(html);
}

/**
 * Convenient high-level helper to print a Credit Payment receipt.
 */
export function printPaymentReceipt(data: PaymentReceiptData): void {
  const html = generatePaymentReceiptHtml(data);
  printHtmlThermal(html);
}

/**
 * Convenient high-level helper to print a Z-Report.
 */
export function printZReport(data: ZReportPrintData): void {
  const html = generateZReportHtml(data);
  printHtmlThermal(html);
}
