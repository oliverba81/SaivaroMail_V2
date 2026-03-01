import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

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
    }),
  );

  // CORS (später konfigurierbar)
  app.enableCors();

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`🚀 SCC (Seivaro Control Center) läuft auf http://localhost:${port}/api`);
}

bootstrap();

