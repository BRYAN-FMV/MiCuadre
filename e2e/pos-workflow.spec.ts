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
});
