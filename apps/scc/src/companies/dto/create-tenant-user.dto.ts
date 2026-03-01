import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, IsOptional, Matches } from 'class-validator';

export class CreateTenantUserDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'E-Mail-Adresse des Users (wird für Benutzername verwendet)',
  })
  @Matches(/^[a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|localhost)$/, {
    message: 'email must be an email (localhost domains are allowed for testing)',
  })
  email: string;

  @ApiProperty({ example: 'password123', description: 'Passwort für den User', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Max', description: 'Vorname', required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ example: 'Mustermann', description: 'Nachname', required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({
    example: 'user',
    description: 'Rolle (admin, user, viewer)',
    required: false,
    default: 'user',
  })
  @IsOptional()
  @IsString()
  role?: string;
}
