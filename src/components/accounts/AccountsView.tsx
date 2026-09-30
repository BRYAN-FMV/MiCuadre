import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Customer, AccountPayment, PurchaseInvoice } from '../../types';
import {
  BookOpen, Users, Truck, Receipt, Plus, Search, DollarSign,
  AlertTriangle, CheckCircle2, Clock, Printer, Send, CreditCard,
  Wallet, FileText, ArrowUpRight, ArrowDownLeft, X, Edit2
} from 'lucide-react';
import { toast } from 'sonner';

export const AccountsView: React.FC = () => {
  const tenant = useAppStore(state => state.tenant);
  const customers = useAppStore(state => state.customers);
  const suppliers = useAppStore(state => state.suppliers);
  const purchaseInvoices = useAppStore(state => state.purchaseInvoices);
  const accountPayments = useAppStore(state => state.accountPayments);
  const currentUser = useAppStore(state => state.currentUser);
  const activeShift = useAppStore(state => state.activeShift);
  const addCustomer = useAppStore(state => state.addCustomer);
  const updateCustomer = useAppStore(state => state.updateCustomer);
  const addAccountPayment = useAppStore(state => state.addAccountPayment);
  const updateCustomerCreditBalance = useAppStore(state => state.updateCustomerCreditBalance);

  const [activeSubTab, setActiveSubTab] = useState<'customers' | 'suppliers' | 'history'>('customers');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'OVERDUE'>('ALL');

  // Modals state
  const [isAbonoModalOpen, setIsAbonoModalOpen] = useState(false);
  const [selectedCustomerForAbono, setSelectedCustomerForAbono] = useState<Customer | null>(null);
  const [abonoAmount, setAbonoAmount] = useState<string>('');
  const [abonoMethod, setAbonoMethod] = useState<'CASH' | 'CARD' | 'TRANSFER'>('CASH');
  const [abonoNotes, setAbonoNotes] = useState<string>('');

  // Customer Limit Modal
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [selectedCustomerForLimit, setSelectedCustomerForLimit] = useState<Customer | null>(null);
  const [newCreditLimit, setNewCreditLimit] = useState<string>('3000');
  const [newCreditDays, setNewCreditDays] = useState<string>('30');

  // New Customer Modal
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustRtn, setNewCustRtn] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustLimit, setNewCustLimit] = useState('2000');

  // Receipt Modal
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<{
    payment: AccountPayment;
    customer?: Customer;
    prevBalance: number;
    newBalance: number;
  } | null>(null);

  // Multi-tenant isolated lists
  const tenantCustomers = customers.filter(c => c.tenantId === tenant.id);
  const tenantSuppliers = suppliers.filter(s => s.tenantId === tenant.id);
  const tenantPurchaseInvoices = purchaseInvoices.filter(p => p.tenantId === tenant.id);
  const tenantAccountPayments = accountPayments.filter(p => p.tenantId === tenant.id);

  // Filtered lists
  const filteredCustomers = tenantCustomers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.rtn && c.rtn.includes(searchTerm)) ||
      (c.phone && c.phone.includes(searchTerm));
    
    const balance = c.creditBalance || 0;
    if (filterStatus === 'PENDING') return matchesSearch && balance > 0;
    if (filterStatus === 'OVERDUE') return matchesSearch && balance >= (c.creditLimit || 2000);
    return matchesSearch;
  });

  const creditPurchases = tenantPurchaseInvoices.filter(p => p.paymentTerms === 'CREDIT' && p.paymentStatus !== 'PAID');

  // KPIs
  const totalCustomerReceivables = tenantCustomers.reduce((acc, c) => acc + (c.creditBalance || 0), 0);
  const totalSupplierPayables = creditPurchases.reduce((acc, p) => acc + (p.total - p.paidAmount), 0);
  
  const todayStr = new Date().toISOString().split('T')[0];
  const todayAbonosTotal = tenantAccountPayments
    .filter(p => p.type === 'CUSTOMER_PAYMENT' && p.createdAt.startsWith(todayStr))
    .reduce((acc, p) => acc + p.amount, 0);

  const customersWithBalanceCount = tenantCustomers.filter(c => (c.creditBalance || 0) > 0).length;

  // Handlers
  const handleOpenAbonoModal = (customer: Customer) => {
    setSelectedCustomerForAbono(customer);
    setAbonoAmount('');
    setAbonoNotes('');
    setAbonoMethod('CASH');
    setIsAbonoModalOpen(true);
  };

  const handleProcessAbono = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerForAbono) return;

    const amountNum = parseFloat(abonoAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Ingrese un monto de abono válido mayor a cero.');
      return;
    }

    const currentBalance = selectedCustomerForAbono.creditBalance || 0;
    if (amountNum > currentBalance) {
      toast.warning(`El abono (${tenant.currencySymbol} ${amountNum.toFixed(2)}) supera el saldo pendiente (${tenant.currencySymbol} ${currentBalance.toFixed(2)}). Se ajustará a la totalidad adeudada.`);
    }

    const finalAbono = Math.min(amountNum, currentBalance > 0 ? currentBalance : amountNum);
    const newBalance = Math.max(0, currentBalance - finalAbono);

    // Record payment
    const payment = addAccountPayment({
      type: 'CUSTOMER_PAYMENT',
      customerId: selectedCustomerForAbono.id,
      customerName: selectedCustomerForAbono.name,
      amount: finalAbono,
      paymentMethod: abonoMethod,
      notes: abonoNotes || 'Abono a cuenta fiada',
      cashShiftId: activeShift?.id,
      createdBy: currentUser.fullName
    });

    // Update customer credit balance
    updateCustomerCreditBalance(selectedCustomerForAbono.id, newBalance);

    toast.success(`Abono de ${tenant.currencySymbol} ${finalAbono.toFixed(2)} registrado con éxito para ${selectedCustomerForAbono.name}`);

    setIsAbonoModalOpen(false);

    // Open receipt modal
    setSelectedPaymentForReceipt({
      payment,
      customer: selectedCustomerForAbono,
      prevBalance: currentBalance,
      newBalance
    });
  };

  const handleSaveCreditLimit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerForLimit) return;
    const limitNum = parseFloat(newCreditLimit);
    const daysNum = parseInt(newCreditDays, 10);

    if (isNaN(limitNum) || limitNum < 0) {
      toast.error('Ingrese un límite de crédito válido');
      return;
    }

    updateCustomer(selectedCustomerForLimit.id, {
      creditLimit: limitNum,
      creditDays: isNaN(daysNum) ? 30 : daysNum
    });

    toast.success(`Límite de crédito de ${selectedCustomerForLimit.name} actualizado a ${tenant.currencySymbol} ${limitNum.toFixed(2)}`);
    setIsLimitModalOpen(false);
  };

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) {
      toast.error('El nombre del cliente es obligatorio');
      return;
    }

    const created = addCustomer({
      name: newCustName.trim(),
      rtn: newCustRtn.trim() || undefined,
      phone: newCustPhone.trim() || undefined,
      address: newCustAddress.trim() || undefined,
      creditLimit: parseFloat(newCustLimit) || 2000,
      creditBalance: 0,
      creditDays: 30
    });

    toast.success(`Cliente "${created.name}" registrado con éxito`);
    setIsNewCustomerModalOpen(false);
    setNewCustName('');
    setNewCustRtn('');
    setNewCustPhone('');
    setNewCustAddress('');
  };

  const handleSendWhatsAppReceipt = (payment: AccountPayment, customerName?: string, newBal?: number) => {
    const phone = selectedPaymentForReceipt?.customer?.phone || '';
    const cleanPhone = phone.replace(/\D/g, '');
    const message = `*COMPROBANTE DE ABONO - ${tenant.name}*\n\n` +
      `Estimado(a) *${customerName || payment.customerName}*,\n` +
      `Confirmamos la recepción de su abono por valor de *${tenant.currencySymbol} ${payment.amount.toFixed(2)}* (` +
      (payment.paymentMethod === 'CASH' ? 'Efectivo' : payment.paymentMethod === 'CARD' ? 'Tarjeta' : 'Transferencia') + `).\n\n` +
      `*Saldo Pendiente Actual:* ${tenant.currencySymbol} ${(newBal ?? 0).toFixed(2)}\n` +
      `*Fecha:* ${new Date(payment.createdAt).toLocaleString('es-HN')}\n\n` +
      `¡Muchas gracias por su preferencia!`;

    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="accounts-view-container" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Header Banner */}
      <div className="header-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', color: '#0f172a', padding: '1.25rem 1.5rem', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ background: '#ecfdf5', padding: '0.75rem', borderRadius: '10px', border: '1px solid #a7f3d0' }}>
            <Wallet size={28} style={{ color: '#059669' }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>Gestión de Cuentas & Fiados</h2>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
              Control de Cuentas por Cobrar (Clientes) y Cuentas por Pagar (Proveedores)
            </p>
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => setIsNewCustomerModalOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem', fontWeight: 700 }}
        >
          <Plus size={18} />
          <span>Nuevo Cliente Fiador</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ background: '#ffffff', padding: '1rem 1.25rem', borderRadius: '10px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total por Cobrar (Clientes)</span>
            <div style={{ background: '#fee2e2', padding: '0.4rem', borderRadius: '6px' }}>
              <ArrowDownLeft size={18} style={{ color: '#dc2626' }} />
            </div>
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#dc2626', margin: '0.4rem 0 0.2rem 0' }}>
            {tenant.currencySymbol} {totalCustomerReceivables.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {customersWithBalanceCount} cliente(s) con saldo adeudado
          </p>
        </div>

        <div className="card" style={{ background: '#ffffff', padding: '1rem 1.25rem', borderRadius: '10px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total por Pagar (Proveedores)</span>
            <div style={{ background: '#e0f2fe', padding: '0.4rem', borderRadius: '6px' }}>
              <ArrowUpRight size={18} style={{ color: '#0284c7' }} />
            </div>
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0284c7', margin: '0.4rem 0 0.2rem 0' }}>
            {tenant.currencySymbol} {totalSupplierPayables.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {creditPurchases.length} factura(s) de compra pendientes
          </p>
        </div>

        <div className="card" style={{ background: '#ffffff', padding: '1rem 1.25rem', borderRadius: '10px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Abonos Recibidos Hoy</span>
            <div style={{ background: '#dcfce7', padding: '0.4rem', borderRadius: '6px' }}>
              <CheckCircle2 size={18} style={{ color: '#16a34a' }} />
            </div>
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#16a34a', margin: '0.4rem 0 0.2rem 0' }}>
            {tenant.currencySymbol} {todayAbonosTotal.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Cobrado hoy en caja activa
          </p>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.2rem' }}>
        <button
          onClick={() => setActiveSubTab('customers')}
          style={{
            padding: '0.6rem 1.1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeSubTab === 'customers' ? '3px solid var(--accent-primary)' : '3px solid transparent',
            color: activeSubTab === 'customers' ? 'var(--accent-primary)' : 'var(--text-muted)',
            fontWeight: activeSubTab === 'customers' ? 800 : 600,
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <Users size={18} />
          <span>Ventas Fiadas / Clientes (CxC)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('suppliers')}
          style={{
            padding: '0.6rem 1.1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeSubTab === 'suppliers' ? '3px solid var(--accent-primary)' : '3px solid transparent',
            color: activeSubTab === 'suppliers' ? 'var(--accent-primary)' : 'var(--text-muted)',
            fontWeight: activeSubTab === 'suppliers' ? 800 : 600,
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <Truck size={18} />
          <span>Compras a Crédito / Proveedores (CxP)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('history')}
          style={{
            padding: '0.6rem 1.1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeSubTab === 'history' ? '3px solid var(--accent-primary)' : '3px solid transparent',
            color: activeSubTab === 'history' ? 'var(--accent-primary)' : 'var(--text-muted)',
            fontWeight: activeSubTab === 'history' ? 800 : 600,
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <Receipt size={18} />
          <span>Historial de Abonos & Comprobantes</span>
        </button>
      </div>

      {/* TAB 1: CUSTOMERS / CXC */}
      {activeSubTab === 'customers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Controls Bar */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', minWidth: '280px', flex: 1 }}>
              <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input-control"
                style={{ paddingLeft: '2.4rem' }}
                placeholder="Buscar cliente por nombre, RTN o teléfono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Filtrar:</span>
              <button
                className={`btn ${filterStatus === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterStatus('ALL')}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
              >
                Todos
              </button>
              <button
                className={`btn ${filterStatus === 'PENDING' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterStatus('PENDING')}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
              >
                Con Saldo Pendiente
              </button>
              <button
                className={`btn ${filterStatus === 'OVERDUE' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterStatus('OVERDUE')}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
              >
                Límite Excedido
              </button>
            </div>
          </div>

          {/* Customers Table */}
          <div className="card" style={{ overflowX: 'auto', background: '#ffffff', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Cliente</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Contacto / Dirección</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Saldo Adeudado</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Límite de Crédito</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Estado</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No se encontraron clientes que coincidan con la búsqueda.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map(customer => {
                    const balance = customer.creditBalance || 0;
                    const limit = customer.creditLimit || 2000;
                    const usagePct = (balance / limit) * 100;

                    let statusBadge = <span className="badge badge-success" style={{ background: '#dcfce7', color: '#166534', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle2 size={13} /> Al día</span>;
                    if (balance >= limit) {
                      statusBadge = <span className="badge badge-danger" style={{ background: '#fee2e2', color: '#991b1b', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><AlertTriangle size={13} /> Excedido</span>;
                    } else if (usagePct >= 75) {
                      statusBadge = <span className="badge badge-warning" style={{ background: '#fef3c7', color: '#92400e', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Clock size={13} /> Cerca de límite</span>;
                    }

                    return (
                      <tr key={customer.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <strong style={{ color: '#0f172a', display: 'block' }}>{customer.name}</strong>
                          {customer.rtn && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>RTN: {customer.rtn}</span>}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div>{customer.phone || 'Sin teléfono'}</div>
                          {customer.address && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{customer.address}</span>}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <strong style={{ fontSize: '1rem', color: balance > 0 ? '#dc2626' : '#16a34a' }}>
                            {tenant.currencySymbol} {balance.toFixed(2)}
                          </strong>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span>{tenant.currencySymbol} {limit.toFixed(2)}</span>
                            <button
                              onClick={() => {
                                setSelectedCustomerForLimit(customer);
                                setNewCreditLimit(limit.toString());
                                setNewCreditDays((customer.creditDays || 30).toString());
                                setIsLimitModalOpen(true);
                              }}
                              title="Editar Límite"
                              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.1rem' }}
                            >
                              <Edit2 size={14} />
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>{statusBadge}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button
                              className="btn btn-primary"
                              disabled={balance <= 0}
                              onClick={() => handleOpenAbonoModal(customer)}
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                            >
                              <DollarSign size={14} />
                              <span>Registrar Abono</span>
                            </button>
                          </div>
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

      {/* TAB 2: SUPPLIERS / CXP */}
      {activeSubTab === 'suppliers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ overflowX: 'auto', background: '#ffffff', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Proveedor</th>
                  <th style={{ padding: '0.75rem 1rem' }}>N° Factura</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Emisión / Vencimiento</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Monto Total</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Pagado</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Saldo Pendiente</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {creditPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No hay compras a crédito pendientes de pago a proveedores.
                    </td>
                  </tr>
                ) : (
                  creditPurchases.map(inv => {
                    const pending = inv.total - inv.paidAmount;
                    const supp = suppliers.find(s => s.id === inv.supplierId);
                    return (
                      <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <strong>{supp?.companyName || inv.supplierName || 'Proveedor'}</strong>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>{inv.invoiceNumber}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div>Emisión: {inv.issueDate}</div>
                          <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>Vence: {inv.dueDate}</span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>{tenant.currencySymbol} {inv.total.toFixed(2)}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>{tenant.currencySymbol} {inv.paidAmount.toFixed(2)}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <strong style={{ color: '#0284c7' }}>{tenant.currencySymbol} {pending.toFixed(2)}</strong>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          <span className="badge badge-warning" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                            {inv.paymentStatus === 'PARTIAL' ? 'Parcial' : 'Pendiente'}
                          </span>
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

      {/* TAB 3: PAYMENT HISTORY */}
      {activeSubTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ overflowX: 'auto', background: '#ffffff', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Fecha & Hora</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Tipo</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Cliente / Beneficiario</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Monto Abonado</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Método</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Atendido Por</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tenantAccountPayments.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No hay registros de abonos efectuados hasta el momento.
                    </td>
                  </tr>
                ) : (
                  tenantAccountPayments.map(pay => {
                    const cust = tenantCustomers.find(c => c.id === pay.customerId);
                    return (
                      <tr key={pay.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          {new Date(pay.createdAt).toLocaleString('es-HN', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span className="badge badge-success" style={{ background: '#dcfce7', color: '#15803d' }}>
                            Abono Cliente
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <strong>{pay.customerName || cust?.name || 'Cliente'}</strong>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <strong style={{ color: '#16a34a', fontSize: '0.95rem' }}>
                            {tenant.currencySymbol} {pay.amount.toFixed(2)}
                          </strong>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          {pay.paymentMethod === 'CASH' ? 'Efectivo' : pay.paymentMethod === 'CARD' ? 'Tarjeta' : 'Transferencia'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>{pay.createdBy}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          <button
                            className="btn btn-secondary"
                            onClick={() => setSelectedPaymentForReceipt({
                              payment: pay,
                              customer: cust,
                              prevBalance: (cust?.creditBalance || 0) + pay.amount,
                              newBalance: cust?.creditBalance || 0
                            })}
                            style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem', float: 'right' }}
                          >
                            <Printer size={13} />
                            <span>Ver Recibo</span>
                          </button>
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

      {/* MODAL: REGISTRAR ABONO */}
      {isAbonoModalOpen && selectedCustomerForAbono && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a' }}>
                <DollarSign size={22} style={{ color: 'var(--accent-primary)' }} />
                Registrar Abono a Cuenta
              </h3>
              <button onClick={() => setIsAbonoModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>

            <div style={{ marginTop: '0.85rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Cliente:</p>
              <p style={{ margin: '0.1rem 0 0 0', fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>{selectedCustomerForAbono.name}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                <span>Saldo Adeudado:</span>
                <strong style={{ color: '#dc2626' }}>{tenant.currencySymbol} {(selectedCustomerForAbono.creditBalance || 0).toFixed(2)}</strong>
              </div>
            </div>

            <form onSubmit={handleProcessAbono} style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Monto del Abono ({tenant.currencySymbol}) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="input-control"
                  value={abonoAmount}
                  onChange={(e) => setAbonoAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  autoFocus
                  style={{ fontSize: '1.2rem', fontWeight: 800 }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Método de Pago *</label>
                <select
                  className="input-control"
                  value={abonoMethod}
                  onChange={(e) => setAbonoMethod(e.target.value as any)}
                >
                  <option value="CASH">Efectivo</option>
                  <option value="CARD">Tarjeta Débito / Crédito</option>
                  <option value="TRANSFER">Transferencia Bancaria</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Notas u Observaciones (Opcional)</label>
                <input
                  type="text"
                  className="input-control"
                  value={abonoNotes}
                  onChange={(e) => setAbonoNotes(e.target.value)}
                  placeholder="Ej. Abono quincenal..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsAbonoModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 700 }}>Procesar Abono</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR LÍMITE DE CRÉDITO */}
      {isLimitModalOpen && selectedCustomerForLimit && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a' }}>
                <Edit2 size={20} style={{ color: 'var(--accent-primary)' }} />
                Configurar Límite de Crédito
              </h3>
              <button onClick={() => setIsLimitModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
              Cliente: <strong>{selectedCustomerForLimit.name}</strong>
            </p>

            <form onSubmit={handleSaveCreditLimit} style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Límite Máximo de Fiado ({tenant.currencySymbol}) *</label>
                <input
                  type="number"
                  step="100"
                  className="input-control"
                  value={newCreditLimit}
                  onChange={(e) => setNewCreditLimit(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Plazo Máximo de Pago (Días)</label>
                <input
                  type="number"
                  className="input-control"
                  value={newCreditDays}
                  onChange={(e) => setNewCreditDays(e.target.value)}
                  placeholder="30"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsLimitModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NUEVO CLIENTE FIADOR */}
      {isNewCustomerModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a' }}>
                <Users size={20} style={{ color: 'var(--accent-primary)' }} />
                Nuevo Cliente Fiador
              </h3>
              <button onClick={() => setIsNewCustomerModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleCreateCustomer} style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group">
                <label className="form-label">Nombre Completo / Razón Social *</label>
                <input
                  type="text"
                  className="input-control"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="Ej. Don Juan Pérez"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">RTN / DNI (Opcional)</label>
                <input
                  type="text"
                  className="input-control"
                  value={newCustRtn}
                  onChange={(e) => setNewCustRtn(e.target.value)}
                  placeholder="0801199012345"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Teléfono de Contacto</label>
                <input
                  type="text"
                  className="input-control"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="+504 9988-7766"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Dirección</label>
                <input
                  type="text"
                  className="input-control"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  placeholder="Colonia, Ciudad..."
                />
              </div>

              <div className="form-group">
                <label className="form-label">Límite de Crédito Inicial ({tenant.currencySymbol})</label>
                <input
                  type="number"
                  step="100"
                  className="input-control"
                  value={newCustLimit}
                  onChange={(e) => setNewCustLimit(e.target.value)}
                  placeholder="2000"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsNewCustomerModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar Cliente</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: COMPROBANTE DE RECEPCIÓN DE ABONO (RECIBO DE FIADO) */}
      {selectedPaymentForReceipt && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '420px', padding: '1.5rem', background: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0, color: '#0f172a' }}>Comprobante de Abono</h4>
              <button onClick={() => setSelectedPaymentForReceipt(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>

            {/* Thermal Receipt Preview Box */}
            <div id="thermal-receipt-print" style={{ background: '#ffffff', border: '1px dashed #cbd5e1', padding: '1.25rem', fontFamily: 'monospace', fontSize: '0.82rem', color: '#0f172a', borderRadius: '6px' }}>
              <div style={{ textAlign: 'center', marginBottom: '0.85rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>{tenant.name}</h3>
                {tenant.rtn && <div>RTN: {tenant.rtn}</div>}
                {tenant.address && <div style={{ fontSize: '0.75rem' }}>{tenant.address}</div>}
                {tenant.phone && <div style={{ fontSize: '0.75rem' }}>Tel: {tenant.phone}</div>}
                <div style={{ margin: '0.4rem 0', borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '0.2rem 0', fontWeight: 700 }}>
                  COMPROBANTE DE ABONO A FIADO
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div><strong>Recibo N°:</strong> {selectedPaymentForReceipt.payment.id}</div>
                <div><strong>Fecha:</strong> {new Date(selectedPaymentForReceipt.payment.createdAt).toLocaleString('es-HN')}</div>
                <div><strong>Cliente:</strong> {selectedPaymentForReceipt.payment.customerName}</div>
                <div><strong>Atendido por:</strong> {selectedPaymentForReceipt.payment.createdBy}</div>
                <div><strong>Método:</strong> {selectedPaymentForReceipt.payment.paymentMethod === 'CASH' ? 'Efectivo' : selectedPaymentForReceipt.payment.paymentMethod === 'CARD' ? 'Tarjeta' : 'Transferencia'}</div>
              </div>

              <div style={{ borderTop: '1px dashed #000', margin: '0.6rem 0', paddingTop: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 800 }}>
                  <span>MONTO ABONADO:</span>
                  <span>{tenant.currencySymbol} {selectedPaymentForReceipt.payment.amount.toFixed(2)}</span>
                </div>
              </div>

              <div style={{ borderTop: '1px dashed #000', paddingTop: '0.4rem', fontSize: '0.78rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Saldo Anterior:</span>
                  <span>{tenant.currencySymbol} {selectedPaymentForReceipt.prevBalance.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#dc2626' }}>
                  <span>Nuevo Saldo Pendiente:</span>
                  <span>{tenant.currencySymbol} {selectedPaymentForReceipt.newBalance.toFixed(2)}</span>
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.68rem', color: '#64748b' }}>
                * Este documento respalda el abono a cuenta de crédito y no constituye una factura fiscal CAI. *
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                className="btn btn-secondary"
                onClick={() => window.print()}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
              >
                <Printer size={16} />
                <span>Imprimir Recibo</span>
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleSendWhatsAppReceipt(selectedPaymentForReceipt.payment, selectedPaymentForReceipt.customer?.name, selectedPaymentForReceipt.newBalance)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', background: '#25D366', borderColor: '#25D366', fontSize: '0.82rem', fontWeight: 700 }}
              >
                <Send size={16} />
                <span>WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
