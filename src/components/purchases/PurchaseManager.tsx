import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { formatCurrency, calculateCPP } from '../../lib/monetary';
import { toast } from 'sonner';
import { Truck, Plus, CheckCircle, Calendar, DollarSign, Package, Users, Wallet, CreditCard, AlertCircle, Edit2, Trash2, Receipt, Filter, Info, Search } from 'lucide-react';
import { PurchaseInvoice, Supplier, FinancialFund, Expense, ExpenseCategory } from '../../types';

const EXPENSE_CATEGORIES: Array<{ value: ExpenseCategory; label: string }> = [
  { value: 'LIMPIEZA', label: 'Limpieza (Detergente, cloro, escobas, bolsas)' },
  { value: 'SERVICIOS_PUBLICOS', label: 'Servicios Públicos (Energía, agua, internet, teléfono)' },
  { value: 'ALQUILER', label: 'Alquiler / Renta del Local' },
  { value: 'MANTENIMIENTO', label: 'Mantenimiento y Reparaciones de Equipo/Local' },
  { value: 'INSUMOS_OFICINA', label: 'Insumos de Oficina y Papelería' },
  { value: 'ALIMENTOS_VIATICOS', label: 'Alimentos, Pasajes y Viáticos' },
  { value: 'OTROS', label: 'Otros Gastos Operativos' },
];

export const PurchaseManager: React.FC = () => {
  const {
    suppliers, products, purchaseInvoices, funds, expenses, tenant, currentUser, activeShift, fiscalRange,
    processPurchase, addSupplier, payPurchaseInvoice, addFund, updateFund, deleteFund, addExpense, deleteExpense, addFinancialEvent
  } = useAppStore();

  // Multi-tenant strict filtering
  const tenantSuppliers = suppliers.filter(s => s.tenantId === tenant.id);
  const tenantProducts = products.filter(p => p.tenantId === tenant.id);
  const tenantInvoices = purchaseInvoices.filter(i => i.tenantId === tenant.id);
  const tenantFunds = funds.filter(f => f.tenantId === tenant.id);
  const tenantExpenses = (expenses || []).filter(e => e.tenantId === tenant.id);

  const [activeSubTab, setActiveSubTab] = useState<'invoices' | 'expenses' | 'suppliers' | 'funds'>('invoices');

  // Search & Filtering states across sub-tabs
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL');
  const [invoiceSupplierFilter, setInvoiceSupplierFilter] = useState<string>('ALL');

  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [expenseSearchTerm, setExpenseSearchTerm] = useState('');

  // Expense Modal & Filter state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('LIMPIEZA');
  const [expDescription, setExpDescription] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expFundId, setExpFundId] = useState(tenantFunds[0]?.id || '');
  const [expReceiptNumber, setExpReceiptNumber] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedExpenseCategoryFilter, setSelectedExpenseCategoryFilter] = useState<string>('ALL');

  // Calendar Linking Recurring state
  const [isRecurringSchedule, setIsRecurringSchedule] = useState(false);
  const [recurringDueDate, setRecurringDueDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  });

  // New Purchase Modal state
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState(tenantSuppliers[0]?.id || '');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [cai, setCai] = useState('');
  const [paymentTerms, setPaymentTerms] = useState<'CASH' | 'CREDIT'>('CREDIT');
  const [creditDays, setCreditDays] = useState('15');
  const [selectedCashFundId, setSelectedCashFundId] = useState(tenantFunds[0]?.id || '');

  // Purchase Items list
  const [purchaseItems, setPurchaseItems] = useState<Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitCost: number;
    newSalePrice?: number;
  }>>([]);

  const [selectedProdId, setSelectedProdId] = useState(tenantProducts[0]?.id || '');
  const [itemQty, setItemQty] = useState('10');
  const [itemCost, setItemCost] = useState('50.00');

  // Supplier Modal state
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [suppCompanyName, setSuppCompanyName] = useState('');
  const [suppRtn, setSuppRtn] = useState('');
  const [suppContactName, setSuppContactName] = useState('');
  const [suppPhone, setSuppPhone] = useState('');
  const [suppEmail, setSuppEmail] = useState('');
  const [suppCreditDays, setSuppCreditDays] = useState('15');

  // Fund Modal & Edit/Delete state
  const [isFundModalOpen, setIsFundModalOpen] = useState(false);
  const [editingFundId, setEditingFundId] = useState<string | null>(null);
  const [deletingFund, setDeletingFund] = useState<FinancialFund | null>(null);
  const [fundName, setFundName] = useState('');
  const [fundType, setFundType] = useState<FinancialFund['type']>('CAJA');
  const [fundBalance, setFundBalance] = useState('0.00');
  const [fundBankName, setFundBankName] = useState('');
  const [fundAccountNumber, setFundAccountNumber] = useState('');

  // Payment Modal state
  const [selectedInvoiceToPay, setSelectedInvoiceToPay] = useState<PurchaseInvoice | null>(null);
  const [payFundId, setPayFundId] = useState(tenantFunds[0]?.id || '');
  const [payAmountInput, setPayAmountInput] = useState('');

  const handleAddItem = () => {
    const prod = tenantProducts.find(p => p.id === selectedProdId);
    if (!prod) return;

    setPurchaseItems([
      ...purchaseItems,
      {
        productId: prod.id,
        productName: prod.name,
        quantity: parseInt(itemQty) || 1,
        unitCost: parseFloat(itemCost) || 0,
        newSalePrice: prod.salePrice
      }
    ]);
  };

  const handleSavePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNumber || purchaseItems.length === 0) {
      toast.error('Ingresa el número de factura e ítems a recibir');
      return;
    }

    if (paymentTerms === 'CASH' && selectedCashFundId === 'ACTIVE_CASH_SHIFT') {
      if (!activeShift || activeShift.status !== 'OPEN') {
        toast.error('No hay una caja registradora abierta en este terminal para pagar esta compra en efectivo.');
        return;
      }
    }

    const subtotal = purchaseItems.reduce((acc, i) => acc + (i.quantity * i.unitCost), 0);
    const issueDate = new Date().toISOString().split('T')[0];
    const dueDate = new Date(Date.now() + (parseInt(creditDays) * 86400000)).toISOString().split('T')[0];
    const selectedSupplier = tenantSuppliers.find(s => s.id === selectedSupplierId);

    processPurchase(
      {
        supplierId: selectedSupplierId,
        supplierName: selectedSupplier?.companyName,
        invoiceNumber,
        cai,
        issueDate,
        dueDate,
        paymentTerms,
        paymentStatus: paymentTerms === 'CREDIT' ? 'UNPAID' : 'PAID',
        subtotal,
        taxAmount: 0,
        total: subtotal,
        paidAmount: paymentTerms === 'CASH' ? subtotal : 0
      },
      purchaseItems,
      paymentTerms === 'CASH' ? selectedCashFundId : undefined
    );

    toast.success(`Compra #${invoiceNumber} registrada exitosamente.`);
    setIsPurchaseModalOpen(false);
    setInvoiceNumber('');
    setPurchaseItems([]);
  };

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!suppCompanyName.trim()) {
      toast.error('Ingresa el nombre del proveedor');
      return;
    }

    addSupplier({
      companyName: suppCompanyName.trim(),
      rtn: suppRtn.trim() || undefined,
      contactName: suppContactName.trim() || undefined,
      phone: suppPhone.trim() || undefined,
      email: suppEmail.trim() || undefined,
      defaultCreditDays: parseInt(suppCreditDays) || 15,
      isActive: true
    });

    toast.success(`Proveedor ${suppCompanyName} creado.`);
    setIsSupplierModalOpen(false);
    setSuppCompanyName('');
    setSuppRtn('');
    setSuppContactName('');
    setSuppPhone('');
    setSuppEmail('');
  };

  const handleOpenCreateFundModal = () => {
    setEditingFundId(null);
    setFundName('');
    setFundType('CAJA');
    setFundBalance('0.00');
    setFundBankName('');
    setFundAccountNumber('');
    setIsFundModalOpen(true);
  };

  const handleOpenEditFundModal = (fund: FinancialFund) => {
    setEditingFundId(fund.id);
    setFundName(fund.name);
    setFundType(fund.type);
    setFundBalance(String(fund.balance));
    setFundBankName(fund.bankName || '');
    setFundAccountNumber(fund.accountNumber || '');
    setIsFundModalOpen(true);
  };

  const handleSaveFund = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fundName.trim()) {
      toast.error('Ingresa el nombre del fondo');
      return;
    }

    if (editingFundId) {
      updateFund(editingFundId, {
        name: fundName.trim(),
        type: fundType,
        balance: parseFloat(fundBalance) || 0,
        bankName: fundBankName.trim() || undefined,
        accountNumber: fundAccountNumber.trim() || undefined
      });
      toast.success(`Fondo "${fundName}" actualizado exitosamente.`);
    } else {
      addFund({
        name: fundName.trim(),
        type: fundType,
        balance: parseFloat(fundBalance) || 0,
        bankName: fundBankName.trim() || undefined,
        accountNumber: fundAccountNumber.trim() || undefined,
        isActive: true
      });
      toast.success(`Fondo "${fundName}" creado exitosamente.`);
    }

    setIsFundModalOpen(false);
    setEditingFundId(null);
    setFundName('');
    setFundBalance('0.00');
    setFundBankName('');
    setFundAccountNumber('');
  };

  const handleDeleteFund = (fund: FinancialFund) => {
    if (tenantFunds.length <= 1) {
      toast.error('Debes mantener al menos un fondo configurado en el sistema.');
      return;
    }
    setDeletingFund(fund);
  };

  const handleOpenPayModal = (invoice: PurchaseInvoice) => {
    setSelectedInvoiceToPay(invoice);
    const pendingAmount = invoice.total - invoice.paidAmount;
    setPayAmountInput(pendingAmount.toString());
    setPayFundId(tenantFunds[0]?.id || '');
  };

  const handleExecutePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceToPay) return;

    const amount = parseFloat(payAmountInput);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Ingresa un monto válido a pagar');
      return;
    }

    const selectedFund = tenantFunds.find(f => f.id === payFundId);
    if (!selectedFund) {
      toast.error('Selecciona un fondo de pago');
      return;
    }

    if (selectedFund.balance < amount) {
      toast.warning(`Atención: El saldo del fondo (${formatCurrency(selectedFund.balance, tenant.currencySymbol)}) es menor al pago (${formatCurrency(amount, tenant.currencySymbol)}).`);
    }

    payPurchaseInvoice(selectedInvoiceToPay.id, payFundId, amount);

    toast.success(`Pago de ${formatCurrency(amount, tenant.currencySymbol)} procesado desde ${selectedFund.name}.`);
    setSelectedInvoiceToPay(null);
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(expAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Ingresa un monto válido para el gasto');
      return;
    }
    if (!expDescription.trim()) {
      toast.error('Ingresa una descripción clara del gasto');
      return;
    }
    const isCashShift = expFundId === 'ACTIVE_CASH_SHIFT';
    if (isCashShift) {
      if (!activeShift || activeShift.status !== 'OPEN') {
        toast.error('No hay una caja registradora abierta en este terminal para realizar egresos en efectivo.');
        return;
      }
    } else {
      const selectedFund = tenantFunds.find(f => f.id === expFundId);
      if (!selectedFund) {
        toast.error('Selecciona un fondo de pago');
        return;
      }
      if (selectedFund.balance < amount) {
        toast.warning(`Atención: El saldo del fondo (${formatCurrency(selectedFund.balance, tenant.currencySymbol)}) es menor al gasto (${formatCurrency(amount, tenant.currencySymbol)}).`);
      }
    }

    const selectedFund = tenantFunds.find(f => f.id === expFundId);

    addExpense({
      category: expCategory,
      description: expDescription.trim(),
      amount,
      fundId: expFundId,
      fundName: isCashShift ? `Caja Registradora (${activeShift?.cajaName || 'Turno Activo'})` : (selectedFund?.name || 'Fondo'),
      paymentSource: isCashShift ? 'ACTIVE_CASH_SHIFT' : 'FUND',
      receiptNumber: expReceiptNumber.trim() || undefined,
      expenseDate: expDate || new Date().toISOString().split('T')[0],
      registeredBy: currentUser?.fullName || 'Usuario'
    });

    if (isRecurringSchedule) {
      addFinancialEvent({
        eventType: 'RECURRING_EXPENSE',
        title: `Pago Recurrente: ${expDescription.trim()}`,
        description: `Gasto mensual programado (${expCategory})`,
        dueDate: recurringDueDate,
        amount,
        status: 'PENDING',
        expenseCategory: expCategory
      });
      toast.success(`Gasto registrado y próximo vencimiento programado para el ${recurringDueDate} en el Calendario.`);
    } else {
      toast.success(`Gasto de ${formatCurrency(amount, tenant.currencySymbol)} registrado exitosamente.`);
    }

    setIsExpenseModalOpen(false);
    setExpCategory('LIMPIEZA');
    setExpDescription('');
    setExpAmount('');
    setExpReceiptNumber('');
    setIsRecurringSchedule(false);
  };

  const handleDeleteExpenseClick = (expense: Expense) => {
    if (confirm(`¿Eliminar el gasto "${expense.description}" de ${formatCurrency(expense.amount, tenant.currencySymbol)}? El dinero retornará al fondo "${expense.fundName}".`)) {
      deleteExpense(expense.id);
      toast.success('Gasto eliminado y saldo reintegrado al fondo.');
    }
  };

  const getCategoryBadge = (category: ExpenseCategory) => {
    switch (category) {
      case 'LIMPIEZA':
        return <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-block' }}>Limpieza</span>;
      case 'SERVICIOS_PUBLICOS':
        return <span style={{ background: '#fef3c7', color: '#b45309', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-block' }}>Servicios Públicos</span>;
      case 'ALQUILER':
        return <span style={{ background: '#f3e8ff', color: '#6b21a8', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-block' }}>Alquiler / Renta</span>;
      case 'MANTENIMIENTO':
        return <span style={{ background: '#ffedd5', color: '#c2410c', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-block' }}>Mantenimiento</span>;
      case 'INSUMOS_OFICINA':
        return <span style={{ background: '#f1f5f9', color: '#334155', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-block' }}>Insumos Oficina</span>;
      case 'ALIMENTOS_VIATICOS':
        return <span style={{ background: '#dcfce7', color: '#15803d', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-block' }}>Viáticos / Alimentos</span>;
      case 'OTROS':
      default:
        return <span style={{ background: '#f3f4f6', color: '#4b5563', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-block' }}>Otros Gastos</span>;
    }
  };

  // Filtered Invoices
  const filteredInvoices = tenantInvoices.filter(inv => {
    const query = invoiceSearchTerm.trim().toLowerCase();
    const matchesSearch = !query ||
      inv.invoiceNumber.toLowerCase().includes(query) ||
      (inv.supplierName && inv.supplierName.toLowerCase().includes(query));

    const matchesStatus =
      invoiceStatusFilter === 'ALL' ||
      (invoiceStatusFilter === 'PAID' && inv.paymentStatus === 'PAID') ||
      (invoiceStatusFilter === 'PENDING' && (inv.paymentStatus === 'UNPAID' || inv.paymentStatus === 'PARTIAL'));

    const matchesSupplier =
      invoiceSupplierFilter === 'ALL' || inv.supplierId === invoiceSupplierFilter;

    return matchesSearch && matchesStatus && matchesSupplier;
  });

  // Filtered Suppliers
  const filteredSuppliers = tenantSuppliers.filter(s => {
    const query = supplierSearchTerm.trim().toLowerCase();
    if (!query) return true;
    return (
      s.companyName.toLowerCase().includes(query) ||
      (s.rtn && s.rtn.toLowerCase().includes(query)) ||
      (s.contactName && s.contactName.toLowerCase().includes(query)) ||
      (s.phone && s.phone.toLowerCase().includes(query))
    );
  });

  // Filtered Expenses
  const filteredExpenses = tenantExpenses.filter(e => {
    const matchesCat = selectedExpenseCategoryFilter === 'ALL' || e.category === selectedExpenseCategoryFilter;
    const query = expenseSearchTerm.trim().toLowerCase();
    const matchesSearch = !query ||
      e.description.toLowerCase().includes(query) ||
      (e.receiptNumber && e.receiptNumber.toLowerCase().includes(query)) ||
      (e.registeredBy && e.registeredBy.toLowerCase().includes(query));
    return matchesCat && matchesSearch;
  });

  const totalExpensesAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="view-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Header Banner */}
      <div className="glass-panel header-banner">
        <div>
          <h2 style={{ fontSize: '1.2rem', color: '#0f172a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Truck size={22} style={{ color: 'var(--accent-primary)' }} />
            Compras, Gastos Operativos & Gestión de Fondos
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Recepción de inventario, control de egresos/gastos operativos y saldos de fondos
          </p>
        </div>

        <div className="header-controls" style={{ gap: '0.5rem' }}>
          {activeSubTab === 'invoices' && (
            <button className="btn btn-primary" onClick={() => setIsPurchaseModalOpen(true)} style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}>
              <Plus size={16} />
              <span>Registrar Compra</span>
            </button>
          )}

          {activeSubTab === 'expenses' && (
            <button className="btn btn-primary" onClick={() => {
              setExpFundId(tenantFunds[0]?.id || '');
              setIsExpenseModalOpen(true);
            }} style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}>
              <Plus size={16} />
              <span>Registrar Gasto Operativo</span>
            </button>
          )}

          {activeSubTab === 'suppliers' && (
            <button className="btn btn-primary" onClick={() => setIsSupplierModalOpen(true)} style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}>
              <Plus size={16} />
              <span>Agregar Proveedor</span>
            </button>
          )}

          {activeSubTab === 'funds' && (
            <button className="btn btn-primary" onClick={handleOpenCreateFundModal} style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}>
              <Plus size={16} />
              <span>Nuevo Fondo / Cuenta</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub Navigation Bar */}
      <div style={{ display: 'flex', gap: '0.5rem', background: '#f8fafc', padding: '0.35rem', borderRadius: '8px', border: '1px solid #e2e8f0', overflowX: 'auto' }}>
        <button
          onClick={() => setActiveSubTab('invoices')}
          style={{
            flex: 1,
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            background: activeSubTab === 'invoices' ? '#ffffff' : 'transparent',
            color: activeSubTab === 'invoices' ? '#0f172a' : '#64748b',
            boxShadow: activeSubTab === 'invoices' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem'
          }}
        >
          <Truck size={16} />
          <span>Facturas de Compra ({tenantInvoices.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('expenses')}
          style={{
            flex: 1,
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            background: activeSubTab === 'expenses' ? '#ffffff' : 'transparent',
            color: activeSubTab === 'expenses' ? '#0f172a' : '#64748b',
            boxShadow: activeSubTab === 'expenses' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem'
          }}
        >
          <Receipt size={16} />
          <span>Gastos Operativos ({tenantExpenses.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('suppliers')}
          style={{
            flex: 1,
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            background: activeSubTab === 'suppliers' ? '#ffffff' : 'transparent',
            color: activeSubTab === 'suppliers' ? '#0f172a' : '#64748b',
            boxShadow: activeSubTab === 'suppliers' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem'
          }}
        >
          <Users size={16} />
          <span>Proveedores ({tenantSuppliers.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('funds')}
          style={{
            flex: 1,
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            background: activeSubTab === 'funds' ? '#ffffff' : 'transparent',
            color: activeSubTab === 'funds' ? '#0f172a' : '#64748b',
            boxShadow: activeSubTab === 'funds' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem'
          }}
        >
          <Wallet size={16} />
          <span>Fondos & Cuentas ({tenantFunds.length})</span>
        </button>
      </div>

      {/* TAB 1: Invoices */}
      {activeSubTab === 'invoices' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Invoice Filter Toolbar */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', background: '#ffffff', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                className="input-control"
                placeholder="Buscar por N° factura o proveedor..."
                value={invoiceSearchTerm}
                onChange={(e) => setInvoiceSearchTerm(e.target.value)}
                style={{ paddingLeft: '2.2rem', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Filter size={15} style={{ color: '#64748b' }} />
              <select
                className="input-control"
                value={invoiceStatusFilter}
                onChange={(e) => setInvoiceStatusFilter(e.target.value as any)}
                style={{ fontSize: '0.85rem', width: 'auto' }}
              >
                <option value="ALL">Estado: Todos</option>
                <option value="PENDING">Pendientes / Parciales</option>
                <option value="PAID">Pagadas</option>
              </select>

              <select
                className="input-control"
                value={invoiceSupplierFilter}
                onChange={(e) => setInvoiceSupplierFilter(e.target.value)}
                style={{ fontSize: '0.85rem', width: 'auto' }}
              >
                <option value="ALL">Proveedor: Todos</option>
                {tenantSuppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.companyName}</option>
                ))}
              </select>

              {(invoiceSearchTerm || invoiceStatusFilter !== 'ALL' || invoiceSupplierFilter !== 'ALL') && (
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setInvoiceSearchTerm('');
                    setInvoiceStatusFilter('ALL');
                    setInvoiceSupplierFilter('ALL');
                  }}
                  style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem' }}
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          <div className="table-responsive" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>No. Factura</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Proveedor</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Condición</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Fecha Emisión</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Vencimiento</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Total</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Pagado</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Estado</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                      No hay facturas de compras registradas con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map(p => {
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}><code>{p.invoiceNumber}</code></td>
                      <td style={{ padding: '0.75rem 1rem', color: '#0f172a' }}>{p.supplierName || 'Proveedor General'}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span className={`badge ${p.paymentTerms === 'CREDIT' ? 'badge-wholesale' : 'badge-success'}`}>
                          {p.paymentTerms === 'CREDIT' ? 'CRÉDITO' : 'CONTADO'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{p.issueDate}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{p.dueDate}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                        {formatCurrency(p.total, tenant.currencySymbol)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#10b981', fontWeight: 600 }}>
                        {formatCurrency(p.paidAmount, tenant.currencySymbol)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span className={`badge ${p.paymentStatus === 'PAID' ? 'badge-success' : 'badge-retail'}`}>
                          {p.paymentStatus === 'PAID' ? 'PAGADA' : (p.paymentStatus === 'PARTIAL' ? 'PARCIAL' : 'PENDIENTE')}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        {p.paymentStatus !== 'PAID' && (
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleOpenPayModal(p)}
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', gap: '0.3rem' }}
                          >
                            <DollarSign size={14} />
                            <span>Pagar</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* TAB 2: Expenses & Outlays */}
      {activeSubTab === 'expenses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Summary & Filters Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Total Gastos Operativos</span>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ef4444', marginTop: '0.2rem' }}>
                {formatCurrency(totalExpensesAmount, tenant.currencySymbol)}
              </div>
              <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
                {filteredExpenses.length} egreso(s) registrado(s)
              </p>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Search size={14} /> Buscar Gasto
              </span>
              <input
                type="text"
                className="input-control"
                style={{ marginTop: '0.35rem', fontSize: '0.82rem' }}
                placeholder="Buscar descripción, N° recibo..."
                value={expenseSearchTerm}
                onChange={(e) => setExpenseSearchTerm(e.target.value)}
              />
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Filter size={14} /> Filtrar por Categoría
              </span>
              <select
                className="input-control"
                style={{ marginTop: '0.35rem', fontSize: '0.82rem' }}
                value={selectedExpenseCategoryFilter}
                onChange={(e) => setSelectedExpenseCategoryFilter(e.target.value)}
              >
                <option value="ALL">Todas las Categorías ({tenantExpenses.length})</option>
                {EXPENSE_CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Expenses Table */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Fecha</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Categoría</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Descripción del Gasto</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Monto</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Fondo Pagador</th>
                  <th style={{ padding: '0.75rem 1rem' }}>No. Recibo</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Registrado Por</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
                      <Receipt size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                      <p style={{ margin: 0 }}>No hay gastos operativos registrados en esta categoría.</p>
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map(exp => (
                    <tr key={exp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{exp.expenseDate}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{getCategoryBadge(exp.category)}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>{exp.description}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#ef4444' }}>
                        {formatCurrency(exp.amount, tenant.currencySymbol)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#334155' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Wallet size={14} style={{ color: '#64748b' }} />
                          {exp.fundName || 'Fondo'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                        {exp.receiptNumber ? <code>{exp.receiptNumber}</code> : '-'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{exp.registeredBy || 'Usuario'}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <button
                          onClick={() => handleDeleteExpenseClick(exp)}
                          title="Eliminar Gasto (Reintegra saldo al fondo)"
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Suppliers */}
      {activeSubTab === 'suppliers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Supplier Search Bar */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', background: '#ffffff', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                className="input-control"
                placeholder="Buscar por empresa, RTN, contacto o teléfono..."
                value={supplierSearchTerm}
                onChange={(e) => setSupplierSearchTerm(e.target.value)}
                style={{ paddingLeft: '2.2rem', fontSize: '0.85rem' }}
              />
            </div>
            {supplierSearchTerm && (
              <button
                className="btn btn-secondary"
                onClick={() => setSupplierSearchTerm('')}
                style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem' }}
              >
                Limpiar
              </button>
            )}
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Empresa</th>
                  <th style={{ padding: '0.75rem 1rem' }}>RTN</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Contacto</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Teléfono</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Email</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Días Crédito</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                      No hay proveedores registrados con ese criterio.
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>{s.companyName}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}><code>{s.rtn || 'N/D'}</code></td>
                    <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{s.contactName || 'N/D'}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{s.phone || 'N/D'}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{s.email || 'N/D'}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{s.defaultCreditDays} días</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span className={`badge ${s.isActive ? 'badge-success' : 'badge-retail'}`}>
                        {s.isActive ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* TAB 3: Funds */}
      {activeSubTab === 'funds' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {tenantFunds.map(f => (
            <div key={f.id} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div style={{ width: '40px', height: '40px', background: '#ecfdf5', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                    <Wallet size={20} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>{f.type}</span>
                    <button
                      type="button"
                      onClick={() => handleOpenEditFundModal(f)}
                      title="Editar Fondo"
                      style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteFund(f)}
                      title="Eliminar Fondo"
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <h4 style={{ fontSize: '1rem', color: '#0f172a', fontWeight: 700, margin: 0 }}>{f.name}</h4>
                {f.bankName && <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>{f.bankName} - {f.accountNumber}</p>}
              </div>

              <div style={{ marginTop: '1.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Saldo Disponible</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                  {formatCurrency(f.balance, tenant.currencySymbol)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL 1: New Purchase Form */}
      {isPurchaseModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <h3 style={{ color: '#0f172a', marginBottom: '1rem' }}>Ingresar Factura de Compra</h3>
            <form onSubmit={handleSavePurchase} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label">Proveedor *</label>
                    <button type="button" onClick={() => setIsSupplierModalOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}>+ Nuevo</button>
                  </div>
                  <select className="input-control" value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)}>
                    {tenantSuppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.companyName}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">No. Factura Proveedor *</label>
                  <input type="text" className="input-control" placeholder="000-002-01-00045120" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div className="form-group">
                  <label className="form-label">Condición de Pago *</label>
                  <select className="input-control" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value as any)}>
                    <option value="CREDIT">Crédito (Afecta Calendario)</option>
                    <option value="CASH">Contado (Pago de Inmediato)</option>
                  </select>
                </div>

                {paymentTerms === 'CREDIT' ? (
                  <div className="form-group">
                    <label className="form-label">Días de Crédito</label>
                    <input type="number" className="input-control" value={creditDays} onChange={(e) => setCreditDays(e.target.value)} />
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label">Pagar de Fondo *</label>
                    <select className="input-control" value={selectedCashFundId} onChange={(e) => setSelectedCashFundId(e.target.value)}>
                      <option value="ACTIVE_CASH_SHIFT">
                        💵 Caja Registradora en Turno ({activeShift && activeShift.status === 'OPEN' ? `Caja: ${activeShift.cajaName || fiscalRange?.name || 'Principal'}` : 'Sin Turno Abierto'})
                      </option>
                      {tenantFunds.map(f => (
                        <option key={f.id} value={f.id}>{f.name} ({formatCurrency(f.balance, tenant.currencySymbol)})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Items Selector */}
              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <label className="form-label">Agregar Producto Recibido</label>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.4rem', marginTop: '0.3rem' }}>
                  <select className="input-control" value={selectedProdId} onChange={(e) => setSelectedProdId(e.target.value)}>
                    {tenantProducts.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (Stock: {p.currentStock})</option>
                    ))}
                  </select>

                  <input type="number" placeholder="Cant." className="input-control" value={itemQty} onChange={(e) => setItemQty(e.target.value)} />
                  <input type="number" step="0.01" placeholder="Costo Unit." className="input-control" value={itemCost} onChange={(e) => setItemCost(e.target.value)} />

                  <button type="button" className="btn btn-secondary" onClick={handleAddItem} style={{ fontSize: '0.8rem' }}>
                    + Agregar
                  </button>
                </div>

                {/* Items Added Table */}
                {purchaseItems.length > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <table className="table" style={{ width: '100%', fontSize: '0.78rem' }}>
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Cant.</th>
                          <th>Costo Unit.</th>
                          <th>Nuevo CPP Recalculado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchaseItems.map((item, idx) => {
                          const prod = tenantProducts.find(p => p.id === item.productId);
                          const cpp = prod ? calculateCPP(prod.currentStock, prod.costPrice, item.quantity, item.unitCost) : { newCost: item.unitCost };
                          return (
                            <tr key={idx}>
                              <td>{item.productName}</td>
                              <td>+{item.quantity}</td>
                              <td>{formatCurrency(item.unitCost, tenant.currencySymbol)}</td>
                              <td style={{ color: '#10b981', fontWeight: 700 }}>
                                {formatCurrency(cpp.newCost, tenant.currencySymbol)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsPurchaseModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar Compra</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add Supplier Form */}
      {isSupplierModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <h3 style={{ color: '#0f172a', marginBottom: '1rem' }}>Registrar Nuevo Proveedor</h3>
            <form onSubmit={handleSaveSupplier} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group">
                <label className="form-label">Nombre de la Empresa *</label>
                <input type="text" className="input-control" placeholder="Distribuidora San Pedro S.A." value={suppCompanyName} onChange={(e) => setSuppCompanyName(e.target.value)} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div className="form-group">
                  <label className="form-label">RTN</label>
                  <input type="text" className="input-control" placeholder="08019001234567" value={suppRtn} onChange={(e) => setSuppRtn(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Contacto / Atiende</label>
                  <input type="text" className="input-control" placeholder="Lic. María Santos" value={suppContactName} onChange={(e) => setSuppContactName(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div className="form-group">
                  <label className="form-label">Teléfono</label>
                  <input type="text" className="input-control" placeholder="+504 9900-1122" value={suppPhone} onChange={(e) => setSuppPhone(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Días de Crédito Defecto</label>
                  <input type="number" className="input-control" value={suppCreditDays} onChange={(e) => setSuppCreditDays(e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Correo Electrónico</label>
                <input type="email" className="input-control" placeholder="ventas@proveedor.hn" value={suppEmail} onChange={(e) => setSuppEmail(e.target.value)} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsSupplierModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Proveedor</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Create / Edit Fund Form */}
      {isFundModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <h3 style={{ color: '#0f172a', marginBottom: '1rem' }}>
              {editingFundId ? 'Editar Fondo o Cuenta' : 'Crear Nuevo Fondo o Cuenta'}
            </h3>
            <form onSubmit={handleSaveFund} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group">
                <label className="form-label">Nombre del Fondo *</label>
                <input type="text" className="input-control" placeholder="Ej. Caja Chica Sucursal, BAC Dólares" value={fundName} onChange={(e) => setFundName(e.target.value)} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div className="form-group">
                  <label className="form-label">Tipo de Fondo</label>
                  <select className="input-control" value={fundType} onChange={(e) => setFundType(e.target.value as any)}>
                    <option value="CAJA">Caja Principal</option>
                    <option value="CAJA_CHICA">Caja Chica</option>
                    <option value="CUENTA_AHORROS">Cuenta de Ahorros</option>
                    <option value="CUENTA_CHEQUES">Cuenta de Cheques</option>
                    <option value="TARJETA">Tarjeta / Otros</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Saldo ({tenant.currencySymbol})</label>
                  <input type="number" step="0.01" className="input-control" value={fundBalance} onChange={(e) => setFundBalance(e.target.value)} />
                </div>
              </div>

              {(fundType === 'CUENTA_AHORROS' || fundType === 'CUENTA_CHEQUES') && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div className="form-group">
                    <label className="form-label">Nombre del Banco</label>
                    <input type="text" className="input-control" placeholder="BAC / Ficohsa / Atlántida" value={fundBankName} onChange={(e) => setFundBankName(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">No. de Cuenta</label>
                    <input type="text" className="input-control" placeholder="741-992-101" value={fundAccountNumber} onChange={(e) => setFundAccountNumber(e.target.value)} />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsFundModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">{editingFundId ? 'Guardar Cambios' : 'Crear Fondo'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Pay Invoice Selecting Fund */}
      {selectedInvoiceToPay && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <h3 style={{ color: '#0f172a', marginBottom: '0.5rem' }}>Pagar Factura de Compra</h3>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1rem' }}>
              Factura #{selectedInvoiceToPay.invoiceNumber} - {selectedInvoiceToPay.supplierName}
            </p>

            <form onSubmit={handleExecutePayment} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                  <span style={{ color: '#64748b' }}>Monto Total Factura:</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(selectedInvoiceToPay.total, tenant.currencySymbol)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                  <span style={{ color: '#64748b' }}>Monto Pagado Previo:</span>
                  <span style={{ color: '#10b981', fontWeight: 600 }}>{formatCurrency(selectedInvoiceToPay.paidAmount, tenant.currencySymbol)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.4rem', marginTop: '0.4rem' }}>
                  <span style={{ color: '#0f172a', fontWeight: 700 }}>Saldo Pendiente:</span>
                  <span style={{ color: '#ef4444', fontWeight: 800 }}>
                    {formatCurrency(selectedInvoiceToPay.total - selectedInvoiceToPay.paidAmount, tenant.currencySymbol)}
                  </span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">¿De qué Fondo se realiza el pago? *</label>
                <select className="input-control" value={payFundId} onChange={(e) => setPayFundId(e.target.value)} required>
                  {tenantFunds.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name} — Saldo Actual: {formatCurrency(f.balance, tenant.currencySymbol)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Monto a Desembolsar *</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-control"
                  value={payAmountInput}
                  onChange={(e) => setPayAmountInput(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedInvoiceToPay(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ gap: '0.4rem' }}>
                  <CheckCircle size={16} />
                  <span>Confirmar Pago</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Register Expense Modal */}
      {isExpenseModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Receipt size={20} style={{ color: 'var(--accent-primary)' }} />
                Registrar Gasto Operativo
              </h3>
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveExpense} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group">
                <label className="form-label">Categoría del Gasto *</label>
                <select
                  className="input-control"
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value as ExpenseCategory)}
                  required
                >
                  {EXPENSE_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Descripción del Gasto *</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="Ej: Compra de cloro, detergente y bolsas de basura"
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div className="form-group">
                  <label className="form-label">Monto a Desembolsar ({tenant.currencySymbol}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="input-control"
                    placeholder="0.00"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Fondo / Cuenta Pagadora *</label>
                  <select
                    className="input-control"
                    value={expFundId}
                    onChange={(e) => setExpFundId(e.target.value)}
                    required
                  >
                    <option value="ACTIVE_CASH_SHIFT">
                      💵 Caja Registradora en Turno ({activeShift && activeShift.status === 'OPEN' ? `Caja: ${activeShift.cajaName || fiscalRange?.name || 'Principal'}` : 'Sin Turno Abierto'})
                    </option>
                    {tenantFunds.map(f => (
                      <option key={f.id} value={f.id}>{f.name} ({formatCurrency(f.balance, tenant.currencySymbol)})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div className="form-group">
                  <label className="form-label">No. Recibo / Comprobante</label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="REC-00123 (Opcional)"
                    value={expReceiptNumber}
                    onChange={(e) => setExpReceiptNumber(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Fecha del Gasto *</label>
                  <input
                    type="date"
                    className="input-control"
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '0.75rem 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}>
                  <input
                    type="checkbox"
                    checked={isRecurringSchedule}
                    onChange={(e) => setIsRecurringSchedule(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }}
                  />
                  <span>Vincular al Calendario Financiero como Gasto Mensual Recurrente</span>
                </label>

                {isRecurringSchedule && (
                  <div style={{ marginTop: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>Próxima Fecha de Vencimiento / Pago Mensual</label>
                    <input
                      type="date"
                      className="input-control"
                      value={recurringDueDate}
                      onChange={(e) => setRecurringDueDate(e.target.value)}
                      required={isRecurringSchedule}
                    />
                    <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Info size={12} /> Este gasto aparecerá en la proyección de flujo de caja y alertas de vencimiento del Calendario Financiero.
                    </span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsExpenseModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ gap: '0.4rem' }}>
                  <CheckCircle size={16} />
                  <span>Guardar Gasto</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Delete Fund Confirmation Modal */}
      {deletingFund && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: '#ef4444' }}>
              <AlertCircle size={28} />
              <h3 style={{ color: '#0f172a' }}>Eliminar Fondo o Cuenta</h3>
            </div>

            <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '1.25rem' }}>
              ¿Estás seguro de eliminar el fondo <strong>"{deletingFund.name}"</strong>?
              <br />
              <span style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.4rem', display: 'block' }}>
                Esta acción removerá esta cuenta de tus opciones de cobro y desembolso.
              </span>
            </p>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingFund(null)}
                style={{ flex: 1 }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  deleteFund(deletingFund.id);
                  toast.success(`Fondo "${deletingFund.name}" eliminado.`);
                  setDeletingFund(null);
                }}
                style={{ flex: 1, background: '#ef4444', borderColor: '#ef4444', color: '#ffffff' }}
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PurchaseManager;
