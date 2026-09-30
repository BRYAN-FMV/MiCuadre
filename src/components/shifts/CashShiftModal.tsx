import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { formatCurrency } from '../../lib/monetary';
import { toast } from 'sonner';
import { Lock, Unlock, CheckCircle, Printer, Info, LogOut } from 'lucide-react';
import { Sale } from '../../types';

export const CashShiftModal: React.FC = () => {
  const activeShift = useAppStore(state => state.activeShift);
  const isShiftModalOpen = useAppStore(state => state.isShiftModalOpen);
  const openCashShift = useAppStore(state => state.openCashShift);
  const closeCashShift = useAppStore(state => state.closeCashShift);
  const logout = useAppStore(state => state.logout);
  const tenant = useAppStore(state => state.tenant);
  const sales = useAppStore(state => state.sales);
  const currentUser = useAppStore(state => state.currentUser);

  const [openingAmountInput, setOpeningAmountInput] = useState('1000.00');
  const [declaredCashInput, setDeclaredCashInput] = useState('');
  const [zReportData, setZReportData] = useState<{
    difference: number;
    closingSystem: number;
    closingDeclared: number;
    openingAmount: number;
    totalCashSales: number;
    totalCardSales: number;
    totalTransferSales: number;
  } | null>(null);

  if (!isShiftModalOpen) return null;

  const closeModal = () => {
    useAppStore.setState({ isShiftModalOpen: false });
    setZReportData(null);
  };

  const handleFinishZReportAndLogout = () => {
    closeModal();
    logout();
    toast.info('Turno cerrado y sesión finalizada.');
  };

  const handleOpenShift = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(openingAmountInput) || 0;
    openCashShift(amount);
    toast.success(`Turno de caja abierto con ${formatCurrency(amount, tenant.currencySymbol)}`);
    closeModal();
  };

  const handleCloseShift = (e: React.FormEvent) => {
    e.preventDefault();
    const declared = parseFloat(declaredCashInput);

    if (isNaN(declared)) {
      toast.error('Ingresa el monto de efectivo contado');
      return;
    }

    const result = closeCashShift(declared);
    const shiftSales = sales.filter((s: Sale) => s.tenantId === tenant.id && s.cashShiftId === activeShift?.id);

    const shiftCashSales = shiftSales
      .filter((s: Sale) => s.paymentMethod === 'CASH')
      .reduce((acc: number, s: Sale) => acc + s.total, 0);

    const shiftCardSales = shiftSales
      .filter((s: Sale) => s.paymentMethod === 'CARD')
      .reduce((acc: number, s: Sale) => acc + s.total, 0);

    const shiftTransferSales = shiftSales
      .filter((s: Sale) => s.paymentMethod === 'TRANSFER')
      .reduce((acc: number, s: Sale) => acc + s.total, 0);

    setZReportData({
      difference: result.difference,
      closingSystem: result.closingSystem,
      closingDeclared: declared,
      openingAmount: activeShift?.openingAmount || 0,
      totalCashSales: shiftCashSales,
      totalCardSales: shiftCardSales,
      totalTransferSales: shiftTransferSales
    });

    if (result.difference === 0) {
      toast.success('¡Cuadre perfecto de caja registradora!');
    } else if (result.difference < 0) {
      toast.warning(`Faltante en caja registradora: ${formatCurrency(Math.abs(result.difference), tenant.currencySymbol)}`);
    } else {
      toast.info(`Sobrante en caja registradora: ${formatCurrency(result.difference, tenant.currencySymbol)}`);
    }
  };

  const isCurrentTenantShiftOpen = activeShift && activeShift.tenantId === tenant.id && activeShift.status === 'OPEN';

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '520px' }}>

        {/* CASE A: No active shift - Open Shift Form */}
        {!isCurrentTenantShiftOpen && !zReportData && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <Unlock size={40} style={{ color: 'var(--accent-success)', margin: '0 auto 0.5rem auto' }} />
              <h3>Apertura de Turno de Caja</h3>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Ingresa el fondo inicial en efectivo (sencillo) para la caja registradora.</p>
            </div>

            <form onSubmit={handleOpenShift}>
              <div className="form-group">
                <label className="form-label">Monto de Apertura ({tenant.currencySymbol})</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-control"
                  value={openingAmountInput}
                  onChange={(e) => setOpeningAmountInput(e.target.value)}
                  style={{ fontSize: '1.4rem', fontWeight: 700, textAlign: 'center' }}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    closeModal();
                    if (currentUser?.role === 'CAJERO') {
                      logout();
                      toast.info('Sesión cerrada');
                    }
                  }}
                  style={{ flex: 1 }}
                >
                  {currentUser?.role === 'CAJERO' ? (
                    <>
                      <LogOut size={15} />
                      <span>Cerrar Sesión</span>
                    </>
                  ) : (
                    <span>Cerrar Ventana</span>
                  )}
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>
                  Abrir Caja Registradora
                </button>
              </div>
            </form>
          </div>
        )}

        {/* CASE B: Active shift open - Blind Close Form */}
        {isCurrentTenantShiftOpen && !zReportData && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <Lock size={40} style={{ color: '#f59e0b', margin: '0 auto 0.5rem auto' }} />
              <h3>Arqueo Ciego & Cierre Z de Caja</h3>
              <p style={{ fontSize: '0.82rem', color: '#64748b' }}>
                Cuenta y declara únicamente el <strong>efectivo físico</strong> en la gaveta. Las ventas por Tarjeta o Transferencia no afectan la caja física.
              </p>
            </div>

            <form onSubmit={handleCloseShift}>
              <div className="form-group">
                <label className="form-label">Efectivo Físico Contado en Gaveta ({tenant.currencySymbol}) *</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-control"
                  placeholder="0.00"
                  value={declaredCashInput}
                  onChange={(e) => setDeclaredCashInput(e.target.value)}
                  style={{ fontSize: '1.5rem', fontWeight: 700, textAlign: 'center' }}
                  required
                  autoFocus
                />
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.8rem', color: '#475569' }}>
                <span>Cajero Responsable: </span>
                <strong style={{ color: '#0f172a' }}>{currentUser.fullName}</strong>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal} style={{ flex: 1 }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2, background: '#ef4444', borderColor: '#ef4444' }}>
                  Cerrar Turno & Generar Reporte Z
                </button>
              </div>
            </form>
          </div>
        )}

        {/* CASE C: Z-Report Summary Result */}
        {zReportData && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <CheckCircle size={40} style={{ color: '#10b981', margin: '0 auto 0.5rem auto' }} />
              <h3>Reporte Consolidado Cierre Z</h3>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Cuadre Exclusivo de Caja Registradora</p>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: '#64748b' }}>Apertura (Sencillo Inicial):</span>
                <span>{formatCurrency(zReportData.openingAmount, tenant.currencySymbol)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: '#64748b' }}>(+) Ventas en Efectivo:</span>
                <span style={{ color: '#10b981', fontWeight: 600 }}>{formatCurrency(zReportData.totalCashSales, tenant.currencySymbol)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 700, paddingTop: '0.4rem', borderTop: '1px solid #e2e8f0' }}>
                <span>(=) Efectivo Esperado en Gaveta:</span>
                <span>{formatCurrency(zReportData.closingSystem, tenant.currencySymbol)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 700 }}>
                <span>Declarado por Cajero:</span>
                <span>{formatCurrency(zReportData.closingDeclared, tenant.currencySymbol)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 800, marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px dashed #cbd5e1' }}>
                <span>DIFERENCIA DE CAJA:</span>
                <span style={{ color: zReportData.difference === 0 ? '#10b981' : zReportData.difference < 0 ? '#ef4444' : '#f59e0b' }}>
                  {formatCurrency(zReportData.difference, tenant.currencySymbol)}
                </span>
              </div>
            </div>

            {/* Non-Cash Control Notice */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.78rem', color: '#64748b' }}>
              <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Info size={14} style={{ color: 'var(--accent-primary)' }} />
                <span>Otras Formas de Pago (Control Bancario)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0.15rem 0' }}>
                <span>Tarjeta Crédito/Débito:</span>
                <strong style={{ color: '#0f172a' }}>{formatCurrency(zReportData.totalCardSales, tenant.currencySymbol)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0.15rem 0' }}>
                <span>Transferencia Bancaria:</span>
                <strong style={{ color: '#0f172a' }}>{formatCurrency(zReportData.totalTransferSales, tenant.currencySymbol)}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={handleFinishZReportAndLogout} style={{ flex: 1 }}>
                <LogOut size={16} />
                <span>Finalizar & Salir</span>
              </button>
              <button className="btn btn-primary" onClick={() => { window.print(); handleFinishZReportAndLogout(); }} style={{ flex: 1 }}>
                <Printer size={16} />
                <span>Imprimir & Salir</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default CashShiftModal;
