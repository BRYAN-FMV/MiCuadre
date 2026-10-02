import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  Tenant, UserProfile, Product, FiscalRange, CashShift, CashMovement,
  CartLine, Sale, PurchaseInvoice, Supplier, Service, Staff,
  Appointment, StaffCommission, FinancialEvent, FinancialFund, Expense, Customer, AccountPayment
} from '../types';
import {
  INITIAL_TENANT, INITIAL_PROFILES, INITIAL_PRODUCTS,
  INITIAL_FISCAL_RANGE, INITIAL_FISCAL_RANGES, INITIAL_CASH_SHIFT, INITIAL_SUPPLIERS,
  INITIAL_SERVICES, INITIAL_STAFF, INITIAL_APPOINTMENTS, INITIAL_FINANCIAL_EVENTS,
  INITIAL_FUNDS, INITIAL_CUSTOMERS, INITIAL_ACCOUNT_PAYMENTS
} from '../lib/mockData';

import { calculateLineTotals, calculateCartTotals, calculateCPP } from '../lib/monetary';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isValidUUID, generateUUID } from '../lib/security';
import { processPosSaleSupabase, saveSaleToSupabase, closeCashShiftSupabase, saveCashShiftToSupabase, saveCashMovementToSupabase, saveExpenseToSupabase, saveFiscalRangeToSupabase, deleteFiscalRangeSupabase } from '../lib/supabaseService';
import { toast } from 'sonner';

export interface HeldOrder {
  id: string;
  tenantId?: string;
  customerName: string;
  customerRtn?: string;
  lines: CartLine[];
  createdAt: string;
}

interface AppState {
  // Auth & Tenant
  isAuthenticated: boolean;
  tenant: Tenant;
  tenants: Tenant[];
  currentUser: UserProfile;
  profiles: UserProfile[];

  // Fiscal
  fiscalRanges: FiscalRange[];
  selectedFiscalRangeId: string;
  fiscalRange: FiscalRange;

  // Catalog & Inventory
  products: Product[];

  // POS State & Held Orders
  activeShift: CashShift | null;
  shiftHistory: CashShift[];
  cartLines: CartLine[];
  cartCustomer: { id?: string; rtn?: string; name: string; loyaltyPoints?: number };
  heldOrders: HeldOrder[];
  sales: Sale[];

  // Customer Management & Loyalty
  customers: Customer[];
  accountPayments: AccountPayment[];

  // Purchases & Suppliers
  suppliers: Supplier[];
  purchaseInvoices: PurchaseInvoice[];

  // Financial Funds & Expenses
  funds: FinancialFund[];
  expenses: Expense[];

  // Services, Staff & Appointments
  staff: Staff[];
  services: Service[];
  appointments: Appointment[];
  commissions: StaffCommission[];

  // Financial Calendar
  financialEvents: FinancialEvent[];

  // UI Modals
  activeTab: 'pos' | 'inventory' | 'purchases' | 'services' | 'calendar' | 'reports' | 'shifts' | 'settings' | 'superadmin' | 'accounts';
  isDevMode: boolean;
  isShiftModalOpen: boolean;
  isPaymentModalOpen: boolean;
  isOnboardingOpen: boolean;

  // Actions
  logout: () => void;
  setActiveTab: (tab: AppState['activeTab']) => void;
  setDevMode: (enabled: boolean) => void;
  setCurrentUser: (user: UserProfile) => void;
  updateTenantSettings: (settings: Partial<Tenant>) => void;
  addTenant: (tenant: Tenant) => void;
  updateTenant: (id: string, data: Partial<Tenant>) => void;
  deleteTenant: (id: string) => void;
  
  // Fiscal Range Actions
  addFiscalRange: (range: Omit<FiscalRange, 'id' | 'tenantId'>) => void;
  updateFiscalRange: (idOrRange: string | Partial<FiscalRange>, rangeData?: Partial<FiscalRange>) => void;
  deleteFiscalRange: (id: string) => void;
  setSelectedFiscalRange: (id: string) => void;

  // Customer Actions
  addCustomer: (customer: Omit<Customer, 'id' | 'tenantId' | 'loyaltyPoints' | 'totalSpent' | 'createdAt'>) => Customer;
  updateCustomer: (id: string, customer: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;

  // Account Payments & Fiados Actions
  addAccountPayment: (payment: Omit<AccountPayment, 'id' | 'tenantId' | 'createdAt'>) => AccountPayment;
  updateCustomerCreditBalance: (customerId: string, newBalance: number) => void;

  // Product Actions
  addProduct: (product: Omit<Product, 'id' | 'tenantId'>) => void;
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;

  // Cart & Hold Order Actions
  addToCart: (item: { product?: Product; service?: Service; staffId?: string; quantity?: number }) => void;
  updateCartLineQty: (index: number, qty: number) => void;
  updateCartLineStaff: (index: number, staffId: string) => void;
  removeCartLine: (index: number) => void;
  clearCart: () => void;
  setCartCustomer: (customer: { id?: string; rtn?: string; name: string; loyaltyPoints?: number }) => void;
  holdCurrentCart: () => void;
  restoreHeldCart: (heldOrderId: string) => void;
  deleteHeldCart: (heldOrderId: string) => void;

  // Shift Actions & Movements
  cashMovements: CashMovement[];
  openCashShift: (openingAmount: number) => void;
  closeCashShift: (declaredCash: number) => { difference: number; closingSystem: number };
  addCashMovement: (type: 'ENTRADA' | 'SALIDA', amount: number, concept: string, referenceId?: string) => void;

  // Sales Action
  processSale: (paymentMethod: 'CASH' | 'CARD' | 'TRANSFER' | 'MIXED' | 'CREDIT', loyaltyPointsRedeemed?: number, overrideIsFiscal?: boolean) => Sale;

  // Purchase & Supplier Actions
  addSupplier: (supplier: Omit<Supplier, 'id' | 'tenantId'>) => void;
  processPurchase: (purchase: Omit<PurchaseInvoice, 'id' | 'tenantId'>, items: Array<{ productId: string; quantity: number; unitCost: number; newSalePrice?: number }>, paidFromFundId?: string) => void;
  payPurchaseInvoice: (invoiceId: string, fundId: string, amount: number) => void;

  // Fund & Expense Actions
  addFund: (fund: Omit<FinancialFund, 'id' | 'tenantId'>) => void;
  updateFund: (id: string, fund: Partial<FinancialFund>) => void;
  deleteFund: (id: string) => void;
  addExpense: (expense: Omit<Expense, 'id' | 'tenantId' | 'createdAt'> & { createdAt?: string }) => void;
  deleteExpense: (id: string) => void;


  // Appointment Actions
  addAppointment: (appointment: Omit<Appointment, 'id' | 'tenantId'>) => void;
  updateAppointment: (id: string, appointment: Partial<Appointment>) => void;
  deleteAppointment: (id: string) => void;
  updateAppointmentStatus: (id: string, status: Appointment['status']) => void;
  sendAppointmentToPos: (app: Appointment) => void;

  // Staff & Service Actions
  addStaff: (staffMember: Omit<Staff, 'id' | 'tenantId'>) => void;
  addService: (serviceItem: Omit<Service, 'id' | 'tenantId'>) => void;
  updateService: (id: string, service: Partial<Service>) => void;
  deleteService: (id: string) => void;
  payStaffCommissions: (staffId: string) => void;
  payCommissionItem: (commId: string) => void;
  addProfile: (profile: Omit<UserProfile, 'id' | 'tenantId'>) => void;
  addFinancialEvent: (event: Omit<FinancialEvent, 'id' | 'tenantId'>) => void;
  dismissFinancialEvent: (id: string) => void;
  payFinancialEvent: (eventId: string, fundId: string) => void;
  resetToDefaultData: () => void;

  // Mobile Navigation
  isMobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  toggleMobileSidebar: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false, // Show Login / Registration Screen by default on launch
      tenant: INITIAL_TENANT,
      tenants: [INITIAL_TENANT],
      currentUser: INITIAL_PROFILES[0],
      profiles: INITIAL_PROFILES,
      fiscalRanges: INITIAL_FISCAL_RANGES,
      selectedFiscalRangeId: INITIAL_FISCAL_RANGES[0].id,
      fiscalRange: INITIAL_FISCAL_RANGES[0],
      products: INITIAL_PRODUCTS,
      activeShift: INITIAL_CASH_SHIFT,
      shiftHistory: [],
      cashMovements: [],
      cartLines: [],
      cartCustomer: { name: 'Consumidor Final' },
      heldOrders: [],
      sales: [],
      customers: INITIAL_CUSTOMERS,
      accountPayments: INITIAL_ACCOUNT_PAYMENTS,
      suppliers: INITIAL_SUPPLIERS,
      purchaseInvoices: [],
      funds: INITIAL_FUNDS,
      expenses: [],
      staff: INITIAL_STAFF,
      services: INITIAL_SERVICES,
      appointments: INITIAL_APPOINTMENTS,
      commissions: [],
      financialEvents: INITIAL_FINANCIAL_EVENTS,

      activeTab: 'pos',
      isDevMode: false,
      isShiftModalOpen: false,
      isPaymentModalOpen: false,
      isOnboardingOpen: false,
      isMobileSidebarOpen: false,

      setMobileSidebarOpen: (open) => set({ isMobileSidebarOpen: open }),
      toggleMobileSidebar: () => set((s) => ({ isMobileSidebarOpen: !s.isMobileSidebarOpen })),

      logout: () => {
        const state = get();
        const activeShift = state.activeShift;
        const isShiftOpen = activeShift && activeShift.tenantId === state.tenant.id && activeShift.status === 'OPEN';
        const isNonAdmin = state.currentUser?.role !== 'ADMIN';

        if (isNonAdmin && isShiftOpen) {
          toast.warning('Debes realizar el Arqueo Ciego y Cierre Z de caja antes de cerrar sesión.', { duration: 5000 });
          set({ isShiftModalOpen: true });
          return;
        }

        set({ 
          isAuthenticated: false, 
          isDevMode: false,
          cartLines: [],
          cartCustomer: { name: 'Consumidor Final' }
        });
      },
      setActiveTab: (tab) => set({ activeTab: tab }),
      setDevMode: (enabled) => set({ isDevMode: enabled }),
      setCurrentUser: (user) => set((s) => {
        const isTenantChanged = user.tenantId !== s.tenant.id;
        const activeShift = (s.activeShift && s.activeShift.tenantId === user.tenantId) ? s.activeShift : null;
        
        const tenantRanges = (s.fiscalRanges || []).filter(r => !r.tenantId || r.tenantId === user.tenantId);
        const nextFiscalRange = tenantRanges.length > 0 ? (tenantRanges.find(r => r.isDefault) || tenantRanges[0]) : s.fiscalRange;
        const nextFiscalRangeId = nextFiscalRange?.id;

        return {
          currentUser: user,
          isAuthenticated: true,
          activeShift,
          selectedFiscalRangeId: isTenantChanged ? nextFiscalRangeId : (s.selectedFiscalRangeId || nextFiscalRangeId),
          fiscalRange: isTenantChanged ? nextFiscalRange : (s.fiscalRange || nextFiscalRange),
          cartLines: isTenantChanged ? [] : s.cartLines,
          cartCustomer: isTenantChanged ? { name: 'Consumidor Final' } : s.cartCustomer
        };
      }),

      addCustomer: (customerData) => {
        const state = get();
        const newCust: Customer = {
          ...customerData,
          id: `cust-${Date.now()}`,
          tenantId: state.tenant.id,
          loyaltyPoints: 0,
          totalSpent: 0,
          createdAt: new Date().toISOString()
        };

        set((s) => ({ customers: [newCust, ...s.customers] }));
        return newCust;
      },

      updateCustomer: (id, data) => set((state) => ({
        customers: state.customers.map(c => c.id === id ? { ...c, ...data } : c)
      })),

      deleteCustomer: (id) => set((state) => ({
        customers: state.customers.filter(c => c.id !== id)
      })),

      addAccountPayment: (paymentData) => {
        const state = get();
        const newPayment: AccountPayment = {
          ...paymentData,
          id: `pay-${Date.now()}`,
          tenantId: state.tenant.id,
          createdAt: new Date().toISOString()
        };

        set((s) => ({ accountPayments: [newPayment, ...s.accountPayments] }));
        return newPayment;
      },

      updateCustomerCreditBalance: (customerId, newBalance) => set((state) => ({
        customers: state.customers.map(c => c.id === customerId ? { ...c, creditBalance: Math.max(0, newBalance) } : c)
      })),

      updateTenantSettings: (settings) => set((state) => {
        const updatedTenant = { ...state.tenant, ...settings };
        const updatedTenants = (state.tenants || [state.tenant]).map(t => t.id === updatedTenant.id ? updatedTenant : t);
        
        if (isSupabaseConfigured()) {
          supabase.from('tenants').update({
            name: updatedTenant.name,
            rtn: updatedTenant.rtn || null,
            phone: updatedTenant.phone || null,
            email: updatedTenant.email || null,
            address: updatedTenant.address || null,
            business_type: updatedTenant.businessType,
            is_fiscal_enabled: updatedTenant.isFiscalEnabled
          }).eq('id', updatedTenant.id).then(({ error }) => {
            if (error) console.warn('Supabase update tenant info:', error.message);
          });
        }

        return { tenant: updatedTenant, tenants: updatedTenants };
      }),

      addTenant: (newTenant) => set((state) => {
        const existing = state.tenants || [state.tenant];
        const updatedTenants = existing.some(t => t.id === newTenant.id)
          ? existing.map(t => t.id === newTenant.id ? newTenant : t)
          : [newTenant, ...existing];

        if (isSupabaseConfigured()) {
          supabase.from('tenants').upsert({
            id: newTenant.id,
            name: newTenant.name,
            rtn: newTenant.rtn || null,
            phone: newTenant.phone || null,
            email: newTenant.email || null,
            address: newTenant.address || null,
            business_type: newTenant.businessType,
            is_fiscal_enabled: newTenant.isFiscalEnabled,
            allow_negative_stock: newTenant.allowNegativeStock
          }).then(({ error }) => {
            if (error) console.warn('Supabase add tenant info:', error.message);
          });
        }

        return { tenants: updatedTenants, tenant: newTenant };
      }),

      updateTenant: (id, tenantData) => set((state) => {
        const updatedTenants = (state.tenants || [state.tenant]).map(t => t.id === id ? { ...t, ...tenantData } : t);
        const updatedActiveTenant = state.tenant.id === id ? { ...state.tenant, ...tenantData } : state.tenant;

        if (isSupabaseConfigured()) {
          supabase.from('tenants').update({
            name: tenantData.name,
            rtn: tenantData.rtn || null,
            phone: tenantData.phone || null,
            email: tenantData.email || null,
            address: tenantData.address || null,
            business_type: tenantData.businessType,
            is_fiscal_enabled: tenantData.isFiscalEnabled
          }).eq('id', id).then(({ error }) => {
            if (error) console.warn('Supabase update tenant info:', error.message);
          });
        }

        return { tenants: updatedTenants, tenant: updatedActiveTenant };
      }),

      deleteTenant: (id) => set((state) => {
        if (isSupabaseConfigured()) {
          supabase.from('tenants').delete().eq('id', id).then(({ error }) => {
            if (error) console.warn('Supabase delete tenant info:', error.message);
          });
        }
        return {
          tenants: (state.tenants || []).filter(t => t.id !== id),
          profiles: state.profiles.filter(p => p.tenantId !== id)
        };
      }),

      setSelectedFiscalRange: (id) => set((state) => {
        if (id === 'VIEW_MODE_ADMIN') {
          return { selectedFiscalRangeId: 'VIEW_MODE_ADMIN' };
        }
        const tenantRanges = (state.fiscalRanges || []).filter(r => !r.tenantId || r.tenantId === state.tenant.id);
        const ranges = tenantRanges.length > 0 ? tenantRanges : [state.fiscalRange];
        const found = ranges.find(r => r.id === id);
        if (!found) return state;
        try {
          localStorage.setItem('micuadre_assigned_caja_id', id);
        } catch (err) {}
        return {
          selectedFiscalRangeId: id,
          fiscalRange: found
        };
      }),

      addFiscalRange: (rangeData) => set((state) => {
        const newRange: FiscalRange = {
          ...rangeData,
          id: generateUUID(),
          tenantId: state.tenant.id,
          isDefault: rangeData.isDefault || (state.fiscalRanges || []).length === 0
        };
        let updatedRanges = [...(state.fiscalRanges || [state.fiscalRange])];
        if (newRange.isDefault) {
          updatedRanges = updatedRanges.map(r => ({ ...r, isDefault: false }));
        }
        updatedRanges.push(newRange);

        const activeSelectedId = newRange.isDefault ? newRange.id : (state.selectedFiscalRangeId || newRange.id);
        const activeRange = updatedRanges.find(r => r.id === activeSelectedId) || newRange;

        if (isSupabaseConfigured() && isValidUUID(state.tenant.id)) {
          saveFiscalRangeToSupabase(newRange).catch(err => console.warn('Supabase save fiscal range info:', err));
        }

        return {
          fiscalRanges: updatedRanges,
          selectedFiscalRangeId: activeSelectedId,
          fiscalRange: activeRange
        };
      }),

      updateFiscalRange: (idOrRange, data) => set((state) => {
        let targetId: string;
        let updateData: Partial<FiscalRange>;

        if (typeof idOrRange === 'string') {
          targetId = idOrRange;
          updateData = data || {};
        } else {
          targetId = state.selectedFiscalRangeId || state.fiscalRange.id;
          updateData = idOrRange;
        }

        let updatedTarget: FiscalRange | null = null;

        let updatedRanges = (state.fiscalRanges || [state.fiscalRange]).map(r => {
          if (r.id === targetId) {
            updatedTarget = { ...r, ...updateData };
            return updatedTarget;
          }
          if (updateData.isDefault) {
            return { ...r, isDefault: false };
          }
          return r;
        });

        if (updatedTarget && isSupabaseConfigured() && isValidUUID(state.tenant.id)) {
          saveFiscalRangeToSupabase(updatedTarget).catch(err => console.warn('Supabase update fiscal range info:', err));
        }

        const activeSelectedId = state.selectedFiscalRangeId || state.fiscalRange.id;
        const activeRange = updatedRanges.find(r => r.id === activeSelectedId) || updatedRanges[0];

        return {
          fiscalRanges: updatedRanges,
          fiscalRange: activeRange
        };
      }),

      deleteFiscalRange: (id) => set((state) => {
        const current = state.fiscalRanges || [state.fiscalRange];
        if (current.length <= 1) {
          return state; // Retain at least 1 fiscal range
        }
        const updated = current.filter(r => r.id !== id);
        const nextSelectedId = state.selectedFiscalRangeId === id ? updated[0].id : state.selectedFiscalRangeId;
        const activeRange = updated.find(r => r.id === nextSelectedId) || updated[0];

        if (isSupabaseConfigured() && isValidUUID(id)) {
          deleteFiscalRangeSupabase(id).catch(err => console.warn('Supabase delete fiscal range info:', err));
        }

        return {
          fiscalRanges: updated,
          selectedFiscalRangeId: nextSelectedId,
          fiscalRange: activeRange
        };
      }),

      addProduct: (productData) => set((state) => {
        const newProduct: Product = {
          ...productData,
          id: generateUUID(),
          tenantId: state.tenant.id
        };

        if (isSupabaseConfigured()) {
          supabase.from('products').insert({
            id: newProduct.id,
            tenant_id: newProduct.tenantId,
            sku: newProduct.sku,
            barcode: newProduct.barcode || null,
            name: newProduct.name,
            category: newProduct.category,
            unit_of_measure: newProduct.unitOfMeasure,
            cost_price: newProduct.costPrice,
            sale_price: newProduct.salePrice,
            current_stock: newProduct.currentStock,
            min_stock_alert: newProduct.minStockAlert,
            tax_classification: newProduct.taxClassification,
            is_active: true
          }).then(({ error }) => {
            if (error) console.warn('Supabase add product info:', error.message);
          });
        }

        return { products: [newProduct, ...state.products] };
      }),

      updateProduct: (id, productData) => set((state) => {
        if (isSupabaseConfigured()) {
          const updatePayload: any = {};
          if (productData.name !== undefined) updatePayload.name = productData.name;
          if (productData.sku !== undefined) updatePayload.sku = productData.sku;
          if (productData.barcode !== undefined) updatePayload.barcode = productData.barcode;
          if (productData.category !== undefined) updatePayload.category = productData.category;
          if (productData.unitOfMeasure !== undefined) updatePayload.unit_of_measure = productData.unitOfMeasure;
          if (productData.costPrice !== undefined) updatePayload.cost_price = productData.costPrice;
          if (productData.salePrice !== undefined) updatePayload.sale_price = productData.salePrice;
          if (productData.currentStock !== undefined) updatePayload.current_stock = productData.currentStock;
          if (productData.minStockAlert !== undefined) updatePayload.min_stock_alert = productData.minStockAlert;
          if (productData.taxClassification !== undefined) updatePayload.tax_classification = productData.taxClassification;

          if (Object.keys(updatePayload).length > 0) {
            supabase.from('products').update(updatePayload).eq('id', id).then(({ error }) => {
              if (error) console.warn('Supabase update product info:', error.message);
            });
          }
        }

        return {
          products: state.products.map(p => p.id === id ? { ...p, ...productData } : p)
        };
      }),

      deleteProduct: (id) => set((state) => {
        if (isSupabaseConfigured()) {
          supabase.from('products').delete().eq('id', id).then(({ error }) => {
            if (error) console.warn('Supabase delete product info:', error.message);
          });
        }

        return {
          products: state.products.filter(p => p.id !== id)
        };
      }),


  addToCart: ({ product, service, staffId, quantity = 1 }) => set((state) => {
    // SECURITY GUARD: Strict Multi-tenant Isolation for Cart Additions
    if (product && product.tenantId && product.tenantId !== state.tenant.id) {
      console.warn(`[SECURITY GUARD] Bloqueado intento de agregar producto de otro comercio (${product.tenantId}) al carrito de (${state.tenant.id})`);
      return state;
    }
    if (service && service.tenantId && service.tenantId !== state.tenant.id) {
      console.warn(`[SECURITY GUARD] Bloqueado intento de agregar servicio de otro comercio (${service.tenantId}) al carrito de (${state.tenant.id})`);
      return state;
    }

    const existingIndex = state.cartLines.findIndex(line =>
      product ? line.productId === product.id : (service ? line.serviceId === service.id : false)
    );

    let newLines = [...state.cartLines];

    if (product) {
      const currentQty = existingIndex >= 0 ? newLines[existingIndex].quantity + quantity : quantity;
      const lineCalculations = calculateLineTotals(
        product.salePrice,
        currentQty,
        product.taxClassification,
        0,
        product.tiers,
        state.tenant.pricesIncludeTax ?? true
      );

      const newLine: CartLine = {
        productId: product.id,
        sku: product.sku,
        barcode: product.barcode,
        name: product.name,
        quantity: currentQty,
        unitPrice: lineCalculations.unitPrice,
        originalUnitPrice: lineCalculations.originalUnitPrice,
        discountAmount: 0,
        taxClassification: product.taxClassification,
        appliedTierName: lineCalculations.appliedTierName,
        subtotal: lineCalculations.subtotal,
        taxAmount: lineCalculations.taxAmount,
        total: lineCalculations.total
      };

      if (existingIndex >= 0) {
        newLines[existingIndex] = newLine;
      } else {
        newLines.push(newLine);
      }
    } else if (service) {
      const staffMember = state.staff.find(s => s.id === staffId) || state.profiles.find(p => p.id === staffId);
      const currentQty = existingIndex >= 0 ? newLines[existingIndex].quantity + quantity : quantity;
      const lineCalculations = calculateLineTotals(
        service.price,
        currentQty,
        'GRAVADO_15',
        0,
        undefined,
        state.tenant.pricesIncludeTax ?? true
      );

      const newLine: CartLine = {
        serviceId: service.id,
        staffId: staffId,
        staffName: staffMember?.fullName,
        sku: `SERV-${service.id.slice(0, 4)}`,
        name: service.name,
        quantity: currentQty,
        unitPrice: service.price,
        originalUnitPrice: service.price,
        discountAmount: 0,
        taxClassification: 'GRAVADO_15',
        subtotal: lineCalculations.subtotal,
        taxAmount: lineCalculations.taxAmount,
        total: lineCalculations.total
      };

      if (existingIndex >= 0) {
        newLines[existingIndex] = newLine;
      } else {
        newLines.push(newLine);
      }
    }

    return { cartLines: newLines };
  }),

  updateCartLineQty: (index, qty) => set((state) => {
    if (qty <= 0) {
      return { cartLines: state.cartLines.filter((_, i) => i !== index) };
    }

    const targetLine = state.cartLines[index];
    const product = state.products.find(p => p.id === targetLine.productId);

    const lineCalculations = calculateLineTotals(
      targetLine.originalUnitPrice,
      qty,
      targetLine.taxClassification,
      targetLine.discountAmount,
      product?.tiers,
      state.tenant.pricesIncludeTax ?? true
    );

    const updatedLines = [...state.cartLines];
    updatedLines[index] = {
      ...targetLine,
      quantity: qty,
      unitPrice: lineCalculations.unitPrice,
      appliedTierName: lineCalculations.appliedTierName,
      subtotal: lineCalculations.subtotal,
      taxAmount: lineCalculations.taxAmount,
      total: lineCalculations.total
    };

    return { cartLines: updatedLines };
  }),

  updateCartLineStaff: (index, staffId) => set((state) => {
    const updated = [...state.cartLines];
    if (index >= 0 && index < updated.length) {
      const staffMember = state.staff.find(s => s.id === staffId) || state.profiles.find(p => p.id === staffId);
      updated[index] = {
        ...updated[index],
        staffId: staffId || undefined,
        staffName: staffMember?.fullName || undefined
      };
    }
    return { cartLines: updated };
  }),

  removeCartLine: (index) => set((state) => ({
    cartLines: state.cartLines.filter((_, i) => i !== index)
  })),

  clearCart: () => set({ cartLines: [], cartCustomer: { name: 'Consumidor Final' } }),

  setCartCustomer: (customer) => set({ cartCustomer: customer }),

  holdCurrentCart: () => set((state) => {
    if (state.cartLines.length === 0) return state;

    const newHeldOrder: HeldOrder = {
      id: `hold-${Date.now()}`,
      tenantId: state.tenant.id,
      customerName: state.cartCustomer.name,
      customerRtn: state.cartCustomer.rtn,
      lines: [...state.cartLines],
      createdAt: new Date().toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })
    };

    return {
      heldOrders: [newHeldOrder, ...state.heldOrders],
      cartLines: [],
      cartCustomer: { name: 'Consumidor Final' }
    };
  }),

  restoreHeldCart: (heldOrderId) => set((state) => {
    const targetOrder = state.heldOrders.find(o => o.id === heldOrderId && (!o.tenantId || o.tenantId === state.tenant.id));
    if (!targetOrder) return state;

    return {
      cartLines: [...targetOrder.lines],
      cartCustomer: { name: targetOrder.customerName, rtn: targetOrder.customerRtn },
      heldOrders: state.heldOrders.filter(o => o.id !== heldOrderId)
    };
  }),

  deleteHeldCart: (heldOrderId) => set((state) => ({
    heldOrders: state.heldOrders.filter(o => o.id !== heldOrderId)
  })),

  openCashShift: (openingAmount) => set((state) => {
    const tenantRanges = (state.fiscalRanges || []).filter(r => !r.tenantId || r.tenantId === state.tenant.id);
    const ranges = tenantRanges.length > 0 ? tenantRanges : [state.fiscalRange];
    const activeCaja = ranges.find(r => r.id === state.selectedFiscalRangeId) || ranges[0] || state.fiscalRange;
    const targetCajaId = activeCaja?.id;

    // Check if there is already an open shift for this specific caja by another session
    const existingOpenShift = (state.shiftHistory || []).find(
      s => s.tenantId === state.tenant.id &&
           (s.fiscalRangeId === targetCajaId || s.cajaName === activeCaja?.name) &&
           s.status === 'OPEN'
    );

    if (existingOpenShift) {
      if (existingOpenShift.userId === state.currentUser.id) {
        return { activeShift: existingOpenShift };
      }
      toast.error(`La terminal "${activeCaja?.name || 'Caja Registradora'}" ya está siendo operada por ${existingOpenShift.userName} en otro dispositivo. Cada caja solo puede estar activa en 1 dispositivo a la vez.`);
      return state;
    }

    const newShift: CashShift = {
      id: generateUUID(),
      tenantId: state.tenant.id,
      userId: state.currentUser.id,
      userName: state.currentUser.fullName,
      fiscalRangeId: activeCaja?.id,
      cajaName: activeCaja?.name || 'Caja 1 - Principal',
      openingAmount,
      status: 'OPEN',
      openedAt: new Date().toISOString()
    };

    if (isSupabaseConfigured() && isValidUUID(state.tenant.id)) {
      saveCashShiftToSupabase(newShift).catch(err => console.warn('Supabase save shift info:', err));
    }

    return {
      activeShift: newShift,
      shiftHistory: [newShift, ...(state.shiftHistory || []).filter(s => s.id !== newShift.id)]
    };
  }),

  addCashMovement: (type, amount, concept, referenceId) => set((state) => {
    const shift = (state.activeShift && state.activeShift.tenantId === state.tenant.id) ? state.activeShift : null;
    const tenantRanges = (state.fiscalRanges || []).filter(r => !r.tenantId || r.tenantId === state.tenant.id);
    const ranges = tenantRanges.length > 0 ? tenantRanges : [state.fiscalRange];
    const activeCaja = ranges.find(r => r.id === state.selectedFiscalRangeId) || ranges[0] || state.fiscalRange;

    const movement: CashMovement = {
      id: generateUUID(),
      tenantId: state.tenant.id,
      cashShiftId: shift?.id || 'general',
      fiscalRangeId: shift?.fiscalRangeId || activeCaja?.id || '',
      type,
      amount,
      concept,
      registeredBy: state.currentUser.fullName,
      createdAt: new Date().toISOString(),
      referenceId
    };

    if (isSupabaseConfigured() && isValidUUID(state.tenant.id)) {
      saveCashMovementToSupabase(movement).catch(err => console.warn('Supabase save movement info:', err));
    }

    return {
      cashMovements: [movement, ...(state.cashMovements || [])]
    };
  }),

  closeCashShift: (declaredCash) => {
    const state = get();
    const shift = state.activeShift;

    if (!shift) return { difference: 0, closingSystem: 0 };

    const shiftCashSales = state.sales
      .filter(s => s.cashShiftId === shift.id && (s.paymentMethod === 'CASH' || s.paymentMethod === 'MIXED'))
      .reduce((acc, s) => acc + s.total, 0);

    const shiftMovements = (state.cashMovements || []).filter(m => m.cashShiftId === shift.id);
    const totalIngresos = shiftMovements.filter(m => m.type === 'ENTRADA').reduce((acc, m) => acc + m.amount, 0);
    const totalEgresos = shiftMovements.filter(m => m.type === 'SALIDA').reduce((acc, m) => acc + m.amount, 0);

    const closingSystem = shift.openingAmount + shiftCashSales + totalIngresos - totalEgresos;
    const difference = declaredCash - closingSystem;

    const closedShift: CashShift = {
      ...shift,
      closingDeclared: declaredCash,
      closingSystem,
      difference,
      status: 'CLOSED',
      closedAt: new Date().toISOString()
    };

    set((s) => ({
      activeShift: closedShift,
      shiftHistory: [closedShift, ...(s.shiftHistory || []).filter(sh => sh.id !== closedShift.id)]
    }));

    if (isSupabaseConfigured() && isValidUUID(shift.tenantId)) {
      saveCashShiftToSupabase(closedShift).catch(err => console.warn('Supabase save shift info:', err));
      closeCashShiftSupabase(shift.id, declaredCash).catch(err => console.warn('Supabase close shift info:', err));
    }

    return { difference, closingSystem };
  },

  processSale: (paymentMethod, loyaltyPointsRedeemed = 0, overrideIsFiscal?: boolean) => {
    const state = get();
    const isFiscal = overrideIsFiscal !== undefined ? overrideIsFiscal : state.tenant.isFiscalEnabled;
    const totals = calculateCartTotals(state.cartLines);

    // Loyalty points calculation
    const isLoyaltyActive = !!state.tenant.isLoyaltyEnabled;
    const earnRate = state.tenant.loyaltyEarnRate || 100;
    const pointValue = state.tenant.loyaltyPointValue || 1.0;

    const actualRedeemedPoints = (isLoyaltyActive && loyaltyPointsRedeemed > 0) ? loyaltyPointsRedeemed : 0;
    const loyaltyDiscount = actualRedeemedPoints * pointValue;

    const finalTotal = Math.max(0, totals.total - loyaltyDiscount);
    const pointsEarned = isLoyaltyActive ? Math.floor(finalTotal / earnRate) : 0;

    let docNumber = `TICK-${Math.floor(100000 + Math.random() * 900000)}`;
    let cai: string | undefined;
    let caiDeadline: string | undefined;
    let caiRangeStart: string | undefined;
    let caiRangeEnd: string | undefined;

    if (isFiscal) {
      const tenantRanges = (state.fiscalRanges || []).filter(r => !r.tenantId || r.tenantId === state.tenant.id);
      const ranges = tenantRanges.length > 0 ? tenantRanges : [state.fiscalRange];
      const selectedId = state.selectedFiscalRangeId || state.fiscalRange?.id;
      const targetRange = ranges.find(r => r.id === selectedId) || ranges[0] || state.fiscalRange;

      const nextNum = targetRange.currentNumber + 1;
      const padded = String(nextNum).padStart(8, '0');
      docNumber = `${targetRange.prefix}${padded}`;
      cai = targetRange.cai;
      caiDeadline = targetRange.deadline;
      caiRangeStart = `${targetRange.prefix}${String(targetRange.rangeStart).padStart(8, '0')}`;
      caiRangeEnd = `${targetRange.prefix}${String(targetRange.rangeEnd).padStart(8, '0')}`;

      const updatedRange: FiscalRange = {
        ...targetRange,
        currentNumber: nextNum,
        isActive: nextNum < targetRange.rangeEnd
      };

      const updatedRanges = (state.fiscalRanges || [state.fiscalRange]).map(r =>
        r.id === targetRange.id ? updatedRange : r
      );

      set({
        fiscalRanges: updatedRanges,
        fiscalRange: updatedRange
      });
    }

    const tenantRanges = (state.fiscalRanges || []).filter(r => !r.tenantId || r.tenantId === state.tenant.id);
    const ranges = tenantRanges.length > 0 ? tenantRanges : [state.fiscalRange];
    const selectedId = state.selectedFiscalRangeId || state.fiscalRange?.id;
    const activeTargetRange = ranges.find(r => r.id === selectedId) || ranges[0] || state.fiscalRange;
    const activeShift = (state.activeShift && state.activeShift.tenantId === state.tenant.id) ? state.activeShift : null;

    const newSale: Sale = {
      id: generateUUID(),
      tenantId: state.tenant.id,
      cashShiftId: activeShift?.id,
      documentNumber: docNumber,
      isFiscal,
      cai,
      caiDeadline,
      caiRangeStart,
      caiRangeEnd,
      fiscalRangeId: activeShift?.fiscalRangeId || activeTargetRange?.id,
      cajaName: activeShift?.cajaName || activeTargetRange?.name || 'Caja 1 - Principal',
      customerId: state.cartCustomer.id,
      customerRtn: state.cartCustomer.rtn,
      customerName: state.cartCustomer.name || 'Consumidor Final',

      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount + loyaltyDiscount,
      exemptAmount: totals.exemptAmount,
      exoneratedAmount: totals.exoneratedAmount,
      taxable15: totals.taxable15,
      tax15: totals.tax15,
      taxable18: totals.taxable18,
      tax18: totals.tax18,
      total: finalTotal,
      paymentMethod,
      loyaltyPointsEarned: pointsEarned,
      loyaltyPointsRedeemed: actualRedeemedPoints,
      loyaltyDiscountAmount: loyaltyDiscount,
      createdAt: new Date().toISOString(),
      items: [...state.cartLines]
    };

    const updatedProducts = [...state.products];
    const newCommissions: StaffCommission[] = [...state.commissions];

    for (const item of state.cartLines) {
      if (item.productId) {
        const prodIndex = updatedProducts.findIndex(p => p.id === item.productId);
        if (prodIndex >= 0) {
          updatedProducts[prodIndex] = {
            ...updatedProducts[prodIndex],
            currentStock: updatedProducts[prodIndex].currentStock - item.quantity
          };
        }
      }

      if (item.serviceId && item.staffId) {
        const service = state.services.find(s => s.id === item.serviceId);
        const staffMember = state.staff.find(s => s.id === item.staffId) || state.profiles.find(p => p.id === item.staffId);
        if (service && staffMember) {
          const commAmount = service.commissionType === 'PERCENTAGE'
            ? (item.subtotal * service.commissionValue) / 100
            : service.commissionValue * item.quantity;

          newCommissions.push({
            id: `comm-${Date.now()}-${Math.random()}`,
            tenantId: state.tenant.id,
            staffId: item.staffId,
            staffName: staffMember.fullName,
            saleId: newSale.id,
            serviceId: item.serviceId,
            serviceName: service.name,
            saleAmount: item.subtotal,
            commissionAmount: commAmount,
            status: 'PENDING',
            createdAt: new Date().toISOString()
          });
        }
      }
    }

    // Update customer loyalty points, cumulative spend & credit balance (if fiado)
    let updatedCustomers = [...state.customers];
    if (state.cartCustomer.id) {
      const custIndex = updatedCustomers.findIndex(c => c.id === state.cartCustomer.id);
      if (custIndex >= 0) {
        const currentPoints = updatedCustomers[custIndex].loyaltyPoints || 0;
        const currentSpent = updatedCustomers[custIndex].totalSpent || 0;
        const currentCreditBalance = updatedCustomers[custIndex].creditBalance || 0;
        const newPointsBalance = Math.max(0, currentPoints - actualRedeemedPoints + pointsEarned);
        const newCreditBalance = paymentMethod === 'CREDIT' ? currentCreditBalance + finalTotal : currentCreditBalance;

        updatedCustomers[custIndex] = {
          ...updatedCustomers[custIndex],
          loyaltyPoints: newPointsBalance,
          totalSpent: currentSpent + finalTotal,
          creditBalance: newCreditBalance
        };
      }
    }

    if (paymentMethod === 'CREDIT') {
      newSale.paymentStatus = 'UNPAID';
    }

    // Auto-complete appointments matching services in cart
    const serviceCartItems = state.cartLines.filter(item => item.serviceId);
    let updatedAppointments = [...state.appointments];

    if (serviceCartItems.length > 0) {
      updatedAppointments = updatedAppointments.map(app => {
        if (app.tenantId === state.tenant.id && (app.status === 'IN_PROGRESS' || app.status === 'SCHEDULED')) {
          const isMatchingService = serviceCartItems.some(item => item.serviceId === app.serviceId);
          if (isMatchingService) {
            return { ...app, status: 'COMPLETED' as const };
          }
        }
        return app;
      });
    }

    set((s) => ({
      sales: [newSale, ...s.sales],
      products: updatedProducts,
      commissions: newCommissions,
      customers: updatedCustomers,
      appointments: updatedAppointments,
      cartLines: [],
      cartCustomer: { name: 'Consumidor Final' }
    }));

    if (isSupabaseConfigured() && isValidUUID(newSale.tenantId)) {
      saveSaleToSupabase(newSale).catch(err => console.warn('Supabase process sale info:', err));
    }

    return newSale;
  },

  addSupplier: (supplierData) => set((state) => {
    const newSupplier: Supplier = {
      ...supplierData,
      id: `supp-${Date.now()}`,
      tenantId: state.tenant.id
    };

    if (isSupabaseConfigured() && isValidUUID(state.tenant.id)) {
      supabase.from('suppliers').insert({
        tenant_id: state.tenant.id,
        company_name: newSupplier.companyName,
        rtn: newSupplier.rtn || null,
        contact_name: newSupplier.contactName || null,
        phone: newSupplier.phone || null,
        email: newSupplier.email || null,
        default_credit_days: newSupplier.defaultCreditDays || 0,
        is_active: true
      }).then(({ error }) => {
        if (error) console.warn('Supabase add supplier info:', error.message);
      });
    }

    return { suppliers: [newSupplier, ...state.suppliers] };
  }),

  processPurchase: (purchaseData, items, paidFromFundId) => set((state) => {
    const updatedProducts = [...state.products];

    for (const item of items) {
      const prodIndex = updatedProducts.findIndex(p => p.id === item.productId);
      if (prodIndex >= 0) {
        const prod = updatedProducts[prodIndex];
        const cppResult = calculateCPP(prod.currentStock, prod.costPrice, item.quantity, item.unitCost);
        updatedProducts[prodIndex] = {
          ...prod,
          currentStock: cppResult.newStock,
          costPrice: cppResult.newCost,
          salePrice: item.newSalePrice || prod.salePrice
        };
      }
    }

    const newInvoice: PurchaseInvoice = {
      ...purchaseData,
      id: `pur-${Date.now()}`,
      tenantId: state.tenant.id,
      paymentSource: paidFromFundId === 'ACTIVE_CASH_SHIFT' ? 'ACTIVE_CASH_SHIFT' : 'FUND',
      cashShiftId: paidFromFundId === 'ACTIVE_CASH_SHIFT' ? state.activeShift?.id : undefined
    };

    const updatedFunds = [...state.funds];
    const updatedMovements = [...(state.cashMovements || [])];

    if (purchaseData.paymentTerms === 'CASH') {
      if (paidFromFundId === 'ACTIVE_CASH_SHIFT') {
        const ranges = state.fiscalRanges || [state.fiscalRange];
        const activeCaja = ranges.find(r => r.id === state.selectedFiscalRangeId) || ranges[0] || state.fiscalRange;
        updatedMovements.unshift({
          id: `mov-${Date.now()}`,
          tenantId: state.tenant.id,
          cashShiftId: state.activeShift?.id || 'general',
          fiscalRangeId: state.activeShift?.fiscalRangeId || activeCaja?.id || '',
          type: 'SALIDA',
          amount: purchaseData.total,
          concept: `Compra al Contado #${purchaseData.invoiceNumber} (${purchaseData.supplierName || 'Proveedor'})`,
          registeredBy: state.currentUser.fullName,
          createdAt: new Date().toISOString(),
          referenceId: newInvoice.id
        });
      } else if (paidFromFundId) {
        const fundIndex = updatedFunds.findIndex(f => f.id === paidFromFundId);
        if (fundIndex >= 0) {
          updatedFunds[fundIndex] = {
            ...updatedFunds[fundIndex],
            balance: updatedFunds[fundIndex].balance - purchaseData.total
          };
        }
      }
    }

    const updatedEvents = [...state.financialEvents];
    if (purchaseData.paymentTerms === 'CREDIT') {
      const supplier = state.suppliers.find(s => s.id === purchaseData.supplierId);
      updatedEvents.push({
        id: `fe-${Date.now()}`,
        tenantId: state.tenant.id,
        eventType: 'SUPPLIER_PAYMENT',
        title: `Pago Proveedor: ${supplier?.companyName || 'Proveedor'}`,
        description: `Factura #${purchaseData.invoiceNumber} a crédito`,
        dueDate: purchaseData.dueDate,
        amount: purchaseData.total,
        status: 'PENDING',
        referenceId: newInvoice.id
      });
    }

    return {
      purchaseInvoices: [newInvoice, ...state.purchaseInvoices],
      products: updatedProducts,
      funds: updatedFunds,
      cashMovements: updatedMovements,
      financialEvents: updatedEvents
    };
  }),

  payPurchaseInvoice: (invoiceId, fundId, amount) => set((state) => {
    const invoiceIndex = state.purchaseInvoices.findIndex(p => p.id === invoiceId);
    if (invoiceIndex < 0) return state;

    const invoice = state.purchaseInvoices[invoiceIndex];
    const newPaidAmount = invoice.paidAmount + amount;
    const newStatus = newPaidAmount >= invoice.total ? 'PAID' : 'PARTIAL';

    const updatedInvoices = [...state.purchaseInvoices];
    updatedInvoices[invoiceIndex] = {
      ...invoice,
      paidAmount: newPaidAmount,
      paymentStatus: newStatus
    };

    const updatedFunds = state.funds.map(f =>
      f.id === fundId ? { ...f, balance: f.balance - amount } : f
    );

    const updatedEvents = state.financialEvents.map(e =>
      (e.referenceId === invoiceId && newStatus === 'PAID') ? { ...e, status: 'PAID' as const } : e
    );

    return {
      purchaseInvoices: updatedInvoices,
      funds: updatedFunds,
      financialEvents: updatedEvents
    };
  }),

  addFund: (fundData) => set((state) => ({
    funds: [
      ...state.funds,
      {
        ...fundData,
        id: `fund-${Date.now()}`,
        tenantId: state.tenant.id
      }
    ]
  })),

  updateFund: (id, fundData) => set((state) => ({
    funds: state.funds.map(f => f.id === id ? { ...f, ...fundData } : f)
  })),

  deleteFund: (id) => set((state) => ({
    funds: state.funds.filter(f => f.id !== id)
  })),

  addExpense: (expenseData) => set((state) => {
    const isFromCashShift = expenseData.fundId === 'ACTIVE_CASH_SHIFT' || expenseData.paymentSource === 'ACTIVE_CASH_SHIFT';
    const fund = isFromCashShift ? null : state.funds.find(f => f.id === expenseData.fundId);

    const newExpense: Expense = {
      ...expenseData,
      id: `exp-${Date.now()}`,
      tenantId: state.tenant.id,
      fundName: isFromCashShift ? 'Caja Registradora (Efectivo)' : (fund?.name || 'Fondo'),
      paymentSource: isFromCashShift ? 'ACTIVE_CASH_SHIFT' : 'FUND',
      cashShiftId: isFromCashShift ? state.activeShift?.id : undefined,
      createdAt: expenseData.createdAt || new Date().toISOString()
    };

    const updatedFunds = state.funds.map(f =>
      (!isFromCashShift && f.id === expenseData.fundId)
        ? { ...f, balance: f.balance - expenseData.amount }
        : f
    );

    const updatedMovements = [...(state.cashMovements || [])];
    if (isFromCashShift) {
      const ranges = state.fiscalRanges || [state.fiscalRange];
      const activeCaja = ranges.find(r => r.id === state.selectedFiscalRangeId) || ranges[0] || state.fiscalRange;
      updatedMovements.unshift({
        id: `mov-${Date.now()}`,
        tenantId: state.tenant.id,
        cashShiftId: state.activeShift?.id || 'general',
        fiscalRangeId: state.activeShift?.fiscalRangeId || activeCaja?.id || '',
        type: 'SALIDA',
        amount: expenseData.amount,
        concept: `Gasto Operativo (${expenseData.category}): ${expenseData.description}`,
        registeredBy: state.currentUser.fullName,
        createdAt: new Date().toISOString(),
        referenceId: newExpense.id
      });
    }

    if (isSupabaseConfigured()) {
      supabase.from('expenses').insert({
        id: newExpense.id,
        tenant_id: newExpense.tenantId,
        category: newExpense.category,
        description: newExpense.description,
        amount: newExpense.amount,
        fund_id: newExpense.fundId,
        receipt_number: newExpense.receiptNumber || null,
        expense_date: newExpense.expenseDate,
        registered_by: newExpense.registeredBy || null
      }).then(({ error }) => {
        if (error) console.warn('Supabase add expense info:', error.message);
      });
    }

    return {
      expenses: [newExpense, ...(state.expenses || [])],
      funds: updatedFunds,
      cashMovements: updatedMovements
    };
  }),

  deleteExpense: (id) => set((state) => {
    const expense = (state.expenses || []).find(e => e.id === id);
    if (!expense) return state;

    const updatedFunds = state.funds.map(f =>
      f.id === expense.fundId
        ? { ...f, balance: f.balance + expense.amount }
        : f
    );

    if (isSupabaseConfigured()) {
      supabase.from('expenses').delete().eq('id', id).then(({ error }) => {
        if (error) console.warn('Supabase delete expense info:', error.message);
      });
    }

    return {
      expenses: (state.expenses || []).filter(e => e.id !== id),
      funds: updatedFunds
    };
  }),


  addAppointment: (appData) => set((state) => {
    const staffMember = state.staff.find(s => s.id === appData.staffId) || state.profiles.find(p => p.id === appData.staffId);
    const service = state.services.find(s => s.id === appData.serviceId);
    const newApp: Appointment = {
      ...appData,
      id: `app-${Date.now()}`,
      tenantId: state.tenant.id,
      staffName: staffMember?.fullName,
      serviceName: service?.name
    };
    return { appointments: [newApp, ...state.appointments] };
  }),

  updateAppointment: (id, appointmentData) => set((state) => {
    return {
      appointments: state.appointments.map(a => {
        if (a.id !== id) return a;
        const staffMember = appointmentData.staffId ? (state.staff.find(s => s.id === appointmentData.staffId) || state.profiles.find(p => p.id === appointmentData.staffId)) : undefined;
        const service = appointmentData.serviceId ? state.services.find(s => s.id === appointmentData.serviceId) : undefined;
        return {
          ...a,
          ...appointmentData,
          staffName: staffMember ? staffMember.fullName : (appointmentData.staffId ? a.staffName : a.staffName),
          serviceName: service ? service.name : (appointmentData.serviceId ? a.serviceName : a.serviceName)
        };
      })
    };
  }),

  deleteAppointment: (id) => set((state) => ({
    appointments: state.appointments.filter(a => a.id !== id)
  })),

  updateAppointmentStatus: (id, status) => set((state) => ({
    appointments: state.appointments.map(a => a.id === id ? { ...a, status } : a)
  })),

  sendAppointmentToPos: (app) => {
    const state = get();
    if (app.tenantId && app.tenantId !== state.tenant.id) {
      console.warn(`[SECURITY GUARD] Bloqueado intento de enviar cita de otro comercio (${app.tenantId}) al POS`);
      return;
    }
    if (app.items && app.items.length > 0) {
      app.items.forEach(item => {
        const service = state.services.find(s => s.id === item.serviceId && s.tenantId === state.tenant.id);
        if (service) {
          state.addToCart({ service, staffId: item.staffId });
        }
      });
      state.setCartCustomer({ name: app.customerName, rtn: undefined });
      state.updateAppointmentStatus(app.id, 'IN_PROGRESS');
      state.setActiveTab('pos');
    } else {
      const service = state.services.find(s => s.id === app.serviceId && s.tenantId === state.tenant.id);
      if (service) {
        state.addToCart({ service, staffId: app.staffId });
        state.setCartCustomer({ name: app.customerName, rtn: undefined });
        state.updateAppointmentStatus(app.id, 'IN_PROGRESS');
        state.setActiveTab('pos');
      }
    }
  },

  addStaff: (staffData) => set((state) => ({
    staff: [...state.staff, { ...staffData, id: `staff-${Date.now()}`, tenantId: state.tenant.id }]
  })),

  addService: (serviceData) => set((state) => ({
    services: [...state.services, { ...serviceData, id: `serv-${Date.now()}`, tenantId: state.tenant.id }]
  })),

  updateService: (id, serviceData) => set((state) => ({
    services: state.services.map(s => s.id === id ? { ...s, ...serviceData } : s)
  })),

  deleteService: (id) => set((state) => ({
    services: state.services.filter(s => s.id !== id)
  })),

  payStaffCommissions: (staffId) => set((state) => ({
    commissions: (state.commissions || []).map(c =>
      (c.staffId === staffId || c.staffName === staffId) && c.tenantId === state.tenant.id ? { ...c, status: 'PAID' } : c
    )
  })),

  payCommissionItem: (commId) => set((state) => ({
    commissions: (state.commissions || []).map(c =>
      c.id === commId ? { ...c, status: 'PAID' } : c
    )
  })),

  addProfile: (profileData) => set((state) => {
    const newId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });
    return { profiles: [...state.profiles, { ...profileData, id: newId, tenantId: state.tenant.id }] };
  }),

  addFinancialEvent: (eventData) => set((state) => {
    const newEvent: FinancialEvent = {
      ...eventData,
      id: `fe-${Date.now()}`,
      tenantId: state.tenant.id
    };

    if (isSupabaseConfigured()) {
      supabase.from('financial_events').insert({
        id: newEvent.id,
        tenant_id: newEvent.tenantId,
        event_type: newEvent.eventType,
        title: newEvent.title,
        description: newEvent.description || null,
        due_date: newEvent.dueDate,
        amount: newEvent.amount,
        status: newEvent.status
      }).then(({ error }) => {
        if (error) console.warn('Supabase add financial event:', error.message);
      });
    }

    return { financialEvents: [...state.financialEvents, newEvent] };
  }),

  dismissFinancialEvent: (id) => set((state) => ({
    financialEvents: state.financialEvents.map(e => e.id === id ? { ...e, status: 'DISMISSED' as const } : e)
  })),

  payFinancialEvent: (eventId, fundId) => set((state) => {
    const event = state.financialEvents.find(e => e.id === eventId);
    if (!event) return state;

    const fund = state.funds.find(f => f.id === fundId);

    const updatedEvents = state.financialEvents.map(e =>
      e.id === eventId ? { ...e, status: 'PAID' as const } : e
    );

    const updatedFunds = state.funds.map(f =>
      f.id === fundId ? { ...f, balance: f.balance - event.amount } : f
    );

    let updatedInvoices = state.purchaseInvoices;
    if (event.referenceId) {
      updatedInvoices = state.purchaseInvoices.map(p =>
        p.id === event.referenceId ? { ...p, paymentStatus: 'PAID', paidAmount: p.total } : p
      );
    }

    let updatedExpenses = state.expenses || [];
    if (event.eventType === 'RECURRING_EXPENSE' || event.expenseCategory) {
      const newExpense: Expense = {
        id: `exp-${Date.now()}`,
        tenantId: state.tenant.id,
        category: event.expenseCategory || 'SERVICIOS_PUBLICOS',
        description: event.title,
        amount: event.amount,
        fundId: fundId,
        fundName: fund?.name || 'Fondo',
        expenseDate: new Date().toISOString().split('T')[0],
        registeredBy: state.currentUser?.fullName || 'Usuario',
        createdAt: new Date().toISOString()
      };
      updatedExpenses = [newExpense, ...updatedExpenses];

      // Auto-schedule next month's recurring event
      const parts = (event.dueDate || new Date().toISOString().split('T')[0]).split('-');
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const day = parseInt(parts[2]);
      const nextMonthDate = new Date(year, month + 1, day);
      const nextMonthDue = nextMonthDate.toISOString().split('T')[0];

      const nextEvent: FinancialEvent = {
        id: `fe-${Date.now() + 1}`,
        tenantId: state.tenant.id,
        eventType: 'RECURRING_EXPENSE',
        title: event.title,
        description: event.description,
        dueDate: nextMonthDue,
        amount: event.amount,
        status: 'PENDING',
        expenseCategory: event.expenseCategory || 'SERVICIOS_PUBLICOS'
      };
      updatedEvents.push(nextEvent);
    }

    if (isSupabaseConfigured()) {
      supabase.from('financial_events').update({ status: 'PAID' }).eq('id', eventId).then(({ error }) => {
        if (error) console.warn('Supabase update financial event status:', error.message);
      });
    }

    return {
      financialEvents: updatedEvents,
      funds: updatedFunds,
      purchaseInvoices: updatedInvoices,
      expenses: updatedExpenses
    };
  }),

  resetToDefaultData: () => {
    localStorage.removeItem('micuadre_app_state');
    set({
      isAuthenticated: false,
      tenant: INITIAL_TENANT,
      currentUser: INITIAL_PROFILES[0],
      profiles: INITIAL_PROFILES,
      fiscalRanges: INITIAL_FISCAL_RANGES,
      selectedFiscalRangeId: INITIAL_FISCAL_RANGES[0].id,
      fiscalRange: INITIAL_FISCAL_RANGE,
      products: INITIAL_PRODUCTS,
      activeShift: INITIAL_CASH_SHIFT,
      cartLines: [],
      cartCustomer: { name: 'Consumidor Final' },
      heldOrders: [],
      sales: [],
      suppliers: INITIAL_SUPPLIERS,
      purchaseInvoices: [],
      funds: INITIAL_FUNDS,
      expenses: [],
      staff: INITIAL_STAFF,
      services: INITIAL_SERVICES,
      appointments: INITIAL_APPOINTMENTS,
      commissions: [],
      financialEvents: INITIAL_FINANCIAL_EVENTS,
      activeTab: 'pos',
      isDevMode: false,
      isShiftModalOpen: false,
      isPaymentModalOpen: false
    });
  }
}),
{
  name: 'micuadre_app_state',
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({
    tenant: state.tenant,
    tenants: state.tenants,
    currentUser: state.currentUser,
    profiles: state.profiles,
    fiscalRanges: state.fiscalRanges,
    selectedFiscalRangeId: state.selectedFiscalRangeId,
    fiscalRange: state.fiscalRange,
    products: state.products,
    activeShift: state.activeShift,
    shiftHistory: state.shiftHistory,
    cashMovements: state.cashMovements,
    cartLines: state.cartLines,
    cartCustomer: state.cartCustomer,
    heldOrders: state.heldOrders,
    sales: state.sales,
    customers: state.customers,
    suppliers: state.suppliers,
    purchaseInvoices: state.purchaseInvoices,
    funds: state.funds,
    expenses: state.expenses,
    staff: state.staff,
    services: state.services,
    appointments: state.appointments,
    commissions: state.commissions,
    financialEvents: state.financialEvents,
  }),
  onRehydrateStorage: () => (state) => {
    if (!state) return;

    if (!state.fiscalRanges || state.fiscalRanges.length === 0) {
      const fallbackRanges = state.fiscalRange
        ? [{ ...state.fiscalRange, name: state.fiscalRange.name || 'Caja 1 - Principal', isDefault: true }]
        : INITIAL_FISCAL_RANGES;
      useAppStore.setState({
        fiscalRanges: fallbackRanges,
        selectedFiscalRangeId: fallbackRanges[0].id,
        fiscalRange: fallbackRanges[0]
      });
    }

    // Transparently sanitize any legacy non-UUID tenant IDs in existing local storage
    if (state.tenant && !isValidUUID(state.tenant.id)) {
      const oldId = state.tenant.id;
      const newUuid = generateUUID();
      const updatedTenant = { ...state.tenant, id: newUuid };

      const updatedTenants = (state.tenants || [state.tenant]).map(t => t.id === oldId ? updatedTenant : t);
      const updatedProducts = (state.products || []).map(p => p.tenantId === oldId ? { ...p, tenantId: newUuid } : p);
      const updatedCustomers = (state.customers || []).map(c => c.tenantId === oldId ? { ...c, tenantId: newUuid } : c);
      const updatedSales = (state.sales || []).map(s => s.tenantId === oldId ? { ...s, tenantId: newUuid } : s);
      const updatedProfiles = (state.profiles || []).map(p => p.tenantId === oldId ? { ...p, tenantId: newUuid } : p);
      const updatedSuppliers = (state.suppliers || []).map(s => s.tenantId === oldId ? { ...s, tenantId: newUuid } : s);
      const updatedFunds = (state.funds || []).map(f => f.tenantId === oldId ? { ...f, tenantId: newUuid } : f);
      const updatedExpenses = (state.expenses || []).map(e => e.tenantId === oldId ? { ...e, tenantId: newUuid } : e);
      const updatedServices = (state.services || []).map(s => s.tenantId === oldId ? { ...s, tenantId: newUuid } : s);
      const updatedStaff = (state.staff || []).map(s => s.tenantId === oldId ? { ...s, tenantId: newUuid } : s);
      const updatedAppointments = (state.appointments || []).map(a => a.tenantId === oldId ? { ...a, tenantId: newUuid } : a);
      const updatedCommissions = (state.commissions || []).map(c => c.tenantId === oldId ? { ...c, tenantId: newUuid } : c);
      const updatedEvents = (state.financialEvents || []).map(e => e.tenantId === oldId ? { ...e, tenantId: newUuid } : e);
      const updatedInvoices = (state.purchaseInvoices || []).map(i => i.tenantId === oldId ? { ...i, tenantId: newUuid } : i);
      const updatedShiftHistory = (state.shiftHistory || []).map(sh => sh.tenantId === oldId ? { ...sh, tenantId: newUuid } : sh);

      useAppStore.setState({
        tenant: updatedTenant,
        tenants: updatedTenants,
        products: updatedProducts,
        customers: updatedCustomers,
        sales: updatedSales,
        profiles: updatedProfiles,
        suppliers: updatedSuppliers,
        funds: updatedFunds,
        expenses: updatedExpenses,
        services: updatedServices,
        staff: updatedStaff,
        appointments: updatedAppointments,
        commissions: updatedCommissions,
        financialEvents: updatedEvents,
        purchaseInvoices: updatedInvoices,
        shiftHistory: updatedShiftHistory
      });
    }
  }
}
));


