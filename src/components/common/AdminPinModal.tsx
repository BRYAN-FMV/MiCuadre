import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { UserProfile } from '../../types';
import { verifyPinCode } from '../../lib/security';
import { ShieldCheck, X, Delete } from 'lucide-react';
import { toast } from 'sonner';

export interface AdminPinModalProps {
  isOpen: boolean;
  title: string;
  actionDescription?: string;
  onSuccess: (admin: UserProfile) => void;
  onCancel: () => void;
}

export const AdminPinModal: React.FC<AdminPinModalProps> = ({
  isOpen,
  title,
  actionDescription,
  onSuccess,
  onCancel,
}) => {
  const [pin, setPin] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const profiles = useAppStore(state => state.profiles);
  const tenant = useAppStore(state => state.tenant);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setIsValidating(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAuthorize = async () => {
    if (!pin.trim()) {
      toast.error('Ingrese el PIN de Administrador');
      return;
    }

    setIsValidating(true);

    try {
      // Find all active admins for the current tenant
      const tenantAdmins = profiles.filter(
        p => p.tenantId === tenant.id && p.role === 'ADMIN' && p.isActive
      );

      // If tenant has no admins explicitly configured (fallback to any active admin)
      const candidateAdmins = tenantAdmins.length > 0
        ? tenantAdmins
        : profiles.filter(p => p.role === 'ADMIN' && p.isActive);

      let matchedAdmin: UserProfile | null = null;

      for (const admin of candidateAdmins) {
        if (admin.pinCode) {
          const isMatch = await verifyPinCode(pin.trim(), admin.pinCode);
          if (isMatch) {
            matchedAdmin = admin;
            break;
          }
        }
      }

      if (matchedAdmin) {
        toast.success(`Accion autorizada por ${matchedAdmin.fullName}`);
        setPin('');
        onSuccess(matchedAdmin);
      } else {
        toast.error('PIN de Administrador invalido');
        setPin('');
        inputRef.current?.focus();
      }
    } catch (err) {
      console.error('Error validando PIN de admin:', err);
      toast.error('Error al verificar el PIN');
    } finally {
      setIsValidating(false);
    }
  };

  const handleKeyPress = (digit: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + digit);
    }
  };

  const handleDeleteDigit = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      zIndex: 1300,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '14px',
        width: '100%',
        maxWidth: '380px',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                {title}
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                Autorizacion de Administrador
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
            aria-label="Cerrar autorizacion"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {actionDescription && (
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '0.65rem 0.85rem',
              fontSize: '0.78rem',
              color: '#475569'
            }}>
              {actionDescription}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
              Ingrese PIN de Administrador (4 digitos):
            </label>
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAuthorize();
                } else if (e.key === 'Escape') {
                  onCancel();
                }
              }}
              placeholder="••••"
              style={{
                width: '100%',
                padding: '0.7rem',
                fontSize: '1.3rem',
                textAlign: 'center',
                letterSpacing: '0.5rem',
                borderRadius: '8px',
                border: '2px solid #cbd5e1',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Touch Number Pad */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.45rem' }}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeyPress(num)}
                style={{
                  padding: '0.7rem 0',
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#0f172a',
                  cursor: 'pointer'
                }}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              style={{
                padding: '0.7rem 0',
                fontSize: '0.8rem',
                fontWeight: 700,
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#fee2e2',
                color: '#dc2626',
                cursor: 'pointer'
              }}
            >
              C
            </button>
            <button
              type="button"
              onClick={() => handleKeyPress('0')}
              style={{
                padding: '0.7rem 0',
                fontSize: '1.1rem',
                fontWeight: 600,
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                color: '#0f172a',
                cursor: 'pointer'
              }}
            >
              0
            </button>
            <button
              type="button"
              onClick={handleDeleteDigit}
              style={{
                padding: '0.7rem 0',
                fontSize: '0.9rem',
                fontWeight: 600,
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#f1f5f9',
                color: '#475569',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Delete size={18} />
            </button>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
              style={{ flex: 1, fontSize: '0.85rem', padding: '0.65rem' }}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isValidating || pin.length < 4}
              onClick={handleAuthorize}
              style={{
                flex: 1,
                fontSize: '0.85rem',
                padding: '0.65rem',
                background: '#2563eb',
                borderColor: '#2563eb'
              }}
            >
              {isValidating ? 'Verificando...' : 'Autorizar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
