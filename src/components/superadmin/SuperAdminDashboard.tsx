import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { isSupabaseConfigured, testSupabaseConnection } from '../../lib/supabase';
import { fetchTenantsFromSupabase, seedInitialDataToSupabase } from '../../lib/supabaseService';
import { supabase } from '../../lib/supabase';
import { Tenant, BusinessType, UserProfile } from '../../types';
import { toast } from 'sonner';
import {
  ShieldAlert, Building2, Plus, Copy, Database, CheckCircle2,
  AlertCircle, RefreshCw, Terminal, ExternalLink, Zap, Pencil, Trash2,
  Key, Lock, LogOut, Calendar, DollarSign, Check, X, ArrowRight, Play
} from 'lucide-react';

interface SuperAdminDashboardProps {
  onExit?: () => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onExit }) => {
  const storeTenants = useAppStore(state => state.tenants) || [];
  const addTenant = useAppStore(state => state.addTenant);
  const updateTenant = useAppStore(state => state.updateTenant);
  const deleteTenantAction = useAppStore(state => state.deleteTenant);

  // SuperAdmin Master Auth state
  const [isAuthenticatedSaaS, setIsAuthenticatedSaaS] = useState(
    sessionStorage.getItem('micuadre_saas_admin_auth') === 'true'
  );
  const [masterPasswordInput, setMasterPasswordInput] = useState('');

  const [tenants, setTenants] = useState<Tenant[]>(storeTenants);
  const [isLoading, setIsLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<{ success: boolean; message: string; details?: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal Form State
  const [isNewTenantModalOpen, setIsNewTenantModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null);

  // New Merchant Form State
  const [newStoreName, setNewStoreName] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminPin, setNewAdminPin] = useState('1234');
  const [newRtn, setNewRtn] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newBusinessType, setNewBusinessType] = useState<BusinessType>('RETAIL');
  const [newIsFiscal, setNewIsFiscal] = useState(false);
  const [newPlan, setNewPlan] = useState<'MONTHLY' | 'ANNUAL' | 'FREE_TRIAL' | 'ENTERPRISE'>('MONTHLY');
  const [newTrialDays, setNewTrialDays] = useState('30');
  const [newMonthlyPrice, setNewMonthlyPrice] = useState('950');
  const [newAccessPassword, setNewAccessPassword] = useState('');

  // New Module Switch States
  const [newIsServices, setNewIsServices] = useState(true);
  const [newIsWholesale, setNewIsWholesale] = useState(true);
  const [newIsLoyalty, setNewIsLoyalty] = useState(true);

  // Master Key Change Modal State
  const [isMasterKeyModalOpen, setIsMasterKeyModalOpen] = useState(false);
  const [customMasterKey, setCustomMasterKey] = useState('');

  // Supabase Counts
  const [tableCounts, setTableCounts] = useState<{
    tenants: number;
    products: number;
    sales: number;
    shifts: number;
  }>({ tenants: 0, products: 0, sales: 0, shifts: 0 });

  const loadData = async () => {
    setIsLoading(true);
    const connectionTest = await testSupabaseConnection();
    setDbStatus(connectionTest);

    if (isSupabaseConfigured()) {
      const liveTenants = await fetchTenantsFromSupabase();
      if (liveTenants && liveTenants.length > 0) {
        setTenants(liveTenants);
      } else {
        setTenants(storeTenants);
      }

      try {
        const { count: tCount } = await supabase.from('tenants').select('*', { count: 'exact', head: true });
        const { count: pCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
        const { count: sCount } = await supabase.from('sales').select('*', { count: 'exact', head: true });
        const { count: cCount } = await supabase.from('cash_shifts').select('*', { count: 'exact', head: true });

        setTableCounts({
          tenants: tCount || tenants.length,
          products: pCount || 0,
          sales: sCount || 0,
          shifts: cCount || 0
        });
      } catch (e) {
        console.warn('Error al contar filas:', e);
      }
    } else {
      setTenants(storeTenants);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (isAuthenticatedSaaS) {
      loadData();
    }
  }, [isAuthenticatedSaaS]);

  const getExpectedSaaSKey = () => {
    return localStorage.getItem('micuadre_custom_saas_key') || import.meta.env.VITE_SAAS_ADMIN_KEY || 'superadmin123';
  };

  const handleMasterLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (masterPasswordInput === getExpectedSaaSKey()) {
      sessionStorage.setItem('micuadre_saas_admin_auth', 'true');
      setIsAuthenticatedSaaS(true);
      toast.success('Bienvenido al Portal de Administración SaaS MiCuadre');
    } else {
      toast.error('Contraseña maestra de SaaS incorrecta');
    }
  };

  const handleSaveMasterKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customMasterKey.trim()) {
      toast.error('Ingresa la nueva contraseña maestra');
      return;
    }
    localStorage.setItem('micuadre_custom_saas_key', customMasterKey.trim());
    toast.success('Contraseña Maestra SaaS actualizada exitosamente');
    setIsMasterKeyModalOpen(false);
    setCustomMasterKey('');
  };

  const handleMasterLogout = () => {
    sessionStorage.removeItem('micuadre_saas_admin_auth');
    setIsAuthenticatedSaaS(false);
    toast.info('Sesión de Administración SaaS cerrada');
    if (onExit) onExit();
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim()) {
      toast.error('Ingresa el nombre del comercio');
      return;
    }

    const generateUUID = () => (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });

    const newId = generateUUID();
    const trialDaysNum = parseInt(newTrialDays) || 30;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + (newPlan === 'FREE_TRIAL' ? trialDaysNum : 30));

    const newTenantObj: Tenant = {
      id: newId,
      name: newStoreName.trim(),
      rtn: newRtn.trim() || undefined,
      phone: newPhone.trim() || undefined,
      email: newEmail.trim() || undefined,
      address: newAddress.trim() || undefined,
      businessType: newBusinessType,
      isFiscalEnabled: newIsFiscal,
      isServicesEnabled: newIsServices,
      isWholesaleEnabled: newIsWholesale,
      isLoyaltyEnabled: newIsLoyalty,
      accessPassword: newAccessPassword.trim() || undefined,
      allowNegativeStock: false,
      currencySymbol: 'L.',
      subscriptionStatus: newPlan === 'FREE_TRIAL' ? 'TRIAL' : 'ACTIVE',
      subscriptionPlan: newPlan,
      subscriptionExpiresAt: expiryDate.toISOString().split('T')[0],
      monthlyPrice: parseFloat(newMonthlyPrice) || 950
    };

    const adminProfile: UserProfile = {
      id: generateUUID(),
      tenantId: newId,
      fullName: newAdminName.trim() || 'Administrador General',
      role: 'ADMIN',
      pinCode: newAdminPin || '1234',
      isActive: true
    };

    useAppStore.setState(state => ({ profiles: [adminProfile, ...state.profiles] }));
    addTenant(newTenantObj);

    if (isSupabaseConfigured()) {
      toast.info('Registrando comercio en Supabase...');
      const { error } = await supabase.from('tenants').insert({
        id: newId,
        name: newTenantObj.name,
        rtn: newTenantObj.rtn || null,
        phone: newTenantObj.phone || null,
        email: newTenantObj.email || null,
        address: newTenantObj.address || null,
        business_type: newTenantObj.businessType,
        is_fiscal_enabled: newTenantObj.isFiscalEnabled,
        is_services_enabled: newTenantObj.isServicesEnabled,
        is_wholesale_enabled: newTenantObj.isWholesaleEnabled,
        is_loyalty_enabled: newTenantObj.isLoyaltyEnabled,
        access_password: newTenantObj.accessPassword || null,
        allow_negative_stock: false
      });

      if (error) {
        toast.warning(`Comercio guardado localmente (${error.message})`);
      } else {
        toast.success(`¡Comercio "${newTenantObj.name}" registrado en Supabase!`);
        await supabase.from('profiles').insert({
          id: adminProfile.id,
          tenant_id: newId,
          full_name: adminProfile.fullName,
          role: 'ADMIN',
          pin_code: adminProfile.pinCode,
          is_active: true
        });
      }
    } else {
      toast.success(`Comercio "${newTenantObj.name}" registrado localmente`);
    }

    setTenants(prev => [newTenantObj, ...prev.filter(t => t.id !== newTenantObj.id)]);
    setIsNewTenantModalOpen(false);
    setNewStoreName('');
    setNewAdminName('');
    setNewAdminPin('1234');
    setNewRtn('');
    setNewPhone('');
    setNewEmail('');
    setNewAddress('');
    loadData();
  };

  const handleRenewSubscription = (targetTenant: Tenant, monthsToAdd: number) => {
    const currentExpiry = targetTenant.subscriptionExpiresAt ? new Date(targetTenant.subscriptionExpiresAt) : new Date();
    const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
    baseDate.setMonth(baseDate.getMonth() + monthsToAdd);

    const newExpiryStr = baseDate.toISOString().split('T')[0];
    const updated = {
      ...targetTenant,
      subscriptionStatus: 'ACTIVE' as const,
      subscriptionExpiresAt: newExpiryStr
    };

    updateTenant(targetTenant.id, updated);
    setTenants(prev => prev.map(t => t.id === targetTenant.id ? updated : t));
    toast.success(`Suscripción de "${targetTenant.name}" renovada por ${monthsToAdd} mes(es) hasta ${newExpiryStr}`);
  };

  const handleUpdateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant || !editingTenant.name) return;

    updateTenant(editingTenant.id, editingTenant);

    if (isSupabaseConfigured()) {
      const { error } = await supabase
        .from('tenants')
        .update({
          name: editingTenant.name,
          rtn: editingTenant.rtn || null,
          phone: editingTenant.phone || null,
          email: editingTenant.email || null,
          address: editingTenant.address || null,
          business_type: editingTenant.businessType,
          is_fiscal_enabled: editingTenant.isFiscalEnabled,
          is_services_enabled: editingTenant.isServicesEnabled ?? true,
          is_wholesale_enabled: editingTenant.isWholesaleEnabled ?? true,
          is_loyalty_enabled: editingTenant.isLoyaltyEnabled ?? true,
          access_password: editingTenant.accessPassword || null,
          subscription_status: editingTenant.subscriptionStatus || 'ACTIVE',
          subscription_plan: editingTenant.subscriptionPlan || 'MONTHLY',
          subscription_expires_at: editingTenant.subscriptionExpiresAt || null,
          monthly_price: editingTenant.monthlyPrice || 950
        })
        .eq('id', editingTenant.id);

      if (error) {
        toast.error(`Error al actualizar en Supabase: ${error.message}`);
      } else {
        toast.success(`Comercio "${editingTenant.name}" actualizado en Supabase`);
      }
    } else {
      toast.success(`Comercio "${editingTenant.name}" actualizado`);
    }

    setTenants(prev => prev.map(t => t.id === editingTenant.id ? editingTenant : t));
    setEditingTenant(null);
  };

  const handleDeleteTenant = async () => {
    if (!deletingTenant) return;

    deleteTenantAction(deletingTenant.id);

    if (isSupabaseConfigured()) {
      await supabase.from('profiles').delete().eq('tenant_id', deletingTenant.id);
      await supabase.from('products').delete().eq('tenant_id', deletingTenant.id);
      await supabase.from('sales').delete().eq('tenant_id', deletingTenant.id);
      await supabase.from('cash_shifts').delete().eq('tenant_id', deletingTenant.id);
      const { error } = await supabase.from('tenants').delete().eq('id', deletingTenant.id);

      if (error) {
        toast.error(`Error al eliminar en Supabase: ${error.message}`);
      } else {
        toast.success(`Comercio "${deletingTenant.name}" eliminado de Supabase`);
      }
    } else {
      toast.success(`Comercio "${deletingTenant.name}" eliminado`);
    }

    setTenants(prev => prev.filter(t => t.id !== deletingTenant.id));
    setDeletingTenant(null);
    loadData();
  };

  const handleEmulateTenant = (targetTenant: Tenant) => {
    const existingProfiles = useAppStore.getState().profiles;
    let targetAdmin = existingProfiles.find(p => p.tenantId === targetTenant.id && p.role === 'ADMIN');

    if (!targetAdmin) {
      targetAdmin = {
        id: `admin-${targetTenant.id}`,
        tenantId: targetTenant.id,
        fullName: `${targetTenant.name} (ADMIN)`,
        role: 'ADMIN',
        pinCode: '1234',
        isActive: true
      };
      useAppStore.setState(state => ({ profiles: [targetAdmin!, ...state.profiles] }));
    }

    useAppStore.setState({ tenant: targetTenant, currentUser: targetAdmin, activeTab: 'pos' });
    sessionStorage.setItem('micuadre_emulating_tenant', targetTenant.name);
    toast.success(`Accediendo en modo soporte como Administrador a "${targetTenant.name}"`);
    if (onExit) {
      onExit();
    } else {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new Event('popstate'));
    }
  };

  const copyTenantLink = (tenantItem: Tenant) => {
    const slug = tenantItem.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const link = `${window.location.origin}/?tienda=${slug}`;
    navigator.clipboard.writeText(link);
    toast.success(`Enlace cliente copiado: ${link}`);
  };

  // MRR & Subscription Metrics
  const activeCount = tenants.filter(t => (t.subscriptionStatus || 'ACTIVE') === 'ACTIVE').length;
  const trialCount = tenants.filter(t => t.subscriptionStatus === 'TRIAL').length;
  const expiredCount = tenants.filter(t => t.subscriptionStatus === 'EXPIRED').length;
  const totalMrr = tenants.reduce((acc, t) => acc + (t.monthlyPrice || 950), 0);

  const filteredTenants = tenants.filter(t => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return t.name.toLowerCase().includes(q) || (t.rtn && t.rtn.includes(q)) || (t.email && t.email.toLowerCase().includes(q));
  });

  // Render Master Admin Login if not authenticated
  if (!isAuthenticatedSaaS) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '2rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '16px', color: '#ffffff', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
              <ShieldAlert size={32} style={{ color: '#ffffff' }} />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>Portal SaaS Admin</h2>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '0.3rem' }}>
              Consola de Administración de Plataforma MiCuadre
            </p>
          </div>

          <form onSubmit={handleMasterLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ color: '#cbd5e1' }}>Contraseña Maestra de SaaS *</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type="password"
                  className="input-control"
                  placeholder="Ingrese clave de administrador..."
                  value={masterPasswordInput}
                  onChange={(e) => setMasterPasswordInput(e.target.value)}
                  style={{ paddingLeft: '2.5rem', background: '#1e293b', border: '1px solid #334155', color: '#ffffff', fontSize: '1rem' }}
                  autoFocus
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ padding: '0.8rem', fontSize: '0.95rem', fontWeight: 700, display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
              <span>Ingresar al Control SaaS</span>
              <ArrowRight size={18} />
            </button>
          </form>

          {onExit && (
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <button
                onClick={onExit}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Volver a la tienda de cliente
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Header Banner */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#ffffff', borderRadius: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert size={28} style={{ color: '#ffffff' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>Portal de Administración SaaS MiCuadre</h2>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>Gestión Global de Clientes, Suscripciones, Renovaciones y Servidores</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={() => {
              const demoTenant = tenants.find(t => t.id === '00000000-0000-0000-0000-000000000001') || tenants[0];
              if (demoTenant) handleEmulateTenant(demoTenant);
            }}
            style={{ background: '#0284c7', color: '#ffffff', borderColor: '#0369a1', fontSize: '0.82rem', padding: '0.45rem 0.75rem' }}
            title="Abrir comercio demo con datos precargados para presentaciones"
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Play size={14} /> Abrir Comercio Demo</span>
          </button>
          <button className="btn btn-secondary" onClick={loadData} disabled={isLoading} style={{ background: '#334155', color: '#ffffff', borderColor: '#475569', fontSize: '0.82rem', padding: '0.45rem 0.75rem' }}>
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            <span>Actualizar</span>
          </button>
          <button className="btn btn-primary" onClick={() => setIsNewTenantModalOpen(true)} style={{ fontSize: '0.82rem', padding: '0.45rem 0.75rem' }}>
            <Plus size={16} />
            <span>Afiliar Comercio</span>
          </button>
          <button className="btn btn-secondary" onClick={() => setIsMasterKeyModalOpen(true)} style={{ background: '#334155', color: '#ffffff', borderColor: '#475569', fontSize: '0.82rem', padding: '0.45rem 0.75rem' }}>
            <Key size={15} />
            <span>Clave Maestra</span>
          </button>
          <button className="btn" onClick={handleMasterLogout} style={{ background: '#ef4444', color: '#ffffff', border: 'none' }}>
            <LogOut size={16} />
            <span>Salir</span>
          </button>
        </div>
      </div>

      {/* SaaS Metrics Dashboard */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1.25rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
            <Building2 size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, margin: 0 }}>Comercios Afiliados</p>
            <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0 0 0' }}>{tenants.length}</h3>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, margin: 0 }}>Ingresos Recurrentes (MRR)</p>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2563eb', margin: '0.2rem 0 0 0' }}>L. {totalMrr.toLocaleString('es-HN')}.00</h3>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
            <Calendar size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, margin: 0 }}>Suscripciones Activas / Prueba</p>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#d97706', margin: '0.2rem 0 0 0' }}>
              {activeCount} Activas • {trialCount} Prueba
            </h3>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: expiredCount > 0 ? '#fef2f2' : '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: expiredCount > 0 ? '#ef4444' : '#64748b' }}>
            <AlertCircle size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, margin: 0 }}>Vencidas o Canceladas</p>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: expiredCount > 0 ? '#ef4444' : '#0f172a', margin: '0.2rem 0 0 0' }}>{expiredCount}</h3>
          </div>
        </div>
      </div>

      {/* Main Merchants Directory & Management Table */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem' }}>

        {/* Directory Card */}
        <div className="glass-panel" style={{ padding: '1.25rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', color: '#0f172a', fontWeight: 700, margin: 0 }}>Gestión de Suscripciones & Comercios Afiliados</h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>Renovación de planes, emulación para soporte técnico y configuración comercial</p>
            </div>
            <input
              type="text"
              className="input-control"
              placeholder="Buscar comercio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '220px', fontSize: '0.85rem' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '520px', overflowY: 'auto' }}>
            {filteredTenants.map(t => {
              const status = t.subscriptionStatus || 'ACTIVE';
              const expiresAt = t.subscriptionExpiresAt || '2026-12-31';

              return (
                <div
                  key={t.id}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <h4 style={{ fontSize: '1.05rem', color: '#0f172a', fontWeight: 700, margin: 0 }}>{t.name}</h4>
                        <span className="badge badge-wholesale">
                          {t.businessType === 'RETAIL' ? 'Retail / Pulpería' : t.businessType === 'SERVICES' ? 'Servicios / Barbería' : 'Giro Mixto'}
                        </span>
                        {t.isFiscalEnabled && <span className="badge badge-fiscal">SAR Activo</span>}
                        <span style={{
                          fontSize: '0.72rem',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '12px',
                          fontWeight: 700,
                          background: status === 'ACTIVE' ? '#dcfce7' : status === 'TRIAL' ? '#fef3c7' : '#fee2e2',
                          color: status === 'ACTIVE' ? '#15803d' : status === 'TRIAL' ? '#b45309' : '#b91c1c'
                        }}>
                          {status === 'ACTIVE' ? 'Suscripción Activa' : status === 'TRIAL' ? 'En Prueba Gratis' : 'SUSCRIPCIÓN VENCIDA'}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.3rem 0 0 0' }}>
                        ID: <code>{t.id}</code> • RTN: {t.rtn || 'No registrado'} • Tel: {t.phone || 'N/A'}
                      </p>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>Plan & Precio:</p>
                      <p style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>L. {(t.monthlyPrice || 950).toFixed(2)} / mes</p>
                      <p style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: 600, margin: '0.15rem 0 0 0' }}>Vence: {expiresAt}</p>
                    </div>
                  </div>

                  {/* Actions Toolbar for Tenant */}
                  <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap', background: '#ffffff', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleRenewSubscription(t, 1)}
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', color: '#166534', borderColor: '#86efac', background: '#f0fdf4' }}
                      title="Renovar suscripción por 30 días"
                    >
                      <Zap size={13} /> Renovar 30 Días
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleRenewSubscription(t, 12)}
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', color: '#1e40af', borderColor: '#93c5fd', background: '#eff6ff' }}
                      title="Renovar suscripción por 1 año"
                    >
                      <Calendar size={13} /> Renovar 1 Año
                    </button>
                    {t.phone && (
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          const clean = t.phone!.replace(/[^0-9]/g, '');
                          const text = encodeURIComponent(`Hola ${t.name}, le saludamos de la administración de MiCuadre.app. Le recordamos sobre su suscripción del sistema.`);
                          window.open(`https://wa.me/504${clean}?text=${text}`, '_blank');
                        }}
                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', color: '#15803d', borderColor: '#86efac', background: '#ecfdf5' }}
                        title="Enviar recordatorio de cobro por WhatsApp"
                      >
                        <ExternalLink size={13} /> WhatsApp
                      </button>
                    )}
                    <button
                      className="btn btn-secondary"
                      onClick={() => copyTenantLink(t)}
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                    >
                      <Copy size={13} /> Enlace
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setEditingTenant({ ...t })}
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                    >
                      <Pencil size={13} /> Editar
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleEmulateTenant(t)}
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                      title="Entrar en modo soporte técnico al comercio"
                    >
                      <ExternalLink size={13} /> Entrar
                    </button>
                    {tenants.length > 1 && (
                      <button
                        className="btn btn-danger"
                        onClick={() => setDeletingTenant(t)}
                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Database & Cloud Sync Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="glass-panel" style={{ padding: '1.25rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1rem', color: '#0f172a', fontWeight: 700, margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={18} style={{ color: 'var(--accent-primary)' }} />
              Estado Base de Datos Cloud
            </h3>

            {dbStatus && (
              <div style={{ padding: '0.85rem', borderRadius: '8px', background: dbStatus.success ? '#f0fdf4' : '#fef2f2', border: dbStatus.success ? '1px solid #bbf7d0' : '1px solid #fecaca', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: dbStatus.success ? '#166534' : '#991b1b', fontSize: '0.85rem' }}>
                  {dbStatus.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{dbStatus.message}</span>
                </div>
                {dbStatus.details && <p style={{ fontSize: '0.75rem', marginTop: '0.3rem', color: '#64748b' }}>{dbStatus.details}</p>}
              </div>
            )}

            <button
              className="btn btn-secondary"
              onClick={async () => {
                toast.info('Sincronizando datos...');
                const res = await seedInitialDataToSupabase(useAppStore.getState().tenant.id);
                if (res) toast.success('Datos sincronizados con Supabase');
                loadData();
              }}
              style={{ width: '100%', padding: '0.5rem', fontSize: '0.8rem' }}
            >
              <Plus size={14} /> Sincronizar Carga Inicial
            </button>
          </div>

          <div className="glass-panel" style={{ padding: '1.25rem', background: '#0f172a', color: '#ffffff', borderRadius: '12px' }}>
            <h4 style={{ fontSize: '0.9rem', color: '#ffffff', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Terminal size={16} style={{ color: '#10b981' }} />
              Consola de Desarrollador
            </h4>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: '1.4', margin: 0 }}>
              Definición SQL: <code>supabase/schema.sql</code><br />
              RLS Multi-Tenant Habilitado.
            </p>
          </div>
        </div>
      </div>

      {/* MODAL: Affiliate New Store */}
      {isNewTenantModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: '#0f172a', fontSize: '1.1rem', margin: 0, fontWeight: 700 }}>Afiliar Nuevo Comercio (SaaS Control)</h3>
              <button className="btn btn-secondary" onClick={() => setIsNewTenantModalOpen(false)} style={{ padding: '0.2rem 0.5rem' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateTenant} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Nombre del Comercio / Tienda *</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="ej: Pulpería & Abarrotes San José"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Administrador Propietario</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="ej: Carlos Mendoza"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">PIN Acceso Inicial (4 dígitos)</label>
                <input
                  type="password"
                  maxLength={4}
                  className="input-control"
                  placeholder="1234"
                  value={newAdminPin}
                  onChange={(e) => setNewAdminPin(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Contraseña Maestra de Acceso al Comercio (Opcional)</label>
                <input
                  type="password"
                  className="input-control"
                  placeholder="Contraseña para proteger la búsqueda de la tienda"
                  value={newAccessPassword}
                  onChange={(e) => setNewAccessPassword(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Giro del Negocio</label>
                <select
                  className="input-control"
                  value={newBusinessType}
                  onChange={(e) => setNewBusinessType(e.target.value as BusinessType)}
                >
                  <option value="RETAIL">Retail / Supermercado / Pulpería</option>
                  <option value="SERVICES">Servicios / Barbería / Salón</option>
                  <option value="MIXED">Mixto (Productos + Servicios)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Plan Inicial</label>
                <select
                  className="input-control"
                  value={newPlan}
                  onChange={(e) => setNewPlan(e.target.value as any)}
                >
                  <option value="MONTHLY">Mensual (L. 950/mes)</option>
                  <option value="ANNUAL">Anual (L. 9,500/año)</option>
                  <option value="FREE_TRIAL">Prueba Gratuita</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Precio Mensual (L.)</label>
                <input
                  type="number"
                  className="input-control"
                  value={newMonthlyPrice}
                  onChange={(e) => setNewMonthlyPrice(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">RTN de la Empresa</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="08011995123456"
                  value={newRtn}
                  onChange={(e) => setNewRtn(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Teléfono de Contacto</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="9988-7766"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Correo Electrónico</label>
                <input
                  type="email"
                  className="input-control"
                  placeholder="contacto@cliente.hn"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2', background: '#f8fafc', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label className="form-label" style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.2rem' }}>Permisos & Módulos Habilitados para este Comercio:</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.82rem', color: '#0f172a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={newIsFiscal} onChange={(e) => setNewIsFiscal(e.target.checked)} />
                    Facturación SAR CAI
                  </label>
                  <label style={{ fontSize: '0.82rem', color: '#0f172a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={newIsServices} onChange={(e) => setNewIsServices(e.target.checked)} />
                    Servicios & Citas
                  </label>
                  <label style={{ fontSize: '0.82rem', color: '#0f172a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={newIsWholesale} onChange={(e) => setNewIsWholesale(e.target.checked)} />
                    Mayoreo & Escalas
                  </label>
                  <label style={{ fontSize: '0.82rem', color: '#0f172a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={newIsLoyalty} onChange={(e) => setNewIsLoyalty(e.target.checked)} />
                    Clientes & Lealtad
                  </label>
                </div>
              </div>

              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsNewTenantModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar & Afiliar Comercio</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Tenant & Subscription */}
      {editingTenant && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: '#0f172a', fontSize: '1.1rem', margin: 0, fontWeight: 700 }}>Editar Suscripción y Módulos de "{editingTenant.name}"</h3>
              <button className="btn btn-secondary" onClick={() => setEditingTenant(null)} style={{ padding: '0.2rem 0.5rem' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateTenant} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Nombre del Comercio *</label>
                <input
                  type="text"
                  className="input-control"
                  value={editingTenant.name}
                  onChange={(e) => setEditingTenant({ ...editingTenant, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Estado Suscripción</label>
                <select
                  className="input-control"
                  value={editingTenant.subscriptionStatus || 'ACTIVE'}
                  onChange={(e) => setEditingTenant({ ...editingTenant, subscriptionStatus: e.target.value as any })}
                >
                  <option value="ACTIVE">Activa</option>
                  <option value="TRIAL">En Prueba</option>
                  <option value="EXPIRED">Vencida</option>
                  <option value="CANCELLED">Cancelada (Suspendida)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Fecha de Vencimiento</label>
                <input
                  type="date"
                  className="input-control"
                  value={editingTenant.subscriptionExpiresAt || '2026-12-31'}
                  onChange={(e) => setEditingTenant({ ...editingTenant, subscriptionExpiresAt: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Precio Mensual (L.)</label>
                <input
                  type="number"
                  className="input-control"
                  value={editingTenant.monthlyPrice || 950}
                  onChange={(e) => setEditingTenant({ ...editingTenant, monthlyPrice: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Contraseña del Comercio</label>
                <input
                  type="password"
                  className="input-control"
                  placeholder="Sin contraseña"
                  value={editingTenant.accessPassword || ''}
                  onChange={(e) => setEditingTenant({ ...editingTenant, accessPassword: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2', background: '#f8fafc', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label className="form-label" style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.2rem' }}>Módulos Habilitados para este Comercio:</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.82rem', color: '#0f172a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!editingTenant.isFiscalEnabled} onChange={(e) => setEditingTenant({ ...editingTenant, isFiscalEnabled: e.target.checked })} />
                    Facturación SAR CAI
                  </label>
                  <label style={{ fontSize: '0.82rem', color: '#0f172a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={editingTenant.isServicesEnabled ?? true} onChange={(e) => setEditingTenant({ ...editingTenant, isServicesEnabled: e.target.checked })} />
                    Servicios & Citas
                  </label>
                  <label style={{ fontSize: '0.82rem', color: '#0f172a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={editingTenant.isWholesaleEnabled ?? true} onChange={(e) => setEditingTenant({ ...editingTenant, isWholesaleEnabled: e.target.checked })} />
                    Mayoreo & Escalas
                  </label>
                  <label style={{ fontSize: '0.82rem', color: '#0f172a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={editingTenant.isLoyaltyEnabled ?? true} onChange={(e) => setEditingTenant({ ...editingTenant, isLoyaltyEnabled: e.target.checked })} />
                    Clientes & Lealtad
                  </label>
                </div>
              </div>

              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingTenant(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Delete Confirmation */}
      {deletingTenant && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: '#dc2626' }}>
              <AlertCircle size={28} />
              <h3 style={{ color: '#0f172a', margin: 0 }}>Eliminar Comercio</h3>
            </div>

            <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '1.25rem' }}>
              ¿Estás seguro de que deseas eliminar permanentemente <strong>"{deletingTenant.name}"</strong> y todos sus datos?
            </p>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => setDeletingTenant(null)} style={{ flex: 1 }}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleDeleteTenant} style={{ flex: 1 }}>Eliminar Comercio</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Change Master Key SaaS */}
      {isMasterKeyModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: '#0f172a', fontSize: '1.1rem', margin: 0, fontWeight: 700 }}>Cambiar Clave Maestra SaaS</h3>
              <button className="btn btn-secondary" onClick={() => setIsMasterKeyModalOpen(false)} style={{ padding: '0.2rem 0.5rem' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveMasterKey} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Nueva Contraseña Maestra *</label>
                <input
                  type="password"
                  className="input-control"
                  placeholder="Ingrese la nueva contraseña de acceso al portal..."
                  value={customMasterKey}
                  onChange={(e) => setCustomMasterKey(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsMasterKeyModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Actualizar Clave Maestra</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default SuperAdminDashboard;
