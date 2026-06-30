import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { runWithBypass } from '../../common/context/request-context';

export interface IncomingLocation {
  tenantId: string;
  tripId: string;
  lat: number;
  lng: number;
  headingDegrees: number | null;
  speedMps: number | null;
  occurredAt: Date;
}

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private bufferKey(tripId: string) {
    return `trip:${tripId}:buffer`;
  }

  async ingest(loc: IncomingLocation) {
    const client = this.redis.client;
    const payload = JSON.stringify({
      lat: loc.lat,
      lng: loc.lng,
      headingDegrees: loc.headingDegrees,
      speedMps: loc.speedMps,
      occurredAt: loc.occurredAt.toISOString(),
      tenantId: loc.tenantId,
    });
    await client.rpush(this.bufferKey(loc.tripId), payload);
    await client.expire(this.bufferKey(loc.tripId), 86400);
    await client.geoadd(`trip:${loc.tripId}:positions`, loc.lng, loc.lat, `${loc.occurredAt.getTime()}`);
    await client.expire(`trip:${loc.tripId}:positions`, 86400);
  }

  async flushAll(): Promise<{ flushed: number }> {
    const client = this.redis.client;
    let cursor = '0';
    let total = 0;
    do {
      const [next, keys] = await client.scan(cursor, 'MATCH', 'trip:*:buffer', 'COUNT', 200);
      cursor = next;
      for (const key of keys) {
        const tripId = key.split(':')[1]!;
        const items = await client.lrange(key, 0, -1);
        if (items.length === 0) continue;
        await client.del(key);
        await runWithBypass(async () => {
          for (const raw of items) {
            const p = JSON.parse(raw);
            await this.prisma.$executeRaw`
              INSERT INTO trip_location_snapshots (id, tenant_id, trip_id, location, heading_degrees, speed_mps, occurred_at)
              VALUES (
                gen_random_uuid(),
                ${p.tenantId}::uuid,
                ${tripId}::uuid,
                ST_SetSRID(ST_MakePoint(${p.lng}, ${p.lat}), 4326)::geography,
                ${p.headingDegrees},
                ${p.speedMps},
                ${p.occurredAt}::timestamptz
              );
            `;
            total += 1;
          }
        });
      }
    } while (cursor !== '0');
    if (total > 0) this.logger.debug(`Flushed ${total} location snapshots`);
    return { flushed: total };
  }
}
