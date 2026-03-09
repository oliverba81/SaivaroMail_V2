'use client';

import { useEffect } from 'react';

/**
 * Setzt das Cookie saivaro_company, wenn ?company=slug in der URL steht.
 * Ermöglicht, dass nachgelagerte API-Aufrufe (ohne URL-Param) den Tenant-Context behalten.
 */
export default function CompanyParamSync() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const company = params.get('company');
    if (company && /^[a-z0-9-]+$/.test(company)) {
      document.cookie = `saivaro_company=${company}; path=/; max-age=86400`;
    }
  }, []);

  return null;
}
