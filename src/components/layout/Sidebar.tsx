import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ShoppingCart, Package, Truck, Calendar, Scissors, Settings, Lock, BarChart3, X, Key, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { updateProfilePinInSupabase } from '../../lib/supabaseService';

export const Sidebar: React.FC = () => {
  const activeTab = useAppStore(state => state.activeTab);
  const setActiveTab = useAppStore(state => state.setActiveTab);
  const tenant = useAppStore(state => state.tenant);
  const activeShift = useAppStore(state => state.activeShift);
  const isMobileSidebarOpen = useAppStore(state => state.isMobileSidebarOpen);
  const setMobileSidebarOpen = useAppStore(state => state.setMobileSidebarOpen);

  const currentUser = useAppStore(state => state.currentUser);
  const role = currentUser?.role || 'ADMIN';

  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [newPinCode, setNewPinCode] = useState('');

  const handleUpdateCurrentPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPinCode.length !== 4) {
      toast.error('El PIN debe contener exactamente 4 dígitos');
      return;
    }

    const res = await updateProfilePinInSupabase(currentUser, newPinCode);

    if (res.success) {
      useAppStore.setState(state => ({
        currentUser: res.profile,
        profiles: state.profiles.map(p => p.id === currentUser.id || p.id === res.profile.id ? res.profile : p)
      }));
      toast.success(`PIN de ${res.profile.fullName} actualizado con éxito`);
    } else {
      toast.error(`Error actualizando PIN: ${res.error}`);
    }

    setIsPinModalOpen(false);
    setNewPinCode('');
  };

  const navItems = [
    { id: 'pos', label: 'Ventas', icon: ShoppingCart, show: role === 'ADMIN' || role === 'CAJERO' || role === 'STAFF' },
    { id: 'inventory', label: 'Inventario', icon: Package, show: true },
    { id: 'purchases', label: 'Compras', icon: Truck, show: role === 'ADMIN' || role === 'BODEGUERO' },
    { id: 'accounts', label: 'Cuentas / Fiados', icon: BookOpen, show: role === 'ADMIN' || role === 'CAJERO' },
    { id: 'services', label: 'Servicios', icon: Scissors, show: (tenant.businessType === 'SERVICES' || tenant.businessType === 'MIXED') && (role === 'ADMIN' || role === 'STAFF' || role === 'CAJERO') },
    { id: 'calendar', label: 'Calendario', icon: Calendar, show: role === 'ADMIN' },
    { id: 'reports', label: 'Reportes', icon: BarChart3, show: role === 'ADMIN' },
    { id: 'settings', label: 'Configuración', icon: Settings, show: role === 'ADMIN' }
  ].filter(item => item.show);

  const isShiftOpen = activeShift && activeShift.tenantId === tenant.id && activeShift.status === 'OPEN';

  return (
    <>
      <div
        className={`mobile-sidebar-backdrop ${isMobileSidebarOpen ? 'open' : ''}`}
        onClick={() => setMobileSidebarOpen(false)}
      />

      <aside className={`sidebar ${isMobileSidebarOpen ? 'open' : ''}`}>
        <div className="brand-header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <img src="/MiCuadre-logo.png" alt="MiCuadre Logo" className="brand-logo-img" style={{ objectFit: 'contain' }} />
            <div>
              <h1 className="brand-title">MiCuadre</h1>
            </div>
          </div>

          <button
            className="mobile-close-btn"
            onClick={() => setMobileSidebarOpen(false)}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: '0.25rem'
            }}
            title="Cerrar Menú"
          >
            <X size={20} />
          </button>
        </div>

        {/* Business and Profile Info Card */}
        <div style={{ padding: '0.65rem 0.85rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
          <p style={{ fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>{tenant.name}</p>

          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span className="badge badge-wholesale">
                {tenant.businessType === 'RETAIL' ? 'Retail' : tenant.businessType === 'SERVICES' ? 'Servicios' : 'Mixto'}
              </span>
              <span className="badge badge-success" style={{ background: role === 'ADMIN' ? '#dcfce7' : '#e0f2fe', color: role === 'ADMIN' ? '#15803d' : '#0369a1', border: '1px solid #bae6fd' }}>
                {role === 'ADMIN' ? 'Admin' : role === 'CAJERO' ? 'Cajero' : role === 'BODEGUERO' ? 'Bodeguero' : 'Staff'}
              </span>
            </div>

            <button
              onClick={() => {
                setNewPinCode(currentUser?.pinCode || '');
                setIsPinModalOpen(true);
              }}
              title="Cambiar mi PIN de Acceso"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
                fontSize: '0.72rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.25rem 0.45rem',
                borderRadius: '4px',
                fontWeight: 600,
                transition: 'all 0.2s ease'
              }}
            >
              <Key size={12} />
              <span>PIN</span>
            </button>
          </div>
        </div>

        {/* Main Navigation */}
        <nav style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <ul className="nav-list">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <li
                  key={item.id}
                  id={`nav-${item.id}`}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab(item.id as any);
                    setMobileSidebarOpen(false);
                  }}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Cash Shift Status Footer Card */}
        <div className="glass-panel" style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Lock size={12} /> Estado de Caja:
            </span>
            {isShiftOpen ? (
              <span className="badge badge-success">ABIERTA</span>
            ) : (
              <span className="badge badge-danger">CERRADA</span>
            )}
          </div>

          {isShiftOpen && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
              Apertura: {tenant.currencySymbol} {activeShift.openingAmount.toFixed(2)}
            </p>
          )}

          <button
            className="btn"
            onClick={() => useAppStore.setState({ isShiftModalOpen: true })}
            title={isShiftOpen ? 'Arqueo & Cierre Z' : 'Abrir Turno Caja'}
            style={{
              width: '100%',
              marginTop: '0.25rem',
              padding: '0.45rem 0.5rem',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              background: isShiftOpen ? '#ef4444' : '#059669',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Lock size={14} />
            <span>{isShiftOpen ? 'Arqueo & Cierre Z' : 'Abrir Turno'}</span>
          </button>
        </div>
      </aside>

      {/* QUICK CHANGE PIN MODAL */}
      {isPinModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <h3 style={{ color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Key size={20} style={{ color: 'var(--accent-primary)' }} />
              Cambiar mi PIN / Contraseña
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Usuario actual: <strong>{currentUser?.fullName}</strong> ({currentUser?.role})
            </p>

            <form onSubmit={handleUpdateCurrentPin} style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Nuevo PIN de Acceso (4 dígitos) *</label>
                <input
                  type="password"
                  maxLength={4}
                  className="input-control"
                  value={newPinCode}
                  onChange={(e) => setNewPinCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="1234"
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsPinModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar PIN</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
