/**
 * Progressive Web App (PWA) & Store Persistence Utilities
 * Manages device-level store pinning (similar to Netflix / Spotify account locking)
 */

let deferredInstallPrompt: any = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    window.dispatchEvent(new CustomEvent('pwa-installable'));
  });
}

/**
 * Registers the Service Worker required for Chrome Desktop PWA installability
 */
export function registerServiceWorker(): void {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker activo:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA] Error al registrar Service Worker:', err);
        });
    });
  }
}

/**
 * Checks whether the native install prompt is currently ready and deferred
 */
export function hasInstallPrompt(): boolean {
  return deferredInstallPrompt !== null;
}

/**
 * Checks whether the app is currently running as an installed standalone PWA
 */
export function isPwaStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

/**
 * Retrieves the currently remembered store slug from persistent local storage
 */
export function getRememberedStoreSlug(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('micuadre_remembered_store_slug');
}

/**
 * Retrieves the currently remembered tenant UUID from persistent local storage
 */
export function getRememberedTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('micuadre_remembered_tenant_id');
}

/**
 * Pins a store to this device/browser so it always opens directly into that account
 */
export function setRememberedStore(slug: string, tenantId?: string): void {
  if (typeof window === 'undefined') return;
  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9]/g, '');
  localStorage.setItem('micuadre_remembered_store_slug', cleanSlug);
  if (tenantId) {
    localStorage.setItem('micuadre_remembered_tenant_id', tenantId);
  }
}

/**
 * Unpins the store, allowing the user to return to the public landing page or switch stores
 */
export function clearRememberedStore(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('micuadre_remembered_store_slug');
  localStorage.removeItem('micuadre_remembered_tenant_id');
}

/**
 * Updates browser title and ensures the valid static manifest link is preserved.
 * Store routing is preserved via client-side local storage pinning (Netflix architecture).
 */
export function updateDynamicManifest(tenantName: string, storeSlug: string): void {
  if (typeof document === 'undefined') return;
  try {
    document.title = `MiCuadre - ${tenantName}`;
    const manifestEl = document.getElementById('app-manifest') as HTMLLinkElement;
    if (manifestEl && manifestEl.getAttribute('href') !== '/manifest.json') {
      manifestEl.setAttribute('href', '/manifest.json');
    }
  } catch (err) {
    console.warn('Error al actualizar metadata de tienda:', err);
  }
}

/**
 * Prompts the native browser PWA installation dialog if available
 */
export async function promptPwaInstall(): Promise<{ outcome: 'accepted' | 'dismissed' | 'unsupported' }> {
  if (deferredInstallPrompt) {
    try {
      deferredInstallPrompt.prompt();
      const choiceResult = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      return { outcome: choiceResult.outcome };
    } catch (e) {
      return { outcome: 'unsupported' };
    }
  }
  return { outcome: 'unsupported' };
}
