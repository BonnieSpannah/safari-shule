import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { createAdapter } from '@socket.io/redis-adapter';
import { RedisService } from '../../common/redis/redis.service';

interface SubscribePayload {
  tripId: string;
}

@WebSocketGateway({
  namespace: '/ws',
  cors: { origin: true, credentials: true },
})
export class TripGateway implements OnGatewayConnection {
  private readonly logger = new Logger(TripGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwt: JwtService, private readonly redis: RedisService) {}

  afterInit() {
    if (this.server) {
      const pub = this.redis.client;
      const sub = pub.duplicate();
      this.server.adapter(createAdapter(pub, sub));
    }
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) {
        client.disconnect(true);
        return;
      }
      const payload = await this.jwt.verifyAsync<{ sub: string; tid: string }>(token);
      client.data.userId = payload.sub;
      client.data.tenantId = payload.tid;
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('trip.subscribe')
  subscribe(@ConnectedSocket() client: Socket, @MessageBody() body: SubscribePayload) {
    if (!body?.tripId) return { ok: false, error: 'tripId required' };
    const room = this.roomFor(client.data.tenantId, body.tripId);
    void client.join(room);
    return { ok: true, room };
  }

  @SubscribeMessage('trip.unsubscribe')
  unsubscribe(@ConnectedSocket() client: Socket, @MessageBody() body: SubscribePayload) {
    if (!body?.tripId) return { ok: false };
    const room = this.roomFor(client.data.tenantId, body.tripId);
    void client.leave(room);
    return { ok: true };
  }

  broadcastLocation(tenantId: string, tripId: string, payload: unknown) {
    this.server?.to(this.roomFor(tenantId, tripId)).emit('trip.location', payload);
  }

  broadcastIncident(tenantId: string, tripId: string, payload: unknown) {
    this.server?.to(this.roomFor(tenantId, tripId)).emit('trip.incident', payload);
  }

  private roomFor(tenantId: string, tripId: string) {
    return `tenant:${tenantId}:trip:${tripId}`;
  }
}
