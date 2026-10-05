import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { User, HelpCircle, LogOut, Menu, RefreshCw } from 'lucide-react';
import { processOfflineQueue, syncAllCloudData } from '../../lib/supabaseService';
import { toast } from 'sonner';

export const Header: React.FC = () => {
  const currentUser = useAppStore(state => state.currentUser);
  const tenant = useAppStore(state => state.tenant);
  const offlineQueue = useAppStore(state => state.offlineQueue) || [];
  const setActiveTab = useAppStore(state => state.setActiveTab);
  const toggleMobileSidebar = useAppStore(state => state.toggleMobileSidebar);
  const logout = useAppStore(state => state.logout);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleStartTour = () => {
    setActiveTab('pos');
    window.dispatchEvent(new CustomEvent('start-onboarding-tour'));
  };

  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    toast.info('Sincronizando operaciones pendientes...');
    try {
      await processOfflineQueue();
      if (tenant?.id) {
        await syncAllCloudData(tenant.id);
      }
      toast.success('Sincronización completada.');
    } catch (err) {
      toast.error('Error al sincronizar datos offline.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <header className="top-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, flexShrink: 1 }}>
        <button
          className="mobile-hamburger-btn"
          onClick={toggleMobileSidebar}
          title="Abrir Menú Principal"
        >
          <Menu size={22} />
        </button>

        {/* Tenant Business Logo or Store Icon */}
        {tenant.logoUrl ? (
          <img
            src={tenant.logoUrl}
            alt={tenant.name}
            style={{ width: '30px', height: '30px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.4)', background: '#ffffff', flexShrink: 0 }}
          />
        ) : (
          <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', flexShrink: 0 }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{tenant.name.charAt(0).toUpperCase()}</span>
          </div>
        )}

        {/* Tenant Name (Prominent & Primary) */}
        <h2 className="header-tenant-name" style={{ fontSize: '1.15rem', color: '#ffffff', fontWeight: 800, margin: 0, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <span>{tenant.name}</span>
        </h2>

        {/* Co-Branding Badge: por MiCuadre */}
        <div className="micuadre-cobrand-badge" title="Sistema Comercial impulsado por MiCuadre POS" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(0,0,0,0.18)', padding: '0.2rem 0.55rem', borderRadius: '9999px', fontSize: '0.72rem', color: '#e2e8f0', fontWeight: 600, border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0 }}>
          <img src="/MiCuadre-logo.png" alt="MiCuadre" style={{ width: '14px', height: '14px', objectFit: 'contain' }} />
          <span className="top-bar-btn-text">por MiCuadre</span>
        </div>
      </div>

      <div className="top-bar-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        {/* Offline Queue Status Badge & Manual Sync Button */}
        {offlineQueue.length > 0 && (
          <button
            className="btn"
            onClick={handleManualSync}
            disabled={isSyncing}
            title="Sincronizar operaciones offline a la nube"
            style={{ padding: '0.45rem 0.65rem', fontSize: '0.82rem', background: '#d97706', color: '#ffffff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            <span>{offlineQueue.length} pendiente{offlineQueue.length > 1 ? 's' : ''} [Sincronizar Ahora]</span>
          </button>
        )}

        {/* Onboarding Tour Trigger */}
        <button
          className="btn"
          onClick={handleStartTour}
          title="Iniciar Tour Guiado"
          style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem', background: 'rgba(255,255,255,0.2)', color: '#ffffff' }}
        >
          <HelpCircle size={16} />
          <span className="top-bar-btn-text">Tour Guiado</span>
        </button>

        {/* Static Active User Display Badge */}
        <div className="user-badge" style={{ padding: '0.35rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.15)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)' }}>
          <div className="status-dot"></div>
          <User size={16} style={{ color: '#ffffff' }} />
          <span className="top-bar-user-name" style={{ color: '#ffffff', fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
            {currentUser?.fullName || 'Usuario'}
          </span>
        </div>

        {/* Logout Button */}
        <button
          className="btn"
          onClick={logout}
          title="Cerrar Sesión"
          style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem', background: '#dc2626', color: '#ffffff' }}
        >
          <LogOut size={16} />
          <span className="top-bar-btn-text">Salir</span>
        </button>
      </div>
    </header>
  );
};
