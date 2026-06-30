import { z } from 'zod';

export const ATTRIBUTE_FIELD_TYPES = [
  'string',
  'number',
  'phone',
  'date',
  'select',
  'boolean',
] as const;

export type AttributeFieldType = (typeof ATTRIBUTE_FIELD_TYPES)[number];

export const PROFILE_ENTITY_KINDS = ['staff', 'student', 'parent', 'caretaker'] as const;
export type ProfileEntityKind = (typeof PROFILE_ENTITY_KINDS)[number];

export interface AttributeDefinition {
  id: string;
  tenantId: string;
  targetEntity: ProfileEntityKind;
  slug: string;
  label: string;
  fieldType: AttributeFieldType;
  isRequired: boolean;
  isNullable: boolean;
  options: string[] | null;
  regex: string | null;
  min: number | null;
  max: number | null;
  sortOrder: number;
  archivedAt: string | null;
}

export const attributeDefinitionInput = z.object({
  targetEntity: z.enum(PROFILE_ENTITY_KINDS),
  slug: z.string().regex(/^[a-z][a-z0-9_]{1,48}$/),
  label: z.string().min(1).max(80),
  fieldType: z.enum(ATTRIBUTE_FIELD_TYPES),
  isRequired: z.boolean().default(false),
  isNullable: z.boolean().default(true),
  options: z.array(z.string().min(1)).nullable().optional(),
  regex: z.string().nullable().optional(),
  min: z.number().nullable().optional(),
  max: z.number().nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export type AttributeDefinitionInput = z.infer<typeof attributeDefinitionInput>;
