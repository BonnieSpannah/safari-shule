import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { runWithBypass } from '../../common/context/request-context';
import { decryptSecret, sha256 } from '../../common/crypto/secret-encryption';

const REPLAY_WINDOW_MS = 5 * 60 * 1000;

@Injectable()
export class HardwareAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const deviceIdHeader = req.headers['x-device-id'] as string | undefined;
    const apiKey = req.headers['x-api-key'] as string | undefined;
    const timestampHeader = req.headers['x-timestamp'] as string | undefined;
    const signature = req.headers['x-signature'] as string | undefined;

    if (!deviceIdHeader || !apiKey || !timestampHeader || !signature) {
      throw new UnauthorizedException({ code: 'HARDWARE_AUTH_MISSING_HEADERS' });
    }
    const timestamp = Number(timestampHeader);
    if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > REPLAY_WINDOW_MS) {
      throw new UnauthorizedException({ code: 'HARDWARE_AUTH_TIMESTAMP_OUT_OF_RANGE' });
    }

    const device = await runWithBypass(() =>
      this.prisma.rfidDevice.findFirst({ where: { deviceId: deviceIdHeader } }),
    );
    if (!device || device.status !== 'active') {
      throw new ForbiddenException({ code: 'HARDWARE_DEVICE_INACTIVE_OR_UNKNOWN' });
    }

    const apiKeyHash = sha256(apiKey);
    if (apiKeyHash !== device.apiKeyHash) {
      throw new UnauthorizedException({ code: 'HARDWARE_AUTH_BAD_API_KEY' });
    }

    let secret: string;
    try {
      secret = decryptSecret(device.hmacSecretEncrypted);
    } catch {
      throw new UnauthorizedException({ code: 'HARDWARE_AUTH_SECRET_UNAVAILABLE' });
    }

    const rawBody = JSON.stringify(req.body ?? {});
    const expected = createHmac('sha256', secret)
      .update(`${deviceIdHeader}.${timestamp}.${rawBody}`)
      .digest('hex');
    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      throw new UnauthorizedException({ code: 'HARDWARE_AUTH_BAD_SIGNATURE' });
    }

    req.tenantId = device.tenantId;
    req.deviceDbId = device.id;
    req.deviceRow = device;

    await runWithBypass(() =>
      this.prisma.rfidDevice.update({
        where: { id: device.id },
        data: { lastSeenAt: new Date() },
      }),
    );

    return true;
  }
}
