import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { FoodOrder, FoodOrderItem, FoodOrderDeliveryType, MenuItem, MenuItemExtra } from '../../types';
import { formatCurrency } from '../../lib/monetary';
import { printKitchenTicket } from '../../lib/thermalPrint';
import {
  X,
  Plus,
  Minus,
  Trash2,
  Utensils,
  Bike,
  ShoppingBag,
  Printer,
  DollarSign,
  Search,
  Check,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';

interface NewFoodOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreatedAndCharge?: (order: FoodOrder) => void;
}

const DEFAULT_TABLES = [
  'Mesa 1', 'Mesa 2', 'Mesa 3', 'Mesa 4',
  'Mesa 5', 'Mesa 6', 'Mesa 7', 'Mesa 8',
  'Mesa 9', 'Mesa 10', 'Mesa 11', 'Mesa 12',
  'Barra', 'Terraza 1', 'Terraza 2'
];

export const NewFoodOrderModal: React.FC<NewFoodOrderModalProps> = ({
  isOpen,
  onClose,
  onOrderCreatedAndCharge
}) => {
  const tenant = useAppStore(state => state.tenant);
  const allMenuItems = useAppStore(state => state.menuItems) || [];
  const isDemo = tenant.id === '00000000-0000-0000-0000-000000000001';
  const menuItems = allMenuItems.filter(
    m => m.tenantId === tenant.id || (isDemo && (!m.tenantId || m.tenantId === '00000000-0000-0000-0000-000000000001'))
  );
  const deliveryDrivers = (useAppStore(state => state.deliveryDrivers) || []).filter(
    d => (!d.tenantId || d.tenantId === tenant.id) && d.isActive
  );
  const createFoodOrder = useAppStore(state => state.createFoodOrder);

  // Form State
  const [deliveryType, setDeliveryType] = useState<FoodOrderDeliveryType>('DINE_IN');
  const [tableNumber, setTableNumber] = useState<string>('Mesa 1');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [deliveryFee, setDeliveryFee] = useState<string>('30');
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');

  // Items in Comanda
  const [orderItems, setOrderItems] = useState<FoodOrderItem[]>([]);
  const [generalNotes, setGeneralNotes] = useState<string>('');

  // Catalog Browser State
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');

  if (!isOpen) return null;

  const categories = Array.from(new Set(menuItems.map(m => m.category).filter(Boolean)));
  const filteredMenuItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      item.category.toLowerCase().includes(catalogSearch.toLowerCase());
    const matchesCat = selectedCategory === 'TODAS' || item.category === selectedCategory;
    return matchesSearch && matchesCat && item.isAvailable;
  });

  const handleAddDish = (dish: MenuItem) => {
    const existingIndex = orderItems.findIndex(it => it.menuItemId === dish.id && (!it.selectedExtras || it.selectedExtras.length === 0) && !it.notes);
    if (existingIndex >= 0) {
      const updated = [...orderItems];
      const item = updated[existingIndex];
      const newQty = item.quantity + 1;
      item.quantity = newQty;
      item.subtotal = newQty * item.unitPrice;
      setOrderItems(updated);
    } else {
      const newItem: FoodOrderItem = {
        menuItemId: dish.id,
        name: dish.name,
        quantity: 1,
        unitPrice: dish.price,
        selectedExtras: [],
        notes: '',
        subtotal: dish.price
      };
      setOrderItems([...orderItems, newItem]);
    }
  };

  const handleUpdateItemQuantity = (index: number, delta: number) => {
    const updated = [...orderItems];
    const item = updated[index];
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      updated.splice(index, 1);
    } else {
      item.quantity = newQty;
      const extrasTotal = (item.selectedExtras || []).reduce((acc, e) => acc + e.price, 0);
      item.subtotal = newQty * (item.unitPrice + extrasTotal);
    }
    setOrderItems(updated);
  };

  const handleToggleExtra = (itemIndex: number, extra: MenuItemExtra) => {
    const updated = [...orderItems];
    const item = updated[itemIndex];
    const currentExtras = item.selectedExtras ? [...item.selectedExtras] : [];
    const exists = currentExtras.some(e => e.name === extra.name);

    if (exists) {
      item.selectedExtras = currentExtras.filter(e => e.name !== extra.name);
    } else {
      item.selectedExtras = [...currentExtras, { id: extra.id, name: extra.name, price: extra.price }];
    }

    const extrasTotal = (item.selectedExtras || []).reduce((acc, e) => acc + e.price, 0);
    item.subtotal = item.quantity * (item.unitPrice + extrasTotal);
    setOrderItems(updated);
  };

  const handleUpdateItemNote = (itemIndex: number, note: string) => {
    const updated = [...orderItems];
    updated[itemIndex].notes = note;
    setOrderItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    const updated = [...orderItems];
    updated.splice(index, 1);
    setOrderItems(updated);
  };

  // Calculations
  const foodSubtotal = orderItems.reduce((acc, it) => acc + it.subtotal, 0);
  const parsedDeliveryFee = deliveryType === 'DELIVERY' ? (parseFloat(deliveryFee) || 0) : 0;
  const orderTotal = foodSubtotal + parsedDeliveryFee;

  const handlePrintKitchenTicket = (orderData: {
    orderNumber: string;
    tableNumber?: string;
    deliveryType: FoodOrderDeliveryType;
    customerName?: string;
    items: FoodOrderItem[];
    notes?: string;
  }) => {
    try {
      printKitchenTicket({
        orderNumber: orderData.orderNumber,
        tableNumber: orderData.tableNumber,
        deliveryType: orderData.deliveryType,
        customerName: orderData.customerName,
        notes: orderData.notes,
        items: orderData.items.map(it => ({
          name: it.name,
          quantity: it.quantity,
          notes: it.notes,
          extras: (it.selectedExtras || []).map(e => ({ name: e.name, price: e.price }))
        }))
      });
    } catch (err) {
      console.warn('Error al imprimir ticket de cocina:', err);
    }
  };

  const handleSaveOrder = (printKitchen = false, chargeImmediate = false) => {
    if (orderItems.length === 0) {
      toast.error('Agrega al menos un platillo o bebida a la comanda.');
      return;
    }

    const assignedDriver = deliveryDrivers.find(d => d.id === selectedDriverId);

    const newOrder = createFoodOrder({
      deliveryType,
      status: 'ORDERED',
      tableNumber: deliveryType === 'DINE_IN' ? tableNumber : undefined,
      customerName: customerName.trim() || (deliveryType === 'DINE_IN' ? tableNumber : 'Consumidor Final'),
      customerPhone: customerPhone.trim() || undefined,
      deliveryPhone: deliveryType === 'DELIVERY' ? customerPhone.trim() : undefined,
      deliveryAddress: deliveryType === 'DELIVERY' ? deliveryAddress.trim() : undefined,
      deliveryFee: deliveryType === 'DELIVERY' ? parsedDeliveryFee : undefined,
      driverId: assignedDriver?.id,
      deliveryDriverId: assignedDriver?.id,
      driverName: assignedDriver?.fullName,
      driverType: assignedDriver?.driverType,
      driverSettled: false,
      items: orderItems,
      subtotal: foodSubtotal,
      total: orderTotal
    });

    if (printKitchen) {
      handlePrintKitchenTicket({
        orderNumber: newOrder.orderNumber,
        tableNumber: newOrder.tableNumber,
        deliveryType: newOrder.deliveryType,
        customerName: newOrder.customerName,
        items: newOrder.items,
        notes: generalNotes.trim() || undefined
      });
    }

    toast.success(`Comanda ${newOrder.orderNumber} creada con éxito`);

    if (chargeImmediate && onOrderCreatedAndCharge) {
      onOrderCreatedAndCharge(newOrder);
    }

    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.7)',
        zIndex: 1150,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backdropFilter: 'blur(3px)'
      }}
    >
      <div
        className="modal-content"
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          maxWidth: '1060px',
          width: '100%',
          maxHeight: 'calc(100dvh - 2rem)',
          height: 'min(92vh, 880px)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: '#ffedd5',
                color: '#ea580c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Utensils size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                Nueva Comanda / Pedido
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                Crea la comanda, agrega platillos con extras y cocina, o cobra directamente
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#64748b',
              padding: '0.4rem',
              borderRadius: '8px'
            }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Modal Content: 2 Columns */}
        <div className="modal-split-grid">
          
          {/* Left Column: Destination & Dish Catalog */}
          <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid #e2e8f0', minHeight: 0, overflowY: 'auto' }}>
            
            {/* 1. Destination Selector */}
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9', background: '#ffffff' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>
                Tipo de Pedido:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 100px), 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setDeliveryType('DINE_IN')}
                  style={{
                    minHeight: '42px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    border: deliveryType === 'DINE_IN' ? '2px solid #ea580c' : '1px solid #cbd5e1',
                    background: deliveryType === 'DINE_IN' ? '#fff7ed' : '#ffffff',
                    color: deliveryType === 'DINE_IN' ? '#ea580c' : '#475569',
                    cursor: 'pointer'
                  }}
                >
                  <Utensils size={15} />
                  <span>Mesa / Comedor</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveryType('TAKE_OUT')}
                  style={{
                    minHeight: '42px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    border: deliveryType === 'TAKE_OUT' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                    background: deliveryType === 'TAKE_OUT' ? '#f0f9ff' : '#ffffff',
                    color: deliveryType === 'TAKE_OUT' ? '#0284c7' : '#475569',
                    cursor: 'pointer'
                  }}
                >
                  <ShoppingBag size={15} />
                  <span>Para Llevar</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveryType('DELIVERY')}
                  style={{
                    minHeight: '42px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    border: deliveryType === 'DELIVERY' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                    background: deliveryType === 'DELIVERY' ? '#f0fdf4' : '#ffffff',
                    color: deliveryType === 'DELIVERY' ? '#16a34a' : '#475569',
                    cursor: 'pointer'
                  }}
                >
                  <Bike size={15} />
                  <span>A Domicilio</span>
                </button>
              </div>

              {/* Destination Fields */}
              {deliveryType === 'DINE_IN' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>
                      Mesa:
                    </label>
                    <select
                      className="input-control"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      style={{ padding: '0.45rem', fontSize: '0.85rem' }}
                    >
                      {DEFAULT_TABLES.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>
                      Cliente (Opcional):
                    </label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="ej. Juan Pérez"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      style={{ padding: '0.45rem', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>
              )}

              {deliveryType === 'TAKE_OUT' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>
                      Nombre del Cliente:
                    </label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="ej. María López"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      style={{ padding: '0.45rem', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>
                      Teléfono WhatsApp:
                    </label>
                    <input
                      type="tel"
                      className="input-control"
                      placeholder="ej. 99887766"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      style={{ padding: '0.45rem', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>
              )}

              {deliveryType === 'DELIVERY' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>
                        Cliente:
                      </label>
                      <input
                        type="text"
                        className="input-control"
                        placeholder="ej. Carlos Mendoza"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        style={{ padding: '0.45rem', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>
                        Teléfono / WhatsApp:
                      </label>
                      <input
                        type="tel"
                        className="input-control"
                        placeholder="ej. 98765432"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        style={{ padding: '0.45rem', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>
                      Dirección de Entrega:
                    </label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="Colonia, calle, bloque o referencia"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      style={{ padding: '0.45rem', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>
                        Costo Envío (L.):
                      </label>
                      <input
                        type="number"
                        className="input-control"
                        value={deliveryFee}
                        onChange={(e) => setDeliveryFee(e.target.value)}
                        style={{ padding: '0.45rem', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>
                        Repartidor Asignado:
                      </label>
                      <select
                        className="input-control"
                        value={selectedDriverId}
                        onChange={(e) => setSelectedDriverId(e.target.value)}
                        style={{ padding: '0.45rem', fontSize: '0.85rem' }}
                      >
                        <option value="">Por asignar / En espera</option>
                        {deliveryDrivers.map(d => (
                          <option key={d.id} value={d.id}>
                            {d.fullName} ({d.driverType === 'INTERNAL' ? 'Interno' : 'Mandadito'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Dish Catalog Browser */}
            <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    className="input-control"
                    placeholder="Buscar platillo o bebida..."
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    style={{ paddingLeft: '2.2rem', paddingRight: '0.75rem', height: '38px', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* Category Pills */}
              <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('TODAS')}
                  style={{
                    padding: '0.3rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: 'none',
                    background: selectedCategory === 'TODAS' ? '#0f172a' : '#f1f5f9',
                    color: selectedCategory === 'TODAS' ? '#ffffff' : '#475569',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Todas ({menuItems.filter(m => m.isAvailable).length})
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      padding: '0.3rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      border: 'none',
                      background: selectedCategory === cat ? '#ea580c' : '#f1f5f9',
                      color: selectedCategory === cat ? '#ffffff' : '#475569',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Dishes Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 140px), 1fr))', gap: '0.75rem', overflowY: 'auto', flex: 1, paddingRight: '0.25rem' }}>
                {filteredMenuItems.map(dish => (
                  <div
                    key={dish.id}
                    onClick={() => handleAddDish(dish)}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                    }}
                  >
                    <div>
                      <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.25 }}>
                        {dish.name}
                      </h4>
                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        {dish.category}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ea580c' }}>
                        {formatCurrency(dish.price, tenant.currencySymbol)}
                      </span>
                      <button
                        type="button"
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          border: 'none',
                          background: '#ffedd5',
                          color: '#ea580c',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                ))}

                {filteredMenuItems.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                    No se encontraron platillos disponibles en el menú.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Order Items Tray & Summary */}
          <div style={{ display: 'flex', flexDirection: 'column', background: '#f8fafc', minHeight: 0 }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                Comanda ({orderItems.reduce((acc, it) => acc + it.quantity, 0)} artículos)
              </h4>
              {orderItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setOrderItems([])}
                  style={{ border: 'none', background: 'transparent', color: '#ef4444', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Vaciar
                </button>
              )}
            </div>

            {/* Items List */}
            <div style={{ padding: '1rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {orderItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <Utensils size={32} style={{ opacity: 0.4 }} />
                  <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>La comanda está vacía</p>
                  <span style={{ fontSize: '0.75rem' }}>Haz clic en los platillos de la izquierda para agregarlos</span>
                </div>
              ) : (
                orderItems.map((item, idx) => {
                  const menuItem = menuItems.find(m => m.id === item.menuItemId);
                  const availableExtras = menuItem?.availableExtras || [];

                  return (
                    <div
                      key={idx}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '0.75rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                      }}
                    >
                      {/* Top line: name, qty controls, price */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <div style={{ flex: 1 }}>
                          <h5 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                            {item.name}
                          </h5>
                          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            {formatCurrency(item.unitPrice, tenant.currencySymbol)} c/u
                          </span>
                        </div>

                        {/* Quantity Stepper */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#f1f5f9', borderRadius: '6px', padding: '0.15rem' }}>
                          <button
                            type="button"
                            onClick={() => handleUpdateItemQuantity(idx, -1)}
                            style={{ width: '24px', height: '24px', borderRadius: '4px', border: 'none', background: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Minus size={13} />
                          </button>
                          <span style={{ fontSize: '0.82rem', fontWeight: 800, minWidth: '18px', textAlign: 'center' }}>
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateItemQuantity(idx, 1)}
                            style={{ width: '24px', height: '24px', borderRadius: '4px', border: 'none', background: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Plus size={13} />
                          </button>
                        </div>

                        {/* Subtotal & Delete */}
                        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                            {formatCurrency(item.subtotal, tenant.currencySymbol)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: '0.2rem' }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Extras Pills */}
                      {availableExtras.length > 0 && (
                        <div>
                          <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Extras:</span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.2rem' }}>
                            {availableExtras.map(extra => {
                              const isSelected = (item.selectedExtras || []).some(e => e.name === extra.name);
                              return (
                                <button
                                  key={extra.id}
                                  type="button"
                                  onClick={() => handleToggleExtra(idx, extra)}
                                  style={{
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '6px',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    border: isSelected ? '1px solid #ea580c' : '1px solid #cbd5e1',
                                    background: isSelected ? '#fff7ed' : '#ffffff',
                                    color: isSelected ? '#ea580c' : '#475569',
                                    cursor: 'pointer'
                                  }}
                                >
                                  {extra.name} (+{formatCurrency(extra.price, tenant.currencySymbol)})
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Kitchen Note Input */}
                      <div>
                        <input
                          type="text"
                          placeholder="Nota cocina (ej. Sin cebolla, aderezo aparte)"
                          value={item.notes || ''}
                          onChange={(e) => handleUpdateItemNote(idx, e.target.value)}
                          style={{
                            width: '100%',
                            fontSize: '0.75rem',
                            padding: '0.35rem 0.5rem',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            background: '#f8fafc',
                            outline: 'none'
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Order Bottom / Actions */}
            <div style={{ padding: '1rem', background: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              
              {/* General Kitchen Notes */}
              <div>
                <input
                  type="text"
                  placeholder="Nota general para la cocina o mesero..."
                  value={generalNotes}
                  onChange={(e) => setGeneralNotes(e.target.value)}
                  style={{
                    width: '100%',
                    fontSize: '0.78rem',
                    padding: '0.45rem 0.65rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    background: '#f8fafc'
                  }}
                />
              </div>

              {/* Totals Summary */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>Subtotal Comida:</span>
                  <span>{formatCurrency(foodSubtotal, tenant.currencySymbol)}</span>
                </div>
                {deliveryType === 'DELIVERY' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                    <span>Costo de Entrega:</span>
                    <span>{formatCurrency(parsedDeliveryFee, tenant.currencySymbol)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', paddingTop: '0.25rem', borderTop: '1px dashed #e2e8f0' }}>
                  <span>Total Comanda:</span>
                  <span style={{ color: '#ea580c' }}>{formatCurrency(orderTotal, tenant.currencySymbol)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => handleSaveOrder(true, false)}
                  style={{
                    minHeight: '44px',
                    padding: '0.6rem 1rem',
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    borderRadius: '8px',
                    border: 'none',
                    background: '#ea580c',
                    color: '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    boxShadow: '0 2px 8px rgba(234, 88, 12, 0.25)'
                  }}
                >
                  <Printer size={16} />
                  <span>Guardar Comanda & Imprimir Cocina</span>
                </button>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => handleSaveOrder(false, false)}
                    style={{
                      flex: '1 1 120px',
                      minHeight: '42px',
                      padding: '0.5rem',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    Solo Guardar
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveOrder(false, true)}
                    style={{
                      flex: '1.2 1 140px',
                      minHeight: '42px',
                      padding: '0.5rem',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      borderRadius: '8px',
                      border: 'none',
                      background: '#059669',
                      color: '#ffffff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <DollarSign size={15} />
                    <span>Cobrar Inmediato</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
