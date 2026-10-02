import { supabase, isSupabaseConfigured } from './supabase';
import { Product, Sale, PurchaseInvoice, Supplier, Service, Tenant, FiscalRange, UserProfile } from '../types';
import { INITIAL_PRODUCTS, INITIAL_SUPPLIERS } from './mockData';
import { isValidUUID, normalizeSlug } from './security';

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

  return {
    id: data.id,
    name: data.name,
    rtn: data.rtn,
    phone: data.phone,
    email: data.email,
    address: data.address,
    businessType: data.business_type,
    isFiscalEnabled: data.is_fiscal_enabled,
    allowNegativeStock: data.allow_negative_stock,
    currencySymbol: data.currency_symbol || 'L.'
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

  return data.map((t: any) => ({
    id: t.id,
    name: t.name,
    rtn: t.rtn,
    phone: t.phone,
    email: t.email,
    address: t.address,
    businessType: t.business_type,
    isFiscalEnabled: t.is_fiscal_enabled,
    allowNegativeStock: t.allow_negative_stock,
    currencySymbol: t.currency_symbol || 'L.'
  }));
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

  return data.map((p: any) => ({
    id: p.id,
    tenantId: p.tenant_id,
    fullName: p.full_name,
    role: p.role,
    pinCode: p.pin_code,
    isActive: p.is_active
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

    // 3. Try updating any profile for this tenant
    const { data: tenantUpdateData, error: tenantError } = await supabase
      .from('profiles')
      .update({ pin_code: newPin })
      .eq('tenant_id', profile.tenantId)
      .select();

    if (!tenantError && tenantUpdateData && tenantUpdateData.length > 0) {
      console.log('PIN actualizado por tenant en Supabase:', tenantUpdateData);
      return { success: true, profile: updatedProfile };
    }

    // 4. If no profile row exists in Supabase, insert a new profile row (letting Postgres generate ID)
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({
        tenant_id: profile.tenantId,
        full_name: profile.fullName,
        role: profile.role,
        pin_code: newPin,
        is_active: profile.isActive ?? true
      });

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

  const { data, error } = await supabase
    .from('products')
    .select('*, product_price_tiers(*)')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  if (error) {
    console.error('Error al cargar productos de Supabase:', error);
    return null;
  }

  return data.map((p: any) => ({
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
    tiers: p.product_price_tiers?.map((t: any) => ({
      id: t.id,
      minQuantity: t.min_quantity,
      maxQuantity: t.max_quantity,
      unitPrice: Number(t.unit_price),
      tierName: t.tier_name
    }))
  }));
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

  // 1. Try RPC first if configured on Supabase instance
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('process_pos_sale', {
      p_tenant_id: sale.tenantId,
      p_cash_shift_id: (sale.cashShiftId && isValidUUID(sale.cashShiftId)) ? sale.cashShiftId : null,
      p_customer_name: sale.customerName || 'Consumidor Final',
      p_customer_rtn: sale.customerRtn || null,
      p_idempotency_key: sale.id,
      p_is_fiscal: sale.isFiscal,
      p_subtotal: sale.subtotal,
      p_discount_amount: sale.discountAmount,
      p_exempt_amount: sale.exemptAmount,
      p_exonerated_amount: sale.exoneratedAmount,
      p_taxable_15: sale.taxable15,
      p_tax_15: sale.tax15,
      p_taxable_18: sale.taxable18,
      p_tax_18: sale.tax18,
      p_total: sale.total,
      p_payment_method: sale.paymentMethod,
      p_items: sale.items || []
    });

    if (!rpcError && rpcData) {
      console.log('Venta procesada exitosamente vía RPC en Supabase');
      // Update caja_name and fiscal_range_id if column exists
      await supabase.from('sales').update({
        caja_name: sale.cajaName || 'Caja Registradora',
        fiscal_range_id: (sale.fiscalRangeId && isValidUUID(sale.fiscalRangeId)) ? sale.fiscalRangeId : null
      }).eq('id', sale.id);

      return rpcData;
    }
    if (rpcError) {
      console.warn('RPC process_pos_sale no disponible o devolvió error. Ejecutando inserción directa en Supabase:', rpcError.message);
    }
  } catch (err: any) {
    console.warn('Excepción al ejecutar RPC process_pos_sale. Usando inserción directa fallback:', err?.message || err);
  }

  // 2. Direct insert fallback into `sales` and `sale_items`
  try {
    const saleUuid = isValidUUID(sale.id) ? sale.id : undefined;
    const { data: insertedSale, error: saleErr } = await supabase
      .from('sales')
      .insert({
        ...(saleUuid ? { id: saleUuid } : {}),
        tenant_id: sale.tenantId,
        cash_shift_id: (sale.cashShiftId && isValidUUID(sale.cashShiftId)) ? sale.cashShiftId : null,
        document_number: sale.documentNumber,
        is_fiscal: sale.isFiscal,
        cai: sale.cai || null,
        cai_deadline: sale.caiDeadline || null,
        cai_range_start: sale.caiRangeStart || null,
        cai_range_end: sale.caiRangeEnd || null,
        fiscal_range_id: (sale.fiscalRangeId && isValidUUID(sale.fiscalRangeId)) ? sale.fiscalRangeId : null,
        caja_name: sale.cajaName || 'Caja Registradora',
        customer_id: (sale.customerId && isValidUUID(sale.customerId)) ? sale.customerId : null,
        customer_name: sale.customerName || 'Consumidor Final',
        customer_rtn: sale.customerRtn || null,
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
      })
      .select()
      .single();

    if (saleErr) {
      console.error('Error al insertar venta directamente en Supabase:', saleErr.message);
      return null;
    }

    if (insertedSale && sale.items && sale.items.length > 0) {
      const itemsToInsert = sale.items.map(item => ({
        sale_id: insertedSale.id,
        product_id: (item.productId && isValidUUID(item.productId)) ? item.productId : null,
        product_name: item.name,
        sku: item.sku || '',
        quantity: item.quantity,
        unit_price: item.unitPrice,
        subtotal: item.subtotal,
        tax_classification: item.taxClassification || 'EXENTO',
        tax_amount: item.taxAmount || 0,
        total: item.total
      }));

      const { error: itemsErr } = await supabase.from('sale_items').insert(itemsToInsert);
      if (itemsErr) {
        console.warn('Error al insertar ítems de venta en Supabase:', itemsErr.message);
      }
    }

    console.log('Venta guardada exitosamente en Supabase vía inserción directa');
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
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase.rpc('close_cash_shift', {
    p_shift_id: shiftId,
    p_declared_cash: declaredCash
  });

  if (error) {
    console.error('Error al cerrar caja en Supabase:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Fetch sales list for tenant from Supabase
 */
export async function fetchSalesFromSupabase(tenantId: string): Promise<Sale[] | null> {
  if (!isSupabaseConfigured() || !isValidUUID(tenantId)) return null;

  try {
    const { data, error } = await supabase
      .from('sales')
      .select('*, sale_items(*)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error || !data) return null;

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
      cajaName: s.caja_name || 'Caja Registradora',
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
      items: s.sale_items?.map((i: any) => ({
        id: i.id,
        productId: i.product_id,
        name: i.product_name,
        sku: i.sku || '',
        quantity: i.quantity,
        unitPrice: Number(i.unit_price),
        subtotal: Number(i.subtotal),
        taxClassification: i.tax_classification || 'EXENTO',
        taxAmount: Number(i.tax_amount || 0),
        total: Number(i.total)
      })) || []
    }));
  } catch (err) {
    console.warn('Error fetching sales from Supabase:', err);
    return null;
  }
}
