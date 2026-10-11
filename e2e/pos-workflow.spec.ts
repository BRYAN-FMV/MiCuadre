import { test, expect } from '@playwright/test';

test.describe('MiCuadre POS & Terminal E2E Workflows', () => {
  test('should load Landing Page at root path', async ({ page }) => {
    // 1. Visit root path
    await page.goto('/');

    // 2. Verify Landing page title and key branding
    await expect(page).toHaveTitle(/MiCuadre/i);
    await expect(page.getByText(/micuadre|punto de venta/i).first()).toBeVisible();
  });

  test('should load Store Access screen when store parameter is provided', async ({ page }) => {
    // 1. Visit store URL with store parameter
    await page.goto('/?comercio=demo');

    // 2. Verify store access or login screen elements
    await expect(page).toHaveTitle(/MiCuadre/i);

    // 3. Expect login, store header or profile input elements to be present
    const storeHeaderOrInput = page.getByText(/micuadre|tienda|usuario|pin|ingresar/i).first();
    await expect(storeHeaderOrInput).toBeVisible({ timeout: 10000 });
  });

  test('should display POS discount options and inventory adjustments modal when authenticated', async ({ page }) => {
    // 1. Pre-authenticate with local storage state
    await page.addInitScript(() => {
      window.localStorage.setItem('micuadre_app_state', JSON.stringify({
        state: {
          isAuthenticated: true,
          activeTab: 'pos'
        },
        version: 0
      }));
    });

    // 2. Navigate to POS
    await page.goto('/?comercio=demo');

    // 3. Verify POS is visible
    await expect(page.getByText(/punto de venta|carrito|total pagar/i).first()).toBeVisible({ timeout: 10000 });

    // 4. Click on an available product to add to cart
    const firstProduct = page.locator('.product-card').first();
    if (await firstProduct.isVisible()) {
      await firstProduct.click();
      
      // 5. Verify the "Descuento" button is enabled and click it
      const discountBtn = page.getByRole('button', { name: /descuento/i });
      await expect(discountBtn).toBeVisible();
      await discountBtn.click();

      // 6. Verify Discount Modal opens and shows Senior Citizen (25%) option
      await expect(page.getByText(/aplicar descuento al carrito/i)).toBeVisible();
      await expect(page.getByText(/tercera edad|adulto mayor/i).first()).toBeVisible();

      // 7. Close discount modal
      const closeBtn = page.getByRole('button', { name: /cerrar modal de descuento/i });
      await closeBtn.click();
    }

    // 8. Navigate to Inventory tab
    await page.locator('#nav-inventory').click();

    // 9. Verify Inventory page and Mermas & Ajustes button
    await expect(page.getByText(/inventario & catálogo|catálogo de productos/i).first()).toBeVisible();
    const mermasBtn = page.getByRole('button', { name: /mermas & ajustes/i });
    await expect(mermasBtn).toBeVisible();

    // 10. Click Mermas & Ajustes and verify audit modal opens
    await mermasBtn.click();
    await expect(page.getByText(/auditor[íi]a de mermas|registro de p[ée]rdidas/i).first()).toBeVisible();
  });

  test('should handle walk-in services in POS and schedule blocks in Services tab', async ({ page }) => {
    // 1. Pre-authenticate with local storage state
    await page.addInitScript(() => {
      window.localStorage.setItem('micuadre_app_state', JSON.stringify({
        state: {
          isAuthenticated: true,
          activeTab: 'pos'
        },
        version: 0
      }));
    });

    // 2. Navigate to POS
    await page.goto('/?comercio=demo');

    // 3. Verify POS is visible
    await expect(page.getByText(/punto de venta|carrito|total pagar/i).first()).toBeVisible({ timeout: 10000 });

    // 4. Switch to Services catalog in POS
    const servicesTabBtn = page.getByRole('button', { name: /servicios/i }).first();
    await expect(servicesTabBtn).toBeVisible();
    await servicesTabBtn.click();

    // 5. Check if service cards are shown
    const serviceCard = page.locator('.product-card').first();
    if (await serviceCard.isVisible()) {
      await serviceCard.click();

      // 6. Modal for staff assignment should appear
      await expect(page.getByText(/asignar colaborador/i)).toBeVisible();
      const addServiceBtn = page.getByRole('button', { name: /agregar al carrito/i });
      await expect(addServiceBtn).toBeVisible();
      await addServiceBtn.click();

      // 7. Verify line item in cart
      await expect(page.locator('.cart-item').first()).toBeVisible();
    }

    // 8. Navigate to Services tab in Sidebar
    const navServices = page.locator('#nav-services');
    await expect(navServices).toBeVisible();
    await navServices.click();

    // 9. Verify Services view loaded
    await expect(page.getByText(/servicios, citas & comisiones/i)).toBeVisible({ timeout: 10000 });

    // 10. Open New Appointment modal
    const newAppBtn = page.getByRole('button', { name: /nueva cita/i });
    await expect(newAppBtn).toBeVisible();
    await newAppBtn.click();

    // 11. Verify Schedule Block toggle exists and can be clicked
    const blockTabBtn = page.getByRole('button', { name: /bloqueo \/ no disponible/i });
    await expect(blockTabBtn).toBeVisible();
    await blockTabBtn.click();

    // 12. Verify schedule block fields
    await expect(page.getByText(/motivo del bloqueo/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /guardar bloqueo/i })).toBeVisible();

    // 13. Close modal
    await page.getByRole('button', { name: /cancelar/i }).click();
  });

  test('should support packaging presentations selection and adding to cart in POS', async ({ page }) => {
    // 1. Pre-authenticate with a product that has packaging presentations
    await page.addInitScript(() => {
      const demoTenantId = '00000000-0000-0000-0000-000000000001';
      window.localStorage.setItem('micuadre_app_state', JSON.stringify({
        state: {
          isAuthenticated: true,
          activeTab: 'pos',
          tenant: {
            id: demoTenantId,
            name: 'Comercio Demo',
            businessType: 'PULPERIA',
            isFiscalEnabled: false,
            isServicesEnabled: true,
            isWholesaleEnabled: true,
            allowNegativeStock: false,
            currencySymbol: 'L.'
          },
          products: [
            {
              id: 'prod-pack-test',
              tenantId: demoTenantId,
              sku: 'JABON-01',
              barcode: '7420001',
              name: 'Jabon Palmolive Suave',
              category: 'Higiene',
              unitOfMeasure: 'Unidad',
              costPrice: 15,
              salePrice: 20,
              currentStock: 25,
              minStockAlert: 5,
              taxClassification: 'EXENTO',
              isActive: true,
              presentations: [
                {
                  id: 'pres-pack-3',
                  name: 'Pack x3',
                  unitsCount: 3,
                  salePrice: 55,
                  barcode: '7420003'
                }
              ]
            }
          ]
        },
        version: 0
      }));
    });

    // 2. Navigate to POS
    await page.goto('/?comercio=demo');

    // 3. Verify product card is visible with packaging badge
    await expect(page.getByText('Jabon Palmolive Suave')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('+1 Empaque')).toBeVisible();

    // 4. Click the product card
    await page.getByText('Jabon Palmolive Suave').click();

    // 5. Verify presentation selector modal opens
    await expect(page.getByText(/seleccione el formato o empaque/i)).toBeVisible();
    await expect(page.getByText('1 Unidad Individual')).toBeVisible();
    await expect(page.getByRole('button', { name: /Pack x3/i })).toBeVisible();

    // 6. Select "Pack x3"
    await page.getByRole('button', { name: /Pack x3/i }).click();

    // 7. Verify modal closes and pack is added to cart
    await expect(page.getByText(/seleccione el formato o empaque/i)).not.toBeVisible();
    await expect(page.getByText(/Pack x3 \(3 unids\)/i)).toBeVisible();
    await expect(page.locator('.cart-item').first()).toBeVisible();
  });

  test('should prompt for Admin PIN when cashier without canApplyDiscounts attempts to apply discount, and apply it upon PIN entry', async ({ page }) => {
    const demoTenantId = '00000000-0000-0000-0000-000000000001';

    // 1. Initialize store state with Cashier lacking canApplyDiscounts and Admin with PIN 1234
    await page.addInitScript(({ tenantId }) => {
      window.localStorage.setItem('micuadre_app_state', JSON.stringify({
        state: {
          isAuthenticated: true,
          activeTab: 'pos',
          isShiftModalOpen: false,
          activeShift: {
            id: 'shift-open-001',
            tenantId,
            userId: 'cashier-test-id',
            userName: 'Cajero Sin Descuento',
            openingAmount: 500,
            status: 'OPEN',
            openedAt: new Date().toISOString()
          },
          tenant: {
            id: tenantId,
            name: 'Comercio Demo',
            businessType: 'PULPERIA',
            isFiscalEnabled: false,
            isServicesEnabled: true,
            isWholesaleEnabled: true,
            allowNegativeStock: false,
            currencySymbol: 'L.'
          },
          currentUser: {
            id: 'cashier-test-id',
            tenantId,
            fullName: 'Cajero Sin Descuento',
            role: 'CAJERO',
            pinCode: '2222',
            isActive: true,
            permissions: {
              canApplyDiscounts: false,
              canSellCredit: false,
              canVoidSales: false,
              canViewCostPrices: false,
              canEditCatalog: false,
              canRegisterAdjustments: false
            }
          },
          profiles: [
            {
              id: 'admin-owner-id',
              tenantId,
              fullName: 'Admin Propietario',
              role: 'ADMIN',
              pinCode: '1234',
              isActive: true
            },
            {
              id: 'cashier-test-id',
              tenantId,
              fullName: 'Cajero Sin Descuento',
              role: 'CAJERO',
              pinCode: '2222',
              isActive: true,
              permissions: {
                canApplyDiscounts: false
              }
            }
          ],
          products: [
            {
              id: 'prod-disc-item',
              tenantId,
              sku: 'PROD-DISC',
              name: 'Arroz Precocido 1lb',
              category: 'Granos',
              unitOfMeasure: 'Libra',
              costPrice: 12,
              salePrice: 18,
              currentStock: 50,
              minStockAlert: 5,
              taxClassification: 'EXENTO',
              isActive: true
            }
          ]
        },
        version: 0
      }));
    }, { tenantId: demoTenantId });

    // 2. Navigate to POS
    await page.goto('/?comercio=demo');

    // 3. Add product to cart
    await expect(page.getByText('Arroz Precocido 1lb')).toBeVisible({ timeout: 10000 });
    await page.getByText('Arroz Precocido 1lb').click();
    await expect(page.locator('.cart-item').first()).toBeVisible();

    // 4. Click Descuento button
    const discountBtn = page.getByRole('button', { name: /descuento/i });
    await expect(discountBtn).toBeVisible();
    await discountBtn.click();

    // 5. Verify Admin PIN modal is displayed
    await expect(page.getByText(/autorizar descuento/i).first()).toBeVisible();
    await expect(page.getByPlaceholder('••••')).toBeVisible();

    // 6. Enter valid Admin PIN 1234 using numeric keypad buttons
    await page.getByRole('button', { name: '1', exact: true }).click();
    await page.getByRole('button', { name: '2', exact: true }).click();
    await page.getByRole('button', { name: '3', exact: true }).click();
    await page.getByRole('button', { name: '4', exact: true }).click();

    // 7. Click Autorizar
    const authorizeBtn = page.getByRole('button', { name: /autorizar/i });
    await expect(authorizeBtn).toBeEnabled();
    await authorizeBtn.click();

    // 8. Verify Admin PIN modal is dismissed and Discount Modal opens
    await expect(page.getByText(/autorizar descuento/i)).not.toBeVisible();
    await expect(page.getByText(/aplicar descuento al carrito/i)).toBeVisible();

    // 9. Apply senior citizen discount
    const seniorDiscountBtn = page.getByText(/tercera edad|adulto mayor/i).first();
    await expect(seniorDiscountBtn).toBeVisible();
    await seniorDiscountBtn.click();

    // 10. Verify discount applied in cart
    await expect(page.getByText(/descuento/i).first()).toBeVisible();
  });

  test('should mask purchase costs with *** for cashiers without canViewCostPrices, and unmask when authorized via Admin PIN', async ({ page }) => {
    const demoTenantId = '00000000-0000-0000-0000-000000000001';

    // 1. Initialize store state with Cashier lacking canViewCostPrices
    await page.addInitScript(({ tenantId }) => {
      window.localStorage.setItem('micuadre_app_state', JSON.stringify({
        state: {
          isAuthenticated: true,
          activeTab: 'inventory',
          isShiftModalOpen: false,
          activeShift: {
            id: 'shift-open-002',
            tenantId,
            userId: 'cashier-test-id',
            userName: 'Cajero Inventario',
            openingAmount: 500,
            status: 'OPEN',
            openedAt: new Date().toISOString()
          },
          tenant: {
            id: tenantId,
            name: 'Comercio Demo',
            businessType: 'PULPERIA',
            isFiscalEnabled: false,
            isServicesEnabled: true,
            isWholesaleEnabled: true,
            allowNegativeStock: false,
            currencySymbol: 'L.'
          },
          currentUser: {
            id: 'cashier-test-id',
            tenantId,
            fullName: 'Cajero Inventario',
            role: 'CAJERO',
            pinCode: '3333',
            isActive: true,
            permissions: {
              canViewCostPrices: false,
              canEditCatalog: false,
              canRegisterAdjustments: false
            }
          },
          profiles: [
            {
              id: 'admin-owner-id',
              tenantId,
              fullName: 'Admin Propietario',
              role: 'ADMIN',
              pinCode: '1234',
              isActive: true
            },
            {
              id: 'cashier-test-id',
              tenantId,
              fullName: 'Cajero Inventario',
              role: 'CAJERO',
              pinCode: '3333',
              isActive: true,
              permissions: {
                canViewCostPrices: false
              }
            }
          ],
          products: [
            {
              id: 'prod-cost-test',
              tenantId,
              sku: 'COST-001',
              name: 'Aceite Vegetal 750ml',
              category: 'Abarrotes',
              unitOfMeasure: 'Unidad',
              costPrice: 42.50,
              salePrice: 55.00,
              currentStock: 15,
              minStockAlert: 3,
              taxClassification: 'EXENTO',
              isActive: true
            }
          ]
        },
        version: 0
      }));
    }, { tenantId: demoTenantId });

    // 2. Navigate to store (starts on Inventory tab)
    await page.goto('/?comercio=demo');

    // 3. Verify product row is visible in inventory
    await expect(page.getByText('Aceite Vegetal 750ml')).toBeVisible({ timeout: 10000 });

    // 4. Verify cost price is masked with ***
    await expect(page.getByText('***').first()).toBeVisible();

    // 5. Verify Desbloquear Costos button is present
    const unlockBtn = page.getByRole('button', { name: /desbloquear costos/i });
    await expect(unlockBtn).toBeVisible();

    // 6. Click Desbloquear Costos
    await unlockBtn.click();

    // 7. Verify Admin PIN modal is displayed
    await expect(page.getByText(/autorizaci[oó]n para ver costos/i)).toBeVisible();

    // 8. Enter Admin PIN 1234
    await page.getByRole('button', { name: '1', exact: true }).click();
    await page.getByRole('button', { name: '2', exact: true }).click();
    await page.getByRole('button', { name: '3', exact: true }).click();
    await page.getByRole('button', { name: '4', exact: true }).click();

    // 9. Submit authorization
    await page.getByRole('button', { name: /autorizar/i }).click();

    // 10. Verify Admin PIN modal closes and real cost price is now displayed
    await expect(page.getByText(/autorizaci[oó]n para ver costos/i)).not.toBeVisible();
    await expect(page.getByText(/L\.\s*42\.50/i)).toBeVisible();

    // 11. Verify button toggles to Ocultar Costos
    await expect(page.getByRole('button', { name: /ocultar costos/i })).toBeVisible();
  });
});
