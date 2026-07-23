import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { TerminusModule } from '@nestjs/terminus';
import { BullModule } from '@nestjs/bullmq';

import { appConfig } from './config/app.config';
import { redisOptions } from './config/redis.config';

import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { TenantContextModule } from './common/tenant/tenant-context.module';
import { TenantMiddleware } from './common/tenant/tenant.middleware';
import { RequestContextMiddleware } from './common/context/request-context.middleware';
import { RbacModule } from './rbac/rbac.module';
import { PermissionGuard } from './rbac/permission.guard';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { FeatureGuard } from './feature-flags/feature.guard';
import { AuditModule } from './audit/audit.module';
import { AuditInterceptor } from './audit/audit.interceptor';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

import { HealthModule } from './modules/health/health.module';
import { AttributesModule } from './modules/attributes/attributes.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { FleetModule } from './modules/fleet/fleet.module';
import { RoutesModule } from './modules/routes/routes.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { HardwareModule } from './modules/hardware/hardware.module';
import { TripsModule } from './modules/trips/trips.module';
import { TelemetryModule } from './modules/telemetry/telemetry.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { CommsModule } from './comms/comms.module';
import { TenantAdminModule } from './modules/tenant-admin/tenant-admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [appConfig], envFilePath: ['../../.env', '.env'] }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.passwordHash'],
        autoLogging: { ignore: (req) => req.url === '/health' || req.url === '/metrics' },
        customProps: (req) => ({
          requestId: (req as any).id,
          tenantId: (req as any).tenantId ?? null,
          userId: (req as any).user?.userId ?? null,
        }),
        genReqId: (req, res) => {
          const incoming = (req.headers['x-request-id'] as string | undefined) ?? cryptoRandomId();
          res.setHeader('x-request-id', incoming);
          return incoming;
        },
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true, translateTime: 'SYS:HH:MM:ss.l' } },
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PrometheusModule.register({ path: '/metrics', defaultMetrics: { enabled: true } }),
    TerminusModule,
    BullModule.forRoot({ connection: redisOptions() }),

    PrismaModule,
    RedisModule,
    TenantContextModule,
    RbacModule,
    FeatureFlagsModule,
    AuditModule,
    AuthModule,
    CommsModule,
    HealthModule,
    TenantAdminModule,
    AttributesModule,
    ProfilesModule,
    OnboardingModule,
    FleetModule,
    RoutesModule,
    PaymentsModule,
    HardwareModule,
    TripsModule,
    TelemetryModule,
    IncidentsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_GUARD, useClass: FeatureGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestContextMiddleware, TenantMiddleware)
      .exclude(
        { path: 'health', method: RequestMethod.GET },
        { path: 'health/ready', method: RequestMethod.GET },
        { path: 'metrics', method: RequestMethod.GET },
      )
      .forRoutes('*');
  }
}

function cryptoRandomId(): string {
  return [...crypto.getRandomValues(new Uint8Array(8))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
