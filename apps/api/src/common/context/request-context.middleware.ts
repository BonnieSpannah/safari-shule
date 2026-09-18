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

    const channelHeader = (req.headers['x-client-channel'] as string | undefined)?.toLowerCase();
    const derivedChannel = channelHeader === 'web' || channelHeader === 'mobile' || channelHeader === 'api'
      ? channelHeader
      : 'api';

    const ctx: RequestContext = {
      requestId: incoming,
      tenantId: null,
      userId: null,
      ip: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
      channel: derivedChannel,
      traceId: (req.headers['x-trace-id'] as string | undefined) ?? null,
      sessionId: (req.headers['x-session-id'] as string | undefined) ?? null,
      bypassTenantScope: false,
    };
    (req as any).id = incoming;
    requestContext.run(ctx, () => next());
  }
}
