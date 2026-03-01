import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TableDataQueryDto {
  @ApiPropertyOptional({
    description: 'Seitennummer (0-basiert)',
    example: 0,
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  page?: number;

  @ApiPropertyOptional({
    description: 'Anzahl der Zeilen pro Seite',
    example: 50,
    default: 50,
    minimum: 1,
    maximum: 1000,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}
