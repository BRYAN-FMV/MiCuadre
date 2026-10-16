import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  BarChart3, TrendingUp, DollarSign, FileText,
  Printer, ShoppingBag,
  Search, Filter, Eye, X, Receipt, CheckCircle, Trophy, Award, Users,
  Archive, Star, Layers, PackageX, TrendingDown, RefreshCw, Zap,
  RotateCcw, Ban, Wallet, Utensils
} from 'lucide-react';
import { Sale, Product, CartLine, Expense } from '../../types';
import { printSaleReceipt, printZReport } from '../../lib/thermalPrint';
import { formatCurrency } from '../../lib/monetary';
import {
  fetchSalesFromSupabase,
  fetchShiftsFromSupabase,
  fetchCashMovementsFromSupabase,
  fetchExpensesFromSupabase
} from '../../lib/supabaseService';
import { isSupabaseConfigured } from '../../lib/supabase';
import { toast } from 'sonner';
import { DateFilterBar } from '../common/DateFilterBar';
import { DateFilterPeriod, matchesDateFilter } from '../../lib/dateFilter';

export const ReportsView: React.FC = () => {
  const sales = useAppStore(state => state.sales);
  const products = useAppStore(state => state.products);
  const allMenuItems = useAppStore(state => state.menuItems) || [];
  const foodOrders = useAppStore(state => state.foodOrders) || [];
  const expenses = useAppStore(state => state.expenses);
  const tenant = useAppStore(state => state.tenant);
  const shiftHistory = useAppStore(state => state.shiftHistory);
  const activeShift = useAppStore(state => state.activeShift);
  const staff = useAppStore(state => state.staff);
  const profiles = useAppStore(state => state.profiles);
  const commissions = useAppStore(state => state.commissions);
  const customers = useAppStore(state => state.customers);
  const voidSale = useAppStore(state => state.voidSale);
  const refundSale = useAppStore(state => state.refundSale);

  const isDemo = tenant.id === '00000000-0000-0000-0000-000000000001';
  const menuItems = allMenuItems.filter(
    m => m.tenantId === tenant.id || (isDemo && (!m.tenantId || m.tenantId === '00000000-0000-0000-0000-000000000001'))
  );

  const [mainSubTab, setMainSubTab] = useState<'sales' | 'leaderboard' | 'inventory_capital' | 'loyalty' | 'shifts'>('sales');
  const [rankingTypeFilter, setRankingTypeFilter] = useState<'ALL' | 'PRODUCTS' | 'FOOD'>('ALL');

  // Helper to resolve rich item names for any sale (including food orders where Supabase lacks product_name)
  const getSaleDisplayItems = (sale: Sale): CartLine[] => {
    // 1. If sale already has rich names (not generic 'Artículo POS'), use them!
    const hasRealNames = sale.items && sale.items.length > 0 && sale.items.some(it => it.name && it.name !== 'Artículo POS');
    if (hasRealNames && sale.items) {
      return sale.items;
    }

    // 2. Check if linked to a food order in store
    let linkedOrder = foodOrders.find(fo => fo.saleId === sale.id);
    if (!linkedOrder && foodOrders.length > 0) {
      linkedOrder = foodOrders.find(fo =>
        Math.abs(fo.total - sale.total) < 0.01 &&
        (
          (fo.customerName && sale.customerName && fo.customerName.toLowerCase() === sale.customerName.toLowerCase()) ||
          (fo.tableNumber && sale.customerName && sale.customerName.toLowerCase().includes(fo.tableNumber.toLowerCase())) ||
          (Math.abs(new Date(fo.createdAt).getTime() - new Date(sale.createdAt).getTime()) < 1000 * 60 * 45)
        )
      );
    }

    if (linkedOrder && linkedOrder.items && linkedOrder.items.length > 0) {
      const items: CartLine[] = linkedOrder.items.map(it => {
        const notesStr = [
          ...(it.selectedExtras || []).map((e: any) => `+ ${e.name} (L. ${e.price})`),
          it.notes ? `Nota: ${it.notes}` : ''
        ].filter(Boolean).join(' | ');

        const unitP = Number(it.unitPrice || 0);
        const qty = Number(it.quantity || 1);
        const subT = Number(it.subtotal || unitP * qty);

        return {
          productId: it.productId,
          menuItemId: it.menuItemId,
          name: it.name,
          sku: it.menuItemId || it.productId || 'FOOD',
          quantity: qty,
          unitPrice: unitP,
          originalUnitPrice: unitP,
          discountAmount: 0,
          taxClassification: 'GRAVADO_15',
          subtotal: subT,
          taxAmount: 0,
          total: subT,
          notes: notesStr || undefined
        };
      });

      if (linkedOrder.deliveryFee && linkedOrder.deliveryFee > 0) {
        items.push({
          name: 'Servicio a Domicilio',
          sku: 'DELIVERY',
          quantity: 1,
          unitPrice: linkedOrder.deliveryFee,
          originalUnitPrice: linkedOrder.deliveryFee,
          discountAmount: 0,
          taxClassification: 'EXENTO',
          subtotal: linkedOrder.deliveryFee,
          taxAmount: 0,
          total: linkedOrder.deliveryFee
        });
      }

      return items;
    }

    // 3. Fallback: match by unit price with menu items or products if name is 'Artículo POS'
    if (sale.items && sale.items.length > 0) {
      return sale.items.map(it => {
        if (it.name && it.name !== 'Artículo POS') return it;
        if (it.productId) {
          const prod = products.find(p => p.id === it.productId);
          if (prod) return { ...it, name: prod.name, sku: it.sku || prod.sku };
          const menuMatch = menuItems.find(m => m.id === it.productId);
          if (menuMatch) return { ...it, name: menuMatch.name, sku: menuMatch.category || 'FOOD' };
        }
        if (it.sku) {
          const menuBySku = menuItems.find(m => m.id === it.sku);
          if (menuBySku) return { ...it, name: menuBySku.name, sku: menuBySku.category || 'FOOD' };
        }
        const matchesPrice = menuItems.filter(m => Math.abs(m.price - it.unitPrice) < 0.01);
        if (matchesPrice.length > 0) {
          return { ...it, name: matchesPrice[0].name, sku: matchesPrice[0].category || 'FOOD' };
        }
        return it;
      });
    }

    return sale.items || [];
  };

  const tenantShifts = [
    ...(activeShift && activeShift.tenantId === tenant.id && activeShift.status === 'CLOSED' ? [activeShift] : []),
    ...(shiftHistory || []).filter(s => s.tenantId === tenant.id)
  ].filter((shift, index, self) => self.findIndex(s => s.id === shift.id) === index);

  // Filter States
  const [dateFilter, setDateFilter] = useState<DateFilterPeriod>('TODAY');
  const [customDate, setCustomDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'CASH' | 'CARD' | 'TRANSFER' | 'MIXED' | 'CREDIT'>('ALL');
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
    const displayItems = getSaleDisplayItems(sale);
    setRefundItemsState(
      displayItems.map(it => ({
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
            const localSalesMap = new Map((state.sales || []).map(s => [s.id, s]));
            const mergedLiveSales = liveSales.map(ls => {
              const local = localSalesMap.get(ls.id);
              if (local && local.items && local.items.length > 0) {
                const hasLocalRealNames = local.items.some(i => i.name && i.name !== 'Artículo POS');
                const liveHasOnlyGeneric = !ls.items || ls.items.every(i => !i.name || i.name === 'Artículo POS');
                if (hasLocalRealNames && liveHasOnlyGeneric) {
                  return {
                    ...ls,
                    items: local.items
                  };
                }
              }
              return ls;
            });
            const liveIds = new Set(liveSales.map(ls => ls.id));
            const localOnly = (state.sales || []).filter(s => !liveIds.has(s.id));
            return { sales: [...mergedLiveSales, ...localOnly] };
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

  // Date range helper shared across Sales, Expenses & Reports
  const matchesSelectedDatePeriod = (isoDateStr: string) => {
    return matchesDateFilter(isoDateStr, dateFilter, customDate);
  };

  // Filter Sales based on Selected Time Period & Search & Filters & Tenant ID
  const getFilteredSales = () => {
    const tenantSales = (sales || []).filter((s: Sale) => s.tenantId === tenant.id);

    return tenantSales.filter(s => {
      const matchesDate = matchesSelectedDatePeriod(s.createdAt);

      const query = searchTerm.trim().toLowerCase();
      let matchesSearch = true;
      if (query) {
        const matchDoc = s.documentNumber.toLowerCase().includes(query);
        const matchName = s.customerName.toLowerCase().includes(query);
        const matchRtn = s.customerRtn ? s.customerRtn.toLowerCase().includes(query) : false;
        const displayItems = getSaleDisplayItems(s);
        const matchItems = displayItems.some(i => i.name.toLowerCase().includes(query) || (i.sku && i.sku.toLowerCase().includes(query)));
        matchesSearch = matchDoc || matchName || matchRtn || matchItems;
      }

      let matchesPayment = true;
      if (paymentFilter !== 'ALL') {
        matchesPayment = s.paymentMethod === paymentFilter;
      }

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

  // Separate valid sales from voided/refunded so owner's net numbers are never artificially inflated
  const validSales = filteredSales.filter(s => s.status !== 'VOIDED' && s.status !== 'REFUNDED');
  const cancelledOrRefundedCount = filteredSales.length - validSales.length;

  // Filter operational expenses for the same period
  const filteredExpenses = (expenses || []).filter(
    (e: Expense) => e.tenantId === tenant.id && matchesSelectedDatePeriod(e.createdAt || e.expenseDate)
  );
  const totalExpensesPeriod = filteredExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);

  // Filter shift closures for the same period and selected caja
  const filteredTenantShifts = tenantShifts.filter((shift: any) => {
    const shiftDate = shift.closedAt || shift.openedAt || shift.createdAt;
    const matchesDate = matchesSelectedDatePeriod(shiftDate);
    const matchesCaja = selectedCajaFilter === 'ALL' || (shift.cajaName || 'Caja Principal') === selectedCajaFilter;
    return matchesDate && matchesCaja;
  });

  // Financial Metric Calculations (strictly on validSales)
  const totalSalesAmount = validSales.reduce((acc, s) => acc + s.total, 0);
  const totalSubtotal = validSales.reduce((acc, s) => acc + s.subtotal, 0);
  const totalTax15 = validSales.reduce((acc, s) => acc + (s.tax15 || 0), 0);
  const totalTax18 = validSales.reduce((acc, s) => acc + (s.tax18 || 0), 0);
  const totalTax = totalTax15 + totalTax18;
  const avgTicket = validSales.length > 0 ? totalSalesAmount / validSales.length : 0;

  // Calculate COGS and Gross Profit (accounting for package presentations & discounts)
  let estimatedCOGS = 0;
  let totalDiscounts = 0;
  validSales.forEach(s => {
    totalDiscounts += (s.discountAmount || 0) + (s.loyaltyDiscountAmount || 0);
    const saleItems = getSaleDisplayItems(s);
    saleItems.forEach(line => {
      if (line.productId) {
        const prod = products.find(p => p.id === line.productId);
        if (prod) {
          const unitsMultiplier = line.unitsPerPackage && line.unitsPerPackage > 1 ? line.unitsPerPackage : 1;
          estimatedCOGS += prod.costPrice * line.quantity * unitsMultiplier;
        }
      }
    });
  });

  // In fiscal businesses with collected ISV, tax is owed to SAR and not part of net sales revenue (base = subtotal minus discounts).
  // In non-fiscal businesses (or with 0 tax), all sales revenue minus discounts is part of business income.
  const isFiscalWithTax = Boolean(tenant.isFiscalEnabled && totalTax > 0);
  const netSalesBase = isFiscalWithTax
    ? Math.max(0, totalSubtotal - totalDiscounts)
    : Math.max(0, totalSalesAmount - totalDiscounts);
  const grossProfit = netSalesBase - estimatedCOGS;
  const netProfit = grossProfit - totalExpensesPeriod;
  const grossMarginPct = netSalesBase > 0 ? (grossProfit / netSalesBase) * 100 : 0;
  const netMarginPct = totalSalesAmount > 0 ? (netProfit / totalSalesAmount) * 100 : 0;

  // Payment Method Breakdown (on validSales)
  const paymentMethods = {
    CASH: validSales.filter(s => s.paymentMethod === 'CASH').reduce((acc, s) => acc + s.total, 0),
    CARD: validSales.filter(s => s.paymentMethod === 'CARD').reduce((acc, s) => acc + s.total, 0),
    TRANSFER: validSales.filter(s => s.paymentMethod === 'TRANSFER').reduce((acc, s) => acc + s.total, 0),
    MIXED: validSales.filter(s => s.paymentMethod === 'MIXED').reduce((acc, s) => acc + s.total, 0),
    CREDIT: validSales.filter(s => s.paymentMethod === 'CREDIT').reduce((acc, s) => acc + s.total, 0),
  };

  // Top Selling Items Calculation (Products + Kitchen Menu Items) on validSales
  interface SoldItemRecord {
    id: string;
    name: string;
    type: 'PRODUCT' | 'MENU_ITEM';
    category: string;
    quantity: number;
    revenue: number;
    cogs: number;
    unitOfMeasure: string;
  }

  const soldItemsMap: Record<string, SoldItemRecord> = {};

  validSales.forEach(s => {
    const saleItems = getSaleDisplayItems(s);
    saleItems.forEach(line => {
      // Ignore delivery fees in products ranking
      if (line.sku === 'DELIVERY' || line.name === 'Servicio a Domicilio') {
        return;
      }

      // Check if it's a food / menu item
      const isFoodItem = Boolean(
        line.menuItemId ||
        line.sku === 'FOOD' ||
        menuItems.some(m => m.id === line.productId || m.id === line.menuItemId || m.name.toLowerCase() === line.name.toLowerCase())
      );

      if (isFoodItem) {
        const matchedMenu = menuItems.find(
          m => m.id === line.menuItemId || m.id === line.productId || m.name.toLowerCase() === line.name.toLowerCase()
        );
        const itemKey = `menu_${matchedMenu?.id || line.menuItemId || line.name}`;
        if (!soldItemsMap[itemKey]) {
          soldItemsMap[itemKey] = {
            id: itemKey,
            name: matchedMenu?.name || line.name,
            type: 'MENU_ITEM',
            category: matchedMenu?.category || 'Menú / Cocina',
            quantity: 0,
            revenue: 0,
            cogs: 0,
            unitOfMeasure: 'platos'
          };
        }
        soldItemsMap[itemKey].quantity += line.quantity;
        soldItemsMap[itemKey].revenue += line.total;
      } else if (line.productId) {
        const prod = products.find(p => p.id === line.productId);
        if (prod) {
          const itemKey = `prod_${prod.id}`;
          if (!soldItemsMap[itemKey]) {
            soldItemsMap[itemKey] = {
              id: itemKey,
              name: prod.name,
              type: 'PRODUCT',
              category: prod.category || 'Inventario',
              quantity: 0,
              revenue: 0,
              cogs: 0,
              unitOfMeasure: prod.unitOfMeasure || 'unid.'
            };
          }
          const unitsMultiplier = line.unitsPerPackage && line.unitsPerPackage > 1 ? line.unitsPerPackage : 1;
          soldItemsMap[itemKey].quantity += line.quantity * unitsMultiplier;
          soldItemsMap[itemKey].revenue += line.total;
          soldItemsMap[itemKey].cogs += prod.costPrice * line.quantity * unitsMultiplier;
        }
      } else {
        // Unlinked general item
        const itemKey = `misc_${line.name}`;
        if (!soldItemsMap[itemKey]) {
          soldItemsMap[itemKey] = {
            id: itemKey,
            name: line.name,
            type: 'PRODUCT',
            category: 'General',
            quantity: 0,
            revenue: 0,
            cogs: 0,
            unitOfMeasure: 'unid.'
          };
        }
        soldItemsMap[itemKey].quantity += line.quantity;
        soldItemsMap[itemKey].revenue += line.total;
      }
    });
  });

  const allSoldItemsList = Object.values(soldItemsMap);
  const foodSoldItemsList = allSoldItemsList.filter(it => it.type === 'MENU_ITEM');
  const totalFoodPlatesSold = foodSoldItemsList.reduce((acc, it) => acc + it.quantity, 0);
  const totalFoodRevenue = foodSoldItemsList.reduce((acc, it) => acc + it.revenue, 0);

  const topSoldItems = allSoldItemsList
    .filter(it => {
      if (rankingTypeFilter === 'PRODUCTS') return it.type === 'PRODUCT';
      if (rankingTypeFilter === 'FOOD') return it.type === 'MENU_ITEM';
      return true;
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 7);

  // Inventory Health Metric Calculations
  const tenantProductsList = products.filter(p => p.tenantId === tenant.id);
  const lowStockCount = tenantProductsList.filter(p => p.isActive && p.currentStock <= p.minStockAlert).length;

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

  validSales.forEach(s => {
    const saleHour = new Date(s.createdAt).getHours();
    const targetBucket = hourlyBuckets.find(b => saleHour >= b.minHour && saleHour <= b.maxHour);
    if (targetBucket) {
      targetBucket.amount += s.total;
      targetBucket.count += 1;
    }
  });

  const maxBucketAmount = Math.max(...hourlyBuckets.map(b => b.amount), 1);
  const peakBucket = [...hourlyBuckets].sort((a, b) => b.amount - a.amount)[0];

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

  validSales.forEach(s => {
    getSaleDisplayItems(s).forEach(item => {
      let staffId = item.staffId || '';
      let staffName = item.staffName || '';

      if (!staffId && !staffName) {
        staffId = 'caja-general';
        staffName = s.userName || 'Venta General / Caja';
      } else if (!staffName) {
        const foundStaff = tenantStaffList.find(st => st.id === staffId);
        const foundProfile = tenantProfilesList.find(pr => pr.id === staffId);
        staffName = foundStaff?.fullName || foundProfile?.fullName || 'Colaborador';
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

  // --- DASHBOARD 2: DINERO EN MERCADERÍA & PRODUCTOS ESTANCADOS ---
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
    const soldQty = soldItemsMap['prod_' + p.id]?.quantity || 0;
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

  // --- DASHBOARD 3: CLIENTES FRECUENTES ---
  const tenantCustomersList = customers.filter(c => c.tenantId === tenant.id);
  const registeredCustomerSales = validSales.filter(s => s.customerId && s.customerName !== 'Consumidor Final');
  const finalConsumerSales = validSales.filter(s => !s.customerId || s.customerName === 'Consumidor Final');

  const registeredSalesAmount = registeredCustomerSales.reduce((acc, s) => acc + s.total, 0);
  const finalConsumerSalesAmount = finalConsumerSales.reduce((acc, s) => acc + s.total, 0);
  const retentionPercentage = validSales.length > 0
    ? Math.round((registeredCustomerSales.length / validSales.length) * 100)
    : 0;

  const totalPointsEarnedPeriod = validSales.reduce((acc, s) => acc + (s.loyaltyPointsEarned || 0), 0);
  const totalPointsRedeemedPeriod = validSales.reduce((acc, s) => acc + (s.loyaltyPointsRedeemed || 0), 0);
  const totalLoyaltyDiscountGiven = validSales.reduce((acc, s) => acc + (s.loyaltyDiscountAmount || 0), 0);
  const topLoyalCustomers = [...tenantCustomersList].sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0)).slice(0, 10);

  // Thermal Print Handler
  const handlePrintReceipt = (sale: Sale, copyType: 'ORIGINAL' | 'COPIA') => {
    try {
      const enrichedSale: Sale = {
        ...sale,
        items: getSaleDisplayItems(sale)
      };
      printSaleReceipt(enrichedSale, tenant, copyType);
    } catch (err) {
      console.warn('Error al imprimir recibo:', err);
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
        if (liveSales) {
          liveSales.forEach(ls => {
            const existing = salesMap.get(ls.id);
            if (existing && existing.items && existing.items.length > 0) {
              const hasLocalRealNames = existing.items.some(i => i.name && i.name !== 'Artículo POS');
              const liveHasOnlyGeneric = !ls.items || ls.items.every(i => !i.name || i.name === 'Artículo POS');
              if (hasLocalRealNames && liveHasOnlyGeneric) {
                salesMap.set(ls.id, { ...ls, items: existing.items });
                return;
              }
            }
            salesMap.set(ls.id, ls);
          });
        }

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

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'CASH': return 'Efectivo';
      case 'CARD': return 'Tarjeta';
      case 'TRANSFER': return 'Transferencia';
      case 'CREDIT': return 'Al Crédito';
      case 'MIXED': return 'Pago Mixto';
      default: return method;
    }
  };

  return (
    <div className="reports-view-container" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1440px', margin: '0 auto' }}>

      {/* Header Banner */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: '#ffffff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: '14px', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
          <div style={{ background: '#ecfdf5', padding: '0.75rem', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
            <BarChart3 size={26} style={{ color: '#059669' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: '#0f172a', letterSpacing: '-0.01em' }}>
              Reportes & Inteligencia Comercial
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.2rem 0 0 0', fontWeight: 500 }}>
              Resumen claro de entradas, costos, gastos y ganancia real de {tenant.name}
            </p>
          </div>
        </div>

        {/* Global SubTab & Controls Header */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', minWidth: 0, maxWidth: '100%' }}>
          <div className="subtab-nav-container" style={{ display: 'flex', gap: '0.3rem', background: '#f1f5f9', padding: '4px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <button
              className="btn"
              onClick={() => setMainSubTab('sales')}
              style={{
                padding: '0.45rem 0.9rem',
                fontSize: '0.82rem',
                background: mainSubTab === 'sales' ? '#0f172a' : 'transparent',
                color: mainSubTab === 'sales' ? '#ffffff' : '#475569',
                fontWeight: mainSubTab === 'sales' ? 700 : 600,
                borderRadius: '7px',
                boxShadow: mainSubTab === 'sales' ? '0 1px 2px rgba(0,0,0,0.15)' : 'none'
              }}
            >
              Resumen & Ventas
            </button>
            <button
              className="btn"
              onClick={() => setMainSubTab('inventory_capital')}
              style={{
                padding: '0.45rem 0.9rem',
                fontSize: '0.82rem',
                background: mainSubTab === 'inventory_capital' ? '#0f172a' : 'transparent',
                color: mainSubTab === 'inventory_capital' ? '#ffffff' : '#475569',
                fontWeight: mainSubTab === 'inventory_capital' ? 700 : 600,
                borderRadius: '7px',
                boxShadow: mainSubTab === 'inventory_capital' ? '0 1px 2px rgba(0,0,0,0.15)' : 'none'
              }}
            >
              Mercadería & Stock
            </button>
            <button
              className="btn"
              onClick={() => setMainSubTab('shifts')}
              style={{
                padding: '0.45rem 0.9rem',
                fontSize: '0.82rem',
                background: mainSubTab === 'shifts' ? '#0f172a' : 'transparent',
                color: mainSubTab === 'shifts' ? '#ffffff' : '#475569',
                fontWeight: mainSubTab === 'shifts' ? 700 : 600,
                borderRadius: '7px',
                boxShadow: mainSubTab === 'shifts' ? '0 1px 2px rgba(0,0,0,0.15)' : 'none'
              }}
            >
              Cierres de Caja ({tenantShifts.length})
            </button>
            <button
              className="btn"
              onClick={() => setMainSubTab('leaderboard')}
              style={{
                padding: '0.45rem 0.9rem',
                fontSize: '0.82rem',
                background: mainSubTab === 'leaderboard' ? '#0f172a' : 'transparent',
                color: mainSubTab === 'leaderboard' ? '#ffffff' : '#475569',
                fontWeight: mainSubTab === 'leaderboard' ? 700 : 600,
                borderRadius: '7px',
                boxShadow: mainSubTab === 'leaderboard' ? '0 1px 2px rgba(0,0,0,0.15)' : 'none'
              }}
            >
              Equipo & Comisiones
            </button>
            <button
              className="btn"
              onClick={() => setMainSubTab('loyalty')}
              style={{
                padding: '0.45rem 0.9rem',
                fontSize: '0.82rem',
                background: mainSubTab === 'loyalty' ? '#0f172a' : 'transparent',
                color: mainSubTab === 'loyalty' ? '#ffffff' : '#475569',
                fontWeight: mainSubTab === 'loyalty' ? 700 : 600,
                borderRadius: '7px',
                boxShadow: mainSubTab === 'loyalty' ? '0 1px 2px rgba(0,0,0,0.15)' : 'none'
              }}
            >
              Clientes Frecuentes
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <button
              className="btn btn-secondary"
              onClick={handleSyncCloudData}
              title="Sincronizar ventas y movimientos desde otros dispositivos"
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.82rem', background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', fontWeight: 600 }}
            >
              <RefreshCw size={15} />
              <span>Refrescar</span>
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => window.print()}
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.82rem', background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', fontWeight: 600 }}
            >
              <Printer size={15} />
              <span>Imprimir</span>
            </button>
          </div>
        </div>
      </div>

      {/* Date Filter Bar for Period-Based Views */}
      {(mainSubTab === 'sales' || mainSubTab === 'leaderboard' || mainSubTab === 'loyalty' || mainSubTab === 'shifts') && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <DateFilterBar
            value={dateFilter}
            onChange={setDateFilter}
            customDate={customDate}
            onCustomDateChange={setCustomDate}
          />

          {cancelledOrRefundedCount > 0 && mainSubTab === 'sales' && (
            <span style={{ fontSize: '0.78rem', color: '#64748b', background: '#f8fafc', padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontWeight: 500 }}>
              Nota: {cancelledOrRefundedCount} {cancelledOrRefundedCount === 1 ? 'venta anulada/devuelta no suma' : 'ventas anuladas/devueltas no suman'} a la ganancia
            </span>
          )}
        </div>
      )}

      {/* --- SUBTAB 1: RESUMEN DE FLUJO & VENTAS --- */}
      {mainSubTab === 'sales' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* 4-Card Owner Cash-Flow Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.25rem' }}>

            {/* Card 1: Dinero que Entró */}
            <div className="glass-panel" style={{ padding: '1.35rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.85rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 700 }}>
                    1. Dinero que Entró {isFiscalWithTax ? '(Ventas Totales)' : '(Ventas Netas)'}
                  </span>
                  <span className="badge" style={{ background: '#ecfdf5', color: '#059669', fontSize: '0.7rem', fontWeight: 700 }}>
                    {validSales.length} {validSales.length === 1 ? 'venta' : 'ventas'}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.7rem', fontWeight: 800, marginTop: '0.4rem', marginBottom: '0.15rem', color: '#0f172a', letterSpacing: '-0.02em' }}>
                  {formatCurrency(totalSalesAmount, tenant.currencySymbol)}
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>
                  Promedio por compra: <strong style={{ color: '#334155' }}>{formatCurrency(avgTicket, tenant.currencySymbol)}</strong>
                </p>
                {isFiscalWithTax && (
                  <p style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.35rem', marginBottom: 0 }}>
                    Base imponible (sin ISV): <strong style={{ color: '#0f172a' }}>{formatCurrency(netSalesBase, tenant.currencySymbol)}</strong> | ISV Fisco: <strong style={{ color: '#dc2626' }}>{formatCurrency(totalTax, tenant.currencySymbol)}</strong>
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', fontSize: '0.74rem' }}>
                <span style={{ background: '#f8fafc', color: '#334155', padding: '0.2rem 0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontWeight: 600 }}>
                  Efectivo: {formatCurrency(paymentMethods.CASH, tenant.currencySymbol)}
                </span>
                {(paymentMethods.CARD + paymentMethods.TRANSFER + paymentMethods.MIXED) > 0 && (
                  <span style={{ background: '#f8fafc', color: '#334155', padding: '0.2rem 0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontWeight: 600 }}>
                    Banco/Tarjeta: {formatCurrency(paymentMethods.CARD + paymentMethods.TRANSFER + paymentMethods.MIXED, tenant.currencySymbol)}
                  </span>
                )}
                {paymentMethods.CREDIT > 0 && (
                  <span style={{ background: '#fffbeb', color: '#b45309', padding: '0.2rem 0.5rem', borderRadius: '6px', border: '1px solid #fde68a', fontWeight: 600 }}>
                    Fiado: {formatCurrency(paymentMethods.CREDIT, tenant.currencySymbol)}
                  </span>
                )}
                {tenant.isFoodEnabled && totalFoodPlatesSold > 0 && (
                  <span style={{ background: '#fff7ed', color: '#c2410c', padding: '0.2rem 0.5rem', borderRadius: '6px', border: '1px solid #fed7aa', fontWeight: 700 }}>
                    Cocina: {totalFoodPlatesSold} {totalFoodPlatesSold === 1 ? 'plato' : 'platos'} ({formatCurrency(totalFoodRevenue, tenant.currencySymbol)})
                  </span>
                )}
              </div>
            </div>

            {/* Card 2: Costo de la Mercadería Vendida */}
            <div className="glass-panel" style={{ padding: '1.35rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.85rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 700 }}>2. Costo de la Mercadería</span>
                  <span className="badge" style={{ background: '#f1f5f9', color: '#475569', fontSize: '0.7rem', fontWeight: 700 }}>
                    Reposición
                  </span>
                </div>
                <h3 style={{ fontSize: '1.7rem', fontWeight: 800, marginTop: '0.4rem', marginBottom: '0.15rem', color: '#334155', letterSpacing: '-0.02em' }}>
                  {formatCurrency(estimatedCOGS, tenant.currencySymbol)}
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>
                  Lo que costó comprar los productos vendidos
                </p>
              </div>

              <div style={{ paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                <span style={{ color: '#64748b' }}>Ganancia bruta en ventas:</span>
                <strong style={{ color: '#0f172a' }}>{formatCurrency(grossProfit, tenant.currencySymbol)} ({grossMarginPct.toFixed(0)}%)</strong>
              </div>
            </div>

            {/* Card 3: Gastos del Negocio */}
            <div className="glass-panel" style={{ padding: '1.35rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.85rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 700 }}>3. Gastos del Negocio</span>
                  <span className="badge" style={{ background: '#fef2f2', color: '#dc2626', fontSize: '0.7rem', fontWeight: 700 }}>
                    {filteredExpenses.length} {filteredExpenses.length === 1 ? 'registro' : 'registros'}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.7rem', fontWeight: 800, marginTop: '0.4rem', marginBottom: '0.15rem', color: totalExpensesPeriod > 0 ? '#e11d48' : '#334155', letterSpacing: '-0.02em' }}>
                  {formatCurrency(totalExpensesPeriod, tenant.currencySymbol)}
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>
                  Salidas por recibos, transporte, limpieza u otros
                </p>
              </div>

              <div style={{ paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem', color: '#64748b' }}>
                {tenant.isFiscalEnabled ? (
                  <>
                    <span>ISV recaudado (15% / 18%):</span>
                    <strong style={{ color: '#334155' }}>{formatCurrency(totalTax, tenant.currencySymbol)}</strong>
                  </>
                ) : (
                  <>
                    <span>Alertas de stock bajo:</span>
                    <strong style={{ color: lowStockCount > 0 ? '#d97706' : '#059669' }}>
                      {lowStockCount > 0 ? `${lowStockCount} productos por pedir` : 'Inventario al día'}
                    </strong>
                  </>
                )}
              </div>
            </div>

            {/* Card 4: Ganancia Libre Estimada */}
            <div className="glass-panel" style={{
              padding: '1.35rem',
              background: netProfit >= 0 ? '#f0fdf4' : '#fef2f2',
              border: netProfit >= 0 ? '1px solid #86efac' : '1px solid #fecaca',
              borderRadius: '14px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '0.85rem'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: netProfit >= 0 ? '#166534' : '#991b1b', fontWeight: 800 }}>
                    4. Ganancia Libre Estimada
                  </span>
                  <span className="badge" style={{
                    background: netProfit >= 0 ? '#dcfce7' : '#fee2e2',
                    color: netProfit >= 0 ? '#15803d' : '#b91c1c',
                    fontSize: '0.7rem',
                    fontWeight: 800
                  }}>
                    {netMarginPct.toFixed(1)}% libre
                  </span>
                </div>
                <h3 style={{ fontSize: '1.75rem', fontWeight: 900, marginTop: '0.4rem', marginBottom: '0.15rem', color: netProfit >= 0 ? '#15803d' : '#dc2626', letterSpacing: '-0.02em' }}>
                  {formatCurrency(netProfit, tenant.currencySymbol)}
                </h3>
                <p style={{ fontSize: '0.78rem', color: netProfit >= 0 ? '#166534' : '#991b1b', margin: 0, opacity: 0.9 }}>
                  {isFiscalWithTax
                    ? 'Lo que queda libre tras costo de mercadería, gastos e ISV fiscal'
                    : 'Lo que queda libre tras costo de mercadería y gastos'}
                </p>
              </div>

              <div style={{ paddingTop: '0.75rem', borderTop: netProfit >= 0 ? '1px solid #bbf7d0' : '1px solid #fecaca', fontSize: '0.74rem', color: netProfit >= 0 ? '#166534' : '#991b1b', fontWeight: 600 }}>
                {isFiscalWithTax
                  ? `Base sin ISV (${formatCurrency(netSalesBase, tenant.currencySymbol)}) − Costo (${formatCurrency(estimatedCOGS, tenant.currencySymbol)}) − Gastos (${formatCurrency(totalExpensesPeriod, tenant.currencySymbol)})`
                  : `Ventas (${formatCurrency(totalSalesAmount, tenant.currencySymbol)}) − Costo (${formatCurrency(estimatedCOGS, tenant.currencySymbol)}) − Gastos (${formatCurrency(totalExpensesPeriod, tenant.currencySymbol)})`}
              </div>
            </div>

          </div>

          {/* 2-Column Insights: Top Selling Products + Peak Hours */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.25rem' }}>

            {/* Left: Top 5 Products */}
            <div className="glass-panel" style={{ padding: '1.35rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', color: '#0f172a', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShoppingBag size={18} style={{ color: '#059669' }} />
                    Lo que Más se Vende
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>
                    {tenant.isFoodEnabled
                      ? 'Artículos con mayores ingresos en el período (inventario y platos del menú)'
                      : 'Productos que generan más ingresos y ganancia en este período'}
                  </p>
                </div>

                {tenant.isFoodEnabled && (
                  <div style={{ display: 'flex', gap: '0.25rem', background: '#f1f5f9', padding: '0.2rem', borderRadius: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setRankingTypeFilter('ALL')}
                      style={{
                        padding: '0.25rem 0.55rem',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        border: 'none',
                        borderRadius: '6px',
                        background: rankingTypeFilter === 'ALL' ? '#ffffff' : 'transparent',
                        color: rankingTypeFilter === 'ALL' ? '#0f172a' : '#64748b',
                        boxShadow: rankingTypeFilter === 'ALL' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                        cursor: 'pointer'
                      }}
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => setRankingTypeFilter('PRODUCTS')}
                      style={{
                        padding: '0.25rem 0.55rem',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        border: 'none',
                        borderRadius: '6px',
                        background: rankingTypeFilter === 'PRODUCTS' ? '#ffffff' : 'transparent',
                        color: rankingTypeFilter === 'PRODUCTS' ? '#0f172a' : '#64748b',
                        boxShadow: rankingTypeFilter === 'PRODUCTS' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                        cursor: 'pointer'
                      }}
                    >
                      Mercadería
                    </button>
                    <button
                      type="button"
                      onClick={() => setRankingTypeFilter('FOOD')}
                      style={{
                        padding: '0.25rem 0.55rem',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        border: 'none',
                        borderRadius: '6px',
                        background: rankingTypeFilter === 'FOOD' ? '#ffffff' : 'transparent',
                        color: rankingTypeFilter === 'FOOD' ? '#ea580c' : '#64748b',
                        boxShadow: rankingTypeFilter === 'FOOD' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                        cursor: 'pointer'
                      }}
                    >
                      Platos ({foodSoldItemsList.length})
                    </button>
                  </div>
                )}
              </div>

              {topSoldItems.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                  Aún no hay artículos vendidos en este período.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {topSoldItems.map((item, idx) => {
                    const itemProfit = item.revenue - item.cogs;
                    return (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                          <span style={{ width: '24px', height: '24px', borderRadius: '6px', background: idx === 0 ? '#059669' : '#e2e8f0', color: idx === 0 ? '#ffffff' : '#475569', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0 }}>
                            {idx + 1}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {item.name}
                              </span>
                              {item.type === 'MENU_ITEM' ? (
                                <span style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', fontSize: '0.65rem', fontWeight: 800, padding: '0.1rem 0.35rem', borderRadius: '4px', flexShrink: 0 }}>
                                  Plato
                                </span>
                              ) : (
                                <span style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '4px', flexShrink: 0 }}>
                                  Inventario
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                              {item.quantity} {item.unitOfMeasure} {item.type === 'MENU_ITEM' ? 'servidos' : 'vendidas'} {item.category ? `• ${item.category}` : ''}
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.86rem' }}>
                            {formatCurrency(item.revenue, tenant.currencySymbol)}
                          </div>
                          {item.type === 'PRODUCT' && item.cogs > 0 ? (
                            <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>
                              Deja: {formatCurrency(itemProfit, tenant.currencySymbol)}
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                              {item.type === 'MENU_ITEM' ? 'Cocina' : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Peak Sales Hours */}
            <div className="glass-panel" style={{ padding: '1.35rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', color: '#0f172a', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <TrendingUp size={18} style={{ color: '#059669' }} />
                    Horas de Mayor Movimiento
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>
                    Horarios con más ventas para reforzar la atención en caja
                  </p>
                </div>

                <span className="badge" style={{ background: '#ecfdf5', color: '#059669', padding: '0.35rem 0.65rem', fontSize: '0.75rem', fontWeight: 700 }}>
                  Hora Pico: {peakBucket.amount > 0 ? `${peakBucket.label} (${formatCurrency(peakBucket.amount, tenant.currencySymbol)})` : 'Sin ventas aún'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.65rem', height: '160px', paddingTop: '1.25rem', borderBottom: '1px solid #e2e8f0', overflowX: 'auto' }}>
                {hourlyBuckets.map((b) => {
                  const heightPct = maxBucketAmount > 0 ? Math.max(10, (b.amount / maxBucketAmount) * 100) : 10;
                  const isPeak = b.label === peakBucket.label && b.amount > 0;
                  return (
                    <div key={b.label} style={{ flex: 1, minWidth: '42px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: isPeak ? '#059669' : '#64748b' }}>
                        {b.amount > 0 ? `${tenant.currencySymbol}${b.amount >= 1000 ? `${(b.amount / 1000).toFixed(1)}k` : b.amount.toFixed(0)}` : '0'}
                      </span>

                      <div style={{ width: '100%', height: '110px', display: 'flex', alignItems: 'flex-end' }}>
                        <div
                          title={`${b.label}: ${formatCurrency(b.amount, tenant.currencySymbol)} (${b.count} ventas)`}
                          style={{
                            width: '100%',
                            height: `${heightPct}%`,
                            background: isPeak ? '#059669' : '#cbd5e1',
                            borderRadius: '6px 6px 0 0',
                            transition: 'height 0.3s ease'
                          }}
                        />
                      </div>

                      <span style={{ fontSize: '0.74rem', fontWeight: isPeak ? 700 : 500, color: isPeak ? '#0f172a' : '#64748b', paddingBottom: '0.35rem' }}>
                        {b.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Unified Sales History Table (Single Clean Filter Bar) */}
          <div className="glass-panel" style={{ padding: '1.35rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', color: '#0f172a', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Receipt size={19} style={{ color: '#059669' }} />
                  Listado de Ventas Realizadas ({filteredSales.length})
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>
                  Consulta cada recibo, reimprime comprobantes o registra cambios y devoluciones
                </p>
              </div>

              {/* Single Unified Filter Toolbar */}
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ minWidth: '240px', position: 'relative' }}>
                  <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Buscar recibo, cliente o producto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ paddingLeft: '2.1rem', fontSize: '0.82rem', height: '36px' }}
                  />
                </div>

                <select
                  className="form-control"
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value as any)}
                  style={{ fontSize: '0.82rem', width: 'auto', height: '36px' }}
                >
                  <option value="ALL">Pago: Todos</option>
                  <option value="CASH">Efectivo</option>
                  <option value="CARD">Tarjeta</option>
                  <option value="TRANSFER">Transferencia</option>
                  <option value="CREDIT">Al Crédito</option>
                  <option value="MIXED">Mixto</option>
                </select>

                {tenant.isFiscalEnabled && (
                  <select
                    className="form-control"
                    value={docTypeFilter}
                    onChange={(e) => setDocTypeFilter(e.target.value as any)}
                    style={{ fontSize: '0.82rem', width: 'auto', height: '36px' }}
                  >
                    <option value="ALL">Comprobante: Todos</option>
                    <option value="FISCAL">Factura SAR</option>
                    <option value="TICKET">Ticket Interno</option>
                  </select>
                )}

                {(searchTerm || docTypeFilter !== 'ALL' || paymentFilter !== 'ALL') && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setSearchTerm('');
                      setDocTypeFilter('ALL');
                      setPaymentFilter('ALL');
                    }}
                    style={{ padding: '0.4rem 0.7rem', fontSize: '0.78rem', height: '36px' }}
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
                    <th style={{ padding: '0.75rem 1rem' }}>Caja</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Cliente</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Artículos</th>
                    {tenant.isFiscalEnabled && <th style={{ padding: '0.75rem 1rem' }}>ISV</th>}
                    <th style={{ padding: '0.75rem 1rem' }}>Total</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Forma de Pago</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={tenant.isFiscalEnabled ? 9 : 8} style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                        No se encontraron ventas con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((s: Sale) => {
                      const displayItems = getSaleDisplayItems(s);
                      const itemCount = displayItems.reduce((acc, item) => acc + item.quantity, 0);
                      const totalTaxSale = (s.tax15 || 0) + (s.tax18 || 0);
                      const isFiscalDoc = Boolean(s.isFiscal || s.cai);
                      const isInactiveSale = s.status === 'VOIDED' || s.status === 'REFUNDED';

                      return (
                        <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9', opacity: isInactiveSale ? 0.72 : 1 }}>
                          <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace' }}>
                            <code>{s.documentNumber}</code>
                            {s.status === 'VOIDED' ? (
                              <div style={{ fontSize: '0.68rem', color: '#dc2626', fontWeight: 800 }}>ANULADA</div>
                            ) : s.status === 'REFUNDED' ? (
                              <div style={{ fontSize: '0.68rem', color: '#d97706', fontWeight: 800 }}>DEVUELTA</div>
                            ) : isFiscalDoc ? (
                              <div style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 600 }}>Factura SAR</div>
                            ) : null}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#475569', fontSize: '0.8rem' }}>
                            {new Date(s.createdAt).toLocaleString('es-HN', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span className="badge badge-wholesale" style={{ fontSize: '0.74rem' }}>
                              {s.cajaName || 'Caja 1'}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>
                            {s.customerName}
                            {s.customerRtn && <div style={{ fontSize: '0.72rem', color: '#64748b' }}>RTN: {s.customerRtn}</div>}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>
                              {itemCount} {itemCount === 1 ? 'artículo' : 'artículos'}
                            </span>
                          </td>
                          {tenant.isFiscalEnabled && (
                            <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                              {formatCurrency(totalTaxSale, tenant.currencySymbol)}
                            </td>
                          )}
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: isInactiveSale ? '#64748b' : '#059669', textDecoration: s.status === 'VOIDED' ? 'line-through' : 'none' }}>
                            {formatCurrency(s.total, tenant.currencySymbol)}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span className={`badge ${s.paymentMethod === 'CASH' ? 'badge-success' : 'badge-wholesale'}`}>
                              {getPaymentMethodLabel(s.paymentMethod)}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                              <button
                                title="Ver Detalle de Venta"
                                className="btn btn-secondary"
                                onClick={() => setSelectedSaleDetail(s)}
                                style={{ padding: '0.35rem 0.6rem', fontSize: '0.78rem' }}
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
        </div>
      )}

      {/* --- SUBTAB 2: EQUIPO & COMISIONES --- */}
      {mainSubTab === 'leaderboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.25rem' }}>
            <div className="glass-panel" style={{ padding: '1.35rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 700 }}>Mayor Vendedor del Período</span>
                <Trophy size={18} style={{ color: '#d97706' }} />
              </div>
              <h3 style={{ fontSize: '1.45rem', fontWeight: 800, marginTop: '0.4rem', color: '#0f172a' }}>
                {topSeller ? topSeller.name : 'Sin registros'}
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' }}>
                {topSeller ? `Vendido: ${formatCurrency(topSeller.totalSales, tenant.currencySymbol)} (${topSeller.salesCount} atenciones)` : 'Aún no hay ventas registradas'}
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '1.35rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 700 }}>Promedio por Colaborador</span>
                <Users size={18} style={{ color: '#0284c7' }} />
              </div>
              <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', marginTop: '0.4rem' }}>
                {formatCurrency(staffLeaderboard.length > 0 ? totalSalesAmount / staffLeaderboard.length : 0, tenant.currencySymbol)}
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' }}>
                Entre {staffLeaderboard.length} colaboradores con actividad
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '1.35rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 700 }}>Comisiones Acumuladas</span>
                <Award size={18} style={{ color: '#059669' }} />
              </div>
              <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#059669', marginTop: '0.4rem' }}>
                {formatCurrency(totalCommissionsPeriod, tenant.currencySymbol)}
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' }}>
                Total generado por servicios y atenciones
              </p>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.35rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.05rem', color: '#0f172a', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={19} style={{ color: '#059669' }} />
                Ventas y Comisiones por Colaborador
              </h3>
              <span className="badge badge-wholesale">{staffLeaderboard.length} Integrantes</span>
            </div>

            <div className="table-responsive">
              <table className="table" style={{ width: '100%', fontSize: '0.86rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Posición</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Colaborador</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Total Vendido</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Atenciones</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Promedio por Venta</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Comisiones</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Aporte al Total</th>
                  </tr>
                </thead>
                <tbody>
                  {staffLeaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                        No se registran ventas por colaborador en este período.
                      </td>
                    </tr>
                  ) : (
                    staffLeaderboard.map((member, idx) => {
                      const pctOfTotal = totalSalesAmount > 0 ? (member.totalSales / totalSalesAmount) * 100 : 0;
                      const memberAvgTicket = member.salesCount > 0 ? member.totalSales / member.salesCount : 0;

                      return (
                        <tr key={member.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>
                            <span className="badge" style={{ background: idx === 0 ? '#fef3c7' : '#f1f5f9', color: idx === 0 ? '#92400e' : '#475569' }}>
                              #{idx + 1}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                            {member.name}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#059669' }}>
                            {formatCurrency(member.totalSales, tenant.currencySymbol)}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>
                              {member.salesCount}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                            {formatCurrency(memberAvgTicket, tenant.currencySymbol)}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0284c7' }}>
                            {formatCurrency(member.commissionsTotal, tenant.currencySymbol)}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#0f172a' }}>{pctOfTotal.toFixed(1)}%</span>
                              <div style={{ width: '60px', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ width: `${pctOfTotal}%`, height: '100%', background: '#059669' }} />
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

      {/* --- SUBTAB 3: MERCADERÍA & STOCK --- */}
      {mainSubTab === 'inventory_capital' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
            <div className="glass-panel" style={{ padding: '1.35rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 700 }}>Dinero en Estantes (Al Costo)</span>
                <Archive size={18} style={{ color: '#0284c7' }} />
              </div>
              <h3 style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.4rem', color: '#0f172a' }}>
                {formatCurrency(totalCapitalAtCost, tenant.currencySymbol)}
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' }}>
                Lo que costó toda la mercadería disponible hoy
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '1.35rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 700 }}>Valor si se Vende Todo</span>
                <DollarSign size={18} style={{ color: '#059669' }} />
              </div>
              <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#059669', marginTop: '0.4rem' }}>
                {formatCurrency(totalPotentialSaleValue, tenant.currencySymbol)}
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' }}>
                Ganancia esperada al vender el stock: <strong style={{ color: '#0f172a' }}>{formatCurrency(totalPotentialGrossProfit, tenant.currencySymbol)}</strong>
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '1.35rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 700 }}>Productos sin Movimiento</span>
                <PackageX size={18} style={{ color: '#dc2626' }} />
              </div>
              <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: deadStockProducts.length > 0 ? '#dc2626' : '#059669', marginTop: '0.4rem' }}>
                {deadStockProducts.length} {deadStockProducts.length === 1 ? 'producto' : 'productos'}
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' }}>
                Dinero estancado sin rotación: <strong style={{ color: '#dc2626' }}>{formatCurrency(totalDeadStockCapital, tenant.currencySymbol)}</strong>
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.25rem' }}>
            {/* Value by Category */}
            <div className="glass-panel" style={{ padding: '1.35rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', color: '#0f172a', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Layers size={18} style={{ color: '#0284c7' }} />
                  Mercadería por Categoría
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>
                  Dónde está concentrado el dinero de tu inventario
                </p>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left' }}>
                      <th style={{ padding: '0.65rem' }}>Categoría</th>
                      <th style={{ padding: '0.65rem' }}>Unidades</th>
                      <th style={{ padding: '0.65rem' }}>Valor al Costo</th>
                      <th style={{ padding: '0.65rem', textAlign: 'right' }}>Peso %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryCapitalList.map(cat => {
                      const pct = totalCapitalAtCost > 0 ? (cat.costValue / totalCapitalAtCost) * 100 : 0;
                      return (
                        <tr key={cat.category} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.65rem', fontWeight: 600, color: '#0f172a' }}>{cat.category}</td>
                          <td style={{ padding: '0.65rem', color: '#64748b' }}>{cat.totalStock} unid.</td>
                          <td style={{ padding: '0.65rem', fontWeight: 700, color: '#0f172a' }}>
                            {formatCurrency(cat.costValue, tenant.currencySymbol)}
                          </td>
                          <td style={{ padding: '0.65rem', textAlign: 'right', fontWeight: 700, color: '#0284c7' }}>
                            {pct.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Slow-Moving / Dead Stock Products */}
            <div className="glass-panel" style={{ padding: '1.35rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', color: '#0f172a', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <TrendingDown size={18} style={{ color: '#dc2626' }} />
                    Productos Estancados (Sin Ventas)
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>
                    Artículos con existencia que no se han vendido para poner en oferta
                  </p>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left' }}>
                      <th style={{ padding: '0.65rem' }}>Producto</th>
                      <th style={{ padding: '0.65rem' }}>Existencia</th>
                      <th style={{ padding: '0.65rem' }}>Costo Retenido</th>
                      <th style={{ padding: '0.65rem', textAlign: 'right' }}>Recomendación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deadStockProducts.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                          Todos tus productos con stock registran movimiento.
                        </td>
                      </tr>
                    ) : (
                      deadStockProducts.slice(0, 8).map(item => (
                        <tr key={item.product.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.65rem', fontWeight: 600, color: '#0f172a' }}>{item.product.name}</td>
                          <td style={{ padding: '0.65rem', color: '#64748b' }}>{item.product.currentStock} {item.product.unitOfMeasure}</td>
                          <td style={{ padding: '0.65rem', fontWeight: 700, color: '#dc2626' }}>
                            {formatCurrency(item.tiedCapital, tenant.currencySymbol)}
                          </td>
                          <td style={{ padding: '0.65rem', textAlign: 'right' }}>
                            <span className="badge" style={{ background: '#fffbeb', color: '#b45309', fontSize: '0.7rem', fontWeight: 700 }}>
                              Armar combo / oferta
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Food Menu Dishes Overview if Food Enabled */}
            {tenant.isFoodEnabled && (
              <div className="glass-panel" style={{ gridColumn: '1 / -1', padding: '1.35rem', background: '#ffffff', border: '1px solid #fed7aa', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', color: '#0f172a', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Utensils size={18} style={{ color: '#ea580c' }} />
                      Menú de Cocina y Platos Servidos ({menuItems.length} platos)
                    </h3>
                    <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>
                      Conteo de platos servidos en el período seleccionado y recaudación por plato
                    </p>
                  </div>

                  <span className="badge" style={{ background: '#fff7ed', color: '#c2410c', padding: '0.35rem 0.65rem', fontSize: '0.75rem', fontWeight: 700 }}>
                    Total Servidos: {totalFoodPlatesSold} {totalFoodPlatesSold === 1 ? 'plato' : 'platos'} ({formatCurrency(totalFoodRevenue, tenant.currencySymbol)})
                  </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#fff7ed', color: '#9a3412', textAlign: 'left' }}>
                        <th style={{ padding: '0.65rem' }}>Plato / Menú</th>
                        <th style={{ padding: '0.65rem' }}>Categoría</th>
                        <th style={{ padding: '0.65rem' }}>Precio Base</th>
                        <th style={{ padding: '0.65rem' }}>Estado Menú</th>
                        <th style={{ padding: '0.65rem', textAlign: 'center' }}>Platos Servidos</th>
                        <th style={{ padding: '0.65rem', textAlign: 'right' }}>Recaudado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {menuItems.map(item => {
                        const itemKey = `menu_${item.id}`;
                        const soldRecord = soldItemsMap[itemKey] || Object.values(soldItemsMap).find(
                          s => s.type === 'MENU_ITEM' && s.name.toLowerCase() === item.name.toLowerCase()
                        );
                        const soldCount = soldRecord?.quantity || 0;
                        const soldTotal = soldRecord?.revenue || 0;

                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.65rem', fontWeight: 700, color: '#0f172a' }}>
                              {item.name}
                            </td>
                            <td style={{ padding: '0.65rem', color: '#64748b' }}>
                              {item.category || 'General'}
                            </td>
                            <td style={{ padding: '0.65rem', fontWeight: 600, color: '#334155' }}>
                              {formatCurrency(item.price, tenant.currencySymbol)}
                            </td>
                            <td style={{ padding: '0.65rem' }}>
                              <span style={{
                                padding: '0.15rem 0.5rem',
                                borderRadius: '9999px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                background: item.isAvailable ? '#f0fdf4' : '#fef2f2',
                                color: item.isAvailable ? '#16a34a' : '#ef4444'
                              }}>
                                {item.isAvailable ? 'Disponible' : 'Agotado'}
                              </span>
                            </td>
                            <td style={{ padding: '0.65rem', textAlign: 'center', fontWeight: 800, color: soldCount > 0 ? '#ea580c' : '#94a3b8' }}>
                              {soldCount}
                            </td>
                            <td style={{ padding: '0.65rem', textAlign: 'right', fontWeight: 800, color: soldTotal > 0 ? '#0f172a' : '#94a3b8' }}>
                              {formatCurrency(soldTotal, tenant.currencySymbol)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- SUBTAB 4: CLIENTES FRECUENTES --- */}
      {mainSubTab === 'loyalty' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.25rem' }}>
            <div className="glass-panel" style={{ padding: '1.35rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 700 }}>Ventas a Clientes Conocidos</span>
                <Zap size={18} style={{ color: '#7c3aed' }} />
              </div>
              <h3 style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.4rem', color: '#0f172a' }}>
                {retentionPercentage}%
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' }}>
                {registeredCustomerSales.length} de {validSales.length} ventas hechas a clientes registrados
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '1.35rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 700 }}>Puntos Entregados</span>
                <Star size={18} style={{ color: '#d97706' }} />
              </div>
              <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#d97706', marginTop: '0.4rem' }}>
                {totalPointsEarnedPeriod} pts
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' }}>
                Acumulados por tus clientes en sus compras
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '1.35rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 700 }}>Puntos Canjeados</span>
                <RefreshCw size={18} style={{ color: '#059669' }} />
              </div>
              <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#059669', marginTop: '0.4rem' }}>
                {totalPointsRedeemedPeriod} pts
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' }}>
                Ahorro otorgado: <strong style={{ color: '#059669' }}>{formatCurrency(totalLoyaltyDiscountGiven, tenant.currencySymbol)}</strong>
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.25rem' }}>

            {/* Sales Distribution Card */}
            <div className="glass-panel" style={{ padding: '1.35rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', color: '#0f172a', fontWeight: 800, margin: 0 }}>
                  Clientes Conocidos vs. Clientes de Paso
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>
                  Comparación de ingresos según el tipo de comprador
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', marginTop: '0.25rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: '0.35rem' }}>
                    <span style={{ fontWeight: 600, color: '#334155' }}>Clientes Registrados en Directorio</span>
                    <strong style={{ color: '#7c3aed' }}>
                      {formatCurrency(registeredSalesAmount, tenant.currencySymbol)} ({((registeredSalesAmount / (totalSalesAmount || 1)) * 100).toFixed(1)}%)
                    </strong>
                  </div>
                  <div style={{ width: '100%', height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{ width: `${(registeredSalesAmount / (totalSalesAmount || 1)) * 100}%`, height: '100%', background: '#7c3aed' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: '0.35rem' }}>
                    <span style={{ fontWeight: 600, color: '#334155' }}>Consumidor Final (De Paso)</span>
                    <strong style={{ color: '#64748b' }}>
                      {formatCurrency(finalConsumerSalesAmount, tenant.currencySymbol)} ({((finalConsumerSalesAmount / (totalSalesAmount || 1)) * 100).toFixed(1)}%)
                    </strong>
                  </div>
                  <div style={{ width: '100%', height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{ width: `${(finalConsumerSalesAmount / (totalSalesAmount || 1)) * 100}%`, height: '100%', background: '#94a3b8' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Top Loyal Customers Table */}
            <div className="glass-panel" style={{ padding: '1.35rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', color: '#0f172a', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Star size={18} style={{ color: '#d97706' }} />
                  Mejores Clientes del Negocio
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>
                  Clientes con mayor monto de compra acumulada
                </p>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left' }}>
                      <th style={{ padding: '0.65rem' }}>Cliente</th>
                      <th style={{ padding: '0.65rem' }}>Teléfono</th>
                      <th style={{ padding: '0.65rem' }}>Puntos</th>
                      <th style={{ padding: '0.65rem', textAlign: 'right' }}>Total Comprado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topLoyalCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                          No hay clientes registrados en el directorio aún.
                        </td>
                      </tr>
                    ) : (
                      topLoyalCustomers.map(c => (
                        <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.65rem', fontWeight: 600, color: '#0f172a' }}>{c.name}</td>
                          <td style={{ padding: '0.65rem', color: '#64748b' }}>{c.phone || 'Sin número'}</td>
                          <td style={{ padding: '0.65rem' }}>
                            <span className="badge" style={{ background: '#fef3c7', color: '#92400e', fontWeight: 700 }}>
                              {c.loyaltyPoints || 0} pts
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                            {formatCurrency(c.totalSpent || 0, tenant.currencySymbol)}
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

      {/* --- SUBTAB 5: CIERRES DE CAJA (REPORTES Z) --- */}
      {mainSubTab === 'shifts' && (
        <div className="glass-panel" style={{ padding: '1.35rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', color: '#0f172a', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Wallet size={20} style={{ color: '#059669' }} />
                Historial de Cierres de Caja ({filteredTenantShifts.length})
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>
                Revisión de efectivo esperado vs. efectivo contado al cerrar cada turno
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <select
                className="form-control"
                style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem', width: 'auto' }}
                value={selectedCajaFilter}
                onChange={(e) => setSelectedCajaFilter(e.target.value)}
              >
                <option value="ALL">Todas las Cajas</option>
                {Array.from(new Set(tenantShifts.map((s: any) => s.cajaName || 'Caja Principal'))).map((name: any) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <span className="badge badge-wholesale">{filteredTenantShifts.length} Cierres</span>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Fecha / Hora Cierre</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Caja</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Cajero Responsable</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Fondo Inicial</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Debía Haber (Sistema)</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Se Contó (Físico)</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Resultado del Cuadre</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {filteredTenantShifts.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                      No se encontraron cierres de turno para el período seleccionado.
                    </td>
                  </tr>
                ) : (
                  filteredTenantShifts.map((shift: any) => {
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
                            {formatCurrency(shift.openingAmount || 0, tenant.currencySymbol)}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                            {formatCurrency(shift.closingSystem || 0, tenant.currencySymbol)}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                            {formatCurrency(shift.closingDeclared || 0, tenant.currencySymbol)}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {isPerfect ? (
                              <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <CheckCircle size={12} /> Cuadre Perfecto
                              </span>
                            ) : isShortage ? (
                              <span className="badge" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontWeight: 700 }}>
                                Faltante: {formatCurrency(Math.abs(diff), tenant.currencySymbol)}
                              </span>
                            ) : (
                              <span className="badge" style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', fontWeight: 700 }}>
                                Sobrante: {formatCurrency(diff, tenant.currencySymbol)}
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
                              <span>Reporte Z</span>
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
                aria-label="Cerrar detalle"
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
                  <p style={{ fontWeight: 700, color: '#10b981', margin: 0, fontSize: '0.9rem' }}>{getPaymentMethodLabel(selectedSaleDetail.paymentMethod)}</p>
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
                    {getSaleDisplayItems(selectedSaleDetail).map((item: CartLine, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.5rem', fontWeight: 600, color: '#0f172a' }}>
                          {item.name}
                          {item.notes && (
                            <div style={{ fontSize: '0.72rem', color: '#ea580c', fontWeight: 500, marginTop: '2px' }}>
                              {item.notes}
                            </div>
                          )}
                          {item.sku && <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>SKU: {item.sku}</div>}
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
                  <li>El stock vendido ({getSaleDisplayItems(saleToVoid).reduce((a, b) => a + b.quantity, 0)} unidades) se reintegrara al inventario vendible.</li>
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
                  onClick={() => {
                    printZReport({
                      tenant,
                      cajaName: selectedShiftDetail.cajaName,
                      zReport: {
                        openingAmount: selectedShiftDetail.openingAmount || 0,
                        totalCashSales: selectedShiftDetail.cashSales || 0,
                        totalCardSales: selectedShiftDetail.cardSales || 0,
                        totalTransferSales: selectedShiftDetail.transferSales || 0,
                        totalCreditSales: selectedShiftDetail.creditSales || 0,
                        totalIngresos: selectedShiftDetail.cashInflow || 0,
                        totalEgresos: selectedShiftDetail.cashOutflow || 0,
                        closingSystem: selectedShiftDetail.expectedCash || 0,
                        closingDeclared: selectedShiftDetail.actualCash || 0,
                        difference: selectedShiftDetail.difference || 0
                      }
                    });
                  }}
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
