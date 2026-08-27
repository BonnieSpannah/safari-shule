import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger, LoggerErrorInterceptor } from 'nestjs-pino';
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import * as Sentry from '@sentry/node';
import type { NextFunction, Request, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './common/realtime/redis-io.adapter';
import { GlobalExceptionFilter } from './common/errors/global-exception.filter';
import { RbacService } from './rbac/rbac.service';
import { COMMS_QUEUE } from './comms/tokens';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  app.enableCors({
    origin: (origin, cb) => cb(null, origin ?? true),
    credentials: true,
    exposedHeaders: ['X-Trace-Id', 'X-Required-Permissions'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Trace-Id',
      'X-Tenant-Slug',
      'X-Tenant-ID',
      'X-Impersonation-Session-Id',
    ],
  });

  app.useLogger(app.get(PinoLogger));

  const sentryDsn = process.env.SENTRY_DSN_API;
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
      tracesSampleRate: 0.1,
    });
  }

  app.setGlobalPrefix('v1', { exclude: ['health', 'health/ready', 'metrics'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new LoggerErrorInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());

  const ioAdapter = new RedisIoAdapter(app);
  await ioAdapter.connectToRedis();
  app.useWebSocketAdapter(ioAdapter);

  const swagger = new DocumentBuilder()
    .setTitle('Safari Shule API')
    .setDescription('Kenyan multi-tenant school transport platform.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-Tenant-ID', in: 'header' }, 'tenant')
    .build();
  const doc = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('docs', app, doc);

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  const commsQueue = app.get<Queue>(getQueueToken(COMMS_QUEUE));
  createBullBoard({
    queues: [new BullMQAdapter(commsQueue)],
    serverAdapter,
  });

  const jwt = app.get(JwtService);
  const rbac = app.get(RbacService);
  const express = app.getHttpAdapter().getInstance();
  express.use('/admin/queues', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const header = req.headers.authorization;
      if (!header || !header.startsWith('Bearer ')) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const token = header.slice(7);
      const payload = await jwt.verifyAsync<{ sub: string; tid: string }>(token);
      const perms = await rbac.getUserPermissions(payload.tid, payload.sub);
      if (!perms.has('tenants.manage')) {
        res.status(403).json({ message: 'Forbidden' });
        return;
      }
      next();
    } catch {
      res.status(401).json({ message: 'Unauthorized' });
    }
  }, serverAdapter.getRouter());

  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  app.get(PinoLogger).log(`Safari Shule API listening on :${port}`);
}

void bootstrap();
