import { supabase, isSupabaseConfigured } from './supabase';
import { Product, Sale, PurchaseInvoice, Supplier, Service, Tenant, FiscalRange, UserProfile, CashShift, CashMovement, Expense, ProductPresentation, UserPermissions, MenuItem, DeliveryDriver, FoodOrder } from '../types';
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

let isPresentationsDbColumnAvailable: boolean | null = null;
let isPermissionsDbColumnAvailable: boolean | null = null;

if (typeof localStorage !== 'undefined') {
  const cachedPres = localStorage.getItem('micuadre_col_presentations_exists');
  if (cachedPres === '1') isPresentationsDbColumnAvailable = true;
  else if (cachedPres === '0') isPresentationsDbColumnAvailable = false;

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
    accessPassword: data.access_password || undefined
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
      accessPassword: t.access_password || undefined
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
      access_password: tenant.accessPassword || null
    }, { onConflict: 'id' });

    // Fallback: If older database schema lacks newer columns, retry with base columns
    if (error && error.message.includes('column')) {
      console.warn('Reintentando guardar tenant con esquema base en Supabase:', error.message);
      const retry = await supabase.from('tenants').upsert({
        id: tenant.id,
        name: tenant.name,
        rtn: tenant.rtn || null,
        phone: tenant.phone || null,
        email: tenant.email || null,
        address: tenant.address || null,
        business_type: tenant.businessType,
        is_fiscal_enabled: tenant.isFiscalEnabled
      }, { onConflict: 'id' });
      error = retry.error;
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
  const localTenants = (window as any).__micuadre_local_tenants || [];
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

    let { data, error } = await supabase.from('products').upsert(payload, { onConflict: 'id' }).select().single();
    if (error && (error.message.includes('column') || error.message.includes('presentations') || error.code === 'PGRST204')) {
      setIsPresentationsDbColumnAvailable(false);
      const { presentations, ...fallbackPayload } = payload;
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
    const [salesRes, ranges, products] = await Promise.all([
      supabase
        .from('sales')
        .select('*, sale_items(*)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(150),
      preloadedRanges !== undefined ? Promise.resolve(preloadedRanges) : fetchFiscalRangesFromSupabase(tenantId),
      preloadedProducts !== undefined ? Promise.resolve(preloadedProducts) : fetchProductsFromSupabase(tenantId)
    ]);

    const data = salesRes.data;
    if (salesRes.error || !data) return null;

    const caiRangeMap = new Map((ranges || []).map(r => [r.cai, r.name]));
    const productMap = new Map((products || []).map(p => [p.id, p.name]));
    const productSkuMap = new Map((products || []).map(p => [p.id, p.sku]));
    const defaultCajaName = (ranges && ranges.length > 0 && ranges[0].name) ? ranges[0].name : 'Caja 1 - Principal';

    return data.map((s: any) => ({
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
      customerName: s.customer_name || 'Consumidor Final',
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
      createdAt: s.created_at,
      items: (() => {
        const rawItems = s.sale_items || [];
        const uniqueItemsMap = new Map<string, any>();
        rawItems.forEach((i: any) => {
          const itemKey = i.id || `${i.product_id}_${i.service_id}_${i.quantity}_${i.unit_price}_${i.subtotal}`;
          if (!uniqueItemsMap.has(itemKey)) {
            uniqueItemsMap.set(itemKey, i);
          }
        });
        return Array.from(uniqueItemsMap.values()).map((i: any) => ({
          id: i.id,
          productId: i.product_id,
          serviceId: i.service_id,
          staffId: i.staff_id,
          name: i.product_name || (i.product_id && productMap.get(i.product_id)) || 'Artículo POS',
          sku: i.sku || (i.product_id && productSkuMap.get(i.product_id)) || '',
          quantity: Number(i.quantity || 1),
          unitPrice: Number(i.unit_price || 0),
          originalUnitPrice: Number(i.unit_price || 0),
          discountAmount: Number(i.discount_amount || 0),
          subtotal: Number(i.subtotal || 0),
          taxClassification: i.tax_classification || 'EXENTO',
          taxAmount: Number(i.tax_amount || 0),
          total: Number(i.subtotal || 0) + Number(i.tax_amount || 0)
        }));
      })()
    }));
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
      reference_id: movement.referenceId || null
    };

    const { data, error } = await supabase
      .from('cash_movements')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.warn('Error inserting cash_movement to Supabase:', error.message);
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
      fund_id: (expense.fundId && isValidUUID(expense.fundId)) ? expense.fundId : null,
      created_at: expense.createdAt || new Date().toISOString()
    };

    const { data, error } = await supabase.from('expenses').insert(payload).select().single();
    if (error) console.warn('Supabase insert expense info:', error.message);
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
 * Pushes any un-synced local sales, shifts, cash movements, and expenses to Supabase
 */
export async function pushLocalDataToCloud(tenantId: string) {
  if (!isSupabaseConfigured() || !isValidUUID(tenantId)) return;

  try {
    const state = useAppStore.getState();

    // 1. Push local sales (re-assigning non-UUID local IDs if needed)
    const localSales = (state.sales || []).map(s => {
      const isThisTenant = s.tenantId ? s.tenantId === tenantId : tenantId === DEMO_TENANT_ID;
      if (!isThisTenant) return s;
      return {
        ...s,
        id: isValidUUID(s.id) ? s.id : generateUUID(),
        tenantId
      };
    });

    useAppStore.setState({ sales: localSales });

    const tenantSales = localSales.filter(s => s.tenantId === tenantId);
    for (const sale of tenantSales) {
      await saveSaleToSupabase(sale);
    }

    // 2. Push local shifts
    const localShifts = (state.shiftHistory || []).map(s => {
      const isThisTenant = s.tenantId ? s.tenantId === tenantId : tenantId === DEMO_TENANT_ID;
      if (!isThisTenant) return s;
      return {
        ...s,
        id: isValidUUID(s.id) ? s.id : generateUUID(),
        tenantId
      };
    });

    useAppStore.setState({ shiftHistory: localShifts });

    const tenantShifts = localShifts.filter(s => s.tenantId === tenantId);
    for (const shift of tenantShifts) {
      await saveCashShiftToSupabase(shift);
    }

    // 3. Push local fiscal ranges
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

    // 4. Push local products
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
  } catch (err) {
    console.warn('Error en pushLocalDataToCloud:', err);
  }
}

/**
 * Downloads and synchronizes full business state across devices
 */
export async function syncAllCloudData(tenantId: string) {
  if (!isSupabaseConfigured() || !isValidUUID(tenantId) || (typeof navigator !== 'undefined' && !navigator.onLine)) return;

  try {
    // 1. Fetch foundational catalog & reference data in parallel
    const [liveProducts, liveSuppliers, liveProfiles, liveRanges, liveMovements, liveExpenses, liveMenuItems, liveDrivers, liveFoodOrders] = await Promise.all([
      fetchProductsFromSupabase(tenantId),
      fetchSuppliersFromSupabase(tenantId),
      fetchProfilesFromSupabase(tenantId),
      fetchFiscalRangesFromSupabase(tenantId),
      fetchCashMovementsFromSupabase(tenantId),
      fetchExpensesFromSupabase(tenantId),
      fetchMenuItemsFromSupabase(tenantId),
      fetchDeliveryDriversFromSupabase(tenantId),
      fetchFoodOrdersFromSupabase(tenantId)
    ]);

    // 2. Fetch sales and shifts reusing already downloaded products, ranges, and profiles
    const [liveSales, liveShifts] = await Promise.all([
      fetchSalesFromSupabase(tenantId, liveRanges, liveProducts),
      fetchShiftsFromSupabase(tenantId, liveProfiles, liveRanges)
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
            return {
              ...lp,
              presentations: mergedPresentations
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
        const liveIds = new Set(liveSales.map(s => s.id));
        const liveDocs = new Set(liveSales.map(s => s.documentNumber));
        const localOnly = (state.sales || []).filter(s => s.tenantId === tenantId && !liveIds.has(s.id) && (!s.documentNumber || !liveDocs.has(s.documentNumber)));
        const otherTenantSales = (state.sales || []).filter(s => s.tenantId && s.tenantId !== tenantId);
        sales = [...liveSales, ...localOnly, ...otherTenantSales];
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
        const liveIds = new Set(liveFoodOrders.map(o => o.id));
        const localOnly = (state.foodOrders || []).filter(o => o.tenantId === tenantId && !liveIds.has(o.id));
        const otherTenantOrders = (state.foodOrders || []).filter(o => o.tenantId && o.tenantId !== tenantId);
        foodOrders = [...liveFoodOrders, ...localOnly, ...otherTenantOrders];
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
        foodOrders
      };
    });
  } catch (err) {
    console.warn('Error en syncAllCloudData:', err);
  }
}

/**
 * Processes any items currently queued in offlineQueue and pushes them to Supabase
 */
export async function processOfflineQueue() {
  if (!isSupabaseConfigured() || (typeof navigator !== 'undefined' && !navigator.onLine)) return;

  const state = useAppStore.getState();
  const queue = state.offlineQueue || [];
  if (queue.length === 0) return;

  console.log(`Procesando cola offline (${queue.length} elementos)...`);

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
      }

      if (success) {
        state.removeOfflineItem(item.id);
      }
    } catch (err) {
      console.warn(`Error procesando elemento offline ${item.id}:`, err);
    }
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
      .eq('tenant_id', tenantId);

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

    const { error } = await supabase.from('food_orders').upsert({
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

    if (error) {
      console.warn('Supabase save food order info:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

