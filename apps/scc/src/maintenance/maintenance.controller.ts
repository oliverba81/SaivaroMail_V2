import { Controller, Post, UseGuards, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MaintenanceService } from './maintenance.service';

@ApiTags('maintenance')
@Controller('maintenance')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Post('restart')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles('super_admin')
  @ApiOperation({
    summary: 'SCC-Service neu starten',
    description:
      'Führt einen graceful shutdown des Services durch. Ein Process Manager (PM2, systemd, Docker, etc.) sollte den Service automatisch neu starten.',
  })
  @ApiResponse({
    status: 202,
    description: 'Service-Neustart wurde angefordert',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Service wird neu gestartet...' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Ungültiges oder fehlendes JWT-Token',
  })
  @ApiResponse({
    status: 403,
    description: 'Unzureichende Berechtigung (nur super_admin)',
  })
  async restart(@Req() req: Request) {
    // User-Informationen aus dem Request extrahieren (für Audit-Logging)
    const user = (req as any).user || {};
    const userId = user.id;
    const userEmail = user.email;

    // Service-Neustart asynchron starten (nicht await, damit Response sofort zurückgegeben wird)
    // Die App-Instanz wird über den Service geholt
    this.maintenanceService.restart(userId, userEmail);

    return {
      message: 'Service wird neu gestartet...',
      timestamp: new Date().toISOString(),
    };
  }
}
