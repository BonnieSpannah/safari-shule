import { Module } from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service';
import { FeatureGuard } from './feature.guard';

@Module({
  providers: [FeatureFlagService, FeatureGuard],
  exports: [FeatureFlagService],
})
export class FeatureFlagsModule {}
