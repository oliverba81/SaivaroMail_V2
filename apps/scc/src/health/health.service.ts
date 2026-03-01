import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private prisma: PrismaService) {}

  /**
   * Basis-Health-Check für die API
   */
  async check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'SCC (Saivaro Control Center)',
      version: '1.0.0',
    };
  }

  /**
   * Health-Check für die Datenbank
   */
  async checkDatabase() {
    try {
      // Einfache Query, um DB-Verbindung zu testen
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
