# Product Packaging Presentations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow products to define packaging presentations (e.g. Pack x3, Fardo x24, Caja x12) with custom barcodes and prices, sellable in POS with automatic base-unit inventory deduction and purchase integration.

**Architecture:** Extend `Product` with `presentations: ProductPresentation[]`, enhance `CartLine` with `unitsPerPackage`, update POS barcode scanner and touch-selection to choose presentation, adjust `processSale` to deduct `quantity * unitsPerPackage` from stock, and add packaging support in inventory and purchases.

**Tech Stack:** React 19, TypeScript, Zustand, Tailwind CSS, Lucide icons, Vitest, Playwright, Supabase.

**Spec:** docs/superpowers/specs/2026-10-10-product-packaging-presentations-design.md

## Global Constraints
- Zero emojis in code, UI text, commit messages, or chat.
- All unit tests (`npm test`) and E2E tests (`npx playwright test`) must pass before completion.
- TypeScript build (`tsc -b && vite build`) must succeed with zero errors.

## Review Focus
1. When selling a pack (e.g. Pack x3 with quantity 2), verify exactly 6 base units are deducted from stock.
2. When scanning a presentation barcode, verify the presentation is added directly without prompting.
3. When tapping a product with no presentations, verify it adds immediately to cart without opening an unnecessary modal.
4. When a product has negative stock disabled, verify stock check accounts for `quantity * unitsPerPackage`.
5. When registering a purchase invoice with a pack of 3, verify 3x units are added to inventory.

---

### Task 1: Types and Store Business Logic

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/store/useAppStore.ts`
- Modify: `src/store/useAppStore.test.ts`

- [x] Add `ProductPresentation` interface to `src/types/index.ts`.
- [x] Add `presentations?: ProductPresentation[]` to `Product`.
- [x] Add `presentationId?: string`, `presentationName?: string`, and `unitsPerPackage?: number` to `CartLine` and `PurchaseInvoiceItem`.
- [x] Update `addToCart` in `useAppStore.ts` to accept optional `presentation?: ProductPresentation` parameter.
- [x] Update `processSale` in `useAppStore.ts` to deduct `line.quantity * (line.unitsPerPackage || 1)` from `product.currentStock`.
- [x] Update Kardex movement logging to record packaging presentation name when sold.
- [x] Write unit tests in `src/store/useAppStore.test.ts` verifying that selling a packaging presentation deducts multiplied units and records the presentation.
- [x] Run `npm test` and verify tests pass.

---

### Task 2: Inventory Manager UI for Presentations

**Files:**
- Modify: `src/components/inventory/InventoryManager.tsx`

- [x] Add UI in product creation/edit modal to configure presentations (Name, Units Count, Sale Price, Cost Price, Barcode).
- [x] Add visual helper badge on inventory table showing pack conversion equivalence (e.g. `35 Unidades (11 packs y 2 sueltas)`).
- [x] Run `npm test` and verify zero regressions.

---

### Task 3: POS Quick Presentation Selector and Barcode Matcher

**Files:**
- Modify: `src/components/pos/PosContainer.tsx`

- [x] In `handleBarcodeScanned`, check if scanned code matches a presentation barcode. If matched, add presentation to cart directly.
- [x] In product grid / search, if product has presentations, open a clean presentation selection modal with large touch buttons.
- [x] Display presentation tag in cart line item (e.g. `[Pack x3]`).
- [x] Run `npm test` and verify zero regressions.

---

### Task 4: Purchases and Supabase Persistence Support

**Files:**
- Modify: `src/components/purchases/PurchaseManager.tsx`
- Modify: `src/lib/supabaseService.ts`
- Modify: `supabase/migration_add_missing_tenant_columns.sql`

- [x] In `PurchaseManager.tsx`, allow selecting a packaging presentation when adding items to a purchase invoice, multiplying received stock by `unitsPerPackage`.
- [x] In `supabaseService.ts`, ensure `presentations` field is serialized/deserialized when saving/loading products.
- [x] In `supabase/migration_add_missing_tenant_columns.sql`, add column `presentations JSONB DEFAULT '[]'::jsonb` to `products`.
- [x] Run `npm test` and `npm run build` to ensure clean compile.

---

### Task 5: End-to-End Verification with Playwright

**Files:**
- Modify: `e2e/pos-workflow.spec.ts`

- [x] Add an E2E test verifying packaging presentation selection and sale in the POS.
- [x] Run `npx playwright test` and verify all tests pass.
- [x] Commit and push to repository.
