import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompanyStatus } from '@prisma/client';

export class CreateCompanyDto {
  @ApiProperty({
    description: 'Name der Firma',
    example: 'Example Corporation',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Eindeutiger Slug (für Subdomain)',
    example: 'example-corp',
  })
  @IsString()
  slug: string;

  @ApiPropertyOptional({
    description: 'Status der Company',
    enum: CompanyStatus,
    default: CompanyStatus.active,
  })
  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;

  @ApiPropertyOptional({
    description: 'Plan-Typ',
    example: 'basic',
    default: 'basic',
  })
  @IsOptional()
  @IsString()
  plan?: string;

  @ApiPropertyOptional({
    description: 'Zusätzliche Metadaten (JSON)',
    example: { customField: 'value' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Kontakt: Adresse' })
  @IsOptional()
  @IsString()
  contactAddress?: string;

  @ApiPropertyOptional({ description: 'Kontakt: Telefon' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'Kontakt: E-Mail' })
  @IsOptional()
  @IsString()
  contactEmail?: string;

  @ApiPropertyOptional({ description: 'Kontakt: Website' })
  @IsOptional()
  @IsString()
  contactWebsite?: string;
}
