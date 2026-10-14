import React from 'react';
import { FoodOrder } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { formatCurrency } from '../../lib/monetary';
import { X, Utensils, Clock, CheckCircle2, DollarSign, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface TablesGridModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTable: (tableNumber: string) => void;
  onChargeTable: (order: FoodOrder) => void;
  onEditOrder: (order: FoodOrder) => void;
}

const DEFAULT_TABLES = [
  'Mesa 1', 'Mesa 2', 'Mesa 3', 'Mesa 4',
  'Mesa 5', 'Mesa 6', 'Mesa 7', 'Mesa 8',
  'Mesa 9', 'Mesa 10', 'Mesa 11', 'Mesa 12',
  'Barra', 'Terraza 1', 'Terraza 2'
];

export const TablesGridModal: React.FC<TablesGridModalProps> = ({
  isOpen,
  onClose,
  onSelectTable,
  onChargeTable,
  onEditOrder
}) => {
  const tenant = useAppStore(state => state.tenant);
  const foodOrders = useAppStore(state => state.foodOrders);
  const cancelFoodOrder = useAppStore(state => state.cancelFoodOrder);

  if (!isOpen) return null;

  // Active dine-in orders for current tenant
  const activeOrders = foodOrders.filter(
    o => (!o.tenantId || o.tenantId === tenant.id) &&
         o.status === 'OPEN' &&
         o.deliveryType === 'DINE_IN'
  );

  const getTableOrder = (tableId: string): FoodOrder | undefined => {
    return activeOrders.find(o => o.tableNumber === tableId);
  };

  const getElapsedTime = (isoDate: string): string => {
    try {
      const diffMs = Date.now() - new Date(isoDate).getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return 'Hace un momento';
      if (mins < 60) return `Hace ${mins} min`;
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `Hace ${hrs}h ${remMins}m`;
    } catch {
      return '';
    }
  };

  const handleCancel = (order: FoodOrder) => {
    if (window.confirm(`¿Está seguro de cancelar la comanda de ${order.tableNumber}? Esta acción no se puede deshacer.`)) {
      cancelFoodOrder(order.id);
      toast.info(`Comanda de ${order.tableNumber} cancelada. Mesa liberada.`);
    }
  };

  const occupiedCount = activeOrders.length;
  const freeCount = DEFAULT_TABLES.length - occupiedCount;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: '#ffffff', borderRadius: '16px', maxWidth: '820px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Utensils size={20} style={{ color: '#ea580c' }} />
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                Mesas y Cuentas Activas
              </h3>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.35rem', fontSize: '0.78rem' }}>
              <span style={{ color: '#047857', fontWeight: 700 }}>Libres: {freeCount}</span>
              <span style={{ color: '#64748b' }}>•</span>
              <span style={{ color: '#ea580c', fontWeight: 700 }}>Ocupadas: {occupiedCount}</span>
            </div>
          </div>

          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}>
            <X size={22} />
          </button>
        </div>

        {/* Tables Grid */}
        <div style={{ padding: '1.25rem 1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', overflowY: 'auto', flex: 1 }}>
          {DEFAULT_TABLES.map(tableId => {
            const order = getTableOrder(tableId);
            const isOccupied = Boolean(order);

            return (
              <div
                key={tableId}
                style={{
                  borderRadius: '12px',
                  border: isOccupied ? '2px solid #ea580c' : '1px solid #cbd5e1',
                  background: isOccupied ? '#fffaf5' : '#ffffff',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: isOccupied ? '0 4px 12px rgba(234, 88, 12, 0.12)' : '0 1px 3px rgba(0,0,0,0.03)',
                  transition: 'all 0.15s ease'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                      {tableId}
                    </h4>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.5rem',
                        borderRadius: '12px',
                        background: isOccupied ? '#ffedd5' : '#dcfce7',
                        color: isOccupied ? '#c2410c' : '#15803d'
                      }}
                    >
                      {isOccupied ? 'Ocupada' : 'Libre'}
                    </span>
                  </div>

                  {isOccupied && order ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Clock size={12} />
                        <span>{getElapsedTime(order.createdAt)}</span>
                      </div>

                      <div style={{ fontSize: '0.78rem', color: '#334155', fontWeight: 600 }}>
                        {order.items.length} {order.items.length === 1 ? 'platillo' : 'platillos'}
                      </div>

                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ea580c', marginTop: '0.2rem' }}>
                        {formatCurrency(order.total, tenant.currencySymbol)}
                      </div>

                      {order.customerName && order.customerName !== 'Consumidor Final' && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          Cliente: {order.customerName}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '1rem 0' }}>
                      Mesa disponible sin pedidos pendientes.
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {isOccupied && order ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          onChargeTable(order);
                          onClose();
                        }}
                        style={{
                          width: '100%',
                          padding: '0.45rem',
                          borderRadius: '8px',
                          border: 'none',
                          background: '#16a34a',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        <DollarSign size={14} />
                        <span>Cobrar Cuenta</span>
                      </button>

                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button
                          type="button"
                          onClick={() => {
                            onEditOrder(order);
                            onClose();
                          }}
                          style={{
                            flex: 1,
                            padding: '0.4rem',
                            borderRadius: '6px',
                            border: '1px solid #ea580c',
                            background: '#ffffff',
                            color: '#ea580c',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                        >
                          Ver / Ronda
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCancel(order)}
                          style={{
                            padding: '0.4rem 0.6rem',
                            borderRadius: '6px',
                            border: '1px solid #fca5a5',
                            background: '#fee2e2',
                            color: '#dc2626',
                            cursor: 'pointer'
                          }}
                          title="Cancelar comanda y liberar mesa"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectTable(tableId);
                        onClose();
                      }}
                      style={{
                        width: '100%',
                        padding: '0.45rem',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        background: '#f8fafc',
                        color: '#0f172a',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <Plus size={14} />
                      <span>Abrir Comanda</span>
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '0.9rem 1.5rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
