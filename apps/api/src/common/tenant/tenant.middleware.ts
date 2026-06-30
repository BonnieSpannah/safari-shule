import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ERROR_CODES } from '@safari-shule/shared-types';
import { getContext } from '../context/request-context';
import { TenantResolverService } from './tenant-resolver.service';

const TENANT_OPTIONAL_PATHS = new Set([
  '/health',
  '/health/ready',
  '/metrics',
  '/v1/auth/system/login',
  '/v1/integrations/mpesa/callback',
  '/v1/integrations/at/dlr',
  '/api/v1/hardware/rfid-scan',
  '/api/v1/hardware/gps',
]);

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly resolver: TenantResolverService) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const ctx = getContext();
    if (!ctx) return next();

    const host = req.get('host') ?? undefined;
    const headerTenant = (req.headers['x-tenant-id'] as string | undefined)?.trim();
    const headerSlug = (req.headers['x-tenant-slug'] as string | undefined)?.trim();

    const tenant = await this.resolver.resolve(host, headerTenant, headerSlug);
    if (tenant) {
      if (!tenant.isActive) {
        throw new HttpException(
          { code: ERROR_CODES.TENANT_INACTIVE, message: 'Tenant is inactive.' },
          HttpStatus.FORBIDDEN,
        );
      }
      ctx.tenantId = tenant.id;
      (req as any).tenantId = tenant.id;
      (req as any).tenant = tenant;
      return next();
    }

    if (TENANT_OPTIONAL_PATHS.has(req.path)) return next();

    throw new HttpException(
      {
        code: ERROR_CODES.TENANT_NOT_RESOLVED,
        message: 'Tenant could not be resolved. Supply X-Tenant-ID header or use a tenant subdomain.',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
