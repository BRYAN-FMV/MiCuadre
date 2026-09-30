/**
 * Security, Cryptography & UUID Utilities for MiCuadre.app
 */
import { Tenant } from '../types';

/**
 * Validates whether a given string is a valid PostgreSQL UUID v4 (8-4-4-4-12 hex format)
 */
export function isValidUUID(str: string | null | undefined): boolean {
  if (!str || typeof str !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str.trim());
}

/**
 * Generates a valid v4 RFC4122 compliant UUID
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Ensures a tenant object has a valid PostgreSQL UUID
 */
export function ensureValidUUIDTenant(tenant: Tenant): Tenant {
  if (!tenant) return tenant;
  if (isValidUUID(tenant.id)) return tenant;
  return {
    ...tenant,
    id: generateUUID()
  };
}

/**
 * Hashes a 4-digit PIN code using SHA-256 with a unique application salt
 */
export async function hashPinCode(pin: string): Promise<string> {
  if (!pin) return '';
  
  // If already a 64-character SHA-256 hex string, return as-is
  if (pin.length === 64 && /^[a-f0-9]+$/i.test(pin)) {
    return pin;
  }

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(`micuadre_salt_2026_${pin}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    console.warn('Fallback PIN hashing:', err);
    return pin;
  }
}

/**
 * Verifies if a user input PIN matches the stored PIN hash (or legacy plain text PIN)
 */
export async function verifyPinCode(inputPin: string, storedPinHash: string): Promise<boolean> {
  if (!inputPin || !storedPinHash) return false;

  // 1. Direct match check (legacy 4-digit PINs e.g. "1234")
  if (storedPinHash === inputPin) return true;

  // 2. SHA-256 hash comparison
  const hashedInput = await hashPinCode(inputPin);
  return hashedInput.toLowerCase() === storedPinHash.toLowerCase();
}
