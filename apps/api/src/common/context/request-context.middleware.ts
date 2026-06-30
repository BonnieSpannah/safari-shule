import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { requestContext, RequestContext } from './request-context';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming =
      (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
    res.setHeader('x-request-id', incoming);

    const ctx: RequestContext = {
      requestId: incoming,
      tenantId: null,
      userId: null,
      ip: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
      bypassTenantScope: false,
    };
    (req as any).id = incoming;
    requestContext.run(ctx, () => next());
  }
}
