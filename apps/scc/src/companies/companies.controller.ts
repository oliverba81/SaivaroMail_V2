import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateCompanyFeaturesDto } from './dto/update-company-features.dto';
import { CreateTenantUserDto } from './dto/create-tenant-user.dto';
import { ExecuteQueryDto } from './dto/execute-query.dto';
import { TableDataQueryDto } from './dto/table-data.dto';
import { StorageUsageDto } from './dto/storage-usage.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { ProvisioningService } from '../provisioning/provisioning.service';
import { ProvisionDatabaseRequest } from '../provisioning/dto/provision-database.dto';
import { ApiQuery } from '@nestjs/swagger';

@ApiTags('companies')
@ApiBearerAuth('JWT-auth')
@Controller('companies')
@UseGuards(JwtAuthGuard)
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly provisioningService: ProvisioningService
  ) {}

  @Post()
  @ApiOperation({ summary: 'Neue Company anlegen' })
  @ApiResponse({ status: 201, description: 'Company erfolgreich erstellt' })
  @ApiResponse({ status: 400, description: 'Ungültige Eingabedaten' })
  create(@Body() createCompanyDto: CreateCompanyDto) {
    return this.companiesService.create(createCompanyDto);
  }

  @Get()
  @ApiOperation({ summary: 'Liste aller Companies' })
  @ApiResponse({ status: 200, description: 'Liste der Companies' })
  findAll() {
    return this.companiesService.findAll();
  }

  // WICHTIG: Diese Route muss VOR der generischen Route @Get(':id') stehen!
  @Get('ready')
  @Public() // Öffentlicher Endpoint, keine Auth erforderlich
  @ApiOperation({
    summary: 'Liste aller bereiten Companies (intern)',
    description:
      'Gibt alle Companies mit provisioningStatus = "ready" zurück. Für interne Services wie Cron-Service.',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste der bereiten Companies',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Interner Serverfehler' })
  getReadyCompanies() {
    return this.companiesService.findReadyCompanies();
  }

  // Spezifische Routen müssen VOR generischen Routen stehen
  @Delete(':id/tenant-users/:userId')
  @ApiOperation({ summary: 'User aus Tenant-DB löschen' })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User erfolgreich gelöscht' })
  @ApiResponse({ status: 404, description: 'Company oder User nicht gefunden' })
  async deleteTenantUser(@Param('id') id: string, @Param('userId') userId: string) {
    return this.companiesService.deleteTenantUser(id, userId);
  }

  @Patch(':id/tenant-users/:userId')
  @ApiOperation({ summary: 'User in Tenant-DB aktualisieren (z. B. Status ändern)' })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User erfolgreich aktualisiert' })
  @ApiResponse({ status: 404, description: 'Company oder User nicht gefunden' })
  async updateTenantUser(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() updateData: { status?: string; role?: string }
  ) {
    return this.companiesService.updateTenantUser(id, userId, updateData);
  }

  @Get(':id/tenant-users')
  @ApiOperation({ summary: 'User-Daten aus Tenant-DB abrufen' })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Liste der Tenant-User' })
  @ApiResponse({ status: 404, description: 'Company nicht gefunden' })
  async getTenantUsers(@Param('id') id: string) {
    return this.companiesService.getTenantUsers(id);
  }

  @Post(':id/tenant-users')
  @ApiOperation({ summary: 'Test-User in Tenant-DB erstellen' })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  @ApiResponse({ status: 201, description: 'User erfolgreich erstellt' })
  @ApiResponse({ status: 400, description: 'Ungültige Eingabedaten oder User existiert bereits' })
  @ApiResponse({ status: 404, description: 'Company nicht gefunden' })
  async createTenantUser(
    @Param('id') id: string,
    @Body() createTenantUserDto: CreateTenantUserDto
  ) {
    return this.companiesService.createTenantUser(id, createTenantUserDto);
  }

  @Get(':id/db-config/with-password')
  @Public() // Öffentlicher Endpoint, keine Auth erforderlich
  @ApiOperation({
    summary: 'DB-Config mit entschlüsseltem Passwort (intern)',
    description:
      'Interner Endpoint für Mailclient. Gibt DB-Config mit entschlüsseltem Passwort zurück. Keine Auth erforderlich.',
  })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'DB-Config mit Passwort' })
  @ApiResponse({ status: 404, description: 'DB-Config nicht gefunden' })
  async getDbConfigWithPassword(@Param('id') id: string) {
    return this.companiesService.getDbConfigWithPassword(id);
  }

  @Get(':id/db-config')
  @ApiOperation({ summary: 'DB-Config abrufen (ohne Passwort)' })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'DB-Config' })
  @ApiResponse({ status: 404, description: 'DB-Config nicht gefunden' })
  getDbConfig(@Param('id') id: string) {
    return this.companiesService.getDbConfig(id);
  }

  @Post(':id/provision-db')
  @ApiOperation({ summary: 'DB für Company provisionieren' })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Provisionierung gestartet' })
  @ApiResponse({ status: 404, description: 'Company nicht gefunden' })
  async provisionDb(@Param('id') id: string, @Body() request: ProvisionDatabaseRequest) {
    return this.provisioningService.provisionDatabase(id, request);
  }

  // Basis-Endpoints für Datenbank-Interface
  @Post(':id/execute-query')
  @ApiOperation({ summary: 'SQL-Query auf Tenant-DB ausführen' })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Query erfolgreich ausgeführt' })
  @ApiResponse({ status: 400, description: 'Ungültige Query oder Fehler' })
  @ApiResponse({ status: 404, description: 'Company nicht gefunden' })
  async executeQuery(@Param('id') id: string, @Body() executeQueryDto: ExecuteQueryDto) {
    return this.companiesService.executeQuery(id, executeQueryDto.query, {
      limit: executeQueryDto.limit,
      timeout: executeQueryDto.timeout,
    });
  }

  @Post(':id/explain-query')
  @ApiOperation({ summary: 'EXPLAIN ANALYZE für Query ausführen' })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Query Plan' })
  @ApiResponse({ status: 400, description: 'Ungültige Query' })
  @ApiResponse({ status: 404, description: 'Company nicht gefunden' })
  async explainQuery(@Param('id') id: string, @Body() executeQueryDto: ExecuteQueryDto) {
    return this.companiesService.explainQuery(id, executeQueryDto.query);
  }

  @Get(':id/database-info')
  @ApiOperation({ summary: 'Datenbank-Metadaten abrufen' })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Datenbank-Info' })
  @ApiResponse({ status: 404, description: 'Company nicht gefunden' })
  async getDatabaseInfo(@Param('id') id: string) {
    return this.companiesService.getDatabaseInfo(id);
  }

  // Tabellen-Endpoints (spezifischere Routen zuerst)
  @Get(':id/tables/:tableName/stats')
  @ApiOperation({ summary: 'Tabellen-Statistiken abrufen' })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  @ApiParam({ name: 'tableName', description: 'Tabellenname' })
  @ApiResponse({ status: 200, description: 'Tabellen-Statistiken' })
  @ApiResponse({ status: 404, description: 'Company oder Tabelle nicht gefunden' })
  async getTableStats(@Param('id') id: string, @Param('tableName') tableName: string) {
    return this.companiesService.getTableStats(id, tableName);
  }

  @Get(':id/tables/:tableName/indexes')
  @ApiOperation({ summary: 'Indizes einer Tabelle abrufen' })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  @ApiParam({ name: 'tableName', description: 'Tabellenname' })
  @ApiResponse({ status: 200, description: 'Liste der Indizes' })
  @ApiResponse({ status: 404, description: 'Company oder Tabelle nicht gefunden' })
  async getTableIndexes(@Param('id') id: string, @Param('tableName') tableName: string) {
    return this.companiesService.getTableIndexes(id, tableName);
  }

  @Get(':id/tables/:tableName/foreign-keys')
  @ApiOperation({ summary: 'Foreign Keys einer Tabelle abrufen' })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  @ApiParam({ name: 'tableName', description: 'Tabellenname' })
  @ApiResponse({ status: 200, description: 'Liste der Foreign Keys' })
  @ApiResponse({ status: 404, description: 'Company oder Tabelle nicht gefunden' })
  async getTableForeignKeys(@Param('id') id: string, @Param('tableName') tableName: string) {
    return this.companiesService.getTableForeignKeys(id, tableName);
  }

  @Get(':id/tables/:tableName/constraints')
  @ApiOperation({ summary: 'Constraints einer Tabelle abrufen' })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  @ApiParam({ name: 'tableName', description: 'Tabellenname' })
  @ApiResponse({ status: 200, description: 'Liste der Constraints' })
  @ApiResponse({ status: 404, description: 'Company oder Tabelle nicht gefunden' })
  async getTableConstraints(@Param('id') id: string, @Param('tableName') tableName: string) {
    return this.companiesService.getTableConstraints(id, tableName);
  }

  @Get(':id/tables/:tableName/data')
  @ApiOperation({ summary: 'Paginierte Tabellendaten abrufen' })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  @ApiParam({ name: 'tableName', description: 'Tabellenname' })
  @ApiResponse({ status: 200, description: 'Tabellendaten' })
  @ApiResponse({ status: 404, description: 'Company oder Tabelle nicht gefunden' })
  async getTableData(
    @Param('id') id: string,
    @Param('tableName') tableName: string,
    @Query() query: TableDataQueryDto
  ) {
    return this.companiesService.getTableData(id, tableName, query.page || 0, query.limit || 50);
  }

  @Get(':id/tables/:tableName')
  @ApiOperation({ summary: 'Tabellenstruktur abrufen' })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  @ApiParam({ name: 'tableName', description: 'Tabellenname' })
  @ApiResponse({ status: 200, description: 'Tabellenstruktur' })
  @ApiResponse({ status: 404, description: 'Company oder Tabelle nicht gefunden' })
  async getTableStructure(@Param('id') id: string, @Param('tableName') tableName: string) {
    return this.companiesService.getTableStructure(id, tableName);
  }

  @Get(':id/tables')
  @ApiOperation({ summary: 'Liste aller Tabellen abrufen' })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Liste der Tabellen' })
  @ApiResponse({ status: 404, description: 'Company nicht gefunden' })
  async getTables(@Param('id') id: string) {
    return this.companiesService.getTables(id);
  }

  // PostgreSQL-spezifische Endpoints
  @Get(':id/views')
  @ApiOperation({ summary: 'Liste aller Views abrufen' })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Liste der Views' })
  @ApiResponse({ status: 404, description: 'Company nicht gefunden' })
  async getViews(@Param('id') id: string) {
    return this.companiesService.getViews(id);
  }

  @Get(':id/sequences')
  @ApiOperation({ summary: 'Liste aller Sequences abrufen' })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Liste der Sequences' })
  @ApiResponse({ status: 404, description: 'Company nicht gefunden' })
  async getSequences(@Param('id') id: string) {
    return this.companiesService.getSequences(id);
  }

  @Get(':id/functions')
  @ApiOperation({ summary: 'Liste aller Functions abrufen' })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Liste der Functions' })
  @ApiResponse({ status: 404, description: 'Company nicht gefunden' })
  async getFunctions(@Param('id') id: string) {
    return this.companiesService.getFunctions(id);
  }

  @Get(':id/storage-usage')
  @ApiOperation({
    summary: 'Speicherplatz-Informationen abrufen',
    description:
      'Gibt detaillierte Aufschlüsselung des verwendeten Speicherplatzes zurück (Datenbank nach Tabellen, Dateien, Anhänge). Ergebnisse werden 5 Minuten gecacht.',
  })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  @ApiQuery({
    name: 'refresh',
    required: false,
    description: 'Cache umgehen (true/false)',
    type: Boolean,
  })
  @ApiResponse({
    status: 200,
    description: 'Speicherplatz-Informationen',
    type: StorageUsageDto,
  })
  @ApiResponse({ status: 404, description: 'Company nicht gefunden' })
  @ApiResponse({ status: 400, description: 'Datenbank nicht bereit oder Fehler bei Berechnung' })
  async getStorageUsage(
    @Param('id') id: string,
    @Query('refresh') refresh?: string
  ): Promise<StorageUsageDto> {
    console.log(`[Controller] ========================================`);
    console.log(`[Controller] getStorageUsage aufgerufen!`);
    console.log(`[Controller] Company ID: ${id}`);
    console.log(`[Controller] Refresh Parameter: ${refresh}`);
    console.log(`[Controller] Refresh als Boolean: ${refresh === 'true'}`);
    console.log(`[Controller] ========================================`);
    try {
      const result = await this.companiesService.getStorageUsage(id, refresh === 'true');
      console.log(`[Controller] ✅ getStorageUsage erfolgreich abgeschlossen`);
      return result;
    } catch (error: any) {
      console.error(`[Controller] ❌ Fehler in getStorageUsage:`, error);
      throw error;
    }
  }

  @Post(':id/storage-usage/invalidate-cache')
  @ApiOperation({
    summary: 'Storage-Cache invalidieren',
    description:
      'Invalidiert den Cache für Storage-Usage-Berechnungen einer Company. Nützlich nach dem Speichern neuer Dateien/Anhänge.',
  })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  @ApiResponse({
    status: 200,
    description: 'Cache erfolgreich invalidiert',
  })
  @ApiResponse({ status: 404, description: 'Company nicht gefunden' })
  async invalidateStorageCache(@Param('id') id: string) {
    this.companiesService.invalidateStorageCache(id);
    return { success: true, message: `Storage-Cache für Company ${id} wurde invalidiert` };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Company-Details abrufen' })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Company-Details' })
  @ApiResponse({ status: 404, description: 'Company nicht gefunden' })
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Company aktualisieren' })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Company erfolgreich aktualisiert' })
  @ApiResponse({ status: 404, description: 'Company nicht gefunden' })
  update(@Param('id') id: string, @Body() updateCompanyDto: UpdateCompanyDto) {
    return this.companiesService.update(id, updateCompanyDto);
  }

  @Patch(':id/features')
  @ApiOperation({ summary: 'Company Feature-Flags aktualisieren' })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Feature-Flags erfolgreich aktualisiert' })
  @ApiResponse({ status: 404, description: 'Company nicht gefunden' })
  @ApiResponse({ status: 400, description: 'Ungültige Eingabedaten' })
  updateFeatures(@Param('id') id: string, @Body() updateFeaturesDto: UpdateCompanyFeaturesDto) {
    return this.companiesService.updateCompanyFeatures(id, updateFeaturesDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Company löschen' })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Company erfolgreich gelöscht' })
  @ApiResponse({ status: 404, description: 'Company nicht gefunden' })
  remove(@Param('id') id: string) {
    return this.companiesService.remove(id);
  }
}
