import { supabase, isSupabaseConfigured } from './supabase';
import { Product, Sale, CartLine, PurchaseInvoice, Supplier, Service, Tenant, FiscalRange, UserProfile, CashShift, CashMovement, Expense, ProductPresentation, ProductPriceType, UserPermissions, MenuItem, DeliveryDriver, FoodOrder, Staff, Appointment, ServiceSupply, PrintPaperFormat } from '../types';
import { INITIAL_PRODUCTS, INITIAL_SUPPLIERS } from './mockData';
import { isValidUUID, normalizeSlug, generateUUID } from './security';
import { useAppStore } from '../store/useAppStore';
import { toast } from 'sonner';

/**
 * LocalStorage Fallback Helpers for Schema Extensions (presentations & permissions)
 * Prevents loss of packaging presentations and permissions if Supabase columns have not been migrated yet.
 */
export function backupProductPresentations(tenantId: string, productId: string, presentations: ProductPresentation[]) {
  if (typeof localStorage === 'undefined') return;
  try {
    const key = `micuadre_presentations_${tenantId}`;
    const raw = localStorage.getItem(key);
    const map = raw ? JSON.parse(raw) : {};
    map[productId] = presentations;
    localStorage.setItem(key, JSON.stringify(map));
  } catch (e) {
    // Ignore storage quota errors
  }
}

export function getStoredPresentations(tenantId: string, productId: string): ProductPresentation[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const key = `micuadre_presentations_${tenantId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const map = JSON.parse(raw);
    return Array.isArray(map[productId]) ? map[productId] : [];
  } catch (e) {
    return [];
  }
}

export function backupProductPriceTypes(tenantId: string, productId: string, priceTypes: ProductPriceType[]) {
  if (typeof localStorage === 'undefined') return;
  try {
    const key = `micuadre_pricetypes_${tenantId}`;
    const raw = localStorage.getItem(key);
    const map = raw ? JSON.parse(raw) : {};
    map[productId] = priceTypes;
    localStorage.setItem(key, JSON.stringify(map));
  } catch (e) {
    // Ignore storage quota errors
  }
}

export function getStoredPriceTypes(tenantId: string, productId: string): ProductPriceType[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const key = `micuadre_pricetypes_${tenantId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const map = JSON.parse(raw);
    return Array.isArray(map[productId]) ? map[productId] : [];
  } catch (e) {
    return [];
  }
}

export function backupProfilePermissions(tenantId: string, profileId: string, permissions?: UserPermissions) {
  if (typeof localStorage === 'undefined' || !permissions) return;
  try {
    const key = `micuadre_permissions_${tenantId}`;
    const raw = localStorage.getItem(key);
    const map = raw ? JSON.parse(raw) : {};
    map[profileId] = permissions;
    localStorage.setItem(key, JSON.stringify(map));
  } catch (e) {
    // Ignore storage quota errors
  }
}

export function getStoredPermissions(tenantId: string, profileId: string): UserPermissions | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  try {
    const key = `micuadre_permissions_${tenantId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const map = JSON.parse(raw);
    return map[profileId] || undefined;
  } catch (e) {
    return undefined;
  }
}

export function backupTenantFoodEnabled(tenantId: string, isFoodEnabled: boolean) {
  if (typeof localStorage === 'undefined') return;
  try {
    const key = `micuadre_food_enabled_${tenantId}`;
    localStorage.setItem(key, isFoodEnabled ? 'true' : 'false');
  } catch (e) {
    // Ignore storage quota errors
  }
}

export function getStoredTenantFoodEnabled(tenantId: string): boolean | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  try {
    const key = `micuadre_food_enabled_${tenantId}`;
    const val = localStorage.getItem(key);
    if (val === 'true') return true;
    if (val === 'false') return false;
    return undefined;
  } catch (e) {
    return undefined;
  }
}

export function backupTenantTicketPaperWidth(tenantId: string, paperWidth: PrintPaperFormat): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(`micuadre_paper_width_${tenantId}`, paperWidth);
    localStorage.setItem('micuadre_paper_width_global', paperWidth);
  } catch (e) {
    // Ignore storage quota errors
  }
}

export function getStoredTenantTicketPaperWidth(tenantId?: string): PrintPaperFormat | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  try {
    if (tenantId) {
      const key = `micuadre_paper_width_${tenantId}`;
      const val = localStorage.getItem(key) as PrintPaperFormat;
      if (val === '58mm' || val === '80mm' || val === 'CARTA' || val === 'MEDIA_CARTA') return val;
    }
    const globalVal = localStorage.getItem('micuadre_paper_width_global') as PrintPaperFormat;
    if (globalVal === '58mm' || globalVal === '80mm' || globalVal === 'CARTA' || globalVal === 'MEDIA_CARTA') return globalVal;
    return undefined;
  } catch (e) {
    return undefined;
  }
}

// Purge deprecated legacy global keys on module load to guarantee multi-tenant brand isolation
if (typeof localStorage !== 'undefined') {
  try {
    localStorage.removeItem('micuadre_logo_global');
    localStorage.removeItem('micuadre_preprint_logo_global');
  } catch (_) {}
}

export function backupTenantLogo(tenantId: string, logoUrl?: string): void {
  if (typeof localStorage === 'undefined' || !tenantId) return;
  try {
    if (logoUrl) {
      localStorage.setItem(`micuadre_logo_${tenantId}`, logoUrl);
    } else {
      localStorage.removeItem(`micuadre_logo_${tenantId}`);
    }
    // Clean up deprecated global key to ensure strict multi-tenant isolation
    localStorage.removeItem('micuadre_logo_global');
  } catch (e) {
    // Ignore storage quota errors
  }
}

export function getStoredTenantLogo(tenantId?: string): string | undefined {
  if (typeof localStorage === 'undefined' || !tenantId) return undefined;
  try {
    const val = localStorage.getItem(`micuadre_logo_${tenantId}`);
    if (val) return val;

    // Redundant backup check in persisted zustand store state
    const rawState = localStorage.getItem('micuadre_app_state');
    if (rawState) {
      const parsed = JSON.parse(rawState);
      const stateObj = parsed?.state;
      if (stateObj) {
        if (stateObj.tenant && (stateObj.tenant.id === tenantId || normalizeSlug(stateObj.tenant.name) === normalizeSlug(tenantId))) {
          if (stateObj.tenant.logoUrl) return stateObj.tenant.logoUrl;
        }
        if (Array.isArray(stateObj.tenants)) {
          const found = stateObj.tenants.find((t: any) => t.id === tenantId || normalizeSlug(t.name) === normalizeSlug(tenantId));
          if (found?.logoUrl) return found.logoUrl;
        }
      }
    }
    return undefined;
  } catch (e) {
    return undefined;
  }
}

export function backupTenantPrePrintLogo(tenantId: string, enabled: boolean): void {
  if (typeof localStorage === 'undefined' || !tenantId) return;
  try {
    localStorage.setItem(`micuadre_preprint_logo_${tenantId}`, enabled ? '1' : '0');
    // Clean up deprecated global key to ensure strict multi-tenant isolation
    localStorage.removeItem('micuadre_preprint_logo_global');
  } catch (e) {}
}

export function getStoredTenantPrePrintLogo(tenantId?: string): boolean | undefined {
  if (typeof localStorage === 'undefined' || !tenantId) return undefined;
  try {
    const val = localStorage.getItem(`micuadre_preprint_logo_${tenantId}`);
    if (val !== null) return val === '1';
    return undefined;
  } catch (e) {
    return undefined;
  }
}


export function backupServiceSupplies(tenantId: string, serviceId: string, supplies?: ServiceSupply[]) {
  if (typeof localStorage === 'undefined' || !supplies) return;
  try {
    const key = `micuadre_service_supplies_${tenantId}`;
    const raw = localStorage.getItem(key);
    const map = raw ? JSON.parse(raw) : {};
    map[serviceId] = supplies;
    localStorage.setItem(key, JSON.stringify(map));
  } catch (e) {
    // Ignore storage quota errors
  }
}

export function getStoredServiceSupplies(tenantId: string, serviceId: string): ServiceSupply[] | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  try {
    const key = `micuadre_service_supplies_${tenantId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const map = JSON.parse(raw);
    return map[serviceId] || undefined;
  } catch (e) {
    return undefined;
  }
}

let isPresentationsDbColumnAvailable: boolean | null = null;
let isPriceTypesDbColumnAvailable: boolean | null = null;
let isPermissionsDbColumnAvailable: boolean | null = null;

if (typeof localStorage !== 'undefined') {
  const cachedPres = localStorage.getItem('micuadre_col_presentations_exists');
  if (cachedPres === '1') isPresentationsDbColumnAvailable = true;
  else if (cachedPres === '0') isPresentationsDbColumnAvailable = false;

  const cachedPriceTypes = localStorage.getItem('micuadre_col_pricetypes_exists');
  if (cachedPriceTypes === '1') isPriceTypesDbColumnAvailable = true;
  else if (cachedPriceTypes === '0') isPriceTypesDbColumnAvailable = false;

  const cachedPerm = localStorage.getItem('micuadre_col_permissions_exists');
  if (cachedPerm === '1') isPermissionsDbColumnAvailable = true;
  else if (cachedPerm === '0') isPermissionsDbColumnAvailable = false;
}

export function getIsPresentationsDbColumnAvailable(): boolean | null {
  return isPresentationsDbColumnAvailable;
}

export function setIsPresentationsDbColumnAvailable(val: boolean) {
  isPresentationsDbColumnAvailable = val;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('micuadre_col_presentations_exists', val ? '1' : '0');
    } catch (e) {}
  }
}

export function getIsPriceTypesDbColumnAvailable(): boolean | null {
  return isPriceTypesDbColumnAvailable;
}

export function setIsPriceTypesDbColumnAvailable(val: boolean) {
  isPriceTypesDbColumnAvailable = val;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('micuadre_col_pricetypes_exists', val ? '1' : '0');
    } catch (e) {}
  }
}

export function getIsPermissionsDbColumnAvailable(): boolean | null {
  return isPermissionsDbColumnAvailable;
}

export function setIsPermissionsDbColumnAvailable(val: boolean) {
  isPermissionsDbColumnAvailable = val;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('micuadre_col_permissions_exists', val ? '1' : '0');
    } catch (e) {}
  }
}


export const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
export const DEMO_SKUS = ['BEB-HAR-5LB', 'ACE-COC-1L', 'SHAM-BARB-250', 'LIC-RUM-750'];
export const DEMO_PRODUCT_IDS = [
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000103',
  '00000000-0000-0000-0000-000000000104'
];

export function isDemoProduct(p: { id?: string; sku?: string }): boolean {
  return (p.id ? DEMO_PRODUCT_IDS.includes(p.id) : false) || (p.sku ? DEMO_SKUS.includes(p.sku) : false);
}

export const DEMO_SERVICE_IDS = ['serv-1', 'serv-2'];

export function isDemoService(s: { id?: string }): boolean {
  return Boolean(s.id && DEMO_SERVICE_IDS.includes(s.id));
}


/**
 * Seed initial sample products and tenant to Supabase when database is empty
 */
export async function seedInitialDataToSupabase(tenantId: string): Promise<Product[] | null> {
  if (!isSupabaseConfigured()) return null;

  const validTenantId = tenantId && tenantId.length === 36 ? tenantId : '00000000-0000-0000-0000-000000000001';

  try {
    console.log('Insertando Tenant inicial en Supabase:', validTenantId);

    // 1. Ensure default tenant exists in Supabase
    const { error: tenantError } = await supabase.from('tenants').upsert({
      id: validTenantId,
      name: 'MiCuadre Comercio Demo',
      rtn: '08011995123456',
      phone: '9988-7766',
      email: 'contacto@micuadre.app',
      address: 'Tegucigalpa, Honduras',
      business_type: 'MIXED',
      is_fiscal_enabled: true,
      allow_negative_stock: false
    });

    if (tenantError) {
      console.error('Error al insertar tenant en Supabase:', tenantError);
      return null;
    }

    // 2. Insert initial suppliers
    const demoSuppliers = INITIAL_SUPPLIERS.map(s => ({
      tenant_id: validTenantId,
      rtn: s.rtn,
      company_name: s.companyName,
      contact_name: s.contactName,
      phone: s.phone,
      email: s.email,
      default_credit_days: s.defaultCreditDays,
      is_active: true
    }));
    await supabase.from('suppliers').upsert(demoSuppliers, { onConflict: 'company_name' });

    // 3. Insert initial products
    const demoProducts = INITIAL_PRODUCTS.map(p => ({
      tenant_id: validTenantId,
      sku: p.sku,
      barcode: p.barcode,
      name: p.name,
      category: p.category,
      unit_of_measure: p.unitOfMeasure,
      cost_price: p.costPrice,
      sale_price: p.salePrice,
      current_stock: p.currentStock,
      min_stock_alert: p.minStockAlert,
      tax_classification: p.taxClassification,
      is_active: true
    }));

    const { error: prodError } = await supabase.from('products').upsert(demoProducts, { onConflict: 'sku' });
    if (prodError) {
      console.error('Error al poblar productos en Supabase:', prodError);
      return null;
    }

    console.log('Seed completado exitosamente en Supabase');
    return fetchProductsFromSupabase(validTenantId);
  } catch (err) {
    console.error('Error en seedInitialDataToSupabase:', err);
    return null;
  }
}


/**
 * Fetch tenant settings from Supabase
 */
export async function fetchTenantFromSupabase(tenantId: string): Promise<Tenant | null> {
  if (!isSupabaseConfigured() || !isValidUUID(tenantId)) return null;

  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();

  if (error || !data) {
    console.warn('Tenant no encontrado en Supabase, usando estado actual.');
    return null;
  }

  const isFoodEnabled = typeof data.is_food_enabled === 'boolean'
    ? data.is_food_enabled
    : getStoredTenantFoodEnabled(data.id);

  return {
    id: data.id,
    name: data.name,
    rtn: data.rtn,
    phone: data.phone,
    email: data.email,
    address: data.address,
    businessType: data.business_type,
    isFiscalEnabled: data.is_fiscal_enabled ?? false,
    isServicesEnabled: data.is_services_enabled ?? true,
    isWholesaleEnabled: data.is_wholesale_enabled ?? true,
    isLoyaltyEnabled: data.is_loyalty_enabled ?? true,
    isFoodEnabled: isFoodEnabled ?? false,
    allowNegativeStock: data.allow_negative_stock,
    currencySymbol: data.currency_symbol || 'L.',
    accessPassword: data.access_password || undefined,
    ticketPaperWidth: (data.ticket_paper_width as PrintPaperFormat) || getStoredTenantTicketPaperWidth(data.id) || '58mm',
    prePrintLogoOnFeed: typeof data.pre_print_logo_on_feed === 'boolean'
      ? data.pre_print_logo_on_feed
      : (getStoredTenantPrePrintLogo(data.id) ?? Boolean(data.logo_url || getStoredTenantLogo(data.id)))
  };
}

/**
 * Fetch all registered tenants from Supabase for store selection
 */
export async function fetchTenantsFromSupabase(): Promise<Tenant[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase.from('tenants').select('*');
  if (error || !data) {
    if (error) console.warn('Supabase fetch tenants info:', error.message);
    return [];
  }

  return data.map((t: any) => {
    const isFoodEnabled = typeof t.is_food_enabled === 'boolean'
      ? t.is_food_enabled
      : getStoredTenantFoodEnabled(t.id);

    const logoUrl = t.logo_url || getStoredTenantLogo(t.id);
    if (t.logo_url) {
      backupTenantLogo(t.id, t.logo_url);
    }
    const storedPrePrint = getStoredTenantPrePrintLogo(t.id);
    const prePrintLogo = typeof t.pre_print_logo_on_feed === 'boolean'
      ? t.pre_print_logo_on_feed
      : (storedPrePrint ?? Boolean(logoUrl));

    return {
      id: t.id,
      name: t.name,
      rtn: t.rtn,
      phone: t.phone,
      email: t.email,
      address: t.address,
      businessType: t.business_type,
      isFiscalEnabled: t.is_fiscal_enabled ?? false,
      isServicesEnabled: t.is_services_enabled ?? true,
      isWholesaleEnabled: t.is_wholesale_enabled ?? true,
      isLoyaltyEnabled: t.is_loyalty_enabled ?? true,
      isFoodEnabled: isFoodEnabled ?? false,
      allowNegativeStock: t.allow_negative_stock,
      currencySymbol: t.currency_symbol || 'L.',
      accessPassword: t.access_password || undefined,
      ticketPaperWidth: (t.ticket_paper_width as PrintPaperFormat) || getStoredTenantTicketPaperWidth(t.id) || '58mm',
      logoUrl: logoUrl || undefined,
      prePrintLogoOnFeed: prePrintLogo
    };
  });
}

/**
 * Save / Update tenant settings to Supabase
 */
export async function saveTenantToSupabase(tenant: Tenant): Promise<boolean> {
  if (!isSupabaseConfigured() || !isValidUUID(tenant.id)) return false;

  if (typeof tenant.isFoodEnabled === 'boolean') {
    backupTenantFoodEnabled(tenant.id, tenant.isFoodEnabled);
  }

  if (tenant.ticketPaperWidth) {
    backupTenantTicketPaperWidth(tenant.id, tenant.ticketPaperWidth);
  }

  if (tenant.id) {
    backupTenantLogo(tenant.id, tenant.logoUrl);
  }

  if (typeof tenant.prePrintLogoOnFeed === 'boolean') {
    backupTenantPrePrintLogo(tenant.id, tenant.prePrintLogoOnFeed);
  }

  try {
    let { error } = await supabase.from('tenants').upsert({
      id: tenant.id,
      name: tenant.name,
      rtn: tenant.rtn || null,
      phone: tenant.phone || null,
      email: tenant.email || null,
      address: tenant.address || null,
      business_type: tenant.businessType,
      is_fiscal_enabled: tenant.isFiscalEnabled,
      is_services_enabled: tenant.isServicesEnabled ?? true,
      is_wholesale_enabled: tenant.isWholesaleEnabled ?? true,
      is_loyalty_enabled: tenant.isLoyaltyEnabled ?? true,
      is_food_enabled: tenant.isFoodEnabled ?? false,
      allow_negative_stock: tenant.allowNegativeStock,
      currency_symbol: tenant.currencySymbol || 'L.',
      access_password: tenant.accessPassword || null,
      logo_url: tenant.logoUrl || null,
      ticket_paper_width: tenant.ticketPaperWidth || '58mm',
      pre_print_logo_on_feed: tenant.prePrintLogoOnFeed ?? false
    }, { onConflict: 'id' });

    // Fallback: If database lacks newer columns like pre_print_logo_on_feed, retry without it, ALWAYS PRESERVING logo_url
    if (error && error.message.includes('column')) {
      console.warn('Reintentando guardar tenant sin pre_print_logo_on_feed en Supabase:', error.message);
      const retry = await supabase.from('tenants').upsert({
        id: tenant.id,
        name: tenant.name,
        rtn: tenant.rtn || null,
        phone: tenant.phone || null,
        email: tenant.email || null,
        address: tenant.address || null,
        business_type: tenant.businessType,
        is_fiscal_enabled: tenant.isFiscalEnabled,
        is_services_enabled: tenant.isServicesEnabled ?? true,
        is_wholesale_enabled: tenant.isWholesaleEnabled ?? true,
        is_loyalty_enabled: tenant.isLoyaltyEnabled ?? true,
        is_food_enabled: tenant.isFoodEnabled ?? false,
        allow_negative_stock: tenant.allowNegativeStock,
        currency_symbol: tenant.currencySymbol || 'L.',
        access_password: tenant.accessPassword || null,
        logo_url: tenant.logoUrl || null,
        ticket_paper_width: tenant.ticketPaperWidth || '58mm'
      }, { onConflict: 'id' });
      error = retry.error;

      if (error && error.message.includes('column')) {
        console.warn('Reintentando guardar tenant con esquema base preservando logo_url en Supabase:', error.message);
        const retryBase = await supabase.from('tenants').upsert({
          id: tenant.id,
          name: tenant.name,
          rtn: tenant.rtn || null,
          phone: tenant.phone || null,
          email: tenant.email || null,
          address: tenant.address || null,
          business_type: tenant.businessType,
          is_fiscal_enabled: tenant.isFiscalEnabled,
          logo_url: tenant.logoUrl || null,
          ticket_paper_width: tenant.ticketPaperWidth || '58mm'
        }, { onConflict: 'id' });
        error = retryBase.error;
      }
    }

    if (error) {
      console.error('Error guardando tenant en Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error general guardando tenant en Supabase:', err);
    return false;
  }
}

/**
 * Delete a tenant and its related records from Supabase
 */
export async function deleteTenantFromSupabase(tenantId: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured() || !isValidUUID(tenantId)) {
    return { success: false, error: 'Configuracion o UUID invalido' };
  }

  try {
    // 1. Proactively delete child tables to prevent foreign key constraint issues
    await Promise.allSettled([
      supabase.from('sale_items').delete().eq('tenant_id', tenantId),
      supabase.from('sales_returns').delete().eq('tenant_id', tenantId),
      supabase.from('sales').delete().eq('tenant_id', tenantId),
      supabase.from('account_payments').delete().eq('tenant_id', tenantId),
      supabase.from('purchase_invoices').delete().eq('tenant_id', tenantId),
      supabase.from('suppliers').delete().eq('tenant_id', tenantId),
      supabase.from('cash_movements').delete().eq('tenant_id', tenantId),
      supabase.from('expenses').delete().eq('tenant_id', tenantId),
      supabase.from('cash_shifts').delete().eq('tenant_id', tenantId),
      supabase.from('fiscal_ranges').delete().eq('tenant_id', tenantId),
      supabase.from('appointments').delete().eq('tenant_id', tenantId),
      supabase.from('staff_commissions').delete().eq('tenant_id', tenantId),
      supabase.from('financial_events').delete().eq('tenant_id', tenantId),
      supabase.from('staff').delete().eq('tenant_id', tenantId),
      supabase.from('services').delete().eq('tenant_id', tenantId),
      supabase.from('customers').delete().eq('tenant_id', tenantId),
      supabase.from('products').delete().eq('tenant_id', tenantId),
      supabase.from('profiles').delete().eq('tenant_id', tenantId),
    ]);

    // 2. Delete tenant record
    const { error } = await supabase.from('tenants').delete().eq('id', tenantId);
    if (error) {
      console.error('Error al eliminar tenant en Supabase:', error.message);
      return { success: false, error: error.message };
    }

    // 3. Verify deletion: check if row was actually deleted or if RLS silently blocked it
    const { data: stillThere } = await supabase.from('tenants').select('id').eq('id', tenantId).maybeSingle();
    if (stillThere) {
      console.warn('El tenant sigue presente tras delete(). Probable politica RLS DELETE faltante en Supabase.');
      return {
        success: false,
        error: 'El comercio no se elimino de Supabase. Requiere ejecutar el script SQL con la politica RLS DELETE en la tabla tenants.'
      };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Excepcion al eliminar tenant en Supabase:', err);
    return { success: false, error: err?.message || 'Error inesperado al eliminar el comercio' };
  }
}

/**
 * Finds a tenant in Supabase or local store by name, RTN, UUID or slug with accent normalization
 */
export async function findTenantInSupabase(searchTerm: string): Promise<Tenant | null> {
  if (!searchTerm || !searchTerm.trim()) return null;

  const cloudTenants = await fetchTenantsFromSupabase();
  let localTenants: Tenant[] = (window as any).__micuadre_local_tenants || [];
  if (localTenants.length === 0 && typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem('micuadre_app_state');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.state?.tenants)) {
          localTenants = parsed.state.tenants;
        } else if (parsed?.state?.tenant) {
          localTenants = [parsed.state.tenant];
        }
      }
    } catch (_) {}
  }
  const allTenants = [...cloudTenants];

  for (const lt of localTenants) {
    if (!allTenants.some(ct => ct.id === lt.id)) {
      allTenants.push(lt);
    }
  }

  const cleanSearch = normalizeSlug(searchTerm);

  // Strict matching: Exact UUID, exact normalized store name, or exact RTN
  const matched = allTenants.find(t =>
    t.id.trim() === searchTerm.trim() ||
    normalizeSlug(t.name) === cleanSearch ||
    (t.rtn && normalizeSlug(t.rtn) === cleanSearch)
  );

  if (matched) {
    const localMatched = localTenants.find(lt => lt.id === matched.id);
    const storedLogo = getStoredTenantLogo(matched.id);
    const resolvedLogoUrl = matched.logoUrl || localMatched?.logoUrl || storedLogo || undefined;
    if (resolvedLogoUrl) {
      matched.logoUrl = resolvedLogoUrl;
      backupTenantLogo(matched.id, resolvedLogoUrl);
    }
  }

  return matched || null;
}

/**
 * Fetch profiles/users for a specific tenant from Supabase
 */
export async function fetchProfilesFromSupabase(tenantId: string): Promise<UserProfile[] | null> {
  if (!isSupabaseConfigured() || !isValidUUID(tenantId)) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  if (error || !data) return null;

  if (data.length > 0) {
    const hasCol = 'permissions' in data[0];
    setIsPermissionsDbColumnAvailable(hasCol);
  }

  return data.map((p: any) => ({
    id: p.id,
    tenantId: p.tenant_id,
    fullName: p.full_name,
    role: p.role,
    pinCode: p.pin_code,
    isActive: p.is_active,
    permissions: p.permissions || getStoredPermissions(tenantId, p.id) || undefined
  }));
}

/**
 * Update or insert a user profile PIN in Supabase safely, handling foreign key constraints
 */
export async function updateProfilePinInSupabase(
  profile: UserProfile,
  newPin: string
): Promise<{ success: boolean; profile: UserProfile; error?: string }> {
  const updatedProfile: UserProfile = { ...profile, pinCode: newPin };

  if (profile.permissions) {
    backupProfilePermissions(profile.tenantId, profile.id, profile.permissions);
  }

  if (!isSupabaseConfigured()) {
    return { success: true, profile: updatedProfile };
  }

  try {
    // 1. Try updating by exact profile ID first (UPDATE does not mutate ID, avoiding FK constraint violations)
    const { data: idUpdateData, error: idError } = await supabase
      .from('profiles')
      .update({ pin_code: newPin })
      .eq('id', profile.id)
      .select();

    if (!idError && idUpdateData && idUpdateData.length > 0) {
      console.log('PIN actualizado por ID en Supabase:', idUpdateData);
      return { success: true, profile: updatedProfile };
    }

    // 2. If ID update matched 0 rows, try updating by tenant_id & full_name
    const { data: nameUpdateData, error: nameError } = await supabase
      .from('profiles')
      .update({ pin_code: newPin })
      .eq('tenant_id', profile.tenantId)
      .eq('full_name', profile.fullName)
      .select();

    if (!nameError && nameUpdateData && nameUpdateData.length > 0) {
      console.log('PIN actualizado por nombre en Supabase:', nameUpdateData);
      return { success: true, profile: updatedProfile };
    }

    // 4. If no profile row exists in Supabase, insert a new profile row (letting Postgres generate ID)
    const insertPayload: any = {
      tenant_id: profile.tenantId,
      full_name: profile.fullName,
      role: profile.role,
      pin_code: newPin,
      is_active: profile.isActive ?? true
    };
    if (isPermissionsDbColumnAvailable !== false && profile.permissions) {
      insertPayload.permissions = profile.permissions;
    }

    let { error: insertError } = await supabase.from('profiles').insert(insertPayload);

    if (insertError && (insertError.message.includes('permissions') || insertError.message.includes('column'))) {
      setIsPermissionsDbColumnAvailable(false);
      delete insertPayload.permissions;
      const retry = await supabase.from('profiles').insert(insertPayload);
      insertError = retry.error;
    }

    if (insertError) {
      console.warn('Supabase profiles insert info:', insertError.message);
      // If foreign key constraint (profiles_id_fkey) or auth integration exists, treat local state update as successful
      if (
        insertError.message.includes('foreign key constraint') ||
        insertError.message.includes('profiles_id_fkey') ||
        insertError.message.includes('violates')
      ) {
        return { success: true, profile: updatedProfile };
      }
      return { success: false, profile, error: insertError.message };
    }

    return { success: true, profile: updatedProfile };
  } catch (err: any) {
    console.error('Error general en updateProfilePinInSupabase:', err);
    return { success: true, profile: updatedProfile };
  }
}


/**
 * Fetch products catalog from Supabase
 */
export async function fetchProductsFromSupabase(tenantId: string): Promise<Product[] | null> {
  if (!isSupabaseConfigured() || !isValidUUID(tenantId)) return null;

  try {
    const { data, error } = await supabase
      .from('products')
      .select('*, product_price_tiers(*)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (error || !data) {
      console.error('Error al cargar productos de Supabase:', error?.message);
      return null;
    }

    if (data.length > 0) {
      const hasCol = 'presentations' in data[0];
      setIsPresentationsDbColumnAvailable(hasCol);
      const hasPriceTypesCol = 'price_types' in data[0];
      setIsPriceTypesDbColumnAvailable(hasPriceTypesCol);
    }

    let filteredData = data;
    if (tenantId !== DEMO_TENANT_ID) {
      const leakedDemoRows = data.filter((p: any) => DEMO_SKUS.includes(p.sku) || DEMO_PRODUCT_IDS.includes(p.id));
      if (leakedDemoRows.length > 0) {
        const leakedIds = leakedDemoRows.map((p: any) => p.id);
        supabase.from('products').delete().eq('tenant_id', tenantId).in('id', leakedIds).then(({ error }) => {
          if (error) console.warn('Supabase purge leaked demo products info:', error.message);
        });
      }
      filteredData = data.filter((p: any) => !DEMO_SKUS.includes(p.sku) && !DEMO_PRODUCT_IDS.includes(p.id));
    }

    return filteredData.map((p: any) => {
      const stored = getStoredPresentations(p.tenant_id, p.id);
      const presentations = (Array.isArray(p.presentations) && p.presentations.length > 0)
        ? p.presentations
        : stored;

      const storedPriceTypes = getStoredPriceTypes(p.tenant_id, p.id);
      const priceTypes = (Array.isArray(p.price_types) && p.price_types.length > 0)
        ? p.price_types
        : (Array.isArray(p.priceTypes) && p.priceTypes.length > 0 ? p.priceTypes : storedPriceTypes);

      return {
        id: p.id,
        tenantId: p.tenant_id,
        sku: p.sku,
        barcode: p.barcode,
        name: p.name,
        category: p.category,
        unitOfMeasure: p.unit_of_measure,
        costPrice: Number(p.cost_price),
        salePrice: Number(p.sale_price),
        currentStock: Number(p.current_stock),
        minStockAlert: Number(p.min_stock_alert),
        taxClassification: p.tax_classification,
        isActive: p.is_active,
        presentations: presentations || [],
        priceTypes: priceTypes || [],
        tiers: p.product_price_tiers?.map((t: any) => ({
          id: t.id,
          minQuantity: t.min_quantity,
          maxQuantity: t.max_quantity,
          unitPrice: Number(t.unit_price),
          tierName: t.tier_name
        }))
      };
    });
  } catch (err) {
    console.error('Error al cargar productos de Supabase:', err);
    return null;
  }
}
/**
 * Save / Upsert Product to Supabase
 */
export async function saveProductToSupabase(product: Product) {
  if (!isSupabaseConfigured() || !isValidUUID(product.tenantId)) return null;
  if (product.tenantId !== DEMO_TENANT_ID && isDemoProduct(product)) return null;

  try {
    const prodUuid = isValidUUID(product.id) ? product.id : generateUUID();

    // Always backup presentations locally so presentations are never lost even before SQL migration
    if (product.presentations && product.presentations.length > 0) {
      backupProductPresentations(product.tenantId, prodUuid, product.presentations);
      if (product.id && product.id !== prodUuid) {
        backupProductPresentations(product.tenantId, product.id, product.presentations);
      }
    }

    // Always backup price types locally so they are never lost even before SQL migration
    if (product.priceTypes && product.priceTypes.length > 0) {
      backupProductPriceTypes(product.tenantId, prodUuid, product.priceTypes);
      if (product.id && product.id !== prodUuid) {
        backupProductPriceTypes(product.tenantId, product.id, product.priceTypes);
      }
    }

    const payload: any = {
      id: prodUuid,
      tenant_id: product.tenantId,
      sku: product.sku || `SKU-${Date.now()}`,
      barcode: product.barcode || null,
      name: product.name,
      category: product.category || 'General',
      unit_of_measure: product.unitOfMeasure || 'Unidad',
      cost_price: product.costPrice || 0,
      sale_price: product.salePrice || 0,
      current_stock: product.currentStock != null ? product.currentStock : 0,
      min_stock_alert: product.minStockAlert != null ? product.minStockAlert : 5,
      tax_classification: product.taxClassification || 'EXENTO',
      is_active: product.isActive ?? true
    };

    // If we know presentations column does NOT exist in Supabase yet, do NOT send it (prevents HTTP 400 in console)
    if (isPresentationsDbColumnAvailable !== false) {
      payload.presentations = product.presentations || [];
    }

    // If we know price_types column does NOT exist in Supabase yet, do NOT send it
    if (isPriceTypesDbColumnAvailable !== false) {
      payload.price_types = product.priceTypes || [];
    }

    let { data, error } = await supabase.from('products').upsert(payload, { onConflict: 'id' }).select().single();
    if (error && (error.message.includes('column') || error.message.includes('presentations') || error.message.includes('price_types') || error.code === 'PGRST204')) {
      if (error.message.includes('presentations')) setIsPresentationsDbColumnAvailable(false);
      if (error.message.includes('price_types')) setIsPriceTypesDbColumnAvailable(false);

      const fallbackPayload = { ...payload };
      if (isPresentationsDbColumnAvailable === false) delete fallbackPayload.presentations;
      if (isPriceTypesDbColumnAvailable === false) delete fallbackPayload.price_types;

      const retry = await supabase.from('products').upsert(fallbackPayload, { onConflict: 'id' }).select().single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.warn('Supabase upsert products info:', error.message);
    } else if (data && product.tiers && product.tiers.length > 0) {
      const tiersToInsert = product.tiers.map((t: any) => ({
        tenant_id: product.tenantId,
        product_id: data.id,
        min_quantity: t.minQuantity,
        max_quantity: t.maxQuantity || null,
        unit_price: t.unitPrice,
        tier_name: t.tierName || 'Mayoreo'
      }));
      await supabase.from('product_price_tiers').delete().eq('product_id', data.id);
      await supabase.from('product_price_tiers').insert(tiersToInsert);
    }
    return data ? { ...product, id: data.id } : null;
  } catch (err) {
    console.warn('Error saving product to Supabase:', err);
    return null;
  }
}

/**
 * Fetch suppliers from Supabase
 */
export async function fetchSuppliersFromSupabase(tenantId: string): Promise<Supplier[] | null> {
  if (!isSupabaseConfigured() || !isValidUUID(tenantId)) return null;

  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  if (error) {
    console.error('Error al cargar proveedores de Supabase:', error);
    return null;
  }

  return data.map((s: any) => ({
    id: s.id,
    tenantId: s.tenant_id,
    rtn: s.rtn,
    companyName: s.company_name,
    contactName: s.contact_name,
    phone: s.phone,
    email: s.email,
    defaultCreditDays: s.default_credit_days || 0,
    isActive: s.is_active
  }));
}

/**
 * Execute atomic POS Sale via Supabase RPC function with direct insert fallback
 */
export async function saveSaleToSupabase(sale: Sale) {
  if (!isSupabaseConfigured() || !isValidUUID(sale.tenantId)) return null;

  try {
    const saleUuid = isValidUUID(sale.id) ? sale.id : generateUUID();
    const shiftIdParam = (sale.cashShiftId && isValidUUID(sale.cashShiftId)) ? sale.cashShiftId : null;

    const payload: any = {
      id: saleUuid,
      tenant_id: sale.tenantId,
      cash_shift_id: shiftIdParam,
      fiscal_range_id: (sale.fiscalRangeId && isValidUUID(sale.fiscalRangeId)) ? sale.fiscalRangeId : null,
      caja_name: sale.cajaName || null,
      document_number: sale.documentNumber,
      is_fiscal: sale.isFiscal,
      cai: sale.cai || null,
      customer_rtn: sale.customerRtn || null,
      customer_name: sale.customerName || 'Consumidor Final',
      idempotency_key: saleUuid,
      subtotal: sale.subtotal,
      discount_amount: sale.discountAmount,
      exempt_amount: sale.exemptAmount,
      exonerated_amount: sale.exoneratedAmount,
      taxable_15: sale.taxable15,
      tax_15: sale.tax15,
      taxable_18: sale.taxable18,
      tax_18: sale.tax18,
      total: sale.total,
      payment_method: sale.paymentMethod,
      created_at: sale.createdAt || new Date().toISOString()
    };

    const { data: insertedSale, error: saleErr } = await supabase
      .from('sales')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (saleErr) {
      console.error('Error al insertar venta en Supabase:', saleErr.message);
      return null;
    }

    if (insertedSale && sale.items && sale.items.length > 0) {
      const itemsToInsert = sale.items.map(item => ({
        tenant_id: sale.tenantId,
        sale_id: insertedSale.id,
        product_id: (item.productId && isValidUUID(item.productId)) ? item.productId : null,
        service_id: (item.serviceId && isValidUUID(item.serviceId)) ? item.serviceId : null,
        staff_id: (item.staffId && isValidUUID(item.staffId)) ? item.staffId : null,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount_amount: item.discountAmount || 0,
        tax_classification: item.taxClassification || 'EXENTO',
        tax_amount: item.taxAmount || 0,
        subtotal: item.subtotal
      }));

      await supabase.from('sale_items').delete().eq('sale_id', insertedSale.id);
      const { error: itemsErr } = await supabase.from('sale_items').insert(itemsToInsert);
      if (itemsErr) {
        console.error('Error insertando sale_items en Supabase:', itemsErr.message);
        return null;
      }

      // Synchronize shared product stock in Supabase so all Cajas (Caja 1, Caja 2) share 1 unified inventory
      for (const item of sale.items) {
        if (item.productId && isValidUUID(item.productId)) {
          try {
            const { data: currentProd } = await supabase
              .from('products')
              .select('current_stock')
              .eq('id', item.productId)
              .single();

            if (currentProd) {
              const updatedStock = Math.max(0, Number(currentProd.current_stock || 0) - Number(item.quantity || 0));
              await supabase
                .from('products')
                .update({ current_stock: updatedStock })
                .eq('id', item.productId);
            }
          } catch (stkErr) {
            console.warn('Error updating shared product stock in Supabase:', stkErr);
          }
        }
      }
    }

    console.log('Venta guardada e inventario actualizado exitosamente en Supabase');
    return insertedSale;
  } catch (fallbackErr: any) {
    console.error('Error general guardando venta en Supabase:', fallbackErr?.message || fallbackErr);
    return null;
  }
}

export async function processPosSaleSupabase(payload: any) {
  if (payload.idempotencyKey) {
    const saleObj: Sale = {
      id: payload.idempotencyKey,
      tenantId: payload.tenantId,
      cashShiftId: payload.cashShiftId,
      documentNumber: payload.documentNumber || `TICK-${Date.now()}`,
      isFiscal: payload.isFiscal,
      cai: payload.cai,
      caiDeadline: payload.caiDeadline,
      caiRangeStart: payload.caiRangeStart,
      caiRangeEnd: payload.caiRangeEnd,
      fiscalRangeId: payload.fiscalRangeId,
      cajaName: payload.cajaName || 'Caja Registradora',
      customerName: payload.customerName || 'Consumidor Final',
      customerRtn: payload.customerRtn,
      subtotal: payload.subtotal,
      discountAmount: payload.discountAmount,
      exemptAmount: payload.exemptAmount,
      exoneratedAmount: payload.exoneratedAmount,
      taxable15: payload.taxable15,
      tax15: payload.tax15,
      taxable18: payload.taxable18,
      tax18: payload.tax18,
      total: payload.total,
      paymentMethod: payload.paymentMethod,
      createdAt: new Date().toISOString(),
      items: payload.items || []
    };
    return saveSaleToSupabase(saleObj);
  }
  return null;
}


/**
 * Execute atomic Purchase Invoice & CPP calculation via Supabase RPC function
 */
export async function processPurchaseSupabase(payload: {
  tenantId: string;
  supplierId: string;
  invoiceNumber: string;
  cai?: string;
  issueDate: string;
  dueDate: string;
  paymentTerms: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  items: any[];
}) {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase.rpc('process_purchase_invoice', {
    p_tenant_id: payload.tenantId,
    p_supplier_id: payload.supplierId,
    p_invoice_number: payload.invoiceNumber,
    p_cai: payload.cai || null,
    p_issue_date: payload.issueDate,
    p_due_date: payload.dueDate,
    p_payment_terms: payload.paymentTerms,
    p_subtotal: payload.subtotal,
    p_tax_amount: payload.taxAmount,
    p_total: payload.total,
    p_items: payload.items
  });

  if (error) {
    console.error('Error al registrar compra en Supabase:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Close Cash Shift via Supabase RPC function
 */
export async function closeCashShiftSupabase(shiftId: string, declaredCash: number) {
  if (!isSupabaseConfigured() || !isValidUUID(shiftId)) return null;

  try {
    // Check if shift is already closed in Supabase to maintain idempotency
    const { data: existingShift } = await supabase
      .from('cash_shifts')
      .select('status')
      .eq('id', shiftId)
      .maybeSingle();

    if (existingShift && existingShift.status === 'CLOSED') {
      return existingShift;
    }

    const { data, error } = await supabase.rpc('close_cash_shift', {
      p_shift_id: shiftId,
      p_declared_cash: declaredCash
    });

    if (error) {
      if (error.message.includes('cerrado') || error.code === '400' || error.message.includes('no existe')) {
        console.info('El turno de caja ya se encontraba cerrado en Supabase.');
        return null;
      }
      console.warn('Error al cerrar caja en Supabase:', error.message);
      return null;
    }

    return data;
  } catch (err: any) {
    console.warn('Error idempotente al cerrar turno de caja en Supabase:', err?.message || err);
    return null;
  }
}

/**
 * Fetch sales list for tenant from Supabase
 */
export async function fetchSalesFromSupabase(
  tenantId: string,
  preloadedRanges?: FiscalRange[] | null,
  preloadedProducts?: Product[] | null
): Promise<Sale[] | null> {
  if (!isSupabaseConfigured() || !isValidUUID(tenantId)) return null;

  try {
    const [salesRes, ranges, products, foodOrdersRes, menuItemsRes, cashMovRes] = await Promise.all([
      supabase
        .from('sales')
        .select('*, sale_items(*)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(150),
      preloadedRanges !== undefined ? Promise.resolve(preloadedRanges) : fetchFiscalRangesFromSupabase(tenantId),
      preloadedProducts !== undefined ? Promise.resolve(preloadedProducts) : fetchProductsFromSupabase(tenantId),
      supabase
        .from('food_orders')
        .select('id, sale_id, items, delivery_fee, total, customer_name, table_number, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(150),
      supabase
        .from('menu_items')
        .select('id, name, price')
        .eq('tenant_id', tenantId),
      supabase
        .from('cash_movements')
        .select('reference_id, concept, type')
        .eq('tenant_id', tenantId)
        .eq('type', 'SALIDA')
        .limit(200)
    ]);

    const data = salesRes.data;
    if (salesRes.error || !data) return null;

    const refundMovementsMap = new Map<string, string>();
    ((cashMovRes?.data as any[]) || []).forEach(m => {
      if (m.reference_id && m.concept) {
        refundMovementsMap.set(m.reference_id, m.concept);
      }
    });

    const caiRangeMap = new Map((ranges || []).map(r => [r.cai, r.name]));
    const productMap = new Map((products || []).map(p => [p.id, p.name]));
    const productSkuMap = new Map((products || []).map(p => [p.id, p.sku]));
    const menuItemMap = new Map(((menuItemsRes.data as any[]) || []).map(m => [m.id, m.name]));
    const defaultCajaName = (ranges && ranges.length > 0 && ranges[0].name) ? ranges[0].name : 'Caja 1 - Principal';

    // Map sales to their corresponding food order to restore dish names
    const foodOrderMap = new Map<string, any>();
    const foodOrdersList = (foodOrdersRes.data as any[]) || [];
    foodOrdersList.forEach(fo => {
      if (fo.sale_id) {
        foodOrderMap.set(fo.sale_id, fo);
      }
    });

    return data.map((s: any) => {
      let linkedOrder = foodOrderMap.get(s.id);
      if (!linkedOrder && foodOrdersList.length > 0) {
        linkedOrder = foodOrdersList.find((fo: any) =>
          Math.abs(Number(fo.total || 0) - Number(s.total || 0)) < 0.01 &&
          (
            (fo.customer_name && s.customer_name && fo.customer_name.toLowerCase() === s.customer_name.toLowerCase()) ||
            (fo.table_number && s.customer_name && s.customer_name.toLowerCase().includes(fo.table_number.toLowerCase())) ||
            (Math.abs(new Date(fo.created_at).getTime() - new Date(s.created_at).getTime()) < 1000 * 60 * 45)
          )
        );
      }
      let items: CartLine[] = [];

      if (linkedOrder && Array.isArray(linkedOrder.items) && linkedOrder.items.length > 0) {
        items = linkedOrder.items.map((it: any) => {
          const notesStr = [
            ...(it.selectedExtras || []).map((e: any) => `+ ${e.name} (L. ${e.price})`),
            it.notes ? `Nota: ${it.notes}` : ''
          ].filter(Boolean).join(' | ');

          const unitP = Number(it.unitPrice || it.unit_price || 0);
          const qty = Number(it.quantity || 1);
          const subT = Number(it.subtotal || unitP * qty);

          return {
            productId: it.productId || it.product_id,
            menuItemId: it.menuItemId || it.menu_item_id,
            name: it.name || menuItemMap.get(it.menuItemId || it.menu_item_id) || 'Plato de Menú',
            sku: it.menuItemId || it.productId || 'FOOD',
            quantity: qty,
            unitPrice: unitP,
            originalUnitPrice: unitP,
            discountAmount: 0,
            taxClassification: 'GRAVADO_15',
            subtotal: subT,
            taxAmount: 0,
            total: subT,
            notes: notesStr || undefined
          };
        });

        const deliveryFee = Number(linkedOrder.deliveryFee || linkedOrder.delivery_fee || 0);
        if (deliveryFee > 0) {
          items.push({
            name: 'Servicio a Domicilio',
            sku: 'DELIVERY',
            quantity: 1,
            unitPrice: deliveryFee,
            originalUnitPrice: deliveryFee,
            discountAmount: 0,
            taxClassification: 'EXENTO',
            subtotal: deliveryFee,
            taxAmount: 0,
            total: deliveryFee
          });
        }
      } else {
        const rawItems = s.sale_items || [];
        const uniqueItemsMap = new Map<string, any>();
        rawItems.forEach((i: any) => {
          const itemKey = i.id || `${i.product_id}_${i.service_id}_${i.quantity}_${i.unit_price}_${i.subtotal}`;
          if (!uniqueItemsMap.has(itemKey)) {
            uniqueItemsMap.set(itemKey, i);
          }
        });

        items = Array.from(uniqueItemsMap.values()).map((i: any) => {
          let resolvedName = i.product_name || (i.product_id && productMap.get(i.product_id));
          if (!resolvedName && i.product_id && menuItemMap.has(i.product_id)) {
            resolvedName = menuItemMap.get(i.product_id);
          }
          if (!resolvedName && menuItemsRes.data && (menuItemsRes.data as any[]).length > 0) {
            const matchesPrice = (menuItemsRes.data as any[]).filter(m => Math.abs(Number(m.price) - Number(i.unit_price || 0)) < 0.01);
            if (matchesPrice.length > 0) {
              resolvedName = matchesPrice[0].name;
            }
          }

          return {
            id: i.id,
            productId: i.product_id,
            serviceId: i.service_id,
            staffId: i.staff_id,
            name: resolvedName || 'Artículo POS',
            sku: i.sku || (i.product_id && productSkuMap.get(i.product_id)) || (resolvedName && resolvedName !== 'Artículo POS' ? 'FOOD' : ''),
            quantity: Number(i.quantity || 1),
            unitPrice: Number(i.unit_price || 0),
            originalUnitPrice: Number(i.unit_price || 0),
            discountAmount: Number(i.discount_amount || 0),
            subtotal: Number(i.subtotal || 0),
            taxClassification: i.tax_classification || 'EXENTO',
            taxAmount: Number(i.tax_amount || 0),
            total: Number(i.subtotal || 0) + Number(i.tax_amount || 0)
          };
        });
      }

      let resolvedStatus: 'COMPLETED' | 'VOIDED' | 'REFUNDED' = (s.status as any) || 'COMPLETED';
      let cleanCustomerName = s.customer_name || 'Consumidor Final';

      const refundConcept = s.id ? refundMovementsMap.get(s.id) : undefined;
      const isVoidConcept = refundConcept ? refundConcept.toLowerCase().includes('anulación') : false;
      const isRefundConcept = refundConcept ? refundConcept.toLowerCase().includes('devolución') : false;

      if (s.status === 'VOIDED' || (s.customer_name && s.customer_name.includes('[ANULADA')) || isVoidConcept) {
        resolvedStatus = 'VOIDED';
        cleanCustomerName = cleanCustomerName.replace(/\s*\[ANULADA:.*?\]/g, '').trim() || 'Consumidor Final';
      } else if (s.status === 'REFUNDED' || (s.customer_name && s.customer_name.includes('[DEVUELTA')) || isRefundConcept) {
        resolvedStatus = 'REFUNDED';
        cleanCustomerName = cleanCustomerName.replace(/\s*\[DEVUELTA:.*?\]/g, '').trim() || 'Consumidor Final';
      }

      return {
        id: s.id,
        tenantId: s.tenant_id,
        cashShiftId: s.cash_shift_id,
        documentNumber: s.document_number,
        isFiscal: s.is_fiscal,
        cai: s.cai,
        caiDeadline: s.cai_deadline,
        caiRangeStart: s.cai_range_start,
        caiRangeEnd: s.cai_range_end,
        fiscalRangeId: s.fiscal_range_id,
        cajaName: s.caja_name || (s.cai && caiRangeMap.get(s.cai)) || defaultCajaName,
        customerId: s.customer_id,
        customerName: cleanCustomerName,
        customerRtn: s.customer_rtn,
        subtotal: Number(s.subtotal),
        discountAmount: Number(s.discount_amount),
        exemptAmount: Number(s.exempt_amount),
        exoneratedAmount: Number(s.exonerated_amount),
        taxable15: Number(s.taxable_15),
        tax15: Number(s.tax_15),
        taxable18: Number(s.taxable_18),
        tax18: Number(s.tax_18),
        total: Number(s.total),
        paymentMethod: s.payment_method,
        status: resolvedStatus,
        createdAt: s.created_at,
        items
      };
    });
  } catch (err) {
    console.warn('Error fetching sales from Supabase:', err);
    return null;
  }
}

/**
 * Save / Upsert Cash Shift (Apertura o Cierre) to Supabase
 */
export async function saveCashShiftToSupabase(shift: CashShift) {
  if (!isSupabaseConfigured() || !isValidUUID(shift.tenantId)) return null;

  try {
    let validUserId: string | null = null;

    // Verify existing profiles in Supabase table profiles for this tenant
    const { data: existingProfiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('tenant_id', shift.tenantId);

    if (existingProfiles && existingProfiles.length > 0) {
      const match = shift.userId ? existingProfiles.find(p => p.id === shift.userId) : null;
      validUserId = match ? match.id : existingProfiles[0].id;
    }

    if (!validUserId) {
      const newProfId = (shift.userId && isValidUUID(shift.userId)) ? shift.userId : generateUUID();
      const { data: newProf } = await supabase.from('profiles').insert({
        id: newProfId,
        tenant_id: shift.tenantId,
        full_name: shift.userName || 'Administrador POS',
        role: 'ADMIN',
        pin_code: '1234',
        is_active: true
      }).select().single();
      if (newProf) validUserId = newProf.id;
    }

    if (!validUserId) return null;

    const shiftUuid = isValidUUID(shift.id) ? shift.id : generateUUID();
    const payload: any = {
      id: shiftUuid,
      tenant_id: shift.tenantId,
      user_id: validUserId,
      fiscal_range_id: (shift.fiscalRangeId && isValidUUID(shift.fiscalRangeId)) ? shift.fiscalRangeId : null,
      caja_name: shift.cajaName || null,
      opening_amount: shift.openingAmount,
      closing_declared: shift.closingDeclared != null ? shift.closingDeclared : null,
      closing_system: shift.closingSystem != null ? shift.closingSystem : null,
      difference: shift.difference != null ? shift.difference : null,
      status: shift.status,
      opened_at: shift.openedAt || new Date().toISOString(),
      closed_at: shift.closedAt || null
    };

    const { data, error } = await supabase
      .from('cash_shifts')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.warn('Supabase upsert cash_shifts error:', error.message);
    } else {
      console.log('Turno de caja guardado en Supabase:', shift.status, shift.cajaName);
    }

    return data;
  } catch (err) {
    console.warn('Error saving cash shift to Supabase:', err);
    return null;
  }
}

/**
 * Fetch all Cash Shifts for Tenant from Supabase
 */
export async function fetchShiftsFromSupabase(
  tenantId: string,
  preloadedProfiles?: UserProfile[] | null,
  preloadedRanges?: FiscalRange[] | null
): Promise<CashShift[] | null> {
  if (!isSupabaseConfigured() || !isValidUUID(tenantId)) return null;

  try {
    const [shiftsRes, profiles, ranges] = await Promise.all([
      supabase
        .from('cash_shifts')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('opened_at', { ascending: false })
        .limit(50),
      preloadedProfiles !== undefined ? Promise.resolve(preloadedProfiles) : fetchProfilesFromSupabase(tenantId),
      preloadedRanges !== undefined ? Promise.resolve(preloadedRanges) : fetchFiscalRangesFromSupabase(tenantId)
    ]);

    const data = shiftsRes.data;
    if (shiftsRes.error || !data) return null;

    const profileMap = new Map((profiles || []).map(p => [p.id, p.fullName]));
    const rangeMap = new Map((ranges || []).map(r => [r.id, r.name]));
    const defaultCajaName = (ranges && ranges.length > 0 && ranges[0].name) ? ranges[0].name : 'Caja 1 - Principal';

    return data.map((s: any) => {
      let mappedRangeId = s.fiscal_range_id || null;
      if (!mappedRangeId && s.caja_name && ranges && ranges.length > 0) {
        const matchedRange = ranges.find(r => r.name === s.caja_name || r.prefix === s.caja_name);
        if (matchedRange) mappedRangeId = matchedRange.id;
      }
      if (!mappedRangeId && ranges && ranges.length > 0) {
        mappedRangeId = ranges[0].id;
      }

      return {
        id: s.id,
        tenantId: s.tenant_id,
        userId: s.user_id || 'user-default',
        userName: (s.user_id && profileMap.get(s.user_id)) || s.user_name || 'Cajero',
        fiscalRangeId: mappedRangeId,
        cajaName: (mappedRangeId && rangeMap.get(mappedRangeId)) || s.caja_name || defaultCajaName,
        openingAmount: Number(s.opening_amount || 0),
        closingDeclared: s.closing_declared != null ? Number(s.closing_declared) : undefined,
        closingSystem: s.closing_system != null ? Number(s.closing_system) : undefined,
        difference: s.difference != null ? Number(s.difference) : undefined,
        status: s.status as 'OPEN' | 'CLOSED',
        openedAt: s.opened_at,
        closedAt: s.closed_at
      };
    });
  } catch (err) {
    console.warn('Error fetching cash shifts from Supabase:', err);
    return null;
  }
}

/**
 * Save Cash Movement (Entrada / Egreso de dinero) to Supabase
 */
export async function saveCashMovementToSupabase(movement: CashMovement) {
  if (!isSupabaseConfigured() || !isValidUUID(movement.tenantId)) return null;

  try {
    const movUuid = isValidUUID(movement.id) ? movement.id : undefined;
    const payload: any = {
      ...(movUuid ? { id: movUuid } : {}),
      tenant_id: movement.tenantId,
      cash_shift_id: (movement.cashShiftId && isValidUUID(movement.cashShiftId)) ? movement.cashShiftId : null,
      fiscal_range_id: (movement.fiscalRangeId && isValidUUID(movement.fiscalRangeId)) ? movement.fiscalRangeId : null,
      type: movement.type,
      amount: movement.amount,
      concept: movement.concept,
      registered_by: movement.registeredBy,
      created_at: movement.createdAt || new Date().toISOString(),
      reference_id: (movement.referenceId && isValidUUID(movement.referenceId)) ? movement.referenceId : null
    };

    const { data, error } = await supabase
      .from('cash_movements')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.warn('Error upserting cash_movement to Supabase:', error.message);
    } else {
      console.log('Movimiento de caja guardado en Supabase:', movement.type, movement.amount);
    }
    return data;
  } catch (err) {
    console.warn('Error saving cash movement to Supabase:', err);
    return null;
  }
}

/**
 * Fetch Cash Movements for Tenant from Supabase
 */
export async function fetchCashMovementsFromSupabase(tenantId: string): Promise<CashMovement[] | null> {
  if (!isSupabaseConfigured() || !isValidUUID(tenantId)) return null;

  try {
    const { data, error } = await supabase
      .from('cash_movements')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(150);

    if (error || !data) return null;

    return data.map((m: any) => ({
      id: m.id,
      tenantId: m.tenant_id,
      cashShiftId: m.cash_shift_id || 'general',
      fiscalRangeId: m.fiscal_range_id || '',
      type: m.type as 'ENTRADA' | 'SALIDA',
      amount: Number(m.amount),
      concept: m.concept || '',
      registeredBy: m.registered_by || 'Sistema',
      createdAt: m.created_at,
      referenceId: m.reference_id
    }));
  } catch (err) {
    console.warn('Error fetching cash movements from Supabase:', err);
    return null;
  }
}

/**
 * Save Expense (Gasto) to Supabase
 */
export async function saveExpenseToSupabase(expense: Expense) {
  if (!isSupabaseConfigured() || !isValidUUID(expense.tenantId)) return null;

  try {
    const expUuid = isValidUUID(expense.id) ? expense.id : undefined;
    const payload: any = {
      ...(expUuid ? { id: expUuid } : {}),
      tenant_id: expense.tenantId,
      category: expense.category || 'VARIOS',
      description: expense.description || '',
      amount: expense.amount,
      cash_shift_id: (expense.cashShiftId && isValidUUID(expense.cashShiftId)) ? expense.cashShiftId : null,
      registered_by: expense.registeredBy || null,
      created_at: expense.createdAt || new Date().toISOString()
    };
    if (expense.fundId && isValidUUID(expense.fundId)) {
      payload.fund_id = expense.fundId;
    }

    const { data, error } = await supabase.from('expenses').upsert(payload, { onConflict: 'id' }).select().single();
    if (error) {
      console.warn('Supabase upsert expense info:', error.message);
      // Resilient fallback if cash_shift_id or fund_id columns don't exist
      if (error.message.includes('column')) {
        const minimalPayload: any = {
          ...(expUuid ? { id: expUuid } : {}),
          tenant_id: expense.tenantId,
          category: expense.category || 'VARIOS',
          description: expense.description || '',
          amount: expense.amount,
          created_at: expense.createdAt || new Date().toISOString()
        };
        await supabase.from('expenses').upsert(minimalPayload, { onConflict: 'id' });
      }
    } else {
      console.log('Gasto guardado en Supabase con éxito:', expense.description, expense.amount);
    }
    return data;
  } catch (err) {
    console.warn('Error saving expense to Supabase:', err);
    return null;
  }
}

/**
 * Fetch Expenses from Supabase
 */
export async function fetchExpensesFromSupabase(tenantId: string): Promise<Expense[] | null> {
  if (!isSupabaseConfigured() || !isValidUUID(tenantId)) return null;

  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(150);

    if (error || !data) return null;

    return data.map((e: any) => ({
      id: e.id,
      tenantId: e.tenant_id,
      category: e.category || 'OTROS',
      description: e.description || '',
      amount: Number(e.amount),
      fundId: e.fund_id || 'cash',
      expenseDate: e.expense_date || e.created_at || new Date().toISOString(),
      createdAt: e.created_at || new Date().toISOString()
    }));
  } catch (err) {
    console.warn('Error fetching expenses from Supabase:', err);
    return null;
  }
}

/**
 * Fetch Fiscal Ranges / Cajas for Tenant from Supabase
 */
export async function fetchFiscalRangesFromSupabase(tenantId: string): Promise<FiscalRange[] | null> {
  if (!isSupabaseConfigured() || !isValidUUID(tenantId)) return null;

  try {
    const { data, error } = await supabase
      .from('fiscal_ranges')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (!error && data && data.length > 0) {
      // Deduplicate rows by base prefix (e.g. 000-001-01 or 000-002-01) or CAI to purge duplicate test rows
      const uniqueMap = new Map<string, any>();
      const duplicateIds: string[] = [];

      for (const r of data) {
        const rawPrefix = (r.prefix || '').trim();
        const basePrefix = rawPrefix.split('-').slice(0, 3).join('-');
        const key = basePrefix || (r.cai || '').trim() || r.id;

        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, r);
        } else {
          const existing = uniqueMap.get(key);
          const existingScore = (Number(existing.current_number || 0) * 10) + (existing.name ? 5 : 0);
          const currentScore = (Number(r.current_number || 0) * 10) + (r.name ? 5 : 0);

          if (currentScore > existingScore) {
            duplicateIds.push(existing.id);
            uniqueMap.set(key, r);
          } else {
            duplicateIds.push(r.id);
          }
        }
      }

      // Soft-delete duplicate rows in Supabase so they disappear permanently
      if (duplicateIds.length > 0) {
        for (const dupId of duplicateIds) {
          supabase.from('fiscal_ranges').update({ is_active: false }).eq('id', dupId).then();
        }
      }

      const cleanData = Array.from(uniqueMap.values());
      const localState = useAppStore.getState();
      const localRangesMap = new Map((localState.fiscalRanges || []).map(r => [r.id, r.name]));

      return cleanData.map((r: any, idx: number) => {
        const storedName = localRangesMap.get(r.id);
        const autoName = idx === 0 ? 'Caja 1 - Principal' : `Caja ${idx + 1}`;
        return {
          id: r.id,
          tenantId: r.tenant_id,
          name: r.name || storedName || autoName,
          cai: r.cai || '',
          prefix: r.prefix || '000-001-01-',
          rangeStart: Number(r.range_start || 1),
          rangeEnd: Number(r.range_end || 10000),
          currentNumber: Number(r.current_number || 0),
          deadline: r.deadline || '2026-12-31',
          documentType: (r.document_type === '04' ? '04' : '01') as '01' | '04',
          isActive: r.is_active ?? true,
          isDefault: r.is_default ?? (idx === 0)
        };
      });
    }

    // Auto-seed initial Cajas to Supabase for this tenant if none exist yet
    const defaultCajas: FiscalRange[] = [
      {
        id: generateUUID(),
        tenantId,
        name: 'Caja 1 - Principal',
        cai: 'E83910-149BF1-9243E9-913210-9182C1-02',
        prefix: '000-001-01-',
        rangeStart: 1,
        rangeEnd: 5000,
        currentNumber: 1,
        deadline: '2026-12-31',
        documentType: '01',
        isActive: true,
        isDefault: true
      },
      {
        id: generateUUID(),
        tenantId,
        name: 'Caja 2 - Expreso',
        cai: 'F94021-250CF2-0354F0-024321-0293D2-03',
        prefix: '000-002-01-',
        rangeStart: 1,
        rangeEnd: 5000,
        currentNumber: 1,
        deadline: '2026-12-31',
        documentType: '01',
        isActive: true,
        isDefault: false
      }
    ];

    for (const range of defaultCajas) {
      await saveFiscalRangeToSupabase(range);
    }

    return defaultCajas;
  } catch (err) {
    console.warn('Error fetching fiscal_ranges from Supabase:', err);
    return null;
  }
}

/**
 * Save / Upsert Fiscal Range / Caja to Supabase
 */
export async function saveFiscalRangeToSupabase(range: FiscalRange) {
  if (!isSupabaseConfigured() || !isValidUUID(range.tenantId)) return null;

  try {
    const rangeUuid = isValidUUID(range.id) ? range.id : generateUUID();
    let cleanPrefix = (range.prefix || '000-001-01-').trim();
    if (cleanPrefix.length > 16) {
      const parts = cleanPrefix.split('-');
      if (parts.length >= 3) {
        cleanPrefix = `${parts.slice(0, 3).join('-')}-`;
      }
      cleanPrefix = cleanPrefix.slice(0, 16);
    }

    const payload: any = {
      id: rangeUuid,
      tenant_id: range.tenantId,
      name: range.name || 'Caja Registradora',
      cai: (range.cai || '').trim(),
      prefix: cleanPrefix,
      range_start: range.rangeStart,
      range_end: range.rangeEnd,
      current_number: range.currentNumber,
      deadline: range.deadline || '2026-12-31',
      document_type: range.documentType || '01',
      is_active: range.isActive ?? true,
      is_default: range.isDefault ?? false
    };

    const { data, error } = await supabase.from('fiscal_ranges').upsert(payload, { onConflict: 'id' }).select().single();
    if (error) console.warn('Supabase upsert fiscal_ranges info:', error.message);
    return data;
  } catch (err) {
    console.warn('Error saving fiscal range to Supabase:', err);
    return null;
  }
}

/**
 * Delete Fiscal Range / Caja in Supabase
 */
export async function deleteFiscalRangeSupabase(id: string) {
  if (!isSupabaseConfigured() || !isValidUUID(id)) return null;
  try {
    // Soft delete first so is_active = false excludes it across all devices
    await supabase.from('fiscal_ranges').update({ is_active: false }).eq('id', id);
    // Hard delete if no FK constraints exist
    const { error } = await supabase.from('fiscal_ranges').delete().eq('id', id);
    if (error) console.info('Fiscal range soft-deleted in Supabase (hard delete skipped due to FK references):', error.message);
  } catch (err) {
    console.warn('Error deleting fiscal range:', err);
  }
}

/**
 * Pushes any un-synced initial local products and fiscal ranges to Supabase.
 * Executed only once per tenant to seed cloud database from scratch without redundant loops.
 */
export async function pushLocalDataToCloud(tenantId: string) {
  if (!isSupabaseConfigured() || !isValidUUID(tenantId)) return;

  const pushFlagKey = `micuadre_initial_push_done_${tenantId}`;
  if (typeof localStorage !== 'undefined' && localStorage.getItem(pushFlagKey) === 'true') {
    return;
  }

  try {
    const state = useAppStore.getState();

    // 1. Push local fiscal ranges if needed
    const localRanges = (state.fiscalRanges || []).map(r => {
      const isThisTenant = r.tenantId ? r.tenantId === tenantId : tenantId === DEMO_TENANT_ID;
      if (!isThisTenant) return r;
      return {
        ...r,
        id: isValidUUID(r.id) ? r.id : generateUUID(),
        tenantId
      };
    });

    useAppStore.setState({ fiscalRanges: localRanges });

    const tenantRanges = localRanges.filter(r => r.tenantId === tenantId);
    for (const range of tenantRanges) {
      await saveFiscalRangeToSupabase(range);
    }

    // 2. Push local products if creating tenant from scratch
    const localProds = (state.products || []).map(p => {
      if (tenantId !== DEMO_TENANT_ID && isDemoProduct(p)) {
        return p;
      }
      const isThisTenant = p.tenantId ? p.tenantId === tenantId : tenantId === DEMO_TENANT_ID;
      if (!isThisTenant) return p;
      return {
        ...p,
        id: isValidUUID(p.id) ? p.id : generateUUID(),
        tenantId
      };
    });

    useAppStore.setState({ products: localProds });

    const tenantProds = localProds.filter(p => p.tenantId === tenantId && (tenantId === DEMO_TENANT_ID || !isDemoProduct(p)));
    for (const prod of tenantProds) {
      await saveProductToSupabase(prod);
    }

    // 3. Push local services if creating tenant from scratch or migrating
    const localServices = (state.services || []).map(s => {
      const isThisTenant = s.tenantId ? s.tenantId === tenantId : tenantId === DEMO_TENANT_ID;
      if (!isThisTenant) return s;
      return {
        ...s,
        id: isValidUUID(s.id) ? s.id : generateUUID(),
        tenantId
      };
    });
    useAppStore.setState({ services: localServices });
    const tenantServices = localServices.filter(s => s.tenantId === tenantId && (tenantId === DEMO_TENANT_ID || !isDemoService(s)));
    for (const service of tenantServices) {
      await saveServiceToSupabase(service);
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(pushFlagKey, 'true');
    }
  } catch (err) {
    console.warn('Error en pushLocalDataToCloud:', err);
  }
}

/**
 * Downloads and synchronizes full business state across devices.
 * Uses batching, concurrency mutex, and request throttling to avoid HTTP/2 connection resets (ERR_CONNECTION_CLOSED).
 */
let isSyncingCloudData = false;
let lastSyncTimestamp = 0;
const MIN_SYNC_INTERVAL_MS = 6000;

export async function syncAllCloudData(tenantId: string) {
  if (!isSupabaseConfigured() || !isValidUUID(tenantId) || (typeof navigator !== 'undefined' && !navigator.onLine)) return;

  if (isSyncingCloudData) {
    return;
  }
  const now = Date.now();
  if (now - lastSyncTimestamp < MIN_SYNC_INTERVAL_MS) {
    return;
  }

  isSyncingCloudData = true;

  try {
    // Batch 1: Essential Catalogs (Products, Fiscal Ranges, Profiles)
    const [liveProducts, liveRanges, liveProfiles] = await Promise.all([
      fetchProductsFromSupabase(tenantId).catch(() => null),
      fetchFiscalRangesFromSupabase(tenantId).catch(() => null),
      fetchProfilesFromSupabase(tenantId).catch(() => null)
    ]);

    // Batch 2: Commercial & Operational Data (Suppliers, Movements, Expenses, Services, Staff, Appointments)
    const [liveSuppliers, liveMovements, liveExpenses, liveServices, liveStaff, liveAppointments] = await Promise.all([
      fetchSuppliersFromSupabase(tenantId).catch(() => null),
      fetchCashMovementsFromSupabase(tenantId).catch(() => null),
      fetchExpensesFromSupabase(tenantId).catch(() => null),
      fetchServicesFromSupabase(tenantId).catch(() => null),
      fetchStaffFromSupabase(tenantId).catch(() => null),
      fetchAppointmentsFromSupabase(tenantId).catch(() => null)
    ]);

    // Batch 3: Food & Restaurant Module (Menu Items, Drivers, Food Orders)
    // Only query if food module is enabled, avoiding wasteful egress and Supabase billing for retail stores
    const isFoodEnabled = Boolean(
      getStoredTenantFoodEnabled(tenantId) ||
      useAppStore.getState().tenant?.isFoodEnabled ||
      useAppStore.getState().tenant?.businessType === 'FOOD'
    );
    const [liveMenuItems, liveDrivers, liveFoodOrders] = isFoodEnabled
      ? await Promise.all([
          fetchMenuItemsFromSupabase(tenantId).catch(() => null),
          fetchDeliveryDriversFromSupabase(tenantId).catch(() => null),
          fetchFoodOrdersFromSupabase(tenantId).catch(() => null)
        ])
      : [null, null, null];

    // Batch 4: Sales and Shifts reusing already downloaded products, ranges, and profiles
    const [liveSales, liveShifts] = await Promise.all([
      fetchSalesFromSupabase(tenantId, liveRanges, liveProducts).catch(() => null),
      fetchShiftsFromSupabase(tenantId, liveProfiles, liveRanges).catch(() => null)
    ]);

    useAppStore.setState(state => {
      // 1. Products
      let products = state.products;
      if (liveProducts !== null) {
        const cleanLiveProducts = (tenantId === DEMO_TENANT_ID 
          ? liveProducts 
          : liveProducts.filter(p => !isDemoProduct(p))).map(lp => {
            const existing = state.products.find(p => p.id === lp.id);
            const mergedPresentations = (lp.presentations && lp.presentations.length > 0)
              ? lp.presentations
              : (existing?.presentations && existing.presentations.length > 0
                  ? existing.presentations
                  : getStoredPresentations(tenantId, lp.id));
            const mergedPriceTypes = (lp.priceTypes && lp.priceTypes.length > 0)
              ? lp.priceTypes
              : (existing?.priceTypes && existing.priceTypes.length > 0
                  ? existing.priceTypes
                  : getStoredPriceTypes(tenantId, lp.id));
            return {
              ...lp,
              presentations: mergedPresentations,
              priceTypes: mergedPriceTypes
            };
          });

        const liveIds = new Set(cleanLiveProducts.map(p => p.id));
        const localOnly = state.products.filter(p => p.tenantId === tenantId && !liveIds.has(p.id) && (tenantId === DEMO_TENANT_ID || !isDemoProduct(p)));
        const otherTenantProds = state.products.filter(p => p.tenantId && p.tenantId !== tenantId);
        products = [...cleanLiveProducts, ...localOnly, ...otherTenantProds];
      }

      // 2. Suppliers
      let suppliers = state.suppliers;
      if (liveSuppliers !== null) {
        const liveIds = new Set(liveSuppliers.map(s => s.id));
        const localOnly = state.suppliers.filter(s => s.tenantId === tenantId && !liveIds.has(s.id));
        const otherTenantSuppliers = state.suppliers.filter(s => s.tenantId && s.tenantId !== tenantId);
        suppliers = [...liveSuppliers, ...localOnly, ...otherTenantSuppliers];
      }

      // 3. Profiles
      let profiles = state.profiles;
      if (liveProfiles !== null && liveProfiles.length > 0) {
        const cleanLiveProfiles = liveProfiles.map(lp => {
          const existing = state.profiles.find(p => p.id === lp.id);
          const mergedPermissions = lp.permissions || existing?.permissions || getStoredPermissions(tenantId, lp.id);
          return {
            ...lp,
            permissions: mergedPermissions
          };
        });
        const liveIds = new Set(cleanLiveProfiles.map(p => p.id));
        const localOnly = state.profiles.filter(p => p.tenantId === tenantId && !liveIds.has(p.id));
        const otherTenantProfiles = state.profiles.filter(p => p.tenantId && p.tenantId !== tenantId);
        profiles = [...cleanLiveProfiles, ...localOnly, ...otherTenantProfiles];
      }

      // 4. Sales
      let sales = state.sales;
      if (liveSales !== null) {
        const localSalesMap = new Map((state.sales || []).map(s => [s.id, s]));
        const mergedLiveSales = liveSales.map(ls => {
          const local = localSalesMap.get(ls.id);
          const effectiveStatus = (local?.status && local.status !== 'COMPLETED') ? local.status : (ls.status || 'COMPLETED');
          const effectiveVoidReason = local?.voidReason || ls.voidReason;
          const effectiveVoidedAt = local?.voidedAt || ls.voidedAt;
          let items = ls.items;

          if (local && local.items && local.items.length > 0) {
            const hasLocalRealNames = local.items.some(i => i.name && i.name !== 'Artículo POS');
            const liveHasOnlyGeneric = !ls.items || ls.items.every(i => !i.name || i.name === 'Artículo POS');
            if (hasLocalRealNames && liveHasOnlyGeneric) {
              items = local.items;
            }
          }
          return {
            ...ls,
            status: effectiveStatus,
            voidReason: effectiveVoidReason,
            voidedAt: effectiveVoidedAt,
            items: items || local?.items || []
          };
        });

        const liveIds = new Set(liveSales.map(s => s.id));
        const liveDocs = new Set(liveSales.map(s => s.documentNumber));
        const localOnly = (state.sales || []).filter(s => s.tenantId === tenantId && !liveIds.has(s.id) && (!s.documentNumber || !liveDocs.has(s.documentNumber)));
        const otherTenantSales = (state.sales || []).filter(s => s.tenantId && s.tenantId !== tenantId);
        sales = [...mergedLiveSales, ...localOnly, ...otherTenantSales];
      }

      // 5. Fiscal Ranges (Cajas)
      let fiscalRanges = state.fiscalRanges;
      let selectedFiscalRangeId = state.selectedFiscalRangeId;
      let fiscalRange = state.fiscalRange;
      if (liveRanges !== null && liveRanges.length > 0) {
        const otherRanges = (state.fiscalRanges || []).filter(r => r.tenantId && r.tenantId !== tenantId);
        fiscalRanges = [...liveRanges, ...otherRanges];
        if (state.selectedFiscalRangeId === 'VIEW_MODE_ADMIN') {
          selectedFiscalRangeId = 'VIEW_MODE_ADMIN';
          fiscalRange = liveRanges[0];
        } else {
          const currentSelected = fiscalRanges.find(r => r.id === state.selectedFiscalRangeId) || liveRanges[0];
          selectedFiscalRangeId = currentSelected.id;
          fiscalRange = currentSelected;
        }
      }

      // 6. Cash Shifts
      let shiftHistory = state.shiftHistory;
      let activeShift = state.activeShift;
      if (liveShifts !== null) {
        const otherTenantShifts = (state.shiftHistory || []).filter(s => s.tenantId && s.tenantId !== tenantId);
        shiftHistory = [...liveShifts, ...otherTenantShifts];

        if (selectedFiscalRangeId === 'VIEW_MODE_ADMIN') {
          activeShift = null;
        } else {
          // Find active open shift for the selected caja strictly by ID
          const openShiftForCaja = liveShifts.find(s => s.tenantId === tenantId && s.status === 'OPEN' && s.fiscalRangeId === selectedFiscalRangeId);
          activeShift = openShiftForCaja || null;
        }
      }

      // 7. Cash Movements
      let cashMovements = state.cashMovements;
      if (liveMovements !== null) {
        const liveIds = new Set(liveMovements.map(m => m.id));
        const localOnly = (state.cashMovements || []).filter(m => m.tenantId === tenantId && !liveIds.has(m.id));
        const otherTenantMovs = (state.cashMovements || []).filter(m => m.tenantId && m.tenantId !== tenantId);
        cashMovements = [...liveMovements, ...localOnly, ...otherTenantMovs];
      }

      // 8. Expenses
      let expenses = state.expenses;
      if (liveExpenses !== null) {
        const liveIds = new Set(liveExpenses.map(e => e.id));
        const localOnly = (state.expenses || []).filter(e => e.tenantId === tenantId && !liveIds.has(e.id));
        const otherTenantExpenses = (state.expenses || []).filter(e => e.tenantId && e.tenantId !== tenantId);
        expenses = [...liveExpenses, ...localOnly, ...otherTenantExpenses];
      }

      // 9. Menu Items
      let menuItems = state.menuItems;
      if (liveMenuItems !== null) {
        const liveIds = new Set(liveMenuItems.map(m => m.id));
        const localOnly = (state.menuItems || []).filter(m => m.tenantId === tenantId && !liveIds.has(m.id));
        const otherTenantItems = (state.menuItems || []).filter(m => m.tenantId && m.tenantId !== tenantId);
        menuItems = [...liveMenuItems, ...localOnly, ...otherTenantItems];
      }

      // 10. Delivery Drivers
      let deliveryDrivers = state.deliveryDrivers;
      if (liveDrivers !== null) {
        const liveIds = new Set(liveDrivers.map(d => d.id));
        const localOnly = (state.deliveryDrivers || []).filter(d => d.tenantId === tenantId && !liveIds.has(d.id));
        const otherTenantDrivers = (state.deliveryDrivers || []).filter(d => d.tenantId && d.tenantId !== tenantId);
        deliveryDrivers = [...liveDrivers, ...localOnly, ...otherTenantDrivers];
      }

      // 11. Food Orders
      let foodOrders = state.foodOrders;
      if (liveFoodOrders !== null) {
        const mergedLiveOrders = liveFoodOrders.map(liveOrder => {
          const localOrder = (state.foodOrders || []).find(o => o.id === liveOrder.id);
          const hasLinkedSaleInStore = Boolean(
            (liveOrder.saleId && (state.sales || []).some(s => s.id === liveOrder.saleId)) ||
            (localOrder?.saleId && (state.sales || []).some(s => s.id === localOrder.saleId))
          );
          const isPaidLocally = Boolean(localOrder?.isPaid || hasLinkedSaleInStore);

          if (isPaidLocally && !liveOrder.isPaid) {
            return {
              ...liveOrder,
              isPaid: true,
              status: (localOrder?.status === 'COMPLETED' || localOrder?.status === 'DELIVERED') 
                ? localOrder.status 
                : (liveOrder.deliveryType === 'DELIVERY' ? 'DELIVERED' : 'COMPLETED'),
              saleId: localOrder?.saleId || liveOrder.saleId,
              paymentMethod: localOrder?.paymentMethod || liveOrder.paymentMethod || 'CASH',
              driverSettled: localOrder?.driverSettled || liveOrder.driverSettled
            };
          }
          return liveOrder;
        });
        const liveIds = new Set(mergedLiveOrders.map(o => o.id));
        const localOnly = (state.foodOrders || []).filter(o => o.tenantId === tenantId && !liveIds.has(o.id));
        const otherTenantOrders = (state.foodOrders || []).filter(o => o.tenantId && o.tenantId !== tenantId);
        foodOrders = [...mergedLiveOrders, ...localOnly, ...otherTenantOrders];
      }

      // 12. Services
      let services = state.services;
      if (liveServices !== null) {
        const cleanLiveServices = (tenantId === DEMO_TENANT_ID 
          ? liveServices 
          : liveServices.filter(s => !isDemoService(s)));
        const liveIds = new Set(cleanLiveServices.map(s => s.id));
        const localOnly = (state.services || []).filter(s => s.tenantId === tenantId && !liveIds.has(s.id) && (tenantId === DEMO_TENANT_ID || !isDemoService(s)));
        const otherTenantServices = (state.services || []).filter(s => s.tenantId && s.tenantId !== tenantId);
        services = [...cleanLiveServices, ...localOnly, ...otherTenantServices];

        // Background migration: push local services not in Supabase yet (e.g. created on this device previously)
        if (tenantId !== DEMO_TENANT_ID && localOnly.length > 0) {
          setTimeout(async () => {
            for (const localS of localOnly) {
              const validUuid = isValidUUID(localS.id) ? localS.id : generateUUID();
              const toSave: Service = { ...localS, id: validUuid, tenantId };
              await saveServiceToSupabase(toSave);
              if (validUuid !== localS.id) {
                useAppStore.setState(s => ({
                  services: s.services.map(srv => srv.id === localS.id ? toSave : srv),
                  appointments: s.appointments.map(app => app.serviceId === localS.id ? { ...app, serviceId: validUuid } : app)
                }));
              }
            }
          }, 300);
        }
      }

      // 13. Staff
      let staff = state.staff;
      if (liveStaff !== null) {
        const cleanLiveStaff = (tenantId === DEMO_TENANT_ID ? liveStaff : liveStaff.filter(st => st.id !== 'staff-1'));
        const liveIds = new Set(cleanLiveStaff.map(st => st.id));
        const localOnly = (state.staff || []).filter(st => st.tenantId === tenantId && !liveIds.has(st.id) && (tenantId === DEMO_TENANT_ID || st.id !== 'staff-1'));
        const otherTenantStaff = (state.staff || []).filter(st => st.tenantId && st.tenantId !== tenantId);
        staff = [...cleanLiveStaff, ...localOnly, ...otherTenantStaff];

        if (tenantId !== DEMO_TENANT_ID && localOnly.length > 0) {
          setTimeout(async () => {
            for (const localSt of localOnly) {
              const validUuid = isValidUUID(localSt.id) ? localSt.id : generateUUID();
              const toSave: Staff = { ...localSt, id: validUuid, tenantId };
              await saveStaffToSupabase(toSave);
              if (validUuid !== localSt.id) {
                useAppStore.setState(s => ({
                  staff: s.staff.map(st => st.id === localSt.id ? toSave : st)
                }));
              }
            }
          }, 400);
        }
      }

      // 14. Appointments
      let appointments = state.appointments;
      if (liveAppointments !== null) {
        const cleanLiveApps = (tenantId === DEMO_TENANT_ID ? liveAppointments : liveAppointments.filter(a => a.id !== 'app-1'));
        const liveIds = new Set(cleanLiveApps.map(a => a.id));
        const localOnly = (state.appointments || []).filter(a => a.tenantId === tenantId && !liveIds.has(a.id) && (tenantId === DEMO_TENANT_ID || a.id !== 'app-1'));
        const otherTenantApps = (state.appointments || []).filter(a => a.tenantId && a.tenantId !== tenantId);
        appointments = [...cleanLiveApps, ...localOnly, ...otherTenantApps];
      }

      return {
        products,
        suppliers,
        profiles,
        sales,
        fiscalRanges,
        selectedFiscalRangeId,
        fiscalRange,
        shiftHistory,
        activeShift,
        cashMovements,
        expenses,
        menuItems,
        deliveryDrivers,
        foodOrders,
        services,
        staff,
        appointments
      };
    });
  } catch (err) {
    console.warn('Error en syncAllCloudData:', err);
  } finally {
    isSyncingCloudData = false;
    lastSyncTimestamp = Date.now();
  }
}

/**
 * Processes any items currently queued in offlineQueue and pushes them to Supabase
 */
let isProcessingOfflineQueue = false;

export async function processOfflineQueue() {
  if (!isSupabaseConfigured() || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
  if (isProcessingOfflineQueue) return;

  const state = useAppStore.getState();
  const queue = state.offlineQueue || [];
  if (queue.length === 0) return;

  isProcessingOfflineQueue = true;
  console.log(`Procesando cola offline (${queue.length} elementos)...`);

  try {
    for (const item of queue) {
      try {
        let success = false;
        if (item.type === 'SALE') {
          const res = await saveSaleToSupabase(item.payload);
          if (res) success = true;
        } else if (item.type === 'SHIFT') {
          const res = await saveCashShiftToSupabase(item.payload);
          if (res) success = true;
        } else if (item.type === 'MOVEMENT') {
          const res = await saveCashMovementToSupabase(item.payload);
          if (res) success = true;
        } else if (item.type === 'EXPENSE') {
          const res = await saveExpenseToSupabase(item.payload);
          if (res) success = true;
        } else if (item.type === 'FOOD_ORDER') {
          const res = await saveFoodOrderToSupabase(item.payload);
          if (res) success = true;
        } else if (item.type === 'SERVICE') {
          const res = await saveServiceToSupabase(item.payload);
          if (res) success = true;
        }

        if (success) {
          state.removeOfflineItem(item.id);
        }
      } catch (err) {
        console.warn(`Error procesando elemento offline ${item.id}:`, err);
      }
    }
  } finally {
    isProcessingOfflineQueue = false;
  }
}

/**
 * =========================================================================
 * FOOD & RESTAURANT MODULE SUPABASE INTEGRATION
 * =========================================================================
 */

export async function fetchMenuItemsFromSupabase(tenantId: string): Promise<MenuItem[] | null> {
  if (!isSupabaseConfigured() || !isValidUUID(tenantId)) return null;

  try {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('tenant_id', tenantId);

    if (error) {
      // If table has not been created yet in Supabase, fail gracefully
      return null;
    }

    if (!data) return [];

    return data.map((m: any) => ({
      id: m.id,
      tenantId: m.tenant_id,
      name: m.name,
      category: m.category || 'General',
      price: Number(m.price) || 0,
      taxClassification: m.tax_classification || 'EXENTO',
      isAvailable: Boolean(m.is_available),
      availableExtras: Array.isArray(m.available_extras) ? m.available_extras : [],
      defaultNotes: Array.isArray(m.default_notes) ? m.default_notes : [],
      createdAt: m.created_at || new Date().toISOString()
    }));
  } catch (err) {
    return null;
  }
}

export async function saveMenuItemToSupabase(item: MenuItem): Promise<boolean> {
  if (!isSupabaseConfigured() || !isValidUUID(item.tenantId)) return false;

  try {
    const { error } = await supabase.from('menu_items').upsert({
      id: isValidUUID(item.id) ? item.id : generateUUID(),
      tenant_id: item.tenantId,
      name: item.name,
      category: item.category || 'General',
      price: item.price,
      tax_classification: item.taxClassification || 'EXENTO',
      is_available: item.isAvailable,
      available_extras: item.availableExtras || [],
      default_notes: item.defaultNotes || []
    }, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase save menu item info:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

export async function deleteMenuItemFromSupabase(id: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !isValidUUID(id)) return false;

  try {
    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (error) {
      console.warn('Supabase delete menu item info:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

export async function fetchDeliveryDriversFromSupabase(tenantId: string): Promise<DeliveryDriver[] | null> {
  if (!isSupabaseConfigured() || !isValidUUID(tenantId)) return null;

  try {
    const { data, error } = await supabase
      .from('delivery_drivers')
      .select('*')
      .eq('tenant_id', tenantId);

    if (error || !data) return null;

    return data.map((d: any) => ({
      id: d.id,
      tenantId: d.tenant_id,
      fullName: d.full_name,
      phone: d.phone || undefined,
      driverType: d.driver_type || 'INTERNAL',
      isActive: Boolean(d.is_active),
      createdAt: d.created_at || new Date().toISOString()
    }));
  } catch (err) {
    return null;
  }
}

export async function saveDeliveryDriverToSupabase(driver: DeliveryDriver): Promise<boolean> {
  if (!isSupabaseConfigured() || !isValidUUID(driver.tenantId)) return false;

  try {
    const { error } = await supabase.from('delivery_drivers').upsert({
      id: isValidUUID(driver.id) ? driver.id : generateUUID(),
      tenant_id: driver.tenantId,
      full_name: driver.fullName,
      phone: driver.phone || null,
      driver_type: driver.driverType,
      is_active: driver.isActive
    }, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase save delivery driver info:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

export async function deleteDeliveryDriverFromSupabase(id: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !isValidUUID(id)) return false;

  try {
    const { error } = await supabase.from('delivery_drivers').delete().eq('id', id);
    if (error) {
      console.warn('Supabase delete delivery driver info:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

export async function fetchFoodOrdersFromSupabase(tenantId: string): Promise<FoodOrder[] | null> {
  if (!isSupabaseConfigured() || !isValidUUID(tenantId)) return null;

  try {
    const { data, error } = await supabase
      .from('food_orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(150);

    if (error || !data) return null;

    return data.map((o: any) => ({
      id: o.id,
      tenantId: o.tenant_id,
      orderNumber: o.order_number,
      deliveryType: o.delivery_type,
      status: o.status,
      tableNumber: o.table_number || undefined,
      customerName: o.customer_name || undefined,
      customerPhone: o.customer_phone || undefined,
      deliveryPhone: o.delivery_phone || undefined,
      deliveryAddress: o.delivery_address || undefined,
      deliveryFee: Number(o.delivery_fee) || 0,
      driverId: o.driver_id || undefined,
      deliveryDriverId: o.driver_id || undefined,
      driverName: o.driver_name || undefined,
      driverType: o.driver_type || undefined,
      driverSettled: Boolean(o.driver_settled),
      items: Array.isArray(o.items) ? o.items : [],
      subtotal: Number(o.subtotal) || 0,
      total: Number(o.total) || 0,
      paymentMethod: o.payment_method || undefined,
      isPaid: Boolean(o.is_paid),
      saleId: o.sale_id || undefined,
      createdAt: o.created_at || new Date().toISOString()
    }));
  } catch (err) {
    return null;
  }
}

export async function saveFoodOrderToSupabase(order: FoodOrder): Promise<boolean> {
  if (!isSupabaseConfigured() || !isValidUUID(order.tenantId)) return false;

  try {
    const resolvedDriverId = isValidUUID(order.driverId)
      ? order.driverId
      : (isValidUUID(order.deliveryDriverId) ? order.deliveryDriverId : null);

    let { error } = await supabase.from('food_orders').upsert({
      id: isValidUUID(order.id) ? order.id : generateUUID(),
      tenant_id: order.tenantId,
      order_number: order.orderNumber,
      delivery_type: order.deliveryType,
      status: order.status,
      table_number: order.tableNumber || null,
      customer_name: order.customerName || null,
      customer_phone: order.customerPhone || null,
      delivery_phone: order.deliveryPhone || null,
      delivery_address: order.deliveryAddress || null,
      delivery_fee: order.deliveryFee || 0,
      driver_id: resolvedDriverId,
      driver_name: order.driverName || null,
      driver_type: order.driverType || null,
      driver_settled: order.driverSettled ?? false,
      items: order.items || [],
      subtotal: order.subtotal,
      total: order.total,
      payment_method: order.paymentMethod || null,
      is_paid: order.isPaid ?? false,
      sale_id: isValidUUID(order.saleId) ? order.saleId : null
    }, { onConflict: 'id' });

    // Fallback if foreign key on sale_id fails (e.g. sale insert in-flight or offline)
    if (error && order.saleId) {
      const fallback = await supabase.from('food_orders').upsert({
        id: isValidUUID(order.id) ? order.id : generateUUID(),
        tenant_id: order.tenantId,
        order_number: order.orderNumber,
        delivery_type: order.deliveryType,
        status: order.status,
        table_number: order.tableNumber || null,
        customer_name: order.customerName || null,
        customer_phone: order.customerPhone || null,
        delivery_phone: order.deliveryPhone || null,
        delivery_address: order.deliveryAddress || null,
        delivery_fee: order.deliveryFee || 0,
        driver_id: resolvedDriverId,
        driver_name: order.driverName || null,
        driver_type: order.driverType || null,
        driver_settled: order.driverSettled ?? false,
        items: order.items || [],
        subtotal: order.subtotal,
        total: order.total,
        payment_method: order.paymentMethod || null,
        is_paid: order.isPaid ?? false,
        sale_id: null
      }, { onConflict: 'id' });
      if (!fallback.error) {
        error = null;
      }
    }

    if (error) {
      console.warn('Supabase save food order info:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Synchronize Food Module Data on-demand when entering the Food / Menu view.
 * Prevents redundant database queries and reduces egress/Supabase billing.
 */
let isSyncingFoodData = false;
export async function syncFoodModuleData(tenantId: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !isValidUUID(tenantId) || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return false;
  }
  if (isSyncingFoodData) return false;
  isSyncingFoodData = true;

  try {
    const [liveMenuItems, liveDrivers, liveFoodOrders] = await Promise.all([
      fetchMenuItemsFromSupabase(tenantId).catch(() => null),
      fetchDeliveryDriversFromSupabase(tenantId).catch(() => null),
      fetchFoodOrdersFromSupabase(tenantId).catch(() => null)
    ]);

    useAppStore.setState(state => {
      let menuItems = state.menuItems;
      if (liveMenuItems !== null) {
        menuItems = liveMenuItems;
      }
      let deliveryDrivers = state.deliveryDrivers;
      if (liveDrivers !== null) {
        deliveryDrivers = liveDrivers;
      }
      let foodOrders = state.foodOrders;
      if (liveFoodOrders !== null) {
        const liveIds = new Set(liveFoodOrders.map(o => o.id));
        const localOnly = (state.foodOrders || []).filter(o => o.tenantId === tenantId && !liveIds.has(o.id));
        foodOrders = [...liveFoodOrders, ...localOnly];
      }
      return { menuItems, deliveryDrivers, foodOrders };
    });
    return true;
  } catch (err) {
    console.warn('Error syncing food module data:', err);
    return false;
  } finally {
    isSyncingFoodData = false;
  }
}

/**
 * =========================================================================
 * SERVICES, STAFF & APPOINTMENTS SUPABASE INTEGRATION
 * =========================================================================
 */

let isServicesExtraColsAvailable: boolean | null = null;

export async function fetchServicesFromSupabase(tenantId: string): Promise<Service[] | null> {
  if (!isSupabaseConfigured() || !isValidUUID(tenantId)) return null;

  try {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('tenant_id', tenantId);

    if (error) {
      console.warn('Supabase fetch services warning:', error.message);
      return null;
    }

    if (!data) return [];

    return data.map((s: any) => ({
      id: s.id,
      tenantId: s.tenant_id,
      name: s.name,
      durationMinutes: Number(s.duration_minutes) || 30,
      price: Number(s.price) || 0,
      commissionType: (s.commission_type as 'PERCENTAGE' | 'FIXED') || 'PERCENTAGE',
      commissionValue: Number(s.commission_value) || 0,
      isActive: Boolean(s.is_active ?? true),
      taxClassification: s.tax_classification || undefined,
      supplies: Array.isArray(s.supplies) ? s.supplies : (getStoredServiceSupplies(tenantId, s.id) || [])
    }));
  } catch (err) {
    console.warn('Error fetching services from Supabase:', err);
    return null;
  }
}

export async function saveServiceToSupabase(service: Service): Promise<Service | null> {
  if (!isSupabaseConfigured() || !isValidUUID(service.tenantId)) return null;
  if (service.tenantId !== DEMO_TENANT_ID && isDemoService(service)) return null;

  try {
    const serviceUuid = isValidUUID(service.id) ? service.id : generateUUID();

    if (service.supplies && service.supplies.length > 0) {
      backupServiceSupplies(service.tenantId, serviceUuid, service.supplies);
      if (service.id && service.id !== serviceUuid) {
        backupServiceSupplies(service.tenantId, service.id, service.supplies);
      }
    }

    const payload: any = {
      id: serviceUuid,
      tenant_id: service.tenantId,
      name: service.name,
      duration_minutes: Number(service.durationMinutes) || 30,
      price: Number(service.price) || 0,
      commission_type: service.commissionType || 'PERCENTAGE',
      commission_value: Number(service.commissionValue) || 0,
      is_active: service.isActive ?? true
    };

    if (isServicesExtraColsAvailable !== false) {
      if (service.taxClassification) payload.tax_classification = service.taxClassification;
      if (service.supplies) payload.supplies = service.supplies;
    }

    let { data, error } = await supabase.from('services').upsert(payload, { onConflict: 'id' }).select().single();
    if (error && (error.message.includes('column') || error.code === 'PGRST204')) {
      isServicesExtraColsAvailable = false;
      delete payload.tax_classification;
      delete payload.supplies;
      const retry = await supabase.from('services').upsert(payload, { onConflict: 'id' }).select().single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.warn('Supabase save service error:', error.message);
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        useAppStore.getState().enqueueOfflineItem({
          id: generateUUID(),
          tenantId: service.tenantId,
          type: 'SERVICE' as any,
          payload: { ...service, id: serviceUuid }
        });
      }
      return null;
    }

    return {
      ...service,
      id: serviceUuid
    };
  } catch (err) {
    console.warn('Exception saving service to Supabase:', err);
    return null;
  }
}

export async function deleteServiceSupabase(id: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !isValidUUID(id)) return false;

  try {
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) {
      console.warn('Error deleting service from Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Exception deleting service from Supabase:', err);
    return false;
  }
}

export async function fetchStaffFromSupabase(tenantId: string): Promise<Staff[] | null> {
  if (!isSupabaseConfigured() || !isValidUUID(tenantId)) return null;

  try {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('tenant_id', tenantId);

    if (error || !data) return null;

    return data.map((st: any) => ({
      id: st.id,
      tenantId: st.tenant_id,
      profileId: st.profile_id || undefined,
      fullName: st.full_name,
      phone: st.phone || undefined,
      isActive: Boolean(st.is_active ?? true)
    }));
  } catch (err) {
    return null;
  }
}

export async function saveStaffToSupabase(staff: Staff): Promise<Staff | null> {
  if (!isSupabaseConfigured() || !isValidUUID(staff.tenantId)) return null;

  try {
    const staffUuid = isValidUUID(staff.id) ? staff.id : generateUUID();
    const payload: any = {
      id: staffUuid,
      tenant_id: staff.tenantId,
      full_name: staff.fullName,
      phone: staff.phone || null,
      is_active: staff.isActive ?? true
    };
    if (staff.profileId && isValidUUID(staff.profileId)) {
      payload.profile_id = staff.profileId;
    }

    const { error } = await supabase.from('staff').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn('Supabase save staff warning:', error.message);
      return null;
    }
    return { ...staff, id: staffUuid };
  } catch (err) {
    return null;
  }
}

export async function deleteStaffSupabase(id: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !isValidUUID(id)) return false;

  try {
    const { error } = await supabase.from('staff').delete().eq('id', id);
    return !error;
  } catch (err) {
    return false;
  }
}

export async function fetchAppointmentsFromSupabase(tenantId: string): Promise<Appointment[] | null> {
  if (!isSupabaseConfigured() || !isValidUUID(tenantId)) return null;

  try {
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('tenant_id', tenantId);

    if (error || !data) return null;

    return data.map((a: any) => ({
      id: a.id,
      tenantId: a.tenant_id,
      customerName: a.customer_name,
      customerPhone: a.customer_phone || undefined,
      staffId: a.staff_id,
      serviceId: a.service_id,
      scheduledAt: a.scheduled_at,
      status: a.status || 'SCHEDULED',
      notes: a.notes || undefined
    }));
  } catch (err) {
    return null;
  }
}

export async function saveAppointmentToSupabase(app: Appointment): Promise<Appointment | null> {
  if (!isSupabaseConfigured() || !isValidUUID(app.tenantId)) return null;
  if (!isValidUUID(app.staffId) || !isValidUUID(app.serviceId)) return null;

  try {
    const appUuid = isValidUUID(app.id) ? app.id : generateUUID();
    const payload: any = {
      id: appUuid,
      tenant_id: app.tenantId,
      customer_name: app.customerName,
      customer_phone: app.customerPhone || null,
      staff_id: app.staffId,
      service_id: app.serviceId,
      scheduled_at: app.scheduledAt,
      status: app.status || 'SCHEDULED',
      notes: app.notes || null
    };

    const { error } = await supabase.from('appointments').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn('Supabase save appointment warning:', error.message);
      return null;
    }
    return { ...app, id: appUuid };
  } catch (err) {
    return null;
  }
}

export async function deleteAppointmentSupabase(id: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !isValidUUID(id)) return false;

  try {
    const { error } = await supabase.from('appointments').delete().eq('id', id);
    return !error;
  } catch (err) {
    return false;
  }
}



