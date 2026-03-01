/**
 * Gemeinsame Type-Definitionen für Saivaro Mail
 */

export enum CompanyStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  INACTIVE = 'inactive',
}

export enum ProvisioningStatus {
  PENDING = 'pending',
  PROVISIONING = 'provisioning',
  READY = 'ready',
  FAILED = 'failed',
}

export enum HealthStatus {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown',
}

export enum SccUserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  OPERATOR = 'operator',
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  status: CompanyStatus;
  plan: string;
  metadata?: Record<string, any>;
  contactAddress?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  contactWebsite?: string | null;
  createdAt: string;
  updatedAt: string;
  dbConfig?: CompanyDbConfig;
}

export interface CompanyDbConfig {
  id: string;
  companyId: string;
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword?: string; // Optional, wird nicht immer zurückgegeben
  dbSslMode: string;
  provisioningStatus: ProvisioningStatus;
  provisionedAt?: string;
  lastHealthCheck?: string;
  healthStatus: HealthStatus;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>; // Company metadata (z.B. maxEmailsPerPage)
}

export interface SccUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: SccUserRole;
  status: 'active' | 'inactive';
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

export interface ProvisionDatabaseRequest {
  plan?: 'basic' | 'premium' | 'enterprise';
  region?: string;
  dbServerType?: 'dedicated' | 'shared';
  customConfig?: {
    dbVersion?: string;
    storageSize?: number;
  };
}

export interface ProvisionDatabaseResponse {
  provisioningId: string;
  status: ProvisioningStatus;
  dbConfig?: Omit<CompanyDbConfig, 'dbPassword'>;
}

export interface StorageUsage {
  database: DatabaseStorageUsage;
  files: FileStorageUsage;
  total: {
    sizeBytes: number;
    size: string;
  };
  lastUpdated: string; // ISO timestamp
}

export interface DatabaseStorageUsage {
  totalSizeBytes: number;
  totalSize: string;
  tableSizeBytes: number; // Tabellendaten (inkl. TOAST)
  indexSizeBytes: number; // Nur Indizes
  tables: TableStorageInfo[];
}

export interface TableStorageInfo {
  tableName: string;
  sizeBytes: number; // Tabellengröße ohne Indizes (inkl. TOAST)
  totalSizeBytes: number; // Mit Indizes (inkl. TOAST)
  indexSizeBytes: number; // Nur Index-Größe
  size: string; // Formatierte Größe
  totalSize: string; // Formatierte Gesamtgröße
  rowCount: number;
}

export interface FileStorageUsage {
  totalSizeBytes: number;
  totalSize: string;
  attachments: {
    sizeBytes: number;
    size: string;
    count: number;
  };
  uploads: {
    sizeBytes: number;
    size: string;
    count: number;
  };
  other: {
    sizeBytes: number;
    size: string;
    count: number;
  };
}

