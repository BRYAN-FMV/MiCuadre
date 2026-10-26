import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  backupTenantLogo, 
  getStoredTenantLogo, 
  backupTenantPrePrintLogo, 
  getStoredTenantPrePrintLogo,
  saveTenantToSupabase
} from './supabaseService';
import { useAppStore } from '../store/useAppStore';
import { Tenant } from '../types';
import * as supabaseModule from './supabase';

describe('Multi-tenant Logo Persistence and Fallback Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.getState().resetToDefaultData();
    vi.restoreAllMocks();
  });

  it('should backup and retrieve logos isolated by tenantId', () => {
    const tenant1Id = '11111111-1111-1111-1111-111111111111';
    const tenant2Id = '22222222-2222-2222-2222-222222222222';
    const logo1 = 'data:image/webp;base64,LOGO_TENANT_1';
    const logo2 = 'data:image/webp;base64,LOGO_TENANT_2';

    backupTenantLogo(tenant1Id, logo1);
    backupTenantLogo(tenant2Id, logo2);

    expect(getStoredTenantLogo(tenant1Id)).toBe(logo1);
    expect(getStoredTenantLogo(tenant2Id)).toBe(logo2);
    expect(localStorage.getItem('micuadre_logo_global')).toBeNull();
  });

  it('should remove tenant logo correctly when undefined or empty is passed', () => {
    const tenantId = '11111111-1111-1111-1111-111111111111';
    const logo = 'data:image/webp;base64,LOGO_DATA';

    backupTenantLogo(tenantId, logo);
    expect(getStoredTenantLogo(tenantId)).toBe(logo);

    backupTenantLogo(tenantId, undefined);
    expect(getStoredTenantLogo(tenantId)).toBeUndefined();
  });

  it('should recover logo from persisted zustand app state if direct key is missing', () => {
    const tenantId = '33333333-3333-3333-3333-333333333333';
    const logo = 'data:image/webp;base64,PERSISTED_STATE_LOGO';

    const simulatedAppState = {
      state: {
        tenant: {
          id: tenantId,
          name: 'Bodeguita Prueba',
          logoUrl: logo
        },
        tenants: []
      }
    };
    localStorage.setItem('micuadre_app_state', JSON.stringify(simulatedAppState));

    // Direct key does not exist yet
    expect(localStorage.getItem(`micuadre_logo_${tenantId}`)).toBeNull();

    // getStoredTenantLogo should recover it from state fallback
    const recovered = getStoredTenantLogo(tenantId);
    expect(recovered).toBe(logo);
  });

  it('should save preprint logo preferences per tenant', () => {
    const tenantId = '44444444-4444-4444-4444-444444444444';
    backupTenantPrePrintLogo(tenantId, true);
    expect(getStoredTenantPrePrintLogo(tenantId)).toBe(true);

    backupTenantPrePrintLogo(tenantId, false);
    expect(getStoredTenantPrePrintLogo(tenantId)).toBe(false);
  });

  it('should retain logo_url in Supabase upsert fallback when pre_print_logo_on_feed fails due to missing column', async () => {
    const mockTenant: Tenant = {
      id: '55555555-5555-5555-5555-555555555555',
      name: 'Tienda Test',
      businessType: 'RETAIL',
      isFiscalEnabled: false,
      allowNegativeStock: false,
      currencySymbol: 'L.',
      logoUrl: 'data:image/webp;base64,VALID_LOGO',
      ticketPaperWidth: '58mm',
      prePrintLogoOnFeed: true
    };

    let callCount = 0;
    const capturedPayloads: any[] = [];

    // Mock supabase client
    const mockUpsert = vi.fn().mockImplementation((payload: any) => {
      callCount++;
      capturedPayloads.push(payload);
      if (callCount === 1) {
        // First call fails because pre_print_logo_on_feed column does not exist
        return Promise.resolve({ error: { message: "column 'pre_print_logo_on_feed' of relation 'tenants' does not exist" } });
      }
      // Second call (fallback) succeeds
      return Promise.resolve({ error: null });
    });

    const mockFrom = vi.fn().mockReturnValue({
      upsert: mockUpsert
    });

    vi.spyOn(supabaseModule, 'isSupabaseConfigured').mockReturnValue(true);
    // @ts-ignore
    vi.spyOn(supabaseModule.supabase, 'from').mockImplementation(mockFrom);

    const success = await saveTenantToSupabase(mockTenant);
    expect(success).toBe(true);
    expect(callCount).toBe(2);

    // Verify first call attempted with pre_print_logo_on_feed
    expect(capturedPayloads[0].pre_print_logo_on_feed).toBe(true);
    expect(capturedPayloads[0].logo_url).toBe(mockTenant.logoUrl);

    // Verify fallback call RETAINED logo_url and ticket_paper_width without dropping them
    expect(capturedPayloads[1].logo_url).toBe(mockTenant.logoUrl);
    expect(capturedPayloads[1].ticket_paper_width).toBe('58mm');
    expect(capturedPayloads[1].pre_print_logo_on_feed).toBeUndefined();
  });

  it('should update tenant logo in store and backup simultaneously', () => {
    const store = useAppStore.getState();
    const testLogo = 'data:image/webp;base64,NEW_TEST_LOGO';

    store.updateTenantSettings({ logoUrl: testLogo });

    const updated = useAppStore.getState().tenant;
    expect(updated.logoUrl).toBe(testLogo);
    expect(getStoredTenantLogo(updated.id)).toBe(testLogo);
  });
});
