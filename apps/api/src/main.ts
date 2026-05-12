import { ApplicationModule } from './app/application.module';
/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

import { initializeTransactionalContext } from "typeorm-transactional";

async function bootstrap() {
  initializeTransactionalContext();

  const app = await NestFactory.create(ApplicationModule, { logger: ['log', 'warn', 'error'] });
  app.enableCors();
  app.use((req: any, res: any, next: any) => {
    res.on('finish', () => {
      const body = req.body && Object.keys(req.body).length ? ' ' + JSON.stringify(req.body) : '';
      Logger.log(`${req.method} ${req.url} ${res.statusCode}${body}`, 'HTTP');
    });
    next();
  });

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.PORT || 3000;

   const config = new DocumentBuilder()
      .setTitle('Inventory API')
      .setDescription('User + Address API')
      .setVersion('1.0')
      .build();

    const document = SwaggerModule.createDocument(app, config);

    SwaggerModule.setup('docs', app, document); // 👈 endpoint

  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );

  process.on('SIGTERM', async () => {
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await app.close();
    process.exit(0);
  });
}

bootstrap();
