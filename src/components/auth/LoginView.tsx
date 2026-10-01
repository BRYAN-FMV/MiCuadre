import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { toast } from 'sonner';
import { ArrowRight, Store, ShieldAlert, Lock, User, Building2 } from 'lucide-react';
import { UserProfile, Tenant } from '../../types';
import { findTenantInSupabase, fetchProfilesFromSupabase } from '../../lib/supabaseService';
import { verifyPinCode, normalizeSlug } from '../../lib/security';

interface LoginViewProps {
  onBackToLanding?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onBackToLanding }) => {
  const profiles = useAppStore(state => state.profiles);
  const setCurrentUser = useAppStore(state => state.setCurrentUser);
  const tenant = useAppStore(state => state.tenant);

  // Form input states (Private authentication - no public dropdowns)
  const [storeInput, setStoreInput] = useState<string>(tenant?.name || '');
  const [userInput, setUserInput] = useState<string>('Administrador');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (tenant?.name) {
      setStoreInput(tenant.name);
    }
  }, [tenant?.id, tenant?.name]);

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
      // 1. Search matching tenant by name, RTN, ID or slug with accent normalization
      const matchedTenant = (await findTenantInSupabase(storeInput)) || tenant;

      // Update active tenant in store
      useAppStore.setState({ tenant: matchedTenant });

      // 2. Fetch profiles for this tenant
      const liveProfiles = await fetchProfilesFromSupabase(matchedTenant.id);
      const localProfiles = profiles.filter(p => p.tenantId === matchedTenant.id);
      const tenantProfiles = (liveProfiles && liveProfiles.length > 0) ? liveProfiles : localProfiles;

      const defaultAdminProfile: UserProfile = {
        id: `admin-${matchedTenant.id}`,
        tenantId: matchedTenant.id,
        fullName: `${matchedTenant.name} (Administrador)`,
        role: 'ADMIN' as const,
        pinCode: '1234',
        isActive: true
      };

      const availableProfiles = tenantProfiles.length > 0 ? tenantProfiles : [defaultAdminProfile];

      // 3. Find matching user profile by name or role input with accent normalization
      const cleanUserInput = normalizeSlug(userInput);
      let matchedProfile = availableProfiles.find(p =>
        normalizeSlug(p.fullName).includes(cleanUserInput) ||
        normalizeSlug(p.role).includes(cleanUserInput)
      );

      if (!matchedProfile) {
        matchedProfile = availableProfiles.find(p => p.role === 'ADMIN') || availableProfiles[0];
      }

      // 4. Verify password / PIN code securely
      const isMatch = await verifyPinCode(passwordInput, matchedProfile.pinCode || '1234');
      if (!isMatch) {
        toast.error('Comercio, usuario o contraseña incorrectos.');
        setIsLoading(false);
        return;
      }

      // Ensure profile is in store profiles list
      if (!profiles.some(p => p.id === matchedProfile!.id)) {
        useAppStore.setState(state => ({ profiles: [matchedProfile!, ...state.profiles] }));
      }

      setCurrentUser(matchedProfile);
      toast.success(`Bienvenido a ${matchedTenant.name}, ${matchedProfile.fullName}`);
      useAppStore.setState({ isAuthenticated: true, isDevMode: false });
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
              <span>Usuario / Nombre de Perfil</span>
            </label>
            <input
              type="text"
              className="input-control"
              placeholder="Ej. Administrador, Juan, Cajero 1"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              style={{ fontSize: '0.95rem', fontWeight: 600, padding: '0.75rem' }}
              required
            />
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
          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '0.65rem', alignItems: 'center' }}>
            {onBackToLanding && (
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
            )}

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
