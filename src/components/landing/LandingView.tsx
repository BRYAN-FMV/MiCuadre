import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Tenant } from '../../types';
import {
  Store, ShoppingBag, Receipt, Calendar, Printer, Lock, Users,
  ArrowRight, Search, Sparkles, Building2, ChevronRight, X, ShieldAlert
} from 'lucide-react';
import { fetchTenantsFromSupabase } from '../../lib/supabaseService';

interface LandingViewProps {
  onSelectStore: (tenant: Tenant) => void;
  onEnterDemo: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ onSelectStore, onEnterDemo }) => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchTenantsFromSupabase().then(cloudTenants => {
      const localTenants = useAppStore.getState().tenants || [];
      const combined = [...(cloudTenants || [])];
      for (const lt of localTenants) {
        if (!combined.some(ct => ct.id === lt.id)) {
          combined.push(lt);
        }
      }
      setTenants(combined);
    });
  }, []);

  const filteredTenants = tenants.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.rtn && t.rtn.includes(searchQuery))
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Navigation Bar */}
      <nav style={{ borderBottom: '1px solid #1e293b', background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src="/MiCuadre-logo.png" alt="MiCuadre Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
            <div>
              <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>MiCuadre<span style={{ color: '#10b981' }}>.app</span></span>
              <span style={{ display: 'block', fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>SISTEMA POS & GESTIÓN DE COMERCIOS</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => setIsSearchModalOpen(true)}
              style={{ background: '#10b981', color: '#ffffff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}
            >
              <Store size={16} />
              <span>Ingresar a mi Comercio</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{ padding: '4rem 1.5rem 4rem 1.5rem', textAlign: 'center', maxWidth: '850px', margin: '0 auto' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.35rem 0.9rem', borderRadius: '50px', fontSize: '0.82rem', color: '#34d399', fontWeight: 600, marginBottom: '1.5rem' }}>
          <Sparkles size={15} />
          <span>Plataforma de Control Comercial & Cumplimiento SAR en Honduras</span>
        </div>

        <h1 style={{ fontSize: '2.6rem', fontWeight: 900, lineHeight: 1.18, color: '#ffffff', marginBottom: '1.25rem', letterSpacing: '-0.03em' }}>
          Sistema POS, Inventario y Control Financiero para <span style={{ color: '#10b981' }}>tu Comercio</span>
        </h1>

        <p style={{ fontSize: '1.1rem', color: '#94a3b8', lineHeight: 1.6, marginBottom: '2.5rem', maxWidth: '700px', margin: '0 auto 2.5rem auto' }}>
          MiCuadre permite gestionar ventas en punto de venta, inventario con Kardex CPP, cierres ciegos de caja e impresión térmica fiscal de 58mm en un solo entorno seguro.
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1rem' }}>
          <button
            onClick={() => setIsSearchModalOpen(true)}
            style={{ background: '#10b981', color: '#ffffff', border: 'none', padding: '0.85rem 1.8rem', borderRadius: '10px', fontSize: '1rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem', boxShadow: '0 10px 25px rgba(16, 185, 129, 0.35)' }}
          >
            <Store size={18} />
            <span>Ingresar a mi Comercio</span>
            <ArrowRight size={18} />
          </button>

          <button
            onClick={onEnterDemo}
            style={{ background: '#1e293b', color: '#f8fafc', border: '1px solid #334155', padding: '0.85rem 1.8rem', borderRadius: '10px', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem' }}
          >
            <Building2 size={18} style={{ color: '#34d399' }} />
            <span>Probar Comercio Demo</span>
          </button>
        </div>
      </section>

      {/* Feature Grid */}
      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 1.5rem 4rem 1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>

          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '1.5rem' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', width: '42px', height: '42px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', marginBottom: '1rem' }}>
              <ShoppingBag size={22} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.4rem' }}>Punto de Venta Rápido</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.5 }}>
              Facturación al detalle y mayoreo, búsqueda por lector de código de barras y retención de pedidos en espera.
            </p>
          </div>

          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '1.5rem' }}>
            <div style={{ background: 'rgba(59, 130, 246, 0.15)', width: '42px', height: '42px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa', marginBottom: '1rem' }}>
              <Receipt size={22} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.4rem' }}>Cumplimiento SAR Honduras</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.5 }}>
              Control correlativo de facturación, CAI, fecha límite de emisión y desglose automático de impuestos (15%, 18%, exento).
            </p>
          </div>

          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '1.5rem' }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', width: '42px', height: '42px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24', marginBottom: '1rem' }}>
              <Printer size={22} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.4rem' }}>Impresión Térmica & Gaveta</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.5 }}>
              Formato fiscal optimizado para papel de 58mm y apertura automática de gaveta monedero mediante pulso RJ11.
            </p>
          </div>

          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '1.5rem' }}>
            <div style={{ background: 'rgba(168, 85, 247, 0.15)', width: '42px', height: '42px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c084fc', marginBottom: '1rem' }}>
              <Lock size={22} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.4rem' }}>Cierres Ciegos de Caja</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.5 }}>
              Arqueos de caja donde el cajero declara el efectivo sin ver los totales del sistema para evitar faltantes.
            </p>
          </div>

          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '1.5rem' }}>
            <div style={{ background: 'rgba(236, 72, 153, 0.15)', width: '42px', height: '42px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f472b6', marginBottom: '1rem' }}>
              <Calendar size={22} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.4rem' }}>Calendario & Fiados</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.5 }}>
              Gestión de facturas de proveedores a crédito, alertas de vencimientos de CAI y libreta de cuentas por cobrar.
            </p>
          </div>

          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '1.5rem' }}>
            <div style={{ background: 'rgba(20, 184, 166, 0.15)', width: '42px', height: '42px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2dd4bf', marginBottom: '1rem' }}>
              <Users size={22} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.4rem' }}>Multi-Usuario con PIN</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.5 }}>
              Ingreso rápido para cajeros con PIN de 4 dígitos y protección de pestañas según rol de usuario.
            </p>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #1e293b', padding: '2rem 1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
        <p>© {new Date().getFullYear()} MiCuadre.app - Todos los derechos reservados.</p>
        <p style={{ marginTop: '0.5rem' }}>
          <a
            href="?admin=true"
            onClick={(e) => {
              e.preventDefault();
              window.history.pushState({}, '', '/admin');
              window.dispatchEvent(new Event('popstate'));
            }}
            style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <ShieldAlert size={14} style={{ color: '#10b981' }} />
            <span>Acceso Administrador de Plataforma SaaS (/admin)</span>
          </a>
        </p>
      </footer>

      {/* MODAL: Ingresar a mi Comercio */}
      {isSearchModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', zIndex: 50 }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', width: '100%', maxWidth: '480px', padding: '1.75rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <Store size={20} style={{ color: '#10b981' }} />
                <span>Selecciona tu Comercio</span>
              </h3>
              <button onClick={() => setIsSearchModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <input
                type="text"
                placeholder="Escribe el nombre de tu comercio o RTN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#ffffff', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: '8px', fontSize: '0.95rem', outline: 'none' }}
                autoFocus
              />
              <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            </div>

            <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {filteredTenants.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem 0', fontSize: '0.9rem' }}>No se encontraron comercios con ese nombre.</p>
              ) : (
                filteredTenants.map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setIsSearchModalOpen(false);
                      onSelectStore(t);
                    }}
                    style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '0.85rem 1rem', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                  >
                    <div>
                      <h4 style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.95rem', margin: 0 }}>{t.name}</h4>
                      {t.rtn && <p style={{ color: '#64748b', fontSize: '0.75rem', margin: '0.2rem 0 0 0' }}>RTN: {t.rtn}</p>}
                    </div>
                    <ChevronRight size={18} style={{ color: '#10b981' }} />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
