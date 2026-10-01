import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Tenant } from '../../types';
import {
  Store, ShoppingBag, Receipt, Calendar, Printer, Lock, Users,
  ArrowRight, Search, Sparkles, Building2, ChevronRight, X, ShieldAlert,
  CheckCircle2, AlertCircle, HelpCircle, FileText, ChevronDown, Star
} from 'lucide-react';
import { fetchTenantsFromSupabase } from '../../lib/supabaseService';
import { toast } from 'sonner';

interface LandingViewProps {
  onSelectStore: (tenant: Tenant) => void;
  onEnterDemo: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ onSelectStore, onEnterDemo }) => {
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [storeInput, setStoreInput] = useState('');
  const [activeFaqIndex, setActiveFaqIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setActiveFaqIndex(activeFaqIndex === index ? null : index);
  };

  const handleAccessStoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeInput.trim()) {
      toast.error('Ingresa el nombre o código de tu comercio');
      return;
    }

    const cleanInput = storeInput.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

    fetchTenantsFromSupabase().then(cloudTenants => {
      const localTenants = useAppStore.getState().tenants || [];
      const allTenants = [...(cloudTenants || [])];
      for (const lt of localTenants) {
        if (!allTenants.some(ct => ct.id === lt.id)) {
          allTenants.push(lt);
        }
      }

      const matched = allTenants.find(t =>
        t.id === storeInput.trim() ||
        t.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(cleanInput) ||
        t.name.toLowerCase().includes(storeInput.trim().toLowerCase())
      );

      if (matched) {
        setIsAccessModalOpen(false);
        const slug = matched.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        window.history.pushState({}, '', `/?comercio=${slug}`);
        onSelectStore(matched);
      } else {
        toast.error(`No se encontró el comercio "${storeInput}". Verifica el nombre o enlace proporcionado por tu administrador.`);
      }
    });
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* 1. Header / Navigation Bar */}
      <nav style={{ borderBottom: '1px solid #e2e8f0', background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '0.85rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src="/MiCuadre-logo.png" alt="MiCuadre Logo" style={{ width: '42px', height: '42px', objectFit: 'contain' }} />
            <div>
              <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em' }}>
                MiCuadre<span style={{ color: '#059669' }}>.app</span>
              </span>
              <span style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.04em' }}>
                POS & CONTROL COMERCIAL HONDURAS
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <button
              onClick={onEnterDemo}
              style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '0.55rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Building2 size={16} style={{ color: '#059669' }} />
              <span>Ver Demo</span>
            </button>

            <button
              onClick={() => setIsAccessModalOpen(true)}
              style={{ background: '#059669', color: '#ffffff', border: 'none', padding: '0.6rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 800, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 14px rgba(5, 150, 105, 0.25)' }}
            >
              <Store size={16} />
              <span>Ingresar a mi Comercio</span>
            </button>
          </div>
        </div>
      </nav>

      {/* 2. HERO SECTION (Above the fold) */}
      <section style={{ padding: '4.5rem 1.5rem 4rem 1.5rem', textAlign: 'center', maxWidth: '920px', margin: '0 auto' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '0.4rem 1rem', borderRadius: '50px', fontSize: '0.84rem', color: '#047857', fontWeight: 700, marginBottom: '1.5rem' }}>
          <Sparkles size={16} />
          <span>Hecho para pulperías, mercaditos, ferreterías y servicios en Honduras</span>
        </div>

        <h1 style={{ fontSize: '3rem', fontWeight: 900, lineHeight: 1.15, color: '#0f172a', marginBottom: '1.25rem', letterSpacing: '-0.035em' }}>
          El punto de venta e inventario que hace que tu negocio <span style={{ color: '#059669', borderBottom: '3px solid #10b981' }}>cuadre al centavo</span>
        </h1>

        <p style={{ fontSize: '1.15rem', color: '#475569', lineHeight: 1.6, marginBottom: '2.5rem', maxWidth: '760px', margin: '0 auto 2.5rem auto' }}>
          Di adiós a los descuadres de dinero en caja, cuadernos de fiados perdidos y preocupaciones con el CAI del SAR. Factura rápido, controla tu stock e imprime tus comprobantes de venta.
        </p>

        {/* Action CTAs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
          <button
            onClick={() => setIsAccessModalOpen(true)}
            style={{ background: '#059669', color: '#ffffff', border: 'none', padding: '0.95rem 2.2rem', borderRadius: '12px', fontSize: '1.05rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.65rem', boxShadow: '0 12px 24px rgba(5, 150, 105, 0.3)' }}
          >
            <Store size={20} />
            <span>Ingresar a mi Comercio</span>
            <ArrowRight size={20} />
          </button>

          <button
            onClick={onEnterDemo}
            style={{ background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', padding: '0.95rem 2rem', borderRadius: '12px', fontSize: '1.05rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.65rem', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}
          >
            <Building2 size={20} style={{ color: '#059669' }} />
            <span>Probar Comercio Demo</span>
          </button>
        </div>

        {/* Value Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1.25rem', color: '#475569', fontSize: '0.88rem', fontWeight: 700 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <CheckCircle2 size={17} style={{ color: '#059669' }} /> Facturación Fiscal SAR 100%
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <CheckCircle2 size={17} style={{ color: '#059669' }} /> Cierres Ciegos de Caja
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <CheckCircle2 size={17} style={{ color: '#059669' }} /> Impresión Térmica & Gaveta
          </span>
        </div>
      </section>

      {/* 3. TRUST & COMPLIANCE BAR */}
      <section style={{ background: '#ffffff', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: '1.75rem 1.5rem', textAlign: 'center' }}>
        <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1.25rem' }}>
          ADAPTADO A LA NORMATIVA Y OPERATIVIDAD COMERCIAL DE HONDURAS
        </p>

        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#334155', fontWeight: 800, fontSize: '0.95rem' }}>
            <Receipt size={20} style={{ color: '#059669' }} />
            <span>Cumplimiento SAR Honduras (CAI)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#334155', fontWeight: 800, fontSize: '0.95rem' }}>
            <Printer size={20} style={{ color: '#0284c7' }} />
            <span>Impresión Térmica + Gaveta RJ11</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#334155', fontWeight: 800, fontSize: '0.95rem' }}>
            <Lock size={20} style={{ color: '#d97706' }} />
            <span>Kardex Costo Promedio (CPP)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#334155', fontWeight: 800, fontSize: '0.95rem' }}>
            <Users size={20} style={{ color: '#7c3aed' }} />
            <span>Acceso Cajero con PIN 4 Dígitos</span>
          </div>
        </div>
      </section>

      {/* 4. PROBLEM / AGITATION SECTION */}
      <section style={{ padding: '4.5rem 1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            LOS RETOS DEL DÍA A DÍA
          </span>
          <h2 style={{ fontSize: '2.1rem', fontWeight: 900, color: '#0f172a', marginTop: '0.35rem' }}>
            ¿Te identificas con alguno de estos dolores de cabeza?
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
          
          <div style={{ background: '#ffffff', border: '1px solid #fecdd3', borderRadius: '16px', padding: '1.75rem', boxShadow: '0 4px 16px rgba(225, 29, 72, 0.05)' }}>
            <div style={{ background: '#ffe4e6', width: '44px', height: '44px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e11d48', marginBottom: '1rem' }}>
              <AlertCircle size={22} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Fuga de dinero en caja</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.55 }}>
              Al cerrar el turno falta dinero en el cajón y no sabes en qué venta se cometió el error ni quién fue responsable.
            </p>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #fed7aa', borderRadius: '16px', padding: '1.75rem', boxShadow: '0 4px 16px rgba(217, 119, 6, 0.05)' }}>
            <div style={{ background: '#ffedd5', width: '44px', height: '44px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706', marginBottom: '1rem' }}>
              <Receipt size={22} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Preocupación por el CAI del SAR</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.55 }}>
              Miedo a que se venza la fecha límite de emisión de facturas o se agote el rango correlativo sin haber gestionado la nueva autorización.
            </p>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e9d5ff', borderRadius: '16px', padding: '1.75rem', boxShadow: '0 4px 16px rgba(147, 51, 234, 0.05)' }}>
            <div style={{ background: '#f3e8ff', width: '44px', height: '44px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9333ea', marginBottom: '1rem' }}>
              <Calendar size={22} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Cuadernos de fiados perdidos</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.55 }}>
              Anotar ventas a crédito en libretas de papel que se extravían, se mojan o donde olvidas cobrar los abonos pendientes.
            </p>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '1.75rem', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)' }}>
            <div style={{ background: '#f1f5f9', width: '44px', height: '44px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', marginBottom: '1rem' }}>
              <ShoppingBag size={22} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Comprar inventario a ciegas</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.55 }}>
              Quedarte sin los productos que más vendes por falta de stock o comprar mercadería en exceso que se queda estancada.
            </p>
          </div>

        </div>
      </section>

      {/* 5. SOLUTION SECTION */}
      <section style={{ background: '#ffffff', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: '4.5rem 1.5rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '3rem', alignItems: 'center' }}>
          
          <div>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              LA SOLUCIÓN DEFINITIVA
            </span>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#0f172a', marginTop: '0.35rem', marginBottom: '1.25rem', lineHeight: 1.2 }}>
              MiCuadre ordena tu negocio y te devuelve la tranquilidad
            </h2>
            <p style={{ color: '#475569', fontSize: '1rem', lineHeight: 1.6, marginBottom: '1.75rem' }}>
              Diseñado desde cero pensando en la realidad de los comerciantes en Honduras. Sin complicaciones técnicas, con una interfaz clara y rápida.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{ background: '#ecfdf5', padding: '0.35rem', borderRadius: '6px', color: '#059669', marginTop: '0.15rem' }}>
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Cierres ciegos sin trampas</h4>
                  <p style={{ fontSize: '0.88rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>El cajero cuenta el efectivo sin ver los totales del sistema para un arqueo 100% transparente.</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{ background: '#ecfdf5', padding: '0.35rem', borderRadius: '6px', color: '#059669', marginTop: '0.15rem' }}>
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Alertas de CAI y vencimientos SAR</h4>
                  <p style={{ fontSize: '0.88rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>El sistema te avisa cuando tu autorización fiscal o tus correlativos estén próximos a agotarse.</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{ background: '#ecfdf5', padding: '0.35rem', borderRadius: '6px', color: '#059669', marginTop: '0.15rem' }}>
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Factura Térmica en 3 segundos</h4>
                  <p style={{ fontSize: '0.88rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>Imprime tus comprobantes de venta y abre el cajón monedero automáticamente.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Metric Preview Card */}
          <div style={{ background: '#0f172a', borderRadius: '20px', padding: '2rem', color: '#ffffff', boxShadow: '0 20px 40px rgba(15, 23, 42, 0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '1.25rem', borderBottom: '1px solid #334155' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <img src="/MiCuadre-logo.png" alt="Logo" style={{ width: '32px', height: '32px' }} />
                <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>MiCuadre Dashboard</span>
              </div>
              <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontSize: '0.75rem', fontWeight: 800, padding: '0.25rem 0.65rem', borderRadius: '50px' }}>🟢 En Vivo</span>
            </div>

            <div style={{ padding: '1.5rem 0' }}>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Resumen de Ventas de Hoy</p>
              <h3 style={{ fontSize: '2.4rem', fontWeight: 900, color: '#34d399', margin: '0.25rem 0 1rem 0' }}>L. 8,450.00</h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '10px', border: '1px solid #334155' }}>
                  <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: 0 }}>Estado de Caja</p>
                  <p style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff', margin: '0.2rem 0 0 0' }}>Cuadrada 100%</p>
                </div>
                <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '10px', border: '1px solid #334155' }}>
                  <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: 0 }}>CAI SAR Autorizado</p>
                  <p style={{ fontSize: '0.95rem', fontWeight: 800, color: '#38bdf8', margin: '0.2rem 0 0 0' }}>Al día (4,120 disps)</p>
                </div>
              </div>
            </div>

            <button
              onClick={onEnterDemo}
              style={{ width: '100%', background: '#059669', color: '#ffffff', border: 'none', padding: '0.8rem', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              <span>Probar este panel interactivo</span>
              <ArrowRight size={16} />
            </button>
          </div>

        </div>
      </section>

      {/* 6. FEATURES & BENEFITS SECTION */}
      <section style={{ padding: '4.5rem 1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            CARACTERÍSTICAS Y BENEFICIOS
          </span>
          <h2 style={{ fontSize: '2.1rem', fontWeight: 900, color: '#0f172a', marginTop: '0.35rem' }}>
            Todo lo necesario para hacer crecer tu comercio
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.75rem' }}>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.75rem', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <div style={{ background: '#ecfdf5', width: '44px', height: '44px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669', marginBottom: '1.25rem' }}>
              <ShoppingBag size={22} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem' }}>POS y Precios al Mayoreo</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.55 }}>
              Facturación en segundos al detalle o aplica escalas de descuento automático al mayoreo por cantidad comprada.
            </p>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.75rem', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <div style={{ background: '#e0f2fe', width: '44px', height: '44px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7', marginBottom: '1.25rem' }}>
              <Printer size={22} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem' }}>Impresión Térmica & Gaveta Monedero</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.55 }}>
              Facturación comercial y fiscal optimizada para impresoras térmicas con apertura automática de cajón monedero.
            </p>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.75rem', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <div style={{ background: '#fef3c7', width: '44px', height: '44px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706', marginBottom: '1.25rem' }}>
              <Lock size={22} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem' }}>Control Ciego de Turnos</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.55 }}>
              Apertura y cierre de caja donde el empleado declara el dinero contado a ciegas para evitar manipulaciones.
            </p>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.75rem', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <div style={{ background: '#f3e8ff', width: '44px', height: '44px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9333ea', marginBottom: '1.25rem' }}>
              <Calendar size={22} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem' }}>Calendario Financiero & Cuentas</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.55 }}>
              Control de facturas a crédito de proveedores, fechas de pago y libreta digital de créditos (fiados) a clientes.
            </p>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.75rem', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <div style={{ background: '#ccfbf1', width: '44px', height: '44px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0d9488', marginBottom: '1.25rem' }}>
              <FileText size={22} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem' }}>Kardex & Costo Promedio (CPP)</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.55 }}>
              Monitorea las entradas y salidas de inventario recalculando tu costo de compra verdadero en tiempo real.
            </p>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.75rem', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <div style={{ background: '#ffe4e6', width: '44px', height: '44px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e11d48', marginBottom: '1.25rem' }}>
              <Users size={22} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem' }}>Multiusuario & PIN de Seguridad</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.55 }}>
              Roles protegidos para Administradores, Cajeros y Bodegueros con inicio de sesión ultra rápido por PIN.
            </p>
          </div>

        </div>
      </section>

      {/* 7. HOW IT WORKS SECTION (3 Steps) */}
      <section style={{ background: '#ffffff', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: '4.5rem 1.5rem', textAlign: 'center' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            PASO A PASO
          </span>
          <h2 style={{ fontSize: '2.1rem', fontWeight: 900, color: '#0f172a', marginTop: '0.35rem', marginBottom: '3rem' }}>
            ¿Cómo empiezas a usar MiCuadre?
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '2rem' }}>
            
            <div style={{ position: 'relative' }}>
              <div style={{ background: '#ecfdf5', border: '2px solid #059669', width: '50px', height: '50px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.25rem', color: '#059669', margin: '0 auto 1.25rem auto' }}>
                1
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Accedes con tu enlace exclusivo</h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5 }}>
                Tu comercio cuenta con un enlace personalizado (ej: micuadre.app/?comercio=tu-negocio) configurado por tu administrador.
              </p>
            </div>

            <div style={{ position: 'relative' }}>
              <div style={{ background: '#ecfdf5', border: '2px solid #059669', width: '50px', height: '50px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.25rem', color: '#059669', margin: '0 auto 1.25rem auto' }}>
                2
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Ingresas con tu PIN</h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5 }}>
                Cada usuario o cajero selecciona su perfil e ingresa su clave PIN de 4 dígitos de forma segura.
              </p>
            </div>

            <div style={{ position: 'relative' }}>
              <div style={{ background: '#ecfdf5', border: '2px solid #059669', width: '50px', height: '50px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.25rem', color: '#059669', margin: '0 auto 1.25rem auto' }}>
                3
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>¡Facturas e imprimes!</h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5 }}>
                Realizas tus ventas en segundos, emites tu factura e imprimes en tu impresora térmica.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* 8. TESTIMONIALS / SOCIAL PROOF */}
      <section style={{ padding: '4.5rem 1.5rem', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            TESTIMONIOS
          </span>
          <h2 style={{ fontSize: '2.1rem', fontWeight: 900, color: '#0f172a', marginTop: '0.35rem' }}>
            Lo que dicen los comerciantes en Honduras
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.75rem' }}>
          
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.75rem', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', gap: '0.2rem', color: '#f59e0b', marginBottom: '1rem' }}>
              <Star size={18} fill="#f59e0b" /><Star size={18} fill="#f59e0b" /><Star size={18} fill="#f59e0b" /><Star size={18} fill="#f59e0b" /><Star size={18} fill="#f59e0b" />
            </div>
            <p style={{ color: '#334155', fontSize: '0.95rem', lineHeight: 1.6, fontStyle: 'italic', marginBottom: '1.25rem' }}>
              "Antes perdíamos más de 45 minutos en la noche contando billetes y discutiendo por faltantes. Con los cierres ciegos de MiCuadre la caja cuadra sola en 5 minutos."
            </p>
            <div>
              <h4 style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', margin: 0 }}>Doña María Fernández</h4>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.1rem 0 0 0' }}>Pulpería San José (Tegucigalpa)</p>
            </div>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.75rem', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', gap: '0.2rem', color: '#f59e0b', marginBottom: '1rem' }}>
              <Star size={18} fill="#f59e0b" /><Star size={18} fill="#f59e0b" /><Star size={18} fill="#f59e0b" /><Star size={18} fill="#f59e0b" /><Star size={18} fill="#f59e0b" />
            </div>
            <p style={{ color: '#334155', fontSize: '0.95rem', lineHeight: 1.6, fontStyle: 'italic', marginBottom: '1.25rem' }}>
              "El formato de factura térmica impreso sale impecable y la gaveta monedero abre automáticamente al cobrar. 100% recomendado."
            </p>
            <div>
              <h4 style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', margin: 0 }}>Carlos Mendoza</h4>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.1rem 0 0 0' }}>Mercadito El Sol (San Pedro Sula)</p>
            </div>
          </div>

        </div>
      </section>

      {/* 9. OBJECTION HANDLING / FAQ */}
      <section style={{ background: '#ffffff', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: '4.5rem 1.5rem' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              PREGUNTAS FRECUENTES
            </span>
            <h2 style={{ fontSize: '2.1rem', fontWeight: 900, color: '#0f172a', marginTop: '0.35rem' }}>
              Resolvemos tus dudas
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {[
              {
                q: '¿Cómo ingreso a mi comercio?',
                a: 'Cada comercio cuenta con un enlace exclusivo de acceso (ejemplo: micuadre.app/?comercio=tu-negocio) proporcionado por el administrador. También puedes escribir el nombre de tu negocio en la opción "Ingresar a mi Comercio".'
              },
              {
                q: '¿Necesito una computadora costosa o un servidor?',
                a: 'No. MiCuadre funciona directamente en cualquier navegador web desde tu computadora de escritorio, laptop o tablet sin instalar programas pesados.'
              },
              {
                q: '¿Es compatible con mi impresora térmica y gaveta monedero?',
                a: 'Sí, es 100% compatible con impresoras térmicas estándar. Imprime la factura comercial o fiscal y activa el pulso RJ11 para abrir el cajón monedero automáticamente.'
              },
              {
                q: '¿Mis datos están seguros y protegidos?',
                a: 'Totalmente. Cada comercio opera de manera privada y aislada (Multi-Tenant) mediante filtrado estricto por tenant_id. Nadie más tiene acceso a la información de tu negocio.'
              }
            ].map((item, idx) => (
              <div
                key={idx}
                onClick={() => toggleFaq(idx)}
                style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', cursor: 'pointer', background: activeFaqIndex === idx ? '#f8fafc' : '#ffffff', transition: 'all 0.15s' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>{item.q}</h4>
                  <ChevronDown size={18} style={{ color: '#059669', transform: activeFaqIndex === idx ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </div>
                {activeFaqIndex === idx && (
                  <p style={{ marginTop: '0.75rem', color: '#475569', fontSize: '0.92rem', lineHeight: 1.6, borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                    {item.a}
                  </p>
                )}
              </div>
            ))}

          </div>
        </div>
      </section>

      {/* 10. FINAL CTA SECTION */}
      <section style={{ padding: '5rem 1.5rem', textAlign: 'center', background: '#0f172a', color: '#ffffff' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '1rem', letterSpacing: '-0.03em' }}>
            Empieza a cuadrar tu negocio hoy mismo
          </h2>
          <p style={{ fontSize: '1.1rem', color: '#94a3b8', marginBottom: '2.5rem', maxWidth: '650px', margin: '0 auto 2.5rem auto' }}>
            Únete a los comerciantes en Honduras que ya tienen el control absoluto de sus ventas, caja e inventarios.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1rem' }}>
            <button
              onClick={() => setIsAccessModalOpen(true)}
              style={{ background: '#059669', color: '#ffffff', border: 'none', padding: '0.95rem 2.2rem', borderRadius: '12px', fontSize: '1.05rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.65rem', boxShadow: '0 10px 25px rgba(5, 150, 105, 0.35)' }}
            >
              <Store size={20} />
              <span>Ingresar a mi Comercio</span>
              <ArrowRight size={20} />
            </button>

            <button
              onClick={onEnterDemo}
              style={{ background: '#1e293b', color: '#ffffff', border: '1px solid #334155', padding: '0.95rem 2rem', borderRadius: '12px', fontSize: '1.05rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.65rem' }}
            >
              <Building2 size={20} style={{ color: '#34d399' }} />
              <span>Ver Demo en Vivo</span>
            </button>
          </div>
        </div>
      </section>

      {/* 11. FOOTER */}
      <footer style={{ borderTop: '1px solid #e2e8f0', background: '#ffffff', padding: '2rem 1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
        <p>© {new Date().getFullYear()} MiCuadre.app — Sistema POS & Gestión Comercial en Honduras.</p>
        <p style={{ marginTop: '0.5rem' }}>
          <a
            href="?admin=true"
            onClick={(e) => {
              e.preventDefault();
              window.history.pushState({}, '', '/admin');
              window.dispatchEvent(new Event('popstate'));
            }}
            style={{ color: '#059669', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <ShieldAlert size={15} />
            <span>Acceso Administrador de Plataforma SaaS (/admin)</span>
          </a>
        </p>
      </footer>

      {/* MODAL PRIVADO: Ingresar a mi Comercio (Sin lista pública de comercios) */}
      {isAccessModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', zIndex: 50 }}>
          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '20px', width: '100%', maxWidth: '440px', padding: '1.75rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <Store size={22} style={{ color: '#059669' }} />
                <span>Acceso a tu Comercio</span>
              </h3>
              <button onClick={() => setIsAccessModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Ingresa el nombre o enlace de tu comercio proporcionado por tu administrador para acceder a tu panel de inicio de sesión.
            </p>

            <form onSubmit={handleAccessStoreSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: '#334155', fontWeight: 700, marginBottom: '0.4rem' }}>
                  Nombre o Código de tu Comercio
                </label>
                <input
                  type="text"
                  placeholder="Ej. Pulpería San José"
                  value={storeInput}
                  onChange={(e) => setStoreInput(e.target.value)}
                  style={{ width: '100%', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.95rem', outline: 'none', fontWeight: 600 }}
                  autoFocus
                  required
                />
              </div>

              <button
                type="submit"
                style={{ background: '#059669', color: '#ffffff', border: 'none', padding: '0.85rem', borderRadius: '10px', fontSize: '0.98rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.25rem' }}
              >
                <span>Ir a mi Comercio</span>
                <ArrowRight size={18} />
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
