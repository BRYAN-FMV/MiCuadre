import { Tenant, UserProfile, Product, FiscalRange, CashShift, Supplier, Service, Staff, Appointment, FinancialEvent, FinancialFund, Customer, AccountPayment } from '../types';

export const INITIAL_TENANT: Tenant = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Comercial & Servicios El Centro',
  rtn: '08011995123456',
  phone: '+504 9988-7766',
  email: 'contacto@elcentro.hn',
  address: 'Barrio El Centro, 3ra Calle, Tegucigalpa, Honduras',
  businessType: 'MIXED',
  isFiscalEnabled: true,
  pricesIncludeTax: true,
  allowNegativeStock: false,
  currencySymbol: 'L.',
  isLoyaltyEnabled: true,
  loyaltyEarnRate: 100,
  loyaltyPointValue: 1.0,
  subscriptionStatus: 'ACTIVE',
  subscriptionPlan: 'MONTHLY',
  subscriptionExpiresAt: '2026-12-31',
  monthlyPrice: 950,
  ticketPaperWidth: '58mm'
};

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-001',
    tenantId: '00000000-0000-0000-0000-000000000001',
    rtn: '08011990123456',
    name: 'Juan Pérez (Don Juan Mercadito)',
    phone: '+504 9900-1122',
    email: 'juan.perez@gmail.com',
    address: 'Colonia Palmira, Tegucigalpa',
    loyaltyPoints: 150,
    totalSpent: 15000,
    creditLimit: 3000,
    creditBalance: 1250,
    creditDays: 30,
    createdAt: '2026-01-15T10:00:00.000Z'
  },
  {
    id: 'cust-002',
    tenantId: '00000000-0000-0000-0000-000000000001',
    rtn: '08011985654321',
    name: 'Inversiones & Distribuciones San José',
    phone: '+504 2233-4455',
    email: 'ventas@sanjose.hn',
    address: 'Bulevar Morazán, Tegucigalpa',
    loyaltyPoints: 480,
    totalSpent: 48000,
    creditLimit: 5000,
    creditBalance: 450,
    creditDays: 15,
    createdAt: '2026-02-01T14:30:00.000Z'
  },
  {
    id: 'cust-003',
    tenantId: '00000000-0000-0000-0000-000000000001',
    rtn: '05011992987654',
    name: 'María Fernanda Gómez',
    phone: '+504 8877-6655',
    email: 'mfer.gomez@yahoo.com',
    address: 'Colonia Lomas del Guijarro',
    loyaltyPoints: 60,
    totalSpent: 6000,
    creditLimit: 2000,
    creditBalance: 0,
    creditDays: 15,
    createdAt: '2026-03-10T11:20:00.000Z'
  }
];

export const INITIAL_PROFILES: UserProfile[] = [
  {
    id: '00000000-0000-0000-0000-000000000002',
    tenantId: '00000000-0000-0000-0000-000000000001',
    fullName: 'Bryan (Administrador)',
    role: 'ADMIN',
    pinCode: '1234',
    isActive: true
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    tenantId: '00000000-0000-0000-0000-000000000001',
    fullName: 'María López (Cajera)',
    role: 'CAJERO',
    pinCode: '0000',
    isActive: true
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    tenantId: '00000000-0000-0000-0000-000000000001',
    fullName: 'Carlos Ramos (Barbero / Estetico)',
    role: 'STAFF',
    pinCode: '1111',
    isActive: true
  }
];

export const INITIAL_FISCAL_RANGES: FiscalRange[] = [
  {
    id: '11111111-1111-1111-1111-111111111101',
    tenantId: '00000000-0000-0000-0000-000000000001',
    name: 'Caja 1 - Principal',
    cai: 'E83910-149BF1-9243E9-913210-9182C1-02',
    prefix: '000-001-01-',
    rangeStart: 1,
    rangeEnd: 5000,
    currentNumber: 844,
    deadline: '2026-12-31',
    documentType: '01',
    isActive: true,
    isDefault: true
  },
  {
    id: '11111111-1111-1111-1111-111111111102',
    tenantId: '00000000-0000-0000-0000-000000000001',
    name: 'Caja 2 - Expreso',
    cai: 'F94021-250CF2-0354F0-024321-0293D2-03',
    prefix: '000-002-01-',
    rangeStart: 1,
    rangeEnd: 5000,
    currentNumber: 120,
    deadline: '2026-12-31',
    documentType: '01',
    isActive: true,
    isDefault: false
  }
];

export const INITIAL_FISCAL_RANGE: FiscalRange = INITIAL_FISCAL_RANGES[0];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: '00000000-0000-0000-0000-000000000101',
    tenantId: '00000000-0000-0000-0000-000000000001',
    sku: 'BEB-HAR-5LB',
    barcode: '740100100101',
    name: 'Harina de Trigo 5lb',
    category: 'Abarrotes',
    unitOfMeasure: 'Bolsa',
    costPrice: 42.00,
    salePrice: 65.00,
    currentStock: 45,
    minStockAlert: 10,
    taxClassification: 'EXENTO',
    isActive: true,
    tiers: [
      { id: 'tier-1', minQuantity: 12, unitPrice: 58.00, tierName: 'Mayoreo (Docena)' },
      { id: 'tier-2', minQuantity: 50, unitPrice: 52.00, tierName: 'Mayoreo Especial (Saco)' }
    ]
  },
  {
    id: '00000000-0000-0000-0000-000000000102',
    tenantId: '00000000-0000-0000-0000-000000000001',
    sku: 'ACE-COC-1L',
    barcode: '740100100202',
    name: 'Aceite Vegetal 1 Litro',
    category: 'Abarrotes',
    unitOfMeasure: 'Botella',
    costPrice: 55.00,
    salePrice: 85.00,
    currentStock: 28,
    minStockAlert: 8,
    taxClassification: 'GRAVADO_15',
    isActive: true,
    tiers: [
      { id: 'tier-3', minQuantity: 12, unitPrice: 75.00, tierName: 'Mayoreo Caza' }
    ]
  },
  {
    id: '00000000-0000-0000-0000-000000000103',
    tenantId: '00000000-0000-0000-0000-000000000001',
    sku: 'SHAM-BARB-250',
    barcode: '740100100303',
    name: 'Shampoo para Barba y Cuidado 250ml',
    category: 'Cuidado Personal',
    unitOfMeasure: 'Frasco',
    costPrice: 110.00,
    salePrice: 220.00,
    currentStock: 6,
    minStockAlert: 5,
    taxClassification: 'GRAVADO_15',
    isActive: true
  },
  {
    id: '00000000-0000-0000-0000-000000000104',
    tenantId: '00000000-0000-0000-0000-000000000001',
    sku: 'LIC-RUM-750',
    barcode: '740100100404',
    name: 'Ron Añejo Reserva 750ml',
    category: 'Licores',
    unitOfMeasure: 'Botella',
    costPrice: 180.00,
    salePrice: 320.00,
    currentStock: 14,
    minStockAlert: 4,
    taxClassification: 'GRAVADO_18',
    isActive: true
  }
];

export const INITIAL_STAFF: Staff[] = [
  { id: 'staff-1', tenantId: '00000000-0000-0000-0000-000000000001', fullName: 'Carlos Ramos (Barbero Principal)', phone: '+504 9911-2233', isActive: true },
  { id: 'staff-2', tenantId: '00000000-0000-0000-0000-000000000001', fullName: 'Ana Gutiérrez (Esteticista)', phone: '+504 9944-5566', isActive: true }
];

export const INITIAL_SERVICES: Service[] = [
  { id: 'serv-1', tenantId: '00000000-0000-0000-0000-000000000001', name: 'Corte de Cabello + Barba VIP', durationMinutes: 45, price: 250.00, commissionType: 'PERCENTAGE', commissionValue: 40.00, isActive: true },
  { id: 'serv-2', tenantId: '00000000-0000-0000-0000-000000000001', name: 'Tratamiento Capilar e Hidratación', durationMinutes: 30, price: 350.00, commissionType: 'FIXED', commissionValue: 100.00, isActive: true }
];

export const INITIAL_APPOINTMENTS: Appointment[] = [
  {
    id: 'app-1',
    tenantId: '00000000-0000-0000-0000-000000000001',
    customerName: 'Roberto Mendoza',
    customerPhone: '+504 8877-6655',
    staffId: 'staff-1',
    staffName: 'Carlos Ramos (Barbero Principal)',
    serviceId: 'serv-1',
    serviceName: 'Corte de Cabello + Barba VIP',
    scheduledAt: new Date(Date.now() + 3600000).toISOString(),
    status: 'SCHEDULED',
    notes: 'Cliente preferencial'
  }
];

export const INITIAL_SUPPLIERS: Supplier[] = [
  { id: 'supp-1', tenantId: '00000000-0000-0000-0000-000000000001', rtn: '08019001234567', companyName: 'Distribuidora del Norte S.A.', contactName: 'Ing. Fernando Cálix', phone: '+504 2233-4455', email: 'ventas@disnorte.hn', defaultCreditDays: 15, isActive: true },
  { id: 'supp-2', tenantId: '00000000-0000-0000-0000-000000000001', rtn: '05019009876543', companyName: 'Molinos de Honduras S. de R.L.', contactName: 'Lic. Claudia Meza', phone: '+504 2550-1122', email: 'pedidos@molinos.hn', defaultCreditDays: 30, isActive: true }
];

export const INITIAL_FUNDS: FinancialFund[] = [
  { id: 'fund-1', tenantId: '00000000-0000-0000-0000-000000000001', name: 'Caja Principal', type: 'CAJA', balance: 5000.00, isActive: true },
  { id: 'fund-2', tenantId: '00000000-0000-0000-0000-000000000001', name: 'Caja Chica', type: 'CAJA_CHICA', balance: 1500.00, isActive: true },
  { id: 'fund-3', tenantId: '00000000-0000-0000-0000-000000000001', name: 'BAC Credomatic Ahorros', type: 'CUENTA_AHORROS', bankName: 'BAC Credomatic', accountNumber: '741-209-881', balance: 28500.00, isActive: true },
  { id: 'fund-4', tenantId: '00000000-0000-0000-0000-000000000001', name: 'Banco Ficohsa Cheques', type: 'CUENTA_CHEQUES', bankName: 'Banco Ficohsa', accountNumber: '001-902-442', balance: 45000.00, isActive: true }
];

export const INITIAL_CASH_SHIFT: CashShift = {
  id: 'shift-demo-01',
  tenantId: '00000000-0000-0000-0000-000000000001',
  userId: '00000000-0000-0000-0000-000000000002',
  userName: 'Bryan (Administrador)',
  openingAmount: 1000.00,
  status: 'CLOSED',
  openedAt: new Date(Date.now() - 14400000).toISOString(),
  closedAt: new Date(Date.now() - 3600000).toISOString()
};

export const INITIAL_FINANCIAL_EVENTS: FinancialEvent[] = [
  {
    id: 'fe-1',
    tenantId: '00000000-0000-0000-0000-000000000001',
    eventType: 'SUPPLIER_PAYMENT',
    title: 'Pago Proveedor: Distribuidora del Norte',
    description: 'Factura #000-002-01-00045120 a crédito (Harina y Aceite)',
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    amount: 8500.00,
    status: 'PENDING'
  },
  {
    id: 'fe-2',
    tenantId: '00000000-0000-0000-0000-000000000001',
    eventType: 'SAR_DECLARATION',
    title: 'Declaración Mensual ISV (SAR)',
    description: 'Límite de presentación e impuestos recaudados del mes anterior',
    dueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 10).toISOString().split('T')[0],
    amount: 4200.00,
    status: 'PENDING'
  },
  {
    id: 'fe-3',
    tenantId: '00000000-0000-0000-0000-000000000001',
    eventType: 'RECURRING_EXPENSE',
    title: 'Servicio de Energía Eléctrica (ENEE)',
    description: 'Factura de luz mensual del local comercial',
    dueDate: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
    amount: 3250.00,
    status: 'PENDING',
    expenseCategory: 'SERVICIOS_PUBLICOS'
  },
  {
    id: 'fe-4',
    tenantId: '00000000-0000-0000-0000-000000000001',
    eventType: 'RECURRING_EXPENSE',
    title: 'Alquiler del Local Comercial',
    description: 'Renta mensual del local comercial',
    dueDate: new Date(Date.now() + 86400000 * 12).toISOString().split('T')[0],
    amount: 12000.00,
    status: 'PENDING',
    expenseCategory: 'ALQUILER'
  }
];



export const INITIAL_ACCOUNT_PAYMENTS: AccountPayment[] = [
  {
    id: 'pay-1',
    tenantId: '00000000-0000-0000-0000-000000000001',
    type: 'CUSTOMER_PAYMENT',
    customerId: 'cust-1',
    customerName: 'Don Juan Pérez (Mercadito)',
    amount: 500.00,
    paymentMethod: 'CASH',
    notes: 'Abono a cuenta fiada quincenal',
    createdBy: 'Bryan (Administrador)',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
  }
];


