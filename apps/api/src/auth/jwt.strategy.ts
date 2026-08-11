import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtAccessClaims, AuthenticatedUser } from './auth.types';
import { getContext } from '../common/context/request-context';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('app.jwt.accessSecret')!,
    });
  }

  validate(payload: JwtAccessClaims): AuthenticatedUser {
    const ctx = getContext();
    if (ctx) {
      // JWT tid is authoritative — silently override any header-supplied tenantId
      ctx.userId = payload.sub;
      ctx.tenantId = payload.tid;
    }
    return { userId: payload.sub, tenantId: payload.tid, email: payload.email, name: payload.name };
  }
}
