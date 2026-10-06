import React, { useState, useEffect, useRef } from 'react';
import { useAppStore, HeldOrder } from '../../store/useAppStore';
import { formatCurrency } from '../../lib/monetary';
import { generateEscPosReceipt } from '../../lib/escPos';
import { toast } from 'sonner';
import {
  Search, ShoppingCart, UserCheck, Trash2, Plus, Minus,
  CreditCard, Printer, CheckCircle, Package, PauseCircle, Play, X, Key, Star, UserPlus, Lock, Edit2, AlertTriangle
} from 'lucide-react';
import { Sale, Product, CartLine, Customer } from '../../types';

export const PosContainer: React.FC = () => {
  const products = useAppStore(state => state.products);
  const cartLines = useAppStore(state => state.cartLines);
  const cartCustomer = useAppStore(state => state.cartCustomer);
  const customers = useAppStore(state => state.customers);
  const heldOrders = useAppStore(state => state.heldOrders);
  const tenant = useAppStore(state => state.tenant);
  const currentUser = useAppStore(state => state.currentUser);
  const activeShift = useAppStore(state => state.activeShift);
  const fiscalRange = useAppStore(state => state.fiscalRange);
  const fiscalRanges = useAppStore(state => state.fiscalRanges) || [];
  const selectedFiscalRangeId = useAppStore(state => state.selectedFiscalRangeId);
  const setSelectedFiscalRange = useAppStore(state => state.setSelectedFiscalRange);
  const tenantFiscalRanges = fiscalRanges.filter(f => f.tenantId === tenant.id);

  const addToCart = useAppStore(state => state.addToCart);
  const updateCartLineQty = useAppStore(state => state.updateCartLineQty);
  const updateCartLineStaff = useAppStore(state => state.updateCartLineStaff);
  const removeCartLine = useAppStore(state => state.removeCartLine);
  const clearCart = useAppStore(state => state.clearCart);
  const staff = useAppStore(state => state.staff);
  const profiles = useAppStore(state => state.profiles);
  const setCartCustomer = useAppStore(state => state.setCartCustomer);
  const addCustomer = useAppStore(state => state.addCustomer);
  const holdCurrentCart = useAppStore(state => state.holdCurrentCart);
  const restoreHeldCart = useAppStore(state => state.restoreHeldCart);
  const deleteHeldCart = useAppStore(state => state.deleteHeldCart);
  const processSale = useAppStore(state => state.processSale);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODOS');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isHeldOrdersModalOpen, setIsHeldOrdersModalOpen] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<'FISCAL' | 'TICKET'>('FISCAL');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER' | 'MIXED' | 'CREDIT'>('CASH');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);
  const [selectedTicketCopy, setSelectedTicketCopy] = useState<'ORIGINAL' | 'COPIA'>('ORIGINAL');

  // Customer Modal & Registration state
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isNewCustomerFormOpen, setIsNewCustomerFormOpen] = useState(false);
  const [newCustRtn, setNewCustRtn] = useState('');
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');

  // Loyalty Points Redemption state
  const [redeemedPoints, setRedeemedPoints] = useState<number>(0);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global Keyboard Shortcuts (F2, F4, F12, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        setIsCustomerModalOpen(true);
      } else if (e.key === 'F12' || (e.key === 'Enter' && e.ctrlKey)) {
        e.preventDefault();
        if (cartLines.length > 0) {
          setIsPaymentModalOpen(true);
        } else {
          toast.error('El carrito está vacío');
        }
      } else if (e.key === 'Escape') {
        setIsCustomerModalOpen(false);
        setIsPaymentModalOpen(false);
        setIsHeldOrdersModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cartLines]);

  // Multi-tenant staff list for service assignment
  const tenantStaff = staff.filter(s => s.tenantId === tenant.id && s.isActive);
  const tenantProfiles = profiles.filter(p => p.tenantId === tenant.id && (p.isActive ?? true));
  const availableStaffMap = new Map<string, { id: string; fullName: string }>();
  tenantStaff.forEach(s => availableStaffMap.set(s.id, { id: s.id, fullName: s.fullName }));
  tenantProfiles.forEach(p => {
    if (!availableStaffMap.has(p.id) && !Array.from(availableStaffMap.values()).some(e => e.fullName.toLowerCase() === p.fullName.toLowerCase())) {
      availableStaffMap.set(p.id, { id: p.id, fullName: p.fullName });
    }
  });
  const availableStaff = Array.from(availableStaffMap.values());

  // Multi-tenant catalog filtering & Stock Alerts calculation
  const tenantProducts = products.filter((p: Product) => p.tenantId === tenant.id);
  const categories = ['TODOS', ...Array.from(new Set(tenantProducts.map((p: Product) => p.category)))];

  const outOfStockCount = tenantProducts.filter((p: Product) => p.isActive && p.currentStock <= 0).length;
  const lowStockCount = tenantProducts.filter((p: Product) => p.isActive && p.currentStock > 0 && p.currentStock <= p.minStockAlert).length;

  const filteredProducts = tenantProducts.filter((p: Product) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.barcode && p.barcode.includes(searchTerm));
    const matchesCategory = selectedCategory === 'TODOS' || p.category === selectedCategory;
    return matchesSearch && matchesCategory && p.isActive;
  });

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const match = tenantProducts.find((p: Product) => (p.barcode === searchTerm || p.sku.toLowerCase() === searchTerm.toLowerCase()) && p.isActive);
      if (match) {
        if (!tenant.allowNegativeStock && match.currentStock <= 0) {
          toast.error(`"${match.name}" está AGOTADO. No se puede agregar al carrito.`);
          return;
        }
        addToCart({ product: match });
        toast.success(`+ ${match.name}`);
        setSearchTerm('');
      } else if (filteredProducts.length === 1) {
        if (!tenant.allowNegativeStock && filteredProducts[0].currentStock <= 0) {
          toast.error(`"${filteredProducts[0].name}" está AGOTADO. No se puede agregar al carrito.`);
          return;
        }
        addToCart({ product: filteredProducts[0] });
        toast.success(`+ ${filteredProducts[0].name}`);
        setSearchTerm('');
      } else if (searchTerm.trim() !== '') {
        toast.error('Producto no encontrado');
      }
    }
  };

  const cartSubtotal = cartLines.reduce((acc: number, l: CartLine) => acc + l.subtotal, 0);
  const cartTax15 = cartLines.filter((l: CartLine) => l.taxClassification === 'GRAVADO_15').reduce((acc: number, l: CartLine) => acc + l.taxAmount, 0);
  const cartTax18 = cartLines.filter((l: CartLine) => l.taxClassification === 'GRAVADO_18').reduce((acc: number, l: CartLine) => acc + l.taxAmount, 0);
  const cartGrandTotal = cartLines.reduce((acc: number, l: CartLine) => acc + l.total, 0);

  // Tenant Customers & Loyalty Calculations
  const tenantCustomers = customers.filter((c: Customer) => c.tenantId === tenant.id);
  const selectedCustomerObj = tenantCustomers.find((c: Customer) => c.id === cartCustomer.id);
  const customerAvailablePoints = selectedCustomerObj?.loyaltyPoints ?? cartCustomer.loyaltyPoints ?? 0;

  const pointValue = tenant.loyaltyPointValue || 1.0;
  const loyaltyDiscount = (tenant.isLoyaltyEnabled && redeemedPoints > 0) ? redeemedPoints * pointValue : 0;
  const netPayableTotal = Math.max(0, cartGrandTotal - loyaltyDiscount);

  const tenderedAmount = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, tenderedAmount - netPayableTotal);

  const filteredCustomers = tenantCustomers.filter((c: Customer) => {
    const q = customerSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) ||
      (c.rtn && c.rtn.includes(q)) ||
      (c.phone && c.phone.includes(q));
  });

  // Auto-suggest Ticket Interno (Sin CAI) for low amount sales (< L 100) without customer RTN
  useEffect(() => {
    if (isPaymentModalOpen && tenant.isFiscalEnabled) {
      if (netPayableTotal < 100 && !cartCustomer.rtn) {
        setSelectedDocType('TICKET');
      } else {
        setSelectedDocType('FISCAL');
      }
    }
  }, [isPaymentModalOpen, tenant.isFiscalEnabled, netPayableTotal, cartCustomer.rtn]);

  const handleConfirmPayment = () => {
    const isShiftOpen = activeShift && activeShift.tenantId === tenant.id && activeShift.status === 'OPEN';
    if (!isShiftOpen) {
      toast.error('Debes abrir turno de caja antes de facturar', {
        action: { label: 'Abrir Caja', onClick: () => useAppStore.setState({ isShiftModalOpen: true }) }
      });
      return;
    }

    if (tenant.isFiscalEnabled && selectedDocType === 'FISCAL' && (!fiscalRange || !fiscalRange.isActive)) {
      toast.error('El Rango Fiscal SAR no está activo o se agotó');
      return;
    }

    if (paymentMethod === 'CREDIT') {
      if (!cartCustomer.id || cartCustomer.name === 'Consumidor Final') {
        toast.error('Debe seleccionar un cliente registrado (F4) para realizar una venta al crédito / fiado');
        setIsCustomerModalOpen(true);
        return;
      }
      const custObj = tenantCustomers.find(c => c.id === cartCustomer.id);
      const curBal = custObj?.creditBalance || 0;
      const lim = custObj?.creditLimit || 2000;
      if (curBal + netPayableTotal > lim) {
        toast.warning(`Atención: El saldo (L. ${(curBal + netPayableTotal).toFixed(2)}) supera el límite de crédito (L. ${lim.toFixed(2)})`);
      }
    }

    const isOverrideFiscal = Boolean(tenant.isFiscalEnabled);
    const completedSale = processSale(paymentMethod, redeemedPoints, isOverrideFiscal);
    if (!completedSale) return;

    setLastCompletedSale(completedSale);
    setIsPaymentModalOpen(false);
    setCashTendered('');
    setRedeemedPoints(0);
    toast.success(`Venta ${completedSale.isFiscal ? 'Fiscal SAR' : 'Ticket Interno'} ${paymentMethod === 'CREDIT' ? '(Crédito)' : ''} #${completedSale.documentNumber} realizada con éxito`);
  };

  const handleCreateNewCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) {
      toast.error('Ingresa el nombre del cliente');
      return;
    }

    const created = addCustomer({
      name: newCustName.trim(),
      rtn: newCustRtn.trim() || undefined,
      phone: newCustPhone.trim() || undefined,
      email: newCustEmail.trim() || undefined,
      address: newCustAddress.trim() || undefined
    });

    setCartCustomer({
      id: created.id,
      name: created.name,
      rtn: created.rtn,
      loyaltyPoints: created.loyaltyPoints
    });

    toast.success(`Cliente ${created.name} registrado y seleccionado`);
    setIsNewCustomerFormOpen(false);
    setNewCustName('');
    setNewCustRtn('');
    setNewCustPhone('');
    setNewCustEmail('');
    setNewCustAddress('');
  };

  const handleHoldCart = () => {
    if (cartLines.length === 0) return;
    holdCurrentCart();
    toast.success('Orden retenida en espera');
  };

  const handlePrintEscPos = (copyType: 'ORIGINAL' | 'COPIA' = 'ORIGINAL') => {
    if (!lastCompletedSale) return;
    try {
      generateEscPosReceipt(lastCompletedSale, tenant, copyType);
      window.print();
    } catch (err) {
      toast.error('Error al imprimir ticket');
    }
  };

  return (
    <div className="pos-layout-grid">

      {/* LEFT: Product Catalog & Fast Search */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', overflow: 'hidden' }}>

        {/* Search Header Bar */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.75rem 1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              id="pos-search-input"
              ref={searchInputRef}
              type="text"
              className="input-control"
              placeholder="Escriba o escanee producto (F2)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyPress}
              style={{ paddingLeft: '2.5rem', width: '100%', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            {heldOrders.length > 0 && (
              <button
                className="btn btn-secondary"
                onClick={() => setIsHeldOrdersModalOpen(true)}
                style={{ padding: '0.4rem 0.65rem', fontSize: '0.78rem', color: '#8b5cf6', borderColor: '#c4b5fd' }}
              >
                <PauseCircle size={14} />
                <span>Retenidas ({heldOrders.length})</span>
              </button>
            )}

            {tenant.isFiscalEnabled && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#0f172a',
                  fontSize: '0.8rem',
                  fontWeight: 700
                }}
                title={`Caja Registradora asignada a esta máquina (${fiscalRange?.name || 'Caja 1'})`}
              >
                <Lock size={14} style={{ color: 'var(--accent-primary)' }} />
                <span>{fiscalRange?.name ? (fiscalRange.name.startsWith('Caja') ? fiscalRange.name : `Caja ${fiscalRange.name}`) : 'Caja 1'}</span>
                {currentUser?.role === 'ADMIN' && tenantFiscalRanges.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextRange = tenantFiscalRanges.find(r => r.id !== fiscalRange?.id) || tenantFiscalRanges[0];
                      if (nextRange) {
                        setSelectedFiscalRange(nextRange.id);
                        toast.info(`Terminal reconfigurado a ${nextRange.name}`);
                      }
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '0 2px', marginLeft: '0.2rem' }}
                    title="Cambiar caja asignada a esta PC (Solo Admin)"
                  >
                    <Edit2 size={13} />
                  </button>
                )}
              </div>
            )}

            <div className="desktop-shortcuts" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', background: '#f1f5f9', color: '#475569', borderRadius: '6px', fontWeight: 600 }}>F2 Buscar</span>
              <span style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', background: '#f1f5f9', color: '#475569', borderRadius: '6px', fontWeight: 600 }}>F4 Cliente</span>
              <span style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', background: '#ecfdf5', color: '#047857', borderRadius: '6px', fontWeight: 700 }}>F12 Cobrar</span>
            </div>
          </div>
        </div>

        {/* Category Pills Slider */}
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
          {categories.map((cat: string) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '0.45rem 0.9rem',
                  background: isActive ? 'var(--accent-primary)' : '#ffffff',
                  color: isActive ? '#ffffff' : '#475569',
                  border: isActive ? '1px solid var(--accent-primary)' : '1px solid #cbd5e1',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: isActive ? 700 : 500,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Inventory Warning Alert Banner */}
        {(outOfStockCount > 0 || lowStockCount > 0) && (
          <div style={{
            background: outOfStockCount > 0 ? '#fef2f2' : '#fffbeb',
            border: `1px solid ${outOfStockCount > 0 ? '#fecaca' : '#fde68a'}`,
            borderRadius: '8px',
            padding: '0.45rem 0.75rem',
            fontSize: '0.78rem',
            color: outOfStockCount > 0 ? '#991b1b' : '#92400e',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
          }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>
              <strong>Alerta de Inventario:</strong>{' '}
              {outOfStockCount > 0 ? `${outOfStockCount} producto(s) AGOTADO(S)` : ''}
              {outOfStockCount > 0 && lowStockCount > 0 ? ' • ' : ''}
              {lowStockCount > 0 ? `${lowStockCount} producto(s) con STOCK BAJO` : ''}
              {!tenant.allowNegativeStock && outOfStockCount > 0 && (
                <span style={{ marginLeft: '0.4rem', fontWeight: 600, opacity: 0.85 }}>(Ventas sin stock bloqueadas)</span>
              )}
            </span>
          </div>
        )}

        {/* Product Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.85rem', overflowY: 'auto', flex: 1, paddingRight: '0.2rem' }}>
          {filteredProducts.map((product: Product) => {
            const hasTiers = product.tiers && product.tiers.length > 0;
            const isOutOfStock = product.currentStock <= 0;
            const isLowStock = product.currentStock > 0 && product.currentStock <= product.minStockAlert;
            const isDisabled = isOutOfStock && !tenant.allowNegativeStock;

            return (
              <div
                key={product.id}
                onClick={() => {
                  if (isDisabled) {
                    toast.error(`"${product.name}" está AGOTADO. Habilite "Venta con Stock Negativo" en Configuración para vender sin existencia.`);
                    return;
                  }
                  addToCart({ product });
                  toast.success(`+ ${product.name}`);
                }}
                style={{
                  padding: '0.85rem',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  background: isDisabled ? '#f8fafc' : '#ffffff',
                  border: `1px solid ${isOutOfStock ? '#fca5a5' : (isLowStock ? '#fde68a' : '#e2e8f0')}`,
                  borderRadius: '10px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  transition: 'transform 0.1s ease, border-color 0.1s ease',
                  position: 'relative',
                  opacity: isDisabled ? 0.7 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isDisabled) {
                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isDisabled) {
                    e.currentTarget.style.borderColor = isOutOfStock ? '#fca5a5' : (isLowStock ? '#fde68a' : '#e2e8f0');
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
              >
                {isOutOfStock ? (
                  <span style={{ position: 'absolute', top: '6px', right: '6px', fontSize: '0.62rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: '#fee2e2', color: '#991b1b', fontWeight: 700 }}>
                    Agotado
                  </span>
                ) : isLowStock ? (
                  <span style={{ position: 'absolute', top: '6px', right: '6px', fontSize: '0.62rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: '#fef3c7', color: '#92400e', fontWeight: 700 }}>
                    Poco Stock
                  </span>
                ) : hasTiers ? (
                  <span className="badge badge-wholesale" style={{ position: 'absolute', top: '6px', right: '6px', fontSize: '0.6rem', padding: '0.15rem 0.4rem' }}>
                    Mayoreo
                  </span>
                ) : null}

                <div>
                  <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: isOutOfStock ? '#fee2e2' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem', color: isOutOfStock ? '#ef4444' : '#64748b' }}>
                    <Package size={20} />
                  </div>

                  <h4 style={{ fontSize: '0.85rem', color: isDisabled ? '#64748b' : '#0f172a', fontWeight: 600, lineHeight: '1.25', height: '2.5em', overflow: 'hidden', marginBottom: '0.4rem' }}>
                    {product.name}
                  </h4>
                </div>

                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: isDisabled ? '#94a3b8' : 'var(--accent-primary)' }}>
                    {formatCurrency(product.salePrice, tenant.currencySymbol)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: isOutOfStock ? '#ef4444' : (isLowStock ? '#d97706' : '#64748b'), fontWeight: isOutOfStock || isLowStock ? 700 : 400, marginTop: '0.15rem' }}>
                    Stock: {product.currentStock} {product.unitOfMeasure}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT: Modern Checkout Panel */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>

        {/* Customer Header */}
        <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
          <div>
            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Venta Actual</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.1rem' }}>
              <h3 style={{ fontSize: '0.95rem', color: '#0f172a', fontWeight: 700, margin: 0 }}>{cartCustomer.name}</h3>
              {cartCustomer.rtn && (
                <span className="badge badge-fiscal" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>
                  RTN: {cartCustomer.rtn}
                </span>
              )}
              {tenant.isLoyaltyEnabled && customerAvailablePoints > 0 && (
                <span className="badge badge-success" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem', background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                  <Star size={11} style={{ fill: '#d97706' }} />
                  {customerAvailablePoints} pts
                </span>
              )}
            </div>
          </div>

          <button
            className="btn btn-secondary"
            onClick={() => setIsCustomerModalOpen(true)}
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', background: '#ffffff' }}
          >
            <UserCheck size={14} />
            <span>Cliente</span>
          </button>
        </div>

        {/* Line Items Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 80px', padding: '0.5rem 1rem', background: '#f1f5f9', fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
          <span>Producto</span>
          <span style={{ textAlign: 'center' }}>Cant.</span>
          <span style={{ textAlign: 'right' }}>Total</span>
        </div>

        {/* Line Items List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.25rem 1rem' }}>
          {cartLines.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', gap: '0.5rem' }}>
              <ShoppingCart size={36} style={{ opacity: 0.3 }} />
              <p style={{ fontSize: '0.85rem' }}>Carrito vacío. Haz clic en productos para vender.</p>
            </div>
          ) : (
            cartLines.map((line: CartLine, index: number) => (
              <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 80px', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid #f1f5f9' }}>
                <div>
                  <h5 style={{ fontSize: '0.82rem', color: '#0f172a', fontWeight: 600, margin: 0 }}>{line.name}</h5>
                  {line.appliedTierName && (
                    <span className="badge badge-wholesale" style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem' }}>
                      {line.appliedTierName}
                    </span>
                  )}
                  {line.serviceId && (
                    <div style={{ marginTop: '0.2rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ fontWeight: 600, color: '#6b21a8' }}>Atendido por:</span>
                      <select
                        value={line.staffId || ''}
                        onChange={(e) => updateCartLineStaff(index, e.target.value)}
                        style={{
                          padding: '0.1rem 0.3rem',
                          borderRadius: '4px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.72rem',
                          background: line.staffId ? '#f3e8ff' : '#ffffff',
                          color: line.staffId ? '#6b21a8' : '#64748b',
                          fontWeight: line.staffId ? 700 : 400
                        }}
                      >
                        <option value="">-- Seleccionar Personal --</option>
                        {availableStaff.map(st => (
                          <option key={st.id} value={st.id}>{st.fullName}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                  <button
                    onClick={() => updateCartLineQty(index, line.quantity - 1)}
                    style={{ width: '32px', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 800, fontSize: '1rem' }}
                    title="Disminuir cantidad"
                  >
                    -
                  </button>
                  <span style={{ fontWeight: 800, fontSize: '0.9rem', width: '24px', textAlign: 'center', color: '#0f172a' }}>{line.quantity}</span>
                  <button
                    onClick={() => updateCartLineQty(index, line.quantity + 1)}
                    style={{ width: '32px', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 800, fontSize: '1rem' }}
                    title="Aumentar cantidad"
                  >
                    +
                  </button>
                  <button
                    onClick={() => removeCartLine(index)}
                    style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginLeft: '0.2rem' }}
                    title="Eliminar producto del carrito"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div style={{ textAlign: 'right', fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>
                  {formatCurrency(line.total, tenant.currencySymbol)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals & Action Buttons Footer */}
        <div style={{ padding: '0.85rem 1rem', background: '#fafafa', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
            <span>Subtotal:</span>
            <span>{formatCurrency(cartSubtotal, tenant.currencySymbol)}</span>
          </div>

          {cartTax15 > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
              <span>ISV 15%:</span>
              <span>{formatCurrency(cartTax15, tenant.currencySymbol)}</span>
            </div>
          )}

          {cartTax18 > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
              <span>ISV 18%:</span>
              <span>{formatCurrency(cartTax18, tenant.currencySymbol)}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem', paddingTop: '0.4rem', borderTop: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>Total Pagar:</span>
            <span style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
              {formatCurrency(cartGrandTotal, tenant.currencySymbol)}
            </span>
          </div>

          {/* Action Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '0.4rem' }}>
            <button
              className="btn btn-secondary"
              onClick={clearCart}
              disabled={cartLines.length === 0}
              style={{ padding: '0.55rem', fontSize: '0.8rem', color: '#dc2626', borderColor: '#fca5a5' }}
            >
              Vaciar Carrito
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleHoldCart}
              disabled={cartLines.length === 0}
              style={{ padding: '0.55rem', fontSize: '0.8rem', color: 'var(--accent-primary)', borderColor: 'var(--accent-primary)' }}
            >
              <PauseCircle size={14} />
              <span>Retener</span>
            </button>
          </div>

          <button
            className="btn btn-primary"
            onClick={() => setIsPaymentModalOpen(true)}
            disabled={cartLines.length === 0}
            style={{ padding: '0.75rem', fontSize: '1rem', fontWeight: 800, borderRadius: '8px', width: '100%', marginTop: '0.25rem' }}
          >
            Cobrar Venta ({formatCurrency(cartGrandTotal, tenant.currencySymbol)})
          </button>
        </div>
      </div>

      {/* MODAL: Customer Selection & Quick Registration (F4) */}
      {isCustomerModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: '#0f172a', margin: 0 }}>Seleccionar Cliente (F4)</h3>
              <button className="btn btn-secondary" onClick={() => setIsCustomerModalOpen(false)} style={{ padding: '0.3rem 0.5rem' }}>
                <X size={16} />
              </button>
            </div>

            {/* Quick Actions Header */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setCartCustomer({ name: 'Consumidor Final' });
                  setIsCustomerModalOpen(false);
                }}
                style={{ flex: 1, fontSize: '0.78rem', padding: '0.45rem' }}
              >
                Consumidor Final
              </button>
              <button
                type="button"
                className={`btn ${isNewCustomerFormOpen ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setIsNewCustomerFormOpen(!isNewCustomerFormOpen)}
                style={{ flex: 1, fontSize: '0.78rem', padding: '0.45rem' }}
              >
                <UserPlus size={14} />
                <span>{isNewCustomerFormOpen ? 'Ver Lista' : '+ Nuevo Cliente'}</span>
              </button>
            </div>

            {isNewCustomerFormOpen ? (
              /* New Customer Registration Form */
              <form onSubmit={handleCreateNewCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ fontSize: '0.88rem', color: '#0f172a', margin: 0, fontWeight: 700 }}>Registrar Nuevo Cliente</h4>
                
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Nombre / Razón Social *</label>
                  <input
                    type="text"
                    className="input-control"
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    placeholder="Ej. Distribuidora Gómez"
                    required
                    autoFocus
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>RTN / DNI (Opcional)</label>
                    <input
                      type="text"
                      className="input-control"
                      value={newCustRtn}
                      onChange={(e) => setNewCustRtn(e.target.value)}
                      placeholder="08011995123456"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Teléfono</label>
                    <input
                      type="text"
                      className="input-control"
                      value={newCustPhone}
                      onChange={(e) => setNewCustPhone(e.target.value)}
                      placeholder="+504 9900-0000"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Correo Electrónico</label>
                  <input
                    type="email"
                    className="input-control"
                    value={newCustEmail}
                    onChange={(e) => setNewCustEmail(e.target.value)}
                    placeholder="cliente@ejemplo.hn"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Dirección</label>
                  <input
                    type="text"
                    className="input-control"
                    value={newCustAddress}
                    onChange={(e) => setNewCustAddress(e.target.value)}
                    placeholder="Colonia, Ciudad"
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.4rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsNewCustomerFormOpen(false)} style={{ fontSize: '0.78rem' }}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ fontSize: '0.78rem' }}>
                    Guardar & Seleccionar
                  </button>
                </div>
              </form>
            ) : (
              /* Customer Directory Search & Selector */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    className="input-control"
                    placeholder="Buscar cliente guardado por Nombre o RTN..."
                    value={customerSearchQuery}
                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                    style={{ paddingLeft: '2.2rem', fontSize: '0.85rem' }}
                    autoFocus
                  />
                </div>

                <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingRight: '0.2rem' }}>
                  {filteredCustomers.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: '#64748b', textAlign: 'center', padding: '1rem' }}>
                      No se encontraron clientes guardados.
                    </p>
                  ) : (
                    filteredCustomers.map(c => {
                      const isSelected = cartCustomer.id === c.id;
                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            setCartCustomer({
                              id: c.id,
                              name: c.name,
                              rtn: c.rtn,
                              loyaltyPoints: c.loyaltyPoints
                            });
                            setIsCustomerModalOpen(false);
                            toast.success(`Cliente ${c.name} seleccionado`);
                          }}
                          style={{
                            padding: '0.6rem 0.75rem',
                            borderRadius: '8px',
                            border: isSelected ? '2px solid var(--accent-primary)' : '1px solid #e2e8f0',
                            background: isSelected ? '#ecfdf5' : '#ffffff',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <div>
                            <h5 style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: 600, margin: 0 }}>{c.name}</h5>
                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              {c.rtn ? `RTN: ${c.rtn}` : 'Sin RTN registrado'} {c.phone ? `• ${c.phone}` : ''}
                            </span>
                          </div>

                          {tenant.isLoyaltyEnabled && (
                            <span className="badge badge-success" style={{ fontSize: '0.7rem', padding: '0.2rem 0.45rem', background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Star size={12} style={{ fill: '#d97706' }} />
                              {c.loyaltyPoints || 0} pts
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Direct Manual Entry Option */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Entrada rápida manual para esta factura:</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="Nombre del cliente"
                      value={cartCustomer.name}
                      onChange={(e) => setCartCustomer({ ...cartCustomer, name: e.target.value })}
                      style={{ fontSize: '0.8rem' }}
                    />
                    <input
                      type="text"
                      className="input-control"
                      placeholder="RTN cliente (Opcional)"
                      value={cartCustomer.rtn || ''}
                      onChange={(e) => setCartCustomer({ ...cartCustomer, rtn: e.target.value })}
                      style={{ fontSize: '0.8rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.4rem' }}>
                  <button className="btn btn-primary" onClick={() => setIsCustomerModalOpen(false)} style={{ fontSize: '0.8rem' }}>
                    Aceptar & Cerrar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Held Orders */}
      {isHeldOrdersModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: '#0f172a' }}>Órdenes Retenidas en Espera</h3>
              <button className="btn btn-secondary" onClick={() => setIsHeldOrdersModalOpen(false)}>Cerrar</button>
            </div>

            {(() => {
              const tenantHeldOrders = heldOrders.filter((o: HeldOrder) => !o.tenantId || o.tenantId === tenant.id);
              if (tenantHeldOrders.length === 0) {
                return <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>No hay órdenes retenidas para este comercio.</p>;
              }
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '350px', overflowY: 'auto' }}>
                  {tenantHeldOrders.map((order: HeldOrder) => {
                    const orderTotal = order.lines.reduce((a, b) => a + b.total, 0);
                  return (
                    <div key={order.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h5 style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 600 }}>{order.customerName}</h5>
                        <p style={{ fontSize: '0.72rem', color: '#64748b' }}>{order.createdAt} • {order.lines.length} productos</p>
                        <span style={{ fontWeight: 800, color: 'var(--accent-primary)', fontSize: '0.95rem' }}>
                          {formatCurrency(orderTotal, tenant.currencySymbol)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button
                          className="btn btn-primary"
                          onClick={() => {
                            restoreHeldCart(order.id);
                            setIsHeldOrdersModalOpen(false);
                            toast.success(`Orden de ${order.customerName} cargada`);
                          }}
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                        >
                          <Play size={13} /> Cargar
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => deleteHeldCart(order.id)}
                          style={{ padding: '0.35rem 0.5rem', fontSize: '0.78rem' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
          </div>
        </div>
      )}

      {/* MODAL: Payment Execution (F12) */}
      {isPaymentModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            {/* Document Header Info */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.65rem 0.85rem', borderRadius: '8px', marginBottom: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>
                Comprobante: {tenant.isFiscalEnabled ? 'Factura Fiscal SAR (CAI)' : 'Ticket de Venta POS'}
              </span>
              <span className={`badge ${tenant.isFiscalEnabled ? 'badge-success' : 'badge-wholesale'}`} style={{ fontSize: '0.68rem', fontWeight: 700 }}>
                {tenant.isFiscalEnabled ? 'SAR CAI' : 'TICKET'}
              </span>
            </div>

            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '0.85rem', borderRadius: '8px', marginBottom: '1rem', textAlign: 'center' }}>
              <p style={{ fontSize: '0.8rem', color: '#047857', fontWeight: 600 }}>Total a Cobrar:</p>
              <h2 style={{ fontSize: '2rem', color: 'var(--accent-primary)', fontWeight: 800, margin: 0 }}>
                {formatCurrency(netPayableTotal, tenant.currencySymbol)}
              </h2>
              {loyaltyDiscount > 0 && (
                <p style={{ fontSize: '0.75rem', color: '#059669', margin: '0.2rem 0 0 0', fontWeight: 600 }}>
                  (Descuento Puntos: -{formatCurrency(loyaltyDiscount, tenant.currencySymbol)})
                </p>
              )}
            </div>

            {/* Loyalty Points Redemption Box */}
            {tenant.isLoyaltyEnabled && customerAvailablePoints > 0 && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#b45309', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Star size={14} style={{ fill: '#b45309' }} />
                    Canjear Puntos de Fidelización
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 600 }}>
                    {customerAvailablePoints} pts (L. {(customerAvailablePoints * pointValue).toFixed(2)})
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="number"
                    className="input-control"
                    min={0}
                    max={Math.min(customerAvailablePoints, Math.floor(cartGrandTotal / pointValue))}
                    value={redeemedPoints || ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      const maxRedeem = Math.min(customerAvailablePoints, Math.floor(cartGrandTotal / pointValue));
                      setRedeemedPoints(Math.min(maxRedeem, Math.max(0, val)));
                    }}
                    placeholder="Puntos a canjear"
                    style={{ fontSize: '0.85rem', flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      const maxRedeem = Math.min(customerAvailablePoints, Math.floor(cartGrandTotal / pointValue));
                      setRedeemedPoints(redeemedPoints > 0 ? 0 : maxRedeem);
                    }}
                    style={{ fontSize: '0.75rem', padding: '0.45rem 0.6rem', color: '#b45309', borderColor: '#fde68a' }}
                  >
                    {redeemedPoints > 0 ? 'Quitar Puntos' : 'Canjear Máximo'}
                  </button>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Método de Pago</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.35rem' }}>
                {(['CASH', 'CARD', 'TRANSFER', 'MIXED', 'CREDIT'] as const).map(method => (
                  <button
                    key={method}
                    className={`btn ${paymentMethod === method ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => {
                      if (method === 'CREDIT' && (!cartCustomer.id || cartCustomer.name === 'Consumidor Final')) {
                        toast.warning('Para vender a crédito / fiado seleccione un cliente registrado (F4)');
                        setIsCustomerModalOpen(true);
                      }
                      setPaymentMethod(method);
                    }}
                    style={{
                      padding: '0.5rem 0.2rem',
                      fontSize: '0.75rem',
                      background: method === 'CREDIT' && paymentMethod === 'CREDIT' ? '#dc2626' : undefined,
                      borderColor: method === 'CREDIT' && paymentMethod === 'CREDIT' ? '#dc2626' : undefined,
                      color: method === 'CREDIT' && paymentMethod === 'CREDIT' ? '#ffffff' : undefined,
                      fontWeight: 700
                    }}
                  >
                    {method === 'CASH' ? 'Efectivo' : method === 'CARD' ? 'Tarjeta' : method === 'TRANSFER' ? 'Transfer.' : method === 'MIXED' ? 'Mixto' : 'Fiado'}
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === 'CREDIT' && (
              <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', padding: '0.85rem', borderRadius: '8px', marginTop: '0.5rem' }}>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#991b1b', fontWeight: 700 }}>
                  VENTA AL CRÉDITO (FIADO)
                </p>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#7f1d1d' }}>
                  Cliente: <strong>{cartCustomer.name}</strong> {cartCustomer.rtn ? `(RTN: ${cartCustomer.rtn})` : ''}
                </p>
                {selectedCustomerObj && (
                  <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: '#7f1d1d', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Saldo Act.: {tenant.currencySymbol} {(selectedCustomerObj.creditBalance || 0).toFixed(2)}</span>
                    <span>Límite: {tenant.currencySymbol} {(selectedCustomerObj.creditLimit || 2000).toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {paymentMethod === 'CASH' && (
              <div className="form-group">
                <label className="form-label">Efectivo Recibido</label>
                <input
                  type="number"
                  className="input-control"
                  placeholder="0.00"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  style={{ fontSize: '1.3rem', fontWeight: 800, textAlign: 'center' }}
                  autoFocus
                />

                {/* Quick Cash Tender Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.35rem', marginTop: '0.4rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setCashTendered(netPayableTotal.toFixed(2))}
                    style={{ fontSize: '0.72rem', padding: '0.4rem 0.2rem', fontWeight: 800, color: '#059669', borderColor: '#a7f3d0' }}
                  >
                    Exacto
                  </button>
                  {[50, 100, 200, 500].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setCashTendered(amt.toString())}
                      style={{ fontSize: '0.72rem', padding: '0.4rem 0.2rem', fontWeight: 700 }}
                    >
                      L. {amt}
                    </button>
                  ))}
                </div>

                {tenderedAmount > 0 && (
                  <div style={{ marginTop: '0.65rem', padding: '0.6rem 0.85rem', background: changeDue >= 0 ? '#f0fdf4' : '#fee2e2', border: `1px solid ${changeDue >= 0 ? '#bbf7d0' : '#fca5a5'}`, borderRadius: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.1rem', color: changeDue >= 0 ? '#047857' : '#dc2626' }}>
                    <span>CAMBIO / VUELTO:</span>
                    <span>{formatCurrency(changeDue, tenant.currencySymbol)}</span>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
              <button className="btn btn-secondary" onClick={() => setIsPaymentModalOpen(false)} style={{ flex: 1 }}>
                Cancelar (Esc)
              </button>
              <button className="btn btn-primary" onClick={handleConfirmPayment} style={{ flex: 2, fontSize: '1rem', fontWeight: 700 }}>
                <CheckCircle size={16} />
                <span>Confirmar & Facturar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Thermal Print Receipt Preview */}
      {lastCompletedSale && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div style={{ textAlign: 'center', marginBottom: '0.85rem' }}>
              <CheckCircle size={42} style={{ color: 'var(--accent-primary)', margin: '0 auto 0.4rem auto' }} />
              <h3 style={{ color: '#0f172a' }}>Venta Realizada</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Factura #{lastCompletedSale.documentNumber}</p>
            </div>

            {/* Copy Type Selector */}
            {lastCompletedSale.isFiscal && (
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem' }}>
                <button
                  type="button"
                  className={`btn ${selectedTicketCopy === 'ORIGINAL' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSelectedTicketCopy('ORIGINAL')}
                  style={{ flex: 1, fontSize: '0.75rem', padding: '0.35rem' }}
                >
                  ORIGINAL: CLIENTE
                </button>
                <button
                  type="button"
                  className={`btn ${selectedTicketCopy === 'COPIA' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSelectedTicketCopy('COPIA')}
                  style={{ flex: 1, fontSize: '0.75rem', padding: '0.35rem' }}
                >
                  COPIA: EMISOR / SAR
                </button>
              </div>
            )}

            <div id="printable-ticket" style={{ padding: '0.5rem', background: '#fff', color: '#000', fontSize: '10px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
              {/* Header Info */}
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase' }}>{tenant.name}</div>
              {tenant.rtn && <div style={{ textAlign: 'center', fontSize: '10px' }}>RTN: {tenant.rtn}</div>}
              {tenant.address && <div style={{ textAlign: 'center', fontSize: '9px' }}>{tenant.address}</div>}
              {tenant.phone && <div style={{ textAlign: 'center', fontSize: '9px' }}>TEL: {tenant.phone}</div>}
              <div style={{ borderBottom: '1px dashed #000', margin: '4px 0' }}></div>

              {/* Document Header & CAI */}
              {lastCompletedSale.isFiscal ? (
                <>
                  <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '11px' }}>FACTURA FISCAL</div>
                  <div style={{ fontSize: '9px', wordBreak: 'break-all' }}><strong>CODIGO CAI:</strong> {lastCompletedSale.cai || 'N/A'}</div>
                  <div style={{ fontSize: '10px' }}><strong>FACTURA #:</strong> {lastCompletedSale.documentNumber}</div>
                  {lastCompletedSale.caiDeadline && <div style={{ fontSize: '9px' }}><strong>FECHA LIMITE:</strong> {lastCompletedSale.caiDeadline}</div>}
                  {lastCompletedSale.caiRangeStart && lastCompletedSale.caiRangeEnd && (
                    <div style={{ fontSize: '8px' }}><strong>RANGO:</strong> {lastCompletedSale.caiRangeStart} AL {lastCompletedSale.caiRangeEnd}</div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '11px' }}>COMPROBANTE DE VENTA INTERNO</div>
                  <div style={{ fontSize: '10px' }}><strong>TICKET #:</strong> {lastCompletedSale.documentNumber}</div>
                </>
              )}
              <div style={{ borderBottom: '1px dashed #000', margin: '4px 0' }}></div>

              {/* Meta & Customer */}
              <div style={{ fontSize: '9px' }}><strong>FECHA:</strong> {new Date(lastCompletedSale.createdAt).toLocaleDateString('es-HN')} {new Date(lastCompletedSale.createdAt).toLocaleTimeString('es-HN')}</div>
              <div style={{ fontSize: '9px', textTransform: 'uppercase' }}><strong>CAJA:</strong> {lastCompletedSale.cajaName || 'Caja 1'}</div>
              <div style={{ fontSize: '9px', textTransform: 'uppercase' }}><strong>CLIENTE / RTN:</strong> {lastCompletedSale.customerName} {lastCompletedSale.customerRtn ? `| ${lastCompletedSale.customerRtn}` : ''}</div>
              <div style={{ borderBottom: '1px dashed #000', margin: '4px 0' }}></div>

              {/* Items Detail */}
              <div style={{ fontWeight: 'bold', fontSize: '9px', marginBottom: '2px' }}>DESCRIPCION DE PRODUCTOS</div>
              {lastCompletedSale.items?.map((it: CartLine, idx: number) => (
                <div key={idx} style={{ marginBottom: '3px', fontSize: '9px' }}>
                  <div style={{ fontWeight: 'bold' }}>{it.quantity}x {it.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '6px' }}>
                    <span>P.Unit: {formatCurrency(it.unitPrice, tenant.currencySymbol)}</span>
                    <span>Total: {formatCurrency(it.total, tenant.currencySymbol)}</span>
                  </div>
                </div>
              ))}
              <div style={{ borderBottom: '1px dashed #000', margin: '4px 0' }}></div>

              {/* Financial Breakdown Table (SAR Honduras Standard) */}
              <div style={{ fontSize: '9px' }}>
                {lastCompletedSale.discountAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Descuentos y Rebajas:</span>
                    <span>{formatCurrency(lastCompletedSale.discountAmount, tenant.currencySymbol)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Importe Exonerado:</span>
                  <span>{tenant.currencySymbol} 0.00</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Importe Exento:</span>
                  <span>{tenant.currencySymbol} 0.00</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Importe Gravado 15%:</span>
                  <span>{formatCurrency(lastCompletedSale.taxable15 || 0, tenant.currencySymbol)}</span>
                </div>
                {lastCompletedSale.taxable18 > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Importe Gravado 18%:</span>
                    <span>{formatCurrency(lastCompletedSale.taxable18 || 0, tenant.currencySymbol)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>I.S.V. 15%:</span>
                  <span>{formatCurrency(lastCompletedSale.tax15 || 0, tenant.currencySymbol)}</span>
                </div>
                {lastCompletedSale.tax18 > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>I.S.V. 18%:</span>
                    <span>{formatCurrency(lastCompletedSale.tax18 || 0, tenant.currencySymbol)}</span>
                  </div>
                )}
                <div style={{ borderBottom: '1px dashed #000', margin: '3px 0' }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '11px' }}>
                  <span>TOTAL A PAGAR:</span>
                  <span>{formatCurrency(lastCompletedSale.total, tenant.currencySymbol)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginTop: '2px' }}>
                  <span>Total Items:</span>
                  <span>{lastCompletedSale.items?.reduce((acc, item) => acc + item.quantity, 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                  <span>Forma de Pago:</span>
                  <span>{lastCompletedSale.paymentMethod}</span>
                </div>
              </div>

              {/* Savings Highlight Box */}
              {lastCompletedSale.discountAmount > 0 && (
                <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '10px', marginTop: '4px', padding: '2px', border: '1px solid #000' }}>
                  SU AHORRO: {formatCurrency(lastCompletedSale.discountAmount, tenant.currencySymbol)}
                </div>
              )}

              {/* SAR Legal Footer */}
              <div style={{ borderBottom: '1px dashed #000', margin: '4px 0' }}></div>
              {lastCompletedSale.isFiscal && (
                <>
                  <div style={{ textAlign: 'center', fontSize: '8px', fontStyle: 'italic', fontWeight: 'bold' }}>
                    "La factura es beneficio de todos, exíjala."
                  </div>
                  <div style={{ textAlign: 'center', fontSize: '8px', fontWeight: 'bold', marginTop: '2px' }}>
                    === {selectedTicketCopy === 'ORIGINAL' ? 'ORIGINAL: CLIENTE' : 'COPIA: OBLIGADO TRIBUTARIO EMISOR / SAR'} ===
                  </div>
                </>
              )}
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '9px', marginTop: '4px' }}>¡GRACIAS POR SU COMPRA!</div>
              <div style={{ textAlign: 'center', fontSize: '8px' }}>ESPERAMOS REGRESE PRONTO</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => handlePrintEscPos('ORIGINAL')}
                  style={{ flex: 1, fontSize: '0.78rem', padding: '0.45rem' }}
                >
                  <Printer size={14} />
                  <span>Imprimir Original</span>
                </button>

                {lastCompletedSale.isFiscal && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => handlePrintEscPos('COPIA')}
                    style={{ flex: 1, fontSize: '0.78rem', padding: '0.45rem' }}
                  >
                    <Printer size={14} />
                    <span>Imprimir Copia SAR</span>
                  </button>
                )}
              </div>

              <button className="btn btn-secondary" onClick={() => setLastCompletedSale(null)} style={{ width: '100%', fontSize: '0.8rem', padding: '0.4rem' }}>
                Cerrar Ventana
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PosContainer;
