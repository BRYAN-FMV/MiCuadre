import React, { useState, useEffect, useMemo } from 'react';
import { Appointment, Sale } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { formatCurrency } from '../../lib/monetary';
import { printSaleReceipt } from '../../lib/thermalPrint';
import { X, DollarSign, CreditCard, Send, CheckCircle2, Printer, Scissors, Clock, User, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface QuickAppointmentPaymentModalProps {
  appointment: Appointment | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (sale: Sale) => void;
}

export const QuickAppointmentPaymentModal: React.FC<QuickAppointmentPaymentModalProps> = ({
  appointment,
  isOpen,
  onClose,
  onSuccess
}) => {
  const tenant = useAppStore(state => state.tenant);
  const activeShift = useAppStore(state => state.activeShift);
  const services = useAppStore(state => state.services);
  const processAppointmentSale = useAppStore(state => state.processAppointmentSale);

  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER'>('CASH');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [isFiscal, setIsFiscal] = useState<boolean>(tenant.isFiscalEnabled || false);
  const [shouldPrint, setShouldPrint] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Compute appointment total and item list
  const { total, itemsSummary } = useMemo(() => {
    if (!appointment) return { total: 0, itemsSummary: [] };

    if (appointment.items && appointment.items.length > 0) {
      const sum = appointment.items.reduce((acc, it) => acc + (it.price || 0), 0);
      return {
        total: sum,
        itemsSummary: appointment.items.map(it => ({
          name: it.serviceName || 'Servicio',
          staff: it.staffName || appointment.staffName || 'Atendido',
          price: it.price || 0,
          duration: it.durationMinutes || 30
        }))
      };
    }

    const matchedService = services.find(s => s.id === appointment.serviceId);
    const servicePrice = matchedService?.price || 0;
    return {
      total: servicePrice,
      itemsSummary: [
        {
          name: appointment.serviceName || matchedService?.name || 'Servicio',
          staff: appointment.staffName || 'Atendido',
          price: servicePrice,
          duration: matchedService?.durationMinutes || 30
        }
      ]
    };
  }, [appointment, services]);

  useEffect(() => {
    if (appointment) {
      setPaymentMethod('CASH');
      setCashReceived(String(total));
      setIsFiscal(tenant.isFiscalEnabled || false);
      setShouldPrint(true);
      setIsSubmitting(false);
    }
  }, [appointment, total, tenant.isFiscalEnabled]);

  if (!isOpen || !appointment) return null;

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
      printSaleReceipt(sale, tenant, 'ORIGINAL');
    } catch (err) {
      console.warn('Error al imprimir recibo térmico de servicio:', err);
    }
  };

  const handleConfirmPayment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!activeShift || activeShift.status !== 'OPEN') {
      toast.error('Debes abrir un turno de caja registradora antes de realizar un cobro.');
      return;
    }

    if (isCashInsufficient) {
      toast.error('El efectivo recibido es menor al total de la cita.');
      return;
    }

    setIsSubmitting(true);
    try {
      const completedSale = processAppointmentSale(appointment.id, paymentMethod, isFiscal);
      if (!completedSale) {
        setIsSubmitting(false);
        return;
      }

      if (shouldPrint) {
        handlePrintSaleReceipt(completedSale);
      }

      toast.success(`Cita de ${appointment.customerName} cobrada con éxito`);
      if (onSuccess) {
        onSuccess(completedSale);
      }
      onClose();
    } catch (error) {
      console.error('Error al procesar el cobro de la cita:', error);
      toast.error('Ocurrió un error al procesar el cobro de la cita.');
    } finally {
      setIsSubmitting(false);
    }
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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
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
            background: '#faf5ff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  background: '#9333ea',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  padding: '0.2rem 0.55rem',
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                <Scissors size={13} />
                <span>Cita</span>
              </span>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                Cobro Directo de Servicio
              </h3>
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.78rem',
                color: '#6b21a8',
                marginTop: '0.3rem',
                fontWeight: 600
              }}
            >
              <User size={13} />
              <span>{appointment.customerName}</span>
              {appointment.customerPhone && <span>• {appointment.customerPhone}</span>}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#64748b',
              padding: '0.3rem',
              borderRadius: '6px',
              display: 'flex'
            }}
            title="Cerrar ventana"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleConfirmPayment} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Shift warning if not open */}
          {(!activeShift || activeShift.status !== 'OPEN') && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecdd3',
                borderRadius: '8px',
                padding: '0.75rem',
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
                color: '#991b1b',
                fontSize: '0.82rem'
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Caja Cerrada:</strong> Debes abrir un turno de caja registradora para registrar ingresos.
              </div>
            </div>
          )}

          {/* Services Breakdown */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '0.75rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              maxHeight: '140px',
              overflowY: 'auto'
            }}
          >
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Servicios Realizados
            </span>
            {itemsSummary.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.name}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <Clock size={11} /> {item.duration} min • Atiende: <span style={{ color: '#9333ea', fontWeight: 600 }}>{item.staff}</span>
                  </div>
                </div>
                <span style={{ fontWeight: 800, color: '#0f172a' }}>
                  {formatCurrency(item.price, tenant.currencySymbol)}
                </span>
              </div>
            ))}
          </div>

          {/* Total Highlight */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              padding: '0.5rem 0',
              borderBottom: '1px dashed #cbd5e1'
            }}
          >
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#475569' }}>Total a Pagar:</span>
            <span style={{ fontSize: '1.6rem', fontWeight: 900, color: '#059669' }}>
              {formatCurrency(total, tenant.currencySymbol)}
            </span>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
              Forma de Pago
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 90px), 1fr))', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setPaymentMethod('CASH')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  padding: '0.55rem',
                  borderRadius: '8px',
                  border: paymentMethod === 'CASH' ? '2px solid #059669' : '1px solid #cbd5e1',
                  background: paymentMethod === 'CASH' ? '#ecfdf5' : '#ffffff',
                  color: paymentMethod === 'CASH' ? '#047857' : '#475569',
                  fontWeight: 700,
                  fontSize: '0.85rem',
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
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  padding: '0.55rem',
                  borderRadius: '8px',
                  border: paymentMethod === 'CARD' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  background: paymentMethod === 'CARD' ? '#eff6ff' : '#ffffff',
                  color: paymentMethod === 'CARD' ? '#1d4ed8' : '#475569',
                  fontWeight: 700,
                  fontSize: '0.85rem',
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
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  padding: '0.55rem',
                  borderRadius: '8px',
                  border: paymentMethod === 'TRANSFER' ? '2px solid #9333ea' : '1px solid #cbd5e1',
                  background: paymentMethod === 'TRANSFER' ? '#faf5ff' : '#ffffff',
                  color: paymentMethod === 'TRANSFER' ? '#7e22ce' : '#475569',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                <Send size={16} />
                <span>Transferencia</span>
              </button>
            </div>
          </div>

          {/* Cash Input & Change Calculation */}
          {paymentMethod === 'CASH' && (
            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                  Efectivo Recibido ({tenant.currencySymbol})
                </label>
                {receivedNum > 0 && (
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: change >= 0 ? '#15803d' : '#b91c1c' }}>
                    {change >= 0 ? `Cambio: ${formatCurrency(change, tenant.currencySymbol)}` : 'Monto insuficiente'}
                  </span>
                )}
              </div>

              <input
                type="number"
                step="any"
                className="input-control"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  textAlign: 'center',
                  height: '46px',
                  borderColor: isCashInsufficient ? '#ef4444' : undefined
                }}
                autoFocus
              />

              {/* Fast Cash Pills */}
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                {cashPresets.map((preset, pIdx) => (
                  <button
                    key={pIdx}
                    type="button"
                    onClick={() => setCashReceived(String(preset.value))}
                    style={{
                      flex: 1,
                      minWidth: '65px',
                      padding: '0.35rem 0.5rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: preset.label === 'Exacto' ? '#dcfce7' : '#ffffff',
                      color: preset.label === 'Exacto' ? '#166534' : '#334155',
                      fontWeight: preset.label === 'Exacto' ? 800 : 700,
                      fontSize: '0.78rem',
                      cursor: 'pointer'
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Options: Document Type & Print Receipt */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#475569' }}>
            {tenant.isFiscalEnabled ? (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={isFiscal}
                  onChange={(e) => setIsFiscal(e.target.checked)}
                />
                <span>Emitir Factura Fiscal SAR</span>
              </label>
            ) : (
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Comprobante: Ticket de Venta</span>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={shouldPrint}
                onChange={(e) => setShouldPrint(e.target.checked)}
              />
              <Printer size={14} />
              <span>Imprimir Recibo</span>
            </label>
          </div>

          {/* Submit Actions */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
              style={{ flex: 1, height: '46px', fontSize: '0.85rem' }}
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting || isCashInsufficient || (!activeShift || activeShift.status !== 'OPEN')}
              style={{
                flex: 2,
                height: '46px',
                borderRadius: '8px',
                border: 'none',
                background: (isCashInsufficient || (!activeShift || activeShift.status !== 'OPEN')) ? '#94a3b8' : '#059669',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.95rem',
                cursor: (isCashInsufficient || (!activeShift || activeShift.status !== 'OPEN')) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)'
              }}
            >
              <CheckCircle2 size={18} />
              <span>{isSubmitting ? 'Procesando...' : `CONFIRMAR COBRO (${formatCurrency(total, tenant.currencySymbol)})`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
