import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { formatCurrency } from '../../lib/monetary';
import { toast } from 'sonner';
import { Lock, Unlock, CheckCircle, Printer, Info, LogOut, ArrowUpRight, ArrowDownLeft, DollarSign } from 'lucide-react';
import { Sale } from '../../types';

export const CashShiftModal: React.FC = () => {
  const activeShift = useAppStore(state => state.activeShift);
  const isShiftModalOpen = useAppStore(state => state.isShiftModalOpen);
  const openCashShift = useAppStore(state => state.openCashShift);
  const closeCashShift = useAppStore(state => state.closeCashShift);
  const addCashMovement = useAppStore(state => state.addCashMovement);
  const cashMovements = useAppStore(state => state.cashMovements);
  const logout = useAppStore(state => state.logout);
  const tenant = useAppStore(state => state.tenant);
  const sales = useAppStore(state => state.sales);
  const currentUser = useAppStore(state => state.currentUser);
  const fiscalRange = useAppStore(state => state.fiscalRange);
  const fiscalRanges = useAppStore(state => state.fiscalRanges);
  const selectedFiscalRangeId = useAppStore(state => state.selectedFiscalRangeId);
  const setSelectedFiscalRange = useAppStore(state => state.setSelectedFiscalRange);

  const [activeTab, setActiveTab] = useState<'CLOSE' | 'MOVEMENT'>('CLOSE');
  const [openingAmountInput, setOpeningAmountInput] = useState('1000.00');
  const [declaredCashInput, setDeclaredCashInput] = useState('');

  // Cash movement form state
  const [movType, setMovType] = useState<'ENTRADA' | 'SALIDA'>('SALIDA');
  const [movAmount, setMovAmount] = useState('');
  const [movConcept, setMovConcept] = useState('');

  const [zReportData, setZReportData] = useState<{
    difference: number;
    closingSystem: number;
    closingDeclared: number;
    openingAmount: number;
    totalCashSales: number;
    totalCardSales: number;
    totalTransferSales: number;
    totalIngresos: number;
    totalEgresos: number;
  } | null>(null);

  if (!isShiftModalOpen) return null;

  const closeModal = () => {
    const isShiftOpen = activeShift && activeShift.tenantId === tenant.id && activeShift.status === 'OPEN';
    if (!isShiftOpen && currentUser?.role !== 'ADMIN') {
      logout();
      toast.info('Sesión cerrada. Debes ingresar el monto de apertura para operar en el POS.');
      useAppStore.setState({ isShiftModalOpen: false });
      setZReportData(null);
      return;
    }
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

  const handleSaveMovement = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(movAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Ingresa un monto válido');
      return;
    }
    if (!movConcept.trim()) {
      toast.error('Ingresa el motivo o concepto del movimiento');
      return;
    }

    addCashMovement(movType, amount, movConcept.trim());
    toast.success(`${movType === 'ENTRADA' ? 'Ingreso' : 'Egreso'} de ${formatCurrency(amount, tenant.currencySymbol)} registrado en la caja.`);
    setMovAmount('');
    setMovConcept('');
    setActiveTab('CLOSE');
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

    const shiftMovs = (cashMovements || []).filter(m => m.cashShiftId === activeShift?.id);
    const totalIngresos = shiftMovs.filter(m => m.type === 'ENTRADA').reduce((acc, m) => acc + m.amount, 0);
    const totalEgresos = shiftMovs.filter(m => m.type === 'SALIDA').reduce((acc, m) => acc + m.amount, 0);

    setZReportData({
      difference: result.difference,
      closingSystem: result.closingSystem,
      closingDeclared: declared,
      openingAmount: activeShift?.openingAmount || 0,
      totalCashSales: shiftCashSales,
      totalCardSales: shiftCardSales,
      totalTransferSales: shiftTransferSales,
      totalIngresos,
      totalEgresos
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
  const currentShiftMovs = (cashMovements || []).filter(m => m.cashShiftId === activeShift?.id);

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '540px' }}>

        {/* CASE A: No active shift - Open Shift Form */}
        {!isCurrentTenantShiftOpen && !zReportData && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <Unlock size={40} style={{ color: 'var(--accent-success)', margin: '0 auto 0.5rem auto' }} />
              <h3>Apertura de Turno de Caja</h3>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Terminal: <strong>{fiscalRange?.name || 'Caja Registradora Principal'}</strong>
              </p>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Ingresa el fondo inicial en efectivo (sencillo) para la caja.</p>
            </div>

            <form onSubmit={handleOpenShift}>
              <div className="form-group" style={{ marginBottom: '1.1rem' }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                  Seleccionar Caja Registradora / Terminal
                </label>
                <select
                  className="input-control"
                  value={selectedFiscalRangeId || fiscalRange?.id}
                  onChange={(e) => setSelectedFiscalRange(e.target.value)}
                  style={{ fontWeight: 700, fontSize: '0.95rem', background: '#f8fafc', borderColor: '#cbd5e1', cursor: 'pointer' }}
                  required
                >
                  {(fiscalRanges && fiscalRanges.length > 0 ? fiscalRanges : [fiscalRange]).map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name || 'Caja Registradora'} ({r.prefix}{String(r.currentNumber).padStart(8, '0')})
                    </option>
                  ))}
                </select>
              </div>

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
                    if (currentUser?.role !== 'ADMIN') {
                      logout();
                      toast.info('Sesión cerrada.');
                    }
                    closeModal();
                  }}
                  style={{ flex: 1 }}
                >
                  {currentUser?.role !== 'ADMIN' ? (
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

        {/* CASE B: Active shift open - Close Shift Form & Movement Manager */}
        {isCurrentTenantShiftOpen && !zReportData && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('CLOSE')}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: activeTab === 'CLOSE' ? 'var(--accent-primary)' : '#f8fafc',
                    color: activeTab === 'CLOSE' ? '#ffffff' : '#475569',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  Arqueo & Cierre Z
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('MOVEMENT')}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: activeTab === 'MOVEMENT' ? 'var(--accent-primary)' : '#f8fafc',
                    color: activeTab === 'MOVEMENT' ? '#ffffff' : '#475569',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  + / - Entrada & Retiro ({currentShiftMovs.length})
                </button>
              </div>
            </div>

            {activeTab === 'CLOSE' ? (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <Lock size={36} style={{ color: '#f59e0b', margin: '0 auto 0.3rem auto' }} />
                  <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Arqueo Ciego & Cierre Z</h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    {activeShift.cajaName || 'Caja Registradora Principal'}
                  </span>
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
            ) : (
              <div>
                <h4 style={{ fontSize: '0.95rem', color: '#0f172a', fontWeight: 700, marginBottom: '0.75rem' }}>
                  Registrar Movimiento en Caja ({activeShift.cajaName || 'Caja Principal'})
                </h4>

                <form onSubmit={handleSaveMovement} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group">
                      <label className="form-label">Tipo de Movimiento *</label>
                      <select
                        className="input-control"
                        value={movType}
                        onChange={(e) => setMovType(e.target.value as any)}
                      >
                        <option value="SALIDA">🔴 Egreso / Retiro / Gasto (-)</option>
                        <option value="ENTRADA">🟢 Ingreso / Aporte de Sencillo (+)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Monto ({tenant.currencySymbol}) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        className="input-control"
                        placeholder="0.00"
                        value={movAmount}
                        onChange={(e) => setMovAmount(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Concepto / Motivo *</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder={movType === 'SALIDA' ? 'Ej. Compra de bolsas, hielo o retiro a caja fuerte' : 'Ej. Aporte inicial extra de sencillo'}
                      value={movConcept}
                      onChange={(e) => setMovConcept(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setActiveTab('CLOSE')}>
                      Volver
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Registrar Movimiento
                    </button>
                  </div>
                </form>

                {/* Movements log list */}
                {currentShiftMovs.length > 0 && (
                  <div style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>Movimientos del Turno Actual</span>
                    <div style={{ maxHeight: '140px', overflowY: 'auto', marginTop: '0.4rem' }}>
                      <table className="table" style={{ width: '100%', fontSize: '0.75rem' }}>
                        <tbody>
                          {currentShiftMovs.map(m => (
                            <tr key={m.id}>
                              <td style={{ fontWeight: 600, color: m.type === 'ENTRADA' ? '#10b981' : '#ef4444' }}>
                                {m.type === 'ENTRADA' ? '+ INGRESO' : '- EGRESO'}
                              </td>
                              <td style={{ color: '#475569' }}>{m.concept}</td>
                              <td style={{ fontWeight: 700, textAlign: 'right' }}>
                                {formatCurrency(m.amount, tenant.currencySymbol)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* CASE C: Z-Report Summary Result */}
        {zReportData && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <CheckCircle size={40} style={{ color: '#10b981', margin: '0 auto 0.5rem auto' }} />
              <h3>Reporte Consolidado Cierre Z</h3>
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
                {activeShift?.cajaName || 'Caja Registradora Principal'}
              </p>
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

              {zReportData.totalIngresos > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#64748b' }}>(+) Ingresos / Aportes de Caja:</span>
                  <span style={{ color: '#10b981', fontWeight: 600 }}>{formatCurrency(zReportData.totalIngresos, tenant.currencySymbol)}</span>
                </div>
              )}

              {zReportData.totalEgresos > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#64748b' }}>(-) Egresos / Compras / Retiros:</span>
                  <span style={{ color: '#ef4444', fontWeight: 600 }}>-{formatCurrency(zReportData.totalEgresos, tenant.currencySymbol)}</span>
                </div>
              )}

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
