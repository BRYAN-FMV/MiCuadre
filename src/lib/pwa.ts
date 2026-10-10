/**
 * Progressive Web App (PWA) & Store Persistence Utilities
 * Manages device-level store pinning (similar to Netflix / Spotify account locking)
 */

let deferredInstallPrompt: any = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredInstallPrompt = e;
  });
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
 * Dynamically updates the Web App Manifest so that installing the PWA from a
 * personalized store link creates an app shortcut specifically bound to that store.
 */
export function updateDynamicManifest(tenantName: string, storeSlug: string): void {
  if (typeof document === 'undefined') return;
  try {
    const manifestEl = document.getElementById('app-manifest') as HTMLLinkElement;
    if (!manifestEl) return;

    const cleanSlug = storeSlug.toLowerCase().replace(/[^a-z0-9]/g, '');
    const dynamicManifest = {
      name: `MiCuadre - ${tenantName}`,
      short_name: tenantName.length > 15 ? tenantName.slice(0, 15) : tenantName,
      description: `Terminal POS y Facturación Comercial para ${tenantName}`,
      start_url: `/?tienda=${cleanSlug}`,
      scope: '/',
      display: 'standalone',
      orientation: 'any',
      background_color: '#0f172a',
      theme_color: '#0f172a',
      icons: [
        {
          src: '/MiCuadre-logo.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable'
        },
        {
          src: '/logo.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ]
    };

    const blob = new Blob([JSON.stringify(dynamicManifest, null, 2)], {
      type: 'application/manifest+json'
    });
    const manifestURL = URL.createObjectURL(blob);
    manifestEl.setAttribute('href', manifestURL);
  } catch (err) {
    console.warn('No se pudo actualizar el manifiesto dinámico:', err);
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
