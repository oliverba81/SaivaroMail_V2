import { IsString, IsOptional, IsInt, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExecuteQueryDto {
  @ApiProperty({
    description: 'SQL-Query zum Ausführen',
    example: 'SELECT * FROM users LIMIT 10',
    maxLength: 100000, // 100 KB Limit
  })
  @IsString()
  @MaxLength(100000, { message: 'Query darf maximal 100 KB lang sein' })
  query: string;

  @ApiPropertyOptional({
    description: 'Maximale Anzahl der zurückgegebenen Zeilen',
    example: 1000,
    default: 1000,
    minimum: 1,
    maximum: 10000,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Query-Timeout in Sekunden',
    example: 30,
    default: 30,
    minimum: 1,
    maximum: 60,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  timeout?: number;
}
