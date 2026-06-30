import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ERROR_CODES, type FeatureKey } from '@safari-shule/shared-types';
import { FEATURE_METADATA } from './feature.decorators';
import { FeatureFlagService } from './feature-flag.service';
import { getContext } from '../common/context/request-context';

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly flags: FeatureFlagService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const required = this.reflector.getAllAndOverride<FeatureKey | undefined>(FEATURE_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const tenantId = getContext()?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException({
        code: ERROR_CODES.TENANT_NOT_RESOLVED,
        message: 'Feature check requires tenant context.',
      });
    }

    const enabled = await this.flags.isEnabled(tenantId, required);
    if (!enabled) {
      throw new ForbiddenException({
        code: ERROR_CODES.FEATURE_NOT_ON_PLAN,
        message: `Feature '${required}' is not enabled for this tenant.`,
        details: { feature: required, upgrade_hint: 'Contact your school administrator to enable this capability.' },
      });
    }
    return true;
  }
}
