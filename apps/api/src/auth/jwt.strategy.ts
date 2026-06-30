import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ERROR_CODES } from '@safari-shule/shared-types';
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
    if (ctx?.tenantId && payload.tid !== ctx.tenantId) {
      throw new UnauthorizedException({
        code: ERROR_CODES.PERMISSION_DENIED,
        message: 'Token tenant does not match request tenant.',
      });
    }
    if (ctx) {
      ctx.userId = payload.sub;
      if (!ctx.tenantId) ctx.tenantId = payload.tid;
    }
    return { userId: payload.sub, tenantId: payload.tid, email: payload.email, name: payload.name };
  }
}
