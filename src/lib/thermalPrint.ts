import { Sale, Tenant, PrintPaperFormat } from '../types';
import { formatCurrency, numberToSpanishWords, formatPaymentMethod } from './monetary';
import { KitchenTicketData } from './escPos';
import { getStoredTenantTicketPaperWidth } from './supabaseService';

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
export function printHtmlThermal(
  htmlContent: string,
  paperWidth: PrintPaperFormat = '58mm'
): void {
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

  const isLetter = paperWidth === 'CARTA';
  const isHalfLetter = paperWidth === 'MEDIA_CARTA';
  const isStandardSheet = isLetter || isHalfLetter;
  const is80mm = paperWidth === '80mm';

  let pageCss = '';
  let bodyCss = '';

  if (isLetter) {
    pageCss = '@page { size: letter portrait; margin: 20mm 20mm 15mm 20mm; }';
    bodyCss = `
      margin: 0 auto;
      padding: 4mm 4mm 0 4mm;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 11px;
      line-height: 1.35;
      color: #0f172a;
      background: #ffffff;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    `;
  } else if (isHalfLetter) {
    pageCss = '@page { size: 5.5in 8.5in portrait; margin: 15mm 15mm 10mm 15mm; }';
    bodyCss = `
      margin: 0 auto;
      padding: 3mm 3mm 0 3mm;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 10px;
      line-height: 1.3;
      color: #0f172a;
      background: #ffffff;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    `;
  } else {
    const ticketWidth = is80mm ? '72mm' : '48mm';
    const padding = is80mm ? '4mm 4mm 8mm 6.5mm' : '4mm 3mm 8mm 6mm';
    const fontSize = is80mm ? '13px' : '11px';
    pageCss = `
      @page {
        margin: 0mm !important;
        size: auto;
      }
      html, body {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    `;
    bodyCss = `
      margin: 0;
      padding: ${padding};
      font-family: Arial, Helvetica, sans-serif;
      font-size: ${fontSize};
      font-weight: 600;
      line-height: 1.25;
      color: #000000;
      background: #ffffff;
      width: ${ticketWidth};
      max-width: ${ticketWidth};
      box-sizing: border-box;
      word-wrap: break-word;
      overflow-wrap: break-word;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    `;
  }

  doc.open();
  doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Factura / Comprobante</title>
  <style>
    ${pageCss}
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      ${bodyCss}
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .bold { font-weight: 800; }
    .title { font-size: ${is80mm ? '16px' : '13px'}; font-weight: 800; text-transform: uppercase; }
    .subtitle { font-size: ${is80mm ? '13px' : '11px'}; font-weight: 800; }
    .small { font-size: ${is80mm ? '11px' : '9.5px'}; line-height: 1.25; }
    .divider { border-bottom: 1px dashed #000000; margin: 4px 0; }
    .double-divider { border-bottom: 2px dashed #000000; margin: 5px 0; }
    .row { display: flex; justify-content: space-between; align-items: baseline; gap: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: ${is80mm ? '12px' : '10px'}; }
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
        <span class="bold">${formatPaymentMethod(sale.paymentMethod, true)}</span>
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
        <span>${formatPaymentMethod(sale.paymentMethod, true)}</span>
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
      <div><strong>FORMA PAGO:</strong> ${formatPaymentMethod(payment.paymentMethod, true)}</div>
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

    <div class="row bold" style="font-size: 11.5px;">
      <span>DIFERENCIA DE CAJA:</span>
      <span style="white-space: nowrap;">${formatCurrency(zReport.difference, tenant.currencySymbol)}</span>
    </div>

    <div class="divider"></div>

    <div class="small">
      <div class="bold" style="font-size: 10px; margin-bottom: 2px;">CONTROL BANCARIO / OTRAS FORMAS:</div>
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
 * Generates full Carta (Letter) or Media Carta (Statement / Half-Letter) invoice HTML,
 * fully compliant with SAR Honduras (Acuerdo 481-2017) and executive commercial invoices.
 */
export function generateInvoiceLetterHtml(
  sale: Sale,
  tenant: Tenant,
  copyType: 'ORIGINAL' | 'COPIA' = 'ORIGINAL',
  isHalfLetter = false
): string {
  const saleDate = new Date(sale.createdAt);
  const dateStr = saleDate.toLocaleDateString('es-HN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const timeStr = saleDate.toLocaleTimeString('es-HN', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const currency = tenant.currencySymbol || 'L';
  const currencyWord = currency === '$' ? 'DOLARES' : 'LEMPIRAS';
  const amountInWords = numberToSpanishWords(sale.total, currencyWord);

  const copyLabel = copyType === 'ORIGINAL'
    ? 'ORIGINAL: CLIENTE'
    : 'COPIA: OBLIGADO TRIBUTARIO EMISOR / SAR';

  const docTitle = sale.isFiscal ? 'FACTURA' : 'COMPROBANTE DE VENTA';

  const itemsRows = (sale.items || []).map((item) => {
    const unitPrice = item.unitPrice ?? item.originalUnitPrice ?? 0;
    const discount = item.discountAmount ? formatCurrency(item.discountAmount, '') : '-';
    return `
      <tr>
        <td style="text-align: center; width: 45px; border-bottom: 1px solid #e2e8f0; padding: 6px 8px;">${item.quantity}</td>
        <td style="text-align: left; border-bottom: 1px solid #e2e8f0; padding: 6px 8px;">
          <div style="font-weight: 600; color: #0f172a;">${item.name}</div>
          ${item.sku ? `<div style="font-size: 8.5px; color: #64748b;">CÓD: ${item.sku}</div>` : ''}
        </td>
        <td style="text-align: right; width: 95px; border-bottom: 1px solid #e2e8f0; padding: 6px 8px;">${formatCurrency(unitPrice, '')}</td>
        <td style="text-align: right; width: 85px; border-bottom: 1px solid #e2e8f0; padding: 6px 8px;">${discount}</td>
        <td style="text-align: right; width: 105px; border-bottom: 1px solid #e2e8f0; padding: 6px 8px; font-weight: 700;">${formatCurrency(item.total, '')}</td>
      </tr>
    `;
  }).join('');

  const scaleFactorClass = isHalfLetter ? 'half-letter' : 'full-letter';

  return `
    <div class="invoice-letter-container ${scaleFactorClass}" style="width: 100%; box-sizing: border-box; padding: 4px 4px 0 4px; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: ${isHalfLetter ? '10px' : '11px'}; line-height: 1.35;">
      
      <!-- HEADER -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px;">
        <!-- Left: Business Info -->
        <div style="flex: 1;">
          <div style="font-size: ${isHalfLetter ? '16px' : '20px'}; font-weight: 900; text-transform: uppercase; color: #0f172a; letter-spacing: -0.5px;">
            ${tenant.name}
          </div>
          <div style="margin-top: 3px; font-size: ${isHalfLetter ? '9.5px' : '10.5px'}; color: #334155;">
            <div><strong>RTN:</strong> ${tenant.rtn || 'N/A'}</div>
            ${tenant.address ? `<div><strong>Dirección:</strong> ${tenant.address}</div>` : ''}
            ${tenant.phone ? `<div><strong>Teléfono:</strong> ${tenant.phone}</div>` : ''}
            ${tenant.email ? `<div><strong>Correo:</strong> ${tenant.email}</div>` : ''}
          </div>
        </div>

        <!-- Right: Invoice Metadata Box -->
        <div style="min-width: ${isHalfLetter ? '240px' : '280px'}; border: 1.5px solid #0f172a; border-radius: 6px; padding: 8px 12px; background: #f8fafc; text-align: center;">
          <div style="font-size: ${isHalfLetter ? '13px' : '15px'}; font-weight: 900; color: #0f172a; text-transform: uppercase;">
            ${docTitle}
          </div>
          <div style="font-size: 8.5px; font-weight: 700; color: #475569; margin-top: 1px;">
            ${sale.isFiscal ? copyLabel : 'DOCUMENTO NO FISCAL'}
          </div>
          <div style="font-size: ${isHalfLetter ? '12px' : '14px'}; font-weight: 800; color: #0f172a; margin-top: 4px; letter-spacing: 0.5px;">
            N° ${sale.documentNumber}
          </div>

          ${sale.isFiscal ? `
            <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #cbd5e1; font-size: 8px; text-align: left; line-height: 1.25; color: #1e293b;">
              <div style="word-break: break-all;"><strong>CAI:</strong> ${sale.cai || 'N/A'}</div>
              <div><strong>Fecha Límite Emisión:</strong> ${sale.caiDeadline || 'N/A'}</div>
              ${sale.caiRangeStart && sale.caiRangeEnd ? `<div><strong>Rango Autorizado:</strong> ${sale.caiRangeStart} AL ${sale.caiRangeEnd}</div>` : ''}
            </div>
          ` : ''}
        </div>
      </div>

      <!-- CUSTOMER & SALE INFO GRID -->
      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; font-size: ${isHalfLetter ? '9.5px' : '10.5px'};">
        <div>
          <div><strong>Cliente / Razón Social:</strong> ${sale.customerName || 'Consumidor Final'}</div>
          <div><strong>RTN / Identificación:</strong> ${sale.customerRtn || 'Consumidor Final'}</div>
          <div><strong>Caja / Sucursal:</strong> ${sale.cajaName || 'Caja Principal'}</div>
        </div>
        <div>
          <div><strong>Fecha Emisión:</strong> ${dateStr}</div>
          <div><strong>Hora:</strong> ${timeStr}</div>
          <div><strong>Forma de Pago:</strong> <span style="font-weight: 700;">${formatPaymentMethod(sale.paymentMethod, true)}</span></div>
        </div>
      </div>

      <!-- ITEMS TABLE -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: ${isHalfLetter ? '9px' : '10.5px'};">
        <thead>
          <tr style="background: #0f172a; color: #ffffff;">
            <th style="padding: 6px 8px; text-align: center; border-radius: 4px 0 0 0;">CANT</th>
            <th style="padding: 6px 8px; text-align: left;">DESCRIPCIÓN</th>
            <th style="padding: 6px 8px; text-align: right;">PRECIO UNIT.</th>
            <th style="padding: 6px 8px; text-align: right;">DESCUENTO</th>
            <th style="padding: 6px 8px; text-align: right; border-radius: 0 4px 0 0;">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      <!-- TOTALS & EXONERATION DETAILS -->
      <div style="display: flex; gap: 15px; align-items: flex-start; margin-bottom: 14px;">
        <!-- Left: In Words & Exemptions Box -->
        <div style="flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; background: #ffffff;">
          <div style="font-weight: 700; color: #0f172a; margin-bottom: 4px; font-size: ${isHalfLetter ? '9.5px' : '10.5px'};">
            ${amountInWords}
          </div>

          ${sale.isFiscal ? `
            <div style="font-size: 8px; color: #475569; border-top: 1px dashed #cbd5e1; padding-top: 5px; margin-top: 5px; line-height: 1.4;">
              <div>N° Constancia Registro Exonerado: ______________________________</div>
              <div>N° Identificativo Registro SAG: __________________________________</div>
              <div>N° Correlativo Orden Compra Exenta: _____________________________</div>
            </div>
            <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #0f172a; font-weight: 800; font-size: 9px; text-align: center; color: #0f172a;">
              "LA FACTURA ES BENEFICIO DE TODOS, EXÍJALA"
            </div>
          ` : `
            <div style="font-size: 8.5px; color: #64748b; margin-top: 6px;">
              Gracias por su preferencia. Este comprobante acredita la venta de los productos o servicios detallados.
            </div>
          `}
        </div>

        <!-- Right: Tax Breakdown & Total -->
        <div style="width: ${isHalfLetter ? '240px' : '270px'}; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; background: #f8fafc; font-size: ${isHalfLetter ? '9px' : '10px'};">
          <div style="display: flex; justify-content: space-between; padding: 1.5px 0;">
            <span>Subtotal:</span>
            <span>${formatCurrency(sale.subtotal, currency)}</span>
          </div>
          ${sale.discountAmount > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 1.5px 0; color: #b91c1c;">
              <span>Descuentos y Rebajas:</span>
              <span>-${formatCurrency(sale.discountAmount, currency)}</span>
            </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; padding: 1.5px 0;">
            <span>Importe Exonerado:</span>
            <span>${formatCurrency(sale.exoneratedAmount || 0, currency)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 1.5px 0;">
            <span>Importe Exento:</span>
            <span>${formatCurrency(sale.exemptAmount || 0, currency)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 1.5px 0;">
            <span>Importe Gravado 15%:</span>
            <span>${formatCurrency(sale.taxable15 || 0, currency)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 1.5px 0;">
            <span>ISV 15%:</span>
            <span>${formatCurrency(sale.tax15 || 0, currency)}</span>
          </div>
          ${sale.taxable18 > 0 || sale.tax18 > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 1.5px 0;">
              <span>Importe Gravado 18%:</span>
              <span>${formatCurrency(sale.taxable18 || 0, currency)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 1.5px 0;">
              <span>ISV 18%:</span>
              <span>${formatCurrency(sale.tax18 || 0, currency)}</span>
            </div>
          ` : ''}

          <div style="display: flex; justify-content: space-between; border-top: 1.5px solid #0f172a; margin-top: 5px; padding-top: 5px; font-weight: 900; font-size: ${isHalfLetter ? '12px' : '13px'}; color: #0f172a;">
            <span>TOTAL A PAGAR:</span>
            <span>${formatCurrency(sale.total, currency)}</span>
          </div>
        </div>
      </div>

      <!-- SIGNATURES BLOCK -->
      <div style="display: flex; justify-content: space-around; gap: 20px; margin-top: 20px; padding-top: 10px; font-size: 8.5px; text-align: center; color: #475569;">
        <div style="flex: 1; max-width: 200px;">
          <div style="border-bottom: 1px solid #94a3b8; height: 26px; margin-bottom: 3px;"></div>
          <div style="font-weight: 700; color: #1e293b;">Entregado Conforme</div>
          <div>Firma Vendedor / Despacho</div>
        </div>
        <div style="flex: 1; max-width: 200px;">
          <div style="border-bottom: 1px solid #94a3b8; height: 26px; margin-bottom: 3px;"></div>
          <div style="font-weight: 700; color: #1e293b;">Recibido Conforme</div>
          <div>Firma y Nombre del Cliente</div>
        </div>
      </div>

      <!-- FOOTER -->
      <div style="margin-top: 12px; text-align: center; font-size: 7.5px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 4px;">
        Documento generado y respaldado por MiCuadre.app
      </div>

    </div>
  `;
}

/**
 * Convenient high-level helper to print a Sale receipt.
 * Automatically chooses between Thermal Ticket and Full/Half Letter based on configuration or override.
 */
export function printSaleReceipt(
  sale: Sale,
  tenant: Tenant,
  copyType: 'ORIGINAL' | 'COPIA' = 'ORIGINAL',
  overrideFormat?: PrintPaperFormat
): void {
  const format: PrintPaperFormat =
    overrideFormat ||
    tenant.ticketPaperWidth ||
    getStoredTenantTicketPaperWidth(tenant?.id) ||
    '58mm';
  if (format === 'CARTA' || format === 'MEDIA_CARTA') {
    const html = generateInvoiceLetterHtml(sale, tenant, copyType, format === 'MEDIA_CARTA');
    printHtmlThermal(html, format);
  } else {
    const html = generateSaleReceiptHtml(sale, tenant, copyType);
    printHtmlThermal(html, format);
  }
}

/**
 * High-level helper explicitly for printing full or half-letter invoices.
 */
export function printSaleInvoiceLetter(
  sale: Sale,
  tenant: Tenant,
  copyType: 'ORIGINAL' | 'COPIA' = 'ORIGINAL',
  format: 'CARTA' | 'MEDIA_CARTA' = 'CARTA'
): void {
  printSaleReceipt(sale, tenant, copyType, format);
}

/**
 * Convenient high-level helper to print a Kitchen ticket.
 */
export function printKitchenTicket(
  data: KitchenTicketData,
  paperWidth: '58mm' | '80mm' = '58mm'
): void {
  const html = generateKitchenTicketHtml(data);
  printHtmlThermal(html, paperWidth);
}

/**
 * Convenient high-level helper to print a Credit Payment receipt.
 */
export function printPaymentReceipt(data: PaymentReceiptData): void {
  const html = generatePaymentReceiptHtml(data);
  const width = data.tenant?.ticketPaperWidth || getStoredTenantTicketPaperWidth(data.tenant?.id) || '58mm';
  printHtmlThermal(html, width);
}

/**
 * Convenient high-level helper to print a Z-Report.
 */
export function printZReport(data: ZReportPrintData): void {
  const html = generateZReportHtml(data);
  const width = data.tenant?.ticketPaperWidth || getStoredTenantTicketPaperWidth(data.tenant?.id) || '58mm';
  printHtmlThermal(html, width);
}
