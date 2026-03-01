'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  showHome?: boolean;
}

export default function Breadcrumb({ items, showHome = true }: BreadcrumbProps) {
  const pathname = usePathname();

  // Automatische Breadcrumb-Generierung basierend auf pathname
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const breadcrumbs: BreadcrumbItem[] = [];

    if (showHome) {
      breadcrumbs.push({ label: 'Start', href: '/' });
    }

    if (pathname?.startsWith('/emails/settings')) {
      breadcrumbs.push({ label: 'Einstellungen', href: '/emails/settings' });

      // Zusätzliche Breadcrumb-Items basierend auf Query-Parametern oder State
      // Diese können von der Parent-Komponente übergeben werden
      if (items && items.length > 0) {
        breadcrumbs.push(...items);
      }
    } else if (pathname?.startsWith('/emails')) {
      breadcrumbs.push({ label: 'Posteingang', href: '/emails' });
    }

    return breadcrumbs;
  };

  const breadcrumbs = items && items.length > 0 ? items : generateBreadcrumbs();

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-2 mb-4 text-sm"
    >
      {breadcrumbs.map((item, index) => {
        const isLast = index === breadcrumbs.length - 1;

        return (
          <span key={index} className="flex items-center gap-2">
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="text-primary no-underline transition-colors hover:text-primary-hover"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-gray-800 font-semibold' : 'text-gray-500 font-normal'}>
                {item.label}
              </span>
            )}
            {!isLast && (
              <span className="text-gray-500 mx-1">›</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

