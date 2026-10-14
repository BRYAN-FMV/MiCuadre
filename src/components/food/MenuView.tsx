import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { MenuItem, MenuItemExtra } from '../../types';
import { UtensilsCrossed, Plus, Search, Check, X, Edit2, Trash2, ToggleLeft, ToggleRight, Coffee, Sparkles } from 'lucide-react';
import { formatCurrency } from '../../lib/monetary';
import { toast } from 'sonner';

export const MenuView: React.FC = () => {
  const tenant = useAppStore(state => state.tenant);
  const allMenuItems = useAppStore(state => state.menuItems) || [];
  const isDemo = tenant.id === '00000000-0000-0000-0000-000000000001';
  const menuItems = allMenuItems.filter(
    m => m.tenantId === tenant.id || (isDemo && (!m.tenantId || m.tenantId === '00000000-0000-0000-0000-000000000001'))
  );
  const addMenuItem = useAppStore(state => state.addMenuItem);
  const updateMenuItem = useAppStore(state => state.updateMenuItem);
  const toggleMenuItemAvailability = useAppStore(state => state.toggleMenuItemAvailability);
  const deleteMenuItem = useAppStore(state => state.deleteMenuItem);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Almuerzos & Cenas');
  const [price, setPrice] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [defaultNotesText, setDefaultNotesText] = useState('');
  const [extras, setExtras] = useState<MenuItemExtra[]>([]);

  // New Extra Temp State
  const [newExtraName, setNewExtraName] = useState('');
  const [newExtraPrice, setNewExtraPrice] = useState('');

  // Categories list
  const availableCategories = Array.from(new Set(menuItems.map(m => m.category).filter(Boolean)));
  const defaultCategories = ['Almuerzos & Cenas', 'Desayunos', 'Bebidas Naturales', 'Cafetería', 'Postres', 'Combos'];
  const allCategories = Array.from(new Set([...defaultCategories, ...availableCategories]));

  const filteredItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'TODAS' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const totalAvailable = menuItems.filter(m => m.isAvailable).length;
  const totalUnavailable = menuItems.length - totalAvailable;

  const handleOpenCreate = () => {
    setEditingItem(null);
    setName('');
    setCategory('Almuerzos & Cenas');
    setPrice('');
    setIsAvailable(true);
    setDefaultNotesText('');
    setExtras([]);
    setNewExtraName('');
    setNewExtraPrice('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: MenuItem) => {
    setEditingItem(item);
    setName(item.name);
    setCategory(item.category);
    setPrice(String(item.price));
    setIsAvailable(item.isAvailable);
    setDefaultNotesText((item.defaultNotes || []).join(', '));
    setExtras(item.availableExtras ? [...item.availableExtras] : []);
    setNewExtraName('');
    setNewExtraPrice('');
    setIsModalOpen(true);
  };

  const handleAddExtra = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExtraName.trim()) {
      toast.error('Ingresa el nombre del extra (ej. Extra Carne)');
      return;
    }
    const p = parseFloat(newExtraPrice) || 0;
    const newExtra: MenuItemExtra = {
      id: `ext-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: newExtraName.trim(),
      price: p
    };
    setExtras([...extras, newExtra]);
    setNewExtraName('');
    setNewExtraPrice('');
  };

  const handleRemoveExtra = (id: string) => {
    setExtras(extras.filter(e => e.id !== id));
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Ingresa el nombre del platillo o bebida');
      return;
    }
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      toast.error('Ingresa un precio válido');
      return;
    }

    const defaultNotes = defaultNotesText
      .split(',')
      .map(n => n.trim())
      .filter(n => n.length > 0);

    if (editingItem) {
      updateMenuItem(editingItem.id, {
        name: name.trim(),
        category: category.trim(),
        price: parsedPrice,
        isAvailable,
        availableExtras: extras,
        defaultNotes
      });
      toast.success(`Platillo "${name}" actualizado`);
    } else {
      addMenuItem({
        name: name.trim(),
        category: category.trim(),
        price: parsedPrice,
        isAvailable,
        availableExtras: extras,
        defaultNotes
      });
      toast.success(`Platillo "${name}" agregado al menú`);
    }

    setIsModalOpen(false);
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* 1. Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UtensilsCrossed size={26} style={{ color: '#ea580c' }} />
            Menú del Día (Comida & Bebidas)
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.88rem' }}>
            Platillos cocinados y bebidas preparadas sin control de inventario rígido. Activa o desactiva su disponibilidad diaria en 1 toque.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.1rem', background: '#ea580c', borderColor: '#ea580c', fontWeight: 700 }}
        >
          <Plus size={18} />
          <span>Nuevo Platillo / Bebida</span>
        </button>
      </div>

      {/* 2. Operational Counters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#ffedd5', color: '#c2410c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Coffee size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total en Menú</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>{menuItems.length}</div>
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Disponibles Hoy</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16a34a' }}>{totalAvailable}</div>
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#f1f5f9', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Agotados / Ocultos</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#64748b' }}>{totalUnavailable}</div>
          </div>
        </div>
      </div>

      {/* 3. Search and Category Filter Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '450px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            className="input-control"
            placeholder="Buscar por nombre o ingrediente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.5rem', width: '100%' }}
          />
        </div>

        {/* Category Filter Pills */}
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
          <button
            onClick={() => setSelectedCategory('TODAS')}
            className="btn"
            style={{
              padding: '0.4rem 0.85rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              borderRadius: '20px',
              background: selectedCategory === 'TODAS' ? '#0f172a' : '#f1f5f9',
              color: selectedCategory === 'TODAS' ? '#ffffff' : '#475569',
              border: 'none',
              whiteSpace: 'nowrap'
            }}
          >
            Todas ({menuItems.length})
          </button>
          {allCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className="btn"
              style={{
                padding: '0.4rem 0.85rem',
                fontSize: '0.82rem',
                fontWeight: 700,
                borderRadius: '20px',
                background: selectedCategory === cat ? '#ea580c' : '#f1f5f9',
                color: selectedCategory === cat ? '#ffffff' : '#475569',
                border: 'none',
                whiteSpace: 'nowrap'
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Menu Items Grid */}
      {filteredItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
          <UtensilsCrossed size={40} style={{ color: '#94a3b8', margin: '0 auto 0.75rem auto' }} />
          <h4 style={{ margin: 0, color: '#334155', fontWeight: 700 }}>No hay platillos ni bebidas en esta selección</h4>
          <p style={{ margin: '0.35rem 0 1rem 0', color: '#64748b', fontSize: '0.85rem' }}>
            Agrega tu primer platillo o bebida natural con el botón superior.
          </p>
          <button onClick={handleOpenCreate} className="btn btn-primary" style={{ background: '#ea580c', borderColor: '#ea580c' }}>
            <Plus size={16} />
            <span>Crear Platillo</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1rem' }}>
          {filteredItems.map(item => (
            <div
              key={item.id}
              style={{
                background: '#ffffff',
                border: item.isAvailable ? '1px solid #fed7aa' : '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '1.1rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.85rem',
                boxShadow: item.isAvailable ? '0 4px 12px rgba(234, 88, 12, 0.05)' : 'none',
                opacity: item.isAvailable ? 1 : 0.65,
                transition: 'all 0.15s ease'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: '6px', background: '#fff7ed', color: '#c2410c' }}>
                    {item.category}
                  </span>

                  {/* 1-Touch Availability Toggle */}
                  <button
                    onClick={() => {
                      toggleMenuItemAvailability(item.id);
                      toast.info(`"${item.name}" ahora está ${!item.isAvailable ? 'DISPONIBLE' : 'AGOTADO'}`);
                    }}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      color: item.isAvailable ? '#16a34a' : '#94a3b8',
                      fontWeight: 700,
                      fontSize: '0.78rem'
                    }}
                    title={item.isAvailable ? 'Marcar como agotado' : 'Marcar como disponible'}
                  >
                    {item.isAvailable ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
                    <span>{item.isAvailable ? 'Disponible' : 'Agotado'}</span>
                  </button>
                </div>

                <h3 style={{ margin: '0.65rem 0 0.25rem 0', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                  {item.name}
                </h3>

                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ea580c' }}>
                  {formatCurrency(item.price, tenant.currencySymbol)}
                </div>

                {/* Extras badge */}
                {item.availableExtras && item.availableExtras.length > 0 && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {item.availableExtras.slice(0, 3).map(ext => (
                      <span key={ext.id} style={{ fontSize: '0.72rem', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                        +{formatCurrency(ext.price, tenant.currencySymbol)} {ext.name}
                      </span>
                    ))}
                    {item.availableExtras.length > 3 && (
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8', alignSelf: 'center' }}>
                        +{item.availableExtras.length - 3} más
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.65rem' }}>
                <button
                  onClick={() => handleOpenEdit(item)}
                  className="btn btn-secondary"
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <Edit2 size={13} />
                  <span>Editar</span>
                </button>
                <button
                  onClick={() => {
                    if (confirm(`¿Eliminar "${item.name}" del menú?`)) {
                      deleteMenuItem(item.id);
                      toast.success(`"${item.name}" eliminado del menú`);
                    }
                  }}
                  className="btn btn-danger"
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 5. Create / Edit Dish Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}>
            
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <UtensilsCrossed size={20} style={{ color: '#ea580c' }} />
                <span>{editingItem ? 'Editar Platillo / Bebida' : 'Nuevo Platillo o Bebida'}</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveItem} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  Nombre del Platillo / Bebida *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Pollo Chuco, Baleada con Carne, Jugo de Maracuyá"
                  className="input-control"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Categoría *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Almuerzos, Bebidas"
                    className="input-control"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    list="category-suggestions"
                    style={{ width: '100%' }}
                  />
                  <datalist id="category-suggestions">
                    {allCategories.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Precio de Venta ({tenant.currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    className="input-control"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    style={{ width: '100%', fontWeight: 700 }}
                  />
                </div>
              </div>

              {/* Availability Switch */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>Disponible Hoy para la Venta</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Si se agota, apágalo para que se oculte en la pantalla de pedidos.</div>
                </div>
                <input
                  type="checkbox"
                  checked={isAvailable}
                  onChange={(e) => setIsAvailable(e.target.checked)}
                  style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#ea580c' }}
                />
              </div>

              {/* Chargeable Extras Configuration */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Sparkles size={16} style={{ color: '#ea580c' }} />
                    <span>Complementos Extras con Cobro (Opcional)</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{extras.length} extras</span>
                </div>

                {extras.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '140px', overflowY: 'auto' }}>
                    {extras.map(e => (
                      <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.82rem' }}>
                        <span>{e.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <span style={{ fontWeight: 700, color: '#ea580c' }}>+{formatCurrency(e.price, tenant.currencySymbol)}</span>
                          <button type="button" onClick={() => handleRemoveExtra(e.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444' }}>
                            <X size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Extra Input Row */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Ej. Extra Carne, Aguacate"
                    className="input-control"
                    value={newExtraName}
                    onChange={(e) => setNewExtraName(e.target.value)}
                    style={{ flex: 1, fontSize: '0.82rem' }}
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Precio"
                    className="input-control"
                    value={newExtraPrice}
                    onChange={(e) => setNewExtraPrice(e.target.value)}
                    style={{ width: '85px', fontSize: '0.82rem' }}
                  />
                  <button
                    type="button"
                    onClick={handleAddExtra}
                    className="btn btn-secondary"
                    style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem', background: '#ea580c', color: '#fff', borderColor: '#ea580c' }}
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>

              {/* Free Kitchen Notes Suggestions */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  Preferencias habituales de cocina (Separadas por coma)
                </label>
                <input
                  type="text"
                  placeholder="Ej. Sin cebolla, Tajadas verdes, Aderezo aparte, Poco hielo"
                  className="input-control"
                  value={defaultNotesText}
                  onChange={(e) => setDefaultNotesText(e.target.value)}
                  style={{ width: '100%', fontSize: '0.82rem' }}
                />
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1.25rem', background: '#ea580c', borderColor: '#ea580c', fontWeight: 700 }}>
                  {editingItem ? 'Guardar Cambios' : 'Crear Platillo'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
