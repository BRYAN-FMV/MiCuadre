import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAppStore, HeldOrder, hasUserPermission } from '../../store/useAppStore';
import { formatCurrency, calculateCartTotals } from '../../lib/monetary';
import { printSaleReceipt } from '../../lib/thermalPrint';
import { generateUUID } from '../../lib/security';
import { toast } from 'sonner';
import {
  Search, ShoppingCart, UserCheck, Trash2, Plus, Minus,
  CreditCard, Printer, CheckCircle, Package, PauseCircle, Play, X, Key, Star, UserPlus, Lock, Edit2, AlertTriangle,
  Tag, Percent, Scissors, Clock
} from 'lucide-react';
import {
  Sale, Product, CartLine, Customer, Service, ProductPresentation, UserProfile
} from '../../types';
import { AdminPinModal } from '../common/AdminPinModal';

export const PosContainer: React.FC = () => {
  const products = useAppStore(state => state.products);
  const services = useAppStore(state => state.services);
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
  const applyGlobalCartDiscount = useAppStore(state => state.applyGlobalCartDiscount);
  const setCartLineDiscount = useAppStore(state => state.setCartLineDiscount);
  const setCartLinePriceType = useAppStore(state => state.setCartLinePriceType);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODOS');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isHeldOrdersModalOpen, setIsHeldOrdersModalOpen] = useState(false);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [lineDiscountModal, setLineDiscountModal] = useState<{
    index: number;
    line: CartLine;
    type: 'PERCENT' | 'FIXED';
    value: string;
  } | null>(null);
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [discountValue, setDiscountValue] = useState<string>('');
  const [selectedDocType, setSelectedDocType] = useState<'FISCAL' | 'TICKET'>('FISCAL');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER' | 'MIXED' | 'CREDIT'>('CASH');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [mixedCashAmount, setMixedCashAmount] = useState<string>('');
  const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);
  const [selectedTicketCopy, setSelectedTicketCopy] = useState<'ORIGINAL' | 'COPIA'>('ORIGINAL');
  const [presentationModalProduct, setPresentationModalProduct] = useState<Product | null>(null);

  // Atajos de teclado para selección rápida en modal de presentaciones (Teclas 1, 2, 3... y Escape)
  useEffect(() => {
    if (!presentationModalProduct) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si el usuario está escribiendo en un input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'Escape') {
        setPresentationModalProduct(null);
      } else if (e.key === '1') {
        if (!tenant.allowNegativeStock && presentationModalProduct.currentStock <= 0) {
          toast.error(`"${presentationModalProduct.name}" no tiene stock suficiente.`);
          return;
        }
        addToCart({ product: presentationModalProduct });
        toast.success(`+ ${presentationModalProduct.name}`);
        setPresentationModalProduct(null);
      } else if (presentationModalProduct.presentations && presentationModalProduct.presentations.length > 0) {
        const presIndex = parseInt(e.key, 10) - 2;
        if (presIndex >= 0 && presIndex < presentationModalProduct.presentations.length) {
          const pres = presentationModalProduct.presentations[presIndex];
          const isOutOfStock = !tenant.allowNegativeStock && presentationModalProduct.currentStock < pres.unitsCount;
          if (isOutOfStock) {
            toast.error(`Stock insuficiente para "${pres.name}"`);
            return;
          }
          addToCart({ product: presentationModalProduct, presentation: pres });
          toast.success(`+ ${presentationModalProduct.name} [${pres.name}]`);
          setPresentationModalProduct(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [presentationModalProduct, tenant.allowNegativeStock]);

  // Admin PIN Authorization Modal State (Mechanism B)
  const [adminPinConfig, setAdminPinConfig] = useState<{
    isOpen: boolean;
    title: string;
    actionDescription?: string;
    onSuccess: (admin: UserProfile) => void;
  }>({
    isOpen: false,
    title: '',
    actionDescription: '',
    onSuccess: () => {}
  });

  // Customer Modal & Registration state
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isNewCustomerFormOpen, setIsNewCustomerFormOpen] = useState(false);
  const [newCustRtn, setNewCustRtn] = useState('');
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustPriceType, setNewCustPriceType] = useState('');

  // Loyalty Points Redemption state
  const [redeemedPoints, setRedeemedPoints] = useState<number>(0);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global Keyboard Shortcuts (F2, F4, F12, Esc, Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lastCompletedSale && (e.key === 'Escape' || e.key === 'Enter')) {
        e.preventDefault();
        setLastCompletedSale(null);
        return;
      }

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
  }, [cartLines, lastCompletedSale]);

  // Catalog Mode & Walk-in Services State
  const [catalogMode, setCatalogMode] = useState<'PRODUCTS' | 'SERVICES'>('PRODUCTS');
  const [serviceModalService, setServiceModalService] = useState<Service | null>(null);
  const [serviceSelectedStaffId, setServiceSelectedStaffId] = useState<string>('');

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

  const tenantServices = services.filter((s: Service) => s.tenantId === tenant.id && s.isActive);
  const filteredServices = tenantServices.filter((s: Service) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddServiceToCart = (service: Service) => {
    if (availableStaff.length === 1) {
      addToCart({ service, staffId: availableStaff[0].id, quantity: 1 });
      toast.success(`+ ${service.name} (${availableStaff[0].fullName})`);
    } else if (availableStaff.length > 1) {
      setServiceModalService(service);
      setServiceSelectedStaffId(availableStaff[0]?.id || '');
    } else {
      addToCart({ service, quantity: 1 });
      toast.success(`+ ${service.name}`);
    }
  };

  const handleConfirmServiceModal = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!serviceModalService) return;
    const staffObj = availableStaff.find(s => s.id === serviceSelectedStaffId);
    addToCart({ service: serviceModalService, staffId: serviceSelectedStaffId || undefined, quantity: 1 });
    toast.success(`+ ${serviceModalService.name}${staffObj ? ` (${staffObj.fullName})` : ''}`);
    setServiceModalService(null);
  };

  const outOfStockCount = tenantProducts.filter((p: Product) => p.isActive && p.currentStock <= 0).length;
  const lowStockCount = tenantProducts.filter((p: Product) => p.isActive && p.currentStock > 0 && p.currentStock <= p.minStockAlert).length;

  interface PosGridItem {
    id: string;
    product: Product;
    presentation?: ProductPresentation;
    displayName: string;
    salePrice: number;
    unitsCount: number;
    availableStock: number;
    baseStock: number;
    isOutOfStock: boolean;
    isLowStock: boolean;
    hasTiers: boolean;
    hasPriceTypes: boolean;
    barcode?: string;
  }

  const posGridItems = useMemo<PosGridItem[]>(() => {
    const items: PosGridItem[] = [];
    const term = searchTerm.toLowerCase().trim();

    for (const product of tenantProducts) {
      if (!product.isActive) continue;
      if (selectedCategory !== 'TODOS' && product.category !== selectedCategory) continue;

      const baseNameMatches = !term ||
                              product.name.toLowerCase().includes(term) ||
                              product.sku.toLowerCase().includes(term) ||
                              (product.barcode && product.barcode.includes(searchTerm));

      // 1. Tarjeta de Producto Base (Unidad)
      if (baseNameMatches) {
        const isOutOfStock = product.currentStock <= 0;
        const isLowStock = product.currentStock > 0 && product.currentStock <= product.minStockAlert;
        items.push({
          id: product.id,
          product,
          displayName: product.name,
          salePrice: product.salePrice,
          unitsCount: 1,
          availableStock: product.currentStock,
          baseStock: product.currentStock,
          isOutOfStock,
          isLowStock,
          hasTiers: Boolean(product.tiers && product.tiers.length > 0),
          hasPriceTypes: Boolean(product.priceTypes && product.priceTypes.length > 0),
          barcode: product.barcode
        });
      }

      // 2. Tarjetas de Empaque Separadas (Six-Packs, Cajas, etc.)
      if (product.presentations && product.presentations.length > 0) {
        for (const pres of product.presentations) {
          const presMatches = !term ||
                              pres.name.toLowerCase().includes(term) ||
                              `${product.name} ${pres.name}`.toLowerCase().includes(term) ||
                              (pres.barcode && pres.barcode.includes(searchTerm)) ||
                              baseNameMatches;

          if (presMatches) {
            const packsAvailable = Math.floor(product.currentStock / pres.unitsCount);
            const isOutOfStock = packsAvailable <= 0;
            const isLowStock = packsAvailable > 0 && packsAvailable <= 2;
            items.push({
              id: `${product.id}-${pres.id}`,
              product,
              presentation: pres,
              displayName: `${product.name} [${pres.name}]`,
              salePrice: pres.salePrice,
              unitsCount: pres.unitsCount,
              availableStock: packsAvailable,
              baseStock: product.currentStock,
              isOutOfStock,
              isLowStock,
              hasTiers: false,
              hasPriceTypes: Boolean(pres.priceTypes && pres.priceTypes.length > 0),
              barcode: pres.barcode
            });
          }
        }
      }
    }

    return items;
  }, [tenantProducts, selectedCategory, searchTerm]);

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (catalogMode === 'SERVICES') {
        if (filteredServices.length === 1) {
          handleAddServiceToCart(filteredServices[0]);
          setSearchTerm('');
        }
        return;
      }

      const trimmedSearch = searchTerm.trim();

      // 1. Coincidencia directa por código de barras de empaque único
      for (const p of tenantProducts) {
        if (p.isActive && p.presentations) {
          const matchedPres = p.presentations.find(pres => pres.barcode && pres.barcode.trim() === trimmedSearch);
          if (matchedPres) {
            // Si el código coincide con la presentación pero también es el código base del producto (o si tiene varias presentaciones):
            if (p.barcode && p.barcode.trim() === trimmedSearch) {
              setPresentationModalProduct(p);
              setSearchTerm('');
              return;
            }
            if (!tenant.allowNegativeStock && p.currentStock < matchedPres.unitsCount) {
              toast.error(`"${p.name} [${matchedPres.name}]" no tiene suficiente stock (Disponible: ${p.currentStock}, Requiere: ${matchedPres.unitsCount}).`);
              return;
            }
            addToCart({ product: p, presentation: matchedPres });
            toast.success(`+ ${p.name} [${matchedPres.name}]`);
            setSearchTerm('');
            return;
          }
        }
      }

      // 2. Coincidencia directa por código de barras o SKU del producto base
      const match = tenantProducts.find((p: Product) => (p.barcode === trimmedSearch || p.sku.toLowerCase() === trimmedSearch.toLowerCase()) && p.isActive);
      if (match) {
        // REGLA CLAVE: Si el producto tiene presentaciones (ej. churro con ristra), PREGUNTAR ANTES al cajero
        if (match.presentations && match.presentations.length > 0) {
          setPresentationModalProduct(match);
          setSearchTerm('');
          return;
        }

        if (!tenant.allowNegativeStock && match.currentStock <= 0) {
          toast.error(`"${match.name}" está AGOTADO. No se puede agregar al carrito.`);
          return;
        }
        addToCart({ product: match });
        toast.success(`+ ${match.name}`);
        setSearchTerm('');
        return;
      }

      // 3. Coincidencia en el catálogo visible posGridItems
      if (posGridItems.length === 1) {
        const item = posGridItems[0];
        if (!tenant.allowNegativeStock && item.isOutOfStock) {
          toast.error(`"${item.displayName}" no tiene stock suficiente.`);
          return;
        }
        addToCart({ product: item.product, presentation: item.presentation });
        toast.success(`+ ${item.displayName}`);
        setSearchTerm('');
      } else if (posGridItems.length > 1) {
        // Si todos los posGridItems visibles pertenecen al mismo producto base (ej. churro y churro [ristra]):
        const firstProduct = posGridItems[0].product;
        const allSameProduct = posGridItems.every(i => i.product.id === firstProduct.id);
        if (allSameProduct && firstProduct.presentations && firstProduct.presentations.length > 0) {
          setPresentationModalProduct(firstProduct);
          setSearchTerm('');
          return;
        }
      } else if (trimmedSearch !== '') {
        toast.error('Producto o empaque no encontrado');
      }
    }
  };

  const cartTotals = useMemo(() => calculateCartTotals(cartLines), [cartLines]);
  const cartSubtotal = cartTotals.subtotal;
  const cartDiscountTotal = cartTotals.discountAmount;
  const cartTax15 = cartTotals.tax15;
  const cartTax18 = cartTotals.tax18;
  const cartGrandTotal = cartTotals.total;

  const handleApplySeniorDiscount = () => {
    if (!hasUserPermission(currentUser, 'canApplyDiscounts')) {
      setAdminPinConfig({
        isOpen: true,
        title: 'Autorizar Descuento de Tercera Edad (25%)',
        actionDescription: 'Se requiere autorizacion de Administrador para aplicar el descuento de Ley de Tercera Edad.',
        onSuccess: () => {
          applyGlobalCartDiscount(25, true);
          setIsDiscountModalOpen(false);
          toast.success('Descuento de Tercera Edad (25%) aplicado al carrito');
        }
      });
      return;
    }
    applyGlobalCartDiscount(25, true);
    setIsDiscountModalOpen(false);
    toast.success('Descuento de Tercera Edad (25%) aplicado al carrito');
  };

  const handleApplyCustomDiscount = () => {
    const val = parseFloat(discountValue);
    if (isNaN(val) || val <= 0) {
      toast.error('Ingrese un monto o porcentaje de descuento valido');
      return;
    }
    if (discountType === 'PERCENT' && val > 100) {
      toast.error('El porcentaje no puede superar el 100%');
      return;
    }

    if (!hasUserPermission(currentUser, 'canApplyDiscounts')) {
      setAdminPinConfig({
        isOpen: true,
        title: 'Autorizar Descuento Personalizado',
        actionDescription: `Se requiere autorizacion de Administrador para aplicar un descuento de ${discountType === 'PERCENT' ? `${val}%` : formatCurrency(val, tenant.currencySymbol)}.`,
        onSuccess: () => {
          applyGlobalCartDiscount(val, discountType === 'PERCENT');
          setIsDiscountModalOpen(false);
          setDiscountValue('');
          toast.success(`Descuento de ${discountType === 'PERCENT' ? `${val}%` : formatCurrency(val, tenant.currencySymbol)} aplicado`);
        }
      });
      return;
    }

    applyGlobalCartDiscount(val, discountType === 'PERCENT');
    setIsDiscountModalOpen(false);
    setDiscountValue('');
    toast.success(`Descuento de ${discountType === 'PERCENT' ? `${val}%` : formatCurrency(val, tenant.currencySymbol)} aplicado`);
  };

  const handleRemoveDiscount = () => {
    applyGlobalCartDiscount(0, false);
    setIsDiscountModalOpen(false);
    toast.info('Descuento eliminado');
  };

  const handleOpenLineDiscount = (index: number, line: CartLine) => {
    setLineDiscountModal({
      index,
      line,
      type: 'PERCENT',
      value: line.discountAmount > 0 ? '' : '10'
    });
  };

  const handleApplyLineDiscount = () => {
    if (!lineDiscountModal) return;
    const { index, line, type, value } = lineDiscountModal;
    const numVal = parseFloat(value) || 0;
    if (numVal <= 0) {
      toast.error('Ingrese un valor de descuento mayor a cero');
      return;
    }

    if (type === 'PERCENT' && numVal > 100) {
      toast.error('El porcentaje no puede superar el 100%');
      return;
    }

    const lineGross = line.originalUnitPrice * line.quantity;
    let disc = type === 'PERCENT' ? (lineGross * (numVal / 100)) : numVal;
    disc = Math.min(lineGross, Math.round(disc * 100) / 100);

    const applyAction = () => {
      setCartLineDiscount(index, disc);
      toast.success(`Descuento de ${type === 'PERCENT' ? `${numVal}%` : formatCurrency(disc, tenant.currencySymbol)} aplicado a ${line.name}`);
      setLineDiscountModal(null);
    };

    if (!hasUserPermission(currentUser, 'canApplyDiscounts')) {
      setAdminPinConfig({
        isOpen: true,
        title: 'Autorizar Descuento por Producto',
        actionDescription: `Se requiere autorización de Administrador para aplicar descuento a "${line.name}".`,
        onSuccess: applyAction
      });
      return;
    }

    applyAction();
  };

  const handleRemoveLineDiscount = () => {
    if (!lineDiscountModal) return;
    setCartLineDiscount(lineDiscountModal.index, 0);
    toast.info(`Descuento eliminado de ${lineDiscountModal.line.name}`);
    setLineDiscountModal(null);
  };

  // Tenant Customers & Loyalty Calculations
  const tenantCustomers = customers.filter((c: Customer) => c.tenantId === tenant.id);
  const selectedCustomerObj = tenantCustomers.find((c: Customer) => c.id === cartCustomer.id);
  const customerAvailablePoints = selectedCustomerObj?.loyaltyPoints ?? cartCustomer.loyaltyPoints ?? 0;

  const pointValue = tenant.loyaltyPointValue || 1.0;
  const loyaltyDiscount = (tenant.isLoyaltyEnabled && redeemedPoints > 0) ? redeemedPoints * pointValue : 0;
  const netPayableTotal = Math.max(0, cartGrandTotal - loyaltyDiscount);

  const tenderedAmount = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, tenderedAmount - netPayableTotal);
  const parsedMixedCash = Math.min(netPayableTotal, Math.max(0, parseFloat(mixedCashAmount) || 0));
  const parsedMixedCard = Math.max(0, netPayableTotal - parsedMixedCash);

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
    const splitConfig = paymentMethod === 'MIXED' ? {
      cash: parsedMixedCash,
      card: parsedMixedCard
    } : undefined;

    if (paymentMethod === 'CREDIT' && !hasUserPermission(currentUser, 'canSellCredit')) {
      setAdminPinConfig({
        isOpen: true,
        title: 'Autorizar Venta al Fiado / Crédito',
        actionDescription: `Se requiere autorizacion de Administrador para otorgar credito por ${formatCurrency(netPayableTotal, tenant.currencySymbol)} a ${cartCustomer.name}.`,
        onSuccess: () => {
          const completedSale = processSale(paymentMethod, redeemedPoints, isOverrideFiscal, splitConfig);
          if (!completedSale) return;
          setLastCompletedSale(completedSale);
          setIsPaymentModalOpen(false);
          setCashTendered('');
          setMixedCashAmount('');
          setRedeemedPoints(0);
          toast.success(`Venta ${completedSale.isFiscal ? 'Fiscal SAR' : 'Ticket Interno'} (Crédito) #${completedSale.documentNumber} realizada con éxito`);
        }
      });
      return;
    }

    const completedSale = processSale(paymentMethod, redeemedPoints, isOverrideFiscal, splitConfig);
    if (!completedSale) return;

    setLastCompletedSale(completedSale);
    setIsPaymentModalOpen(false);
    setCashTendered('');
    setMixedCashAmount('');
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
      address: newCustAddress.trim() || undefined,
      defaultPriceTypeName: newCustPriceType.trim() || undefined
    });

    setCartCustomer({
      id: created.id,
      name: created.name,
      rtn: created.rtn,
      loyaltyPoints: created.loyaltyPoints,
      defaultPriceTypeName: created.defaultPriceTypeName
    });

    toast.success(`Cliente ${created.name} registrado y seleccionado`);
    setIsNewCustomerFormOpen(false);
    setNewCustName('');
    setNewCustRtn('');
    setNewCustPhone('');
    setNewCustEmail('');
    setNewCustAddress('');
    setNewCustPriceType('');
  };

  const handleHoldCart = () => {
    if (cartLines.length === 0) return;
    holdCurrentCart();
    toast.success('Orden retenida en espera');
  };

  const handlePrintEscPos = (copyType: 'ORIGINAL' | 'COPIA' = 'ORIGINAL') => {
    if (!lastCompletedSale) return;
    try {
      printSaleReceipt(lastCompletedSale, tenant, copyType);
    } catch (err) {
      toast.error('Error al imprimir ticket');
    }
  };

  return (
    <div className="pos-layout-grid">

      {/* LEFT: Product Catalog & Fast Search */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', overflow: 'hidden' }}>

        {/* Search Header Bar */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.75rem 1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 'min(100%, 200px)' }}>
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

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
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

            {(tenant.isFiscalEnabled || tenantFiscalRanges.length > 1) && (
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

        {/* Catalog Mode Selector (Productos vs Servicios) */}
        {tenant.isServicesEnabled !== false && (
          <div style={{ display: 'flex', gap: '0.4rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', width: 'fit-content' }}>
            <button
              type="button"
              onClick={() => setCatalogMode('PRODUCTS')}
              style={{
                padding: '0.35rem 0.8rem',
                borderRadius: '6px',
                border: 'none',
                background: catalogMode === 'PRODUCTS' ? 'var(--accent-primary)' : 'transparent',
                color: catalogMode === 'PRODUCTS' ? '#ffffff' : '#64748b',
                fontWeight: catalogMode === 'PRODUCTS' ? 700 : 500,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.15s ease'
              }}
            >
              <Package size={14} />
              <span>Productos ({tenantProducts.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setCatalogMode('SERVICES')}
              style={{
                padding: '0.35rem 0.8rem',
                borderRadius: '6px',
                border: 'none',
                background: catalogMode === 'SERVICES' ? '#9333ea' : 'transparent',
                color: catalogMode === 'SERVICES' ? '#ffffff' : '#64748b',
                fontWeight: catalogMode === 'SERVICES' ? 700 : 500,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.15s ease'
              }}
            >
              <Scissors size={14} />
              <span>Servicios ({tenantServices.length})</span>
            </button>
          </div>
        )}

        {catalogMode === 'PRODUCTS' ? (
          <>
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
            <div className="pos-products-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 150px), 1fr))', gap: '0.85rem', overflowY: 'auto', flex: 1, paddingRight: '0.2rem' }}>
              {posGridItems.map((item: PosGridItem) => {
                const isDisabled = item.isOutOfStock && !tenant.allowNegativeStock;
                const isPack = Boolean(item.presentation);

                return (
                  <div
                    key={item.id}
                    className="product-card"
                    onClick={() => {
                      if (isDisabled) {
                        toast.error(`"${item.displayName}" no tiene stock suficiente. Habilite "Venta con Stock Negativo" en Configuración para vender sin existencia.`);
                        return;
                      }
                      addToCart({ product: item.product, presentation: item.presentation });
                      toast.success(`+ ${item.displayName}`);
                    }}
                    style={{
                      padding: '0.85rem',
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      background: isDisabled ? '#f8fafc' : (isPack ? '#faf5ff' : '#ffffff'),
                      border: `1px solid ${item.isOutOfStock ? '#fca5a5' : (item.isLowStock ? '#fde68a' : (isPack ? '#d8b4fe' : '#e2e8f0'))}`,
                      borderRadius: '10px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      transition: 'transform 0.1s ease, border-color 0.1s ease',
                      position: 'relative',
                      opacity: isDisabled ? 0.7 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!isDisabled) {
                        e.currentTarget.style.borderColor = isPack ? '#9333ea' : 'var(--accent-primary)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isDisabled) {
                        e.currentTarget.style.borderColor = item.isOutOfStock ? '#fca5a5' : (item.isLowStock ? '#fde68a' : (isPack ? '#d8b4fe' : '#e2e8f0'));
                        e.currentTarget.style.transform = 'translateY(0)';
                      }
                    }}
                  >
                    {item.isOutOfStock ? (
                      <span style={{ position: 'absolute', top: '6px', right: '6px', fontSize: '0.62rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: '#fee2e2', color: '#991b1b', fontWeight: 700 }}>
                        Agotado
                      </span>
                    ) : item.isLowStock ? (
                      <span style={{ position: 'absolute', top: '6px', right: '6px', fontSize: '0.62rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: '#fef3c7', color: '#92400e', fontWeight: 700 }}>
                        Poco Stock
                      </span>
                    ) : item.hasTiers ? (
                      <span className="badge badge-wholesale" style={{ position: 'absolute', top: '6px', right: '6px', fontSize: '0.6rem', padding: '0.15rem 0.4rem' }}>
                        Mayoreo
                      </span>
                    ) : null}

                    <div>
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: item.isOutOfStock ? '#fee2e2' : (isPack ? '#f3e8ff' : '#f1f5f9'), display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem', color: item.isOutOfStock ? '#ef4444' : (isPack ? '#9333ea' : '#64748b') }}>
                        <Package size={20} />
                      </div>

                      <h4 style={{ fontSize: '0.85rem', color: isDisabled ? '#64748b' : '#0f172a', fontWeight: 600, lineHeight: '1.25', height: '2.5em', overflow: 'hidden', marginBottom: '0.4rem' }}>
                        {item.displayName}
                      </h4>
                    </div>

                    <div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: isDisabled ? '#94a3b8' : (isPack ? '#7e22ce' : 'var(--accent-primary)') }}>
                        {formatCurrency(item.salePrice, tenant.currencySymbol)}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: item.isOutOfStock ? '#ef4444' : (item.isLowStock ? '#d97706' : '#64748b'), fontWeight: item.isOutOfStock || item.isLowStock ? 700 : 400, marginTop: '0.15rem' }}>
                        {isPack
                          ? `Stock: ${item.availableStock} packs (${item.baseStock} unids)`
                          : `Stock: ${item.availableStock} ${item.product.unitOfMeasure}`}
                      </div>
                      <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        {isPack && (
                          <span style={{ fontSize: '0.62rem', padding: '0.1rem 0.35rem', borderRadius: '4px', background: '#e0e7ff', color: '#4338ca', fontWeight: 700 }}>
                            Empaque x{item.unitsCount}
                          </span>
                        )}
                        {item.hasPriceTypes && (
                          <span style={{ fontSize: '0.6rem', padding: '0.1rem 0.35rem', borderRadius: '4px', background: '#e0f2fe', color: '#0369a1', fontWeight: 700 }}>
                            Precios Esp.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* Service Cards Grid for Walk-in clients */
          <div className="pos-products-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 150px), 1fr))', gap: '0.85rem', overflowY: 'auto', flex: 1, paddingRight: '0.2rem' }}>
            {filteredServices.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                <Scissors size={40} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                <p style={{ fontSize: '0.88rem', fontWeight: 600, color: '#64748b' }}>No hay servicios activos disponibles.</p>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Agregue servicios en la pestaña Servicios y Citas.</p>
              </div>
            ) : (
              filteredServices.map((service: Service) => {
                return (
                  <div
                    key={service.id}
                    onClick={() => handleAddServiceToCart(service)}
                    style={{
                      padding: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      transition: 'transform 0.1s ease, border-color 0.1s ease',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#9333ea';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <span style={{ position: 'absolute', top: '6px', right: '6px', fontSize: '0.62rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: '#f3e8ff', color: '#7e22ce', fontWeight: 700 }}>
                      {service.durationMinutes} min
                    </span>

                    <div>
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#faf5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem', color: '#9333ea' }}>
                        <Scissors size={20} />
                      </div>

                      <h4 style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: 600, lineHeight: '1.25', height: '2.5em', overflow: 'hidden', marginBottom: '0.4rem' }}>
                        {service.name}
                      </h4>
                    </div>

                    <div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#7e22ce' }}>
                        {formatCurrency(service.price, tenant.currencySymbol)}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Clock size={11} />
                        <span>{service.durationMinutes} min • {service.commissionType === 'PERCENTAGE' ? `${service.commissionValue}% com.` : `Fijo ${tenant.currencySymbol}${service.commissionValue}`}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
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
              <div key={index} className="cart-item" style={{ display: 'grid', gridTemplateColumns: '1fr 90px 80px', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid #f1f5f9' }}>
                <div>
                  <h5 style={{ fontSize: '0.82rem', color: '#0f172a', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
                    <span>{line.name}</span>
                    {line.discountAmount > 0 && (
                      <span className="badge" style={{ fontSize: '0.62rem', background: '#fee2e2', color: '#dc2626', fontWeight: 700 }}>
                        Desc: -{formatCurrency(line.discountAmount, tenant.currencySymbol)}
                      </span>
                    )}
                    {line.presentationName && (
                      <span className="badge" style={{ fontSize: '0.62rem', background: '#e0e7ff', color: '#4338ca', fontWeight: 700 }}>
                        {line.presentationName} ({line.unitsPerPackage || 1} unids)
                      </span>
                    )}
                    {line.isSpecialPriceActive && (
                      <span className="badge" style={{ fontSize: '0.6rem', background: '#e0f2fe', color: '#0369a1', fontWeight: 700 }}>
                        {line.selectedPriceTypeName || 'Precio Especial'}
                      </span>
                    )}
                  </h5>
                  {line.appliedTierName && !line.isSpecialPriceActive && (
                    <span className="badge badge-wholesale" style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem' }}>
                      {line.appliedTierName}
                    </span>
                  )}
                  {line.notes && (
                    <div style={{ fontSize: '0.72rem', color: '#c2410c', background: '#fff7ed', padding: '0.1rem 0.35rem', borderRadius: '4px', marginTop: '0.2rem', width: 'fit-content', fontWeight: 600 }}>
                      Nota: {line.notes}
                    </div>
                  )}

                  {/* Selector de Tipo de Precio (si el producto/empaque tiene tipos configurados) */}
                  {(() => {
                    const lineProduct = tenantProducts.find(p => p.id === line.productId || p.sku === line.sku);
                    const linePres = line.presentationId && lineProduct ? lineProduct.presentations?.find(p => p.id === line.presentationId) : undefined;
                    const availablePriceTypes = linePres ? (linePres.priceTypes || []) : (lineProduct?.priceTypes || []);
                    const basePrice = linePres ? linePres.salePrice : (lineProduct?.salePrice || line.originalUnitPrice);

                    return (
                      <div style={{ marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {availablePriceTypes.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#475569' }}>Tarifa:</span>
                            <select
                              value={line.selectedPriceTypeId || ''}
                              onChange={(e) => setCartLinePriceType(index, e.target.value || undefined)}
                              style={{
                                fontSize: '0.7rem',
                                padding: '0.1rem 0.35rem',
                                borderRadius: '4px',
                                border: line.isSpecialPriceActive ? '1px solid #0284c7' : '1px solid #cbd5e1',
                                background: line.isSpecialPriceActive ? '#f0f9ff' : '#ffffff',
                                color: line.isSpecialPriceActive ? '#0369a1' : '#334155',
                                fontWeight: line.isSpecialPriceActive ? 700 : 400
                              }}
                            >
                              <option value="">Público ({formatCurrency(basePrice, tenant.currencySymbol)})</option>
                              {availablePriceTypes.map(pt => (
                                <option key={pt.id} value={pt.id}>
                                  {pt.name} ({formatCurrency(pt.price, tenant.currencySymbol)})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Botón de Descuento por Producto Individual */}
                        <button
                          type="button"
                          onClick={() => handleOpenLineDiscount(index, line)}
                          style={{
                            padding: '0.15rem 0.45rem',
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            borderRadius: '4px',
                            border: line.discountAmount > 0 ? '1px solid #f87171' : '1px dashed #94a3b8',
                            background: line.discountAmount > 0 ? '#fee2e2' : '#f8fafc',
                            color: line.discountAmount > 0 ? '#b91c1c' : '#475569',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem'
                          }}
                          title="Aplicar o modificar descuento por producto"
                        >
                          <Percent size={10} />
                          <span>{line.discountAmount > 0 ? `Desc: -${formatCurrency(line.discountAmount, tenant.currencySymbol)}` : '% Descuento'}</span>
                        </button>
                      </div>
                    );
                  })()}
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

          {cartDiscountTotal > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#dc2626', fontWeight: 700 }}>
              <span>Descuento Otorgado:</span>
              <span>-{formatCurrency(cartDiscountTotal, tenant.currencySymbol)}</span>
            </div>
          )}

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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem', marginTop: '0.4rem' }}>
            <button
              className="btn btn-secondary"
              onClick={clearCart}
              disabled={cartLines.length === 0}
              style={{ padding: '0.55rem', fontSize: '0.78rem', color: '#dc2626', borderColor: '#fca5a5' }}
            >
              Vaciar
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                if (!hasUserPermission(currentUser, 'canApplyDiscounts')) {
                  setAdminPinConfig({
                    isOpen: true,
                    title: 'Autorizar Descuento en Venta',
                    actionDescription: 'Se requiere autorizacion de Administrador para aplicar descuentos al carrito.',
                    onSuccess: () => setIsDiscountModalOpen(true)
                  });
                  return;
                }
                setIsDiscountModalOpen(true);
              }}
              disabled={cartLines.length === 0}
              style={{
                padding: '0.55rem', fontSize: '0.78rem',
                color: cartDiscountTotal > 0 ? '#16a34a' : '#475569',
                borderColor: cartDiscountTotal > 0 ? '#86efac' : '#cbd5e1',
                background: cartDiscountTotal > 0 ? '#f0fdf4' : '#ffffff',
                fontWeight: cartDiscountTotal > 0 ? 700 : 500
              }}
              title="Aplicar Descuento o Ley Tercera Edad"
            >
              <Tag size={13} />
              <span>{cartDiscountTotal > 0 ? 'Descuento Activo' : 'Descuento'}</span>
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleHoldCart}
              disabled={cartLines.length === 0}
              style={{ padding: '0.55rem', fontSize: '0.78rem', color: 'var(--accent-primary)', borderColor: 'var(--accent-primary)' }}
            >
              <PauseCircle size={13} />
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

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Tipo de Precio Preferencial (Opcional)</label>
                  <input
                    type="text"
                    className="input-control"
                    value={newCustPriceType}
                    onChange={(e) => setNewCustPriceType(e.target.value)}
                    placeholder="Ej. Mayorista, Taller, Frecuente..."
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
                              loyaltyPoints: c.loyaltyPoints,
                              defaultPriceTypeName: c.defaultPriceTypeName
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                              <h5 style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: 600, margin: 0 }}>{c.name}</h5>
                              {c.defaultPriceTypeName && (
                                <span style={{ fontSize: '0.62rem', background: '#e0f2fe', color: '#0369a1', padding: '0.05rem 0.3rem', borderRadius: '4px', fontWeight: 700 }}>
                                  {c.defaultPriceTypeName}
                                </span>
                              )}
                            </div>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 68px), 1fr))', gap: '0.35rem' }}>
                {(['CASH', 'CARD', 'TRANSFER', 'MIXED', 'CREDIT'] as const).map(method => (
                  <button
                    key={method}
                    className={`btn ${paymentMethod === method ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => {
                      if (method === 'CREDIT') {
                        if (!hasUserPermission(currentUser, 'canSellCredit')) {
                          setAdminPinConfig({
                            isOpen: true,
                            title: 'Autorizar Venta al Fiado / Crédito',
                            actionDescription: 'Se requiere autorizacion de Administrador para otorgar credito o fiar a este cliente.',
                            onSuccess: () => {
                              if (!cartCustomer.id || cartCustomer.name === 'Consumidor Final') {
                                toast.warning('Para vender a crédito / fiado seleccione un cliente registrado (F4)');
                                setIsCustomerModalOpen(true);
                              }
                              setPaymentMethod('CREDIT');
                            }
                          });
                          return;
                        }
                        if (!cartCustomer.id || cartCustomer.name === 'Consumidor Final') {
                          toast.warning('Para vender a crédito / fiado seleccione un cliente registrado (F4)');
                          setIsCustomerModalOpen(true);
                        }
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (tenderedAmount >= netPayableTotal) {
                        handleConfirmPayment();
                      }
                    }
                  }}
                  style={{ fontSize: '1.3rem', fontWeight: 800, textAlign: 'center' }}
                  autoFocus
                />

                {/* Quick Cash Tender Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 54px), 1fr))', gap: '0.35rem', marginTop: '0.4rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setCashTendered(netPayableTotal.toFixed(2))}
                    style={{ fontSize: '0.72rem', padding: '0.4rem 0.2rem', fontWeight: 800, color: '#059669', borderColor: '#a7f3d0' }}
                  >
                    Exacto
                  </button>
                  {[50, 100, 200, 500, 1000].map(amt => (
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

            {paymentMethod === 'MIXED' && (
              <div className="form-group" style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <label className="form-label" style={{ fontWeight: 700, color: '#0f172a' }}>Desglose de Pago Mixto</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>
                      Efectivo (Gaveta):
                    </label>
                    <input
                      type="number"
                      step="any"
                      className="input-control"
                      placeholder="0.00"
                      value={mixedCashAmount}
                      onChange={(e) => setMixedCashAmount(e.target.value)}
                      style={{ fontWeight: 700, textAlign: 'center' }}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>
                      Tarjeta / Banco:
                    </label>
                    <div className="input-control" style={{ background: '#f1f5f9', fontWeight: 700, textAlign: 'center', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {formatCurrency(parsedMixedCard, tenant.currencySymbol)}
                    </div>
                  </div>
                </div>
                <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.74rem', color: '#64748b' }}>
                  Solo los <strong>{formatCurrency(parsedMixedCash, tenant.currencySymbol)}</strong> de efectivo entrarán al arqueo de la caja registradora.
                </p>
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

            <div id="printable-ticket" style={{ padding: '0.75rem', background: '#fff', color: '#000', fontSize: '11px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
              {lastCompletedSale.isFiscal ? (
                <>
                  {/* Header Info */}
                  <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase' }}>{tenant.name}</div>
                  {tenant.rtn && <div style={{ textAlign: 'center', fontSize: '10px' }}>RTN: {tenant.rtn}</div>}
                  {tenant.address && <div style={{ textAlign: 'center', fontSize: '9px' }}>{tenant.address}</div>}
                  {tenant.phone && <div style={{ textAlign: 'center', fontSize: '9px' }}>TEL: {tenant.phone}</div>}
                  <div style={{ borderBottom: '1px dashed #000', margin: '4px 0' }}></div>

                  {/* Document Header & CAI */}
                  <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '11px' }}>FACTURA FISCAL</div>
                  <div style={{ fontSize: '9px', wordBreak: 'break-all' }}><strong>CODIGO CAI:</strong> {lastCompletedSale.cai || 'N/A'}</div>
                  <div style={{ fontSize: '10px' }}><strong>FACTURA #:</strong> {lastCompletedSale.documentNumber}</div>
                  {lastCompletedSale.caiDeadline && <div style={{ fontSize: '9px' }}><strong>FECHA LIMITE:</strong> {lastCompletedSale.caiDeadline}</div>}
                  {lastCompletedSale.caiRangeStart && lastCompletedSale.caiRangeEnd && (
                    <div style={{ fontSize: '8px' }}><strong>RANGO:</strong> {lastCompletedSale.caiRangeStart} AL {lastCompletedSale.caiRangeEnd}</div>
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
                      <span>{formatCurrency(lastCompletedSale.exoneratedAmount || 0, tenant.currencySymbol)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Importe Exento:</span>
                      <span>{formatCurrency(lastCompletedSale.exemptAmount || 0, tenant.currencySymbol)}</span>
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

                  {lastCompletedSale.discountAmount > 0 && (
                    <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '10px', marginTop: '4px', padding: '2px', border: '1px solid #000' }}>
                      SU AHORRO: {formatCurrency(lastCompletedSale.discountAmount, tenant.currencySymbol)}
                    </div>
                  )}

                  <div style={{ borderBottom: '1px dashed #000', margin: '4px 0' }}></div>
                  <div style={{ textAlign: 'center', fontSize: '8px', fontStyle: 'italic', fontWeight: 'bold' }}>
                    "La factura es beneficio de todos, exíjala."
                  </div>
                  <div style={{ textAlign: 'center', fontSize: '8px', fontWeight: 'bold', marginTop: '2px' }}>
                    === {selectedTicketCopy === 'ORIGINAL' ? 'ORIGINAL: CLIENTE' : 'COPIA: OBLIGADO TRIBUTARIO EMISOR / SAR'} ===
                  </div>
                  <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '9px', marginTop: '4px' }}>¡GRACIAS POR SU COMPRA!</div>
                  <div style={{ textAlign: 'center', fontSize: '8px' }}>ESPERAMOS REGRESE PRONTO</div>
                </>
              ) : (
                <>
                  {/* TICKET SIMPLE / COMPROBANTE ULTRACOMPACTO */}
                  <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase' }}>{tenant.name}</div>
                  {tenant.phone && <div style={{ textAlign: 'center', fontSize: '10px', color: '#333' }}>TEL: {tenant.phone}</div>}
                  <div style={{ borderBottom: '1px dashed #000', margin: '4px 0' }}></div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: 'bold' }}>
                    <span>TICKET: #{lastCompletedSale.documentNumber}</span>
                    <span>
                      {new Date(lastCompletedSale.createdAt).toLocaleDateString('es-HN')} {new Date(lastCompletedSale.createdAt).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {lastCompletedSale.customerName && lastCompletedSale.customerName !== 'Consumidor Final' && (
                    <div style={{ fontSize: '10.5px', marginTop: '2px' }}><strong>CLIENTE:</strong> {lastCompletedSale.customerName}</div>
                  )}
                  <div style={{ borderBottom: '1px dashed #000', margin: '4px 0' }}></div>

                  {/* Listado directo de articulos */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', margin: '2px 0' }}>
                    {lastCompletedSale.items?.map((it: CartLine, idx: number) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '10.5px', gap: '4px' }}>
                        <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>
                          {it.quantity}x {it.name}
                        </span>
                        <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap', flexShrink: 0, textAlign: 'right' }}>
                          {formatCurrency(it.total, tenant.currencySymbol)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div style={{ borderBottom: '1px dashed #000', margin: '4px 0' }}></div>

                  {/* Totales directos */}
                  {lastCompletedSale.discountAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px' }}>
                      <span>Descuento:</span>
                      <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>-{formatCurrency(lastCompletedSale.discountAmount, tenant.currencySymbol)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', fontSize: '13.5px', margin: '3px 0' }}>
                    <span>TOTAL:</span>
                    <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>{formatCurrency(lastCompletedSale.total, tenant.currencySymbol)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px' }}>
                    <span>Forma de Pago:</span>
                    <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>{lastCompletedSale.paymentMethod}</span>
                  </div>
                  <div style={{ borderBottom: '1px dashed #000', margin: '4px 0' }}></div>

                  <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '11px', marginTop: '4px' }}>
                    ¡GRACIAS POR SU COMPRA!
                  </div>
                </>
              )}

              {/* Avance fisico de papel para superar la distancia entre cabezal termico y cuchilla de corte (28mm) */}
              <div style={{ textAlign: 'center', fontSize: '8px', color: '#000', marginTop: '28mm', letterSpacing: '1px' }}>
                - - - - - - - - - - - - - - - - - - - -
              </div>
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
                Cerrar Ventana (Enter / Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Apply Cart Discount */}
      {isDiscountModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)',
          zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '14px', width: '100%', maxWidth: '440px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden'
          }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Tag size={18} style={{ color: 'var(--accent-primary)' }} />
                Aplicar Descuento al Carrito
              </h3>
              <button
                type="button"
                aria-label="Cerrar modal de descuento"
                onClick={() => setIsDiscountModalOpen(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                  Descuento por Ley
                </label>
                <button
                  type="button"
                  onClick={handleApplySeniorDiscount}
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'flex-start', padding: '0.65rem 0.85rem', borderColor: '#3b82f6', background: '#eff6ff', color: '#1d4ed8', fontWeight: 700 }}
                >
                  <Percent size={16} />
                  <div style={{ textAlign: 'left' }}>
                    <div>Tercera Edad / Adulto Mayor (25%)</div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 400, color: '#2563eb' }}>Ley de Proteccion Integral del Adulto Mayor (Honduras)</span>
                  </div>
                </button>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                  Descuento Personalizado
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setDiscountType('PERCENT')}
                    style={{
                      flex: 1, padding: '0.45rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700,
                      border: '1px solid #cbd5e1',
                      background: discountType === 'PERCENT' ? 'var(--accent-primary)' : '#f8fafc',
                      color: discountType === 'PERCENT' ? '#ffffff' : '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    Porcentaje (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('FIXED')}
                    style={{
                      flex: 1, padding: '0.45rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700,
                      border: '1px solid #cbd5e1',
                      background: discountType === 'FIXED' ? 'var(--accent-primary)' : '#f8fafc',
                      color: discountType === 'FIXED' ? '#ffffff' : '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    Monto Fijo ({tenant.currencySymbol})
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="number"
                    min="0"
                    step={discountType === 'PERCENT' ? '1' : '0.01'}
                    max={discountType === 'PERCENT' ? '100' : undefined}
                    placeholder={discountType === 'PERCENT' ? 'Ej. 10' : 'Ej. 50.00'}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleApplyCustomDiscount();
                      }
                    }}
                    style={{
                      flex: 1, padding: '0.55rem 0.75rem', borderRadius: '6px',
                      border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none'
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleApplyCustomDiscount}
                    style={{ padding: '0.55rem 1rem', fontSize: '0.85rem' }}
                  >
                    Aplicar
                  </button>
                </div>
              </div>

              {cartDiscountTotal > 0 && (
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={handleRemoveDiscount}
                    className="btn btn-secondary"
                    style={{ width: '100%', color: '#dc2626', borderColor: '#fca5a5', padding: '0.55rem', fontSize: '0.8rem' }}
                  >
                    Quitar Descuento del Carrito (0%)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Service Staff Assignment for Walk-in POS */}
      {serviceModalService && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)',
          zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '14px', width: '100%', maxWidth: '420px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden'
          }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9333ea' }}>
                  <Scissors size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    {serviceModalService.name}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#7e22ce', fontWeight: 700 }}>
                    {formatCurrency(serviceModalService.price, tenant.currencySymbol)} • {serviceModalService.durationMinutes} min
                  </span>
                </div>
              </div>
              <button
                onClick={() => setServiceModalService(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmServiceModal} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                  Personal que atiende el servicio
                </label>
                <select
                  className="input-control"
                  value={serviceSelectedStaffId}
                  onChange={(e) => setServiceSelectedStaffId(e.target.value)}
                  style={{ fontSize: '0.85rem', padding: '0.55rem' }}
                  autoFocus
                >
                  <option value="">-- Sin Asignar --</option>
                  {availableStaff.map(st => (
                    <option key={st.id} value={st.id}>{st.fullName}</option>
                  ))}
                </select>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.72rem', color: '#64748b' }}>
                  La comisión se acumulará al colaborador seleccionado.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setServiceModalService(null)}
                  style={{ fontSize: '0.8rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ fontSize: '0.8rem', background: '#9333ea', borderColor: '#9333ea' }}
                >
                  Agregar a la Venta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Packaging Presentation Selector Modal */}
      {presentationModalProduct && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)',
          zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '14px', width: '100%', maxWidth: '440px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden'
          }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                  <Package size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    {presentationModalProduct.name}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Stock disponible: <strong>{presentationModalProduct.currentStock} unidades</strong>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPresentationModalProduct(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                Seleccione el formato a vender (o presione el número en el teclado):
              </div>

              {/* Individual Base Unit */}
              <button
                type="button"
                onClick={() => {
                  if (!tenant.allowNegativeStock && presentationModalProduct.currentStock <= 0) {
                    toast.error(`"${presentationModalProduct.name}" no tiene stock suficiente.`);
                    return;
                  }
                  addToCart({ product: presentationModalProduct });
                  toast.success(`+ ${presentationModalProduct.name}`);
                  setPresentationModalProduct(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  border: '2px solid #e2e8f0',
                  background: '#f8fafc',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '0.2rem 0.5rem', borderRadius: '6px', background: '#e2e8f0', color: '#334155', fontFamily: 'monospace' }}>
                    1
                  </span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                      1 Unidad Individual
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Venta por unidad suelta ({presentationModalProduct.unitOfMeasure || 'Unid.'})
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>
                    {formatCurrency(presentationModalProduct.salePrice, tenant.currencySymbol)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    1 unid.
                  </div>
                </div>
              </button>

              {/* Packaging Presentations */}
              {presentationModalProduct.presentations?.map((pres, presIdx) => {
                const isOutOfStock = !tenant.allowNegativeStock && presentationModalProduct.currentStock < pres.unitsCount;
                return (
                  <button
                    key={pres.id}
                    type="button"
                    disabled={isOutOfStock}
                    onClick={() => {
                      if (isOutOfStock) {
                        toast.error(`Stock insuficiente para "${pres.name}" (Requiere: ${pres.unitsCount}, Disponible: ${presentationModalProduct.currentStock})`);
                        return;
                      }
                      addToCart({ product: presentationModalProduct, presentation: pres });
                      toast.success(`+ ${presentationModalProduct.name} [${pres.name}]`);
                      setPresentationModalProduct(null);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.85rem 1rem',
                      borderRadius: '10px',
                      border: isOutOfStock ? '1px dashed #cbd5e1' : '2px solid #cbd5e1',
                      background: isOutOfStock ? '#f8fafc' : '#ffffff',
                      cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                      opacity: isOutOfStock ? 0.6 : 1,
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '0.2rem 0.5rem', borderRadius: '6px', background: isOutOfStock ? '#f1f5f9' : '#ede9fe', color: isOutOfStock ? '#94a3b8' : '#6b21a8', fontFamily: 'monospace' }}>
                        {presIdx + 2}
                      </span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span>{pres.name}</span>
                          <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: '#e0e7ff', color: '#4338ca', fontWeight: 600 }}>
                            {pres.unitsCount} unidades
                          </span>
                        </div>
                        {pres.barcode && (
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>
                            Barras: {pres.barcode}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>
                        {formatCurrency(pres.salePrice, tenant.currencySymbol)}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>
                        ({formatCurrency(pres.salePrice / pres.unitsCount, tenant.currencySymbol)} / unid)
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', background: '#f8fafc' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPresentationModalProduct(null)}
                style={{ fontSize: '0.8rem' }}
              >
                Cancelar [Esc]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Descuento por Producto Individual */}
      {lineDiscountModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)',
          zIndex: 1150, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '14px', width: '100%', maxWidth: '420px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden'
          }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Percent size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
                    Descuento por Producto
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                    {lineDiscountModal.line.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLineDiscountModal(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Resumen de línea */}
              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ color: '#64748b' }}>Cant: </span>
                  <strong>{lineDiscountModal.line.quantity}</strong>
                  <span style={{ color: '#64748b', marginLeft: '0.5rem' }}>x </span>
                  <strong>{formatCurrency(lineDiscountModal.line.originalUnitPrice, tenant.currencySymbol)}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Subtotal: </span>
                  <strong>{formatCurrency(lineDiscountModal.line.originalUnitPrice * lineDiscountModal.line.quantity, tenant.currencySymbol)}</strong>
                </div>
              </div>

              {/* Selector de Modalidad */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Modalidad de Descuento
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setLineDiscountModal(prev => prev ? { ...prev, type: 'PERCENT', value: prev.value || '10' } : null)}
                    style={{
                      padding: '0.45rem',
                      borderRadius: '6px',
                      border: lineDiscountModal.type === 'PERCENT' ? '2px solid #dc2626' : '1px solid #cbd5e1',
                      background: lineDiscountModal.type === 'PERCENT' ? '#fef2f2' : '#ffffff',
                      color: lineDiscountModal.type === 'PERCENT' ? '#b91c1c' : '#334155',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer'
                    }}
                  >
                    Porcentaje (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLineDiscountModal(prev => prev ? { ...prev, type: 'FIXED', value: prev.value || '' } : null)}
                    style={{
                      padding: '0.45rem',
                      borderRadius: '6px',
                      border: lineDiscountModal.type === 'FIXED' ? '2px solid #dc2626' : '1px solid #cbd5e1',
                      background: lineDiscountModal.type === 'FIXED' ? '#fef2f2' : '#ffffff',
                      color: lineDiscountModal.type === 'FIXED' ? '#b91c1c' : '#334155',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer'
                    }}
                  >
                    Monto Fijo ({tenant.currencySymbol})
                  </button>
                </div>
              </div>

              {/* Porcentajes Rápidos */}
              {lineDiscountModal.type === 'PERCENT' && (
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.35rem' }}>
                    Porcentajes Frecuentes
                  </label>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {['5', '10', '15', '20', '25', '50'].map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setLineDiscountModal(prev => prev ? { ...prev, value: p } : null)}
                        style={{
                          padding: '0.3rem 0.55rem',
                          borderRadius: '6px',
                          border: lineDiscountModal.value === p ? '1px solid #dc2626' : '1px solid #e2e8f0',
                          background: lineDiscountModal.value === p ? '#fee2e2' : '#f8fafc',
                          color: lineDiscountModal.value === p ? '#dc2626' : '#334155',
                          fontWeight: 700,
                          fontSize: '0.78rem',
                          cursor: 'pointer'
                        }}
                      >
                        {p}%
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input Numérico */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  {lineDiscountModal.type === 'PERCENT' ? 'Porcentaje de Descuento (%)' : `Monto a Descontar (${tenant.currencySymbol})`}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={lineDiscountModal.type === 'PERCENT' ? 100 : undefined}
                  value={lineDiscountModal.value}
                  onChange={(e) => setLineDiscountModal(prev => prev ? { ...prev, value: e.target.value } : null)}
                  placeholder={lineDiscountModal.type === 'PERCENT' ? 'Ej. 10' : 'Ej. 25.00'}
                  className="input-control"
                  style={{ width: '100%', fontSize: '1rem', fontWeight: 700 }}
                  autoFocus
                />
              </div>

              {/* Vista Previa en Vivo */}
              {(() => {
                const lineGross = lineDiscountModal.line.originalUnitPrice * lineDiscountModal.line.quantity;
                const numVal = parseFloat(lineDiscountModal.value) || 0;
                let calculatedDisc = lineDiscountModal.type === 'PERCENT' ? (lineGross * (numVal / 100)) : numVal;
                calculatedDisc = Math.min(lineGross, Math.max(0, Math.round(calculatedDisc * 100) / 100));
                const finalTotal = Math.max(0, lineGross - calculatedDisc);

                return (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.75rem', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#166534' }}>
                      <span>Descuento aplicado:</span>
                      <strong>-{formatCurrency(calculatedDisc, tenant.currencySymbol)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#15803d', fontWeight: 800, fontSize: '0.9rem', borderTop: '1px solid #dcfce7', paddingTop: '0.25rem' }}>
                      <span>Nuevo Total de Línea:</span>
                      <span>{formatCurrency(finalTotal, tenant.currencySymbol)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', background: '#f8fafc', gap: '0.5rem' }}>
              {lineDiscountModal.line.discountAmount > 0 ? (
                <button
                  type="button"
                  onClick={handleRemoveLineDiscount}
                  className="btn btn-secondary"
                  style={{ color: '#dc2626', borderColor: '#fca5a5', fontSize: '0.8rem' }}
                >
                  Quitar Descuento
                </button>
              ) : <div />}

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setLineDiscountModal(null)}
                  style={{ fontSize: '0.8rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleApplyLineDiscount}
                  style={{ fontSize: '0.8rem' }}
                >
                  Aplicar Descuento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin PIN Authorization Modal (Mechanism B) */}
      <AdminPinModal
        isOpen={adminPinConfig.isOpen}
        title={adminPinConfig.title}
        actionDescription={adminPinConfig.actionDescription}
        onSuccess={(admin) => {
          setAdminPinConfig(prev => ({ ...prev, isOpen: false }));
          adminPinConfig.onSuccess(admin);
        }}
        onCancel={() => setAdminPinConfig(prev => ({ ...prev, isOpen: false }))}
      />

    </div>
  );
};

export default PosContainer;
