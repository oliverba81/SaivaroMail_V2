/**
 * Tenant-Context: Speichert die companyId für den aktuellen Request
 * Wird von Middleware gesetzt und von Services verwendet
 */

export interface TenantContext {
  companyId: string | null; // null wenn nur Slug vorhanden
  companySlug?: string;
}

// Thread-local storage für Tenant-Context (Next.js App Router)
// In einer echten Multi-Instance-Umgebung würde man AsyncLocalStorage verwenden
let currentTenantContext: TenantContext | null = null;

export function setTenantContext(context: TenantContext | null): void {
  currentTenantContext = context;
}

export function getTenantContext(): TenantContext | null {
  return currentTenantContext;
}

export function requireTenantContext(): TenantContext {
  const context = getTenantContext();
  if (!context) {
    throw new Error('Tenant-Context nicht gesetzt. Request muss companyId oder companySlug enthalten.');
  }
  if (!context.companyId && !context.companySlug) {
    throw new Error('Tenant-Context muss companyId oder companySlug enthalten.');
  }
  return context;
}

