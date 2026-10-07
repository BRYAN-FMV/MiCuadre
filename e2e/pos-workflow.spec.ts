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
});
