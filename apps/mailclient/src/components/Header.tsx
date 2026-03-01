'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function Header() {
  const [_user, setUser] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const userData = localStorage.getItem('mailclient_user');
    if (userData) {
      try {
        const parsed = JSON.parse(userData);
        setUser(parsed.username || parsed.email || 'Benutzer');
      } catch {
        setUser('Benutzer');
      }
    }
  }, []);

  // Kontextabhängiger Titel basierend auf der Route
  const getPageTitle = () => {
    if (pathname?.startsWith('/emails/settings')) {
      return 'Einstellungen';
    }
    if (pathname?.startsWith('/emails/')) {
      return 'Posteingang';
    }
    if (pathname === '/emails') {
      return 'Posteingang';
    }
    return 'E-Mails';
  };

  return (
    <div className="bg-white shadow-sm border-b border-gray-200 px-8 py-4 flex justify-between items-center sticky top-0 z-[100]">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">{getPageTitle()}</h1>
      </div>
      <div className="flex gap-3 items-center">
        {/* Hier können später weitere Aktionen hinzugefügt werden */}
      </div>
    </div>
  );
}

