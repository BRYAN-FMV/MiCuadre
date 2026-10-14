import React, { useState } from 'react';
import { DeliveryDriver, DriverType } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { formatCurrency } from '../../lib/monetary';
import { X, Bike, CheckCircle, Plus, DollarSign, AlertCircle, Phone } from 'lucide-react';
import { toast } from 'sonner';

interface DriverSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DriverSettlementModal: React.FC<DriverSettlementModalProps> = ({
  isOpen,
  onClose
}) => {
  const tenant = useAppStore(state => state.tenant);
  const activeShift = useAppStore(state => state.activeShift);
  const deliveryDrivers = useAppStore(state => state.deliveryDrivers);
  const foodOrders = useAppStore(state => state.foodOrders);
  const addDeliveryDriver = useAppStore(state => state.addDeliveryDriver);
  const settleDriverOrders = useAppStore(state => state.settleDriverOrders);
  const updateFoodOrder = useAppStore(state => state.updateFoodOrder);

  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [isNewDriverModalOpen, setIsNewDriverModalOpen] = useState(false);
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverPhone, setNewDriverPhone] = useState('');
  const [newDriverType, setNewDriverType] = useState<DriverType>('EXTERNAL_MANDADITO');

  if (!isOpen) return null;

  const tenantDrivers = deliveryDrivers.filter(d => (!d.tenantId || d.tenantId === tenant.id) && d.isActive);

  // Unassigned delivery orders (dispatched without driver or missing assignment)
  const unassignedOrders = foodOrders.filter(
    o => (!o.tenantId || o.tenantId === tenant.id) &&
         o.deliveryType === 'DELIVERY' &&
         !o.driverSettled &&
         o.status !== 'CANCELLED' &&
         (!o.driverId && !o.deliveryDriverId)
  );

  // Driver with pending unsettled deliveries
  const driverWithPending = tenantDrivers.find(d =>
    foodOrders.some(
      o => (!o.tenantId || o.tenantId === tenant.id) &&
           (o.deliveryDriverId === d.id || o.driverId === d.id) &&
           o.deliveryType === 'DELIVERY' &&
           !o.driverSettled &&
           o.status !== 'CANCELLED'
    )
  );

  // Set default driver if none selected
  const activeDriver = tenantDrivers.find(d => d.id === selectedDriverId) || driverWithPending || tenantDrivers[0];

  const unsettledOrders = activeDriver
    ? foodOrders.filter(
        o => (!o.tenantId || o.tenantId === tenant.id) &&
             (o.deliveryDriverId === activeDriver.id || o.driverId === activeDriver.id) &&
             o.deliveryType === 'DELIVERY' &&
             !o.driverSettled &&
             o.status !== 'CANCELLED'
      )
    : [];

  const isInternal = activeDriver?.driverType === 'INTERNAL';

  // Calculate settlement amounts
  const totalFood = unsettledOrders.reduce((acc, o) => acc + o.subtotal, 0);
  const totalDeliveryFees = unsettledOrders.reduce((acc, o) => acc + (o.deliveryFee || 0), 0);
  const totalCashToCollect = isInternal ? totalFood + totalDeliveryFees : totalFood;

  const handleCreateDriver = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriverName.trim()) {
      toast.error('Ingrese el nombre del repartidor');
      return;
    }
    const created = addDeliveryDriver({
      fullName: newDriverName.trim(),
      phone: newDriverPhone.trim() || undefined,
      driverType: newDriverType,
      isActive: true
    });
    toast.success(`Repartidor ${created.fullName} agregado`);
    setSelectedDriverId(created.id);
    setNewDriverName('');
    setNewDriverPhone('');
    setIsNewDriverModalOpen(false);
  };

  const handleSettle = () => {
    if (!activeDriver) return;
    if (unsettledOrders.length === 0) {
      toast.error('No hay pedidos pendientes de liquidación para este repartidor');
      return;
    }
    if (!activeShift) {
      toast.warning('No hay un turno de caja abierto. El efectivo se marcará como liquidado pero abra caja para cuadrar en el Cierre Z.');
    }

    const result = settleDriverOrders(activeDriver.id, activeShift?.id);
    toast.success(`Liquidación exitosa: ${result.ordersCount} pedidos liquidados por ${formatCurrency(result.totalCash, tenant.currencySymbol)}.`);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: '#ffffff', borderRadius: '16px', maxWidth: '780px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Bike size={22} style={{ color: '#0284c7' }} />
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                Liquidación de Repartidores & Mandaditos
              </h3>
            </div>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
              Cuadre y entrega de efectivo de pedidos a domicilio en caja.
            </p>
          </div>

          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}>
            <X size={22} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem', flex: 1 }}>
          
          {/* Driver Selector & Add Button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '260px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>Repartidor:</span>
              <select
                className="input-control"
                value={activeDriver?.id || ''}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                style={{ fontSize: '0.85rem', fontWeight: 600, flex: 1 }}
              >
                {tenantDrivers.length === 0 ? (
                  <option value="">Sin repartidores registrados</option>
                ) : (
                  tenantDrivers.map(d => {
                    const count = foodOrders.filter(
                      o => (!o.tenantId || o.tenantId === tenant.id) &&
                           (o.deliveryDriverId === d.id || o.driverId === d.id) &&
                           o.deliveryType === 'DELIVERY' &&
                           !o.driverSettled &&
                           o.status !== 'CANCELLED'
                    ).length;

                    return (
                      <option key={d.id} value={d.id}>
                        {d.fullName} ({d.driverType === 'INTERNAL' ? 'Personal Interno' : 'Mandadito Externo'}) {count > 0 ? `• [${count} pendiente(s)]` : ''}
                      </option>
                    );
                  })
                )}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setIsNewDriverModalOpen(true)}
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Plus size={14} />
              <span>Nuevo Repartidor</span>
            </button>
          </div>

          {/* Unassigned Delivery Orders Banner */}
          {unassignedOrders.length > 0 && (
            <div style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '10px',
              padding: '0.75rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#92400e', fontWeight: 700, fontSize: '0.82rem' }}>
                  <AlertCircle size={16} style={{ color: '#d97706', flexShrink: 0 }} />
                  <span>Pedidos a domicilio sin repartidor asignado ({unassignedOrders.length}):</span>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#b45309' }}>
                  Asigne estos pedidos a un repartidor para incluirlos en la liquidación
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '130px', overflowY: 'auto' }}>
                {unassignedOrders.map(order => (
                  <div
                    key={order.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#ffffff',
                      border: '1px solid #fef3c7',
                      borderRadius: '6px',
                      padding: '0.45rem 0.65rem',
                      fontSize: '0.78rem'
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 800, color: '#0f172a', marginRight: '0.4rem' }}>
                        #{order.orderNumber}
                      </span>
                      <span style={{ color: '#475569', fontWeight: 600 }}>
                        {order.customerName || 'Cliente Domicilio'}
                      </span>
                      {order.deliveryAddress && (
                        <span style={{ color: '#94a3b8', fontSize: '0.72rem', marginLeft: '0.35rem' }}>
                          - {order.deliveryAddress}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span style={{ fontWeight: 800, color: '#0f172a' }}>
                        {formatCurrency(order.total, tenant.currencySymbol)}
                      </span>
                      {activeDriver && (
                        <button
                          type="button"
                          onClick={() => {
                            updateFoodOrder(order.id, {
                              driverId: activeDriver.id,
                              deliveryDriverId: activeDriver.id,
                              driverName: activeDriver.fullName,
                              driverType: activeDriver.driverType
                            });
                            toast.success(`Pedido #${order.orderNumber} asignado a ${activeDriver.fullName}`);
                          }}
                          className="btn btn-secondary"
                          style={{
                            fontSize: '0.72rem',
                            padding: '0.2rem 0.55rem',
                            background: '#f0f9ff',
                            borderColor: '#bae6fd',
                            color: '#0284c7',
                            fontWeight: 700
                          }}
                        >
                          Asignar a {activeDriver.fullName}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeDriver ? (
            <>
              {/* Driver Type Rule Notice */}
              <div
                style={{
                  background: isInternal ? '#f0fdf4' : '#f0f9ff',
                  border: isInternal ? '1px solid #bbf7d0' : '1px solid #bae6fd',
                  borderRadius: '10px',
                  padding: '0.75rem 1rem',
                  fontSize: '0.82rem',
                  color: isInternal ? '#166534' : '#0369a1',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.6rem'
                }}
              >
                <AlertCircle size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>
                    {isInternal ? 'Empleado Interno (Sueldo Fijo):' : 'Mandadito Externo (Tercero):'}
                  </strong>{' '}
                  {isInternal
                    ? 'El repartidor entrega a caja el 100% del efectivo recaudado (Comida + Envío).'
                    : 'El cliente pagó el valor del envío directamente en mano al mandadito. El repartidor entrega a caja únicamente el valor neto de la comida.'}
                </div>
              </div>

              {/* Orders Table */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px 90px 110px', padding: '0.6rem 0.85rem', background: '#f8fafc', fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  <span>Pedido</span>
                  <span>Cliente / Dirección</span>
                  <span style={{ textAlign: 'right' }}>Comida</span>
                  <span style={{ textAlign: 'right' }}>Envío</span>
                  <span style={{ textAlign: 'right' }}>Entrega a Caja</span>
                </div>

                <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                  {unsettledOrders.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                      No hay pedidos pendientes de liquidación para este repartidor hoy.
                    </div>
                  ) : (
                    unsettledOrders.map(order => {
                      const orderCollect = isInternal ? order.subtotal + (order.deliveryFee || 0) : order.subtotal;

                      return (
                        <div
                          key={order.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '80px 1fr 100px 90px 110px',
                            padding: '0.65rem 0.85rem',
                            borderBottom: '1px solid #f1f5f9',
                            alignItems: 'center',
                            fontSize: '0.8rem'
                          }}
                        >
                          <span style={{ fontWeight: 800, color: '#0f172a' }}>
                            #{order.orderNumber}
                          </span>
                          <div>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>
                              {order.customerName || 'Cliente Domicilio'}
                            </div>
                            {order.deliveryAddress && (
                              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                {order.deliveryAddress}
                              </div>
                            )}
                          </div>
                          <span style={{ textAlign: 'right', color: '#475569' }}>
                            {formatCurrency(order.subtotal, tenant.currencySymbol)}
                          </span>
                          <span style={{ textAlign: 'right', color: isInternal ? '#166534' : '#94a3b8', fontWeight: isInternal ? 600 : 400 }}>
                            {formatCurrency(order.deliveryFee || 0, tenant.currencySymbol)}
                          </span>
                          <span style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                            {formatCurrency(orderCollect, tenant.currencySymbol)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Settlement Summary Box */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '1.5rem' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Pedidos Pendientes:</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                      {unsettledOrders.length}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Total Comida:</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#334155' }}>
                      {formatCurrency(totalFood, tenant.currencySymbol)}
                    </div>
                  </div>
                  {isInternal && (
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Total Envíos:</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#166534' }}>
                        +{formatCurrency(totalDeliveryFees, tenant.currencySymbol)}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase' }}>
                    Efectivo a Entregar a Caja:
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
                    {formatCurrency(totalCashToCollect, tenant.currencySymbol)}
                  </div>
                </div>
              </div>

              {/* Settlement CTA Button */}
              <button
                type="button"
                onClick={handleSettle}
                disabled={unsettledOrders.length === 0}
                className="btn btn-primary"
                style={{
                  padding: '0.75rem',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  background: '#0284c7',
                  borderColor: '#0284c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <CheckCircle size={18} />
                <span>Liquidar Efectivo y Registrar Ingreso en Caja ({formatCurrency(totalCashToCollect, tenant.currencySymbol)})</span>
              </button>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
              <Bike size={44} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
              <p style={{ fontWeight: 600, color: '#475569' }}>No hay repartidores registrados en este comercio.</p>
              <button
                type="button"
                onClick={() => setIsNewDriverModalOpen(true)}
                className="btn btn-primary"
                style={{ marginTop: '0.5rem', fontSize: '0.82rem' }}
              >
                Crear Primer Repartidor
              </button>
            </div>
          )}

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

      {/* New Driver Submodal */}
      {isNewDriverModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#ffffff', borderRadius: '14px', maxWidth: '420px', width: '100%', padding: '1.5rem', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                Nuevo Repartidor / Motorista
              </h4>
              <button onClick={() => setIsNewDriverModalOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateDriver} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.3rem' }}>
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Carlos Mendoza"
                  className="input-control"
                  value={newDriverName}
                  onChange={(e) => setNewDriverName(e.target.value)}
                  style={{ width: '100%', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.3rem' }}>
                  Teléfono / WhatsApp
                </label>
                <input
                  type="tel"
                  placeholder="Ej. 9988-7766"
                  className="input-control"
                  value={newDriverPhone}
                  onChange={(e) => setNewDriverPhone(e.target.value)}
                  style={{ width: '100%', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.3rem' }}>
                  Tipo de Repartidor *
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <label style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', border: newDriverType === 'EXTERNAL_MANDADITO' ? '2px solid #0284c7' : '1px solid #cbd5e1', background: newDriverType === 'EXTERNAL_MANDADITO' ? '#f0f9ff' : '#ffffff', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <input
                      type="radio"
                      name="driverType"
                      checked={newDriverType === 'EXTERNAL_MANDADITO'}
                      onChange={() => setNewDriverType('EXTERNAL_MANDADITO')}
                      style={{ display: 'none' }}
                    />
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>Mandadito Externo</span>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Cliente paga envío en mano</span>
                  </label>

                  <label style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', border: newDriverType === 'INTERNAL' ? '2px solid #16a34a' : '1px solid #cbd5e1', background: newDriverType === 'INTERNAL' ? '#f0fdf4' : '#ffffff', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <input
                      type="radio"
                      name="driverType"
                      checked={newDriverType === 'INTERNAL'}
                      onChange={() => setNewDriverType('INTERNAL')}
                      style={{ display: 'none' }}
                    />
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>Personal Interno</span>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Entrega 100% a caja</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsNewDriverModalOpen(false)}
                  style={{ fontSize: '0.82rem', padding: '0.45rem 1rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ fontSize: '0.82rem', padding: '0.45rem 1.25rem', background: '#0284c7', borderColor: '#0284c7' }}
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
