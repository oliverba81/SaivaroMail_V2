import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'E-Mail-Adresse des SCC-Users',
    example: 'admin@saivaro.local',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Passwort',
    example: 'admin123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;
}
