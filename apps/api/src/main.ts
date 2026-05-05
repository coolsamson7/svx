/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

import { initializeTransactionalContext } from "typeorm-transactional";



async function bootstrap() {
  initializeTransactionalContext();

  const app = await NestFactory.create(AppModule);
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
}

bootstrap();
