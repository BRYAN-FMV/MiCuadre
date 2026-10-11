# Granular Staff Permissions & Instant Admin PIN Authorization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement granular cashier/staff permissions with instant Administrator PIN authorization (Mechanism B) across POS operations (discounts, credit sales, voids), Inventory visibility (cost masking, catalog editing, adjustments), and staff profile settings.

**Architecture:** Extend `UserProfile` with optional `permissions: UserPermissions`. Provide a reusable `AdminPinModal` that validates PINs against any active tenant `ADMIN`. Integrate authorization gates in POS, Inventory, and Settings, persisting permissions in Zustand and Supabase.

**Tech Stack:** React 19, TypeScript, Zustand, Tailwind CSS, Lucide icons, Vitest, Playwright, Supabase.

**Spec:** docs/superpowers/specs/2026-10-11-granular-staff-permissions-and-admin-pin-auth.md

## Global Constraints
- Zero emojis in code, UI text, commit messages, or chat.
- All unit tests (`npm test`) and E2E tests (`npx playwright test`) must pass before completion.
- TypeScript build (`tsc -b && vite build`) must succeed with zero errors.

## Review Focus
1. An admin user must never be prompted for a PIN to execute any action.
2. A cashier without `canApplyDiscounts` must see the Admin PIN modal when attempting to apply a discount, and applying the discount succeeds immediately once a valid admin PIN is entered.
3. A cashier without `canSellCredit` must see the Admin PIN modal when selecting credit/fiado payment in POS.
4. A cashier without `canViewCostPrices` must see `***` instead of numerical purchase costs and profit margins in the inventory view, with an option to unlock costs via Admin PIN.
5. Entering an incorrect Admin PIN displays an error toast and does not execute the protected action.

---

### Task 1: Permissions Types and Store Profile Updates

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/store/useAppStore.ts`
- Modify: `src/store/useAppStore.test.ts`

- [x] Add `UserPermissions` interface to `src/types/index.ts` with fields: `canApplyDiscounts`, `canSellCredit`, `canVoidSales`, `canOpenDrawerNoSale`, `canViewCostPrices`, `canEditCatalog`, `canRegisterAdjustments`.
- [x] Add `permissions?: UserPermissions` to `UserProfile` in `src/types/index.ts`.
- [x] Add helper function `hasUserPermission(user: UserProfile, permission: keyof UserPermissions): boolean` in `src/store/useAppStore.ts`.
- [x] Add `updateProfilePermissions` action in `useAppStore.ts` to update permissions for a profile.
- [x] Write unit tests in `src/store/useAppStore.test.ts` verifying permission checks (Admin always true; Cashier respects configured booleans and defaults to false).
- [x] Run `npm test` and verify tests pass.

---

### Task 2: Reusable Admin PIN Authorization Modal

**Files:**
- Create: `src/components/common/AdminPinModal.tsx`

- [x] Create `AdminPinModal.tsx` with properties: `isOpen`, `title`, `actionDescription`, `onSuccess: (admin: UserProfile) => void`, `onCancel: () => void`.
- [x] Implement secure PIN input (4 digits, numeric keypad on screen + physical keyboard support).
- [x] Validate PIN against all active profiles where `role === 'ADMIN'` for the current tenant.
- [x] Display clean error message when incorrect PIN is entered.
- [x] Call `onSuccess(matchedAdmin)` and close on success.
- [x] Run `npm test` to verify zero compile or runtime regressions.

---

### Task 3: POS Enforcement with Admin PIN Authorization

**Files:**
- Modify: `src/components/pos/PosContainer.tsx`

- [x] Wrap discount button and senior discount application with `hasUserPermission(currentUser, 'canApplyDiscounts')`. If false, trigger `AdminPinModal`.
- [x] Wrap credit / fiado payment method selection with `hasUserPermission(currentUser, 'canSellCredit')`. If false, trigger `AdminPinModal`.
- [x] Wrap ticket voiding action with `hasUserPermission(currentUser, 'canVoidSales')`. If false, trigger `AdminPinModal`.
- [x] Run `npm test` and verify zero regressions.

---

### Task 4: Inventory Cost Masking and Action Protection

**Files:**
- Modify: `src/components/inventory/InventoryManager.tsx`

- [x] Check `hasUserPermission(currentUser, 'canViewCostPrices')` and session unlock state: mask `costPrice` and `margin` with `***` in product table if not permitted.
- [x] Add "Desbloquear Costos" action in inventory toolbar that prompts for Admin PIN to reveal costs for the current session.
- [x] Guard "Nuevo Producto" and product edit actions with `hasUserPermission(currentUser, 'canEditCatalog')`. If false, trigger `AdminPinModal`.
- [x] Guard "Mermas & Ajustes" with `hasUserPermission(currentUser, 'canRegisterAdjustments')`. If false, trigger `AdminPinModal`.
- [x] Run `npm test` and verify zero regressions.

---

### Task 5: Staff Profile Permissions UI and Supabase Persistence

**Files:**
- Modify: `src/components/settings/SettingsView.tsx`
- Modify: `src/lib/supabaseService.ts`
- Modify: `supabase/migration_add_missing_tenant_columns.sql`

- [x] In `SettingsView.tsx`, add permissions toggle switch panel when creating or editing cashier/staff profiles.
- [x] In `supabaseService.ts`, persist and retrieve `permissions` on `profiles` table.
- [x] In `supabase/migration_add_missing_tenant_columns.sql`, add column `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;`.
- [x] Run `npm test` and `npm run build` to verify clean build.

---

### Task 6: End-to-End Verification with Playwright

**Files:**
- Modify: `e2e/pos-workflow.spec.ts`

- [x] Add an E2E test verifying that a cashier without discount permission is prompted for Admin PIN, and entering the Admin PIN successfully applies the discount.
- [x] Add an E2E test verifying cost price masking in inventory for cashier accounts.
- [x] Run `npx playwright test` and verify all tests pass.
- [x] Commit and push to repository.
