import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { FoodOrder, FoodOrderStatus, Sale } from '../../types';
import { formatCurrency } from '../../lib/monetary';
import { generateKitchenEscPosTicket, generateEscPosReceipt } from '../../lib/escPos';
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
  Filter
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

  // Modals State
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [paymentModalOrder, setPaymentModalOrder] = useState<FoodOrder | null>(null);
  const [isDriversModalOpen, setIsDriversModalOpen] = useState(false);

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
    if (order.isPaid || order.status === 'COMPLETED' || order.status === 'DELIVERED' || order.status === 'CANCELLED') {
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
      const bytes = generateKitchenEscPosTicket({
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
      const blob = new Blob([bytes], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const printWin = window.open(url, '_blank');
      if (printWin) printWin.focus();
    } catch (err) {
      console.warn('Error al imprimir ticket:', err);
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
      const bytes = generateEscPosReceipt(sale, tenant, 'ORIGINAL');
      const blob = new Blob([bytes], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const printWin = window.open(url, '_blank');
      if (printWin) printWin.focus();
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

  // Filtered & Sorted Orders
  const filteredOrders = useMemo(() => {
    return foodOrders.filter(o => {
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        o.orderNumber.toLowerCase().includes(search) ||
        (o.customerName && o.customerName.toLowerCase().includes(search)) ||
        (o.tableNumber && o.tableNumber.toLowerCase().includes(search)) ||
        (o.deliveryAddress && o.deliveryAddress.toLowerCase().includes(search)) ||
        (o.driverName && o.driverName.toLowerCase().includes(search));

      if (!matchesSearch) return false;

      if (statusFilter === 'KITCHEN') {
        return (o.status === 'ORDERED' || o.status === 'PREPARING') && !o.isPaid;
      }
      if (statusFilter === 'TABLES') {
        return o.deliveryType === 'DINE_IN' && !o.isPaid;
      }
      if (statusFilter === 'DELIVERY') {
        return o.deliveryType === 'DELIVERY' && !o.isPaid;
      }
      if (statusFilter === 'COMPLETED') {
        return o.isPaid || o.status === 'COMPLETED' || o.status === 'DELIVERED';
      }

      return true;
    });
  }, [foodOrders, searchTerm, statusFilter]);

  // Sort: Active unpaid first (urgent oldest first), Completed at the bottom
  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      const aDone = a.isPaid || a.status === 'COMPLETED' || a.status === 'DELIVERED' || a.status === 'CANCELLED';
      const bDone = b.isPaid || b.status === 'COMPLETED' || b.status === 'DELIVERED' || b.status === 'CANCELLED';

      if (aDone && !bDone) return 1;
      if (!aDone && bDone) return -1;

      // Both active: oldest created first
      if (!aDone && !bDone) {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }

      // Both done: newest first
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [filteredOrders]);

  // KPI Metrics
  const activeCount = foodOrders.filter(o => !o.isPaid && o.status !== 'CANCELLED').length;
  const inKitchenCount = foodOrders.filter(o => (o.status === 'ORDERED' || o.status === 'PREPARING') && !o.isPaid).length;
  const tablesCount = foodOrders.filter(o => o.deliveryType === 'DINE_IN' && !o.isPaid && o.status !== 'CANCELLED').length;
  const deliveryCount = foodOrders.filter(o => o.deliveryType === 'DELIVERY' && !o.isPaid && o.status !== 'CANCELLED').length;
  const completedCount = foodOrders.filter(o => o.isPaid || o.status === 'COMPLETED' || o.status === 'DELIVERED').length;

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

      {/* 2. Search & Filter Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        
        {/* Search */}
        <div style={{ position: 'relative', minWidth: '280px', flex: 1, maxWidth: '400px' }}>
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
            Todas ({foodOrders.length})
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

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
            onClick={() => setIsNewOrderModalOpen(true)}
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
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
            const isCompleted = order.isPaid || order.status === 'COMPLETED' || order.status === 'DELIVERED';
            const isCancelled = order.status === 'CANCELLED';

            return (
              <div
                key={order.id}
                style={{
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
                  borderRadius: '14px',
                  padding: '1.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  boxShadow: isCompleted ? 'none' : '0 2px 6px rgba(0,0,0,0.04)',
                  opacity: isCancelled ? 0.7 : isCompleted ? 0.85 : 1
                }}
              >
                {/* Urgency Highlight Banner if active */}
                {urgency && (
                  <div style={urgency.style}>
                    <Clock size={13} />
                    <span>{urgency.label}</span>
                  </div>
                )}

                {/* Top Line: Number & Destination Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      style={{
                        background: '#0f172a',
                        color: '#ffffff',
                        fontSize: '0.82rem',
                        fontWeight: 900,
                        padding: '0.2rem 0.55rem',
                        borderRadius: '6px'
                      }}
                    >
                      {order.orderNumber}
                    </span>

                    {/* Destination Pill */}
                    <span
                      style={{
                        background: order.deliveryType === 'DINE_IN' ? '#ffedd5' : order.deliveryType === 'TAKE_OUT' ? '#e0f2fe' : '#dcfce7',
                        color: order.deliveryType === 'DINE_IN' ? '#c2410c' : order.deliveryType === 'TAKE_OUT' ? '#0369a1' : '#15803d',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        padding: '0.2rem 0.5rem',
                        borderRadius: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      {order.deliveryType === 'DINE_IN' ? (
                        <>
                          <Utensils size={13} />
                          <span>{order.tableNumber || 'Mesa'}</span>
                        </>
                      ) : order.deliveryType === 'TAKE_OUT' ? (
                        <>
                          <ShoppingBag size={13} />
                          <span>Para Llevar</span>
                        </>
                      ) : (
                        <>
                          <Bike size={13} />
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
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                    {order.customerName || (order.tableNumber ? `${order.tableNumber}` : 'Cliente')}
                  </h4>
                  {(order.customerPhone || order.deliveryPhone) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem', fontSize: '0.78rem', color: '#64748b' }}>
                      <Phone size={12} />
                      <span>{order.customerPhone || order.deliveryPhone}</span>
                    </div>
                  )}
                  {order.deliveryAddress && (
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                      <strong>Dir:</strong> {order.deliveryAddress}
                    </div>
                  )}
                  {order.driverName && (
                    <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700, marginTop: '0.15rem' }}>
                      Repartidor: {order.driverName}
                    </div>
                  )}
                </div>

                {/* Food Items Breakdown */}
                <div
                  style={{
                    background: isCompleted ? '#ffffff' : '#f8fafc',
                    borderRadius: '10px',
                    padding: '0.65rem 0.75rem',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem',
                    fontSize: '0.8rem'
                  }}
                >
                  {order.items.map((it, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>
                          <span style={{ color: '#ea580c', fontWeight: 800 }}>{it.quantity}x</span> {it.name}
                        </span>
                        <span style={{ color: '#475569', fontWeight: 700, fontSize: '0.78rem' }}>
                          {formatCurrency(it.subtotal, tenant.currencySymbol)}
                        </span>
                      </div>

                      {/* Extras */}
                      {it.selectedExtras && it.selectedExtras.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.15rem' }}>
                          {it.selectedExtras.map((ex, eIdx) => (
                            <span
                              key={eIdx}
                              style={{
                                background: '#f1f5f9',
                                color: '#475569',
                                fontSize: '0.68rem',
                                padding: '0.1rem 0.35rem',
                                borderRadius: '4px',
                                fontWeight: 600
                              }}
                            >
                              + {ex.name}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Notes */}
                      {it.notes && (
                        <span style={{ fontSize: '0.72rem', fontStyle: 'italic', color: '#64748b', marginTop: '0.1rem' }}>
                          Nota: {it.notes}
                        </span>
                      )}
                    </div>
                  ))}

                  {order.deliveryFee && order.deliveryFee > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.3rem', borderTop: '1px dashed #cbd5e1', fontSize: '0.75rem', color: '#64748b' }}>
                      <span>Envío a domicilio:</span>
                      <span>{formatCurrency(order.deliveryFee, tenant.currencySymbol)}</span>
                    </div>
                  )}
                </div>

                {/* Total & Status Selector */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.2rem' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, display: 'block' }}>Total Comanda:</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 900, color: isCompleted ? '#15803d' : '#ea580c' }}>
                      {formatCurrency(order.total, tenant.currencySymbol)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Estado:</label>
                    <select
                      className="input-control"
                      value={order.status}
                      disabled={isCompleted || isCancelled}
                      onChange={(e) => handleStatusChange(order, e.target.value as FoodOrderStatus)}
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.4rem', height: '32px' }}
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

                {/* Primary Card Actions: Direct Checkout vs Paid Indicator */}
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem' }}>
                  {!isCompleted && !isCancelled ? (
                    <>
                      {order.status === 'ORDERED' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(order, 'PREPARING')}
                          style={{
                            minHeight: '44px',
                            padding: '0.55rem 0.75rem',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            borderRadius: '8px',
                            border: '1px solid #fed7aa',
                            background: '#fff7ed',
                            color: '#ea580c',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            whiteSpace: 'nowrap'
                          }}
                          title="Pasar comanda a En Cocina con 1 toque"
                        >
                          <Utensils size={15} />
                          <span>A Cocina</span>
                        </button>
                      )}

                      {order.status === 'PREPARING' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(order, 'SERVED')}
                          style={{
                            minHeight: '44px',
                            padding: '0.55rem 0.75rem',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            borderRadius: '8px',
                            border: '1px solid #bfdbfe',
                            background: '#eff6ff',
                            color: '#2563eb',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            whiteSpace: 'nowrap'
                          }}
                          title="Marcar comanda como Servida / Lista"
                        >
                          <CheckCircle2 size={15} />
                          <span>Servir / Listo</span>
                        </button>
                      )}

                      {order.status === 'SERVED' && order.deliveryType === 'DELIVERY' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(order, 'IN_TRANSIT')}
                          style={{
                            minHeight: '44px',
                            padding: '0.55rem 0.75rem',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            borderRadius: '8px',
                            border: '1px solid #bbf7d0',
                            background: '#f0fdf4',
                            color: '#16a34a',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            whiteSpace: 'nowrap'
                          }}
                          title="Marcar pedido En Camino con repartidor"
                        >
                          <Bike size={15} />
                          <span>En Camino</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setPaymentModalOrder(order)}
                        style={{
                          flex: 2,
                          minHeight: '44px',
                          padding: '0.55rem',
                          fontSize: '0.85rem',
                          fontWeight: 800,
                          borderRadius: '8px',
                          border: 'none',
                          background: '#059669',
                          color: '#ffffff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem',
                          boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)'
                        }}
                        title="Cobro directo sin pasar por el carrito de ventas"
                      >
                        <DollarSign size={16} />
                        <span>COBRAR {formatCurrency(order.total, tenant.currencySymbol)}</span>
                      </button>
                    </>
                  ) : isCompleted ? (
                    <div
                      style={{
                        flex: 2,
                        minHeight: '40px',
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        color: '#16a34a',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <CheckCircle2 size={16} />
                      <span>Cobrado con Éxito</span>
                    </div>
                  ) : (
                    <div
                      style={{
                        flex: 2,
                        minHeight: '40px',
                        background: '#fef2f2',
                        border: '1px solid #fecdd3',
                        color: '#991b1b',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <span>Orden Cancelada</span>
                    </div>
                  )}

                  {/* Print Kitchen Ticket Button */}
                  {!isCompleted && !isCancelled && (
                    <button
                      type="button"
                      onClick={() => handlePrintKitchenTicket(order)}
                      style={{
                        width: '42px',
                        minHeight: '44px',
                        borderRadius: '8px',
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
                      <Printer size={16} />
                    </button>
                  )}

                  {/* WhatsApp Notification Button */}
                  {(order.customerPhone || order.deliveryPhone) && (
                    <button
                      type="button"
                      onClick={() => handleSendWhatsAppNotification(order)}
                      style={{
                        width: '42px',
                        minHeight: '44px',
                        borderRadius: '8px',
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
                      <MessageCircle size={16} />
                    </button>
                  )}

                  {/* Reprint Receipt if completed */}
                  {isCompleted && order.saleId && (
                    <button
                      type="button"
                      onClick={() => handleReprintSaleReceipt(order)}
                      style={{
                        padding: '0.4rem 0.65rem',
                        minHeight: '40px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#475569',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        cursor: 'pointer'
                      }}
                      title="Reimprimir comprobante de pago"
                    >
                      <Printer size={14} />
                      <span>Ticket</span>
                    </button>
                  )}

                  {/* Cancel Button if active */}
                  {!isCompleted && !isCancelled && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`¿Cancelar la comanda ${order.orderNumber}?`)) {
                          cancelFoodOrder(order.id);
                          toast.info(`Comanda ${order.orderNumber} cancelada`);
                        }
                      }}
                      style={{
                        width: '42px',
                        minHeight: '44px',
                        borderRadius: '8px',
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
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New Food Order Modal */}
      <NewFoodOrderModal
        isOpen={isNewOrderModalOpen}
        onClose={() => setIsNewOrderModalOpen(false)}
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
    </div>
  );
};
