import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ShoppingCart, Package, BookOpen, Menu, Scissors, BarChart3, Settings } from 'lucide-react';

export const MobileBottomNav: React.FC = () => {
  const activeTab = useAppStore(state => state.activeTab);
  const setActiveTab = useAppStore(state => state.setActiveTab);
  const toggleMobileSidebar = useAppStore(state => state.toggleMobileSidebar);
  const tenant = useAppStore(state => state.tenant);
  const currentUser = useAppStore(state => state.currentUser);
  const role = currentUser?.role || 'ADMIN';
  const cartLines = useAppStore(state => state.cartLines);

  const totalCartItems = cartLines.reduce((acc, line) => acc + line.quantity, 0);

  const mainTabs = [
    { id: 'pos', label: 'Ventas', icon: ShoppingCart, badge: totalCartItems > 0 ? totalCartItems : null, show: role === 'ADMIN' || role === 'CAJERO' || role === 'STAFF' },
    { id: 'inventory', label: 'Inventario', icon: Package, show: true },
    { id: 'accounts', label: 'Cuentas', icon: BookOpen, show: role === 'ADMIN' || role === 'CAJERO' },
  ].filter(item => item.show);

  return (
    <nav className="mobile-bottom-nav">
      {mainTabs.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            className={`mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id as any)}
            title={item.label}
          >
            <div className="icon-wrapper">
              <Icon size={20} />
              {item.badge !== null && (
                <span className="mobile-cart-badge">{item.badge}</span>
              )}
            </div>
            <span>{item.label}</span>
          </button>
        );
      })}

      <button
        className="mobile-bottom-nav-item"
        onClick={toggleMobileSidebar}
        title="Menú Más Opciones"
      >
        <div className="icon-wrapper">
          <Menu size={20} />
        </div>
        <span>Menú</span>
      </button>
    </nav>
  );
};
