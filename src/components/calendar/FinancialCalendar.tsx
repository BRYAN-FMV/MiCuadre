import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { formatCurrency } from '../../lib/monetary';
import { toast } from 'sonner';
import {
  AlertTriangle, TrendingUp, DollarSign, ShieldAlert, CheckCircle2,
  Calendar as CalendarIcon, Wallet, Zap, Plus, Receipt, ChevronLeft, ChevronRight,
  Grid, List, LayoutGrid, Info
} from 'lucide-react';
import { FinancialEvent, ExpenseCategory } from '../../types';

export const FinancialCalendar: React.FC = () => {
  const {
    financialEvents, funds, tenant, activeShift, sales, fiscalRange,
    payFinancialEvent, dismissFinancialEvent, addFinancialEvent
  } = useAppStore();

  const tenantEvents = financialEvents.filter(e => e.tenantId === tenant.id);
  const tenantFunds = funds.filter(f => f.tenantId === tenant.id);
  const tenantSales = sales.filter(s => s.tenantId === tenant.id);

  // View state: 'MONTH' (Grid), 'WEEK' (Grid), 'LIST' (Timeline)
  const [viewMode, setViewMode] = useState<'MONTH' | 'WEEK' | 'LIST'>('MONTH');
  const [currentDate, setCurrentDate] = useState(new Date());

  const [selectedEventToPay, setSelectedEventToPay] = useState<FinancialEvent | null>(null);
  const [selectedPayFundId, setSelectedPayFundId] = useState(tenantFunds[0]?.id || '');

  // Schedule Recurring Event Modal state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [schedTitle, setSchedTitle] = useState('');
  const [schedDescription, setSchedDescription] = useState('');
  const [schedAmount, setSchedAmount] = useState('');
  const [schedDueDate, setSchedDueDate] = useState(() => new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0]);
  const [schedCategory, setSchedCategory] = useState<ExpenseCategory>('SERVICIOS_PUBLICOS');

  const currentCashInShift = (activeShift && activeShift.tenantId === tenant.id)
    ? activeShift.openingAmount + tenantSales.filter(s => s.cashShiftId === activeShift.id).reduce((a, b) => a + b.total, 0)
    : 1000.00;

  const totalPendingPayments = tenantEvents
    .filter(e => e.status === 'PENDING' && (e.eventType === 'SUPPLIER_PAYMENT' || e.eventType === 'RECURRING_EXPENSE'))
    .reduce((acc, e) => acc + e.amount, 0);

  // Proactive Liquidity Risk Alert Effect
  useEffect(() => {
    if (totalPendingPayments > currentCashInShift) {
      toast.warning('Riesgo de Liquidez Detectado', {
        description: `Las Cuentas por Pagar (${formatCurrency(totalPendingPayments, tenant.currencySymbol)}) superan el efectivo estimado en caja (${formatCurrency(currentCashInShift, tenant.currencySymbol)}).`,
        duration: 8000
      });
    }

    if (tenant.isFiscalEnabled) {
      const ranges = useAppStore.getState().fiscalRanges || [fiscalRange];
      const lowRanges = ranges.filter(r => r.tenantId === tenant.id && (r.rangeEnd - r.currentNumber) <= 50);
      if (lowRanges.length > 0) {
        lowRanges.forEach(r => {
          const remaining = r.rangeEnd - r.currentNumber;
          toast.error(`ALERTA SAR (${r.name}): Correlativos Casi Agotados`, {
            description: `Quedan ${remaining} facturas en el CAI de ${r.name} (${r.prefix}).`,
            duration: 10000
          });
        });
      }
    }
  }, []);

  // Grid date calculation helpers
  const getDaysInMonthGrid = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();

    const firstDay = new Date(year, month, 1);
    const startingDayOfWeek = firstDay.getDay();

    const lastDay = new Date(year, month + 1, 0);
    const totalDaysInMonth = lastDay.getDate();

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const prevMonthDays = Array.from({ length: startingDayOfWeek }).map((_, i) => {
      const dayNum = prevMonthLastDay - startingDayOfWeek + i + 1;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const mStr = String(prevMonth + 1).padStart(2, '0');
      const dStr = String(dayNum).padStart(2, '0');
      return {
        dateStr: `${prevYear}-${mStr}-${dStr}`,
        dayNumber: dayNum,
        isCurrentMonth: false
      };
    });

    const currentMonthDays = Array.from({ length: totalDaysInMonth }).map((_, i) => {
      const dayNum = i + 1;
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(dayNum).padStart(2, '0');
      return {
        dateStr: `${year}-${mStr}-${dStr}`,
        dayNumber: dayNum,
        isCurrentMonth: true
      };
    });

    const totalGridCells = (prevMonthDays.length + currentMonthDays.length) > 35 ? 42 : 35;
    const nextMonthDaysCount = totalGridCells - (prevMonthDays.length + currentMonthDays.length);
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const nextMonthDays = Array.from({ length: nextMonthDaysCount }).map((_, i) => {
      const dayNum = i + 1;
      const mStr = String(nextMonth + 1).padStart(2, '0');
      const dStr = String(dayNum).padStart(2, '0');
      return {
        dateStr: `${nextYear}-${mStr}-${dStr}`,
        dayNumber: dayNum,
        isCurrentMonth: false
      };
    });

    return [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];
  };

  const getDaysInWeekGrid = (date: Date) => {
    const current = new Date(date);
    const dayOfWeek = current.getDay();
    const firstDayOfWeek = new Date(current);
    firstDayOfWeek.setDate(current.getDate() - dayOfWeek);

    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(firstDayOfWeek);
      d.setDate(firstDayOfWeek.getDate() + i);
      const year = d.getFullYear();
      const mStr = String(d.getMonth() + 1).padStart(2, '0');
      const dStr = String(d.getDate()).padStart(2, '0');
      return {
        dateStr: `${year}-${mStr}-${dStr}`,
        dayNumber: d.getDate(),
        dayLabel: d.toLocaleDateString('es-HN', { weekday: 'short', day: 'numeric', month: 'short' }),
        isCurrentMonth: true
      };
    });
  };

  const handlePrevPeriod = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'MONTH') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (viewMode === 'WEEK') {
      newDate.setDate(newDate.getDate() - 7);
    }
    setCurrentDate(newDate);
  };

  const handleNextPeriod = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'MONTH') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (viewMode === 'WEEK') {
      newDate.setDate(newDate.getDate() + 7);
    }
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleConfirmPayEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventToPay) return;

    const fund = tenantFunds.find(f => f.id === selectedPayFundId);
    if (!fund) {
      toast.error('Selecciona un fondo para realizar el pago');
      return;
    }

    const isRecurring = selectedEventToPay.eventType === 'RECURRING_EXPENSE' || selectedEventToPay.expenseCategory;
    payFinancialEvent(selectedEventToPay.id, selectedPayFundId);

    if (isRecurring) {
      toast.success(`Pago de ${formatCurrency(selectedEventToPay.amount, tenant.currencySymbol)} registrado en Gastos Operativos. ¡Próximo mes programado automáticamente!`);
    } else {
      toast.success(`Pago de ${formatCurrency(selectedEventToPay.amount, tenant.currencySymbol)} realizado desde ${fund.name}.`);
    }

    setSelectedEventToPay(null);
  };

  const handleSaveScheduleEvent = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(schedAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Ingresa un monto estimado válido');
      return;
    }
    if (!schedTitle.trim()) {
      toast.error('Ingresa un título para el gasto recurrente');
      return;
    }

    addFinancialEvent({
      eventType: 'RECURRING_EXPENSE',
      title: schedTitle.trim(),
      description: schedDescription.trim() || undefined,
      dueDate: schedDueDate,
      amount,
      status: 'PENDING',
      expenseCategory: schedCategory
    });

    toast.success(`Gasto recurrente "${schedTitle}" programado para el ${schedDueDate}.`);
    setIsScheduleModalOpen(false);
    setSchedTitle('');
    setSchedDescription('');
    setSchedAmount('');
  };

  return (
    <div className="view-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Header Banner */}
      <div className="glass-panel header-banner">
        <div>
          <h2 style={{ fontSize: '1.2rem', color: '#0f172a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CalendarIcon size={22} style={{ color: 'var(--accent-primary)' }} />
            Calendario Financiero & Flujo de Caja
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Proyección de liquidez, cuentas por pagar a proveedores y programación de servicios/gastos recurrentes
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => {
            setSelectedPayFundId(tenantFunds[0]?.id || '');
            setIsScheduleModalOpen(true);
          }}
          style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}
        >
          <Plus size={16} />
          <span>Programar Gasto Recurrente</span>
        </button>
      </div>

      {/* KPI Financial Cards Grid */}
      <div className="stats-grid-3" style={{ gap: '1rem' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem 1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Efectivo Estimado en Caja</span>
            <DollarSign size={18} style={{ color: '#10b981' }} />
          </div>
          <h2 style={{ fontSize: '1.6rem', color: '#10b981', fontWeight: 800, margin: 0 }}>
            {formatCurrency(currentCashInShift, tenant.currencySymbol)}
          </h2>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Apertura + ventas del turno</span>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem 1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Cuentas por Pagar (CXP)</span>
            <AlertTriangle size={18} style={{ color: '#ef4444' }} />
          </div>
          <h2 style={{ fontSize: '1.6rem', color: '#ef4444', fontWeight: 800, margin: 0 }}>
            {formatCurrency(totalPendingPayments, tenant.currencySymbol)}
          </h2>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Facturas y servicios pendientes</span>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem 1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Balance Neto Proyectado</span>
            <TrendingUp size={18} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <h2 style={{ fontSize: '1.6rem', color: currentCashInShift >= totalPendingPayments ? 'var(--accent-primary)' : '#ef4444', fontWeight: 800, margin: 0 }}>
            {formatCurrency(currentCashInShift - totalPendingPayments, tenant.currencySymbol)}
          </h2>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Disponible tras cubrir compromisos</span>
        </div>
      </div>

      {/* VIEW MODE SWITCHER BAR */}
      <div style={{ display: 'flex', gap: '0.5rem', background: '#f8fafc', padding: '0.35rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <button
          onClick={() => setViewMode('MONTH')}
          style={{
            flex: 1,
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            background: viewMode === 'MONTH' ? '#ffffff' : 'transparent',
            color: viewMode === 'MONTH' ? '#0f172a' : '#64748b',
            boxShadow: viewMode === 'MONTH' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem'
          }}
        >
          <LayoutGrid size={16} />
          <span>Cuadrícula Mensual</span>
        </button>

        <button
          onClick={() => setViewMode('WEEK')}
          style={{
            flex: 1,
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            background: viewMode === 'WEEK' ? '#ffffff' : 'transparent',
            color: viewMode === 'WEEK' ? '#0f172a' : '#64748b',
            boxShadow: viewMode === 'WEEK' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem'
          }}
        >
          <Grid size={16} />
          <span>Cuadrícula Semanal</span>
        </button>

        <button
          onClick={() => setViewMode('LIST')}
          style={{
            flex: 1,
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            background: viewMode === 'LIST' ? '#ffffff' : 'transparent',
            color: viewMode === 'LIST' ? '#0f172a' : '#64748b',
            boxShadow: viewMode === 'LIST' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem'
          }}
        >
          <List size={16} />
          <span>Línea de Tiempo / Lista</span>
        </button>
      </div>

      {/* VIEW 1: MONTHLY GRID */}
      {viewMode === 'MONTH' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          {/* Month Header Controls */}
          <div style={{ padding: '0.85rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={handlePrevPeriod} style={{ padding: '0.35rem 0.65rem' }}>
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', textTransform: 'capitalize', minWidth: '160px', textAlign: 'center' }}>
                {currentDate.toLocaleDateString('es-HN', { month: 'long', year: 'numeric' })}
              </span>
              <button className="btn btn-secondary" onClick={handleNextPeriod} style={{ padding: '0.35rem 0.65rem' }}>
                <ChevronRight size={16} />
              </button>
              <button className="btn btn-secondary" onClick={handleToday} style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}>
                Hoy
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.85rem', fontSize: '0.75rem', fontWeight: 600 }}>
              <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%' }}></span> Proveedores
              </span>
              <span style={{ color: '#0284c7', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ width: '8px', height: '8px', background: '#0284c7', borderRadius: '50%' }}></span> Gastos Recurrentes
              </span>
              <span style={{ color: '#d97706', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ width: '8px', height: '8px', background: '#d97706', borderRadius: '50%' }}></span> Impuestos SAR
              </span>
            </div>
          </div>

          {/* Day Names Grid Header (7 Cols) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', textAlign: 'center', fontSize: '0.78rem', fontWeight: 700, color: '#475569', padding: '0.5rem 0' }}>
            <div>Dom</div>
            <div>Lun</div>
            <div>Mar</div>
            <div>Mié</div>
            <div>Jue</div>
            <div>Vie</div>
            <div>Sáb</div>
          </div>

          {/* Month Grid Cells (7 Cols) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#e2e8f0', gap: '1px' }}>
            {getDaysInMonthGrid(currentDate).map((cell, idx) => {
              const eventsOnDay = tenantEvents.filter(e => e.dueDate === cell.dateStr);
              const todayStr = new Date().toISOString().split('T')[0];
              const isToday = cell.dateStr === todayStr;

              return (
                <div
                  key={idx}
                  style={{
                    background: isToday ? '#eff6ff' : (cell.isCurrentMonth ? '#ffffff' : '#f8fafc'),
                    minHeight: '105px',
                    padding: '0.4rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.3rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '0.8rem',
                      fontWeight: isToday ? 800 : (cell.isCurrentMonth ? 600 : 400),
                      color: isToday ? 'var(--accent-primary)' : (cell.isCurrentMonth ? '#0f172a' : '#94a3b8'),
                      background: isToday ? '#dbeafe' : 'transparent',
                      borderRadius: '50%',
                      width: '22px',
                      height: '22px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {cell.dayNumber}
                    </span>
                    {eventsOnDay.length > 0 && (
                      <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>
                        {eventsOnDay.length} evento(s)
                      </span>
                    )}
                  </div>

                  {/* Event Chips */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', overflow: 'hidden' }}>
                    {eventsOnDay.slice(0, 3).map((event) => {
                      const isPaid = event.status === 'PAID';
                      const isSupplier = event.eventType === 'SUPPLIER_PAYMENT';
                      const isRecurring = event.eventType === 'RECURRING_EXPENSE' || !!event.expenseCategory;

                      let chipBg = '#fef2f2';
                      let chipColor = '#b91c1c';
                      let icon = <DollarSign size={10} />;

                      if (isRecurring) {
                        chipBg = '#e0f2fe';
                        chipColor = '#0369a1';
                        icon = <Zap size={10} />;
                      } else if (!isSupplier) {
                        chipBg = '#fef3c7';
                        chipColor = '#b45309';
                        icon = <ShieldAlert size={10} />;
                      }

                      if (isPaid) {
                        chipBg = '#f1f5f9';
                        chipColor = '#64748b';
                      }

                      return (
                        <div
                          key={event.id}
                          onClick={() => {
                            if (!isPaid) {
                              setSelectedEventToPay(event);
                              setSelectedPayFundId(tenantFunds[0]?.id || '');
                            }
                          }}
                          title={`${event.title} - ${formatCurrency(event.amount, tenant.currencySymbol)} (${event.status})`}
                          style={{
                            background: chipBg,
                            color: chipColor,
                            padding: '0.15rem 0.35rem',
                            borderRadius: '4px',
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            cursor: isPaid ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            textDecoration: isPaid ? 'line-through' : 'none',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {icon}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {formatCurrency(event.amount, tenant.currencySymbol)} {event.title}
                          </span>
                        </div>
                      );
                    })}

                    {eventsOnDay.length > 3 && (
                      <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600, paddingLeft: '0.2rem' }}>
                        +{eventsOnDay.length - 3} más...
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: WEEKLY GRID */}
      {viewMode === 'WEEK' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          {/* Week Header Navigation Controls */}
          <div style={{ padding: '0.85rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={handlePrevPeriod} style={{ padding: '0.35rem 0.65rem' }}>
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                Semana del {getDaysInWeekGrid(currentDate)[0]?.dayLabel} al {getDaysInWeekGrid(currentDate)[6]?.dayLabel}
              </span>
              <button className="btn btn-secondary" onClick={handleNextPeriod} style={{ padding: '0.35rem 0.65rem' }}>
                <ChevronRight size={16} />
              </button>
              <button className="btn btn-secondary" onClick={handleToday} style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}>
                Hoy
              </button>
            </div>
          </div>

          {/* Week 7 Columns Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#e2e8f0', gap: '1px' }}>
            {getDaysInWeekGrid(currentDate).map((cell, idx) => {
              const eventsOnDay = tenantEvents.filter(e => e.dueDate === cell.dateStr);
              const todayStr = new Date().toISOString().split('T')[0];
              const isToday = cell.dateStr === todayStr;

              return (
                <div
                  key={idx}
                  style={{
                    background: isToday ? '#eff6ff' : '#ffffff',
                    minHeight: '260px',
                    padding: '0.65rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}
                >
                  <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.78rem', color: isToday ? 'var(--accent-primary)' : '#0f172a', fontWeight: 700, textTransform: 'capitalize', display: 'block' }}>
                      {cell.dayLabel}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
                    {eventsOnDay.length === 0 ? (
                      <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontStyle: 'italic', marginTop: '0.5rem' }}>Sin compromisos</span>
                    ) : (
                      eventsOnDay.map((event) => {
                        const isPaid = event.status === 'PAID';
                        const isSupplier = event.eventType === 'SUPPLIER_PAYMENT';
                        const isRecurring = event.eventType === 'RECURRING_EXPENSE' || !!event.expenseCategory;

                        let chipBg = '#fef2f2';
                        let chipColor = '#b91c1c';

                        if (isRecurring) {
                          chipBg = '#e0f2fe';
                          chipColor = '#0369a1';
                        } else if (!isSupplier) {
                          chipBg = '#fef3c7';
                          chipColor = '#b45309';
                        }

                        if (isPaid) {
                          chipBg = '#f1f5f9';
                          chipColor = '#64748b';
                        }

                        return (
                          <div
                            key={event.id}
                            onClick={() => {
                              if (!isPaid) {
                                setSelectedEventToPay(event);
                                setSelectedPayFundId(tenantFunds[0]?.id || '');
                              }
                            }}
                            style={{
                              background: chipBg,
                              color: chipColor,
                              padding: '0.35rem 0.5rem',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: isPaid ? 'default' : 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.15rem',
                              opacity: isPaid ? 0.6 : 1
                            }}
                          >
                            <span style={{ textDecoration: isPaid ? 'line-through' : 'none' }}>{event.title}</span>
                            <span style={{ fontSize: '0.72rem', fontWeight: 800 }}>{formatCurrency(event.amount, tenant.currencySymbol)}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 3: TIMELINE LIST */}
      {viewMode === 'LIST' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <h3 style={{ fontSize: '1.05rem', color: '#0f172a' }}>Eventos & Vencimientos Programados</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {tenantEvents.map((event) => {
              const isPaidOrDismissed = event.status === 'PAID' || event.status === 'DISMISSED';
              const isSupplier = event.eventType === 'SUPPLIER_PAYMENT';
              const isRecurring = event.eventType === 'RECURRING_EXPENSE' || !!event.expenseCategory;

              return (
                <div
                  key={event.id}
                  style={{
                    background: isPaidOrDismissed ? '#f8fafc' : '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    opacity: isPaidOrDismissed ? 0.65 : 1
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    {isSupplier ? (
                      <div style={{ width: '36px', height: '36px', background: '#fef2f2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                        <DollarSign size={18} />
                      </div>
                    ) : isRecurring ? (
                      <div style={{ width: '36px', height: '36px', background: '#e0f2fe', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                        <Zap size={18} />
                      </div>
                    ) : (
                      <div style={{ width: '36px', height: '36px', background: '#fffbeb', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
                        <ShieldAlert size={18} />
                      </div>
                    )}

                    <div>
                      <h4 style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 600, margin: 0 }}>{event.title}</h4>
                      <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.1rem 0' }}>{event.description}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                          Vence: {event.dueDate}
                        </span>
                        {isRecurring && (
                          <span style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>
                            GASTO RECURRENTE
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div>
                      <span style={{ fontWeight: 800, fontSize: '1rem', color: isSupplier ? '#ef4444' : (isRecurring ? '#0284c7' : '#d97706'), display: 'block' }}>
                        {formatCurrency(event.amount, tenant.currencySymbol)}
                      </span>
                      <span className={`badge ${event.status === 'PAID' ? 'badge-success' : (event.status === 'DISMISSED' ? 'badge-retail' : 'badge-wholesale')}`}>
                        {event.status === 'PAID' ? 'PAGADO' : (event.status === 'DISMISSED' ? 'OMITIDO' : 'PENDIENTE')}
                      </span>
                    </div>

                    {!isPaidOrDismissed && (
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          setSelectedEventToPay(event);
                          setSelectedPayFundId(tenantFunds[0]?.id || '');
                        }}
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', gap: '0.3rem' }}
                      >
                        <CheckCircle2 size={14} /> Pagar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL 1: Pay Event selecting Fund */}
      {selectedEventToPay && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <h3 style={{ color: '#0f172a', marginBottom: '0.5rem' }}>Pagar Vencimiento</h3>
            <p style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: 600, marginBottom: '0.75rem' }}>
              {selectedEventToPay.title} — {formatCurrency(selectedEventToPay.amount, tenant.currencySymbol)}
            </p>

            {(selectedEventToPay.eventType === 'RECURRING_EXPENSE' || selectedEventToPay.expenseCategory) && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.65rem 0.85rem', fontSize: '0.78rem', color: '#1e40af', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Info size={14} style={{ flexShrink: 0 }} />
                <span>Al confirmar, el desembolso se descontará del fondo, se registrará la transacción en <strong>Gastos Operativos</strong> y el sistema programará automáticamente el vencimiento para el próximo mes.</span>
              </div>
            )}

            <form onSubmit={handleConfirmPayEvent} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group">
                <label className="form-label">¿De qué Fondo se pagará este compromiso? *</label>
                <select
                  className="input-control"
                  value={selectedPayFundId}
                  onChange={(e) => setSelectedPayFundId(e.target.value)}
                  required
                >
                  {tenantFunds.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name} — Saldo Actual: {formatCurrency(f.balance, tenant.currencySymbol)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedEventToPay(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ gap: '0.4rem' }}>
                  <CheckCircle2 size={16} /> Confirmar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Schedule Recurring Expense */}
      {isScheduleModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Zap size={20} style={{ color: '#0284c7' }} />
                Programar Gasto Recurrente
              </h3>
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveScheduleEvent} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group">
                <label className="form-label">Título del Servicio / Gasto *</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="Ej: Servicio de Energía ENEE, Alquiler del Local, Internet Claro"
                  value={schedTitle}
                  onChange={(e) => setSchedTitle(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div className="form-group">
                  <label className="form-label">Categoría *</label>
                  <select
                    className="input-control"
                    value={schedCategory}
                    onChange={(e) => setSchedCategory(e.target.value as ExpenseCategory)}
                    required
                  >
                    <option value="SERVICIOS_PUBLICOS">Servicios Públicos (Luz, agua, tel)</option>
                    <option value="ALQUILER">Alquiler / Renta de Local</option>
                    <option value="MANTENIMIENTO">Mantenimiento de Equipo</option>
                    <option value="INSUMOS_OFICINA">Insumos de Oficina</option>
                    <option value="OTROS">Otros Gastos Recurrentes</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Monto Estimado ({tenant.currencySymbol}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="input-control"
                    placeholder="0.00"
                    value={schedAmount}
                    onChange={(e) => setSchedAmount(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Fecha Límite de Pago / Vencimiento *</label>
                <input
                  type="date"
                  className="input-control"
                  value={schedDueDate}
                  onChange={(e) => setSchedDueDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Descripción Opcional</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="Detalles sobre el contrato o número de contador"
                  value={schedDescription}
                  onChange={(e) => setSchedDescription(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsScheduleModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ gap: '0.4rem' }}>
                  <CheckCircle2 size={16} />
                  <span>Programar en Calendario</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default FinancialCalendar;
