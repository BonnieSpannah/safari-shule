import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.API_PORT ?? 3000),
  baseDomain: process.env.APP_BASE_DOMAIN ?? 'safarishule.test',
  webPublicUrl: process.env.WEB_PUBLIC_URL ?? 'http://localhost:5173',
  apiPublicUrl: process.env.API_PUBLIC_URL ?? 'http://localhost:3000',
  integrationsMode: (process.env.INTEGRATIONS_MODE ?? 'mock') as 'mock' | 'live',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me-please',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me-please',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },
  hardware: {
    replayWindowSeconds: Number(process.env.HARDWARE_HMAC_REPLAY_WINDOW_SECONDS ?? 300),
    throttlePerMinute: Number(process.env.HARDWARE_THROTTLE_PER_MINUTE ?? 60),
  },
  security: {
    /** How old a password can get before we force a rotation on next login. */
    passwordMaxAgeDays: Number(process.env.PASSWORD_MAX_AGE_DAYS ?? 90),
    /** How many previous passwords we forbid re-use of. */
    passwordHistoryCount: Number(process.env.PASSWORD_HISTORY_COUNT ?? 5),
    /** TTL for activation ("welcome, set your password") tokens. */
    activationTokenTtlHours: Number(process.env.ACTIVATION_TOKEN_TTL_HOURS ?? 48),
    /** TTL for forgot-password reset tokens. */
    resetTokenTtlMinutes: Number(process.env.RESET_TOKEN_TTL_MINUTES ?? 30),
    /** Failed-login threshold before we auto-lock the account. */
    failedLoginLockThreshold: Number(process.env.FAILED_LOGIN_LOCK_THRESHOLD ?? 8),
    /** How long the lock stays in place. */
    failedLoginLockMinutes: Number(process.env.FAILED_LOGIN_LOCK_MINUTES ?? 30),
  },
  at: {
    username: process.env.AT_USERNAME ?? 'sandbox',
    apiKey: process.env.AT_API_KEY ?? '',
    senderId: process.env.AT_SENDER_ID ?? 'SAFARISHULE',
    dlrCallbackUrl: process.env.AT_DLR_CALLBACK_URL ?? '',
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
    authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    fromNumber: process.env.TWILIO_FROM_NUMBER ?? '',
  },
  infobip: {
    baseUrl: process.env.INFOBIP_BASE_URL ?? '',
    apiKey: process.env.INFOBIP_API_KEY ?? '',
    senderId: process.env.INFOBIP_SENDER_ID ?? 'SAFARISHULE',
  },
  smsProvider: (process.env.SMS_PROVIDER ?? 'auto') as
    | 'auto'
    | 'africas_talking'
    | 'twilio'
    | 'infobip'
    | 'mock',
  mailProvider: (process.env.MAIL_PROVIDER ?? 'auto') as
    | 'auto'
    | 'mailhog'
    | 'mailtrap'
    | 'smtp'
    | 'mock',
  mpesa: {
    env: (process.env.MPESA_ENV ?? 'sandbox') as 'sandbox' | 'production',
    consumerKey: process.env.MPESA_CONSUMER_KEY ?? '',
    consumerSecret: process.env.MPESA_CONSUMER_SECRET ?? '',
    shortcode: process.env.MPESA_SHORTCODE ?? '174379',
    passkey: process.env.MPESA_PASSKEY ?? '',
    callbackUrl: process.env.MPESA_CALLBACK_URL ?? '',
  },
  smtp: {
    host: process.env.SMTP_HOST ?? 'localhost',
    port: Number(process.env.SMTP_PORT ?? 1025),
    user: process.env.SMTP_USER ?? '',
    password: process.env.SMTP_PASSWORD ?? '',
    from: process.env.SMTP_FROM ?? 'no-reply@safarishule.co.ke',
  },
}));

export type AppConfig = ReturnType<typeof appConfig>;
