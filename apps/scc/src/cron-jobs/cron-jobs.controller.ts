import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { CronJobsService } from './cron-jobs.service';
import { LogCronJobDto } from './dto/log-cron-job.dto';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('system-logs')
@Controller('system-logs')
export class CronJobsController {
  constructor(private readonly cronJobsService: CronJobsService) {}

  @Post('log')
  @Public() // Öffentlicher Endpoint, keine Auth erforderlich
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @ApiOperation({
    summary: 'Loggt eine Cron-Job-Ausführung',
    description:
      'Erstellt einen neuen Log-Eintrag oder aktualisiert einen bestehenden (wenn logId vorhanden).',
  })
  @ApiBody({ type: LogCronJobDto })
  @ApiResponse({
    status: 201,
    description: 'Log-Eintrag erfolgreich erstellt/aktualisiert',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        companyId: { type: 'string', format: 'uuid' },
        jobType: { type: 'string' },
        jobKey: { type: 'string' },
        status: { type: 'string' },
        startedAt: { type: 'string', format: 'date-time' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Ungültige Eingabedaten' })
  @ApiResponse({ status: 404, description: 'Company oder Log-Eintrag nicht gefunden' })
  @ApiResponse({ status: 403, description: 'Log-Eintrag gehört nicht zur angegebenen Company' })
  async logCronJob(@Body() dto: LogCronJobDto) {
    return this.cronJobsService.logCronJob(dto);
  }

  @Post('logs/batch')
  @Public() // Öffentlicher Endpoint, keine Auth erforderlich
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @ApiOperation({
    summary: 'Loggt mehrere Cron-Job-Ausführungen (Batch)',
    description: 'Erstellt oder aktualisiert mehrere Log-Einträge in einer Transaction.',
  })
  @ApiBody({
    type: [LogCronJobDto],
    description: 'Array von LogCronJobDto',
  })
  @ApiResponse({
    status: 201,
    description: 'Log-Einträge erfolgreich erstellt/aktualisiert',
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
  async logCronJobsBatch(@Body() dtos: LogCronJobDto[]) {
    // Verwendet Prisma Transaction für atomare Operationen
    // Jeder Eintrag wird einzeln verarbeitet (kann Updates und Creates mischen)
    return this.cronJobsService.logCronJobsBatch(dtos);
  }

  @Get('companies/:id/logs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Ruft System-Logs für eine Company ab',
    description:
      'Gibt alle System-Logs (Cron-Jobs, Automatisierungen, E-Mail-Events) für eine Company zurück, mit optionaler Filterung.',
  })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  @ApiQuery({ name: 'logType', required: false, enum: ['cron_job', 'automation', 'email_event'] })
  @ApiQuery({ name: 'jobType', required: false, enum: ['scheduled_trigger', 'email_fetch'] })
  @ApiQuery({ name: 'status', required: false, enum: ['running', 'success', 'failed'] })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Anzahl Einträge (Standard: 100, Max: 1000)',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Pagination-Offset (Standard: 0)',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start-Datum (ISO-String)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End-Datum (ISO-String)',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste der System-Logs',
    schema: {
      type: 'object',
      properties: {
        logs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              companyId: { type: 'string', format: 'uuid' },
              jobType: { type: 'string' },
              jobKey: { type: 'string' },
              status: { type: 'string' },
              startedAt: { type: 'string', format: 'date-time' },
              completedAt: { type: 'string', format: 'date-time' },
              executionTimeMs: { type: 'number' },
              processedItems: { type: 'number' },
              errorMessage: { type: 'string' },
              metadata: { type: 'object' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        total: { type: 'number' },
        limit: { type: 'number' },
        offset: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Company nicht gefunden' })
  async getSystemLogs(
    @Param('id') companyId: string,
    @Query('logType') logType?: string,
    @Query('jobType') jobType?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.cronJobsService.getSystemLogs(companyId, {
      logType,
      jobType,
      status,
      limit: limit ? parseInt(limit.toString(), 10) : undefined,
      offset: offset ? parseInt(offset.toString(), 10) : undefined,
      startDate,
      endDate,
    });
  }
}
