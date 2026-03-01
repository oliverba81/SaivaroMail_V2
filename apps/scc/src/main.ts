import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { MaintenanceService } from './maintenance/maintenance.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix für alle Routes
  app.setGlobalPrefix('api');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        const messages = errors.map((error) => {
          const constraints = error.constraints;
          if (constraints) {
            return Object.values(constraints).join(', ');
          }
          return `${error.property} hat einen ungültigen Wert`;
        });
        return new BadRequestException({
          statusCode: 400,
          message: messages,
          error: 'Bad Request',
        });
      },
    })
  );

  // Swagger/OpenAPI Dokumentation
  const config = new DocumentBuilder()
    .setTitle('Saivaro Control Center API')
    .setDescription(
      'API für das Saivaro Control Center - Verwaltung von Firmen, Datenbank-Provisionierung und System-Management'
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth'
    )
    .addTag('auth', 'Authentication Endpoints')
    .addTag('companies', 'Company Management')
    .addTag('provisioning', 'Database Provisioning')
    .addTag('maintenance', 'Maintenance Operations')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'SCC API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  // CORS (später konfigurierbar)
  app.enableCors();

  // App-Instanz für MaintenanceService setzen
  const maintenanceService = app.get(MaintenanceService);
  maintenanceService.setApp(app);

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`🚀 SCC (Saivaro Control Center) läuft auf http://localhost:${port}/api`);
  console.log(`📚 API-Dokumentation: http://localhost:${port}/api/docs`);
}

bootstrap();
