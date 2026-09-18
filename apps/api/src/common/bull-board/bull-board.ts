import type { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { JwtService } from '@nestjs/jwt';
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import type { NextFunction, Request, Response } from 'express';
import type { Queue } from 'bullmq';
import { COMMS_QUEUE } from '../../comms/tokens';
import { RbacService } from '../../rbac/rbac.service';

export function configureBullBoard(app: INestApplication): void {
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
      if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const payload = await jwt.verifyAsync<{ sub: string; tid: string }>(header.slice(7));
      const permissions = await rbac.getUserPermissions(payload.tid, payload.sub);
      if (!permissions.has('tenants.manage')) {
        res.status(403).json({ message: 'Forbidden' });
        return;
      }
      next();
    } catch {
      res.status(401).json({ message: 'Unauthorized' });
    }
  }, serverAdapter.getRouter());
}