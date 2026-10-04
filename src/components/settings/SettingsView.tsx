import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { toast } from 'sonner';
import { Settings, ShieldCheck, UserCheck, Lock, ToggleLeft, ToggleRight, Plus, Database, CheckCircle, AlertTriangle, Key, Users, Star, Search, Edit2, Trash2, X, Phone, Mail, Upload, Image as ImageIcon } from 'lucide-react';
import { UserRole, BusinessType, UserProfile, Customer, FiscalRange } from '../../types';
import { isSupabaseConfigured, testSupabaseConnection, supabase } from '../../lib/supabase';
import { seedInitialDataToSupabase, updateProfilePinInSupabase } from '../../lib/supabaseService';
import { hashPinCode } from '../../lib/security';
import { formatCurrency } from '../../lib/monetary';
import { compressImageToWebP } from '../../lib/imageUtils';

export const SettingsView: React.FC = () => {
  const tenant = useAppStore(state => state.tenant);
  const fiscalRange = useAppStore(state => state.fiscalRange);
  const fiscalRanges = useAppStore(state => state.fiscalRanges) || [];
  const selectedFiscalRangeId = useAppStore(state => state.selectedFiscalRangeId);
  const profiles = useAppStore(state => state.profiles);
  const customers = useAppStore(state => state.customers);
  const tenantProfiles = profiles.filter(p => p.tenantId === tenant.id);
  const tenantCustomers = customers.filter(c => c.tenantId === tenant.id);
  const tenantFiscalRanges = fiscalRanges.filter(f => f.tenantId === tenant.id);

  const updateTenantSettings = useAppStore(state => state.updateTenantSettings);
  const addFiscalRange = useAppStore(state => state.addFiscalRange);
  const updateFiscalRange = useAppStore(state => state.updateFiscalRange);
  const deleteFiscalRange = useAppStore(state => state.deleteFiscalRange);
  const setSelectedFiscalRange = useAppStore(state => state.setSelectedFiscalRange);
  const addProfile = useAppStore(state => state.addProfile);
  const addCustomer = useAppStore(state => state.addCustomer);
  const updateCustomer = useAppStore(state => state.updateCustomer);
  const deleteCustomer = useAppStore(state => state.deleteCustomer);

  const [tenantName, setTenantName] = useState(tenant.name);
  const [rtn, setRtn] = useState(tenant.rtn || '');
  const [phone, setPhone] = useState(tenant.phone || '');
  const [address, setAddress] = useState(tenant.address || '');
  const [businessType, setBusinessType] = useState<BusinessType>(tenant.businessType || 'RETAIL');

  // Loyalty Settings State
  const [loyaltyEarnRate, setLoyaltyEarnRate] = useState(String(tenant.loyaltyEarnRate || 100));
  const [loyaltyPointValue, setLoyaltyPointValue] = useState(String(tenant.loyaltyPointValue || 1.0));

  // Customer Directory Search & Modal State
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [custName, setCustName] = useState('');
  const [custRtn, setCustRtn] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custPoints, setCustPoints] = useState('0');

  const handleOpenCustomerModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setCustName(customer.name);
      setCustRtn(customer.rtn || '');
      setCustPhone(customer.phone || '');
      setCustEmail(customer.email || '');
      setCustAddress(customer.address || '');
      setCustPoints(String(customer.loyaltyPoints || 0));
    } else {
      setEditingCustomer(null);
      setCustName('');
      setCustRtn('');
      setCustPhone('');
      setCustEmail('');
      setCustAddress('');
      setCustPoints('0');
    }
    setIsCustomerModalOpen(true);
  };

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim()) {
      toast.error('Ingresa el nombre del cliente');
      return;
    }

    if (editingCustomer) {
      updateCustomer(editingCustomer.id, {
        name: custName.trim(),
        rtn: custRtn.trim() || undefined,
        phone: custPhone.trim() || undefined,
        email: custEmail.trim() || undefined,
        address: custAddress.trim() || undefined,
        loyaltyPoints: parseInt(custPoints) || 0
      });
      toast.success(`Cliente ${custName} actualizado`);
    } else {
      addCustomer({
        name: custName.trim(),
        rtn: custRtn.trim() || undefined,
        phone: custPhone.trim() || undefined,
        email: custEmail.trim() || undefined,
        address: custAddress.trim() || undefined
      });
      toast.success(`Cliente ${custName} registrado`);
    }

    setIsCustomerModalOpen(false);
  };

  const filteredTenantCustomers = tenantCustomers.filter((c: Customer) => {
    const q = customerSearch.toLowerCase().trim();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) ||
      (c.rtn && c.rtn.includes(q)) ||
      (c.phone && c.phone.includes(q));
  });

  // Supabase Live Credentials State
  const [supaUrl, setSupaUrl] = useState(localStorage.getItem('micuadre_supabase_url') || import.meta.env.VITE_SUPABASE_URL || '');
  const [supaKey, setSupaKey] = useState(localStorage.getItem('micuadre_supabase_anon_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || '');

  // Fiscal Range Form & Modal State
  const [isFiscalModalOpen, setIsFiscalModalOpen] = useState(false);
  const [editingFiscalRange, setEditingFiscalRange] = useState<FiscalRange | null>(null);
  const [fiscalName, setFiscalName] = useState('');
  const [fiscalCai, setFiscalCai] = useState('');
  const [fiscalPrefix, setFiscalPrefix] = useState('');
  const [fiscalRangeStart, setFiscalRangeStart] = useState('1');
  const [fiscalRangeEnd, setFiscalRangeEnd] = useState('5000');
  const [fiscalCurrentNumber, setFiscalCurrentNumber] = useState('0');
  const [fiscalDeadline, setFiscalDeadline] = useState('2026-12-31');
  const [fiscalIsDefault, setFiscalIsDefault] = useState(false);

  const handleOpenFiscalModal = (range?: FiscalRange) => {
    if (range) {
      setEditingFiscalRange(range);
      setFiscalName(range.name || 'Caja Registradora');
      setFiscalCai(range.cai);
      setFiscalPrefix(range.prefix);
      setFiscalRangeStart(String(range.rangeStart));
      setFiscalRangeEnd(String(range.rangeEnd));
      setFiscalCurrentNumber(String(range.currentNumber));
      setFiscalDeadline(range.deadline);
      setFiscalIsDefault(!!range.isDefault);
    } else {
      setEditingFiscalRange(null);
      const existingNums = tenantFiscalRanges.map(r => {
        const match = r.prefix?.match(/000-(\d+)-/);
        return match ? parseInt(match[1]) : 0;
      });
      const maxNum = Math.max(0, ...existingNums);
      const nextNum = maxNum + 1;
      const formattedNum = String(nextNum).padStart(3, '0');
      setFiscalName(`Caja ${nextNum}`);
      setFiscalCai('E83910-149BF1-9243E9-913210-9182C1-02');
      setFiscalPrefix(`000-${formattedNum}-01-`);
      setFiscalRangeStart('1');
      setFiscalRangeEnd('5000');
      setFiscalCurrentNumber('0');
      setFiscalDeadline('2026-12-31');
      setFiscalIsDefault(tenantFiscalRanges.length === 0);
    }
    setIsFiscalModalOpen(true);
  };

  const handleSaveFiscalRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fiscalName.trim() || !fiscalCai.trim() || !fiscalPrefix.trim()) {
      toast.error('Completa el nombre, CAI y prefijo del rango fiscal');
      return;
    }

    let cleanPrefix = fiscalPrefix.trim();
    if (cleanPrefix.length > 16) {
      const parts = cleanPrefix.split('-');
      if (parts.length >= 3) {
        cleanPrefix = `${parts.slice(0, 3).join('-')}-`;
      }
      cleanPrefix = cleanPrefix.slice(0, 16);
    }

    const payload = {
      name: fiscalName.trim(),
      cai: fiscalCai.trim(),
      prefix: cleanPrefix,
      rangeStart: parseInt(fiscalRangeStart) || 1,
      rangeEnd: parseInt(fiscalRangeEnd) || 5000,
      currentNumber: parseInt(fiscalCurrentNumber) || 0,
      deadline: fiscalDeadline,
      documentType: '01' as const,
      isActive: (parseInt(fiscalCurrentNumber) || 0) < (parseInt(fiscalRangeEnd) || 5000),
      isDefault: fiscalIsDefault
    };

    if (editingFiscalRange) {
      updateFiscalRange(editingFiscalRange.id, payload);
      toast.success(`Caja "${fiscalName}" actualizada`);
    } else {
      addFiscalRange(payload);
      toast.success(`Nueva Caja "${fiscalName}" registrada`);
    }

    setIsFiscalModalOpen(false);
  };

  // New Profile Form
  const [isNewProfileModalOpen, setIsNewProfileModalOpen] = useState(false);
  const [editingPinProfile, setEditingPinProfile] = useState<UserProfile | null>(null);
  const [newPinInput, setNewPinInput] = useState('1234');

  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('CAJERO');
  const [newPinCode, setNewPinCode] = useState('0000');

  const handleSaveNewPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPinProfile) return;

    if (newPinInput.length !== 4) {
      toast.error('El PIN debe tener exactamente 4 dígitos');
      return;
    }

    const hashedPin = await hashPinCode(newPinInput);
    const res = await updateProfilePinInSupabase(editingPinProfile, hashedPin);

    if (res.success) {
      useAppStore.setState(state => ({
        profiles: state.profiles.map(p => p.id === editingPinProfile.id || p.id === res.profile.id ? res.profile : p),
        currentUser: state.currentUser.id === editingPinProfile.id ? res.profile : state.currentUser
      }));
      toast.success(`PIN de ${res.profile.fullName} actualizado de forma segura`);
    } else {
      toast.error(`Error al actualizar PIN: ${res.error}`);
    }

    setEditingPinProfile(null);
  };

  // Connection Test State
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const handleRunTest = async () => {
    setIsTesting(true);
    const result = await testSupabaseConnection();
    setTestResult(result);
    setIsTesting(false);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  };

  const isConnected = isSupabaseConfigured();

  const handleSaveSupabaseCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supaUrl.includes('supabase.co') || supaKey.length < 20) {
      toast.error('Ingresa una URL válida de Supabase y tu llave pública (anon key)');
      return;
    }

    localStorage.setItem('micuadre_supabase_url', supaUrl.trim());
    localStorage.setItem('micuadre_supabase_anon_key', supaKey.trim());
    toast.success('Credenciales guardadas. Recargando conexión a Supabase...');
    setTimeout(() => window.location.reload(), 1000);
  };

  const [logoUrl, setLogoUrl] = useState(tenant.logoUrl || '');
  const [isCompressingLogo, setIsCompressingLogo] = useState(false);

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressingLogo(true);
      const compressedWebPUrl = await compressImageToWebP(file, 256, 0.8);
      setLogoUrl(compressedWebPUrl);
      updateTenantSettings({ logoUrl: compressedWebPUrl });
      toast.success('¡Logo del comercio procesado y guardado exitosamente (< 25 KB WebP)!');
    } catch (err: any) {
      toast.error(err.message || 'Error al procesar la imagen del logo');
    } finally {
      setIsCompressingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl('');
    updateTenantSettings({ logoUrl: undefined });
    toast.info('Logo del comercio eliminado.');
  };

  const handleSaveTenant = (e: React.FormEvent) => {
    e.preventDefault();
    updateTenantSettings({
      name: tenantName,
      rtn,
      phone,
      address,
      businessType,
      logoUrl: logoUrl || undefined
    });
    toast.success('Datos del comercio e identidad de marca actualizados');
  };



  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName || newPinCode.length !== 4) {
      toast.error('Ingresa el nombre y un PIN válido de 4 dígitos');
      return;
    }

    const generateUUID = () => (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });

    const newProfile: UserProfile = {
      id: generateUUID(),
      tenantId: tenant.id,
      fullName: newFullName,
      role: newRole,
      pinCode: newPinCode,
      isActive: true
    };

    useAppStore.setState(state => ({ profiles: [...state.profiles, newProfile] }));

    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('profiles').insert({
        id: newProfile.id,
        tenant_id: tenant.id,
        full_name: newFullName,
        role: newRole,
        pin_code: newPinCode,
        is_active: true
      });

      if (error) {
        if (error.message.includes('profiles_id_fkey') || error.code === '23503') {
          toast.warning(`Colaborador guardado localmente. Para sincronizar con la nube, ejecuta en Supabase SQL Editor: ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;`);
        } else {
          toast.error(`Error al registrar en Supabase: ${error.message}`);
        }
      } else {
        toast.success(`Colaborador ${newFullName} guardado en Supabase`);
      }
    } else {
      toast.success(`Colaborador ${newFullName} registrado localmente`);
    }

    setIsNewProfileModalOpen(false);
    setNewFullName('');
  };

  const isDevMode = useAppStore(state => state.isDevMode);

  return (
    <div className="view-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Header Banner */}
      <div className="glass-panel header-banner">
        <div>
          <h2 style={{ fontSize: '1.2rem', color: '#0f172a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Settings size={22} style={{ color: 'var(--accent-primary)' }} />
            Configuración del Comercio
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Módulos activables, datos de la tienda, rangos fiscales SAR y PINs de acceso
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Database size={16} style={{ color: isConnected ? '#10b981' : '#f59e0b' }} />
          <span className={`badge ${isConnected ? 'badge-success' : 'badge-wholesale'}`}>
            {isConnected ? 'Sistema en Línea (Nube)' : 'Modo Demostración Local'}
          </span>
        </div>
      </div>

      {/* SUPABASE CONNECTION SETTINGS FORM (Only visible in Dev Mode) */}
      {isDevMode && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <h3 style={{ fontSize: '1.05rem', marginBottom: '0.4rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Database size={18} style={{ color: 'var(--accent-primary)' }} />
            Conexión a Base de Datos Supabase (Modo Desarrollador)
          </h3>

          <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.85rem' }}>
            Ingresa credenciales y ejecuta <code>supabase/schema.sql</code> en el SQL Editor de tu proyecto.
          </p>

          <form onSubmit={handleSaveSupabaseCredentials} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div className="form-group">
              <label className="form-label">Project URL (SUPABASE_URL) *</label>
              <input
                type="text"
                className="input-control"
                placeholder="https://xyzcompany.supabase.co"
                value={supaUrl}
                onChange={(e) => setSupaUrl(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">API Key (anon / public) *</label>
              <input
                type="password"
                className="input-control"
                placeholder="eyJhbGciOiJIUzI1Ni..."
                value={supaKey}
                onChange={(e) => setSupaKey(e.target.value)}
                required
              />
            </div>

            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleRunTest}
                disabled={isTesting}
                style={{ fontSize: '0.8rem', padding: '0.45rem 0.75rem' }}
              >
                <Database size={14} />
                <span>{isTesting ? 'Probando...' : 'Probar Conexión'}</span>
              </button>

              <button type="submit" className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.45rem 0.75rem' }}>
                <CheckCircle size={14} />
                <span>Guardar & Conectar</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SECTION 1: Module Activation Switches (SAR & Negative Stock) */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
        <h3 style={{ fontSize: '1.05rem', marginBottom: '0.85rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldCheck size={18} style={{ color: 'var(--accent-primary)' }} />
          Módulos Activables del Comercio
        </h3>

        <div className="grid-2-responsive" style={{ gap: '1rem' }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 600, margin: 0 }}>Facturación Fiscal SAR (Honduras)</h4>
              <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem' }}>
                Asigna correlativos de 16 caracteres, valida CAI y desglosa ISV 15%/18%.
              </p>
            </div>

            <button
              className={`btn ${tenant.isFiscalEnabled ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                updateTenantSettings({ isFiscalEnabled: !tenant.isFiscalEnabled });
                toast.info(`Facturación SAR ${!tenant.isFiscalEnabled ? 'ACTIVADA' : 'DESACTIVADA'}`);
              }}
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
            >
              {tenant.isFiscalEnabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
              <span>{tenant.isFiscalEnabled ? 'ACTIVADO' : 'DESACTIVADO'}</span>
            </button>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 600, margin: 0 }}>Permitir Venta con Stock Negativo</h4>
              <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem' }}>
                Permite vender productos sin inventario disponible registrando alerta.
              </p>
            </div>

            <button
              className={`btn ${tenant.allowNegativeStock ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                updateTenantSettings({ allowNegativeStock: !tenant.allowNegativeStock });
                toast.info(`Venta con stock 0 ${!tenant.allowNegativeStock ? 'PERMITIDA' : 'BLOQUEADA'}`);
              }}
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
            >
              {tenant.allowNegativeStock ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
              <span>{tenant.allowNegativeStock ? 'PERMITIDA' : 'BLOQUEADA'}</span>
            </button>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gridColumn: 'span 2' }}>
            <div>
              <h4 style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 600, margin: 0 }}>Precios del Catálogo Incluyen ISV (Honduras)</h4>
              <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem' }}>
                Los precios de tus productos/servicios son el monto final al cliente. El sistema desglosa automáticamente la base y el ISV (15%/18%) para la factura SAR.
              </p>
            </div>

            <button
              className={`btn ${(tenant.pricesIncludeTax ?? true) ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                const newValue = !(tenant.pricesIncludeTax ?? true);
                updateTenantSettings({ pricesIncludeTax: newValue });
                toast.info(`Precios de catálogo ahora ${newValue ? 'INCLUYEN ISV (Precio Final)' : 'SON ANTES DE ISV (Impuesto Adicional)'}`);
              }}
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem', minWidth: '150px' }}
            >
              {(tenant.pricesIncludeTax ?? true) ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
              <span>{(tenant.pricesIncludeTax ?? true) ? 'ISV INCLUIDO' : 'ISV ADICIONAL'}</span>
            </button>
          </div>

          {/* Loyalty Program Module Switch */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', gridColumn: 'span 2' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Star size={16} style={{ color: '#d97706', fill: '#d97706' }} />
                  Programa de Fidelización de Clientes (Puntos)
                </h4>
                <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem' }}>
                  Los clientes acumulan puntos por cada compra realizada en caja y pueden canjearlos por descuentos.
                </p>
              </div>

              <button
                className={`btn ${tenant.isLoyaltyEnabled ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  updateTenantSettings({ isLoyaltyEnabled: !tenant.isLoyaltyEnabled });
                  toast.info(`Programa de Puntos ${!tenant.isLoyaltyEnabled ? 'ACTIVADO' : 'DESACTIVADO'}`);
                }}
                style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
              >
                {tenant.isLoyaltyEnabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                <span>{tenant.isLoyaltyEnabled ? 'ACTIVADO' : 'DESACTIVADO'}</span>
              </button>
            </div>

            {tenant.isLoyaltyEnabled && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Monto de compra para ganar 1 punto ({tenant.currencySymbol})</label>
                  <input
                    type="number"
                    className="input-control"
                    value={loyaltyEarnRate}
                    onChange={(e) => setLoyaltyEarnRate(e.target.value)}
                    placeholder="100"
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Valor de canje de 1 punto ({tenant.currencySymbol})</label>
                  <input
                    type="number"
                    step="0.1"
                    className="input-control"
                    value={loyaltyPointValue}
                    onChange={(e) => setLoyaltyPointValue(e.target.value)}
                    placeholder="1.0"
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    updateTenantSettings({
                      loyaltyEarnRate: parseFloat(loyaltyEarnRate) || 100,
                      loyaltyPointValue: parseFloat(loyaltyPointValue) || 1.0
                    });
                    toast.success('Parámetros de fidelización guardados');
                  }}
                  style={{ fontSize: '0.78rem', padding: '0.5rem' }}
                >
                  Guardar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 2: Tenant General Settings */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', color: '#0f172a', margin: 0 }}>Datos Generales del Comercio</h3>
            <p style={{ fontSize: '0.78rem', color: '#64748b' }}>Información impresas en facturas y enlace de acceso directo</p>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              const slug = tenant.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
              const link = `${window.location.origin}/?tienda=${slug}`;
              navigator.clipboard.writeText(link);
              toast.success(`Enlace copiado: ${link}`);
            }}
            style={{ fontSize: '0.78rem', padding: '0.4rem 0.75rem' }}
          >
            <span>Copiar Enlace para Cajeros</span>
          </button>
        </div>

        <form onSubmit={handleSaveTenant} className="grid-2-responsive" style={{ gap: '0.85rem' }}>
          <div className="form-group">
            <label className="form-label">Nombre del Comercio *</label>
            <input type="text" className="input-control" value={tenantName} onChange={(e) => setTenantName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">RTN de la Empresa</label>
            <input type="text" className="input-control" value={rtn} onChange={(e) => setRtn(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Teléfono de Contacto</label>
            <input type="text" className="input-control" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Dirección Física (Sale en Ticket)</label>
            <input type="text" className="input-control" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Giro de Negocio / Tipo de Comercio</label>
            <select
              className="input-control"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value as BusinessType)}
            >
              <option value="RETAIL">Retail / Supermercado / Abarrotes / Ferretería</option>
              <option value="SERVICES">Servicios / Barbería / Salón de Belleza / Taller</option>
              <option value="MIXED">Mixto (Productos + Servicios de Barbería/Citas)</option>
            </select>
          </div>

          {/* Logo Upload & Brand Identity Section */}
          <div className="form-group" style={{ gridColumn: 'span 2', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' }}>
            <label className="form-label" style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ImageIcon size={18} style={{ color: 'var(--accent-primary)' }} />
              Logotipo e Identidad de Marca del Comercio
            </label>
            <p style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.85rem' }}>
              El logo de tu comercio se comprime automáticamente en tu navegador a formato WebP ultraligero (&lt; 25 KB). Se mostrará en la barra superior de tu sistema y en los comprobantes de venta impresos.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
              {/* Logo Preview Box */}
              <div style={{ width: '64px', height: '64px', borderRadius: '10px', border: '2px dashed #cbd5e1', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo Previsto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{(tenantName || 'M').charAt(0).toUpperCase()}</span>
                )}
              </div>

              {/* Upload Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <label className="btn btn-secondary" style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Upload size={14} />
                    <span>{isCompressingLogo ? 'Comprimiendo WebP...' : 'Subir Logotipo del Comercio'}</span>
                    <input type="file" accept="image/*" onChange={handleLogoFileChange} style={{ display: 'none' }} disabled={isCompressingLogo} />
                  </label>

                  {logoUrl && (
                    <button type="button" className="btn btn-secondary" onClick={handleRemoveLogo} style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem', color: '#ef4444' }}>
                      <Trash2 size={14} />
                      <span>Quitar Logo</span>
                    </button>
                  )}
                </div>

                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Acepta cualquier formato (PNG, JPG, WebP). Redimensión automática ultra-rápida.</span>
              </div>
            </div>
          </div>

          <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '0.55rem 1rem' }}>Guardar Datos de Tienda</button>
          </div>
        </form>
      </div>

      {/* SECTION 3: SAR Fiscal Range Settings & Multi-POS Registers */}
      {tenant.isFiscalEnabled && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ color: '#0f172a', fontSize: '1.05rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={19} style={{ color: 'var(--accent-primary)' }} />
                Cajas Registradoras & Rangos Fiscales SAR (Honduras)
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                Gestión de CAIs autorizados, prefijos de emisión y secuencias numéricas por cada caja o terminal de facturación.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleOpenFiscalModal()}
              style={{ fontSize: '0.85rem', padding: '0.5rem 0.85rem' }}
            >
              <Plus size={15} /> Agregar Caja / CAI
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
            {tenantFiscalRanges.map(fr => {
              const usagePercent = Math.min(100, Math.max(0, Math.round((fr.currentNumber / fr.rangeEnd) * 100)));
              const isSelected = fr.id === selectedFiscalRangeId;

              return (
                <div
                  key={fr.id}
                  style={{
                    background: isSelected ? '#f0fdf4' : '#f8fafc',
                    border: `1.5px solid ${isSelected ? '#10b981' : '#e2e8f0'}`,
                    borderRadius: '10px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <h4 style={{ fontSize: '1rem', color: '#0f172a', fontWeight: 700, margin: 0 }}>{fr.name || 'Caja Registradora'}</h4>
                        {fr.isDefault && (
                          <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', background: '#dcfce7', color: '#15803d', borderRadius: '12px', fontWeight: 700 }}>
                            Principal
                          </span>
                        )}
                        {isSelected && !fr.isDefault && (
                          <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', background: '#e0e7ff', color: '#4338ca', borderRadius: '12px', fontWeight: 600 }}>
                            Seleccionada
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: '#475569', margin: '0.25rem 0 0 0', fontWeight: 600 }}>
                        Prefijo: {fr.prefix}
                      </p>
                    </div>
                    <span className={`badge ${fr.isActive ? 'badge-fiscal' : 'badge-danger'}`} style={{ fontSize: '0.72rem' }}>
                      {fr.isActive ? 'Activo' : 'Agotado'}
                    </span>
                  </div>

                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.65rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                      <span>CAI:</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f172a', fontSize: '0.72rem' }}>{fr.cai}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                      <span>Vencimiento:</span>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{fr.deadline}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                      <span>Correlativo Actual:</span>
                      <span style={{ fontWeight: 700, color: '#0284c7' }}>#{fr.currentNumber} / #{fr.rangeEnd}</span>
                    </div>
                    
                    {/* Progress Bar */}
                    <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '4px', marginTop: '0.2rem', overflow: 'hidden' }}>
                      <div style={{ width: `${usagePercent}%`, height: '100%', background: usagePercent > 90 ? '#ef4444' : '#10b981', transition: 'width 0.3s ease' }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
                    {!fr.isDefault && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => updateFiscalRange(fr.id, { isDefault: true })}
                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem' }}
                        title="Marcar como caja principal predeterminada"
                      >
                        Hacer Principal
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleOpenFiscalModal(fr)}
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem' }}
                    >
                      <Edit2 size={12} /> Editar
                    </button>
                    {tenantFiscalRanges.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          if (confirm(`¿Eliminar la caja "${fr.name}"?`)) {
                            deleteFiscalRange(fr.id);
                            toast.success(`Caja ${fr.name} eliminada`);
                          }
                        }}
                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', color: '#ef4444', borderColor: '#fca5a5' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 4: Team Profiles & PIN Management */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
          <div>
            <h3 style={{ color: '#0f172a', fontSize: '1.05rem', margin: 0 }}>Equipo de Colaboradores & PINs de Ventas</h3>
            <p style={{ fontSize: '0.78rem', color: '#64748b' }}>Acceso rápido para cajeros, bodegueros y personal de atención</p>
          </div>
          <button className="btn btn-primary" onClick={() => setIsNewProfileModalOpen(true)} style={{ fontSize: '0.85rem', padding: '0.5rem 0.85rem' }}>
            <Plus size={15} /> Agregar Colaborador
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.85rem' }}>
          {tenantProfiles.map(p => (
            <div key={p.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge badge-fiscal">{p.role}</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>PIN: ****{p.pinCode?.slice(-2)}</span>
              </div>
              <h4 style={{ fontSize: '0.95rem', color: '#0f172a', fontWeight: 600, margin: '0.2rem 0' }}>{p.fullName}</h4>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setEditingPinProfile(p);
                  setNewPinInput(p.pinCode || '1234');
                }}
                style={{ fontSize: '0.78rem', padding: '0.3rem 0.55rem', alignSelf: 'flex-start' }}
              >
                <Key size={13} />
                <span>Cambiar PIN</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 5: Customer Directory & Loyalty Points Management */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
          <div>
            <h3 style={{ color: '#0f172a', fontSize: '1.05rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={18} style={{ color: 'var(--accent-primary)' }} />
              Directorio de Clientes (RTN & Fidelización)
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Directorio general de clientes del comercio, consulta de RTN y saldos de puntos acumulados
            </p>
          </div>

          <button className="btn btn-primary" onClick={() => handleOpenCustomerModal()} style={{ fontSize: '0.85rem', padding: '0.5rem 0.85rem' }}>
            <Plus size={15} /> Nuevo Cliente
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: '0.85rem', position: 'relative', maxWidth: '380px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            className="input-control"
            placeholder="Buscar por Nombre, RTN o Teléfono..."
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            style={{ paddingLeft: '2.2rem', fontSize: '0.85rem' }}
          />
        </div>

        {/* Customer Directory Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', textTransform: 'uppercase', fontSize: '0.7rem', color: '#475569' }}>
                <th style={{ padding: '0.6rem 0.85rem', textAlign: 'left' }}>Cliente / Empresa</th>
                <th style={{ padding: '0.6rem 0.85rem', textAlign: 'left' }}>RTN / DNI</th>
                <th style={{ padding: '0.6rem 0.85rem', textAlign: 'left' }}>Contacto</th>
                <th style={{ padding: '0.6rem 0.85rem', textAlign: 'right' }}>Puntos Acumulados</th>
                <th style={{ padding: '0.6rem 0.85rem', textAlign: 'right' }}>Total Compras</th>
                <th style={{ padding: '0.6rem 0.85rem', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredTenantCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                    No hay clientes registrados en esta tienda.
                  </td>
                </tr>
              ) : (
                filteredTenantCustomers.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#0f172a' }}>
                      {c.name}
                      {c.address && <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 400 }}>{c.address}</div>}
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      {c.rtn ? (
                        <span className="badge badge-fiscal" style={{ fontSize: '0.72rem' }}>{c.rtn}</span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Sin RTN</span>
                      )}
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem', color: '#475569', fontSize: '0.78rem' }}>
                      {c.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Phone size={12} style={{ color: '#64748b' }} /> {c.phone}</div>}
                      {c.email && <div style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Mail size={12} style={{ color: '#64748b' }} /> {c.email}</div>}
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>
                      <span className="badge badge-success" style={{ fontSize: '0.75rem', background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                        <Star size={12} style={{ fill: '#d97706' }} />
                        {c.loyaltyPoints || 0} pts
                      </span>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, color: 'var(--accent-primary)' }}>
                      {formatCurrency(c.totalSpent || 0, tenant.currencySymbol)}
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleOpenCustomerModal(c)}
                          style={{ padding: '0.3rem 0.45rem', fontSize: '0.75rem' }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => {
                            if (confirm(`¿Eliminar cliente ${c.name}?`)) {
                              deleteCustomer(c.id);
                              toast.success('Cliente eliminado');
                            }
                          }}
                          style={{ padding: '0.3rem 0.45rem', fontSize: '0.75rem' }}
                        >
                          <Trash2 size={13} />
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

      {/* MODAL: Add/Edit Customer */}
      {isCustomerModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '460px' }}>
            <h3 style={{ color: '#0f172a', marginBottom: '0.85rem' }}>
              {editingCustomer ? `Editar Cliente - ${editingCustomer.name}` : 'Registrar Nuevo Cliente'}
            </h3>

            <form onSubmit={handleSaveCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group">
                <label className="form-label">Nombre o Razón Social *</label>
                <input
                  type="text"
                  className="input-control"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="Ej. Comercial Los Andes"
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">RTN / DNI (Opcional)</label>
                  <input
                    type="text"
                    className="input-control"
                    value={custRtn}
                    onChange={(e) => setCustRtn(e.target.value)}
                    placeholder="08011990123456"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Teléfono</label>
                  <input
                    type="text"
                    className="input-control"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    placeholder="+504 9900-1122"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Correo Electrónico</label>
                <input
                  type="email"
                  className="input-control"
                  value={custEmail}
                  onChange={(e) => setCustEmail(e.target.value)}
                  placeholder="contacto@ejemplo.hn"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Dirección Física</label>
                <input
                  type="text"
                  className="input-control"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  placeholder="Barrio El Centro, Tegucigalpa"
                />
              </div>

              {editingCustomer && tenant.isLoyaltyEnabled && (
                <div className="form-group">
                  <label className="form-label">Puntos de Fidelización Acumulados</label>
                  <input
                    type="number"
                    className="input-control"
                    value={custPoints}
                    onChange={(e) => setCustPoints(e.target.value)}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsCustomerModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingCustomer ? 'Guardar Cambios' : 'Registrar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Change PIN */}
      {editingPinProfile && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <h3 style={{ color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Key size={18} style={{ color: 'var(--accent-primary)' }} />
              Cambiar PIN - {editingPinProfile.fullName}
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
              Ingresa el nuevo código PIN de 4 dígitos.
            </p>
            <form onSubmit={handleSaveNewPin} style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group">
                <label className="form-label">Nuevo PIN (4 dígitos) *</label>
                <input
                  type="password"
                  maxLength={4}
                  className="input-control"
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="1234"
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingPinProfile(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar PIN</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: New Team Profile */}
      {isNewProfileModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <h3 style={{ color: '#0f172a', marginBottom: '0.85rem' }}>Agregar Nuevo Colaborador</h3>
            <form onSubmit={handleCreateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group">
                <label className="form-label">Nombre Completo *</label>
                <input type="text" className="input-control" value={newFullName} onChange={(e) => setNewFullName(e.target.value)} required autoFocus />
              </div>

              <div className="form-group">
                <label className="form-label">Rol y Permisos</label>
                <select className="input-control" value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)}>
                  <option value="CAJERO">Cajero (Solo Facturación y Caja)</option>
                  <option value="BODEGUERO">Bodeguero (Inventario y Compras)</option>
                  <option value="STAFF">Staff / Barbero (Servicios y Comisiones)</option>
                  <option value="ADMIN">Administrador (Acceso Total)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">PIN Rápido (4 dígitos) *</label>
                <input type="password" maxLength={4} className="input-control" value={newPinCode} onChange={(e) => setNewPinCode(e.target.value)} required />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsNewProfileModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar Empleado</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Create / Edit Fiscal Range */}
      {isFiscalModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', margin: 0, color: '#0f172a', fontWeight: 700 }}>
                {editingFiscalRange ? 'Editar Caja Registradora / Rango Fiscal' : 'Agregar Nueva Caja Registradora / CAI'}
              </h3>
              <button className="btn btn-secondary" onClick={() => setIsFiscalModalOpen(false)} style={{ padding: '0.2rem 0.5rem' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveFiscalRange} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Nombre de la Caja / Terminal *</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="ej: Caja 1 - Principal, Caja 2 - Expreso"
                  value={fiscalName}
                  onChange={(e) => setFiscalName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Número de CAI Autorizado (32 carácteres) *</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="ej: E83910-149BF1-9243E9-913210-9182C1-02"
                  value={fiscalCai}
                  onChange={(e) => setFiscalCai(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Prefijo Fiscal (16 carácteres) *</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="ej: 000-001-01-"
                  value={fiscalPrefix}
                  onChange={(e) => setFiscalPrefix(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Fecha Límite (Deadline) *</label>
                <input
                  type="date"
                  className="input-control"
                  value={fiscalDeadline}
                  onChange={(e) => setFiscalDeadline(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Rango Inicial</label>
                <input
                  type="number"
                  className="input-control"
                  value={fiscalRangeStart}
                  onChange={(e) => setFiscalRangeStart(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Rango Final</label>
                <input
                  type="number"
                  className="input-control"
                  value={fiscalRangeEnd}
                  onChange={(e) => setFiscalRangeEnd(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Correlativo Actual Emitido</label>
                <input
                  type="number"
                  className="input-control"
                  value={fiscalCurrentNumber}
                  onChange={(e) => setFiscalCurrentNumber(e.target.value)}
                />
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  Próxima factura: {fiscalPrefix}{String((parseInt(fiscalCurrentNumber) || 0) + 1).padStart(8, '0')}
                </span>
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                <input
                  type="checkbox"
                  id="chk-fiscal-default"
                  checked={fiscalIsDefault}
                  onChange={(e) => setFiscalIsDefault(e.target.checked)}
                />
                <label htmlFor="chk-fiscal-default" style={{ fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none', color: '#0f172a' }}>
                  Marcar como Caja Principal predeterminada
                </label>
              </div>

              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsFiscalModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingFiscalRange ? 'Guardar Cambios' : 'Registrar Caja'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default SettingsView;
