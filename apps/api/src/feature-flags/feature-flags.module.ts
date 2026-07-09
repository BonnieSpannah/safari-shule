import { Module, Global } from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service';
import { FeatureGuard } from './feature.guard';

@Global()
@Module({
  providers: [FeatureFlagService, FeatureGuard],
  exports: [FeatureFlagService],
})
export class FeatureFlagsModule {}
