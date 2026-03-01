import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Health-Check für SCC-API' })
  @ApiResponse({ status: 200, description: 'API ist gesund' })
  async check() {
    return this.healthService.check();
  }

  @Get('db')
  @ApiOperation({ summary: 'Health-Check für SCC-Datenbank' })
  @ApiResponse({ status: 200, description: 'Datenbank ist erreichbar' })
  @ApiResponse({ status: 503, description: 'Datenbank nicht erreichbar' })
  async checkDb() {
    return this.healthService.checkDatabase();
  }
}
