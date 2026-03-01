# @saivaro/shared

Shared Package für Saivaro Mail - gemeinsame Types, Utilities und API-Clients.

## Inhalt

- **Types**: Gemeinsame TypeScript-Typen für Company, User, DB-Config, etc.
- **Utils**: Utility-Funktionen (Datum-Formatierung, UUID-Validierung, etc.)

## Verwendung

```typescript
import { Company, CompanyStatus, formatDate } from '@saivaro/shared';

const company: Company = {
  id: '...',
  name: 'Example Corp',
  status: CompanyStatus.ACTIVE,
  // ...
};

const formatted = formatDate(company.createdAt);
```

## Build

```bash
pnpm build
```

## Entwicklung

```bash
pnpm dev  # Watch-Mode
```




