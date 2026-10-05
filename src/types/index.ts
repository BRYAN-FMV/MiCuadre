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
}

export interface CartLine {
  productId?: string;
  serviceId?: string;
  staffId?: string;
  staffName?: string;
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
  createdAt: string;
  items?: CartLine[];
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

export interface Service {
  id: string;
  tenantId: string;
  name: string;
  durationMinutes: number;
  price: number;
  commissionType: 'PERCENTAGE' | 'FIXED';
  commissionValue: number;
  isActive: boolean;
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
  customerName: string;
  customerPhone?: string;
  staffId: string;
  staffName?: string;
  serviceId: string;
  serviceName?: string;
  scheduledAt: string;
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


