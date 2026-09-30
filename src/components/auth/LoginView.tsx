import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { toast } from 'sonner';
import { ArrowRight, Store, ShieldAlert } from 'lucide-react';
import { UserProfile, Tenant } from '../../types';
import { fetchTenantsFromSupabase, fetchProfilesFromSupabase } from '../../lib/supabaseService';

import { verifyPinCode, generateUUID } from '../../lib/security';

export const LoginView: React.FC = () => {
  const profiles = useAppStore(state => state.profiles);
  const setCurrentUser = useAppStore(state => state.setCurrentUser);
  const tenant = useAppStore(state => state.tenant);

  const [activeTenant, setActiveTenant] = useState<Tenant>(tenant);

  // Auto-detect store from URL (?tienda=slug) or load active tenant
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlSlug = urlParams.get('tienda') || window.location.pathname.replace('/', '').trim();

    fetchTenantsFromSupabase().then(cloudTenants => {
      const localTenants = useAppStore.getState().tenants || [];
      const allTenants = [...(cloudTenants || [])];
      for (const lt of localTenants) {
        if (!allTenants.some(ct => ct.id === lt.id)) {
          allTenants.push(lt);
        }
      }

      if (allTenants.length > 0) {
        let target = allTenants.find(t => t.id === useAppStore.getState().tenant.id) || allTenants[0];

        if (urlSlug && urlSlug !== '/') {
          const cleanSlug = urlSlug.toLowerCase().replace(/[^a-z0-9]/g, '');
          const matched = allTenants.find(t =>
            t.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(cleanSlug) ||
            t.name.toLowerCase().includes(urlSlug.toLowerCase()) ||
            t.id === urlSlug
          );

          if (matched) {
            target = matched;
          } else {
            // Auto-create tenant for specified URL slug if not found
            const formattedName = urlSlug.charAt(0).toUpperCase() + urlSlug.slice(1);
            const newSlugTenant: Tenant = {
              id: generateUUID(),
              name: formattedName,
              businessType: 'RETAIL',
              isFiscalEnabled: true,
              allowNegativeStock: false,
              currencySymbol: 'L.'
            };
            useAppStore.getState().addTenant(newSlugTenant);
            target = newSlugTenant;
          }
        }

        setActiveTenant(target);
        useAppStore.setState({ tenant: target });

        // Load profiles for this specific store
        fetchProfilesFromSupabase(target.id).then(liveProfiles => {
          if (liveProfiles && liveProfiles.length > 0) {
            useAppStore.setState(state => {
              const other = state.profiles.filter(p => p.tenantId !== target.id);
              return { profiles: [...liveProfiles, ...other] };
            });
          }
        });
      }
    });
  }, []);

  // Filter profiles strictly for active tenant and guarantee an ADMIN profile
  const tenantProfiles = profiles.filter(p => p.tenantId === activeTenant.id && (p.isActive ?? true));
  const hasAdmin = tenantProfiles.some(p => p.role === 'ADMIN');

  const defaultAdminProfile: UserProfile = {
    id: `admin-${activeTenant.id}`,
    tenantId: activeTenant.id,
    fullName: `${activeTenant.name} (Administrador)`,
    role: 'ADMIN' as const,
    pinCode: '1234',
    isActive: true
  };

  const displayProfiles = hasAdmin
    ? tenantProfiles
    : [defaultAdminProfile, ...tenantProfiles];

  const [selectedProfileId, setSelectedProfileId] = useState(displayProfiles[0]?.id || '');
  const [pinInput, setPinInput] = useState('');

  // Keep selectedProfileId in sync with displayProfiles
  useEffect(() => {
    if (displayProfiles.length > 0 && !displayProfiles.some(p => p.id === selectedProfileId)) {
      setSelectedProfileId(displayProfiles[0].id);
    }
  }, [activeTenant.id, displayProfiles]);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const profile = displayProfiles.find((p: UserProfile) => p.id === selectedProfileId)
      || displayProfiles[0];

    if (!profile) {
      toast.error('Selecciona un usuario');
      return;
    }

    const isMatch = await verifyPinCode(pinInput, profile.pinCode || '1234');
    if (!isMatch) {
      toast.error('PIN incorrecto. Intenta de nuevo.');
      setPinInput('');
      return;
    }

    // Ensure profile exists in store profiles list
    if (!profiles.some(p => p.id === profile.id)) {
      useAppStore.setState(state => ({ profiles: [profile, ...state.profiles] }));
    }

    setCurrentUser(profile);
    toast.success(`Bienvenido a ${activeTenant.name}, ${profile.fullName}`);
    useAppStore.setState({ isAuthenticated: true, isDevMode: false });
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '2rem', background: '#ffffff', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>

        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <img src="/MiCuadre-logo.png" alt="MiCuadre Logo" style={{ width: '80px', height: '80px', objectFit: 'contain', margin: '0 auto 0.5rem auto' }} />
          <h2 style={{ fontSize: '1.6rem', color: '#0f172a', fontWeight: 800 }}>MiCuadre</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Sistema POS, Inventario & Calendario Financiero</p>
        </div>

        {/* Active Store Badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '0.65rem 1rem', borderRadius: '10px', marginBottom: '1.5rem' }}>
          <Store size={18} style={{ color: '#10b981' }} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '0.7rem', color: '#047857', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Comercio Activo</p>
            <h3 style={{ fontSize: '1.05rem', color: '#064e3b', fontWeight: 800, margin: 0 }}>{activeTenant.name}</h3>
          </div>
        </div>

        {/* PIN Login Form */}
        <form onSubmit={handlePinSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          <div className="form-group">
            <label className="form-label">Selecciona tu Usuario / Empleado</label>
            <select
              className="input-control"
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              style={{ fontSize: '1rem', fontWeight: 600 }}
            >
              {displayProfiles.map((p: UserProfile) => (
                <option key={p.id} value={p.id}>{p.fullName} ({p.role})</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">PIN de Acceso (4 dígitos)</label>
            <input
              type="password"
              maxLength={4}
              className="input-control"
              placeholder="****"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              style={{ fontSize: '1.5rem', letterSpacing: '0.5em', textAlign: 'center' }}
              autoFocus
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem', fontSize: '1rem', marginTop: '0.5rem', fontWeight: 700 }}>
            <span>Entrar al Sistema</span>
            <ArrowRight size={18} />
          </button>

          {/* SaaS SuperAdmin Portal Direct Link */}
          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
            <a
              href="?admin=true"
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState({}, '', '/admin');
                window.dispatchEvent(new Event('popstate'));
              }}
              style={{ fontSize: '0.78rem', color: '#64748b', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}
            >
              <ShieldAlert size={14} style={{ color: '#0f172a' }} />
              <span>Acceso Administrador de Plataforma SaaS (/admin)</span>
            </a>
          </div>
        </form>

      </div>
    </div>
  );
};
