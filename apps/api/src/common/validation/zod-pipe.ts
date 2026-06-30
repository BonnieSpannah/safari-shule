import {
  ArgumentMetadata,
  BadRequestException,
  Body,
  Injectable,
  PipeTransform,
  Query,
} from '@nestjs/common';
import { ZodSchema } from 'zod';
import { ERROR_CODES } from '@safari-shule/shared-types';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata) {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Validation failed.',
        details: { issues: parsed.error.issues },
      });
    }
    return parsed.data;
  }
}

export const ZodBody = (schema: ZodSchema) => Body(new ZodValidationPipe(schema));
export const ZodQuery = (schema: ZodSchema) => Query(new ZodValidationPipe(schema));
