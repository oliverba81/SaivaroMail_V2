import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCompanyFeaturesDto {
  @ApiProperty({
    description:
      'Audio-Features aktivieren/deaktivieren (E-Mail vorlesen und Zusammenfassung als Audio)',
    required: false,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  audioFeatures?: boolean;
}
