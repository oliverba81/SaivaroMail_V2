import { ApiProperty } from '@nestjs/swagger';
import { StorageUsage, DatabaseStorageUsage, FileStorageUsage } from '@saivaro/shared';

export class TableStorageInfoDto {
  @ApiProperty({ description: 'Tabellenname' })
  tableName: string;

  @ApiProperty({ description: 'Tabellengröße in Bytes (ohne Indizes, inkl. TOAST)' })
  sizeBytes: number;

  @ApiProperty({ description: 'Gesamtgröße in Bytes (mit Indizes, inkl. TOAST)' })
  totalSizeBytes: number;

  @ApiProperty({ description: 'Index-Größe in Bytes' })
  indexSizeBytes: number;

  @ApiProperty({ description: 'Formatierte Tabellengröße' })
  size: string;

  @ApiProperty({ description: 'Formatierte Gesamtgröße' })
  totalSize: string;

  @ApiProperty({ description: 'Anzahl der Zeilen' })
  rowCount: number;
}

export class DatabaseStorageUsageDto implements DatabaseStorageUsage {
  @ApiProperty({ description: 'Gesamtgröße der Datenbank in Bytes' })
  totalSizeBytes: number;

  @ApiProperty({ description: 'Formatierte Gesamtgröße' })
  totalSize: string;

  @ApiProperty({ description: 'Tabellengröße in Bytes (ohne Indizes, inkl. TOAST)' })
  tableSizeBytes: number;

  @ApiProperty({ description: 'Index-Größe in Bytes' })
  indexSizeBytes: number;

  @ApiProperty({ description: 'Liste der Tabellen', type: [TableStorageInfoDto] })
  tables: TableStorageInfoDto[];
}

export class FileCategoryDto {
  @ApiProperty({ description: 'Größe in Bytes' })
  sizeBytes: number;

  @ApiProperty({ description: 'Formatierte Größe' })
  size: string;

  @ApiProperty({ description: 'Anzahl der Dateien' })
  count: number;
}

export class FileStorageUsageDto implements FileStorageUsage {
  @ApiProperty({ description: 'Gesamtgröße der Dateien in Bytes' })
  totalSizeBytes: number;

  @ApiProperty({ description: 'Formatierte Gesamtgröße' })
  totalSize: string;

  @ApiProperty({ description: 'E-Mail-Anhänge', type: FileCategoryDto })
  attachments: FileCategoryDto;

  @ApiProperty({ description: 'Hochgeladene Dateien', type: FileCategoryDto })
  uploads: FileCategoryDto;

  @ApiProperty({ description: 'Sonstige Dateien', type: FileCategoryDto })
  other: FileCategoryDto;
}

export class StorageUsageDto implements StorageUsage {
  @ApiProperty({ description: 'Datenbank-Speicherplatz', type: DatabaseStorageUsageDto })
  database: DatabaseStorageUsageDto;

  @ApiProperty({ description: 'Dateispeicherplatz', type: FileStorageUsageDto })
  files: FileStorageUsageDto;

  @ApiProperty({ description: 'Gesamt-Speicherplatz' })
  total: {
    sizeBytes: number;
    size: string;
  };

  @ApiProperty({ description: 'Zeitstempel der letzten Aktualisierung (ISO)' })
  lastUpdated: string;
}
