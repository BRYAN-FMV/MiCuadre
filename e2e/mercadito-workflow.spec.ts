import { test, expect } from '@playwright/test';

test.describe('Flujo de Trabajo Integral - Mercadito Local', () => {
  const mercaditoTenantId = 'tenant-mercadito-001';

  test.beforeEach(async ({ page }) => {
    // 1. Configurar estado inicial simulado de un mercadito completo
    await page.addInitScript(({ tenantId }) => {
      window.localStorage.setItem('micuadre_assigned_caja_id', 'caja-01');
      window.localStorage.setItem('micuadre_app_state', JSON.stringify({
        state: {
          isAuthenticated: true,
          activeTab: 'pos',
          isShiftModalOpen: false,
          activeShift: null, // Cajas cerradas al inicio del dia
          shiftHistory: [],
          tenant: {
            id: tenantId,
            name: 'Mercadito La Bendicion',
            businessType: 'PULPERIA',
            isFiscalEnabled: false,
            isServicesEnabled: false,
            isWholesaleEnabled: true,
            isLoyaltyEnabled: false,
            allowNegativeStock: false,
            currencySymbol: 'L.'
          },
          currentUser: {
            id: 'admin-jose-01',
            tenantId,
            fullName: 'Don Jose Propietario',
            role: 'ADMIN',
            pinCode: '1234',
            isActive: true
          },
          profiles: [
            {
              id: 'admin-jose-01',
              tenantId,
              fullName: 'Don Jose Propietario',
              role: 'ADMIN',
              pinCode: '1234',
              isActive: true
            },
            {
              id: 'cajera-maria-02',
              tenantId,
              fullName: 'Maria Cajera',
              role: 'CAJERO',
              pinCode: '2222',
              isActive: true,
              permissions: {
                canApplyDiscounts: true,
                canSellCredit: true,
                canVoidSales: true,
                canOpenDrawerNoSale: true,
                canViewCostPrices: true,
                canEditCatalog: true,
                canRegisterAdjustments: true
              }
            }
          ],
          fiscalRanges: [
            {
              id: 'caja-01',
              tenantId,
              name: 'Caja 1 - Principal',
              prefix: '000-001-01-',
              rangeStart: 1,
              rangeEnd: 5000,
              currentNumber: 100,
              deadline: '2026-12-31',
              documentType: '01',
              isActive: true,
              isDefault: true
            },
            {
              id: 'caja-02',
              tenantId,
              name: 'Caja 2 - Pasillo',
              prefix: '000-002-01-',
              rangeStart: 1,
              rangeEnd: 5000,
              currentNumber: 50,
              deadline: '2026-12-31',
              documentType: '01',
              isActive: true,
              isDefault: false
            }
          ],
          selectedFiscalRangeId: 'caja-01',
          fiscalRange: {
            id: 'caja-01',
            tenantId,
            name: 'Caja 1 - Principal',
            prefix: '000-001-01-',
            rangeStart: 1,
            rangeEnd: 5000,
            currentNumber: 100,
            deadline: '2026-12-31',
            documentType: '01',
            isActive: true,
            isDefault: true
          },
          suppliers: [
            {
              id: 'supp-valle-01',
              tenantId,
              companyName: 'Distribuidora Alimentos del Valle',
              rtn: '08011990123456',
              contactName: 'Carlos Distribuidor',
              phone: '9988-7766',
              isActive: true
            }
          ],
          products: [
            {
              id: 'prod-arroz-01',
              tenantId,
              sku: 'ARR-01',
              barcode: '74200001',
              name: 'Arroz Progreso 1lb',
              category: 'Granos Basicos',
              unitOfMeasure: 'Libra',
              costPrice: 12.00,
              salePrice: 18.00,
              currentStock: 40,
              minStockAlert: 5,
              taxClassification: 'EXENTO',
              isActive: true
            },
            {
              id: 'prod-leche-02',
              tenantId,
              sku: 'LEC-01',
              barcode: '74200002',
              name: 'Leche Sula Entera 1L',
              category: 'Lacteos',
              unitOfMeasure: 'Litro',
              costPrice: 26.00,
              salePrice: 34.00,
              currentStock: 20,
              minStockAlert: 5,
              taxClassification: 'EXENTO',
              isActive: true
            },
            {
              id: 'prod-jabon-03',
              tenantId,
              sku: 'JAB-01',
              barcode: '74200003',
              name: 'Jabon Palmolive Suave',
              category: 'Higiene',
              unitOfMeasure: 'Unidad',
              costPrice: 15.00,
              salePrice: 20.00,
              currentStock: 30,
              minStockAlert: 5,
              taxClassification: 'EXENTO',
              isActive: true,
              presentations: [
                {
                  id: 'pres-pack-3',
                  name: 'Pack x3',
                  unitsCount: 3,
                  salePrice: 55.00,
                  barcode: '74200003-P3'
                }
              ]
            }
          ],
          funds: [
            {
              id: 'fund-caja-chica',
              tenantId,
              name: 'Caja Chica Emergencias',
              type: 'CAJA_CHICA',
              balance: 1500.00,
              isActive: true
            }
          ],
          expenses: [],
          cashMovements: [],
          sales: [],
          purchaseInvoices: []
        },
        version: 0
      }));
    }, { tenantId: mercaditoTenantId });
  });

  test('debe ejecutar con exito el ciclo completo de un mercadito: abrir 2 cajas, ventas, devolucion, compras, gastos y arqueo', async ({ page }) => {
    test.setTimeout(90000);

    // 2. Cargar la aplicacion en el POS del comercio
    await page.goto('/?comercio=mercadito');
    await expect(page).toHaveTitle(/MiCuadre/i);

    // =========================================================================
    // ETAPA 1: APERTURA DE 2 CAJAS (Caja 1 y Caja 2)
    // =========================================================================
    // Verificar que estamos en el POS y Caja 1 esta seleccionada pero cerrada
    await expect(page.getByText('Caja 1 - Principal', { exact: true })).toBeVisible({ timeout: 10000 });
    const abrirCajaBtn = page.getByRole('button', { name: /abrir turno|abrir caja/i }).first();
    await expect(abrirCajaBtn).toBeVisible();
    await abrirCajaBtn.click();

    // Modal de apertura: abrir Caja 1 con L. 500.00
    await expect(page.getByText(/apertura de turno de caja/i)).toBeVisible();
    const openingInput = page.locator('input[type="number"]').first();
    await openingInput.fill('500.00');
    await page.getByRole('button', { name: /abrir caja registradora/i }).click();

    // Confirmar que Caja 1 quedo abierta
    await expect(page.getByText(/apertura de turno de caja/i)).not.toBeVisible();
    await expect(page.getByRole('button', { name: /arqueo & cierre z/i })).toBeVisible();

    // Cambiar a Caja 2 usando el boton de configuracion de terminal
    const switchCajaBtn = page.getByTitle(/cambiar caja asignada a esta pc/i);
    await expect(switchCajaBtn).toBeVisible();
    await switchCajaBtn.click();

    // Verificar que la terminal cambio a Caja 2 y muestra que no tiene turno abierto
    await expect(page.getByText('Caja 2 - Pasillo', { exact: true })).toBeVisible();
    const abrirCaja2Btn = page.getByRole('button', { name: /abrir turno|abrir caja/i }).first();
    await expect(abrirCaja2Btn).toBeVisible();
    await abrirCaja2Btn.click();

    // Modal de apertura: abrir Caja 2 con L. 300.00
    await expect(page.getByText(/apertura de turno de caja/i)).toBeVisible();
    await page.locator('input[type="number"]').first().fill('300.00');
    await page.getByRole('button', { name: /abrir caja registradora/i }).click();

    // Verificar que Caja 2 quedo abierta
    await expect(page.getByText(/apertura de turno de caja/i)).not.toBeVisible();
    await expect(page.getByRole('button', { name: /arqueo & cierre z/i })).toBeVisible();

    // =========================================================================
    // ETAPA 2: REALIZAR VENTAS EN EL MERCADITO (UNIDADES Y EMPAQUES)
    // =========================================================================
    // Agregar 2 libras de Arroz Progreso
    await expect(page.getByText('Arroz Progreso 1lb')).toBeVisible();
    const arrozCard = page.locator('.product-card', { hasText: 'Arroz Progreso 1lb' });
    await arrozCard.click();
    await arrozCard.click(); // 2 unidades

    // Agregar Jabon Palmolive en empaque "Pack x3"
    await expect(page.getByText('Jabon Palmolive Suave')).toBeVisible();
    const jabonCard = page.locator('.product-card', { hasText: 'Jabon Palmolive Suave' });
    await jabonCard.click();

    // Selector de empaque / presentacion
    await expect(page.getByText(/seleccione el formato o empaque/i)).toBeVisible();
    const pack3Btn = page.getByRole('button', { name: /pack x3/i });
    await expect(pack3Btn).toBeVisible();
    await pack3Btn.click();

    // Verificar lineas en el carrito: Arroz x2 y Pack x3
    await expect(page.locator('.cart-item')).toHaveCount(2);
    await expect(page.getByText(/pack x3 \(3 unids\)/i)).toBeVisible();

    // Iniciar cobro de la venta (F12)
    const cobrarBtn = page.getByRole('button', { name: /cobrar venta/i });
    await expect(cobrarBtn).toBeVisible();
    await cobrarBtn.click();

    // Modal de pago
    await expect(page.getByText(/total a cobrar/i)).toBeVisible();
    const exactoBtn = page.getByRole('button', { name: /exacto/i });
    await expect(exactoBtn).toBeVisible();
    await exactoBtn.click();

    // Confirmar pago y emitir comprobante
    const confirmarVentaBtn = page.getByRole('button', { name: /confirmar & facturar/i });
    await expect(confirmarVentaBtn).toBeVisible();
    await confirmarVentaBtn.click();

    // Comprobante termico emitido con exito
    await expect(page.getByText(/venta realizada/i)).toBeVisible();
    await page.getByRole('button', { name: /cerrar ventana/i }).click();
    await expect(page.getByText(/venta realizada/i)).not.toBeVisible();

    // =========================================================================
    // ETAPA 3: REALIZAR DEVOLUCIONES / REEMBOLSOS
    // =========================================================================
    // Navegar a Reportes / Historial de Ventas
    await page.locator('#nav-reports').click();
    await expect(page.getByText(/reportes & inteligencia comercial/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('1. Dinero que Entró (Ventas Netas)')).toBeVisible();
    await expect(page.getByText('2. Costo de la Mercadería')).toBeVisible();
    await expect(page.getByText('3. Gastos del Negocio')).toBeVisible();
    await expect(page.getByText('4. Ganancia Libre Estimada')).toBeVisible();

    // Buscar la venta en la tabla y abrir el detalle
    const verDetalleBtn = page.getByRole('button', { name: /ver/i }).first();
    await expect(verDetalleBtn).toBeVisible();
    await verDetalleBtn.click();

    // En el detalle de la factura, iniciar devolucion
    await expect(page.getByText(/detalle de venta:/i)).toBeVisible();
    const devolucionBtn = page.getByRole('button', { name: /devolucion \/ cambio/i });
    await expect(devolucionBtn).toBeVisible();
    await devolucionBtn.click();

    // Modal de devolucion: especificar motivo y procesar
    await expect(page.getByText(/devolucion o cambio de producto/i)).toBeVisible();
    const motivoInput = page.getByPlaceholder(/producto en mal estado/i);
    await expect(motivoInput).toBeVisible();
    await motivoInput.fill('Cliente devuelve empaque dañado de fabrica');

    const procesarDevolucionBtn = page.getByRole('button', { name: /procesar devolucion/i });
    await expect(procesarDevolucionBtn).toBeVisible();
    await procesarDevolucionBtn.click();

    // Verificar alerta de devolucion procesada
    await expect(page.getByText('DEVOLUCION PROCESADA')).toBeVisible();
    // Cerrar modal de detalle de venta
    await page.getByRole('button', { name: 'Cerrar detalle' }).click();
    await expect(page.getByText(/detalle de venta:/i)).not.toBeVisible();

    // =========================================================================
    // ETAPA 4: REGISTRAR COMPRA DE PROVEEDORES
    // =========================================================================
    // Navegar a Compras
    await page.locator('#nav-purchases').click();
    await expect(page.getByText(/compras, gastos operativos & gestión de fondos/i)).toBeVisible({ timeout: 10000 });

    // Abrir modal de nueva compra
    const registrarCompraBtn = page.getByRole('button', { name: /registrar compra/i });
    await expect(registrarCompraBtn).toBeVisible();
    await registrarCompraBtn.click();

    // Llenar datos de la factura del proveedor
    const purchaseModal = page.locator('.modal-content');
    await expect(purchaseModal.getByText(/ingresar factura de compra/i)).toBeVisible();
    
    // Seleccionar proveedor del dropdown dentro del modal
    const supplierInput = purchaseModal.getByPlaceholder(/buscar proveedor por empresa/i);
    await supplierInput.fill('Distribuidora');
    await purchaseModal.getByText('Distribuidora Alimentos del Valle').click();

    await purchaseModal.getByPlaceholder('000-002-01-00045120').fill('FAC-98421');

    // Buscar y agregar producto recibido (Leche Sula)
    const productSearchInput = purchaseModal.getByPlaceholder('Escanear código o buscar nombre...');
    await productSearchInput.fill('Leche');
    await purchaseModal.getByText('Leche Sula Entera 1L').click();

    // Ingresar cantidad y costo de compra
    await purchaseModal.getByPlaceholder('Cant.').fill('15');
    await purchaseModal.getByPlaceholder('Costo Compra').fill('25.00');
    await purchaseModal.getByRole('button', { name: /\+ agregar/i }).click();

    // Guardar compra del proveedor
    const guardarCompraSubmitBtn = purchaseModal.locator('button[type="submit"]:has-text("Registrar Compra")');
    await expect(guardarCompraSubmitBtn).toBeVisible();
    await guardarCompraSubmitBtn.click();

    // Verificar que la factura aparece en la tabla
    await expect(page.getByText('FAC-98421', { exact: true })).toBeVisible();

    // =========================================================================
    // ETAPA 5: REGISTRAR GASTOS OPERATIVOS DEL MERCADITO
    // =========================================================================
    // Cambiar a subpestaña Gastos Operativos
    const gastosTabBtn = page.getByRole('button', { name: /gastos operativos/i });
    await expect(gastosTabBtn).toBeVisible();
    await gastosTabBtn.click();

    // Abrir modal de gasto operativo
    const registrarGastoBtn = page.getByRole('button', { name: /registrar gasto operativo/i });
    await expect(registrarGastoBtn).toBeVisible();
    await registrarGastoBtn.click();

    // Llenar formulario de gasto (compra de bolsas plasticas y cloro)
    const expenseModal = page.locator('.modal-content');
    await expect(expenseModal.getByText(/registrar gasto operativo/i)).toBeVisible();
    await expenseModal.getByPlaceholder(/compra de cloro/i).fill('Compra de bolsas para despacho y cloro');
    await expenseModal.getByPlaceholder('0.00').fill('85.00');

    // Guardar gasto
    const guardarGastoSubmitBtn = expenseModal.getByRole('button', { name: /guardar gasto/i });
    await expect(guardarGastoSubmitBtn).toBeVisible();
    await guardarGastoSubmitBtn.click();

    // Verificar que el gasto aparece en la tabla de egresos
    await expect(page.getByText('Compra de bolsas para despacho y cloro', { exact: true })).toBeVisible();

    // =========================================================================
    // ETAPA 6: GESTION INTEGRAL DE INVENTARIO, EMPAQUES, MAYOREO Y MERMAS
    // =========================================================================
    // Navegar al modulo de Inventario
    await page.locator('#nav-inventory').click();
    await expect(page.getByText(/inventario & catálogo de productos/i)).toBeVisible({ timeout: 10000 });

    // 6.1 Verificar que la compra del proveedor en la Etapa 4 incremento el stock de Leche Sula de 20 a 35
    const lecheRow = page.locator('tr', { hasText: 'Leche Sula Entera 1L' });
    await expect(lecheRow).toBeVisible();
    await expect(lecheRow.getByText('35 Litro')).toBeVisible();

    // 6.2 Crear un nuevo producto con Escala de Mayoreo y Presentacion de Empaque
    const nuevoProdBtn = page.getByRole('button', { name: /nuevo producto/i });
    await expect(nuevoProdBtn).toBeVisible();
    await nuevoProdBtn.click();

    await expect(page.getByText('Agregar Nuevo Producto')).toBeVisible();
    const productForm = page.locator('form', { hasText: 'Datos Básicos' });

    await productForm.getByPlaceholder('Ej. Harina Maseca 1kg').fill('Galleta Maria Gamesa');
    await productForm.getByPlaceholder('Ej. MAS-001').fill('GAL-01');
    await productForm.getByPlaceholder('Escanear o digitar...').fill('74200099');

    await productForm.locator('.form-group', { hasText: 'Costo CPP' }).locator('input').fill('10.00');
    await productForm.locator('.form-group', { hasText: 'Precio de Venta' }).locator('input').fill('15.00');
    await productForm.locator('.form-group', { hasText: 'Stock Actual' }).locator('input').fill('48');
    await productForm.locator('.form-group', { hasText: 'Alerta Mínima' }).locator('input').fill('10');

    // Agregar escala de precio por mayoreo
    await productForm.getByRole('button', { name: /\+ agregar escala/i }).click();
    await productForm.getByPlaceholder('Mín. Cant.').fill('12');
    await productForm.getByPlaceholder('Precio Unit.').fill('13.50');
    await productForm.getByPlaceholder('Nombre Escala').fill('Docena');

    // Agregar presentacion de empaque (Paquete x6)
    await productForm.getByRole('button', { name: /\+ agregar empaque/i }).click();
    await productForm.getByPlaceholder('Nombre (ej: Pack x3)').fill('Paquete x6');
    await productForm.getByPlaceholder('Contiene (ej: 3)').fill('6');
    await productForm.getByPlaceholder(/Precio \(/i).fill('80.00');

    await productForm.getByRole('button', { name: /crear producto/i }).click();

    // Verificar que el nuevo producto aparece en la tabla con su stock, desglose de empaques y escala de mayoreo
    const galletaRow = page.locator('tr', { hasText: 'Galleta Maria Gamesa' });
    await expect(galletaRow).toBeVisible();
    await expect(galletaRow.getByText('48 Unidad')).toBeVisible();
    await expect(galletaRow.getByText('8 Paquete x6')).toBeVisible();
    await expect(galletaRow.getByText('1 Escalas')).toBeVisible();

    // 6.3 Editar el producto existente en el catalogo
    await galletaRow.locator('button[title="Editar Producto"]').click();
    await expect(page.getByText('Editar Producto')).toBeVisible();
    const editForm = page.locator('form', { hasText: 'Datos Básicos' });
    await editForm.getByPlaceholder('Ej. Harina Maseca 1kg').fill('Galleta Maria Gamesa Especial');
    await editForm.getByRole('button', { name: /guardar cambios/i }).click();

    const galletaEditadaRow = page.locator('tr', { hasText: 'Galleta Maria Gamesa Especial' });
    await expect(galletaEditadaRow).toBeVisible();

    // 6.4 Registrar Merma / Ajuste de Inventario (3 unidades danadas)
    await galletaEditadaRow.locator('button[title="Registrar Merma / Ajuste"]').click();
    await expect(page.getByText(/registrar ajuste \/ merma de inventario/i)).toBeVisible();

    const adjustmentForm = page.locator('form', { hasText: 'Cantidad a Rebajar del Inventario' });
    await adjustmentForm.locator('select').selectOption('MERMA_DANADO');
    await adjustmentForm.locator('input[type="number"]').fill('3');
    await adjustmentForm.getByPlaceholder(/fruta en mal estado/i).fill('3 paquetes individuales con empaque roto en estante');
    await adjustmentForm.getByRole('button', { name: /confirmar rebaja/i }).click();

    // Verificar que el stock se redujo de 48 a 45 y el desglose de empaque se actualizo a "7 Paquete x6 + 3 sueltas"
    await expect(galletaEditadaRow.getByText('45 Unidad')).toBeVisible();
    await expect(galletaEditadaRow.getByText('7 Paquete x6 + 3 sueltas')).toBeVisible();

    // 6.5 Inspeccionar el Kardex de Movimientos del producto
    await galletaEditadaRow.locator('button[title="Ver Kardex"]').click();
    await expect(page.getByText('Kardex de Movimientos')).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(page.getByText('Kardex de Movimientos')).not.toBeVisible();

    // 6.6 Verificar el Historial de Auditoria de Mermas y Ajustes
    const mermasHistoryBtn = page.getByRole('button', { name: /mermas & ajustes/i });
    await expect(mermasHistoryBtn).toBeVisible();
    await mermasHistoryBtn.click();

    await expect(page.getByText(/auditoria de mermas, vencidos & ajustes de stock/i)).toBeVisible();
    await expect(page.getByText('3 paquetes individuales con empaque roto en estante')).toBeVisible();
    await expect(page.getByText('-3', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(page.getByText(/auditoria de mermas, vencidos & ajustes de stock/i)).not.toBeVisible();

    // 6.7 Probar filtros rapidos de inventario (Mayoreo y Buscador por Codigo de Barras)
    const filtroMayoreoBtn = page.getByRole('button', { name: /mayoreo \(1\)/i });
    await expect(filtroMayoreoBtn).toBeVisible();
    await filtroMayoreoBtn.click();
    await expect(galletaEditadaRow).toBeVisible();

    const filtroTodosBtn = page.getByRole('button', { name: /todos \(4\)/i });
    await filtroTodosBtn.click();
    await expect(page.locator('tr', { hasText: 'Arroz Progreso 1lb' })).toBeVisible();

    const searchInventoryInput = page.getByPlaceholder('Buscar por Nombre, SKU o Barcode...');
    await searchInventoryInput.fill('74200099');
    await expect(galletaEditadaRow).toBeVisible();
    await expect(page.locator('tr', { hasText: 'Arroz Progreso 1lb' })).not.toBeVisible();
    await searchInventoryInput.fill('');
    await expect(page.locator('tr', { hasText: 'Arroz Progreso 1lb' })).toBeVisible();

    // 6.8 Verificar modal de confirmacion de eliminacion de producto
    await galletaEditadaRow.locator('button[title="Eliminar Producto"]').click();
    await expect(page.getByText('¿Eliminar Producto?')).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByText('¿Eliminar Producto?')).not.toBeVisible();

    // =========================================================================
    // ETAPA 7 (Y MÁS): MOVIMIENTO EN GAVETA & ARQUEO CIEGO / CIERRE Z
    // =========================================================================
    // Abrir modal de turno / arqueo desde la barra lateral
    const arqueoSidebarBtn = page.getByRole('button', { name: /arqueo & cierre z/i });
    await expect(arqueoSidebarBtn).toBeVisible();
    await arqueoSidebarBtn.click();

    // Cambiar a pestaña de movimiento (+/- Entrada & Retiro)
    const shiftModal = page.locator('.modal-content');
    const movTabBtn = shiftModal.getByRole('button', { name: /entrada & retiro/i });
    await expect(movTabBtn).toBeVisible();
    await movTabBtn.click();

    // Registrar ingreso de sencillo adicional
    await shiftModal.locator('select').selectOption('ENTRADA');
    await shiftModal.locator('input[type="number"]').fill('100.00');
    await shiftModal.getByPlaceholder(/aporte inicial/i).fill('Ingreso de sencillo adicional de monedas');
    await shiftModal.getByRole('button', { name: /registrar movimiento/i }).click();

    // Al guardar movimiento, la UI regresa automaticamente a la pestaña CLOSE
    await expect(shiftModal.getByText(/arqueo ciego & cierre z/i)).toBeVisible();
    // Ingresar efectivo contado en gaveta y ejecutar Cierre Z
    const cashCountedInput = shiftModal.locator('input[type="number"]').first();
    await expect(cashCountedInput).toBeVisible();
    await cashCountedInput.fill('315.00');
    await shiftModal.getByRole('button', { name: /cerrar turno & generar reporte z/i }).click();

    // Verificar que el Reporte Z se despliega con el desglose financiero del turno
    await expect(page.getByText(/reporte consolidado cierre z/i)).toBeVisible();
    await expect(page.getByText(/diferencia de caja/i)).toBeVisible();
    const finalizarBtn = page.getByRole('button', { name: /finalizar & salir/i });
    await expect(finalizarBtn).toBeVisible();
    await finalizarBtn.click();
  });
});
