export const env = {
  apiUrl: import.meta.env.VITE_API_URL ?? '',
  appName: 'Safari Shule',
  sentryDsn: import.meta.env.VITE_SENTRY_DSN,
  mapTileUrl:
    import.meta.env.VITE_MAP_TILE_URL ?? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  mapAttribution:
    import.meta.env.VITE_MAP_ATTRIBUTION ??
    '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
};
