import { BadRequestException, Injectable } from '@nestjs/common';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import {
  ERROR_CODES,
  type AttributeFieldType,
  type ProfileEntityKind,
} from '@safari-shule/shared-types';
import { AttributeDefinitionsService } from './attribute-definitions.service';

interface DefinitionRow {
  slug: string;
  fieldType: AttributeFieldType;
  isRequired: boolean;
  isNullable: boolean;
  options: string[] | null;
  regex: string | null;
  min: number | null;
  max: number | null;
}

@Injectable()
export class DynamicValidationService {
  constructor(private readonly defs: AttributeDefinitionsService) {}

  async validateAndNormalize(
    tenantId: string,
    target: ProfileEntityKind,
    input: Record<string, unknown> | null | undefined,
  ): Promise<Record<string, unknown>> {
    const definitions = (await this.defs.listActiveFor(tenantId, target)) as DefinitionRow[];
    const provided = input ?? {};
    const issues: { slug: string; code: string; message: string }[] = [];
    const normalized: Record<string, unknown> = {};

    const slugSet = new Set(definitions.map((d) => d.slug));
    for (const key of Object.keys(provided)) {
      if (!slugSet.has(key)) {
        issues.push({
          slug: key,
          code: ERROR_CODES.ATTRIBUTE_UNKNOWN,
          message: `Unknown attribute '${key}' for ${target}.`,
        });
      }
    }

    for (const def of definitions) {
      const raw = (provided as any)[def.slug];
      if (raw === undefined || raw === null || raw === '') {
        if (def.isRequired) {
          issues.push({ slug: def.slug, code: ERROR_CODES.VALIDATION_FAILED, message: `'${def.slug}' is required.` });
          continue;
        }
        if (def.isNullable) normalized[def.slug] = null;
        continue;
      }

      try {
        normalized[def.slug] = this.normalizeValue(def, raw);
      } catch (err) {
        issues.push({
          slug: def.slug,
          code: ERROR_CODES.ATTRIBUTE_TYPE_MISMATCH,
          message: (err as Error).message,
        });
      }
    }

    if (issues.length) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Custom attribute validation failed.',
        details: { issues },
      });
    }

    return normalized;
  }

  private normalizeValue(def: DefinitionRow, raw: unknown): unknown {
    switch (def.fieldType) {
      case 'string': {
        const s = String(raw);
        if (def.regex && !new RegExp(def.regex).test(s)) {
          throw new Error(`'${def.slug}' does not match required pattern.`);
        }
        if (def.min != null && s.length < def.min) throw new Error(`'${def.slug}' is shorter than minimum ${def.min}.`);
        if (def.max != null && s.length > def.max) throw new Error(`'${def.slug}' is longer than maximum ${def.max}.`);
        return s;
      }
      case 'number': {
        const n = Number(raw);
        if (Number.isNaN(n)) throw new Error(`'${def.slug}' is not a number.`);
        if (def.min != null && n < def.min) throw new Error(`'${def.slug}' is below minimum ${def.min}.`);
        if (def.max != null && n > def.max) throw new Error(`'${def.slug}' exceeds maximum ${def.max}.`);
        return n;
      }
      case 'boolean': {
        if (typeof raw === 'boolean') return raw;
        const s = String(raw).toLowerCase();
        if (s === 'true' || s === '1') return true;
        if (s === 'false' || s === '0') return false;
        throw new Error(`'${def.slug}' must be a boolean.`);
      }
      case 'phone': {
        const parsed = parsePhoneNumberFromString(String(raw), 'KE');
        if (!parsed || !parsed.isValid() || parsed.country !== 'KE') {
          throw new Error(`'${def.slug}' must be a valid Kenyan phone number.`);
        }
        return parsed.number;
      }
      case 'date': {
        const d = new Date(String(raw));
        if (Number.isNaN(d.valueOf())) throw new Error(`'${def.slug}' is not a valid date.`);
        return d.toISOString().slice(0, 10);
      }
      case 'select': {
        const options = (def.options ?? []) as string[];
        const s = String(raw);
        if (!options.includes(s)) {
          throw new Error(`'${def.slug}' must be one of: ${options.join(', ')}.`);
        }
        return s;
      }
      default:
        throw new Error(`Unsupported field type for '${def.slug}'.`);
    }
  }
}
