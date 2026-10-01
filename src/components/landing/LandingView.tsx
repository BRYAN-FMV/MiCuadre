import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Tenant } from '../../types';
import {
  Store, ShoppingBag, Receipt, Calendar, CreditCard, ShieldCheck,
  Printer, Users, ArrowRight, PlusCircle, Search, CheckCircle,
  Sparkles, Building2, Lock, ChevronRight, X
} from 'lucide-react';
import { fetchTenantsFromSupabase } from '../../lib/supabaseService';
import { generateUUID } from '../../lib/security';
import { toast } from 'sonner';

interface LandingViewProps {
  onSelectStore: (tenant: Tenant) => void;
  onEnterDemo: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ onSelectStore, onEnterDemo }) => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form states for creating a new business
  const [newStoreName, setNewStoreName] = useState('');
  const [newBusinessType, setNewBusinessType] = useState<'RETAIL' | 'SERVICES' | 'WHOLESALE' | 'MIXED'>('RETAIL');
  const [newRtn, setNewRtn] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const addTenant = useAppStore(state => state.addTenant);

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

  const handleCreateStoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim()) {
      toast.error('Ingresa el nombre de tu comercio');
      return;
    }

    const newSlug = newStoreName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const newTenant: Tenant = {
      id: generateUUID(),
      name: newStoreName.trim(),
      businessType: newBusinessType,
      rtn: newRtn.trim() || undefined,
      phone: newPhone.trim() || undefined,
      isFiscalEnabled: true,
      allowNegativeStock: false,
      currencySymbol: 'L.'
    };

    addTenant(newTenant);
    toast.success(`¡Comercio "${newTenant.name}" creado exitosamente!`);
    setIsCreateModalOpen(false);

    // Update URL to match store
    window.history.pushState({}, '', `/?tienda=${newSlug}`);
    onSelectStore(newTenant);
  };

  const filteredTenants = tenants.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.rtn && t.rtn.includes(searchQuery))
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Navigation Bar */}
      <nav style={{ borderBottom: '1px solid #1e293b', background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src="/MiCuadre-logo.png" alt="MiCuadre Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
            <div>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>MiCuadre<span style={{ color: '#10b981' }}>.app</span></span>
              <span style={{ display: 'block', fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>SISTEMA POS & GESTIÓN DE COMERCIOS</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => setIsSearchModalOpen(true)}
              style={{ background: '#1e293b', color: '#cbd5e1', border: '1px solid #334155', padding: '0.55rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Search size={16} />
              <span>Buscar mi Comercio</span>
            </button>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              style={{ background: '#10b981', color: '#ffffff', border: 'none', padding: '0.55rem 1.1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}
            >
              <PlusCircle size={16} />
              <span>Crear mi Comercio</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{ padding: '4rem 1.5rem 5rem 1.5rem', textAlign: 'center', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.35rem 0.9rem', borderRadius: '50px', fontSize: '0.82rem', color: '#34d399', fontWeight: 600, marginBottom: '1.5rem' }}>
          <Sparkles size={15} />
          <span>Diseñado para Pulperías, Mercaditos, Ferreterías & Servicios en Honduras</span>
        </div>

        <h1 style={{ fontSize: '2.8rem', fontWeight: 900, lineHeight: 1.15, color: '#ffffff', marginBottom: '1.25rem', letterSpacing: '-0.03em' }}>
          Controla tu negocio con un POS <span style={{ color: '#10b981', textDecoration: 'underline', textDecorationColor: '#059669' }}>rápido, sencillo y cumpliendo con el SAR</span>.
        </h1>

        <p style={{ fontSize: '1.15rem', color: '#94a3b8', lineHeight: 1.6, marginBottom: '2.5rem', maxWidth: '750px', margin: '0 auto 2.5rem auto' }}>
          Administra tus productos, ventas en punto de venta, compras a proveedores, cierres de caja ciegos, imprime facturas fiscales comerciales de 58mm y lleva tu calendario de pagos en un solo lugar.
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1rem' }}>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            style={{ background: '#10b981', color: '#ffffff', border: 'none', padding: '0.9rem 2rem', borderRadius: '10px', fontSize: '1rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem', boxShadow: '0 10px 25px rgba(16, 185, 129, 0.35)', transition: 'all 0.2s' }}
          >
            <span>Crear mi Comercio Gratis</span>
            <ArrowRight size={18} />
          </button>

          <button
            onClick={onEnterDemo}
            style={{ background: '#1e293b', color: '#f8fafc', border: '1px solid #334155', padding: '0.9rem 2rem', borderRadius: '10px', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem' }}
          >
            <Building2 size={18} style={{ color: '#34d399' }} />
            <span>Probar Comercio Demo</span>
          </button>
        </div>
      </section>

      {/* Feature Grid */}
      <section style={{ maxWidth: '1140px', margin: '0 auto', padding: '0 1.5rem 5rem 1.5rem' }}>
        <h2 style={{ textAlign: 'center', fontSize: '1.8rem', fontWeight: 800, color: '#ffffff', marginBottom: '2.5rem' }}>
          Todo lo que tu comercio necesita en una sola plataforma
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>

          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '1.75rem' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', width: '48px', height: '48px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', marginBottom: '1.25rem' }}>
              <ShoppingBag size={24} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.5rem' }}>Punto de Venta Ultra-Rápido</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.5 }}>
              Busca productos por lector de código de barras o teclado. Permite venta al detalle o mayoreo automatizado, descuentos y retención de pedidos en espera.
            </p>
          </div>

          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '1.75rem' }}>
            <div style={{ background: 'rgba(59, 130, 246, 0.15)', width: '48px', height: '48px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa', marginBottom: '1.25rem' }}>
              <Receipt size={24} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.5rem' }}>Cumplimiento SAR Honduras</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.5 }}>
              Control de rango correlativo de facturas, CAI, fecha límite de emisión, desglose de impuesto 15%, 18% e ítems exentos y exonerados.
            </p>
          </div>

          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '1.75rem' }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', width: '48px', height: '48px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24', marginBottom: '1.25rem' }}>
              <Printer size={24} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.5rem' }}>Impresoras Térmicas & Gaveta</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.5 }}>
              Formato de factura estilizado en papel térmico de 58mm (48mm imprimible), escalado de alta legibilidad y apertura de cajón monedero vía pulso RJ11.
            </p>
          </div>

          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '1.75rem' }}>
            <div style={{ background: 'rgba(168, 85, 247, 0.15)', width: '48px', height: '48px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c084fc', marginBottom: '1.25rem' }}>
              <Lock size={24} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.5rem' }}>Cierres Ciegos de Caja</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.5 }}>
              Control estricto de turnos. El cajero ingresa el efectivo contado sin ver los totales del sistema para prevenir diferencias y fuga de caja.
            </p>
          </div>

          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '1.75rem' }}>
            <div style={{ background: 'rgba(236, 72, 153, 0.15)', width: '48px', height: '48px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f472b6', marginBottom: '1.25rem' }}>
              <Calendar size={24} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.5rem' }}>Calendario Financiero & Fiados</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.5 }}>
              Control de facturas a crédito de proveedores, alertas de vencimiento de CAI y cuaderno digital de clientes con crédito (fiados).
            </p>
          </div>

          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '1.75rem' }}>
            <div style={{ background: 'rgba(20, 184, 166, 0.15)', width: '48px', height: '48px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2dd4bf', marginBottom: '1.25rem' }}>
              <Users size={24} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.5rem' }}>Multi-Usuario & PIN Rápido</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.5 }}>
              Acceso rápido para cajeros mediante PIN de 4 dígitos, restricción de pestañas administrativas y roles de Administrador, Cajero y Bodeguero.
            </p>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #1e293b', padding: '2rem 1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
        <p>© {new Date().getFullYear()} MiCuadre.app - Todos los derechos reservados. Sistema POS Multi-Tenant SaaS.</p>
        <p style={{ marginTop: '0.5rem' }}>
          <a href="/admin" style={{ color: '#94a3b8', textDecoration: 'underline', fontSize: '0.78rem' }}>Acceso SuperAdmin (/admin)</a>
        </p>
      </footer>

      {/* MODAL: Buscar / Ingresar a mi Comercio */}
      {isSearchModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', zIndex: 50 }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', width: '100%', maxWidth: '480px', padding: '1.75rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <Search size={20} style={{ color: '#10b981' }} />
                <span>Buscar mi Comercio</span>
              </h3>
              <button onClick={() => setIsSearchModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <input
              type="text"
              placeholder="Escribe el nombre de tu tienda o RTN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#ffffff', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.95rem', marginBottom: '1rem', outline: 'none' }}
              autoFocus
            />

            <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
                    style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '0.85rem 1rem', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.15s' }}
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

      {/* MODAL: Crear mi Comercio */}
      {isCreateModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', zIndex: 50 }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', width: '100%', maxWidth: '480px', padding: '1.75rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <PlusCircle size={20} style={{ color: '#10b981' }} />
                <span>Registrar Nuevo Comercio</span>
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateStoreSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '0.35rem' }}>Nombre de tu Negocio *</label>
                <input
                  type="text"
                  placeholder="Ej. Pulpería San José, Super Abarrotes El Sol"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#ffffff', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.95rem', outline: 'none' }}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '0.35rem' }}>Tipo de Negocio</label>
                <select
                  value={newBusinessType}
                  onChange={(e: any) => setNewBusinessType(e.target.value)}
                  style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#ffffff', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.95rem', outline: 'none' }}
                >
                  <option value="RETAIL">Venta al Detalle / Pulpería / Mercadito</option>
                  <option value="WHOLESALE">Venta al Mayoreo</option>
                  <option value="SERVICES">Barbería / Salón / Servicios</option>
                  <option value="MIXED">Mixto (Productos + Servicios)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '0.35rem' }}>RTN (Opcional)</label>
                  <input
                    type="text"
                    placeholder="0801199..."
                    value={newRtn}
                    onChange={(e) => setNewRtn(e.target.value)}
                    style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#ffffff', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.95rem', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '0.35rem' }}>Teléfono (Opcional)</label>
                  <input
                    type="text"
                    placeholder="9988-7766"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#ffffff', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.95rem', outline: 'none' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                style={{ background: '#10b981', color: '#ffffff', border: 'none', padding: '0.85rem', borderRadius: '8px', fontSize: '1rem', fontWeight: 800, cursor: 'pointer', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                <span>Crear mi Comercio e Iniciar</span>
                <ArrowRight size={18} />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
