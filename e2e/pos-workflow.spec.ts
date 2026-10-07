import { test, expect } from '@playwright/test';

test.describe('MiCuadre POS & Terminal E2E Workflows', () => {
  test('should load application and render main navigation tabs', async ({ page }) => {
    // 1. Visit application root
    await page.goto('/');

    // 2. Verify page document title or root header element
    await expect(page).toHaveTitle(/MiCuadre|POS/i);

    // 3. Verify main navigation bar elements
    const posNavBtn = page.getByRole('button', { name: /punto de venta|pos/i });
    const invNavBtn = page.getByRole('button', { name: /inventario/i });
    const purchasesNavBtn = page.getByRole('button', { name: /compras/i });

    await expect(posNavBtn).toBeVisible();
    await expect(invNavBtn).toBeVisible();
    await expect(purchasesNavBtn).toBeVisible();
  });

  test('should navigate seamlessly between tabs', async ({ page }) => {
    await page.goto('/');

    // Click Inventario Tab
    const invBtn = page.getByRole('button', { name: /inventario/i });
    await invBtn.click();

    // Verify inventory section is rendered
    await expect(page.getByText(/catálogo de productos|inventario/i)).toBeVisible();

    // Click Compras & Gastos Tab
    const purchasesBtn = page.getByRole('button', { name: /compras/i });
    await purchasesBtn.click();

    // Verify purchases manager section is rendered
    await expect(page.getByText(/facturas de compra|gastos operativos/i)).toBeVisible();
  });
});
