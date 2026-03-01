import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { ProvisioningModule } from './provisioning/provisioning.module';
import { HealthModule } from './health/health.module';
import { CronJobsModule } from './cron-jobs/cron-jobs.module';
import { MaintenanceModule } from './maintenance/maintenance.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    CommonModule,
    AuthModule,
    CompaniesModule,
    ProvisioningModule,
    HealthModule,
    CronJobsModule,
    MaintenanceModule,
  ],
})
export class AppModule {}
