import React, { useState, useEffect } from 'react';
import { MenuItem, MenuItemExtra } from '../../types';
import { formatCurrency } from '../../lib/monetary';
import { useAppStore } from '../../store/useAppStore';
import { X, Plus, Minus, Check, Sparkles, UtensilsCrossed } from 'lucide-react';

interface MenuItemCustomizerModalProps {
  item: MenuItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    menuItem: MenuItem;
    quantity: number;
    selectedExtras: MenuItemExtra[];
    notes: string;
    finalUnitPrice: number;
  }) => void;
}

export const MenuItemCustomizerModal: React.FC<MenuItemCustomizerModalProps> = ({
  item,
  isOpen,
  onClose,
  onConfirm
}) => {
  const tenant = useAppStore(state => state.tenant);

  const [quantity, setQuantity] = useState(1);
  const [selectedExtras, setSelectedExtras] = useState<MenuItemExtra[]>([]);
  const [selectedNoteChips, setSelectedNoteChips] = useState<string[]>([]);
  const [customNote, setCustomNote] = useState('');

  useEffect(() => {
    if (item && isOpen) {
      setQuantity(1);
      setSelectedExtras([]);
      setSelectedNoteChips([]);
      setCustomNote('');
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const extrasSum = selectedExtras.reduce((acc, e) => acc + e.price, 0);
  const finalUnitPrice = item.price + extrasSum;
  const lineTotal = finalUnitPrice * quantity;

  const toggleExtra = (extra: MenuItemExtra) => {
    if (selectedExtras.some(e => e.id === extra.id)) {
      setSelectedExtras(selectedExtras.filter(e => e.id !== extra.id));
    } else {
      setSelectedExtras([...selectedExtras, extra]);
    }
  };

  const toggleNoteChip = (chip: string) => {
    if (selectedNoteChips.includes(chip)) {
      setSelectedNoteChips(selectedNoteChips.filter(c => c !== chip));
    } else {
      setSelectedNoteChips([...selectedNoteChips, chip]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const combinedNotes = [
      ...selectedNoteChips,
      customNote.trim()
    ].filter(Boolean).join(', ');

    onConfirm({
      menuItem: item,
      quantity,
      selectedExtras,
      notes: combinedNotes,
      finalUnitPrice
    });
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: '#ffffff', borderRadius: '16px', maxWidth: '460px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '6px', background: '#fff7ed', color: '#c2410c' }}>
              {item.category}
            </span>
            <h3 style={{ margin: '0.45rem 0 0.15rem 0', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
              {item.name}
            </h3>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ea580c' }}>
              {formatCurrency(item.price, tenant.currencySymbol)}
            </div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          
          {/* Quantity selector */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.65rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#334155' }}>Cantidad:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Minus size={15} />
              </button>
              <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', minWidth: '24px', textAlign: 'center' }}>
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #ea580c', background: '#ea580c', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Plus size={15} />
              </button>
            </div>
          </div>

          {/* Chargeable Extras */}
          {item.availableExtras && item.availableExtras.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Sparkles size={15} style={{ color: '#ea580c' }} />
                <span>Complementos Extras con Cobro</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {item.availableExtras.map(extra => {
                  const isChecked = selectedExtras.some(e => e.id === extra.id);
                  return (
                    <div
                      key={extra.id}
                      onClick={() => toggleExtra(extra)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.6rem 0.85rem',
                        borderRadius: '8px',
                        border: isChecked ? '1px solid #ea580c' : '1px solid #e2e8f0',
                        background: isChecked ? '#fff7ed' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: isChecked ? '1px solid #ea580c' : '1px solid #cbd5e1', background: isChecked ? '#ea580c' : '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                          {isChecked && <Check size={13} />}
                        </div>
                        <span style={{ fontSize: '0.85rem', fontWeight: isChecked ? 700 : 500, color: isChecked ? '#c2410c' : '#334155' }}>
                          {extra.name}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ea580c' }}>
                        +{formatCurrency(extra.price, tenant.currencySymbol)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Preparation Notes & Quick Chips */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <UtensilsCrossed size={15} style={{ color: '#64748b' }} />
              <span>Instrucciones para Cocina (Sin Costo)</span>
            </div>

            {item.defaultNotes && item.defaultNotes.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {item.defaultNotes.map(chip => {
                  const isSelected = selectedNoteChips.includes(chip);
                  return (
                    <button
                      type="button"
                      key={chip}
                      onClick={() => toggleNoteChip(chip)}
                      style={{
                        padding: '0.3rem 0.65rem',
                        borderRadius: '16px',
                        border: isSelected ? '1px solid #ea580c' : '1px solid #cbd5e1',
                        background: isSelected ? '#ea580c' : '#f8fafc',
                        color: isSelected ? '#ffffff' : '#475569',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {chip}
                    </button>
                  );
                })}
              </div>
            )}

            <input
              type="text"
              placeholder="Instrucción adicional (ej. Salsa picante aparte)"
              className="input-control"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              style={{ fontSize: '0.82rem', width: '100%' }}
            />
          </div>

          {/* Footer & Submit */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Total del ítem:</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                {formatCurrency(lineTotal, tenant.currencySymbol)}
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ background: '#ea580c', borderColor: '#ea580c', padding: '0.65rem 1.35rem', fontWeight: 700, fontSize: '0.9rem' }}
            >
              Agregar al Pedido
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
