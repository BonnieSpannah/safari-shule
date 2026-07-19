import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/*  Status enums — mirror the Prisma enums so the client and server agree     */
/*  on the vocabulary. Reused across every resource that carries a status.    */
/* -------------------------------------------------------------------------- */
export const USER_STATUSES = [
  'pending',
  'active',
  'inactive',
  'suspended',
  'deactivated',
  'expired',
  'blocked',
  'deleted',
] as const;
export type UserStatus = (typeof USER_STATUSES)[number];
export const userStatusSchema = z.enum(USER_STATUSES);

export const TENANT_STATUSES = [
  'pending',
  'active',
  'suspended',
  'deactivated',
  'cancelled',
  'deleted',
] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];
export const tenantStatusSchema = z.enum(TENANT_STATUSES);

/* -------------------------------------------------------------------------- */
/*  Password rules                                                             */
/* -------------------------------------------------------------------------- */
/**
 * Enforced everywhere passwords are set (activation, reset, self-service).
 * Matches the argon2id inputs sized in `AuthService.hashPassword`.
 */
export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters.')
  .max(200, 'Password is too long.')
  .refine((v) => /[A-Z]/.test(v), 'Include at least one uppercase letter.')
  .refine((v) => /[a-z]/.test(v), 'Include at least one lowercase letter.')
  .refine((v) => /\d/.test(v), 'Include at least one digit.')
  .refine(
    (v) => /[^A-Za-z0-9]/.test(v),
    'Include at least one symbol (e.g. ! @ # $ %).',
  );

/* -------------------------------------------------------------------------- */
/*  /v1/auth/me — profile                                                      */
/* -------------------------------------------------------------------------- */
export interface MeResponse {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  phoneE164: string | null;
  status: UserStatus;
  mustChangePassword: boolean;
  passwordUpdatedAt: string;
  passwordExpiresAt: string;
  passwordExpiresInDays: number;
  activatedAt: string | null;
  lastLoginAt: string | null;
  roles: string[];
  permissions: string[];
  preferences: UserPreferences;
}

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phoneE164: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/, 'Phone must be E.164 (e.g. +254712345678).')
    .nullable()
    .optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/* -------------------------------------------------------------------------- */
/*  Password change                                                            */
/* -------------------------------------------------------------------------- */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'New password must differ from current password.',
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/* -------------------------------------------------------------------------- */
/*  Sessions                                                                   */
/* -------------------------------------------------------------------------- */
export interface UserSession {
  id: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  isCurrent: boolean;
}
export type UserSessionsResponse = { sessions: UserSession[] };

/* -------------------------------------------------------------------------- */
/*  Preferences                                                                */
/* -------------------------------------------------------------------------- */
export const THEMES = ['system', 'light', 'dark'] as const;
export type ThemePref = (typeof THEMES)[number];

export const LOCALES = ['en-KE', 'sw-KE', 'en-US', 'en-GB'] as const;
export type LocalePref = (typeof LOCALES)[number];

export const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] as const;
export type DateFormatPref = (typeof DATE_FORMATS)[number];

export const preferencesSchema = z.object({
  theme: z.enum(THEMES).default('system'),
  locale: z.enum(LOCALES).default('en-KE'),
  timeZone: z.string().min(1).default('Africa/Nairobi'),
  dateFormat: z.enum(DATE_FORMATS).default('DD/MM/YYYY'),
  time24h: z.boolean().default(true),
  notifications: z
    .object({
      email: z.boolean().default(true),
      sms: z.boolean().default(false),
      push: z.boolean().default(true),
      digestFrequency: z.enum(['off', 'daily', 'weekly']).default('daily'),
    })
    .default({}),
});
export type UserPreferences = z.infer<typeof preferencesSchema>;

/** Defaults applied when a user has never touched their preferences. */
export const DEFAULT_PREFERENCES: UserPreferences = preferencesSchema.parse({});

/* -------------------------------------------------------------------------- */
/*  Forgot / reset / activation                                                */
/* -------------------------------------------------------------------------- */
export const forgotPasswordSchema = z.object({
  tenantSlug: z.string().regex(/^[a-z][a-z0-9-]*$/),
  email: z.string().email(),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
