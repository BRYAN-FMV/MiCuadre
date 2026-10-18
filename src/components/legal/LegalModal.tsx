import React, { useState, useEffect } from 'react';
import { X, FileText, Shield, AlertCircle, Database, Printer, CheckCircle } from 'lucide-react';
import { ALL_LEGAL_DOCS, LegalDocument } from './legalContent';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDocId?: 'terms' | 'privacy' | 'beta' | 'cookies';
  showAcceptButton?: boolean;
  onAccept?: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  onClose,
  initialDocId = 'terms',
  showAcceptButton = false,
  onAccept
}) => {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy' | 'beta' | 'cookies'>(initialDocId);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialDocId);
    }
  }, [isOpen, initialDocId]);

  if (!isOpen) return null;

  const currentDoc: LegalDocument = ALL_LEGAL_DOCS[activeTab] || ALL_LEGAL_DOCS.terms;

  const handlePrint = () => {
    window.print();
  };

  const tabs = [
    { id: 'terms' as const, label: 'Términos y Condiciones', icon: FileText },
    { id: 'privacy' as const, label: 'Política de Privacidad', icon: Shield },
    { id: 'beta' as const, label: 'Descargo Beta', icon: AlertCircle },
    { id: 'cookies' as const, label: 'Cookies & Datos Locales', icon: Database }
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(5px)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '840px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  background: '#059669',
                  color: '#ffffff',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase'
                }}
              >
                Fase Beta
              </span>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Marco Legal y Normativo — MiCuadre
              </h2>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
              Documentación contractual, de privacidad y fiscal para comercios en Honduras
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handlePrint}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '0.4rem 0.65rem',
                fontSize: '0.78rem',
                color: '#475569',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontWeight: 600
              }}
              title="Imprimir documento"
            >
              <Printer size={15} />
              <span>Imprimir</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: '#64748b',
                padding: '0.3rem'
              }}
              title="Cerrar ventana"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            overflowX: 'auto',
            borderBottom: '1px solid #e2e8f0',
            background: '#ffffff',
            padding: '0 1rem'
          }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: '0.75rem 1rem',
                  fontSize: '0.82rem',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#059669' : '#64748b',
                  borderBottom: isActive ? '2px solid #059669' : '2px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Document Content Area */}
        <div
          id="legal-printable-area"
          style={{
            padding: '1.5rem',
            overflowY: 'auto',
            flex: 1,
            lineHeight: 1.6,
            color: '#334155'
          }}
        >
          {/* Document Header */}
          <div style={{ marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              {currentDoc.title}
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.2rem', marginBottom: '0.4rem' }}>
              {currentDoc.subtitle}
            </p>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Última actualización: {currentDoc.lastUpdated} | Plataforma: MiCuadre.app (Honduras)
            </div>
          </div>

          {/* Sections List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {currentDoc.sections.map((section, idx) => (
              <div
                key={idx}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '1rem 1.15rem'
                }}
              >
                <h4
                  style={{
                    fontSize: '0.92rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    margin: '0 0 0.5rem 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <span>{section.title}</span>
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {section.content.map((paragraph, pIdx) => (
                    <p
                      key={pIdx}
                      style={{
                        margin: 0,
                        fontSize: '0.82rem',
                        color: '#475569',
                        textAlign: 'justify'
                      }}
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Al operar MiCuadre, aceptas la aplicación de estos documentos legales vigentes.
          </div>

          <div style={{ display: 'flex', gap: '0.65rem' }}>
            {showAcceptButton ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (onAccept) onAccept();
                  onClose();
                }}
                style={{
                  padding: '0.55rem 1.25rem',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  background: '#059669',
                  borderColor: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <CheckCircle size={16} />
                <span>Aceptar y Continuar</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                style={{ padding: '0.55rem 1.25rem', fontSize: '0.85rem' }}
              >
                Cerrar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
