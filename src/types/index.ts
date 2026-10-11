export type TaxClassification = 'EXENTO' | 'EXONERADO' | 'GRAVADO_15' | 'GRAVADO_18';

export type UserRole = 'ADMIN' | 'CAJERO' | 'BODEGUERO' | 'STAFF';

export type BusinessType = 'RETAIL' | 'SERVICES' | 'WHOLESALE' | 'MIXED';

export interface Tenant {
  id: string;
  name: string;
  rtn?: string;
  phone?: string;
  email?: string;
  address?: string;
  logoUrl?: string;
  businessType: BusinessType;
  isFiscalEnabled: boolean;
  pricesIncludeTax?: boolean; // True if catalog unit prices ALREADY include ISV (Honduras default)
  allowNegativeStock: boolean;
  currencySymbol: string;
  isLoyaltyEnabled?: boolean;
  isServicesEnabled?: boolean;
  isWholesaleEnabled?: boolean;
  loyaltyEarnRate?: number; // Spend amount to earn 1 point (default 100)
  loyaltyPointValue?: number; // Currency value of 1 point (default 1.00)
  subscriptionStatus?: 'ACTIVE' | 'EXPIRED' | 'TRIAL' | 'CANCELLED';
  subscriptionPlan?: 'MONTHLY' | 'ANNUAL' | 'FREE_TRIAL' | 'ENTERPRISE';
  subscriptionExpiresAt?: string; // ISO date string e.g. "2026-12-31"
  monthlyPrice?: number;
  accessPassword?: string; // Master store entrance password for access modal
  ticketPaperWidth?: '58mm' | '80mm'; // Receipt thermal paper width selector (58mm e.g. PT-210 vs 80mm desktop)
}

export interface UserProfile {
  id: string;
  tenantId: string;
  fullName: string;
  role: UserRole;
  pinCode?: string;
  isActive: boolean;
}

export interface FiscalRange {
  id: string;
  tenantId: string;
  name: string; // e.g. "Caja 1 - Principal", "Caja 2 - Expreso"
  cai: string;
  prefix: string;
  rangeStart: number;
  rangeEnd: number;
  currentNumber: number;
  deadline: string;
  documentType: '01' | '04'; // 01 Invoice, 04 Credit Note
  isActive: boolean;
  isDefault?: boolean;
}

export interface PriceTier {
  id: string;
  minQuantity: number;
  maxQuantity?: number;
  unitPrice: number;
  tierName: string;
}

export interface ProductPresentation {
  id: string;
  name: string;        // e.g. "Pack x3", "Fardo x24", "Caja x12"
  unitsCount: number;  // Factor multiplicador / unidades contenidas (ej. 3, 24, 12)
  salePrice: number;   // Precio de venta del paquete
  costPrice?: number;  // Costo de compra referencial del paquete
  barcode?: string;    // Codigo de barras propio del paquete exterior
}

export interface Product {
  id: string;
  tenantId: string;
  sku: string;
  barcode?: string;
  name: string;
  category: string;
  unitOfMeasure: string;
  costPrice: number;
  salePrice: number;
  currentStock: number;
  minStockAlert: number;
  taxClassification: TaxClassification;
  isActive: boolean;
  tiers?: PriceTier[];
  presentations?: ProductPresentation[];
}

export interface CartLine {
  productId?: string;
  serviceId?: string;
  staffId?: string;
  staffName?: string;
  presentationId?: string;
  presentationName?: string;
  unitsPerPackage?: number;
  sku: string;
  barcode?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  originalUnitPrice: number;
  discountAmount: number;
  taxClassification: TaxClassification;
  appliedTierName?: string;
  subtotal: number;
  taxAmount: number;
  total: number;
}

export interface CashShift {
  id: string;
  tenantId: string;
  userId: string;
  userName?: string;
  fiscalRangeId?: string;
  cajaName?: string;
  openingAmount: number;
  closingDeclared?: number;
  closingSystem?: number;
  difference?: number;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt?: string;
}

export type CashMovementType = 'ENTRADA' | 'SALIDA';

export interface CashMovement {
  id: string;
  tenantId: string;
  cashShiftId: string;
  fiscalRangeId: string;
  type: CashMovementType;
  amount: number;
  concept: string;
  registeredBy: string;
  createdAt: string;
  referenceId?: string;
}

export interface Supplier {
  id: string;
  tenantId: string;
  rtn?: string;
  companyName: string;
  contactName?: string;
  phone?: string;
  email?: string;
  defaultCreditDays: number;
  isActive: boolean;
}

export interface PurchaseInvoiceItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  newSalePrice?: number;
  presentationId?: string;
  presentationName?: string;
  unitsPerPackage?: number;
}

export interface PurchaseInvoice {
  id: string;
  tenantId: string;
  supplierId: string;
  supplierName?: string;
  invoiceNumber: string;
  cai?: string;
  issueDate: string;
  dueDate: string;
  paymentTerms: 'CASH' | 'CREDIT';
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
  paymentSource?: 'FUND' | 'ACTIVE_CASH_SHIFT';
  cashShiftId?: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  paidAmount: number;
  items?: PurchaseInvoiceItem[];
}

export interface Customer {
  id: string;
  tenantId: string;
  rtn?: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  loyaltyPoints: number;
  totalSpent: number;
  creditLimit?: number;
  creditBalance?: number;
  creditDays?: number;
  createdAt: string;
}

export interface Sale {
  id: string;
  tenantId: string;
  cashShiftId?: string;
  documentNumber: string;
  isFiscal: boolean;
  cai?: string;
  caiDeadline?: string;
  caiRangeStart?: string;
  caiRangeEnd?: string;
  fiscalRangeId?: string;
  cajaName?: string;
  userName?: string;
  createdBy?: string;
  customerId?: string;
  customerRtn?: string;
  customerName: string;
  subtotal: number;
  discountAmount: number;
  exemptAmount: number;
  exoneratedAmount: number;
  taxable15: number;
  tax15: number;
  taxable18: number;
  tax18: number;
  total: number;
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER' | 'MIXED' | 'CREDIT';
  paymentStatus?: 'UNPAID' | 'PARTIAL' | 'PAID';
  creditDueDate?: string;
  amountPaid?: number;
  loyaltyPointsEarned?: number;
  loyaltyPointsRedeemed?: number;
  loyaltyDiscountAmount?: number;
  status?: 'COMPLETED' | 'VOIDED' | 'REFUNDED';
  voidReason?: string;
  voidedAt?: string;
  createdAt: string;
  items?: CartLine[];
}

export interface SalesReturn {
  id: string;
  tenantId: string;
  saleId: string;
  documentNumber: string;
  cashShiftId?: string;
  reason: string;
  refundMethod: 'CASH' | 'STORE_CREDIT';
  subtotal: number;
  tax15: number;
  tax18: number;
  total: number;
  isDamagedWaste?: boolean;
  items: Array<{
    productId?: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    isDamaged?: boolean;
  }>;
  createdAt: string;
}

export interface InventoryAdjustment {
  id: string;
  tenantId: string;
  productId: string;
  productName: string;
  type: 'MERMA_DANADO' | 'VENCIDO' | 'AJUSTE_CONTEO' | 'USO_INTERNO';
  quantity: number;
  previousStock: number;
  newStock: number;
  notes?: string;
  registeredBy?: string;
  createdAt: string;
}

export interface AccountPayment {
  id: string;
  tenantId: string;
  type: 'CUSTOMER_PAYMENT' | 'SUPPLIER_PAYMENT';
  customerId?: string;
  customerName?: string;
  supplierId?: string;
  supplierName?: string;
  purchaseInvoiceId?: string;
  saleId?: string;
  amount: number;
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER';
  notes?: string;
  cashShiftId?: string;
  createdBy: string;
  createdAt: string;
}

export interface Staff {
  id: string;
  tenantId: string;
  profileId?: string;
  fullName: string;
  phone?: string;
  isActive: boolean;
}

export interface ServiceSupply {
  productId: string;
  quantity: number;
}

export interface Service {
  id: string;
  tenantId: string;
  name: string;
  durationMinutes: number;
  price: number;
  commissionType: 'PERCENTAGE' | 'FIXED';
  commissionValue: number;
  isActive: boolean;
  taxClassification?: TaxClassification;
  supplies?: ServiceSupply[];
}

export interface AppointmentItem {
  id: string;
  serviceId: string;
  serviceName?: string;
  staffId: string;
  staffName?: string;
  durationMinutes?: number;
  price?: number;
}

export interface Appointment {
  id: string;
  tenantId: string;
  type?: 'APPOINTMENT' | 'BLOCK'; // Normal customer appointment or schedule block (Almuerzo / Fuera de servicio)
  blockReason?: string; // e.g. 'Almuerzo', 'Permiso', 'Capacitación', 'Fuera de Servicio'
  customerName: string;
  customerPhone?: string;
  staffId: string;
  staffName?: string;
  serviceId: string;
  serviceName?: string;
  scheduledAt: string;
  durationMinutes?: number;
  endTime?: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  items?: AppointmentItem[];
}

export interface StaffCommission {
  id: string;
  tenantId: string;
  staffId: string;
  staffName?: string;
  saleId: string;
  serviceId?: string;
  serviceName?: string;
  saleAmount: number;
  commissionAmount: number;
  status: 'PENDING' | 'PAID';
  paidAt?: string;
  paidFromShiftId?: string;
  paidFromFundId?: string;
  createdAt: string;
}

export type FundType = 'CAJA' | 'CAJA_CHICA' | 'CUENTA_AHORROS' | 'CUENTA_CHEQUES' | 'TARJETA';

export interface FinancialFund {
  id: string;
  tenantId: string;
  name: string;
  type: FundType;
  balance: number;
  bankName?: string;
  accountNumber?: string;
  isActive: boolean;
}

export interface FinancialEvent {
  id: string;
  tenantId: string;
  eventType: 'SUPPLIER_PAYMENT' | 'SAR_DECLARATION' | 'SAR_CAI_EXPIRY' | 'COMMISSION_PAYOUT' | 'RECURRING_EXPENSE';
  title: string;
  description?: string;
  dueDate: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'DISMISSED';
  referenceId?: string;
  expenseCategory?: ExpenseCategory;
}

export type ExpenseCategory =
  | 'LIMPIEZA'
  | 'SERVICIOS_PUBLICOS'
  | 'ALQUILER'
  | 'MANTENIMIENTO'
  | 'INSUMOS_OFICINA'
  | 'ALIMENTOS_VIATICOS'
  | 'OTROS';

export interface Expense {
  id: string;
  tenantId: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  fundId: string;
  fundName?: string;
  paymentSource?: 'FUND' | 'ACTIVE_CASH_SHIFT';
  cashShiftId?: string;
  receiptNumber?: string;
  expenseDate: string;
  registeredBy?: string;
  createdAt: string;
}


