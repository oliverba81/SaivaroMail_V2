import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsObject,
  IsDateString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CronJobType, CronJobStatus } from '@prisma/client';

// Enum-Werte für Validierung (als const arrays)
const CronJobTypeValues = ['scheduled_trigger', 'email_fetch'] as const;
const CronJobStatusValues = ['running', 'success', 'failed'] as const;

export class LogCronJobDto {
  @ApiProperty({ description: 'Company UUID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  companyId: string;

  @ApiProperty({ description: 'Job-Typ', enum: CronJobTypeValues })
  @IsEnum(CronJobTypeValues)
  jobType: CronJobType;

  @ApiProperty({ description: 'Eindeutiger Job-Key', example: 'scheduled-rule:companyId:ruleId' })
  @IsString()
  jobKey: string;

  @ApiProperty({ description: 'Status', enum: CronJobStatusValues })
  @IsEnum(CronJobStatusValues)
  status: CronJobStatus;

  @ApiProperty({ description: 'Start-Zeitpunkt (ISO-String)', example: '2024-01-01T10:00:00.000Z' })
  @IsDateString()
  startedAt: string;

  @ApiPropertyOptional({ description: 'End-Zeitpunkt (ISO-String)' })
  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @ApiPropertyOptional({ description: 'Ausführungszeit in Millisekunden' })
  @IsOptional()
  @IsNumber()
  executionTimeMs?: number;

  @ApiPropertyOptional({ description: 'Anzahl verarbeiteter Items (z.B. E-Mails)' })
  @IsOptional()
  @IsNumber()
  processedItems?: number;

  @ApiPropertyOptional({ description: 'Fehlermeldung (bei failed Status)' })
  @IsOptional()
  @IsString()
  errorMessage?: string;

  @ApiPropertyOptional({ description: 'Zusätzliche Metadaten (JSON)' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Log-ID für Update (optional)' })
  @IsOptional()
  @IsUUID()
  logId?: string;
}
