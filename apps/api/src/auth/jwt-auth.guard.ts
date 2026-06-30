import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { PUBLIC_METADATA, HARDWARE_METADATA } from '../rbac/permission.decorators';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    if (context.getType() !== 'http') return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    const isHardware = this.reflector.getAllAndOverride<boolean>(HARDWARE_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic || isHardware) return true;
    return super.canActivate(context);
  }
}
