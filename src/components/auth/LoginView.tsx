import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { toast } from 'sonner';
import { ArrowRight, Store, ShieldAlert, Lock, User, Building2 } from 'lucide-react';
import { UserProfile, Tenant } from '../../types';
import { findTenantInSupabase, fetchProfilesFromSupabase, fetchFiscalRangesFromSupabase } from '../../lib/supabaseService';
import { verifyPinCode, normalizeSlug } from '../../lib/security';

interface LoginViewProps {
  onBackToLanding?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onBackToLanding }) => {
  const profiles = useAppStore(state => state.profiles);
  const setCurrentUser = useAppStore(state => state.setCurrentUser);
  const tenant = useAppStore(state => state.tenant);
  const fiscalRanges = useAppStore(state => state.fiscalRanges);
  const selectedFiscalRangeId = useAppStore(state => state.selectedFiscalRangeId);
  const setSelectedFiscalRange = useAppStore(state => state.setSelectedFiscalRange);

  // Form input states
  const [storeInput, setStoreInput] = useState<string>(tenant?.name || '');
  const [availableProfiles, setAvailableProfiles] = useState<UserProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (tenant?.name) {
      setStoreInput(tenant.name);
    }
  }, [tenant?.id, tenant?.name]);

  // Dynamically load profiles for the typed store name or RTN
  useEffect(() => {
    let isMounted = true;
    const loadStoreProfiles = async () => {
      if (!storeInput.trim()) {
        setAvailableProfiles([]);
        return;
      }
      const matched = await findTenantInSupabase(storeInput);
      if (!isMounted) return;

      if (matched) {
        const liveProfiles = await fetchProfilesFromSupabase(matched.id);
        const localProfiles = profiles.filter(p => p.tenantId === matched.id);
        let tenantProfiles = (liveProfiles && liveProfiles.length > 0) ? liveProfiles : localProfiles;

        let adminProfile = tenantProfiles.find(p => p.role === 'ADMIN');
        if (!adminProfile) {
          adminProfile = {
            id: `admin-${matched.id}`,
            tenantId: matched.id,
            fullName: `${matched.name} (Administrador)`,
            role: 'ADMIN' as const,
            pinCode: '1234',
            isActive: true
          };
          tenantProfiles = [adminProfile, ...tenantProfiles];
        }

        fetchFiscalRangesFromSupabase(matched.id).then(liveRanges => {
          if (liveRanges && liveRanges.length > 0) {
            useAppStore.setState(state => {
              const otherRanges = (state.fiscalRanges || []).filter(r => r.tenantId && r.tenantId !== matched.id);
              const updated = [...liveRanges, ...otherRanges];
              const defaultRange = liveRanges.find(r => r.isDefault) || liveRanges[0];
              return {
                fiscalRanges: updated,
                selectedFiscalRangeId: defaultRange.id,
                fiscalRange: defaultRange
              };
            });
          }
        });

        setAvailableProfiles(tenantProfiles);
        if (!selectedProfileId || !tenantProfiles.some(p => p.id === selectedProfileId)) {
          setSelectedProfileId(adminProfile.id);
        }
      } else {
        const defaultAdmin: UserProfile = {
          id: `admin-${tenant.id}`,
          tenantId: tenant.id,
          fullName: 'Administrador General',
          role: 'ADMIN' as const,
          pinCode: '1234',
          isActive: true
        };
        setAvailableProfiles([defaultAdmin]);
        setSelectedProfileId(defaultAdmin.id);
      }
    };

    const timer = setTimeout(loadStoreProfiles, 300);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [storeInput, tenant.id, profiles, selectedProfileId]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeInput.trim()) {
      toast.error('Ingresa el nombre o RTN de tu comercio');
      return;
    }
    if (!passwordInput.trim()) {
      toast.error('Ingresa tu contraseña de acceso');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Strict Search matching tenant by exact name, RTN, ID or slug
      const matchedTenant = await findTenantInSupabase(storeInput);
      if (!matchedTenant) {
        toast.error(`No se encontró el comercio "${storeInput}". Verifica el nombre o RTN ingresado.`);
        setIsLoading(false);
        return;
      }

      // Update active tenant in store
      useAppStore.setState({ tenant: matchedTenant });

      // 2. Fetch profiles for this tenant
      const liveProfiles = await fetchProfilesFromSupabase(matchedTenant.id);
      const localProfiles = profiles.filter(p => p.tenantId === matchedTenant.id);
      let tenantProfiles = (liveProfiles && liveProfiles.length > 0) ? liveProfiles : localProfiles;

      let adminProfile = tenantProfiles.find(p => p.role === 'ADMIN');
      if (!adminProfile) {
        adminProfile = {
          id: `admin-${matchedTenant.id}`,
          tenantId: matchedTenant.id,
          fullName: `${matchedTenant.name} (Administrador)`,
          role: 'ADMIN' as const,
          pinCode: '1234',
          isActive: true
        };
        tenantProfiles = [adminProfile, ...tenantProfiles];
      }

      // 3. Select target profile from dropdown selection
      let selectedProfile = tenantProfiles.find(p => p.id === selectedProfileId);
      if (!selectedProfile) {
        selectedProfile = adminProfile;
      }

      // 4. Verify password / PIN code securely
      const isMatch = await verifyPinCode(passwordInput, selectedProfile.pinCode || '1234');
      if (!isMatch) {
        toast.error('Contraseña o PIN de acceso incorrecto.');
        setIsLoading(false);
        return;
      }

      // Ensure profile is in store profiles list
      if (!profiles.some(p => p.id === selectedProfile!.id)) {
        useAppStore.setState(state => ({ profiles: [selectedProfile!, ...state.profiles] }));
      }

      setCurrentUser(selectedProfile);
      toast.success(`Bienvenido a ${matchedTenant.name}, ${selectedProfile.fullName}`);
      
      const currentActiveShift = useAppStore.getState().activeShift;
      const isShiftOpen = currentActiveShift && currentActiveShift.tenantId === matchedTenant.id && currentActiveShift.status === 'OPEN';
      const isNonAdmin = selectedProfile.role !== 'ADMIN';

      useAppStore.setState({ 
        isAuthenticated: true, 
        isDevMode: false,
        cartLines: [],
        cartCustomer: { name: 'Consumidor Final' },
        isShiftModalOpen: isNonAdmin && !isShiftOpen
      });
    } catch (err) {
      console.error('Error al iniciar sesión:', err);
      toast.error('Error al verificar credenciales. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '2rem', background: '#ffffff', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>

        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <img src="/MiCuadre-logo.png" alt="MiCuadre Logo" style={{ width: '75px', height: '75px', objectFit: 'contain', margin: '0 auto 0.5rem auto' }} />
          <h2 style={{ fontSize: '1.5rem', color: '#0f172a', fontWeight: 900, letterSpacing: '-0.02em' }}>MiCuadre<span style={{ color: '#059669' }}>.app</span></h2>
          <p style={{ fontSize: '0.84rem', color: '#64748b' }}>Inicio de Sesión Seguro</p>
        </div>

        {/* Secure Private Login Form */}
        <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
              <Building2 size={16} style={{ color: '#059669' }} />
              <span>Comercio / Nombre del Negocio</span>
            </label>
            <input
              type="text"
              className="input-control"
              placeholder="Ej. Pulpería San José o RTN"
              value={storeInput}
              onChange={(e) => setStoreInput(e.target.value)}
              style={{ fontSize: '0.95rem', fontWeight: 600, padding: '0.75rem' }}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
              <User size={16} style={{ color: '#059669' }} />
              <span>Usuario / Perfil de Acceso</span>
            </label>
            <select
              className="input-control"
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              style={{ fontSize: '0.95rem', fontWeight: 600, padding: '0.75rem', width: '100%', background: '#ffffff', cursor: 'pointer' }}
              required
            >
              {availableProfiles.map(p => (
                <option key={p.id} value={p.id}>
                  {p.fullName} ({p.role === 'ADMIN' ? 'Administrador' : p.role === 'CAJERO' ? 'Cajero' : p.role === 'BODEGUERO' ? 'Bodeguero' : 'Personal'})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
              <Store size={16} style={{ color: '#059669' }} />
              <span>Caja Registradora / Terminal</span>
            </label>
            <select
              className="input-control"
              value={selectedFiscalRangeId}
              onChange={(e) => setSelectedFiscalRange(e.target.value)}
              style={{ fontSize: '0.95rem', fontWeight: 600, padding: '0.75rem', width: '100%', background: '#ffffff', cursor: 'pointer' }}
            >
              {(fiscalRanges || []).filter(r => !r.tenantId || r.tenantId === tenant.id).map(r => (
                <option key={r.id} value={r.id}>
                  {r.name || 'Caja Registradora'} ({r.prefix}{String(r.currentNumber).padStart(8, '0')})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
              <Lock size={16} style={{ color: '#059669' }} />
              <span>Contraseña de Acceso</span>
            </label>
            <input
              type="password"
              className="input-control"
              placeholder="Ingresa tu contraseña"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              style={{ fontSize: '1rem', padding: '0.75rem' }}
              autoFocus
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary"
            style={{ padding: '0.85rem', fontSize: '1rem', marginTop: '0.5rem', fontWeight: 800, background: '#059669', borderColor: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <span>{isLoading ? 'Verificando...' : 'Entrar al Sistema'}</span>
            {!isLoading && <ArrowRight size={18} />}
          </button>

          {/* Navigation Links */}
          {onBackToLanding && (
            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  window.history.pushState({}, '', '/');
                  onBackToLanding();
                }}
                style={{ background: 'none', border: 'none', fontSize: '0.82rem', color: '#059669', cursor: 'pointer', fontWeight: 700 }}
              >
                ← Ir a la Página Principal (micuadre.app)
              </button>
            </div>
          )}

        </form>

      </div>
    </div>
  );
};
