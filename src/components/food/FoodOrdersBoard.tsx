import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { FoodOrder, FoodOrderStatus, Sale } from '../../types';
import { formatCurrency } from '../../lib/monetary';
import { printKitchenTicket, printSaleReceipt } from '../../lib/thermalPrint';
import { DateFilterBar } from '../common/DateFilterBar';
import { DateFilterPeriod, matchesDateFilter } from '../../lib/dateFilter';
import { QuickOrderPaymentModal } from './QuickOrderPaymentModal';
import { NewFoodOrderModal } from './NewFoodOrderModal';
import { DriverSettlementModal } from './DriverSettlementModal';
import {
  Utensils,
  Plus,
  Search,
  Clock,
  CheckCircle2,
  Phone,
  Bike,
  ShoppingBag,
  Printer,
  DollarSign,
  AlertTriangle,
  RotateCcw,
  Trash2,
  MessageCircle,
  Eye,
  Filter,
  Pencil,
  X
} from 'lucide-react';
import { toast } from 'sonner';

export const FoodOrdersBoard: React.FC = () => {
  const tenant = useAppStore(state => state.tenant);
  const isDemo = tenant.id === '00000000-0000-0000-0000-000000000001';
  const allOrders = useAppStore(state => state.foodOrders) || [];
  const foodOrders = allOrders.filter(
    o => o.tenantId === tenant.id || (isDemo && (!o.tenantId || o.tenantId === '00000000-0000-0000-0000-000000000001'))
  );
  const updateFoodOrder = useAppStore(state => state.updateFoodOrder);
  const cancelFoodOrder = useAppStore(state => state.cancelFoodOrder);
  const sales = useAppStore(state => state.sales) || [];

  // Filter & Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'KITCHEN' | 'TABLES' | 'DELIVERY' | 'COMPLETED'>('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilterPeriod>('TODAY');
  const [customDate, setCustomDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Modals State
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<FoodOrder | null>(null);
  const [paymentModalOrder, setPaymentModalOrder] = useState<FoodOrder | null>(null);
  const [isDriversModalOpen, setIsDriversModalOpen] = useState(false);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<FoodOrder | null>(null);

  // Time & Urgency Helper
  const getElapsedMinutes = (isoDate: string) => {
    try {
      const nowMs = Date.now();
      const orderMs = new Date(isoDate).getTime();
      return Math.max(0, Math.floor((nowMs - orderMs) / (1000 * 60)));
    } catch {
      return 0;
    }
  };

  const getUrgencyBadge = (order: FoodOrder) => {
    const isPaidEff = Boolean(order.isPaid || (order.saleId && sales.some(s => s.id === order.saleId)));
    if (isPaidEff || order.status === 'COMPLETED' || order.status === 'DELIVERED' || order.status === 'CANCELLED') {
      return null;
    }

    const mins = getElapsedMinutes(order.createdAt);
    if (mins < 15) {
      return {
        label: `Hace ${mins === 0 ? 'un momento' : `${mins} min`}`,
        style: {
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          color: '#166534',
          fontWeight: 700,
          padding: '0.2rem 0.5rem',
          borderRadius: '6px',
          fontSize: '0.72rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem'
        }
      };
    } else if (mins < 30) {
      return {
        label: `Hace ${mins} min (En espera)`,
        style: {
          background: '#fffbeb',
          border: '1px solid #fde68a',
          color: '#92400e',
          fontWeight: 800,
          padding: '0.2rem 0.5rem',
          borderRadius: '6px',
          fontSize: '0.72rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem'
        }
      };
    } else {
      return {
        label: `¡Urgente! Hace ${mins} min`,
        style: {
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          color: '#991b1b',
          fontWeight: 900,
          padding: '0.2rem 0.5rem',
          borderRadius: '6px',
          fontSize: '0.72rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem'
        }
      };
    }
  };

  // Status Badge Helper
  const getStatusBadge = (status: FoodOrderStatus) => {
    switch (status) {
      case 'ORDERED':
        return (
          <span style={{ background: '#ffedd5', color: '#c2410c', padding: '0.2rem 0.55rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 800 }}>
            Ordenada
          </span>
        );
      case 'PREPARING':
        return (
          <span style={{ background: '#fef3c7', color: '#b45309', padding: '0.2rem 0.55rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 800 }}>
            En Cocina
          </span>
        );
      case 'SERVED':
        return (
          <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.2rem 0.55rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 800 }}>
            Servida / Lista
          </span>
        );
      case 'IN_TRANSIT':
        return (
          <span style={{ background: '#f3e8ff', color: '#7e22ce', padding: '0.2rem 0.55rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 800 }}>
            En Camino
          </span>
        );
      case 'COMPLETED':
      case 'DELIVERED':
        return (
          <span style={{ background: '#dcfce7', color: '#15803d', padding: '0.2rem 0.55rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 800 }}>
            Completada
          </span>
        );
      case 'CANCELLED':
        return (
          <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.2rem 0.55rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 800 }}>
            Cancelada
          </span>
        );
      default:
        return (
          <span style={{ background: '#f1f5f9', color: '#475569', padding: '0.2rem 0.55rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700 }}>
            {status}
          </span>
        );
    }
  };

  const handleStatusChange = (order: FoodOrder, newStatus: FoodOrderStatus) => {
    if (newStatus === 'COMPLETED' || newStatus === 'DELIVERED') {
      // If user marks completed directly, prompt direct payment modal if not paid
      if (!order.isPaid) {
        setPaymentModalOrder(order);
        return;
      }
    }
    updateFoodOrder(order.id, { status: newStatus });
    toast.success(`Comanda ${order.orderNumber} actualizada`);
  };

  const handlePrintKitchenTicket = (order: FoodOrder) => {
    try {
      printKitchenTicket({
        orderNumber: order.orderNumber,
        tableNumber: order.tableNumber,
        deliveryType: order.deliveryType,
        customerName: order.customerName,
        items: order.items.map(it => ({
          name: it.name,
          quantity: it.quantity,
          notes: it.notes,
          extras: (it.selectedExtras || []).map(e => ({ name: e.name, price: e.price }))
        }))
      });
    } catch (err) {
      console.warn('Error al imprimir ticket de cocina:', err);
    }
  };

  const handleReprintSaleReceipt = (order: FoodOrder) => {
    if (!order.saleId) {
      toast.info('No se encontró el ID de la venta vinculada');
      return;
    }
    const sale = sales.find(s => s.id === order.saleId);
    if (!sale) {
      toast.error('Venta no encontrada para reimpresión');
      return;
    }
    try {
      let enrichedItems = sale.items || [];
      const hasGenericNames = !sale.items || sale.items.length === 0 || sale.items.every(it => !it.name || it.name === 'Artículo POS');
      if (hasGenericNames && order.items && order.items.length > 0) {
        enrichedItems = order.items.map(it => {
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

        if (order.deliveryFee && order.deliveryFee > 0) {
          enrichedItems.push({
            name: 'Servicio a Domicilio',
            sku: 'DELIVERY',
            quantity: 1,
            unitPrice: order.deliveryFee,
            originalUnitPrice: order.deliveryFee,
            discountAmount: 0,
            taxClassification: 'EXENTO',
            subtotal: order.deliveryFee,
            taxAmount: 0,
            total: order.deliveryFee
          });
        }
      }

      printSaleReceipt({ ...sale, items: enrichedItems }, tenant, 'ORIGINAL');
    } catch (err) {
      console.warn('Error al reimprimir recibo:', err);
    }
  };

  const handleSendWhatsAppNotification = (order: FoodOrder) => {
    const rawPhone = order.customerPhone || order.deliveryPhone;
    if (!rawPhone) return;
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.length === 8 ? `504${cleanPhone}` : cleanPhone;
    const itemsSummary = order.items.map(it => `${it.quantity}x ${it.name}`).join(', ');
    const text = `Hola ${order.customerName || ''}, te saludamos de ${tenant.name}. Tu pedido ${order.orderNumber} (${itemsSummary}) por ${formatCurrency(order.total, tenant.currencySymbol)} está ${order.status === 'IN_TRANSIT' ? 'en camino a tu dirección' : 'listo'}. ¡Muchas gracias por tu preferencia!`;
    const waUrl = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  // Helper to determine if an order is effectively paid (checks order.isPaid and linked sale)
  const isOrderPaidEffective = (order: FoodOrder) =>
    Boolean(order.isPaid || (order.saleId && sales.some(s => s.id === order.saleId)));

  // Filtered & Sorted Orders
  const filteredOrders = useMemo(() => {
    return foodOrders.filter(o => {
      // 1. Date Filter (Default: TODAY)
      const matchesDate = matchesDateFilter(o.createdAt, dateFilter, customDate);
      if (!matchesDate) return false;

      // 2. Search
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        o.orderNumber.toLowerCase().includes(search) ||
        (o.customerName && o.customerName.toLowerCase().includes(search)) ||
        (o.tableNumber && o.tableNumber.toLowerCase().includes(search)) ||
        (o.deliveryAddress && o.deliveryAddress.toLowerCase().includes(search)) ||
        (o.driverName && o.driverName.toLowerCase().includes(search));

      if (!matchesSearch) return false;

      const isPaid = isOrderPaidEffective(o);

      if (statusFilter === 'KITCHEN') {
        return (o.status === 'ORDERED' || o.status === 'PREPARING') && !isPaid;
      }
      if (statusFilter === 'TABLES') {
        return o.deliveryType === 'DINE_IN' && !isPaid;
      }
      if (statusFilter === 'DELIVERY') {
        return o.deliveryType === 'DELIVERY' && !isPaid;
      }
      if (statusFilter === 'COMPLETED') {
        return isPaid || o.status === 'COMPLETED' || o.status === 'DELIVERED';
      }

      return true;
    });
  }, [foodOrders, sales, searchTerm, statusFilter, dateFilter, customDate]);

  // Sort: Active unpaid first (urgent oldest first), Completed at the bottom
  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      const aPaid = isOrderPaidEffective(a);
      const bPaid = isOrderPaidEffective(b);
      const aDone = aPaid || a.status === 'COMPLETED' || a.status === 'DELIVERED' || a.status === 'CANCELLED';
      const bDone = bPaid || b.status === 'COMPLETED' || b.status === 'DELIVERED' || b.status === 'CANCELLED';

      if (aDone && !bDone) return 1;
      if (!aDone && bDone) return -1;

      // Both active: oldest created first
      if (!aDone && !bDone) {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }

      // Both done: newest first
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [filteredOrders, sales]);

  // Date-filtered base orders for counters
  const dateOrders = useMemo(() => {
    return foodOrders.filter(o => matchesDateFilter(o.createdAt, dateFilter, customDate));
  }, [foodOrders, dateFilter, customDate]);

  // KPI Metrics based on selected date period
  const activeCount = dateOrders.filter(o => !isOrderPaidEffective(o) && o.status !== 'CANCELLED').length;
  const inKitchenCount = dateOrders.filter(o => (o.status === 'ORDERED' || o.status === 'PREPARING') && !isOrderPaidEffective(o)).length;
  const tablesCount = dateOrders.filter(o => o.deliveryType === 'DINE_IN' && !isOrderPaidEffective(o) && o.status !== 'CANCELLED').length;
  const deliveryCount = dateOrders.filter(o => o.deliveryType === 'DELIVERY' && !isOrderPaidEffective(o) && o.status !== 'CANCELLED').length;
  const completedCount = dateOrders.filter(o => isOrderPaidEffective(o) || o.status === 'COMPLETED' || o.status === 'DELIVERED').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* 1. KPI Stats Summary Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <div style={{ background: '#ffffff', borderRadius: '12px', padding: '0.85rem 1rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Comandas Activas</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', marginTop: '0.2rem' }}>
            {activeCount}
          </div>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '12px', padding: '0.85rem 1rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>En Cocina / Preparando</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ea580c', marginTop: '0.2rem' }}>
            {inKitchenCount}
          </div>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '12px', padding: '0.85rem 1rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Mesas Abiertas</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#2563eb', marginTop: '0.2rem' }}>
            {tablesCount}
          </div>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '12px', padding: '0.85rem 1rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>A Domicilio en Curso</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#16a34a', marginTop: '0.2rem' }}>
            {deliveryCount}
          </div>
        </div>
      </div>

      {/* Date Period Filter Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', padding: '0.15rem 0' }}>
        <DateFilterBar
          value={dateFilter}
          onChange={setDateFilter}
          customDate={customDate}
          onCustomDateChange={setCustomDate}
        />
        <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
          {filteredOrders.length} {filteredOrders.length === 1 ? 'comanda mostrada' : 'comandas mostradas'}
        </span>
      </div>

      {/* 2. Search & Filter Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        
        {/* Search */}
        <div style={{ position: 'relative', minWidth: 'min(100%, 220px)', flex: 1, maxWidth: '400px' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            className="input-control"
            placeholder="Buscar por cliente, mesa, # orden..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.2rem', paddingRight: '0.75rem', height: '42px', fontSize: '0.85rem' }}
          />
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 700,
              border: statusFilter === 'ALL' ? '2px solid #0f172a' : '1px solid #cbd5e1',
              background: statusFilter === 'ALL' ? '#0f172a' : '#ffffff',
              color: statusFilter === 'ALL' ? '#ffffff' : '#475569',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Todas ({dateOrders.length})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('KITCHEN')}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 700,
              border: statusFilter === 'KITCHEN' ? '2px solid #ea580c' : '1px solid #cbd5e1',
              background: statusFilter === 'KITCHEN' ? '#fff7ed' : '#ffffff',
              color: statusFilter === 'KITCHEN' ? '#ea580c' : '#475569',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            En Cocina ({inKitchenCount})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('TABLES')}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 700,
              border: statusFilter === 'TABLES' ? '2px solid #2563eb' : '1px solid #cbd5e1',
              background: statusFilter === 'TABLES' ? '#eff6ff' : '#ffffff',
              color: statusFilter === 'TABLES' ? '#2563eb' : '#475569',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Mesas ({tablesCount})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('DELIVERY')}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 700,
              border: statusFilter === 'DELIVERY' ? '2px solid #16a34a' : '1px solid #cbd5e1',
              background: statusFilter === 'DELIVERY' ? '#f0fdf4' : '#ffffff',
              color: statusFilter === 'DELIVERY' ? '#16a34a' : '#475569',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            A Domicilio ({deliveryCount})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('COMPLETED')}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 700,
              border: statusFilter === 'COMPLETED' ? '2px solid #64748b' : '1px solid #cbd5e1',
              background: statusFilter === 'COMPLETED' ? '#f1f5f9' : '#ffffff',
              color: statusFilter === 'COMPLETED' ? '#0f172a' : '#475569',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Completadas ({completedCount})
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setIsDriversModalOpen(true)}
            style={{
              minHeight: '42px',
              padding: '0.55rem 1rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0284c7',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Bike size={16} />
            <span>Repartidores & Liquidación</span>
          </button>

          {/* CTA: Nuevo Pedido */}
          <button
            type="button"
            onClick={() => {
              setEditingOrder(null);
              setIsNewOrderModalOpen(true);
            }}
            style={{
              minHeight: '42px',
              padding: '0.55rem 1.25rem',
              fontSize: '0.88rem',
              fontWeight: 800,
              borderRadius: '10px',
              border: 'none',
              background: '#ea580c',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 2px 8px rgba(234, 88, 12, 0.3)'
            }}
          >
            <Plus size={18} />
            <span>+ Nuevo Pedido</span>
          </button>
        </div>
      </div>

      {/* 3. Orders Grid Cards (Direct In-Card Checkout Pattern) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '0.85rem' }}>
        {sortedOrders.length === 0 ? (
          <div
            style={{
              gridColumn: '1 / -1',
              padding: '3.5rem 1.5rem',
              textAlign: 'center',
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px dashed #cbd5e1',
              color: '#64748b',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem'
            }}
          >
            <Utensils size={36} style={{ color: '#ea580c', opacity: 0.6 }} />
            <div>
              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                No hay comandas registradas
              </h4>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>
                Haz clic en <strong>"+ Nuevo Pedido"</strong> para crear una comanda de mesa, para llevar o a domicilio.
              </p>
            </div>
          </div>
        ) : (
          sortedOrders.map(order => {
            const urgency = getUrgencyBadge(order);
            const isPaid = isOrderPaidEffective(order);
            const isCompleted = isPaid || order.status === 'COMPLETED' || order.status === 'DELIVERED';
            const isCancelled = order.status === 'CANCELLED';

            return (
              <div
                key={order.id}
                style={{
                  height: '280px',
                  minHeight: '280px',
                  maxHeight: '280px',
                  boxSizing: 'border-box',
                  background: isCancelled ? '#fff1f2' : isCompleted ? '#f8fafc' : '#ffffff',
                  border: isCancelled
                    ? '1px solid #fecdd3'
                    : isCompleted
                    ? '1px solid #e2e8f0'
                    : urgency?.label.includes('Urgente')
                    ? '2px solid #ef4444'
                    : urgency?.label.includes('espera')
                    ? '2px solid #f59e0b'
                    : '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '0.65rem 0.8rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  boxShadow: isCompleted ? 'none' : '0 2px 5px rgba(0,0,0,0.03)',
                  opacity: isCancelled ? 0.7 : isCompleted ? 0.85 : 1,
                  overflow: 'hidden'
                }}
              >
                {/* Urgency Highlight Banner if active */}
                {urgency && (
                  <div style={{ ...urgency.style, padding: '0.12rem 0.45rem', fontSize: '0.68rem', borderRadius: '5px' }}>
                    <Clock size={11} />
                    <span>{urgency.label}</span>
                  </div>
                )}

                {/* Top Line: Number & Destination Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span
                      style={{
                        background: '#0f172a',
                        color: '#ffffff',
                        fontSize: '0.74rem',
                        fontWeight: 900,
                        padding: '0.12rem 0.45rem',
                        borderRadius: '5px'
                      }}
                    >
                      {order.orderNumber}
                    </span>

                    {/* Destination Pill */}
                    <span
                      style={{
                        background: order.deliveryType === 'DINE_IN' ? '#ffedd5' : order.deliveryType === 'TAKE_OUT' ? '#e0f2fe' : '#dcfce7',
                        color: order.deliveryType === 'DINE_IN' ? '#c2410c' : order.deliveryType === 'TAKE_OUT' ? '#0369a1' : '#15803d',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        padding: '0.12rem 0.4rem',
                        borderRadius: '5px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.2rem'
                      }}
                    >
                      {order.deliveryType === 'DINE_IN' ? (
                        <>
                          <Utensils size={11} />
                          <span>{order.tableNumber || 'Mesa'}</span>
                        </>
                      ) : order.deliveryType === 'TAKE_OUT' ? (
                        <>
                          <ShoppingBag size={11} />
                          <span>Para Llevar</span>
                        </>
                      ) : (
                        <>
                          <Bike size={11} />
                          <span>Domicilio</span>
                        </>
                      )}
                    </span>
                  </div>

                  <div>
                    {getStatusBadge(order.status)}
                  </div>
                </div>

                {/* Customer Details & Phone */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '18px' }}>
                  <span
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      color: '#0f172a',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: (order.customerPhone || order.deliveryPhone) ? '62%' : '100%'
                    }}
                    title={order.customerName || (order.tableNumber ? `${order.tableNumber}` : 'Cliente')}
                  >
                    {order.customerName || (order.tableNumber ? `${order.tableNumber}` : 'Cliente')}
                  </span>
                  {(order.customerPhone || order.deliveryPhone) && (
                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      <Phone size={10} />
                      <span>{order.customerPhone || order.deliveryPhone}</span>
                    </span>
                  )}
                </div>

                {/* Food Items Breakdown (Compact: max 2 items + 'ver más...') */}
                <div
                  style={{
                    background: isCompleted ? '#ffffff' : '#f8fafc',
                    borderRadius: '8px',
                    padding: '0.35rem 0.55rem',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem',
                    fontSize: '0.73rem',
                    flex: 1,
                    minHeight: 0,
                    overflow: 'hidden',
                    boxSizing: 'border-box'
                  }}
                >
                  {order.items.slice(0, 2).map((it, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '75%' }}>
                        <span style={{ color: '#ea580c', fontWeight: 800 }}>{it.quantity}x</span> {it.name}
                      </span>
                      <span style={{ color: '#475569', fontWeight: 700, fontSize: '0.71rem', flexShrink: 0, marginLeft: '0.35rem' }}>
                        {formatCurrency(it.subtotal, tenant.currencySymbol)}
                      </span>
                    </div>
                  ))}

                  {order.items.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setSelectedOrderDetail(order)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '0.1rem 0 0 0',
                        color: '#ea580c',
                        fontWeight: 800,
                        fontSize: '0.69rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        marginTop: 'auto'
                      }}
                      title="Ver lista completa de platillos y notas"
                    >
                      <Eye size={11} />
                      <span>+ {order.items.length - 2} platos más (ver más...)</span>
                    </button>
                  )}
                </div>

                {/* Bottom Section: Total & Actions (Anchored at bottom with fixed height) */}
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem', paddingTop: '0.15rem' }}>
                  {/* Total & Status Selector */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
                      <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>Total:</span>
                      <span style={{ fontSize: '0.98rem', fontWeight: 900, color: isCompleted ? '#15803d' : '#ea580c' }}>
                        {formatCurrency(order.total, tenant.currencySymbol)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.66rem', color: '#64748b', fontWeight: 600 }}>Estado:</label>
                      <select
                        className="input-control"
                        value={order.status}
                        disabled={isCompleted || isCancelled}
                        onChange={(e) => handleStatusChange(order, e.target.value as FoodOrderStatus)}
                        style={{ fontSize: '0.68rem', padding: '0.1rem 0.25rem', height: '24px' }}
                      >
                        <option value="ORDERED">Ordenada</option>
                        <option value="PREPARING">En Cocina</option>
                        <option value="SERVED">Servida / Lista</option>
                        <option value="IN_TRANSIT">En Camino</option>
                        <option value="COMPLETED">Completada</option>
                        <option value="CANCELLED">Cancelada</option>
                      </select>
                    </div>
                  </div>

                  {/* Primary Card Actions: Direct Checkout vs Paid Indicator (Unified 62px height across all states) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {!isCompleted && !isCancelled ? (
                      <>
                        {/* Row 1: Primary Action (32px) */}
                        <div style={{ display: 'flex', gap: '0.3rem', height: '32px' }}>
                          {order.status === 'ORDERED' && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(order, 'PREPARING')}
                              style={{
                                flex: 1,
                                height: '32px',
                                padding: '0.3rem 0.45rem',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                borderRadius: '6px',
                                border: '1px solid #fed7aa',
                                background: '#fff7ed',
                                color: '#ea580c',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.2rem',
                                whiteSpace: 'nowrap'
                              }}
                              title="Pasar comanda a En Cocina con 1 toque"
                            >
                              <Utensils size={13} />
                              <span>A Cocina</span>
                            </button>
                          )}

                          {order.status === 'PREPARING' && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(order, 'SERVED')}
                              style={{
                                flex: 1,
                                height: '32px',
                                padding: '0.3rem 0.45rem',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                borderRadius: '6px',
                                border: '1px solid #bfdbfe',
                                background: '#eff6ff',
                                color: '#2563eb',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.2rem',
                                whiteSpace: 'nowrap'
                              }}
                              title="Marcar comanda como Servida / Lista"
                            >
                              <CheckCircle2 size={13} />
                              <span>Servir / Listo</span>
                            </button>
                          )}

                          {order.status === 'SERVED' && order.deliveryType === 'DELIVERY' && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(order, 'IN_TRANSIT')}
                              style={{
                                flex: 1,
                                height: '32px',
                                padding: '0.3rem 0.45rem',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                borderRadius: '6px',
                                border: '1px solid #bbf7d0',
                                background: '#f0fdf4',
                                color: '#16a34a',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.2rem',
                                whiteSpace: 'nowrap'
                              }}
                              title="Marcar pedido En Camino con repartidor"
                            >
                              <Bike size={13} />
                              <span>En Camino</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setPaymentModalOrder(order)}
                            style={{
                              flex: order.status === 'ORDERED' || order.status === 'PREPARING' || (order.status === 'SERVED' && order.deliveryType === 'DELIVERY') ? 1.5 : 1,
                              height: '32px',
                              padding: '0.3rem 0.5rem',
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              borderRadius: '6px',
                              border: 'none',
                              background: '#059669',
                              color: '#ffffff',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.25rem',
                              boxShadow: '0 1px 4px rgba(5, 150, 105, 0.25)'
                            }}
                            title="Cobro directo sin pasar por el carrito de ventas"
                          >
                            <DollarSign size={14} />
                            <span>COBRAR {formatCurrency(order.total, tenant.currencySymbol)}</span>
                          </button>
                        </div>

                        {/* Row 2: Secondary Utility Icon Row (26px) */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.3rem', height: '26px' }}>
                          {/* View Detail */}
                          <button
                            type="button"
                            onClick={() => setSelectedOrderDetail(order)}
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '5px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#475569',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer'
                            }}
                            title="Ver detalle completo de comanda"
                          >
                            <Eye size={13} />
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingOrder(order);
                              setIsNewOrderModalOpen(true);
                            }}
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '5px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#0f172a',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer'
                            }}
                            title="Editar comanda"
                          >
                            <Pencil size={13} />
                          </button>

                          {/* Kitchen Ticket */}
                          <button
                            type="button"
                            onClick={() => handlePrintKitchenTicket(order)}
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '5px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#475569',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer'
                            }}
                            title="Imprimir Ticket de Cocina"
                          >
                            <Printer size={13} />
                          </button>

                          {/* WhatsApp Notification */}
                          {(order.customerPhone || order.deliveryPhone) && (
                            <button
                              type="button"
                              onClick={() => handleSendWhatsAppNotification(order)}
                              style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '5px',
                                border: '1px solid #bbf7d0',
                                background: '#f0fdf4',
                                color: '#16a34a',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                              }}
                              title="Enviar mensaje por WhatsApp al cliente"
                            >
                              <MessageCircle size={13} />
                            </button>
                          )}

                          {/* Cancel Order */}
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`¿Cancelar la comanda ${order.orderNumber}?`)) {
                                cancelFoodOrder(order.id);
                                toast.info(`Comanda ${order.orderNumber} cancelada`);
                              }
                            }}
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '5px',
                              border: '1px solid #fecdd3',
                              background: '#fff1f2',
                              color: '#ef4444',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer'
                            }}
                            title="Cancelar comanda"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </>
                    ) : isCompleted ? (
                      <>
                        {/* Row 1: Completed Badge (32px) */}
                        <div
                          style={{
                            height: '32px',
                            background: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            color: '#16a34a',
                            fontWeight: 800,
                            fontSize: '0.74rem',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.3rem'
                          }}
                        >
                          <CheckCircle2 size={14} />
                          <span>Cobrado con Éxito</span>
                        </div>

                        {/* Row 2: Secondary Utility Buttons (26px) */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.3rem', height: '26px' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedOrderDetail(order)}
                            style={{
                              height: '26px',
                              padding: '0 0.5rem',
                              borderRadius: '5px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#475569',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                              cursor: 'pointer'
                            }}
                            title="Ver detalle completo de comanda"
                          >
                            <Eye size={12} />
                            <span>Detalle</span>
                          </button>

                          {order.saleId && (
                            <button
                              type="button"
                              onClick={() => handleReprintSaleReceipt(order)}
                              style={{
                                height: '26px',
                                padding: '0 0.5rem',
                                borderRadius: '5px',
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                color: '#475569',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                cursor: 'pointer'
                              }}
                              title="Reimprimir comprobante de venta"
                            >
                              <Printer size={12} />
                              <span>Ticket</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handlePrintKitchenTicket(order)}
                            style={{
                              height: '26px',
                              padding: '0 0.5rem',
                              borderRadius: '5px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#475569',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                              cursor: 'pointer'
                            }}
                            title="Reimprimir Ticket de Cocina"
                          >
                            <Utensils size={12} />
                            <span>Cocina</span>
                          </button>

                          {(order.customerPhone || order.deliveryPhone) && (
                            <button
                              type="button"
                              onClick={() => handleSendWhatsAppNotification(order)}
                              style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '5px',
                                border: '1px solid #bbf7d0',
                                background: '#f0fdf4',
                                color: '#16a34a',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                              }}
                              title="Enviar comprobante por WhatsApp al cliente"
                            >
                              <MessageCircle size={13} />
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Row 1: Cancelled Badge (32px) */}
                        <div
                          style={{
                            height: '32px',
                            background: '#fef2f2',
                            border: '1px solid #fecdd3',
                            color: '#991b1b',
                            fontWeight: 800,
                            fontSize: '0.74rem',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.3rem'
                          }}
                        >
                          <span>Orden Cancelada</span>
                        </div>

                        {/* Row 2: Secondary / Spacer (26px) */}
                        <div style={{ height: '26px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedOrderDetail(order)}
                            style={{
                              height: '26px',
                              padding: '0 0.5rem',
                              borderRadius: '5px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#475569',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                              cursor: 'pointer'
                            }}
                            title="Ver detalle completo"
                          >
                            <Eye size={12} />
                            <span>Detalle</span>
                          </button>
                          <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontStyle: 'italic' }}>Comanda anulada</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New / Edit Food Order Modal */}
      <NewFoodOrderModal
        isOpen={isNewOrderModalOpen}
        onClose={() => {
          setIsNewOrderModalOpen(false);
          setEditingOrder(null);
        }}
        orderToEdit={editingOrder}
        onOrderCreatedAndCharge={(order) => {
          setPaymentModalOrder(order);
        }}
      />

      {/* Quick Order Payment Modal */}
      <QuickOrderPaymentModal
        order={paymentModalOrder}
        isOpen={Boolean(paymentModalOrder)}
        onClose={() => setPaymentModalOrder(null)}
        onSuccess={() => {
          setPaymentModalOrder(null);
        }}
      />

      {/* Delivery Drivers Settlement Modal */}
      <DriverSettlementModal
        isOpen={isDriversModalOpen}
        onClose={() => setIsDriversModalOpen(false)}
      />

      {/* Full Order Detail Modal ("Ver más...") */}
      {selectedOrderDetail && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '1rem'
          }}
          onClick={() => setSelectedOrderDetail(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.1rem 1.25rem',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8fafc',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    background: '#0f172a',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    fontWeight: 900,
                    padding: '0.2rem 0.55rem',
                    borderRadius: '6px'
                  }}
                >
                  {selectedOrderDetail.orderNumber}
                </span>
                <span
                  style={{
                    background:
                      selectedOrderDetail.deliveryType === 'DINE_IN'
                        ? '#ffedd5'
                        : selectedOrderDetail.deliveryType === 'TAKE_OUT'
                        ? '#e0f2fe'
                        : '#dcfce7',
                    color:
                      selectedOrderDetail.deliveryType === 'DINE_IN'
                        ? '#c2410c'
                        : selectedOrderDetail.deliveryType === 'TAKE_OUT'
                        ? '#0369a1'
                        : '#15803d',
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    padding: '0.2rem 0.5rem',
                    borderRadius: '6px'
                  }}
                >
                  {selectedOrderDetail.deliveryType === 'DINE_IN'
                    ? selectedOrderDetail.tableNumber || 'Mesa'
                    : selectedOrderDetail.deliveryType === 'TAKE_OUT'
                    ? 'Para Llevar'
                    : 'A Domicilio'}
                </span>
                <div>{getStatusBadge(selectedOrderDetail.status)}</div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrderDetail(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px'
                }}
                title="Cerrar detalle"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Customer & Delivery Information */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '0.75rem 0.9rem',
                  fontSize: '0.82rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                    {selectedOrderDetail.customerName || (selectedOrderDetail.tableNumber ? `${selectedOrderDetail.tableNumber}` : 'Cliente')}
                  </span>
                  {(selectedOrderDetail.customerPhone || selectedOrderDetail.deliveryPhone) && (
                    <button
                      type="button"
                      onClick={() => handleSendWhatsAppNotification(selectedOrderDetail)}
                      style={{
                        background: '#f0fdf4',
                        color: '#16a34a',
                        border: '1px solid #bbf7d0',
                        borderRadius: '6px',
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                      title="Enviar mensaje de WhatsApp"
                    >
                      <MessageCircle size={13} />
                      <span>{selectedOrderDetail.customerPhone || selectedOrderDetail.deliveryPhone}</span>
                    </button>
                  )}
                </div>

                {selectedOrderDetail.deliveryAddress && (
                  <div style={{ color: '#475569' }}>
                    <strong>Dirección de entrega:</strong> {selectedOrderDetail.deliveryAddress}
                  </div>
                )}

                {selectedOrderDetail.driverName && (
                  <div style={{ color: '#16a34a', fontWeight: 700 }}>
                    Repartidor asignado: {selectedOrderDetail.driverName} ({selectedOrderDetail.driverType || 'PROPIO'})
                  </div>
                )}
              </div>

              {/* Complete Items List */}
              <div>
                <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.82rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                  Platillos ({selectedOrderDetail.items.length})
                </h5>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {selectedOrderDetail.items.map((it, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '0.6rem 0.75rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.2rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.85rem' }}>
                          <span style={{ color: '#ea580c', fontWeight: 900 }}>{it.quantity}x</span> {it.name}
                        </span>
                        <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.85rem' }}>
                          {formatCurrency(it.subtotal, tenant.currencySymbol)}
                        </span>
                      </div>

                      {/* Extras */}
                      {it.selectedExtras && it.selectedExtras.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.15rem' }}>
                          {it.selectedExtras.map((ex, eIdx) => (
                            <span
                              key={eIdx}
                              style={{
                                background: '#f1f5f9',
                                color: '#475569',
                                fontSize: '0.7rem',
                                padding: '0.1rem 0.35rem',
                                borderRadius: '4px',
                                fontWeight: 600
                              }}
                            >
                              + {ex.name} ({formatCurrency(ex.price, tenant.currencySymbol)})
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Notes */}
                      {it.notes && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', marginTop: '0.1rem' }}>
                          Nota: {it.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Breakdown */}
              <div
                style={{
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  fontSize: '0.82rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>Subtotal:</span>
                  <span>{formatCurrency(selectedOrderDetail.subtotal, tenant.currencySymbol)}</span>
                </div>

                {Boolean(selectedOrderDetail.deliveryFee && selectedOrderDetail.deliveryFee > 0) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                    <span>Envío a domicilio:</span>
                    <span>{formatCurrency(selectedOrderDetail.deliveryFee || 0, tenant.currencySymbol)}</span>
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 900,
                    fontSize: '1.2rem',
                    color: '#0f172a',
                    paddingTop: '0.25rem',
                    borderTop: '1px dashed #cbd5e1'
                  }}
                >
                  <span>Total:</span>
                  <span style={{ color: isOrderPaidEffective(selectedOrderDetail) ? '#15803d' : '#ea580c' }}>
                    {formatCurrency(selectedOrderDetail.total, tenant.currencySymbol)}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div
              style={{
                padding: '0.9rem 1.25rem',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc',
                borderBottomLeftRadius: '16px',
                borderBottomRightRadius: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => handlePrintKitchenTicket(selectedOrderDetail)}
                  style={{
                    padding: '0.45rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem'
                  }}
                  title="Imprimir ticket para cocina"
                >
                  <Printer size={14} />
                  <span>Imprimir Cocina</span>
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {!isOrderPaidEffective(selectedOrderDetail) && selectedOrderDetail.status !== 'CANCELLED' && (
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentModalOrder(selectedOrderDetail);
                      setSelectedOrderDetail(null);
                    }}
                    style={{
                      padding: '0.45rem 1rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#059669',
                      color: '#ffffff',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      boxShadow: '0 2px 4px rgba(5, 150, 105, 0.25)'
                    }}
                  >
                    <DollarSign size={15} />
                    <span>COBRAR {formatCurrency(selectedOrderDetail.total, tenant.currencySymbol)}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedOrderDetail(null)}
                  style={{
                    padding: '0.45rem 0.9rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#0f172a',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
