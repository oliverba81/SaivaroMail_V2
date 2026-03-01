import { IsEnum, IsOptional, IsString, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ProvisionDatabaseRequest {
  @ApiPropertyOptional({
    description: 'Plan-Typ',
    enum: ['basic', 'premium', 'enterprise'],
    example: 'basic',
  })
  @IsOptional()
  @IsEnum(['basic', 'premium', 'enterprise'])
  plan?: 'basic' | 'premium' | 'enterprise';

  @ApiPropertyOptional({
    description: 'Region (z. B. Hetzner: nbg1, fsn1)',
    example: 'nbg1',
  })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({
    description: 'DB-Server-Typ',
    enum: ['dedicated', 'shared'],
    example: 'shared',
    default: 'shared',
  })
  @IsOptional()
  @IsEnum(['dedicated', 'shared'])
  dbServerType?: 'dedicated' | 'shared';

  @ApiPropertyOptional({
    description: 'Zusätzliche Konfiguration',
    example: { dbVersion: '15', storageSize: 100 },
  })
  @IsOptional()
  @IsObject()
  customConfig?: {
    dbVersion?: string;
    storageSize?: number; // GB
  };
}
