import { SetMetadata } from '@nestjs/common';
import type { FeatureKey } from '@safari-shule/shared-types';

export const FEATURE_METADATA = 'safari.feature';
export const RequireFeature = (key: FeatureKey) => SetMetadata(FEATURE_METADATA, key);
