import { Module } from '@nestjs/common';
import { AttributeDefinitionsController } from './attribute-definitions.controller';
import { AttributeDefinitionsService } from './attribute-definitions.service';
import { DynamicValidationService } from './dynamic-validation.service';

@Module({
  providers: [AttributeDefinitionsService, DynamicValidationService],
  controllers: [AttributeDefinitionsController],
  exports: [DynamicValidationService, AttributeDefinitionsService],
})
export class AttributesModule {}
