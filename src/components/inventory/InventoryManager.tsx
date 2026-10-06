import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { formatCurrency } from '../../lib/monetary';
import { Product, TaxClassification, PriceTier } from '../../types';
import { toast } from 'sonner';
import { Plus, History, Search, Package, Edit2, Trash2, X, AlertTriangle } from 'lucide-react';

export const InventoryManager: React.FC = () => {
  const { products, addProduct, updateProduct, deleteProduct, tenant } = useAppStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('TODOS');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'LOW' | 'OUT' | 'WHOLESALE'>('ALL');
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [selectedKardexProduct, setSelectedKardexProduct] = useState<Product | null>(null);

  // Form State for new/edit product
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('Abarrotes');
  const [unitOfMeasure, setUnitOfMeasure] = useState('Unidad');
  const [costPrice, setCostPrice] = useState('0.00');
  const [salePrice, setSalePrice] = useState('0.00');
  const [currentStock, setCurrentStock] = useState('0');
  const [minStockAlert, setMinStockAlert] = useState('5');
  const [taxClassification, setTaxClassification] = useState<TaxClassification>('GRAVADO_15');
  const [tiers, setTiers] = useState<Omit<PriceTier, 'id'>[]>([]);

  const openAddModal = () => {
    resetForm();
    setEditingProduct(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setSku(product.sku);
    setBarcode(product.barcode || '');
    setCategory(product.category);
    setUnitOfMeasure(product.unitOfMeasure || 'Unidad');
    setCostPrice(product.costPrice.toString());
    setSalePrice(product.salePrice.toString());
    setCurrentStock(product.currentStock.toString());
    setMinStockAlert(product.minStockAlert.toString());
    setTaxClassification(product.taxClassification);
    setTiers(product.tiers ? product.tiers.map(t => ({ minQuantity: t.minQuantity, unitPrice: t.unitPrice, tierName: t.tierName })) : []);
    setIsAddModalOpen(true);
  };

  const resetForm = () => {
    setName('');
    setSku('');
    setBarcode('');
    setCategory('Abarrotes');
    setUnitOfMeasure('Unidad');
    setCostPrice('0.00');
    setSalePrice('0.00');
    setCurrentStock('0');
    setMinStockAlert('5');
    setTaxClassification('GRAVADO_15');
    setTiers([]);
  };

  const handleAddTier = () => {
    setTiers([...tiers, { minQuantity: 12, unitPrice: 0, tierName: 'Mayoreo' }]);
  };

  const handleRemoveTier = (index: number) => {
    setTiers(tiers.filter((_, i) => i !== index));
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !sku.trim() || !salePrice) {
      toast.error('Nombre, SKU y Precio de Venta son campos obligatorios');
      return;
    }

    const parsedCost = parseFloat(costPrice) || 0;
    const parsedSale = parseFloat(salePrice) || 0;
    const parsedStock = parseInt(currentStock) || 0;
    const parsedMinStock = parseInt(minStockAlert) || 5;

    if (editingProduct) {
      updateProduct(editingProduct.id, {
        name: name.trim(),
        sku: sku.trim(),
        barcode: barcode.trim() || undefined,
        category,
        unitOfMeasure,
        costPrice: parsedCost,
        salePrice: parsedSale,
        currentStock: parsedStock,
        minStockAlert: parsedMinStock,
        taxClassification,
        tiers: tiers.map((t, idx) => ({ ...t, id: `tier-${idx}-${Date.now()}` }))
      });
      toast.success(`Producto "${name}" actualizado correctamente`);
    } else {
      addProduct({
        name: name.trim(),
        sku: sku.trim(),
        barcode: barcode.trim() || undefined,
        category,
        unitOfMeasure,
        costPrice: parsedCost,
        salePrice: parsedSale,
        currentStock: parsedStock,
        minStockAlert: parsedMinStock,
        taxClassification,
        isActive: true,
        tiers: tiers.map((t, idx) => ({ ...t, id: `tier-${idx}-${Date.now()}` }))
      });
      toast.success(`Producto "${name}" agregado al inventario`);
    }

    setIsAddModalOpen(false);
    setEditingProduct(null);
    resetForm();
  };

  const confirmDeleteProduct = () => {
    if (deletingProduct) {
      deleteProduct(deletingProduct.id);
      toast.success(`Producto "${deletingProduct.name}" eliminado del inventario`);
      setDeletingProduct(null);
    }
  };

  // Multi-tenant product filtering & Stock counters
  const tenantProducts = products.filter((p: Product) => p.tenantId === tenant.id);
  const categories = ['TODOS', ...Array.from(new Set(tenantProducts.map((p: Product) => p.category)))];

  const lowStockCount = tenantProducts.filter(p => p.currentStock > 0 && p.currentStock <= p.minStockAlert).length;
  const outOfStockCount = tenantProducts.filter(p => p.currentStock <= 0).length;
  const wholesaleCount = tenantProducts.filter(p => p.tiers && p.tiers.length > 0).length;

  const filteredProducts = tenantProducts.filter((p: Product) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.barcode && p.barcode.includes(searchTerm));
    const matchesCat = selectedCategory === 'TODOS' || p.category === selectedCategory;
    let matchesStock = true;
    if (stockFilter === 'LOW') {
      matchesStock = p.currentStock > 0 && p.currentStock <= p.minStockAlert;
    } else if (stockFilter === 'OUT') {
      matchesStock = p.currentStock <= 0;
    } else if (stockFilter === 'WHOLESALE') {
      matchesStock = !!(p.tiers && p.tiers.length > 0);
    }
    return matchesSearch && matchesCat && matchesStock;
  });

  const currentUser = useAppStore(state => state.currentUser);
  const canEditInventory = currentUser?.role === 'ADMIN' || currentUser?.role === 'BODEGUERO';

  return (
    <div className="view-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Header Banner */}
      <div className="glass-panel header-banner">
        <div>
          <h2 style={{ fontSize: '1.2rem', color: '#0f172a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Package size={22} style={{ color: 'var(--accent-primary)' }} />
            Inventario & Catálogo de Productos
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Control de productos, existencias, precio mayorista e impuesto fiscal
          </p>
        </div>

        {canEditInventory ? (
          <button className="btn btn-primary" onClick={openAddModal} style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}>
            <Plus size={16} />
            <span>Nuevo Producto</span>
          </button>
        ) : (
          <span className="badge badge-wholesale" style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem' }}>
            Modo Consulta de Precios & Existencias
          </span>
        )}
      </div>

      {/* Filter Toolbar */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.75rem 1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            className="input-control"
            placeholder="Buscar por Nombre, SKU o Barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.2rem', fontSize: '0.85rem' }}
          />
        </div>

        {/* Stock Status Pills */}
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', borderRight: '1px solid #e2e8f0', paddingRight: '0.75rem' }}>
          <button
            type="button"
            onClick={() => setStockFilter('ALL')}
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.78rem',
              borderRadius: '16px',
              background: stockFilter === 'ALL' ? '#0f172a' : '#f1f5f9',
              color: stockFilter === 'ALL' ? '#ffffff' : '#475569',
              border: 'none',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Todos ({tenantProducts.length})
          </button>
          <button
            type="button"
            onClick={() => setStockFilter('LOW')}
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.78rem',
              borderRadius: '16px',
              background: stockFilter === 'LOW' ? '#d97706' : '#fef3c7',
              color: stockFilter === 'LOW' ? '#ffffff' : '#92400e',
              border: 'none',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Poco Stock ({lowStockCount})
          </button>
          <button
            type="button"
            onClick={() => setStockFilter('OUT')}
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.78rem',
              borderRadius: '16px',
              background: stockFilter === 'OUT' ? '#dc2626' : '#fee2e2',
              color: stockFilter === 'OUT' ? '#ffffff' : '#991b1b',
              border: 'none',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Agotados ({outOfStockCount})
          </button>
          {wholesaleCount > 0 && (
            <button
              type="button"
              onClick={() => setStockFilter('WHOLESALE')}
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.78rem',
                borderRadius: '16px',
                background: stockFilter === 'WHOLESALE' ? '#7c3aed' : '#f3e8ff',
                color: stockFilter === 'WHOLESALE' ? '#ffffff' : '#6b21a8',
                border: 'none',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Mayoreo ({wholesaleCount})
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', gap: '0.4rem', flex: 1, overflowX: 'auto' }}>
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem',
                  borderRadius: '16px',
                  background: isActive ? 'var(--accent-primary)' : '#f1f5f9',
                  color: isActive ? '#ffffff' : '#475569',
                  border: 'none',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Products Table Card */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
        <div className="table-responsive">
          <table className="table" style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 1rem' }}>SKU / Código</th>
                <th style={{ padding: '0.75rem 1rem' }}>Producto</th>
                <th style={{ padding: '0.75rem 1rem' }}>Categoría</th>
                <th style={{ padding: '0.75rem 1rem' }}>Stock</th>
                <th style={{ padding: '0.75rem 1rem' }}>Costo CPP</th>
                <th style={{ padding: '0.75rem 1rem' }}>Precio Venta</th>
                <th style={{ padding: '0.75rem 1rem' }}>ISV</th>
                <th style={{ padding: '0.75rem 1rem' }}>Mayoreo</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                    No se encontraron productos en el inventario.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p: Product) => {
                  const isLow = p.currentStock <= p.minStockAlert;
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: '#475569' }}>
                        <code>{p.sku}</code>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>
                        {p.name}
                        {p.barcode && <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 400 }}>Bar: {p.barcode}</div>}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{p.category}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span className={`badge ${isLow ? 'badge-danger' : 'badge-success'}`}>
                          {p.currentStock} {p.unitOfMeasure || 'Unid.'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                        {formatCurrency(p.costPrice, tenant.currencySymbol)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                        {formatCurrency(p.salePrice, tenant.currencySymbol)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ fontSize: '0.75rem', opacity: 0.8 }} className="badge">
                          {p.taxClassification === 'EXENTO' ? '0%' : (p.taxClassification === 'GRAVADO_18' ? '18%' : '15%')}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {p.tiers && p.tiers.length > 0 ? (
                          <span className="badge badge-wholesale">{p.tiers.length} Escalas</span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Normal</span>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                          <button
                            title="Ver Kardex"
                            className="btn btn-secondary"
                            onClick={() => setSelectedKardexProduct(p)}
                            style={{ padding: '0.35rem 0.55rem', fontSize: '0.78rem' }}
                          >
                            <History size={14} />
                          </button>
                          {canEditInventory && (
                            <>
                              <button
                                title="Editar Producto"
                                className="btn btn-secondary"
                                onClick={() => openEditModal(p)}
                                style={{ padding: '0.35rem 0.55rem', fontSize: '0.78rem', color: '#0284c7' }}
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                title="Eliminar Producto"
                                className="btn btn-secondary"
                                onClick={() => setDeletingProduct(p)}
                                style={{ padding: '0.35rem 0.55rem', fontSize: '0.78rem', color: '#ef4444' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Create / Edit Product */}
      {isAddModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '640px',
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
            display: 'flex', flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#ffffff', zIndex: 10 }}>
              <h3 style={{ fontSize: '1.1rem', color: '#0f172a', fontWeight: 700, margin: 0 }}>
                {editingProduct ? 'Editar Producto' : 'Agregar Nuevo Producto'}
              </h3>
              <button
                onClick={() => { setIsAddModalOpen(false); setEditingProduct(null); }}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', padding: '0.25rem' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveProduct} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Product Info Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>
                  Datos Básicos
                </div>
                
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Nombre del Producto *</label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="Ej. Harina Maseca 1kg"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>SKU / Código Único *</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="Ej. MAS-001"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Código de Barras</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="Escanear o digitar..."
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Categoría</label>
                    <select className="input-control" value={category} onChange={(e) => setCategory(e.target.value)}>
                      <option value="Abarrotes">Abarrotes</option>
                      <option value="Cuidado Personal">Cuidado Personal</option>
                      <option value="Bebidas">Bebidas</option>
                      <option value="Licores">Licores</option>
                      <option value="Ferretería">Ferretería</option>
                      <option value="General">General</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Unidad de Medida</label>
                    <select className="input-control" value={unitOfMeasure} onChange={(e) => setUnitOfMeasure(e.target.value)}>
                      <option value="Unidad">Unidad (Unid.)</option>
                      <option value="Caja">Caja</option>
                      <option value="Libra">Libra (Lb)</option>
                      <option value="Kilogramo">Kilogramo (Kg)</option>
                      <option value="Litro">Litro (L)</option>
                      <option value="Paquete">Paquete</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Pricing & Stock Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>
                  Precios & Inventario
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Costo CPP ({tenant.currencySymbol})</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input-control"
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      Precio de Venta * ({tenant.currencySymbol})
                      <span style={{ fontWeight: 400, color: '#64748b', fontSize: '0.75rem', marginLeft: '0.35rem' }}>
                        {(tenant.pricesIncludeTax ?? true) ? '(ISV incluido)' : '(antes de ISV)'}
                      </span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="input-control"
                      value={salePrice}
                      onChange={(e) => setSalePrice(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.85rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Stock Actual</label>
                    <input
                      type="number"
                      className="input-control"
                      value={currentStock}
                      onChange={(e) => setCurrentStock(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Alerta Mínima</label>
                    <input
                      type="number"
                      className="input-control"
                      value={minStockAlert}
                      onChange={(e) => setMinStockAlert(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Impuesto ISV</label>
                    <select className="input-control" value={taxClassification} onChange={(e) => setTaxClassification(e.target.value as TaxClassification)}>
                      <option value="EXENTO">EXENTO (0%)</option>
                      <option value="GRAVADO_15">GRAVADO (15%)</option>
                      <option value="GRAVADO_18">GRAVADO (18%)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Wholesale Tiers Configuration */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a' }}>Escalas de Precio por Mayoreo</span>
                  <button type="button" className="btn btn-secondary" onClick={handleAddTier} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>
                    + Agregar Escala
                  </button>
                </div>

                {tiers.length === 0 ? (
                  <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>Sin escalas de mayoreo configuradas.</p>
                ) : (
                  tiers.map((tier, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="number"
                        placeholder="Mín. Cant."
                        className="input-control"
                        style={{ fontSize: '0.8rem' }}
                        value={tier.minQuantity}
                        onChange={(e) => {
                          const newTiers = [...tiers];
                          newTiers[idx].minQuantity = parseInt(e.target.value) || 0;
                          setTiers(newTiers);
                        }}
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Precio Unit."
                        className="input-control"
                        style={{ fontSize: '0.8rem' }}
                        value={tier.unitPrice}
                        onChange={(e) => {
                          const newTiers = [...tiers];
                          newTiers[idx].unitPrice = parseFloat(e.target.value) || 0;
                          setTiers(newTiers);
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Nombre Escala"
                        className="input-control"
                        style={{ fontSize: '0.8rem' }}
                        value={tier.tierName}
                        onChange={(e) => {
                          const newTiers = [...tiers];
                          newTiers[idx].tierName = e.target.value;
                          setTiers(newTiers);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveTier(idx)}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.3rem' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setIsAddModalOpen(false); setEditingProduct(null); }}
                  style={{ padding: '0.6rem 1.25rem' }}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.6rem 1.25rem' }}>
                  {editingProduct ? 'Guardar Cambios' : 'Crear Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Custom Delete Confirmation Card */}
      {deletingProduct && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)',
          zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '440px',
            padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            display: 'flex', flexDirection: 'column', gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', color: '#0f172a', fontWeight: 700, margin: 0 }}>¿Eliminar Producto?</h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>Esta acción no se puede deshacer.</p>
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>{deletingProduct.name}</div>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>SKU: {deletingProduct.sku} | Stock actual: {deletingProduct.currentStock}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setDeletingProduct(null)}
                style={{ padding: '0.55rem 1rem' }}
              >
                Cancelar
              </button>
              <button
                className="btn"
                onClick={confirmDeleteProduct}
                style={{ background: '#ef4444', color: '#ffffff', border: 'none', padding: '0.55rem 1rem', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
              >
                Eliminar Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Kardex Inspector */}
      {selectedKardexProduct && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '580px',
            padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            display: 'flex', flexDirection: 'column', gap: '1rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', color: '#0f172a', fontWeight: 700, margin: 0 }}>Kardex de Movimientos</h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>{selectedKardexProduct.name} ({selectedKardexProduct.sku})</p>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedKardexProduct(null)}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
              >
                Cerrar
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '10px', display: 'flex', justifyContent: 'space-around', border: '1px solid #e2e8f0' }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Stock Actual</span>
                <p style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a', margin: 0 }}>{selectedKardexProduct.currentStock} {selectedKardexProduct.unitOfMeasure || 'Unid.'}</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Costo CPP</span>
                <p style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--accent-primary)', margin: 0 }}>{formatCurrency(selectedKardexProduct.costPrice, tenant.currencySymbol)}</p>
              </div>
            </div>

            <table className="table" style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Tipo</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Cantidad</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Costo Asoc.</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Stock Resultante</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.6rem 0.75rem' }}><span className="badge badge-success">COMPRA (IN)</span></td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#10b981', fontWeight: 700 }}>+50</td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>{formatCurrency(selectedKardexProduct.costPrice, tenant.currencySymbol)}</td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>{selectedKardexProduct.currentStock + 2}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.6rem 0.75rem' }}><span className="badge badge-fiscal">VENTA (OUT)</span></td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#ef4444', fontWeight: 700 }}>-2</td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>{formatCurrency(selectedKardexProduct.costPrice, tenant.currencySymbol)}</td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>{selectedKardexProduct.currentStock}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

export default InventoryManager;
