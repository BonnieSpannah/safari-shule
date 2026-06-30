import { z } from 'zod';

export const GENDERS = ['male', 'female', 'other'] as const;
export type Gender = (typeof GENDERS)[number];

export const PARENT_RELATIONS = ['mother', 'father', 'guardian', 'other'] as const;
export type ParentRelation = (typeof PARENT_RELATIONS)[number];

export const kenyanPhone = z
  .string()
  .trim()
  .regex(/^\+254[17]\d{8}$/, 'Must be a +254 phone number (Safaricom/Airtel format)');

export const baseProfileSchema = z.object({
  legalName: z.string().min(2).max(120),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.enum(GENDERS),
  flexibleAttributes: z.record(z.any()).default({}),
});

export const studentInput = baseProfileSchema.extend({
  admissionNumber: z.string().min(1).max(32),
  birthCertificateNumber: z.string().min(1).max(32).nullable().optional(),
  classroom: z.string().max(40).nullable().optional(),
});
export type StudentInput = z.infer<typeof studentInput>;

export const staffInput = baseProfileSchema.extend({
  employeeNumber: z.string().min(1).max(32),
  nationalId: z.string().min(4).max(20),
  phone: kenyanPhone,
  email: z.string().email().nullable().optional(),
  position: z.string().max(80),
});
export type StaffInput = z.infer<typeof staffInput>;

export const parentInput = baseProfileSchema.extend({
  phone: kenyanPhone,
  email: z.string().email().nullable().optional(),
  nationalId: z.string().min(4).max(20).nullable().optional(),
  occupation: z.string().max(80).nullable().optional(),
});
export type ParentInput = z.infer<typeof parentInput>;

export const caretakerInput = baseProfileSchema.extend({
  phone: kenyanPhone,
  relationship: z.string().max(40),
  nationalId: z.string().min(4).max(20).nullable().optional(),
});
export type CaretakerInput = z.infer<typeof caretakerInput>;
