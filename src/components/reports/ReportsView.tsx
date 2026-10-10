import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  BarChart3, TrendingUp, DollarSign, FileText, Calendar,
  Printer, CreditCard, ShieldCheck, PieChart, ShoppingBag, ArrowUpRight,
  Search, Filter, Eye, X, Receipt, CheckCircle, Trophy, Award, Users,
  Archive, Star, Layers, PackageX, TrendingDown, RefreshCw, Zap,
  AlertTriangle, RotateCcw, Ban, ArrowLeftRight
} from 'lucide-react';
import { Sale, Product, CartLine, Staff, UserProfile, Customer, StaffCommission } from '../../types';
import { generateEscPosReceipt } from '../../lib/escPos';
import { formatCurrency } from '../../lib/monetary';
import {
  fetchSalesFromSupabase,
  fetchShiftsFromSupabase,
  fetchCashMovementsFromSupabase,
  fetchExpensesFromSupabase
} from '../../lib/supabaseService';
import { isSupabaseConfigured } from '../../lib/supabase';
import { toast } from 'sonner';

export const ReportsView: React.FC = () => {
  const sales = useAppStore(state => state.sales);
  const products = useAppStore(state => state.products);
  const tenant = useAppStore(state => state.tenant);
  const fiscalRange = useAppStore(state => state.fiscalRange);
  const shiftHistory = useAppStore(state => state.shiftHistory);
  const activeShift = useAppStore(state => state.activeShift);
  const staff = useAppStore(state => state.staff);
  const profiles = useAppStore(state => state.profiles);
  const commissions = useAppStore(state => state.commissions);
  const customers = useAppStore(state => state.customers);
  const voidSale = useAppStore(state => state.voidSale);
  const refundSale = useAppStore(state => state.refundSale);

  const [mainSubTab, setMainSubTab] = useState<'sales' | 'leaderboard' | 'inventory_capital' | 'loyalty' | 'shifts'>('sales');

  const tenantShifts = [
    ...(activeShift && activeShift.tenantId === tenant.id && activeShift.status === 'CLOSED' ? [activeShift] : []),
    ...(shiftHistory || []).filter(s => s.tenantId === tenant.id)
  ].filter((shift, index, self) => self.findIndex(s => s.id === shift.id) === index);

  // Filter States
  const [dateFilter, setDateFilter] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'CASH' | 'CARD' | 'TRANSFER' | 'MIXED'>('ALL');
  const [docTypeFilter, setDocTypeFilter] = useState<'ALL' | 'FISCAL' | 'TICKET'>('ALL');
  const [selectedCajaFilter, setSelectedCajaFilter] = useState<string>('ALL');

  // Selected Sale / Shift for Detail Modals
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<Sale | null>(null);
  const [selectedShiftDetail, setSelectedShiftDetail] = useState<any | null>(null);

  // Void & Refund Modals state
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [saleToVoid, setSaleToVoid] = useState<Sale | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [saleToRefund, setSaleToRefund] = useState<Sale | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'STORE_CREDIT'>('CASH');
  const [refundItemsState, setRefundItemsState] = useState<Array<{
    productId?: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    maxQuantity: number;
    subtotal: number;
    isDamaged: boolean;
    selected: boolean;
  }>>([]);

  const handleOpenVoidModal = (sale: Sale) => {
    setSaleToVoid(sale);
    setVoidReason('');
    setIsVoidModalOpen(true);
  };

  const handleConfirmVoid = () => {
    if (!saleToVoid) return;
    if (!voidReason.trim()) {
      toast.error('Debe ingresar el motivo de anulación');
      return;
    }
    const ok = voidSale(saleToVoid.id, voidReason.trim());
    if (ok) {
      setIsVoidModalOpen(false);
      if (selectedSaleDetail?.id === saleToVoid.id) {
        setSelectedSaleDetail({
          ...saleToVoid,
          status: 'VOIDED',
          voidReason: voidReason.trim(),
          voidedAt: new Date().toISOString()
        });
      }
    }
  };

  const handleOpenRefundModal = (sale: Sale) => {
    setSaleToRefund(sale);
    setRefundReason('');
    setRefundMethod('CASH');
    setRefundItemsState(
      (sale.items || []).map(it => ({
        productId: it.productId,
        productName: it.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        maxQuantity: it.quantity,
        subtotal: it.total,
        isDamaged: false,
        selected: true
      }))
    );
    setIsRefundModalOpen(true);
  };

  const handleConfirmRefund = () => {
    if (!saleToRefund) return;
    const selectedItems = refundItemsState.filter(it => it.selected && it.quantity > 0);
    if (selectedItems.length === 0) {
      toast.error('Seleccione al menos un producto a devolver');
      return;
    }
    if (!refundReason.trim()) {
      toast.error('Debe especificar el motivo de devolución / cambio');
      return;
    }

    const hasAnyDamaged = selectedItems.some(it => it.isDamaged);

    const ok = refundSale({
      saleId: saleToRefund.id,
      reason: refundReason.trim(),
      refundMethod,
      isDamagedWaste: hasAnyDamaged,
      items: selectedItems.map(it => ({
        productId: it.productId,
        productName: it.productName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        subtotal: it.unitPrice * it.quantity,
        isDamaged: it.isDamaged
      }))
    });

    if (ok) {
      setIsRefundModalOpen(false);
      if (selectedSaleDetail?.id === saleToRefund.id) {
        setSelectedSaleDetail({
          ...saleToRefund,
          status: 'REFUNDED'
        });
      }
    }
  };

  // Auto-sync full business telemetry (sales, shifts, cash movements, expenses) from cloud on view mount
  React.useEffect(() => {
    if (isSupabaseConfigured() && tenant?.id) {
      fetchSalesFromSupabase(tenant.id).then(liveSales => {
        if (liveSales && liveSales.length > 0) {
          useAppStore.setState(state => {
            const liveIds = new Set(liveSales.map(ls => ls.id));
            const localOnly = (state.sales || []).filter(s => !liveIds.has(s.id));
            return { sales: [...liveSales, ...localOnly] };
          });
        }
      });

      fetchShiftsFromSupabase(tenant.id).then(liveShifts => {
        if (liveShifts && liveShifts.length > 0) {
          useAppStore.setState(state => {
            const liveIds = new Set(liveShifts.map(ls => ls.id));
            const localOnly = (state.shiftHistory || []).filter(s => !liveIds.has(s.id));
            return { shiftHistory: [...liveShifts, ...localOnly] };
          });
        }
      });

      fetchCashMovementsFromSupabase(tenant.id).then(liveMovements => {
        if (liveMovements && liveMovements.length > 0) {
          useAppStore.setState(state => {
            const liveIds = new Set(liveMovements.map(lm => lm.id));
            const localOnly = (state.cashMovements || []).filter(m => !liveIds.has(m.id));
            return { cashMovements: [...liveMovements, ...localOnly] };
          });
        }
      });

      fetchExpensesFromSupabase(tenant.id).then(liveExpenses => {
        if (liveExpenses && liveExpenses.length > 0) {
          useAppStore.setState(state => {
            const liveIds = new Set(liveExpenses.map(le => le.id));
            const localOnly = (state.expenses || []).filter(e => !liveIds.has(e.id));
            return { expenses: [...liveExpenses, ...localOnly] };
          });
        }
      });
    }
  }, [tenant.id]);

  // Filter Sales based on Selected Time Period & Search & Filters & Tenant ID
  const getFilteredSales = () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    // Multi-tenant sales filtering
    const tenantSales = sales.filter((s: Sale) => s.tenantId === tenant.id);

    return tenantSales.filter(s => {
      // 1. Date filter
      const saleDate = new Date(s.createdAt);
      let matchesDate = true;
      if (dateFilter === 'TODAY') {
        matchesDate = saleDate >= startOfToday && saleDate <= endOfToday;
      } else if (dateFilter === 'WEEK') {
        matchesDate = saleDate >= startOfWeek;
      } else if (dateFilter === 'MONTH') {
        matchesDate = saleDate >= startOfMonth;
      }

      // 2. Search term (document number, customer name, rtn, item names)
      const query = searchTerm.trim().toLowerCase();
      let matchesSearch = true;
      if (query) {
        const matchDoc = s.documentNumber.toLowerCase().includes(query);
        const matchName = s.customerName.toLowerCase().includes(query);
        const matchRtn = s.customerRtn ? s.customerRtn.toLowerCase().includes(query) : false;
        const matchItems = s.items?.some(i => i.name.toLowerCase().includes(query) || i.sku.toLowerCase().includes(query)) || false;
        matchesSearch = matchDoc || matchName || matchRtn || matchItems;
      }

      // 3. Payment method filter
      let matchesPayment = true;
      if (paymentFilter !== 'ALL') {
        matchesPayment = s.paymentMethod === paymentFilter;
      }

      // 4. Document type filter (Fiscal vs Ticket)
      let matchesDocType = true;
      if (docTypeFilter === 'FISCAL') {
        matchesDocType = Boolean(s.isFiscal || s.cai);
      } else if (docTypeFilter === 'TICKET') {
        matchesDocType = !s.isFiscal && !s.cai;
      }

      return matchesDate && matchesSearch && matchesPayment && matchesDocType;
    });
  };

  const filteredSales = getFilteredSales();

  // Financial Metric Calculations
  const totalSalesAmount = filteredSales.reduce((acc, s) => acc + s.total, 0);
  const totalSubtotal = filteredSales.reduce((acc, s) => acc + s.subtotal, 0);
  const totalTax15 = filteredSales.reduce((acc, s) => acc + (s.tax15 || 0), 0);
  const totalTax18 = filteredSales.reduce((acc, s) => acc + (s.tax18 || 0), 0);
  const totalTax = totalTax15 + totalTax18;
  const totalExempt = filteredSales.reduce((acc, s) => acc + (s.exemptAmount || 0) + (s.exoneratedAmount || 0), 0);
  const avgTicket = filteredSales.length > 0 ? totalSalesAmount / filteredSales.length : 0;

  // Calculate COGS and Gross Profit (subtracting discount amounts)
  let estimatedCOGS = 0;
  let totalDiscounts = 0;
  filteredSales.forEach(s => {
    totalDiscounts += (s.discountAmount || 0) + (s.loyaltyDiscountAmount || 0);
    s.items?.forEach(line => {
      if (line.productId) {
        const prod = products.find(p => p.id === line.productId);
        if (prod) {
          estimatedCOGS += prod.costPrice * line.quantity;
        }
      }
    });
  });
  const grossProfit = (totalSubtotal - totalDiscounts) - estimatedCOGS;

  // Payment Method Breakdown
  const paymentMethods = {
    CASH: filteredSales.filter(s => s.paymentMethod === 'CASH').reduce((acc, s) => acc + s.total, 0),
    CARD: filteredSales.filter(s => s.paymentMethod === 'CARD').reduce((acc, s) => acc + s.total, 0),
    TRANSFER: filteredSales.filter(s => s.paymentMethod === 'TRANSFER').reduce((acc, s) => acc + s.total, 0),
    MIXED: filteredSales.filter(s => s.paymentMethod === 'MIXED').reduce((acc, s) => acc + s.total, 0),
    CREDIT: filteredSales.filter(s => s.paymentMethod === 'CREDIT').reduce((acc, s) => acc + s.total, 0),
  };

  // Top Selling Products Calculation
  const productSalesMap: Record<string, { product: Product; quantity: number; revenue: number; cogs: number }> = {};
  filteredSales.forEach(s => {
    s.items?.forEach(line => {
      if (line.productId) {
        const prod = products.find(p => p.id === line.productId);
        if (prod) {
          if (!productSalesMap[line.productId]) {
            productSalesMap[line.productId] = { product: prod, quantity: 0, revenue: 0, cogs: 0 };
          }
          productSalesMap[line.productId].quantity += line.quantity;
          productSalesMap[line.productId].revenue += line.total;
          productSalesMap[line.productId].cogs += prod.costPrice * line.quantity;
        }
      }
    });
  });

  const topProducts = Object.values(productSalesMap)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  // Inventory Health Metric Calculations
  const tenantProductsList = products.filter(p => p.tenantId === tenant.id);
  const lowStockCount = tenantProductsList.filter(p => p.currentStock <= p.minStockAlert).length;
  const healthPercentage = tenantProductsList.length > 0
    ? Math.round(((tenantProductsList.length - lowStockCount) / tenantProductsList.length) * 100)
    : 100;

  // Hourly Sales Trend Bucket Calculation
  const hourlyBuckets = [
    { label: '8 AM', minHour: 0, maxHour: 9, amount: 0, count: 0 },
    { label: '10 AM', minHour: 10, maxHour: 11, amount: 0, count: 0 },
    { label: '12 PM', minHour: 12, maxHour: 13, amount: 0, count: 0 },
    { label: '2 PM', minHour: 14, maxHour: 15, amount: 0, count: 0 },
    { label: '4 PM', minHour: 16, maxHour: 17, amount: 0, count: 0 },
    { label: '6 PM', minHour: 18, maxHour: 19, amount: 0, count: 0 },
    { label: '8 PM+', minHour: 20, maxHour: 23, amount: 0, count: 0 },
  ];

  filteredSales.forEach(s => {
    const saleHour = new Date(s.createdAt).getHours();
    const targetBucket = hourlyBuckets.find(b => saleHour >= b.minHour && saleHour <= b.maxHour);
    if (targetBucket) {
      targetBucket.amount += s.total;
      targetBucket.count += 1;
    }
  });

  const maxBucketAmount = Math.max(...hourlyBuckets.map(b => b.amount), 1);
  const peakBucket = [...hourlyBuckets].sort((a, b) => b.amount - a.amount)[0];

  // SAR Fiscal Sales List
  const fiscalSalesList = filteredSales.filter(s => s.isFiscal || s.cai);

  // --- DASHBOARD 1: LEADERBOARD & STAFF PERFORMANCE ---
  const tenantCommissions = commissions.filter(c => c.tenantId === tenant.id);
  const tenantStaffList = staff.filter(st => st.tenantId === tenant.id);
  const tenantProfilesList = profiles.filter(pr => pr.tenantId === tenant.id);

  const staffPerformanceMap: Record<string, {
    id: string;
    name: string;
    totalSales: number;
    salesCount: number;
    commissionsTotal: number;
  }> = {};

  filteredSales.forEach(s => {
    s.items?.forEach(item => {
      let staffId = item.staffId || '';
      let staffName = item.staffName || '';

      if (!staffId && !staffName) {
        staffId = 'caja-general';
        staffName = s.userName || 'Venta General / Caja';
      } else if (!staffName) {
        const foundStaff = tenantStaffList.find(st => st.id === staffId);
        const foundProfile = tenantProfilesList.find(pr => pr.id === staffId);
        staffName = foundStaff?.fullName || foundProfile?.fullName || 'Vendedor / Empleado';
      }

      if (!staffId) staffId = staffName;

      if (!staffPerformanceMap[staffId]) {
        staffPerformanceMap[staffId] = {
          id: staffId,
          name: staffName,
          totalSales: 0,
          salesCount: 0,
          commissionsTotal: 0
        };
      }
      staffPerformanceMap[staffId].totalSales += item.total;
      staffPerformanceMap[staffId].salesCount += 1;
    });
  });

  tenantCommissions.forEach(comm => {
    if (staffPerformanceMap[comm.staffId]) {
      staffPerformanceMap[comm.staffId].commissionsTotal += comm.commissionAmount;
    }
  });

  const staffLeaderboard = Object.values(staffPerformanceMap).sort((a, b) => b.totalSales - a.totalSales);
  const topSeller = staffLeaderboard[0];
  const totalCommissionsPeriod = tenantCommissions.reduce((acc, c) => acc + c.commissionAmount, 0);

  // --- DASHBOARD 2: CAPITAL INMOVILIZADO & PRODUCTOS HUESO ---
  const activeTenantProducts = tenantProductsList.filter(p => p.isActive);
  const totalCapitalAtCost = activeTenantProducts.reduce((acc, p) => acc + (p.costPrice * Math.max(0, p.currentStock)), 0);
  const totalPotentialSaleValue = activeTenantProducts.reduce((acc, p) => acc + (p.salePrice * Math.max(0, p.currentStock)), 0);
  const totalPotentialGrossProfit = totalPotentialSaleValue - totalCapitalAtCost;

  const categoryCapitalMap: Record<string, { category: string; count: number; totalStock: number; costValue: number; saleValue: number }> = {};
  activeTenantProducts.forEach(p => {
    const cat = p.category || 'Sin Categoría';
    if (!categoryCapitalMap[cat]) {
      categoryCapitalMap[cat] = { category: cat, count: 0, totalStock: 0, costValue: 0, saleValue: 0 };
    }
    categoryCapitalMap[cat].count += 1;
    categoryCapitalMap[cat].totalStock += Math.max(0, p.currentStock);
    categoryCapitalMap[cat].costValue += p.costPrice * Math.max(0, p.currentStock);
    categoryCapitalMap[cat].saleValue += p.salePrice * Math.max(0, p.currentStock);
  });
  const categoryCapitalList = Object.values(categoryCapitalMap).sort((a, b) => b.costValue - a.costValue);

  const deadStockProducts = activeTenantProducts.map(p => {
    const soldQty = productSalesMap[p.id]?.quantity || 0;
    return {
      product: p,
      soldQty,
      tiedCapital: p.costPrice * Math.max(0, p.currentStock),
      potentialValue: p.salePrice * Math.max(0, p.currentStock)
    };
  })
  .filter(item => item.product.currentStock > 0 && item.soldQty === 0)
  .sort((a, b) => b.tiedCapital - a.tiedCapital);

  const totalDeadStockCapital = deadStockProducts.reduce((acc, item) => acc + item.tiedCapital, 0);

  // --- DASHBOARD 3: CLIENTES RECURRENTES & FIDELIZACIÓN ---
  const tenantCustomersList = customers.filter(c => c.tenantId === tenant.id);
  const registeredCustomerSales = filteredSales.filter(s => s.customerId && s.customerName !== 'Consumidor Final');
  const finalConsumerSales = filteredSales.filter(s => !s.customerId || s.customerName === 'Consumidor Final');
  
  const registeredSalesAmount = registeredCustomerSales.reduce((acc, s) => acc + s.total, 0);
  const finalConsumerSalesAmount = finalConsumerSales.reduce((acc, s) => acc + s.total, 0);
  const retentionPercentage = filteredSales.length > 0 
    ? Math.round((registeredCustomerSales.length / filteredSales.length) * 100) 
    : 0;

  const totalPointsEarnedPeriod = filteredSales.reduce((acc, s) => acc + (s.loyaltyPointsEarned || 0), 0);
  const totalPointsRedeemedPeriod = filteredSales.reduce((acc, s) => acc + (s.loyaltyPointsRedeemed || 0), 0);
  const totalLoyaltyDiscountGiven = filteredSales.reduce((acc, s) => acc + (s.loyaltyDiscountAmount || 0), 0);
  const topLoyalCustomers = [...tenantCustomersList].sort((a, b) => (b.loyaltyPoints || 0) - (a.loyaltyPoints || 0)).slice(0, 10);

  // Thermal Print Handler
  const handlePrintReceipt = (sale: Sale, copyType: 'ORIGINAL' | 'COPIA') => {
    const formattedDate = new Date(sale.createdAt).toLocaleString('es-HN');
    const escPosBuffer = generateEscPosReceipt(sale, tenant, copyType);

    const blob = new Blob([escPosBuffer], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
      win.focus();
    } else {
      window.print();
    }
  };

  const handleSyncCloudData = async () => {
    if (isSupabaseConfigured() && tenant.id) {
      toast.info('Sincronizando reportes y movimientos desde la nube...');
      const [liveSales, liveShifts, liveMovements, liveExpenses] = await Promise.all([
        fetchSalesFromSupabase(tenant.id),
        fetchShiftsFromSupabase(tenant.id),
        fetchCashMovementsFromSupabase(tenant.id),
        fetchExpensesFromSupabase(tenant.id)
      ]);

      useAppStore.setState(s => {
        const salesMap = new Map((s.sales || []).map(item => [item.id, item]));
        if (liveSales) liveSales.forEach(ls => salesMap.set(ls.id, ls));

        const shiftsMap = new Map((s.shiftHistory || []).map(item => [item.id, item]));
        if (liveShifts) liveShifts.forEach(ls => shiftsMap.set(ls.id, ls));

        const movsMap = new Map((s.cashMovements || []).map(item => [item.id, item]));
        if (liveMovements) liveMovements.forEach(lm => movsMap.set(lm.id, lm));

        const expMap = new Map((s.expenses || []).map(item => [item.id, item]));
        if (liveExpenses) liveExpenses.forEach(le => expMap.set(le.id, le));

        return {
          sales: Array.from(salesMap.values()),
          shiftHistory: Array.from(shiftsMap.values()),
          cashMovements: Array.from(movsMap.values()),
          expenses: Array.from(expMap.values())
        };
      });

      toast.success('Reportes, turnos y movimientos de caja sincronizados.');
    } else {
      toast.info('Los datos en este navegador están actualizados.');
    }
  };

  return (
    <div className="reports-view-container" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Header Banner */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ background: '#ecfdf5', padding: '0.75rem', borderRadius: '10px', border: '1px solid #a7f3d0' }}>
            <BarChart3 size={28} style={{ color: '#059669' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>Reportes & Inteligencia Comercial</h2>
            <p style={{ fontSize: '0.85rem', color: '#475569', margin: '0.2rem 0 0 0', fontWeight: 500 }}>
              Análisis descriptivo de facturación, capital, colaboradores y lealtad para {tenant.name}
            </p>
          </div>
        </div>

        {/* Global SubTab & Controls Header */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', minWidth: 0, maxWidth: '100%' }}>
          <div className="subtab-nav-container" style={{ display: 'flex', gap: '0.35rem', background: '#f1f5f9', padding: '4px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
            <button
              className="btn"
              onClick={() => setMainSubTab('sales')}
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.82rem',
                background: mainSubTab === 'sales' ? '#0f172a' : 'transparent',
                color: mainSubTab === 'sales' ? '#ffffff' : '#334155',
                fontWeight: mainSubTab === 'sales' ? 800 : 600,
                borderRadius: '6px',
                boxShadow: mainSubTab === 'sales' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none'
              }}
            >
              Ventas & Facturación
            </button>
            <button
              className="btn"
              onClick={() => setMainSubTab('leaderboard')}
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.82rem',
                background: mainSubTab === 'leaderboard' ? '#0f172a' : 'transparent',
                color: mainSubTab === 'leaderboard' ? '#ffffff' : '#334155',
                fontWeight: mainSubTab === 'leaderboard' ? 800 : 600,
                borderRadius: '6px',
                boxShadow: mainSubTab === 'leaderboard' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none'
              }}
            >
              Rendimiento de Vendedores
            </button>
            <button
              className="btn"
              onClick={() => setMainSubTab('inventory_capital')}
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.82rem',
                background: mainSubTab === 'inventory_capital' ? '#0f172a' : 'transparent',
                color: mainSubTab === 'inventory_capital' ? '#ffffff' : '#334155',
                fontWeight: mainSubTab === 'inventory_capital' ? 800 : 600,
                borderRadius: '6px',
                boxShadow: mainSubTab === 'inventory_capital' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none'
              }}
            >
              Inventario & Valor
            </button>
            <button
              className="btn"
              onClick={() => setMainSubTab('loyalty')}
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.82rem',
                background: mainSubTab === 'loyalty' ? '#0f172a' : 'transparent',
                color: mainSubTab === 'loyalty' ? '#ffffff' : '#334155',
                fontWeight: mainSubTab === 'loyalty' ? 800 : 600,
                borderRadius: '6px',
                boxShadow: mainSubTab === 'loyalty' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none'
              }}
            >
              Clientes & Fidelización
            </button>
            <button
              className="btn"
              onClick={() => setMainSubTab('shifts')}
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.82rem',
                background: mainSubTab === 'shifts' ? '#0f172a' : 'transparent',
                color: mainSubTab === 'shifts' ? '#ffffff' : '#334155',
                fontWeight: mainSubTab === 'shifts' ? 800 : 600,
                borderRadius: '6px',
                boxShadow: mainSubTab === 'shifts' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none'
              }}
            >
              Cierres de Caja ({tenantShifts.length})
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <button
              className="btn btn-secondary"
              onClick={handleSyncCloudData}
              title="Sincronizar ventas y movimientos desde otros dispositivos"
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem', background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', fontWeight: 600 }}
            >
              <RefreshCw size={15} />
              <span>Refrescar</span>
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => window.print()}
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem', background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', fontWeight: 600 }}
            >
              <Printer size={16} />
              <span>Imprimir</span>
            </button>
          </div>
        </div>
      </div>

      {/* Date Filter Bar for Sales/Leaderboard */}
      {(mainSubTab === 'sales' || mainSubTab === 'leaderboard' || mainSubTab === 'loyalty') && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Período de Análisis:</span>
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <button
              className="btn"
              onClick={() => setDateFilter('TODAY')}
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.8rem',
                background: dateFilter === 'TODAY' ? 'var(--accent-primary)' : 'transparent',
                color: dateFilter === 'TODAY' ? '#ffffff' : '#64748b',
                borderRadius: '6px',
                fontWeight: dateFilter === 'TODAY' ? 700 : 500
              }}
            >
              Hoy
            </button>
            <button
              className="btn"
              onClick={() => setDateFilter('WEEK')}
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.8rem',
                background: dateFilter === 'WEEK' ? 'var(--accent-primary)' : 'transparent',
                color: dateFilter === 'WEEK' ? '#ffffff' : '#64748b',
                borderRadius: '6px',
                fontWeight: dateFilter === 'WEEK' ? 700 : 500
              }}
            >
              Esta Semana
            </button>
            <button
              className="btn"
              onClick={() => setDateFilter('MONTH')}
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.8rem',
                background: dateFilter === 'MONTH' ? 'var(--accent-primary)' : 'transparent',
                color: dateFilter === 'MONTH' ? '#ffffff' : '#64748b',
                borderRadius: '6px',
                fontWeight: dateFilter === 'MONTH' ? 700 : 500
              }}
            >
              Este Mes
            </button>
            <button
              className="btn"
              onClick={() => setDateFilter('ALL')}
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.8rem',
                background: dateFilter === 'ALL' ? 'var(--accent-primary)' : 'transparent',
                color: dateFilter === 'ALL' ? '#ffffff' : '#64748b',
                borderRadius: '6px',
                fontWeight: dateFilter === 'ALL' ? 700 : 500
              }}
            >
              Histórico Todo
            </button>
          </div>
        </div>
      )}

      {/* --- SUBTAB 1: FACTURACIÓN & VENTAS --- */}
      {mainSubTab === 'sales' && (
        <>
          {/* KPI Cards Row */}
          <div className="stats-grid-5" style={{ gap: '1rem' }}>
            <div className="glass-panel" style={{ padding: '1.1rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '0.75rem', opacity: 0.9, fontWeight: 600 }}>Ventas Totales</p>
                <span className="badge" style={{ background: 'rgba(255,255,255,0.25)', color: '#ffffff', fontSize: '0.65rem' }}>Activo</span>
              </div>
              <h3 style={{ fontSize: '1.45rem', fontWeight: 800, marginTop: '0.2rem', color: '#ffffff' }}>
                {tenant.currencySymbol} {totalSalesAmount.toFixed(2)}
              </h3>
              <p style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: '0.3rem' }}>{filteredSales.length} transacciones registradas</p>
            </div>

            <div className="glass-panel" style={{ padding: '1.1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Ganancia Bruta Est.</p>
                <span className="badge" style={{ background: '#dbeefe', color: '#1e40af', fontSize: '0.65rem' }}>
                  {totalSubtotal > 0 ? `${((grossProfit / totalSubtotal) * 100).toFixed(1)}% Margen` : '0%'}
                </span>
              </div>
              <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
                {tenant.currencySymbol} {grossProfit.toFixed(2)}
              </h3>
              <div style={{ width: '100%', height: '5px', background: '#e2e8f0', borderRadius: '4px', marginTop: '0.4rem', overflow: 'hidden' }}>
                <div style={{ width: `${totalSubtotal > 0 ? Math.min(100, Math.max(0, (grossProfit / totalSubtotal) * 100)) : 0}%`, height: '100%', background: '#3b82f6', borderRadius: '4px' }}></div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Impuestos SAR (ISV)</p>
                <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Auditado SAR</span>
              </div>
              <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
                {tenant.currencySymbol} {totalTax.toFixed(2)}
              </h3>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                15%: {tenant.currencySymbol}{totalTax15.toFixed(2)} | 18%: {tenant.currencySymbol}{totalTax18.toFixed(2)}
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '1.1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Salud de Inventario</p>
                <span className={`badge ${lowStockCount > 0 ? 'badge-retail' : 'badge-success'}`} style={{ fontSize: '0.65rem' }}>
                  {lowStockCount > 0 ? `${lowStockCount} Alertas` : 'Óptimo'}
                </span>
              </div>
              <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
                {healthPercentage}%
              </h3>
              <p style={{ fontSize: '0.72rem', color: lowStockCount > 0 ? '#ef4444' : '#10b981', marginTop: '0.3rem', fontWeight: 600 }}>
                {lowStockCount > 0 ? `${lowStockCount} ítem(s) en mínimo` : 'Stock saludable'}
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '1.1rem' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Ticket Promedio</p>
              <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
                {tenant.currencySymbol} {avgTicket.toFixed(2)}
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Por venta efectuada</p>
            </div>
          </div>

          {/* VISUAL HOURLY SALES TREND CHART */}
          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', color: '#0f172a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <TrendingUp size={20} style={{ color: 'var(--accent-primary)' }} />
                  Tendencia de Ventas por Hora / Período
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Identificación visual de horarios pico para optimizar la atención en caja
                </p>
              </div>

              <span className="badge badge-success" style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem' }}>
                Hora Pico: {peakBucket.amount > 0 ? `${peakBucket.label} (${tenant.currencySymbol}${peakBucket.amount.toFixed(2)})` : 'Sin ventas aún'}
              </span>
            </div>

            {/* Dynamic Graphic Bars */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.75rem', height: '140px', paddingTop: '1.5rem', borderBottom: '1px solid #e2e8f0', overflowX: 'auto' }}>
              {hourlyBuckets.map((b) => {
                const heightPct = maxBucketAmount > 0 ? Math.max(12, (b.amount / maxBucketAmount) * 100) : 12;
                const isPeak = b.label === peakBucket.label && b.amount > 0;
                return (
                  <div key={b.label} style={{ flex: 1, minWidth: '45px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: isPeak ? 'var(--accent-primary)' : '#64748b' }}>
                      {b.amount > 0 ? `${tenant.currencySymbol}${b.amount >= 1000 ? `${(b.amount / 1000).toFixed(1)}k` : b.amount.toFixed(0)}` : '0'}
                    </span>

                    <div style={{ width: '100%', height: '100px', display: 'flex', alignItems: 'flex-end' }}>
                      <div
                        title={`${b.label}: ${tenant.currencySymbol} ${b.amount.toFixed(2)} (${b.count} ventas)`}
                        style={{
                          width: '100%',
                          height: `${heightPct}%`,
                          background: isPeak ? 'linear-gradient(180deg, #10b981 0%, #059669 100%)' : '#cbd5e1',
                          borderRadius: '6px 6px 0 0',
                          transition: 'height 0.3s ease, background 0.3s ease',
                          cursor: 'pointer'
                        }}
                      />
                    </div>

                    <span style={{ fontSize: '0.75rem', fontWeight: isPeak ? 700 : 500, color: isPeak ? '#0f172a' : '#64748b' }}>
                      {b.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SEARCH BAR & FILTERS TOOLBAR */}
          <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                className="input-control"
                placeholder="Buscar por N° Factura, Cliente, RTN o Producto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '2.3rem', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Pago:</span>
              <select
                className="input-control"
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value as any)}
                style={{ fontSize: '0.82rem', padding: '0.35rem 0.6rem' }}
              >
                <option value="ALL">Todos los Métodos</option>
                <option value="CASH">Efectivo</option>
                <option value="CARD">Tarjeta</option>
                <option value="TRANSFER">Transferencia</option>
                <option value="MIXED">Pago Mixto</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Tipo:</span>
              <select
                className="input-control"
                value={docTypeFilter}
                onChange={(e) => setDocTypeFilter(e.target.value as any)}
                style={{ fontSize: '0.82rem', padding: '0.35rem 0.6rem' }}
              >
                <option value="ALL">Todos los Comprobantes</option>
                <option value="FISCAL">Solo Facturas Fiscales (SAR)</option>
                <option value="TICKET">Solo Tickets de Venta</option>
              </select>
            </div>

            {(searchTerm || paymentFilter !== 'ALL' || docTypeFilter !== 'ALL') && (
              <button
                className="btn btn-secondary"
                onClick={() => { setSearchTerm(''); setPaymentFilter('ALL'); setDocTypeFilter('ALL'); }}
                style={{ padding: '0.35rem 0.6rem', fontSize: '0.78rem' }}
              >
                Limpiar Filtros
              </button>
            )}
          </div>

          {/* FULL SALES HISTORY TABLE */}
          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h3 style={{ fontSize: '1.05rem', color: '#0f172a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Receipt size={20} style={{ color: 'var(--accent-primary)' }} />
                Listado de Ventas Realizadas ({filteredSales.length})
              </h3>
              <span className="badge badge-wholesale">{filteredSales.length} Registros Encontrados</span>
            </div>

            {/* Filter Controls Toolbar */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', background: '#f8fafc', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Buscar por N° documento, cliente, RTN o producto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ paddingLeft: '2.2rem', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Filter size={15} style={{ color: '#64748b' }} />
                <select
                  className="form-control"
                  value={docTypeFilter}
                  onChange={(e) => setDocTypeFilter(e.target.value as any)}
                  style={{ fontSize: '0.85rem', width: 'auto' }}
                >
                  <option value="ALL">Tipo: Todos</option>
                  <option value="FISCAL">Fiscal SAR</option>
                  <option value="TICKET">Ticket Interno</option>
                </select>

                <select
                  className="form-control"
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value as any)}
                  style={{ fontSize: '0.85rem', width: 'auto' }}
                >
                  <option value="ALL">Método: Todos</option>
                  <option value="CASH">Efectivo</option>
                  <option value="CARD">Tarjeta</option>
                  <option value="TRANSFER">Transferencia</option>
                  <option value="MIXED">Mixto</option>
                </select>

                {(searchTerm || docTypeFilter !== 'ALL' || paymentFilter !== 'ALL') && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setSearchTerm('');
                      setDocTypeFilter('ALL');
                      setPaymentFilter('ALL');
                    }}
                    style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem' }}
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            <div className="table-responsive">
              <table className="table" style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>N° Documento</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Fecha & Hora</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Caja / Terminal</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Cliente</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Artículos</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Subtotal</th>
                    <th style={{ padding: '0.75rem 1rem' }}>ISV</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Total Facturado</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Método</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                        No se encontraron ventas con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((s: Sale) => {
                      const itemCount = s.items?.reduce((acc, item) => acc + item.quantity, 0) || 0;
                      const totalTaxSale = (s.tax15 || 0) + (s.tax18 || 0);
                      const isFiscalDoc = Boolean(s.isFiscal || s.cai);

                      return (
                        <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace' }}>
                            <code>{s.documentNumber}</code>
                            {s.status === 'VOIDED' ? (
                              <div style={{ fontSize: '0.68rem', color: '#dc2626', fontWeight: 800 }}>ANULADA</div>
                            ) : s.status === 'REFUNDED' ? (
                              <div style={{ fontSize: '0.68rem', color: '#d97706', fontWeight: 800 }}>DEVUELTA</div>
                            ) : isFiscalDoc ? (
                              <div style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 600 }}>Fiscal SAR</div>
                            ) : null}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#475569', fontSize: '0.8rem' }}>
                            {new Date(s.createdAt).toLocaleString('es-HN', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span className="badge badge-wholesale" style={{ fontSize: '0.75rem' }}>
                              {s.cajaName || 'Caja 1'}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>
                            {s.customerName}
                            {s.customerRtn && <div style={{ fontSize: '0.72rem', color: '#64748b' }}>RTN: {s.customerRtn}</div>}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>
                              {itemCount} {itemCount === 1 ? 'ítem' : 'ítems'}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                            {tenant.currencySymbol} {s.subtotal.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                            {tenant.currencySymbol} {totalTaxSale.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#10b981' }}>
                            {tenant.currencySymbol} {s.total.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span className={`badge ${s.paymentMethod === 'CASH' ? 'badge-success' : 'badge-wholesale'}`}>
                              {s.paymentMethod === 'CASH' ? 'Efectivo' : (s.paymentMethod === 'CARD' ? 'Tarjeta' : (s.paymentMethod === 'TRANSFER' ? 'Transferencia' : 'Mixto'))}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                              <button
                                title="Ver Detalle de Venta"
                                className="btn btn-secondary"
                                onClick={() => setSelectedSaleDetail(s)}
                                style={{ padding: '0.35rem 0.55rem', fontSize: '0.78rem' }}
                              >
                                <Eye size={14} />
                                <span>Ver</span>
                              </button>
                              <button
                                title="Imprimir Comprobante Original"
                                className="btn btn-secondary"
                                onClick={() => handlePrintReceipt(s, 'ORIGINAL')}
                                style={{ padding: '0.35rem 0.55rem', fontSize: '0.78rem' }}
                              >
                                <Printer size={14} />
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
        </>
      )}

      {/* --- SUBTAB 2: LEADERBOARD EMPLEADOS --- */}
      {mainSubTab === 'leaderboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Leaderboard KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="glass-panel" style={{ padding: '1.1rem', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '0.75rem', opacity: 0.9, fontWeight: 600 }}>Top Vendedor / Barber</p>
                <Trophy size={20} style={{ color: '#ffffff' }} />
              </div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: '0.2rem', color: '#ffffff' }}>
                {topSeller ? topSeller.name : 'Sin registros'}
              </h3>
              <p style={{ fontSize: '0.75rem', opacity: 0.9, marginTop: '0.3rem' }}>
                {topSeller ? `Facturado: ${tenant.currencySymbol} ${topSeller.totalSales.toFixed(2)} (${topSeller.salesCount} ventas)` : ''}
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '1.1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Promedio por Vendedor</p>
                <Users size={18} style={{ color: '#0284c7' }} />
              </div>
              <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
                {tenant.currencySymbol} {staffLeaderboard.length > 0 ? (totalSalesAmount / staffLeaderboard.length).toFixed(2) : '0.00'}
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                En {staffLeaderboard.length} colaboradores activos
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '1.1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Comisiones Generadas</p>
                <Award size={18} style={{ color: '#16a34a' }} />
              </div>
              <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#16a34a', marginTop: '0.2rem' }}>
                {tenant.currencySymbol} {totalCommissionsPeriod.toFixed(2)}
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                Total devengado por servicios
              </p>
            </div>
          </div>

          {/* Leaderboard Table */}
          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.05rem', color: '#0f172a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Trophy size={20} style={{ color: '#f59e0b' }} />
                Tabla de Clasificación & Rendimiento por Vendedor / Personal
              </h3>
              <span className="badge badge-wholesale">{staffLeaderboard.length} Integrantes Evaluados</span>
            </div>

            <div className="table-responsive">
              <table className="table" style={{ width: '100%', fontSize: '0.88rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Rango</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Colaborador</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Total Facturado</th>
                    <th style={{ padding: '0.75rem 1rem' }}>N° Ventas / Servicios</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Ticket Promedio</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Comisiones</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Rendimiento %</th>
                  </tr>
                </thead>
                <tbody>
                  {staffLeaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                        No se registran actividades de venta por colaborador en este período.
                      </td>
                    </tr>
                  ) : (
                    staffLeaderboard.map((member, idx) => {
                      const pctOfTotal = totalSalesAmount > 0 ? (member.totalSales / totalSalesAmount) * 100 : 0;
                      const memberAvgTicket = member.salesCount > 0 ? member.totalSales / member.salesCount : 0;
                      const rankLabel = `#${idx + 1}`;

                      return (
                        <tr key={member.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', fontWeight: 800 }}>
                            <span className="badge" style={{ background: idx === 0 ? '#fef3c7' : idx === 1 ? '#e2e8f0' : idx === 2 ? '#ffedd5' : '#f1f5f9', color: idx === 0 ? '#92400e' : idx === 1 ? '#334155' : idx === 2 ? '#9a3412' : '#64748b' }}>
                              {rankLabel}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                            {member.name}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#10b981' }}>
                            {tenant.currencySymbol} {member.totalSales.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>
                              {member.salesCount} atención(es)
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                            {tenant.currencySymbol} {memberAvgTicket.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0284c7' }}>
                            {tenant.currencySymbol} {member.commissionsTotal.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#0f172a' }}>{pctOfTotal.toFixed(1)}%</span>
                              <div style={{ width: '60px', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ width: `${pctOfTotal}%`, height: '100%', background: idx === 0 ? '#f59e0b' : '#10b981' }} />
                              </div>
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
        </div>
      )}

      {/* --- SUBTAB 3: CAPITAL INMOVILIZADO & PRODUCTOS HUESO --- */}
      {mainSubTab === 'inventory_capital' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Inventory Capital KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="glass-panel" style={{ padding: '1.1rem', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '0.75rem', opacity: 0.9, fontWeight: 600 }}>Capital Inmovilizado (Al Costo)</p>
                <Archive size={20} style={{ color: '#ffffff' }} />
              </div>
              <h3 style={{ fontSize: '1.45rem', fontWeight: 800, marginTop: '0.2rem', color: '#ffffff' }}>
                {tenant.currencySymbol} {totalCapitalAtCost.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: '0.3rem' }}>Inversión acumulada en stock activo</p>
            </div>

            <div className="glass-panel" style={{ padding: '1.1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Valor Potencial (Al Precio Venta)</p>
                <DollarSign size={18} style={{ color: '#16a34a' }} />
              </div>
              <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#16a34a', marginTop: '0.2rem' }}>
                {tenant.currencySymbol} {totalPotentialSaleValue.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                Ganancia Potencial: {tenant.currencySymbol} {totalPotentialGrossProfit.toFixed(2)}
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '1.1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Productos "Hueso" (Sin Ventas)</p>
                <PackageX size={18} style={{ color: '#dc2626' }} />
              </div>
              <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#dc2626', marginTop: '0.2rem' }}>
                {deadStockProducts.length} ítems
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '0.3rem', fontWeight: 600 }}>
                Capital Atrapado: {tenant.currencySymbol} {totalDeadStockCapital.toFixed(2)}
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            {/* Capital by Category */}
            <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.05rem', color: '#0f172a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={18} style={{ color: 'var(--accent-primary)' }} />
                Capital Inmovilizado por Categoría
              </h3>

              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left' }}>
                      <th style={{ padding: '0.6rem' }}>Categoría</th>
                      <th style={{ padding: '0.6rem' }}>Stock Unid.</th>
                      <th style={{ padding: '0.6rem' }}>Capital (Costo)</th>
                      <th style={{ padding: '0.6rem', textAlign: 'right' }}>% Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryCapitalList.map(cat => {
                      const pct = totalCapitalAtCost > 0 ? (cat.costValue / totalCapitalAtCost) * 100 : 0;
                      return (
                        <tr key={cat.category} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.6rem', fontWeight: 600 }}>{cat.category}</td>
                          <td style={{ padding: '0.6rem' }}>{cat.totalStock} unid.</td>
                          <td style={{ padding: '0.6rem', fontWeight: 700, color: '#0f172a' }}>
                            {tenant.currencySymbol} {cat.costValue.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.6rem', textAlign: 'right', fontWeight: 700, color: 'var(--accent-primary)' }}>
                            {pct.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Dead Stock / Slow Moving Items Table */}
            <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.05rem', color: '#0f172a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <TrendingDown size={18} style={{ color: '#dc2626' }} />
                  Top Productos Estancados ("Hueso")
                </h3>
                <span className="badge badge-danger">Lenta Rotación</span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left' }}>
                      <th style={{ padding: '0.6rem' }}>Producto</th>
                      <th style={{ padding: '0.6rem' }}>Stock</th>
                      <th style={{ padding: '0.6rem' }}>Dinero Retenido</th>
                      <th style={{ padding: '0.6rem', textAlign: 'right' }}>Acción Sugerida</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deadStockProducts.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
                          ¡Excelente! No tienes productos estancados sin movimiento.
                        </td>
                      </tr>
                    ) : (
                      deadStockProducts.slice(0, 6).map(item => (
                        <tr key={item.product.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.6rem', fontWeight: 600 }}>{item.product.name}</td>
                          <td style={{ padding: '0.6rem' }}>{item.product.currentStock} {item.product.unitOfMeasure}</td>
                          <td style={{ padding: '0.6rem', fontWeight: 700, color: '#dc2626' }}>
                            {tenant.currencySymbol} {item.tiedCapital.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.6rem', textAlign: 'right' }}>
                            <span className="badge" style={{ background: '#fee2e2', color: '#dc2626', fontSize: '0.68rem', fontWeight: 700 }}>
                              Liquidar al -20%
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- SUBTAB 4: RETENCIÓN & FIDELIDAD --- */}
      {mainSubTab === 'loyalty' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Loyalty KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="glass-panel" style={{ padding: '1.1rem', background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', color: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '0.75rem', opacity: 0.9, fontWeight: 600 }}>Ratio Clientes Recurrentes</p>
                <Zap size={20} style={{ color: '#ffffff' }} />
              </div>
              <h3 style={{ fontSize: '1.45rem', fontWeight: 800, marginTop: '0.2rem', color: '#ffffff' }}>
                {retentionPercentage}%
              </h3>
              <p style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: '0.3rem' }}>
                {registeredCustomerSales.length} de {filteredSales.length} ventas a clientes registrados
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '1.1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Puntos Emitidos</p>
                <Star size={18} style={{ color: '#f59e0b' }} />
              </div>
              <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.2rem' }}>
                {totalPointsEarnedPeriod} pts
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Otorgados por compras</p>
            </div>

            <div className="glass-panel" style={{ padding: '1.1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Puntos Canjeados</p>
                <RefreshCw size={18} style={{ color: '#16a34a' }} />
              </div>
              <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#16a34a', marginTop: '0.2rem' }}>
                {totalPointsRedeemedPeriod} pts
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: '0.3rem', fontWeight: 600 }}>
                Descuento otorgado: {tenant.currencySymbol} {totalLoyaltyDiscountGiven.toFixed(2)}
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            
            {/* Sales Distribution Card */}
            <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.05rem', color: '#0f172a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PieChart size={18} style={{ color: 'var(--accent-primary)' }} />
                Distribución: Cliente Registrado vs. Consumidor Final
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                    <span style={{ fontWeight: 600 }}>Cliente Registrado (Fidelizado)</span>
                    <strong style={{ color: '#8b5cf6' }}>{tenant.currencySymbol} {registeredSalesAmount.toFixed(2)} ({((registeredSalesAmount / (totalSalesAmount || 1)) * 100).toFixed(1)}%)</strong>
                  </div>
                  <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{ width: `${(registeredSalesAmount / (totalSalesAmount || 1)) * 100}%`, height: '100%', background: '#8b5cf6' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                    <span style={{ fontWeight: 600 }}>Consumidor Final (Anónimo)</span>
                    <strong style={{ color: '#64748b' }}>{tenant.currencySymbol} {finalConsumerSalesAmount.toFixed(2)} ({((finalConsumerSalesAmount / (totalSalesAmount || 1)) * 100).toFixed(1)}%)</strong>
                  </div>
                  <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{ width: `${(finalConsumerSalesAmount / (totalSalesAmount || 1)) * 100}%`, height: '100%', background: '#94a3b8' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Top Loyal Customers Table */}
            <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.05rem', color: '#0f172a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Star size={18} style={{ color: '#f59e0b' }} />
                Top Clientes Más Fieles
              </h3>

              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left' }}>
                      <th style={{ padding: '0.6rem' }}>Cliente</th>
                      <th style={{ padding: '0.6rem' }}>Teléfono</th>
                      <th style={{ padding: '0.6rem' }}>Puntos Acum.</th>
                      <th style={{ padding: '0.6rem', textAlign: 'right' }}>Gasto Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topLoyalCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
                          No hay clientes registrados en este comercio.
                        </td>
                      </tr>
                    ) : (
                      topLoyalCustomers.map(c => (
                        <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.6rem', fontWeight: 600 }}>{c.name}</td>
                          <td style={{ padding: '0.6rem' }}>{c.phone || 'Sin número'}</td>
                          <td style={{ padding: '0.6rem' }}>
                            <span className="badge" style={{ background: '#fef3c7', color: '#92400e', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Star size={12} style={{ fill: '#92400e' }} /> {c.loyaltyPoints || 0} pts
                            </span>
                          </td>
                          <td style={{ padding: '0.6rem', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                            {tenant.currencySymbol} {(c.totalSpent || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* --- SUBTAB 5: SHIFTS HISTORY (REPORTES Z) --- */}
      {mainSubTab === 'shifts' && (
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', color: '#0f172a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={20} style={{ color: 'var(--accent-primary)' }} />
                Historial Auditado de Cierres Z ({tenantShifts.length})
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                Registro completo de turnos cerrados, arqueos de caja y sobrantes / faltantes por terminal
              </p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <select
                className="input-control"
                style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}
                value={selectedCajaFilter}
                onChange={(e) => setSelectedCajaFilter(e.target.value)}
              >
                <option value="ALL">Todas las Cajas Registradoras</option>
                {Array.from(new Set(tenantShifts.map((s: any) => s.cajaName || 'Caja Principal'))).map((name: any) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <span className="badge badge-wholesale">{tenantShifts.length} Cierres</span>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Fecha / Hora Cierre</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Caja / Terminal</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Cajero / Responsable</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Fondo Inicial</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Sistema (Esperado)</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Declarado (Arqueo)</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Resultado / Cuadre</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tenantShifts.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                      No se han realizado cierres de caja (Reportes Z) en este comercio aún.
                    </td>
                  </tr>
                ) : (
                  tenantShifts
                    .filter((shift: any) => selectedCajaFilter === 'ALL' || (shift.cajaName || 'Caja Principal') === selectedCajaFilter)
                    .map((shift: any) => {
                      const diff = shift.difference ?? ((shift.closingDeclared ?? 0) - (shift.closingSystem ?? 0));
                      const isPerfect = Math.abs(diff) < 0.01;
                      const isShortage = diff < -0.01;

                      return (
                        <tr key={shift.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>
                            {shift.closedAt
                              ? new Date(shift.closedAt).toLocaleString('es-HN', { dateStyle: 'short', timeStyle: 'short' })
                              : new Date(shift.openedAt).toLocaleString('es-HN', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span className="badge badge-wholesale" style={{ fontSize: '0.75rem' }}>
                              {shift.cajaName || 'Caja Principal'}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#475569', fontWeight: 600 }}>
                            {shift.userName || 'Cajero Principal'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                            {tenant.currencySymbol} {(shift.openingAmount || 0).toFixed(2)}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                            {tenant.currencySymbol} {(shift.closingSystem || 0).toFixed(2)}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                            {tenant.currencySymbol} {(shift.closingDeclared || 0).toFixed(2)}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {isPerfect ? (
                              <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <CheckCircle size={12} /> Cuadre Perfecto
                              </span>
                            ) : isShortage ? (
                              <span className="badge" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontWeight: 700 }}>
                                Faltante: {tenant.currencySymbol} {Math.abs(diff).toFixed(2)}
                              </span>
                            ) : (
                              <span className="badge" style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', fontWeight: 700 }}>
                                Sobrante: {tenant.currencySymbol} {diff.toFixed(2)}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                            <button
                              className="btn btn-secondary"
                              onClick={() => setSelectedShiftDetail(shift)}
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                            >
                              <Eye size={14} />
                              <span>Ver Reporte Z</span>
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

      {/* MODAL: Sale Detail Inspector & Reprint */}
      {selectedSaleDetail && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)',
          zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '560px',
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            display: 'flex', flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#ffffff', zIndex: 10 }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', color: '#0f172a', fontWeight: 700, margin: 0 }}>
                  Detalle de Venta: {selectedSaleDetail.documentNumber}
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>
                  {new Date(selectedSaleDetail.createdAt).toLocaleString('es-HN')}
                </p>
              </div>
              <button
                onClick={() => setSelectedSaleDetail(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Customer Info Card */}
              <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Caja Registradora / Terminal</span>
                  <p style={{ fontWeight: 700, color: 'var(--accent-primary)', margin: 0, fontSize: '0.9rem' }}>{selectedSaleDetail.cajaName || 'Caja 1 - Principal'}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Cliente</span>
                  <p style={{ fontWeight: 700, color: '#0f172a', margin: 0, fontSize: '0.9rem' }}>{selectedSaleDetail.customerName}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>RTN Cliente</span>
                  <p style={{ fontWeight: 700, color: '#0f172a', margin: 0, fontSize: '0.9rem' }}>{selectedSaleDetail.customerRtn || 'Consumidor Final'}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Forma de Pago</span>
                  <p style={{ fontWeight: 700, color: '#10b981', margin: 0, fontSize: '0.9rem' }}>{selectedSaleDetail.paymentMethod}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Tipo Comprobante</span>
                  <p style={{ fontWeight: 700, color: '#0f172a', margin: 0, fontSize: '0.9rem' }}>
                    {selectedSaleDetail.isFiscal || selectedSaleDetail.cai ? 'Factura Fiscal (SAR)' : 'Ticket Consumidor'}
                  </p>
                </div>
              </div>

              {/* Purchased Items Table */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Productos Vendidos</span>
                <table className="table" style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                      <th style={{ padding: '0.5rem' }}>Descripción</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center' }}>Cant.</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Precio Unit.</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSaleDetail.items?.map((item: CartLine, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.5rem', fontWeight: 600, color: '#0f172a' }}>
                          {item.name}
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>SKU: {item.sku}</div>
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 700 }}>{item.quantity}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{tenant.currencySymbol} {item.unitPrice.toFixed(2)}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                          {tenant.currencySymbol} {item.total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Summary */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>Subtotal Neto:</span>
                  <span>{tenant.currencySymbol} {selectedSaleDetail.subtotal.toFixed(2)}</span>
                </div>
                {selectedSaleDetail.discountAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
                    <span>Descuento:</span>
                    <span>-{tenant.currencySymbol} {selectedSaleDetail.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>ISV (15% + 18%):</span>
                  <span>{tenant.currencySymbol} {((selectedSaleDetail.tax15 || 0) + (selectedSaleDetail.tax18 || 0)).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', paddingTop: '0.4rem', borderTop: '1px solid #e2e8f0' }}>
                  <span>Total Cobrado:</span>
                  <span style={{ color: '#10b981' }}>{tenant.currencySymbol} {selectedSaleDetail.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Status Alerts if Voided or Refunded */}
              {selectedSaleDetail.status === 'VOIDED' && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.75rem 1rem', color: '#991b1b', fontSize: '0.85rem' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.2rem' }}>FACTURA ANULADA</div>
                  <div>Motivo: {selectedSaleDetail.voidReason || 'Sin motivo especificado'}</div>
                  {selectedSaleDetail.voidedAt && (
                    <div style={{ fontSize: '0.75rem', marginTop: '0.2rem', color: '#b91c1c' }}>
                      Fecha: {new Date(selectedSaleDetail.voidedAt).toLocaleString('es-HN')}
                    </div>
                  )}
                </div>
              )}

              {selectedSaleDetail.status === 'REFUNDED' && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.75rem 1rem', color: '#92400e', fontSize: '0.85rem' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.2rem' }}>DEVOLUCION PROCESADA</div>
                  <div>Esta venta registra devolucion o sustitucion de producto.</div>
                </div>
              )}

              {/* Actions & Reprint Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                {selectedSaleDetail.status !== 'VOIDED' && selectedSaleDetail.status !== 'REFUNDED' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleOpenVoidModal(selectedSaleDetail)}
                      style={{ color: '#dc2626', borderColor: '#fca5a5', padding: '0.55rem', fontSize: '0.8rem', fontWeight: 600 }}
                    >
                      <Ban size={14} />
                      <span>Anular Venta Completa</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleOpenRefundModal(selectedSaleDetail)}
                      style={{ color: '#d97706', borderColor: '#fcd34d', padding: '0.55rem', fontSize: '0.8rem', fontWeight: 600 }}
                    >
                      <RotateCcw size={14} />
                      <span>Devolucion / Cambio</span>
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.25rem' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handlePrintReceipt(selectedSaleDetail, 'COPIA')}
                    style={{ padding: '0.6rem 1rem', fontSize: '0.82rem' }}
                  >
                    <Printer size={15} />
                    <span>Reimprimir Copia SAR</span>
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => handlePrintReceipt(selectedSaleDetail, 'ORIGINAL')}
                    style={{ padding: '0.6rem 1rem', fontSize: '0.82rem' }}
                  >
                    <Printer size={15} />
                    <span>Imprimir Original Cliente</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* MODAL: Void Sale */}
      {isVoidModalOpen && saleToVoid && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(3px)',
          zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '14px', width: '100%', maxWidth: '460px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden'
          }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #fee2e2', background: '#fef2f2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#dc2626', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Ban size={18} />
                Anular Factura #{saleToVoid.documentNumber}
              </h3>
              <button
                onClick={() => setIsVoidModalOpen(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.8rem', color: '#475569' }}>
                <p style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>Efectos operativos de la anulacion:</p>
                <ul style={{ margin: '0.35rem 0 0 1rem', padding: 0, lineHeight: 1.5 }}>
                  <li>El stock vendido ({saleToVoid.items?.reduce((a, b) => a + b.quantity, 0) || 0} unidades) se reintegrara al inventario vendible.</li>
                  <li>Si se cobro en efectivo y hay turno activo, se generara una SALIDA de caja de {formatCurrency(saleToVoid.total, tenant.currencySymbol)} para que el Arqueo Z cuadre con la gaveta fisica.</li>
                </ul>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.4rem' }}>
                  Motivo de Anulacion (Obligatorio)
                </label>
                <textarea
                  rows={3}
                  placeholder="Ej. Factura emitida por error de cobro / Cliente cancelo pedido..."
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsVoidModalOpen(false)}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.82rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleConfirmVoid}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.82rem', background: '#dc2626', borderColor: '#dc2626' }}
                >
                  Confirmar Anulacion
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Refund / Product Exchange */}
      {isRefundModalOpen && saleToRefund && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(3px)',
          zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '14px', width: '100%', maxWidth: '580px',
            maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#ffffff', zIndex: 10 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <RotateCcw size={18} style={{ color: '#d97706' }} />
                Devolucion o Cambio de Producto #{saleToRefund.documentNumber}
              </h3>
              <button
                onClick={() => setIsRefundModalOpen(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                  Seleccione los articulos a devolver
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {refundItemsState.map((it, idx) => (
                    <div key={idx} style={{
                      padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0',
                      background: it.selected ? '#f8fafc' : '#ffffff',
                      display: 'flex', flexDirection: 'column', gap: '0.4rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={it.selected}
                            onChange={(e) => {
                              const updated = [...refundItemsState];
                              updated[idx].selected = e.target.checked;
                              setRefundItemsState(updated);
                            }}
                          />
                          <span>{it.productName}</span>
                        </label>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>
                          {formatCurrency(it.unitPrice * it.quantity, tenant.currencySymbol)}
                        </span>
                      </div>

                      {it.selected && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', paddingLeft: '1.5rem', paddingTop: '0.25rem' }}>
                          <div>
                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Cant. a devolver (Max {it.maxQuantity}):</span>
                            <input
                              type="number"
                              min="1"
                              max={it.maxQuantity}
                              value={it.quantity}
                              onChange={(e) => {
                                const val = Math.max(1, Math.min(it.maxQuantity, parseInt(e.target.value) || 1));
                                const updated = [...refundItemsState];
                                updated[idx].quantity = val;
                                setRefundItemsState(updated);
                              }}
                              style={{ width: '100%', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                            />
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#dc2626', fontWeight: 600, cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={it.isDamaged}
                                onChange={(e) => {
                                  const updated = [...refundItemsState];
                                  updated[idx].isDamaged = e.target.checked;
                                  setRefundItemsState(updated);
                                }}
                              />
                              <span>En mal estado (Merma)</span>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Forma de Devolucion / Reembolso
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setRefundMethod('CASH')}
                    style={{
                      flex: 1, padding: '0.5rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700,
                      border: '1px solid #cbd5e1',
                      background: refundMethod === 'CASH' ? 'var(--accent-primary)' : '#f8fafc',
                      color: refundMethod === 'CASH' ? '#ffffff' : '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    Efectivo (Gaveta de Caja)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefundMethod('STORE_CREDIT')}
                    style={{
                      flex: 1, padding: '0.5rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700,
                      border: '1px solid #cbd5e1',
                      background: refundMethod === 'STORE_CREDIT' ? 'var(--accent-primary)' : '#f8fafc',
                      color: refundMethod === 'STORE_CREDIT' ? '#ffffff' : '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    Credito en Tienda / Vale de Cambio
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Motivo de la Devolucion / Cambio (Obligatorio)
                </label>
                <input
                  type="text"
                  placeholder="Ej. Producto en mal estado / Cambio por otro sabor o talla..."
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>Total a Devolver:</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#16a34a' }}>
                  {formatCurrency(
                    refundItemsState.filter(i => i.selected).reduce((acc, it) => acc + (it.unitPrice * it.quantity), 0),
                    tenant.currencySymbol
                  )}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsRefundModalOpen(false)}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.82rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleConfirmRefund}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.82rem' }}
                >
                  Procesar Devolucion
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Shift Detail Inspector (Reporte Z) */}
      {selectedShiftDetail && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)',
          zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '520px',
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            display: 'flex', flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', color: '#0f172a', fontWeight: 700, margin: 0 }}>
                  Reporte Z - Cierre de Caja Auditado
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>
                  Comercio: {tenant.name}
                </p>
              </div>
              <button
                onClick={() => setSelectedShiftDetail(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Caja Registradora / Terminal:</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{selectedShiftDetail.cajaName || 'Caja Principal'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Cajero Responsable:</span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>{selectedShiftDetail.userName || 'Cajero Principal'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Apertura Turno:</span>
                  <span>{new Date(selectedShiftDetail.openedAt).toLocaleString('es-HN')}</span>
                </div>
                {selectedShiftDetail.closedAt && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Cierre Turno:</span>
                    <span>{new Date(selectedShiftDetail.closedAt).toLocaleString('es-HN')}</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.88rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Fondo Inicial de Caja:</span>
                  <span style={{ fontWeight: 600 }}>{tenant.currencySymbol} {(selectedShiftDetail.openingAmount || 0).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Efectivo Esperado (Sistema):</span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>{tenant.currencySymbol} {(selectedShiftDetail.closingSystem || 0).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Efectivo Arqueado (Declarado):</span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>{tenant.currencySymbol} {(selectedShiftDetail.closingDeclared || 0).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px dashed #cbd5e1', fontWeight: 800 }}>
                  <span>Diferencia de Caja:</span>
                  <span style={{
                    color: (selectedShiftDetail.difference || 0) === 0 ? '#10b981' : (selectedShiftDetail.difference || 0) < 0 ? '#ef4444' : '#3b82f6'
                  }}>
                    {tenant.currencySymbol} {(selectedShiftDetail.difference || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => window.print()}
                  style={{ padding: '0.6rem 1rem', fontSize: '0.82rem' }}
                >
                  <Printer size={15} />
                  <span>Imprimir Reporte Z</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ReportsView;
