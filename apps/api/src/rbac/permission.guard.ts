import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ERROR_CODES, type PermissionKey } from '@safari-shule/shared-types';
import { PERMISSION_METADATA, PUBLIC_METADATA } from './permission.decorators';
import { RbacService } from './rbac.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly rbac: RbacService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<PermissionKey[] | undefined>(
      PERMISSION_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as { userId: string; tenantId: string } | undefined;
    if (!user) {
      throw new ForbiddenException({
        code: ERROR_CODES.PERMISSION_DENIED,
        message: 'Authentication required.',
      });
    }

    const perms = await this.rbac.getUserPermissions(user.tenantId, user.userId);
    const missing = required.filter((p) => !perms.has(p));
    if (missing.length > 0) {
      throw new ForbiddenException({
        code: ERROR_CODES.PERMISSION_DENIED,
        message: `Missing required permission(s): ${missing.join(', ')}.`,
        details: { missing },
      });
    }
    return true;
  }
}
