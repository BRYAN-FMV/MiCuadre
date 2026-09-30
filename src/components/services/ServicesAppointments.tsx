import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { formatCurrency } from '../../lib/monetary';
import { toast } from 'sonner';
import {
  Scissors, Calendar, User, Plus, ShoppingCart, DollarSign, CheckCircle,
  Clock, Pencil, Trash2, ChevronLeft, ChevronRight, ChevronDown, Grid, List, Filter, Lock, AlertTriangle
} from 'lucide-react';
import { Appointment, Service } from '../../types';

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const WEEKDAY_NAMES_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export const ServicesAppointments: React.FC = () => {
  const {
    services, staff, profiles, currentUser, appointments, commissions, tenant,
    addService, updateService, deleteService,
    addAppointment, updateAppointment, updateAppointmentStatus, deleteAppointment,
    sendAppointmentToPos, payStaffCommissions, payCommissionItem
  } = useAppStore();

  const tenantServices = services.filter(s => s.tenantId === tenant.id);
  const tenantStaff = staff.filter(s => s.tenantId === tenant.id);
  const tenantProfiles = profiles.filter(p => p.tenantId === tenant.id && (p.isActive ?? true));
  const tenantAppointments = appointments.filter(a => a.tenantId === tenant.id);
  const tenantCommissions = commissions.filter(c => c.tenantId === tenant.id);

  // Combine staff and profiles into a unified list of available personnel
  const availableStaffMap = new Map<string, { id: string; fullName: string }>();

  tenantStaff.forEach(s => {
    availableStaffMap.set(s.id, { id: s.id, fullName: s.fullName });
  });

  tenantProfiles.forEach(p => {
    if (!availableStaffMap.has(p.id) && !Array.from(availableStaffMap.values()).some(existing => existing.fullName.toLowerCase() === p.fullName.toLowerCase())) {
      availableStaffMap.set(p.id, { id: p.id, fullName: p.fullName });
    }
  });

  if (availableStaffMap.size === 0 && currentUser) {
    availableStaffMap.set(currentUser.id, { id: currentUser.id, fullName: currentUser.fullName });
  }

  const availableStaff = Array.from(availableStaffMap.values());

  const [activeSubTab, setActiveSubTab] = useState<'appointments' | 'services' | 'commissions'>('appointments');

  // Appointments View State: 'calendar' (Month Grid) or 'cards' (Daily List)
  const [appViewMode, setAppViewMode] = useState<'calendar' | 'cards'>('calendar');
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [staffFilterId, setStaffFilterId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | Appointment['status']>('ALL');

  // New Appointment Form State
  const [isAppModalOpen, setIsAppModalOpen] = useState(false);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState(availableStaff[0]?.id || '');
  const [selectedServiceId, setSelectedServiceId] = useState(tenantServices[0]?.id || '');
  const [appDate, setAppDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [appTime, setAppTime] = useState<string>('10:00');
  const [appNotes, setAppNotes] = useState('');

  // Multi-service items state in appointment modals
  const [appServiceItems, setAppServiceItems] = useState<Array<{ serviceId: string; staffId: string }>>([]);
  const [editServiceItems, setEditServiceItems] = useState<Array<{ serviceId: string; staffId: string }>>([]);

  // Keep defaults in sync
  useEffect(() => {
    if (!selectedStaffId && availableStaff.length > 0) {
      setSelectedStaffId(availableStaff[0].id);
    }
  }, [availableStaff, selectedStaffId]);

  useEffect(() => {
    if (!selectedServiceId && tenantServices.length > 0) {
      setSelectedServiceId(tenantServices[0].id);
    }
  }, [tenantServices, selectedServiceId]);

  // Edit Appointment Modal State
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [editCustName, setEditCustName] = useState('');
  const [editCustPhone, setEditCustPhone] = useState('');
  const [editStaffId, setEditStaffId] = useState('');
  const [editServiceId, setEditServiceId] = useState('');
  const [editAppDate, setEditAppDate] = useState<string>('');
  const [editAppTime, setEditAppTime] = useState<string>('10:00');
  const [editStatus, setEditStatus] = useState<Appointment['status']>('SCHEDULED');
  const [editNotes, setEditNotes] = useState('');

  // Commissions Expandable Rows State & Grouping
  const [expandedStaffIds, setExpandedStaffIds] = useState<string[]>([]);

  const toggleExpandStaff = (staffId: string) => {
    setExpandedStaffIds(prev =>
      prev.includes(staffId) ? prev.filter(id => id !== staffId) : [...prev, staffId]
    );
  };

  const groupedStaffCommissions = React.useMemo(() => {
    const map: Record<string, {
      staffId: string;
      staffName: string;
      salesCount: number;
      totalSalesAmount: number;
      totalCommissionAmount: number;
      pendingCommissionAmount: number;
      paidCommissionAmount: number;
      items: typeof tenantCommissions;
    }> = {};

    tenantCommissions.forEach(comm => {
      const key = comm.staffId || comm.staffName || 'unassigned';
      if (!map[key]) {
        map[key] = {
          staffId: key,
          staffName: comm.staffName || 'Colaborador',
          salesCount: 0,
          totalSalesAmount: 0,
          totalCommissionAmount: 0,
          pendingCommissionAmount: 0,
          paidCommissionAmount: 0,
          items: []
        };
      }
      map[key].salesCount += 1;
      map[key].totalSalesAmount += comm.saleAmount;
      map[key].totalCommissionAmount += comm.commissionAmount;
      if (comm.status === 'PAID') {
        map[key].paidCommissionAmount += comm.commissionAmount;
      } else {
        map[key].pendingCommissionAmount += comm.commissionAmount;
      }
      map[key].items.push(comm);
    });

    return Object.values(map).sort((a, b) => b.totalCommissionAmount - a.totalCommissionAmount);
  }, [tenantCommissions]);

  const totalAllCommissions = tenantCommissions.reduce((acc, c) => acc + c.commissionAmount, 0);
  const totalPendingCommissions = tenantCommissions.filter(c => c.status !== 'PAID').reduce((acc, c) => acc + c.commissionAmount, 0);
  const totalPaidCommissions = tenantCommissions.filter(c => c.status === 'PAID').reduce((acc, c) => acc + c.commissionAmount, 0);

  // New Service Form State
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [serviceName, setServiceName] = useState('');
  const [serviceDuration, setServiceDuration] = useState('30');
  const [servicePrice, setServicePrice] = useState('250.00');
  const [commissionType, setCommissionType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [commissionValue, setCommissionValue] = useState('40');

  // Edit Service Modal State
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editServiceName, setEditServiceName] = useState('');
  const [editServiceDuration, setEditServiceDuration] = useState('30');
  const [editServicePrice, setEditServicePrice] = useState('250.00');
  const [editCommissionType, setEditCommissionType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [editCommissionValue, setEditCommissionValue] = useState('40');

  // Date String Helper (YYYY-MM-DD) from ISO or Date
  const getLocalDateString = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getIsoDateString = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return getLocalDateString(d);
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  };

  const getIsoTimeString = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    } catch {
      return '10:00';
    }
  };

  // Check 1-hour urgency or overdue status
  const getAppointmentUrgency = (scheduledAt: string, status: Appointment['status']) => {
    if (status === 'COMPLETED' || status === 'CANCELLED') return null;

    const nowMs = Date.now();
    const appTimeMs = new Date(scheduledAt).getTime();
    const diffMinutes = Math.round((appTimeMs - nowMs) / (1000 * 60));

    if (diffMinutes >= 0 && diffMinutes <= 60) {
      return {
        isUrgent: true,
        diffMinutes,
        label: diffMinutes === 0 ? '¡Es Ahora!' : `¡Próxima en ${diffMinutes} min!`,
        badgeStyle: { background: '#fff7ed', border: '1px solid #fdba74', color: '#c2410c', fontWeight: 800, padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }
      };
    } else if (diffMinutes < 0 && diffMinutes >= -180) {
      return {
        isUrgent: true,
        diffMinutes,
        label: `En curso / Atrasada (${Math.abs(diffMinutes)} min)`,
        badgeStyle: { background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', fontWeight: 800, padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }
      };
    }

    return null;
  };

  // Schedule Overlap Validation Helper for Staff
  const checkStaffAppointmentOverlap = (
    items: Array<{ serviceId: string; staffId: string }>,
    dateStr: string,
    timeStr: string,
    excludeAppointmentId?: string
  ) => {
    const startMs = new Date(`${dateStr}T${timeStr}:00`).getTime();
    if (isNaN(startMs)) return null;

    for (const item of items) {
      if (!item.staffId || !item.serviceId) continue;
      const serviceObj = tenantServices.find(s => s.id === item.serviceId);
      const durationMin = serviceObj?.durationMinutes || 30;
      const endMs = startMs + durationMin * 60 * 1000;
      const staffObj = availableStaff.find(s => s.id === item.staffId);

      for (const existApp of tenantAppointments) {
        if (excludeAppointmentId && existApp.id === excludeAppointmentId) continue;
        if (existApp.status === 'CANCELLED' || existApp.status === 'COMPLETED') continue;

        const existStartMs = new Date(existApp.scheduledAt).getTime();
        if (isNaN(existStartMs)) continue;

        const existItems = (existApp.items && existApp.items.length > 0)
          ? existApp.items
          : [{ serviceId: existApp.serviceId, staffId: existApp.staffId }];

        for (const existItem of existItems) {
          if (existItem.staffId === item.staffId) {
            const existServObj = tenantServices.find(s => s.id === existItem.serviceId);
            const existDuration = existServObj?.durationMinutes || 30;
            const existEndMs = existStartMs + existDuration * 60 * 1000;

            // Overlap check: start < existEnd && end > existStart
            if (startMs < existEndMs && endMs > existStartMs) {
              const existStartStr = new Date(existStartMs).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' });
              const existEndStr = new Date(existEndMs).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' });
              const existStaffName = ('staffName' in existItem ? existItem.staffName : undefined) || existApp.staffName;
              const existServiceName = ('serviceName' in existItem ? existItem.serviceName : undefined) || existApp.serviceName;
              return {
                staffName: staffObj?.fullName || existStaffName || 'El empleado',
                serviceName: existServObj?.name || existServiceName || 'Servicio',
                customerName: existApp.customerName,
                existStartStr,
                existEndStr
              };
            }
          }
        }
      }
    }
    return null;
  };

  // Open new appointment modal for a specific target date
  const handleOpenNewAppointmentForDate = (dateStr?: string) => {
    const defaultStaff = availableStaff[0]?.id || '';
    const defaultService = tenantServices[0]?.id || '';
    setSelectedStaffId(defaultStaff);
    setSelectedServiceId(defaultService);
    setAppServiceItems([{ serviceId: defaultService, staffId: defaultStaff }]);
    if (dateStr) {
      setAppDate(dateStr);
    } else {
      setAppDate(getLocalDateString(new Date()));
    }
    setAppTime('10:00');
    setIsAppModalOpen(true);
  };

  // Appointment creation
  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    const itemsToUse = appServiceItems.length > 0
      ? appServiceItems
      : [{ serviceId: selectedServiceId || tenantServices[0]?.id || '', staffId: selectedStaffId || availableStaff[0]?.id || '' }];

    if (!custName || !appDate || !appTime || itemsToUse.some(i => !i.serviceId || !i.staffId)) {
      toast.error('Completa todos los datos requeridos');
      return;
    }

    // Check for employee schedule overlap
    const conflict = checkStaffAppointmentOverlap(itemsToUse, appDate, appTime);
    if (conflict) {
      toast.error(`Empalme de horario: ${conflict.staffName} ya tiene programado "${conflict.serviceName}" (${conflict.existStartStr} - ${conflict.existEndStr}) con ${conflict.customerName}.`);
      return;
    }

    const scheduledIso = new Date(`${appDate}T${appTime}:00`).toISOString();

    const finalItems = itemsToUse.map((item, idx) => {
      const s = tenantServices.find(serv => serv.id === item.serviceId);
      const st = availableStaff.find(staff => staff.id === item.staffId);
      return {
        id: `item-${Date.now()}-${idx}`,
        serviceId: item.serviceId,
        serviceName: s?.name,
        staffId: item.staffId,
        staffName: st?.fullName,
        durationMinutes: s?.durationMinutes || 30,
        price: s?.price || 0
      };
    });

    const firstItem = finalItems[0];
    const serviceNamesCombined = finalItems.map(i => i.serviceName).filter(Boolean).join(' + ');
    const staffNamesCombined = Array.from(new Set(finalItems.map(i => i.staffName).filter(Boolean))).join(', ');

    addAppointment({
      customerName: custName,
      customerPhone: custPhone,
      staffId: firstItem?.staffId || selectedStaffId,
      staffName: staffNamesCombined,
      serviceId: firstItem?.serviceId || selectedServiceId,
      serviceName: serviceNamesCombined,
      scheduledAt: scheduledIso,
      status: 'SCHEDULED',
      notes: appNotes,
      items: finalItems
    });

    toast.success(`Cita agendada para ${custName}`);
    setIsAppModalOpen(false);
    setCustName('');
    setCustPhone('');
    setAppNotes('');
  };

  // Status Change Handler with POS Redirection for COMPLETED
  const handleStatusChange = (app: Appointment, newStatus: Appointment['status']) => {
    if (app.status === 'COMPLETED') {
      toast.warning('Esta cita ya fue cobrada y completada en Ventas. No se puede modificar.');
      return;
    }

    if (newStatus === 'COMPLETED') {
      toast.info(`Redirigiendo a Ventas para cobrar la cita de ${app.customerName} y registrar el ingreso en reportes.`);
      sendAppointmentToPos(app);
      return;
    }

    updateAppointmentStatus(app.id, newStatus);
    toast.success(`Estado de la cita de ${app.customerName} actualizado`);
  };

  // Appointment editing submit (Blocked if COMPLETED)
  const handleOpenEditAppointment = (app: Appointment) => {
    if (app.status === 'COMPLETED') {
      toast.warning('Esta cita ya fue completada y cobrada. No es posible editarla.');
      return;
    }
    setEditingAppointment(app);
    setEditCustName(app.customerName);
    setEditCustPhone(app.customerPhone || '');
    setEditStaffId(app.staffId);
    setEditServiceId(app.serviceId);
    if (app.items && app.items.length > 0) {
      setEditServiceItems(app.items.map(i => ({ serviceId: i.serviceId, staffId: i.staffId })));
    } else {
      setEditServiceItems([{ serviceId: app.serviceId, staffId: app.staffId }]);
    }
    setEditAppDate(getIsoDateString(app.scheduledAt));
    setEditAppTime(getIsoTimeString(app.scheduledAt));
    setEditStatus(app.status);
    setEditNotes(app.notes || '');
  };

  const handleSaveEditedAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAppointment) return;

    if (editingAppointment.status === 'COMPLETED') {
      toast.error('Las citas completadas no se pueden modificar');
      setEditingAppointment(null);
      return;
    }

    if (editStatus === 'COMPLETED') {
      toast.info(`Redirigiendo a Ventas para procesar el cobro en caja de ${editingAppointment.customerName}.`);
      sendAppointmentToPos(editingAppointment);
      setEditingAppointment(null);
      return;
    }

    const itemsToUse = editServiceItems.length > 0
      ? editServiceItems
      : [{ serviceId: editServiceId || tenantServices[0]?.id || '', staffId: editStaffId || availableStaff[0]?.id || '' }];

    if (!editCustName || !editAppDate || !editAppTime || itemsToUse.some(i => !i.serviceId || !i.staffId)) {
      toast.error('Completa todos los datos requeridos');
      return;
    }

    // Check overlap excluding this editing appointment
    const conflict = checkStaffAppointmentOverlap(itemsToUse, editAppDate, editAppTime, editingAppointment.id);
    if (conflict) {
      toast.error(`Empalme de horario: ${conflict.staffName} ya tiene programado "${conflict.serviceName}" (${conflict.existStartStr} - ${conflict.existEndStr}) con ${conflict.customerName}.`);
      return;
    }

    const scheduledIso = (editAppDate && editAppTime)
      ? new Date(`${editAppDate}T${editAppTime}:00`).toISOString()
      : editingAppointment.scheduledAt;

    const finalItems = itemsToUse.map((item, idx) => {
      const s = tenantServices.find(serv => serv.id === item.serviceId);
      const st = availableStaff.find(staff => staff.id === item.staffId);
      return {
        id: `item-${Date.now()}-${idx}`,
        serviceId: item.serviceId,
        serviceName: s?.name,
        staffId: item.staffId,
        staffName: st?.fullName,
        durationMinutes: s?.durationMinutes || 30,
        price: s?.price || 0
      };
    });

    const firstItem = finalItems[0];
    const serviceNamesCombined = finalItems.map(i => i.serviceName).filter(Boolean).join(' + ');
    const staffNamesCombined = Array.from(new Set(finalItems.map(i => i.staffName).filter(Boolean))).join(', ');

    updateAppointment(editingAppointment.id, {
      customerName: editCustName,
      customerPhone: editCustPhone,
      staffId: firstItem?.staffId || editStaffId,
      staffName: staffNamesCombined,
      serviceId: firstItem?.serviceId || editServiceId,
      serviceName: serviceNamesCombined,
      scheduledAt: scheduledIso,
      status: editStatus,
      notes: editNotes,
      items: finalItems
    });

    toast.success('Cita actualizada correctamente');
    setEditingAppointment(null);
  };

  const handleDeleteAppointment = (app: Appointment) => {
    if (app.status === 'COMPLETED') {
      if (!confirm(`La cita de ${app.customerName} ya fue cobrada y registrada en ventas. ¿Deseas eliminar el registro histórico de la cita?`)) {
        return;
      }
    } else if (!confirm(`¿Estás seguro de eliminar la cita de ${app.customerName}?`)) {
      return;
    }

    deleteAppointment(app.id);
    toast.success('Cita eliminada');
  };

  // Service creation
  const handleCreateService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName || !servicePrice) return;

    addService({
      name: serviceName,
      durationMinutes: parseInt(serviceDuration) || 30,
      price: parseFloat(servicePrice) || 0,
      commissionType,
      commissionValue: parseFloat(commissionValue) || 0,
      isActive: true
    });

    toast.success(`Servicio "${serviceName}" creado`);
    setIsServiceModalOpen(false);
    setServiceName('');
    setServicePrice('250.00');
  };

  // Service editing
  const handleOpenEditService = (service: Service) => {
    setEditingService(service);
    setEditServiceName(service.name);
    setEditServiceDuration(String(service.durationMinutes || 30));
    setEditServicePrice(String(service.price));
    setEditCommissionType(service.commissionType || 'PERCENTAGE');
    setEditCommissionValue(String(service.commissionValue || 0));
  };

  const handleSaveEditedService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;

    updateService(editingService.id, {
      name: editServiceName,
      durationMinutes: parseInt(editServiceDuration) || 30,
      price: parseFloat(editServicePrice) || 0,
      commissionType: editCommissionType,
      commissionValue: parseFloat(editCommissionValue) || 0
    });

    toast.success('Servicio actualizado correctamente');
    setEditingService(null);
  };

  const handleDeleteService = (service: Service) => {
    if (confirm(`¿Estás seguro de eliminar el servicio "${service.name}"?`)) {
      deleteService(service.id);
      toast.success('Servicio eliminado');
    }
  };

  // Spanish badge status UI helper
  const getStatusBadge = (status: Appointment['status']) => {
    switch (status) {
      case 'SCHEDULED':
        return <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.2rem 0.55rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700 }}>Programada</span>;
      case 'IN_PROGRESS':
        return <span style={{ background: '#fef3c7', color: '#b45309', padding: '0.2rem 0.55rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700 }}>En Proceso</span>;
      case 'COMPLETED':
        return <span style={{ background: '#dcfce7', color: '#15803d', padding: '0.2rem 0.55rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}><CheckCircle size={12} /> Completada</span>;
      case 'CANCELLED':
        return <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.2rem 0.55rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700 }}>Cancelada</span>;
      default:
        return <span style={{ background: '#f1f5f9', color: '#475569', padding: '0.2rem 0.55rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700 }}>{status}</span>;
    }
  };

  const getStatusDotColor = (status: Appointment['status']) => {
    switch (status) {
      case 'SCHEDULED': return '#0284c7';
      case 'IN_PROGRESS': return '#d97706';
      case 'COMPLETED': return '#16a34a';
      case 'CANCELLED': return '#dc2626';
      default: return '#64748b';
    }
  };

  // SORTING & FILTERING:
  // 1. Staff & Status Filtering
  // 2. Active appointments (SCHEDULED / IN_PROGRESS) come first, sorted by nearest scheduled time ascending.
  // 3. Completed & Cancelled appointments are sent to the BOTTOM, sorted by scheduled time descending.
  const sortedAppointments = [...tenantAppointments]
    .filter(app => {
      if (staffFilterId !== 'ALL' && app.staffId !== staffFilterId) return false;
      if (statusFilter !== 'ALL' && app.status !== statusFilter) return false;
      return true;
    })
    .sort((a, b) => {
      const isAFinished = a.status === 'COMPLETED' || a.status === 'CANCELLED';
      const isBFinished = b.status === 'COMPLETED' || b.status === 'CANCELLED';

      // Active appointments come before finished appointments
      if (!isAFinished && isBFinished) return -1;
      if (isAFinished && !isBFinished) return 1;

      // If both are active, sort chronologically ascending (nearest time first)
      if (!isAFinished && !isBFinished) {
        return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
      }

      // If both are finished, sort chronologically descending (most recently finished first)
      return new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime();
    });

  // Calendar Grid Calculation for Month View
  const getDaysInMonthGrid = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun ...
    const totalDaysInMonth = lastDayOfMonth.getDate();

    const days: Array<{ date: Date; isCurrentMonth: boolean; dateString: string; isToday: boolean }> = [];
    const todayStr = getLocalDateString(new Date());

    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      const ds = getLocalDateString(d);
      days.push({
        date: d,
        isCurrentMonth: false,
        dateString: ds,
        isToday: ds === todayStr
      });
    }

    // Current month days
    for (let i = 1; i <= totalDaysInMonth; i++) {
      const d = new Date(year, month, i);
      const ds = getLocalDateString(d);
      days.push({
        date: d,
        isCurrentMonth: true,
        dateString: ds,
        isToday: ds === todayStr
      });
    }

    // Next month padding to fill out 35 or 42 grid cells
    const remaining = 42 - days.length;
    const targetLength = days.length <= 35 && (days.length + remaining % 7) <= 35 ? 35 : 42;
    const paddingNeeded = targetLength - days.length;

    for (let i = 1; i <= paddingNeeded; i++) {
      const d = new Date(year, month + 1, i);
      const ds = getLocalDateString(d);
      days.push({
        date: d,
        isCurrentMonth: false,
        dateString: ds,
        isToday: ds === todayStr
      });
    }

    return days;
  };

  const daysGrid = getDaysInMonthGrid(currentMonthDate);

  const handlePrevMonth = () => {
    setCurrentMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleTodayMonth = () => {
    setCurrentMonthDate(new Date());
  };

  return (
    <div className="view-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Header & Navigation */}
      <div className="glass-panel header-banner">
        <div>
          <h2 style={{ fontSize: '1.2rem', color: '#0f172a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Scissors size={22} style={{ color: 'var(--accent-primary)' }} />
            Servicios, Citas & Comisiones
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Agenda interactiva por horario, alertas de proximidad (1 hora), cobro integrado en ventas y reportes
          </p>
        </div>

        <div className="header-controls" style={{ gap: '0.4rem' }}>
          <button
            className={`btn ${activeSubTab === 'appointments' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('appointments')}
            style={{ padding: '0.45rem 0.8rem', fontSize: '0.8rem' }}
          >
            <Calendar size={14} /> Citas & Calendario
          </button>
          <button
            className={`btn ${activeSubTab === 'services' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('services')}
            style={{ padding: '0.45rem 0.8rem', fontSize: '0.8rem' }}
          >
            <Scissors size={14} /> Servicios
          </button>
          <button
            className={`btn ${activeSubTab === 'commissions' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('commissions')}
            style={{ padding: '0.45rem 0.8rem', fontSize: '0.8rem' }}
          >
            <DollarSign size={14} /> Comisiones
          </button>
        </div>
      </div>

      {/* SUBTAB 1: Appointments Queue & Calendar View */}
      {activeSubTab === 'appointments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Subtab Bar & Controls */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.75rem 1rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
            
            {/* Left: View mode selector, Staff filter & Status Filter */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: '#f1f5f9', padding: '0.2rem', borderRadius: '8px', display: 'flex', gap: '0.2rem' }}>
                <button
                  className={`btn ${appViewMode === 'calendar' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setAppViewMode('calendar')}
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', border: 'none' }}
                >
                  <Grid size={14} /> Calendario
                </button>
                <button
                  className={`btn ${appViewMode === 'cards' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setAppViewMode('cards')}
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', border: 'none' }}
                >
                  <List size={14} /> Agenda (Próximas Primero)
                </button>
              </div>

              {/* Staff Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Filter size={14} style={{ color: '#64748b' }} />
                <select
                  className="input-control"
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem', width: 'auto' }}
                  value={staffFilterId}
                  onChange={(e) => setStaffFilterId(e.target.value)}
                >
                  <option value="ALL">Todos los Profesionales ({availableStaff.length})</option>
                  {availableStaff.map(st => (
                    <option key={st.id} value={st.id}>{st.fullName}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <select
                  className="input-control"
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem', width: 'auto' }}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <option value="ALL">Todos los Estados</option>
                  <option value="SCHEDULED">Programadas</option>
                  <option value="IN_PROGRESS">En Proceso</option>
                  <option value="COMPLETED">Completadas (Cobradas)</option>
                  <option value="CANCELLED">Canceladas</option>
                </select>
              </div>
            </div>

            {/* Right: Month Controls & New Appointment Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              {appViewMode === 'calendar' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <button className="btn btn-secondary" onClick={handlePrevMonth} style={{ padding: '0.35rem 0.5rem' }} title="Mes anterior">
                    <ChevronLeft size={16} />
                  </button>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', minWidth: '130px', textAlign: 'center' }}>
                    {MONTH_NAMES_ES[currentMonthDate.getMonth()]} {currentMonthDate.getFullYear()}
                  </span>
                  <button className="btn btn-secondary" onClick={handleNextMonth} style={{ padding: '0.35rem 0.5rem' }} title="Mes siguiente">
                    <ChevronRight size={16} />
                  </button>
                  <button className="btn btn-secondary" onClick={handleTodayMonth} style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}>
                    Hoy
                  </button>
                </div>
              )}

              <button className="btn btn-primary" onClick={() => handleOpenNewAppointmentForDate()} style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}>
                <Plus size={15} /> Nueva Cita
              </button>
            </div>
          </div>

          {/* VIEW MODE 1: Interactive Month Calendar */}
          {appViewMode === 'calendar' && (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              
              {/* Weekday Header */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 700, fontSize: '0.8rem', color: '#475569' }}>
                {WEEKDAY_NAMES_ES.map(dayName => (
                  <div key={dayName} style={{ padding: '0.6rem 0.25rem' }}>{dayName}</div>
                ))}
              </div>

              {/* Month Grid Cells */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(110px, auto)', gap: '1px', background: '#e2e8f0' }}>
                {daysGrid.map((dayItem, idx) => {
                  // Filter and sort day's appointments: Active first, Completed at bottom
                  const dayApps = sortedAppointments
                    .filter(a => getIsoDateString(a.scheduledAt) === dayItem.dateString);
                  
                  return (
                    <div
                      key={idx}
                      style={{
                        background: dayItem.isToday ? '#f0f9ff' : dayItem.isCurrentMonth ? '#ffffff' : '#f8fafc',
                        padding: '0.4rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.3rem',
                        minHeight: '110px',
                        position: 'relative'
                      }}
                    >
                      {/* Day Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{
                          fontSize: '0.8rem',
                          fontWeight: dayItem.isToday ? 800 : 600,
                          color: dayItem.isToday ? 'var(--accent-primary)' : dayItem.isCurrentMonth ? '#0f172a' : '#94a3b8',
                          background: dayItem.isToday ? '#e0f2fe' : 'transparent',
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {dayItem.date.getDate()}
                        </span>

                        <button
                          onClick={() => handleOpenNewAppointmentForDate(dayItem.dateString)}
                          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.1rem', borderRadius: '4px' }}
                          title={`Agendar cita para el ${dayItem.dateString}`}
                        >
                          <Plus size={13} />
                        </button>
                      </div>

                      {/* Day Appointments List */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', overflowY: 'auto', maxHeight: '100px' }}>
                        {dayApps.map(app => {
                          const urgency = getAppointmentUrgency(app.scheduledAt, app.status);
                          const isCompleted = app.status === 'COMPLETED';

                          return (
                            <div
                              key={app.id}
                              onClick={() => handleOpenEditAppointment(app)}
                              style={{
                                background: isCompleted ? '#f0fdf4' : urgency?.isUrgent ? '#fff7ed' : '#ffffff',
                                border: isCompleted ? '1px solid #bbf7d0' : urgency?.isUrgent ? '1px solid #fdba74' : `1px solid ${getStatusDotColor(app.status)}33`,
                                borderLeft: isCompleted ? '3px solid #16a34a' : urgency?.isUrgent ? '3px solid #f97316' : `3px solid ${getStatusDotColor(app.status)}`,
                                borderRadius: '4px',
                                padding: '0.25rem 0.35rem',
                                fontSize: '0.72rem',
                                cursor: isCompleted ? 'default' : 'pointer',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.1rem',
                                opacity: isCompleted ? 0.75 : 1
                              }}
                              title={isCompleted ? `Cita cobrada y completada: ${app.customerName}` : `Cita: ${app.customerName} - ${app.serviceName || 'Servicio'}`}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 700, color: isCompleted ? '#166534' : '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '85px', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                  {isCompleted && <Lock size={10} style={{ color: '#16a34a' }} />}
                                  {app.customerName}
                                </span>
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: urgency?.isUrgent ? '#c2410c' : '#64748b' }}>
                                  {getIsoTimeString(app.scheduledAt)}
                                </span>
                              </div>

                              {urgency?.isUrgent && (
                                <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#c2410c' }}>
                                  {urgency.label}
                                </div>
                              )}

                              <div style={{ fontSize: '0.68rem', color: isCompleted ? '#15803d' : '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {isCompleted ? 'Cobrada' : app.serviceName}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW MODE 2: Cards Agenda Grid (Sorted: Active first, Completed at bottom) */}
          {appViewMode === 'cards' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
              {sortedAppointments.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', padding: '2.5rem', textAlign: 'center', background: '#ffffff', borderRadius: '12px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
                  No hay citas que coincidan con los filtros. Haz clic en <strong>"Nueva Cita"</strong> para agendar una.
                </div>
              ) : (
                sortedAppointments.map((app) => {
                  const urgency = getAppointmentUrgency(app.scheduledAt, app.status);
                  const isCompleted = app.status === 'COMPLETED';

                  return (
                    <div
                      key={app.id}
                      style={{
                        background: isCompleted ? '#f8fafc' : urgency?.isUrgent ? '#fffdfa' : '#ffffff',
                        border: isCompleted ? '1px solid #d1fae5' : urgency?.isUrgent ? '2px solid #f97316' : '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.6rem',
                        boxShadow: urgency?.isUrgent ? '0 4px 12px rgba(249, 115, 22, 0.15)' : '0 1px 3px rgba(0,0,0,0.03)',
                        opacity: isCompleted ? 0.85 : 1
                      }}
                    >
                      {/* Urgency Highlight Banner if <= 1 Hour */}
                      {urgency?.isUrgent && (
                        <div style={urgency.badgeStyle}>
                          <Clock size={13} />
                          <span>{urgency.label}</span>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {getStatusBadge(app.status)}
                        <span style={{ fontSize: '0.78rem', color: urgency?.isUrgent ? '#c2410c' : '#64748b', fontWeight: urgency?.isUrgent ? 700 : 500, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <Clock size={12} /> {getIsoDateString(app.scheduledAt)} - {getIsoTimeString(app.scheduledAt)}
                        </span>
                      </div>

                      <div>
                        <h4 style={{ fontSize: '1.05rem', color: '#0f172a', fontWeight: 700, margin: '0' }}>{app.customerName}</h4>
                        {app.customerPhone && (
                          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.1rem 0 0 0' }}>Tel: {app.customerPhone}</p>
                        )}
                      </div>

                      <div style={{ background: isCompleted ? '#ffffff' : '#f8fafc', padding: '0.6rem', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', border: isCompleted ? '1px solid #e2e8f0' : 'none' }}>
                        <div><strong style={{ color: '#475569' }}>Servicio:</strong> {app.serviceName || 'No especificado'}</div>
                        <div><strong style={{ color: '#475569' }}>Atiende:</strong> <span style={{ color: '#8b5cf6', fontWeight: 600 }}>{app.staffName || 'No asignado'}</span></div>
                        {app.notes && (
                          <div style={{ fontStyle: 'italic', color: '#64748b', marginTop: '0.2rem' }}>"{app.notes}"</div>
                        )}
                      </div>

                      {/* Quick Status Selector (Triggers POS if set to COMPLETED) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Estado:</label>
                        <select
                          className="input-control"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.4rem', height: 'auto' }}
                          value={app.status}
                          disabled={isCompleted}
                          onChange={(e) => handleStatusChange(app, e.target.value as Appointment['status'])}
                        >
                          <option value="SCHEDULED">Programada</option>
                          <option value="IN_PROGRESS">En Proceso</option>
                          <option value="COMPLETED">Completada (Cobrar en Ventas)</option>
                          <option value="CANCELLED">Cancelada</option>
                        </select>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem', alignItems: 'center' }}>
                        {!isCompleted ? (
                          <button
                            className="btn btn-primary"
                            onClick={() => sendAppointmentToPos(app)}
                            style={{ flex: 1, fontSize: '0.8rem', padding: '0.45rem' }}
                            title="Enviar a caja para cobrar e incluir en reportes financieros"
                          >
                            <ShoppingCart size={14} /> Cobrar en Ventas
                          </button>
                        ) : (
                          <div style={{ flex: 1, background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.4rem 0.6rem', borderRadius: '6px', color: '#16a34a', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'center' }}>
                            <CheckCircle size={14} /> Cobrado en Ventas
                          </div>
                        )}

                        {!isCompleted ? (
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleOpenEditAppointment(app)}
                            style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem' }}
                            title="Editar Cita"
                          >
                            <Pencil size={14} />
                          </button>
                        ) : (
                          <button
                            className="btn btn-secondary"
                            disabled
                            style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem', opacity: 0.5, cursor: 'not-allowed' }}
                            title="Las citas completadas y cobradas no se pueden editar"
                          >
                            <Lock size={14} />
                          </button>
                        )}

                        <button
                          className="btn btn-secondary"
                          onClick={() => handleDeleteAppointment(app)}
                          style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem', color: '#ef4444', borderColor: '#fca5a5' }}
                          title="Eliminar Registro de Cita"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

        </div>
      )}

      {/* SUBTAB 2: Services Catalog */}
      {activeSubTab === 'services' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#0f172a' }}>Catálogo de Servicios ({tenantServices.length})</h3>
            <button className="btn btn-primary" onClick={() => setIsServiceModalOpen(true)} style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem' }}>
              <Plus size={15} /> Nuevo Servicio
            </button>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Servicio</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Duración</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Precio al Cliente</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Comisión Empleado</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tenantServices.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                      No hay servicios registrados. Haz clic en "Nuevo Servicio" para agregar uno.
                    </td>
                  </tr>
                ) : (
                  tenantServices.map((s) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>{s.name}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{s.durationMinutes || 30} min</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                        {formatCurrency(s.price, tenant.currencySymbol)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span className="badge badge-wholesale">
                          {s.commissionType === 'PERCENTAGE' ? `${s.commissionValue}% de Venta` : `${tenant.currencySymbol} ${s.commissionValue} Fijo`}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleOpenEditService(s)}
                            style={{ padding: '0.35rem 0.55rem', fontSize: '0.75rem' }}
                            title="Editar Servicio"
                          >
                            <Pencil size={13} /> Editar
                          </button>
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleDeleteService(s)}
                            style={{ padding: '0.35rem 0.55rem', fontSize: '0.75rem', color: '#ef4444', borderColor: '#fca5a5' }}
                            title="Eliminar Servicio"
                          >
                            <Trash2 size={13} /> Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 3: Staff Commissions */}
      {activeSubTab === 'commissions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Summary KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="glass-panel" style={{ padding: '1rem', background: '#ffffff', border: '1px solid #cbd5e1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Total Comisiones Generadas</span>
                <DollarSign size={18} style={{ color: 'var(--accent-primary)' }} />
              </div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
                {formatCurrency(totalAllCommissions, tenant.currencySymbol)}
              </h3>
              <p style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>Acumulado por servicios cobrados</p>
            </div>

            <div className="glass-panel" style={{ padding: '1rem', background: '#ffffff', border: '1px solid #cbd5e1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Pendiente por Pagar</span>
                <Clock size={18} style={{ color: '#d97706' }} />
              </div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#92400e', marginTop: '0.2rem' }}>
                {formatCurrency(totalPendingCommissions, tenant.currencySymbol)}
              </h3>
              <p style={{ fontSize: '0.72rem', color: '#92400e', marginTop: '0.2rem', fontWeight: 600 }}>Por liquidar a colaboradores</p>
            </div>

            <div className="glass-panel" style={{ padding: '1rem', background: '#ffffff', border: '1px solid #cbd5e1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Total Liquidado / Pagado</span>
                <CheckCircle size={18} style={{ color: '#16a34a' }} />
              </div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#166534', marginTop: '0.2rem' }}>
                {formatCurrency(totalPaidCommissions, tenant.currencySymbol)}
              </h3>
              <p style={{ fontSize: '0.72rem', color: '#166534', marginTop: '0.2rem', fontWeight: 600 }}>Entregado a colaboradores</p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', color: '#0f172a', fontWeight: 700, margin: 0 }}>
                Liquidación de Comisiones por Empleado
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.1rem 0 0 0' }}>
                Totales agrupados por colaborador. Haz clic en una fila para desplegar el desglose de servicios.
              </p>
            </div>
          </div>

          {/* Grouped Table */}
          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <table className="table" style={{ width: '100%', fontSize: '0.88rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1', color: '#475569', textAlign: 'left' }}>
                  <th style={{ width: '40px', padding: '0.75rem 0.5rem', textAlign: 'center' }}></th>
                  <th style={{ padding: '0.75rem 1rem' }}>Profesional / Colaborador</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Servicios Atendidos</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Total Vendido</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Comisión Acumulada</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Estado de Pago</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {groupedStaffCommissions.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
                      No hay comisiones generadas aún. Cobra un servicio en Ventas para ver la liquidación por colaborador.
                    </td>
                  </tr>
                ) : (
                  groupedStaffCommissions.map((group) => {
                    const isExpanded = expandedStaffIds.includes(group.staffId);
                    const hasPending = group.pendingCommissionAmount > 0;
                    const isAllPaid = group.pendingCommissionAmount === 0 && group.paidCommissionAmount > 0;

                    return (
                      <React.Fragment key={group.staffId}>
                        {/* Main Group Row */}
                        <tr
                          onClick={() => toggleExpandStaff(group.staffId)}
                          style={{
                            borderBottom: isExpanded ? 'none' : '1px solid #f1f5f9',
                            cursor: 'pointer',
                            background: isExpanded ? '#f8fafc' : '#ffffff',
                            transition: 'background 0.2s ease'
                          }}
                        >
                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: '#64748b' }}>
                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                            {group.staffName}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span className="badge" style={{ background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>
                              {group.salesCount} atención(es)
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#334155', fontWeight: 600 }}>
                            {formatCurrency(group.totalSalesAmount, tenant.currencySymbol)}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#166534', fontSize: '0.95rem' }}>
                            {formatCurrency(group.totalCommissionAmount, tenant.currencySymbol)}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {isAllPaid ? (
                              <span className="badge badge-success" style={{ background: '#dcfce7', color: '#166534', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <CheckCircle size={13} /> Pagadas
                              </span>
                            ) : hasPending ? (
                              <span className="badge badge-warning" style={{ background: '#fef3c7', color: '#92400e', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Clock size={13} /> {formatCurrency(group.pendingCommissionAmount, tenant.currencySymbol)} Pendiente
                              </span>
                            ) : (
                              <span className="badge" style={{ background: '#f1f5f9', color: '#64748b' }}>Sin saldo</span>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                              {hasPending && (
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  onClick={() => {
                                    payStaffCommissions(group.staffId);
                                    toast.success(`Comisiones liquidadas con éxito para ${group.staffName}`);
                                  }}
                                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', fontWeight: 700 }}
                                >
                                  Liquidar {formatCurrency(group.pendingCommissionAmount, tenant.currencySymbol)}
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => toggleExpandStaff(group.staffId)}
                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                              >
                                {isExpanded ? 'Ocultar' : 'Ver Desglose'}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Inner Table Row */}
                        {isExpanded && (
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                            <td colSpan={7} style={{ padding: '0.75rem 1.25rem 1.25rem 2.5rem' }}>
                              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.85rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                                  <h5 style={{ margin: 0, fontSize: '0.85rem', color: '#0f172a', fontWeight: 700 }}>
                                    Desglose de Servicios Atendidos — {group.staffName}
                                  </h5>
                                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                    {group.items.length} registro(s) individual(es)
                                  </span>
                                </div>

                                <table className="table" style={{ width: '100%', fontSize: '0.82rem' }}>
                                  <thead>
                                    <tr style={{ background: '#f1f5f9', color: '#475569', textAlign: 'left' }}>
                                      <th style={{ padding: '0.5rem 0.75rem' }}>Fecha / Hora</th>
                                      <th style={{ padding: '0.5rem 0.75rem' }}>Servicio Realizado</th>
                                      <th style={{ padding: '0.5rem 0.75rem' }}>Monto Venta</th>
                                      <th style={{ padding: '0.5rem 0.75rem' }}>Comisión Ganada</th>
                                      <th style={{ padding: '0.5rem 0.75rem' }}>Estado</th>
                                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Acción</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {group.items.map((item) => (
                                      <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '0.5rem 0.75rem', color: '#64748b' }}>
                                          {new Date(item.createdAt).toLocaleString('es-HN', { dateStyle: 'short', timeStyle: 'short' })}
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: '#0f172a' }}>
                                          {item.serviceName}
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem', color: '#334155' }}>
                                          {formatCurrency(item.saleAmount, tenant.currencySymbol)}
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: '#166534' }}>
                                          {formatCurrency(item.commissionAmount, tenant.currencySymbol)}
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem' }}>
                                          <span className={`badge ${item.status === 'PAID' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', background: item.status === 'PAID' ? '#dcfce7' : '#fef3c7', color: item.status === 'PAID' ? '#166534' : '#92400e', fontWeight: 700 }}>
                                            {item.status === 'PAID' ? 'Pagada' : 'Pendiente'}
                                          </span>
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                                          {item.status !== 'PAID' && (
                                            <button
                                              type="button"
                                              className="btn btn-secondary"
                                              onClick={() => {
                                                payCommissionItem(item.id);
                                                toast.success(`Comisión de ${formatCurrency(item.commissionAmount, tenant.currencySymbol)} marcada como pagada`);
                                              }}
                                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                                            >
                                              Pagar Individual
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: New Appointment */}
      {isAppModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <h3 style={{ color: '#0f172a', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={18} style={{ color: 'var(--accent-primary)' }} /> Agendar Nueva Cita
            </h3>
            <form onSubmit={handleCreateAppointment} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group">
                <label className="form-label">Nombre del Cliente *</label>
                <input type="text" className="input-control" value={custName} onChange={(e) => setCustName(e.target.value)} required autoFocus placeholder="Ej. Maria Lopez" />
              </div>
              <div className="form-group">
                <label className="form-label">Teléfono Cliente</label>
                <input type="text" className="input-control" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} placeholder="Ej. +504 9900-0000" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Fecha de la Cita *</label>
                  <input type="date" className="input-control" value={appDate} onChange={(e) => setAppDate(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Hora *</label>
                  <input type="time" className="input-control" value={appTime} onChange={(e) => setAppTime(e.target.value)} required />
                </div>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>Servicios y Personal *</label>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setAppServiceItems([...appServiceItems, { serviceId: tenantServices[0]?.id || '', staffId: availableStaff[0]?.id || '' }])}
                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                  >
                    <Plus size={12} /> Agregar Servicio
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {appServiceItems.map((item, idx) => (
                    <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                        <div>
                          <label style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Servicio #{idx + 1}</label>
                          <select
                            className="input-control"
                            style={{ fontSize: '0.78rem', padding: '0.3rem' }}
                            value={item.serviceId}
                            onChange={(e) => {
                              const updated = [...appServiceItems];
                              updated[idx].serviceId = e.target.value;
                              setAppServiceItems(updated);
                            }}
                            required
                          >
                            {tenantServices.map(s => (
                              <option key={s.id} value={s.id}>{s.name} ({s.durationMinutes} min - {formatCurrency(s.price, tenant.currencySymbol)})</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Atendido por</label>
                          <select
                            className="input-control"
                            style={{ fontSize: '0.78rem', padding: '0.3rem' }}
                            value={item.staffId}
                            onChange={(e) => {
                              const updated = [...appServiceItems];
                              updated[idx].staffId = e.target.value;
                              setAppServiceItems(updated);
                            }}
                            required
                          >
                            {availableStaff.map(st => (
                              <option key={st.id} value={st.id}>{st.fullName}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {appServiceItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setAppServiceItems(appServiceItems.filter((_, i) => i !== idx))}
                          style={{ alignSelf: 'flex-end', background: 'none', border: 'none', color: '#ef4444', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                        >
                          <Trash2 size={12} /> Quitar Renglón
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notas Adicionales</label>
                <input type="text" className="input-control" value={appNotes} onChange={(e) => setAppNotes(e.target.value)} placeholder="Ej. Cliente prefiere tono rubio ceniza" />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsAppModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Cita</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Appointment */}
      {editingAppointment && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <h3 style={{ color: '#0f172a', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Pencil size={18} style={{ color: 'var(--accent-primary)' }} /> Editar Cita
            </h3>
            <form onSubmit={handleSaveEditedAppointment} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group">
                <label className="form-label">Nombre del Cliente *</label>
                <input type="text" className="input-control" value={editCustName} onChange={(e) => setEditCustName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Teléfono Cliente</label>
                <input type="text" className="input-control" value={editCustPhone} onChange={(e) => setEditCustPhone(e.target.value)} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Fecha de la Cita *</label>
                  <input type="date" className="input-control" value={editAppDate} onChange={(e) => setEditAppDate(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Hora *</label>
                  <input type="time" className="input-control" value={editAppTime} onChange={(e) => setEditAppTime(e.target.value)} required />
                </div>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>Servicios y Personal *</label>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setEditServiceItems([...editServiceItems, { serviceId: tenantServices[0]?.id || '', staffId: availableStaff[0]?.id || '' }])}
                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                  >
                    <Plus size={12} /> Agregar Servicio
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {editServiceItems.map((item, idx) => (
                    <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                        <div>
                          <label style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Servicio #{idx + 1}</label>
                          <select
                            className="input-control"
                            style={{ fontSize: '0.78rem', padding: '0.3rem' }}
                            value={item.serviceId}
                            onChange={(e) => {
                              const updated = [...editServiceItems];
                              updated[idx].serviceId = e.target.value;
                              setEditServiceItems(updated);
                            }}
                            required
                          >
                            {tenantServices.map(s => (
                              <option key={s.id} value={s.id}>{s.name} ({s.durationMinutes} min - {formatCurrency(s.price, tenant.currencySymbol)})</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Atendido por</label>
                          <select
                            className="input-control"
                            style={{ fontSize: '0.78rem', padding: '0.3rem' }}
                            value={item.staffId}
                            onChange={(e) => {
                              const updated = [...editServiceItems];
                              updated[idx].staffId = e.target.value;
                              setEditServiceItems(updated);
                            }}
                            required
                          >
                            {availableStaff.map(st => (
                              <option key={st.id} value={st.id}>{st.fullName}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {editServiceItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setEditServiceItems(editServiceItems.filter((_, i) => i !== idx))}
                          style={{ alignSelf: 'flex-end', background: 'none', border: 'none', color: '#ef4444', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                        >
                          <Trash2 size={12} /> Quitar Renglón
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Estado de la Cita</label>
                <select className="input-control" value={editStatus} onChange={(e) => setEditStatus(e.target.value as Appointment['status'])}>
                  <option value="SCHEDULED">Programada</option>
                  <option value="IN_PROGRESS">En Proceso</option>
                  <option value="COMPLETED">Completada (Cobrar en Ventas)</option>
                  <option value="CANCELLED">Cancelada</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Notas Adicionales</label>
                <input type="text" className="input-control" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingAppointment(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: New Service Form */}
      {isServiceModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <h3 style={{ color: '#0f172a', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Scissors size={18} style={{ color: 'var(--accent-primary)' }} /> Agregar Servicio
            </h3>
            <form onSubmit={handleCreateService} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group">
                <label className="form-label">Nombre del Servicio *</label>
                <input type="text" className="input-control" value={serviceName} onChange={(e) => setServiceName(e.target.value)} required autoFocus placeholder="Ej. Corte de Cabello" />
              </div>
              <div className="form-group">
                <label className="form-label">Duración Estimada (minutos)</label>
                <input type="number" className="input-control" value={serviceDuration} onChange={(e) => setServiceDuration(e.target.value)} required placeholder="30" />
              </div>
              <div className="form-group">
                <label className="form-label">Precio al Cliente *</label>
                <input type="number" step="0.01" className="input-control" value={servicePrice} onChange={(e) => setServicePrice(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo de Comisión Empleado</label>
                <select className="input-control" value={commissionType} onChange={(e) => setCommissionType(e.target.value as any)}>
                  <option value="PERCENTAGE">Porcentaje % de Venta</option>
                  <option value="FIXED">Monto Fijo por Servicio</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Valor Comisión ({commissionType === 'PERCENTAGE' ? '%' : tenant.currencySymbol})</label>
                <input type="number" step="0.01" className="input-control" value={commissionValue} onChange={(e) => setCommissionValue(e.target.value)} required />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsServiceModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Servicio</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Service Form */}
      {editingService && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <h3 style={{ color: '#0f172a', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Pencil size={18} style={{ color: 'var(--accent-primary)' }} /> Editar Servicio
            </h3>
            <form onSubmit={handleSaveEditedService} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group">
                <label className="form-label">Nombre del Servicio *</label>
                <input type="text" className="input-control" value={editServiceName} onChange={(e) => setEditServiceName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Duración Estimada (minutos)</label>
                <input type="number" className="input-control" value={editServiceDuration} onChange={(e) => setEditServiceDuration(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Precio al Cliente *</label>
                <input type="number" step="0.01" className="input-control" value={editServicePrice} onChange={(e) => setEditServicePrice(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo de Comisión Empleado</label>
                <select className="input-control" value={editCommissionType} onChange={(e) => setEditCommissionType(e.target.value as any)}>
                  <option value="PERCENTAGE">Porcentaje % de Venta</option>
                  <option value="FIXED">Monto Fijo por Servicio</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Valor Comisión ({editCommissionType === 'PERCENTAGE' ? '%' : tenant.currencySymbol})</label>
                <input type="number" step="0.01" className="input-control" value={editCommissionValue} onChange={(e) => setEditCommissionValue(e.target.value)} required />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingService(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ServicesAppointments;
