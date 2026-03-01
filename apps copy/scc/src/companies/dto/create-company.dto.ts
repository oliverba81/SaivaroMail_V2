import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';
import { CompanyStatus } from '@prisma/client';

export class CreateCompanyDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;

  @IsOptional()
  @IsString()
  plan?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

