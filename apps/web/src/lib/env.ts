export const env = {
  apiUrl: import.meta.env.VITE_API_URL ?? '',
  appName: 'Safari Shule',
  sentryDsn: import.meta.env.VITE_SENTRY_DSN,
  tenantSlug: import.meta.env.VITE_TENANT_SLUG ?? 'hillcrest',
  baseDomain: import.meta.env.VITE_BASE_DOMAIN ?? 'safari-shule.test',
  mapTileUrl:
    import.meta.env.VITE_MAP_TILE_URL ?? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  mapAttribution:
    import.meta.env.VITE_MAP_ATTRIBUTION ??
    '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
};

/**
 * Derive the tenant slug from the browser host. Returns null if we're on the
 * bare base domain, localhost, or an IP. Callers should fall back to
 * `env.tenantSlug` in that case.
 */
export function resolveTenantSlugFromHost(host: string, baseDomain = env.baseDomain): string | null {
  const cleaned = host.split(':')[0]?.toLowerCase() ?? '';
  if (!cleaned || cleaned === baseDomain) return null;
  if (cleaned === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(cleaned)) return null;
  if (!cleaned.endsWith(`.${baseDomain}`)) return null;
  const sub = cleaned.slice(0, -1 * (baseDomain.length + 1));
  if (!sub || sub.includes('.')) return null;
  return sub;
}

