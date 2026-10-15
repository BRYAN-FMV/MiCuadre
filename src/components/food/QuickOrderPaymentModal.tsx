import React, { useState, useEffect } from 'react';
import { FoodOrder, Sale } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { formatCurrency } from '../../lib/monetary';
import { generateEscPosReceipt } from '../../lib/escPos';
import { X, DollarSign, CreditCard, Send, CheckCircle2, Printer, AlertTriangle, Utensils, Bike, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';

interface QuickOrderPaymentModalProps {
  order: FoodOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (sale: Sale) => void;
}

export const QuickOrderPaymentModal: React.FC<QuickOrderPaymentModalProps> = ({
  order,
  isOpen,
  onClose,
  onSuccess
}) => {
  const tenant = useAppStore(state => state.tenant);
  const activeShift = useAppStore(state => state.activeShift);
  const processFoodOrderSale = useAppStore(state => state.processFoodOrderSale);

  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER'>('CASH');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [isFiscal, setIsFiscal] = useState<boolean>(tenant.isFiscalEnabled || false);
  const [shouldPrint, setShouldPrint] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (order) {
      setPaymentMethod('CASH');
      setCashReceived(String(order.total));
      setIsFiscal(tenant.isFiscalEnabled || false);
      setShouldPrint(true);
      setIsSubmitting(false);
    }
  }, [order, tenant.isFiscalEnabled]);

  if (!isOpen || !order) return null;

  const total = order.total;
  const receivedNum = parseFloat(cashReceived) || 0;
  const change = Math.max(0, receivedNum - total);
  const isCashInsufficient = paymentMethod === 'CASH' && receivedNum < total;

  // Preset cash bills
  const cashPresets = [
    { label: 'Exacto', value: total },
    { label: 'L. 100', value: 100 },
    { label: 'L. 200', value: 200 },
    { label: 'L. 500', value: 500 },
    { label: 'L. 1000', value: 1000 }
  ].filter(p => p.label === 'Exacto' || p.value >= total || total <= 50);

  const handlePrintSaleReceipt = (sale: Sale) => {
    try {
      const escPosBuffer = generateEscPosReceipt(sale, tenant, 'ORIGINAL');
      const blob = new Blob([escPosBuffer], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.focus();
      } else {
        window.print();
      }
    } catch (err) {
      console.warn('Error al imprimir recibo térmico:', err);
    }
  };

  const handleConfirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift || activeShift.status !== 'OPEN') {
      toast.error('Debes abrir un turno de caja registradora antes de realizar un cobro.');
      return;
    }

    if (isCashInsufficient) {
      toast.error('El efectivo recibido es menor al total de la comanda.');
      return;
    }

    setIsSubmitting(true);
    try {
      const completedSale = processFoodOrderSale(order.id, paymentMethod, isFiscal);
      if (!completedSale) {
        setIsSubmitting(false);
        return;
      }

      if (shouldPrint) {
        handlePrintSaleReceipt(completedSale);
      }

      toast.success(`Comanda ${order.orderNumber} cobrada con éxito`);
      if (onSuccess) {
        onSuccess(completedSale);
      }
      onClose();
    } catch (error) {
      console.error('Error al procesar el cobro:', error);
      toast.error('Ocurrió un error al procesar el cobro de la comanda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDestinationIcon = () => {
    if (order.deliveryType === 'DINE_IN') return <Utensils size={15} />;
    if (order.deliveryType === 'TAKE_OUT') return <ShoppingBag size={15} />;
    return <Bike size={15} />;
  };

  const getDestinationLabel = () => {
    if (order.deliveryType === 'DINE_IN') return order.tableNumber || 'Mesa';
    if (order.deliveryType === 'TAKE_OUT') return 'Para Llevar';
    return `A Domicilio (${order.driverName || 'Sin repartidor'})`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backdropFilter: 'blur(3px)'
      }}
    >
      <div
        className="modal-content"
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          maxWidth: 'min(520px, calc(100vw - 1.5rem))',
          maxHeight: 'min(92vh, 750px)',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  background: '#ea580c',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  padding: '0.2rem 0.55rem',
                  borderRadius: '6px'
                }}
              >
                {order.orderNumber}
              </span>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                Cobro Directo de Comanda
              </h3>
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.78rem',
                color: '#475569',
                marginTop: '0.3rem',
                fontWeight: 600
              }}
            >
              {getDestinationIcon()}
              <span>{getDestinationLabel()}</span>
              {order.customerName && <span>• {order.customerName}</span>}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#64748b',
              padding: '0.35rem',
              borderRadius: '8px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleConfirmPayment} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Big Total Card */}
          <div
            style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              borderRadius: '14px',
              padding: '1.25rem',
              color: '#ffffff',
              textAlign: 'center',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)'
            }}
          >
            <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', fontWeight: 700 }}>
              Total a Cobrar
            </span>
            <div style={{ fontSize: '2.25rem', fontWeight: 900, color: '#38bdf8', margin: '0.2rem 0' }}>
              {formatCurrency(total, tenant.currencySymbol)}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
              {order.items.reduce((acc, it) => acc + it.quantity, 0)} platillos/artículos
              {order.deliveryFee ? ` • Envío: ${formatCurrency(order.deliveryFee, tenant.currencySymbol)}` : ''}
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>
              Forma de Pago
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 90px), 1fr))', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setPaymentMethod('CASH')}
                style={{
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  borderRadius: '10px',
                  border: paymentMethod === 'CASH' ? '2px solid #ea580c' : '1px solid #cbd5e1',
                  background: paymentMethod === 'CASH' ? '#fff7ed' : '#ffffff',
                  color: paymentMethod === 'CASH' ? '#ea580c' : '#475569',
                  cursor: 'pointer'
                }}
              >
                <DollarSign size={16} />
                <span>Efectivo</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('CARD')}
                style={{
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  borderRadius: '10px',
                  border: paymentMethod === 'CARD' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  background: paymentMethod === 'CARD' ? '#eff6ff' : '#ffffff',
                  color: paymentMethod === 'CARD' ? '#2563eb' : '#475569',
                  cursor: 'pointer'
                }}
              >
                <CreditCard size={16} />
                <span>Tarjeta</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('TRANSFER')}
                style={{
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  borderRadius: '10px',
                  border: paymentMethod === 'TRANSFER' ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                  background: paymentMethod === 'TRANSFER' ? '#f5f3ff' : '#ffffff',
                  color: paymentMethod === 'TRANSFER' ? '#7c3aed' : '#475569',
                  cursor: 'pointer'
                }}
              >
                <Send size={16} />
                <span>Transferencia</span>
              </button>
            </div>
          </div>

          {/* Cash Payment Details & Quick Presets */}
          {paymentMethod === 'CASH' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
                  Billetes Rápidos:
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {cashPresets.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCashReceived(String(preset.value))}
                      style={{
                        padding: '0.4rem 0.75rem',
                        minHeight: '36px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#0f172a',
                        cursor: 'pointer'
                      }}
                    >
                      {preset.label === 'Exacto' ? `Exacto (${formatCurrency(preset.value, tenant.currencySymbol)})` : preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  Efectivo Recibido (L.):
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.9rem',
                    fontSize: '1.2rem',
                    fontWeight: 800,
                    borderRadius: '10px',
                    border: isCashInsufficient ? '2px solid #ef4444' : '1px solid #94a3b8',
                    outline: 'none',
                    background: '#ffffff',
                    color: '#0f172a'
                  }}
                  autoFocus
                />
              </div>

              {/* Change Box */}
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: isCashInsufficient ? '#fef2f2' : '#f0fdf4',
                  border: isCashInsufficient ? '1px solid #fca5a5' : '1px solid #86efac',
                  color: isCashInsufficient ? '#991b1b' : '#15803d'
                }}
              >
                <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                  {isCashInsufficient ? 'Efectivo insuficiente:' : 'Cambio a Entregar:'}
                </span>
                <span style={{ fontSize: '1.15rem', fontWeight: 900 }}>
                  {isCashInsufficient
                    ? `- ${formatCurrency(total - receivedNum, tenant.currencySymbol)}`
                    : formatCurrency(change, tenant.currencySymbol)}
                </span>
              </div>
            </div>
          )}

          {/* Fiscal & Print Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingTop: '0.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#334155', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={isFiscal}
                  onChange={(e) => setIsFiscal(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#ea580c' }}
                />
                <span>Emitir Factura Fiscal SAR (CAI)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#334155', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={shouldPrint}
                  onChange={(e) => setShouldPrint(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#ea580c' }}
                />
                <Printer size={15} style={{ color: '#475569' }} />
                <span>Imprimir Recibo Térmico</span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                flex: 1,
                minHeight: '48px',
                padding: '0.65rem 1rem',
                fontSize: '0.9rem',
                fontWeight: 700,
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting || isCashInsufficient}
              style={{
                flex: 2,
                minHeight: '48px',
                padding: '0.65rem 1.25rem',
                fontSize: '0.95rem',
                fontWeight: 800,
                borderRadius: '10px',
                border: 'none',
                background: isCashInsufficient ? '#94a3b8' : '#059669',
                color: '#ffffff',
                cursor: isCashInsufficient ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: isCashInsufficient ? 'none' : '0 4px 12px rgba(5, 150, 105, 0.3)'
              }}
            >
              <CheckCircle2 size={18} />
              <span>COBRAR {formatCurrency(total, tenant.currencySymbol)}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
