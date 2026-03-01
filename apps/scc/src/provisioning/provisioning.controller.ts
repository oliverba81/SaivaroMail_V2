import { Controller, Post, Get, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ProvisioningService } from './provisioning.service';
import { ProvisionDatabaseRequest } from './dto/provision-database.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('provisioning')
@ApiBearerAuth('JWT-auth')
@Controller('admin/provisioning')
@UseGuards(JwtAuthGuard)
export class ProvisioningController {
  constructor(private readonly provisioningService: ProvisioningService) {}

  @Post('companies/:id/provision-db')
  @ApiOperation({ summary: 'DB für Company provisionieren (Admin)' })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Provisionierung gestartet' })
  @ApiResponse({ status: 404, description: 'Company nicht gefunden' })
  async provisionDatabase(
    @Param('id') companyId: string,
    @Body() request: ProvisionDatabaseRequest
  ) {
    return this.provisioningService.provisionDatabase(companyId, request);
  }

  @Get('status/:provisioningId')
  @ApiOperation({ summary: 'Provisionierungs-Status abrufen' })
  @ApiParam({ name: 'provisioningId', description: 'Provisionierungs-ID' })
  @ApiResponse({ status: 200, description: 'Provisionierungs-Status' })
  @ApiResponse({ status: 404, description: 'Provisionierung nicht gefunden' })
  async getProvisioningStatus(@Param('provisioningId') provisioningId: string) {
    return this.provisioningService.getProvisioningStatus(provisioningId);
  }

  @Delete('companies/:id/deprovision-db')
  @ApiOperation({ summary: 'DB für Company deprovisionieren' })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Deprovisionierung erfolgreich' })
  @ApiResponse({ status: 404, description: 'Company oder DB-Config nicht gefunden' })
  async deprovisionDatabase(@Param('id') companyId: string) {
    return this.provisioningService.deprovisionDatabase(companyId);
  }
}
