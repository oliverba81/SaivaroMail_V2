import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'SCC-User-Login' })
  @ApiResponse({
    status: 200,
    description: 'Login erfolgreich',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            role: { type: 'string', enum: ['super_admin', 'admin', 'operator'] },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Ungültige Anmeldedaten' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
}
