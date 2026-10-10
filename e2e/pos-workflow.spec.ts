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
      await expect(page.getByText(/tercera edad|adulto mayor/i)).toBeVisible();

      // 7. Close discount modal
      const closeBtn = page.locator('button:has(svg.lucide-x)').first();
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
});
