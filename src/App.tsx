import React, { useEffect, useState } from 'react';
import { useAppStore } from './store/useAppStore';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { LoginView } from './components/auth/LoginView';
import { PosContainer } from './components/pos/PosContainer';
import { InventoryManager } from './components/inventory/InventoryManager';
import { PurchaseManager } from './components/purchases/PurchaseManager';
import { ServicesAppointments } from './components/services/ServicesAppointments';
import { FinancialCalendar } from './components/calendar/FinancialCalendar';
import { ReportsView } from './components/reports/ReportsView';
import { SettingsView } from './components/settings/SettingsView';
import { SuperAdminDashboard } from './components/superadmin/SuperAdminDashboard';
import { AccountsView } from './components/accounts/AccountsView';
import { CashShiftModal } from './components/shifts/CashShiftModal';
import { OnboardingTour } from './components/onboarding/OnboardingTour';
import { Toaster, toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { isSupabaseConfigured } from './lib/supabase';
import {
  fetchProductsFromSupabase,
  fetchSuppliersFromSupabase,
  fetchProfilesFromSupabase,
  fetchTenantsFromSupabase,
  fetchSalesFromSupabase,
  fetchFiscalRangesFromSupabase,
  pushLocalDataToCloud,
  syncAllCloudData,
  processOfflineQueue
} from './lib/supabaseService';

import { LandingView } from './components/landing/LandingView';
import { MobileBottomNav } from './components/layout/MobileBottomNav';

export const App: React.FC = () => {
  const activeTab = useAppStore(state => state.activeTab);
  const isAuthenticated = useAppStore(state => state.isAuthenticated);
  const tenant = useAppStore(state => state.tenant);
  const currentUser = useAppStore(state => state.currentUser);

  // Determine if landing page should be shown (root path '/' with no store param)
  const urlParamsOnLoad = new URLSearchParams(window.location.search);
  const hasStoreParamOnLoad = urlParamsOnLoad.has('comercio') || urlParamsOnLoad.has('tienda') || urlParamsOnLoad.has('store') || urlParamsOnLoad.has('id');
  const [showLanding, setShowLanding] = useState(!hasStoreParamOnLoad && (window.location.pathname === '/' || window.location.pathname === '/index.html'));

  // Dedicated Route State for /admin URL
  const [isAdminRoute, setIsAdminRoute] = useState(
    window.location.pathname.endsWith('/admin') ||
    window.location.search.includes('admin=true') ||
    window.location.hash === '#admin'
  );

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const hasStore = params.has('comercio') || params.has('tienda') || params.has('store') || params.has('id');
      const isAdmin = window.location.pathname.endsWith('/admin') || window.location.search.includes('admin=true') || window.location.hash === '#admin';

      setIsAdminRoute(isAdmin);
      if (!hasStore && (window.location.pathname === '/' || window.location.pathname === '/index.html') && !isAdmin) {
        useAppStore.setState({ isAuthenticated: false });
        setShowLanding(true);
      }
    };

    // Ensure root URL without params always starts at Landing Page unauthenticated
    const paramsOnStart = new URLSearchParams(window.location.search);
    const hasStoreOnStart = paramsOnStart.has('comercio') || paramsOnStart.has('tienda') || paramsOnStart.has('store') || paramsOnStart.has('id');
    if (!hasStoreOnStart && (window.location.pathname === '/' || window.location.pathname === '/index.html')) {
      useAppStore.setState({ isAuthenticated: false });
      setShowLanding(true);
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 1. Synchronize URL tenant parameter (?comercio=slug, ?tienda=slug or /slug) on startup
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const rawSlug = urlParams.get('comercio') || urlParams.get('tienda') || urlParams.get('store');

    if (rawSlug) {
      setShowLanding(false);
      const cleanSlug = rawSlug.toLowerCase().replace(/[^a-z0-9]/g, '');

      fetchTenantsFromSupabase().then(cloudTenants => {
        const localTenants = useAppStore.getState().tenants || [];
        const allTenants = [...(cloudTenants || [])];
        for (const lt of localTenants) {
          if (!allTenants.some(ct => ct.id === lt.id)) {
            allTenants.push(lt);
          }
        }

        if (allTenants.length > 0) {
          const matched = allTenants.find(t =>
            t.id === rawSlug ||
            t.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(cleanSlug) ||
            t.name.toLowerCase().includes(rawSlug.toLowerCase())
          );

          if (matched) {
            useAppStore.setState({ tenant: matched, isAuthenticated: false });
          }
        }
      });
    }
  }, []);

  // 2. Hydrate real database data from Supabase strictly for active tenant
  const activeShift = useAppStore(state => state.activeShift);
  const isShiftModalOpen = useAppStore(state => state.isShiftModalOpen);
  const setActiveTab = useAppStore(state => state.setActiveTab);

  // 3. Role-based Shift Opening Enforcement & Tab Access Protection
  useEffect(() => {
    if (isAuthenticated && tenant?.id) {
      const userRole = currentUser?.role || 'ADMIN';
      const isShiftOpen = activeShift && activeShift.tenantId === tenant.id && activeShift.status === 'OPEN';

      // CAJERO role strictly requires open shift on launch
      if (userRole === 'CAJERO' && !isShiftOpen && !isShiftModalOpen) {
        useAppStore.setState({ isShiftModalOpen: true });
      }

      // Tab Protection for non-ADMIN roles
      if (userRole !== 'ADMIN') {
        const adminOnlyTabs = ['calendar', 'reports', 'settings'];
        if (adminOnlyTabs.includes(activeTab)) {
          const fallbackTab = (userRole === 'BODEGUERO') ? 'inventory' : 'pos';
          setActiveTab(fallbackTab);
          toast.warning(`Acceso restringido para el perfil ${userRole}`);
        }
      }
    }
  }, [isAuthenticated, activeShift, tenant?.id, isShiftModalOpen, currentUser?.role, activeTab]);

  // Ensure tenant profile consistency and admin profile availability
  useEffect(() => {
    if (tenant?.id && currentUser && currentUser.tenantId !== tenant.id) {
      const allProfiles = useAppStore.getState().profiles;
      const tenantProfiles = allProfiles.filter(p => p.tenantId === tenant.id);

      let adminProfile = tenantProfiles.find(p => p.role === 'ADMIN');
      if (!adminProfile) {
        adminProfile = {
          id: `admin-${tenant.id}`,
          tenantId: tenant.id,
          fullName: `${tenant.name} (ADMIN)`,
          role: 'ADMIN',
          pinCode: '1234',
          isActive: true
        };
        useAppStore.setState(state => ({ profiles: [adminProfile!, ...state.profiles] }));
      }

      useAppStore.setState({ currentUser: adminProfile, isAuthenticated: false });
    }
  }, [tenant?.id, currentUser?.tenantId]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const state = useAppStore.getState();
      const isShiftOpen = state.activeShift && state.activeShift.tenantId === state.tenant?.id && state.activeShift.status === 'OPEN';
      const isNonAdmin = state.currentUser?.role !== 'ADMIN';
      if (state.isAuthenticated && isNonAdmin && isShiftOpen) {
        e.preventDefault();
        e.returnValue = 'Tienes un turno de caja registradora abierto. Debes realizar el Arqueo Ciego y Cierre Z antes de salir o cerrar la ventana.';
      }
    };

    const handleOnline = () => {
      toast.success('Conexión restablecida. Sincronizando datos offline...');
      processOfflineQueue();
      if (tenant?.id) {
        syncAllCloudData(tenant.id);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('online', handleOnline);

    if (isSupabaseConfigured() && tenant?.id) {
      // 1. Process offline queue and push any local records to cloud
      processOfflineQueue();
      pushLocalDataToCloud(tenant.id).then(() => {
        // 2. Initial cloud state hydration
        syncAllCloudData(tenant.id);
      });

      // 3. Periodic cloud polling every 8 seconds for real-time multi-device sync
      const syncInterval = setInterval(() => {
        syncAllCloudData(tenant.id);
      }, 8000);

      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('online', handleOnline);
        clearInterval(syncInterval);
      };
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('online', handleOnline);
    };
  }, [tenant?.id, isAuthenticated]);

  // Handle dedicated SuperAdmin Route (/admin)
  if (isAdminRoute) {
    return (
      <>
        <Toaster position="top-right" theme="light" richColors closeButton />
        <SuperAdminDashboard
          onExit={() => {
            window.history.pushState({}, '', '/');
            window.dispatchEvent(new Event('popstate'));
          }}
        />
      </>
    );
  }

  if (!isAuthenticated) {
    if (showLanding) {
      return (
        <>
          <Toaster position="top-right" theme="light" richColors closeButton />
          <LandingView
            onSelectStore={(selectedTenant) => {
              useAppStore.setState({ tenant: selectedTenant, isAuthenticated: false });
              setShowLanding(false);
            }}
            onEnterDemo={() => {
              const demoTenant = useAppStore.getState().tenants?.find(t => t.id === '00000000-0000-0000-0000-000000000001') || useAppStore.getState().tenant;
              useAppStore.setState({ tenant: demoTenant, isAuthenticated: false });
              setShowLanding(false);
            }}
          />
        </>
      );
    }

    return (
      <>
        <Toaster position="top-right" theme="light" richColors closeButton />
        <LoginView onBackToLanding={() => setShowLanding(true)} />
      </>
    );
  }

  const emulatingTenant = sessionStorage.getItem('micuadre_emulating_tenant');

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Toast Notifications Provider */}
      <Toaster position="top-right" theme="light" richColors closeButton />

      {/* Support Emulation Banner */}
      {emulatingTenant && (
        <div className="support-banner">
          <span><AlertTriangle size={15} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.35rem', color: '#f59e0b' }} /> <strong>Modo Soporte Técnico SaaS:</strong> Estás inspeccionando el comercio <strong>"{tenant.name}"</strong>.</span>
          <button
            onClick={() => {
              sessionStorage.removeItem('micuadre_emulating_tenant');
              window.history.pushState({}, '', '/admin');
              window.dispatchEvent(new Event('popstate'));
            }}
            style={{ background: '#10b981', color: '#ffffff', border: 'none', padding: '0.35rem 0.65rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap' }}
          >
            Volver a Panel SaaS Admin (/admin)
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Driver.js Interactive Onboarding Tour */}
        <OnboardingTour />

        {/* Navigation Sidebar */}
        <Sidebar />

        {/* Main Workspace */}
        <main className="main-content">
          <Header />

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {activeTab === 'pos' && <PosContainer />}
            {activeTab === 'inventory' && <InventoryManager />}
            {activeTab === 'purchases' && <PurchaseManager />}
            {activeTab === 'accounts' && <AccountsView />}
            {activeTab === 'services' && <ServicesAppointments />}
            {activeTab === 'calendar' && <FinancialCalendar />}
            {activeTab === 'reports' && <ReportsView />}
            {activeTab === 'settings' && <SettingsView />}
            {activeTab === 'superadmin' && <SuperAdminDashboard />}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (UI/UX Pro Max Guideline) */}
      <MobileBottomNav />

      {/* Cash Shift Modal */}
      <CashShiftModal />
    </div>
  );
};

export default App;
