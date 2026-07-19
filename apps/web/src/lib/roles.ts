/**
 * Convert a role slug into a display label.
 * Prefers a hand-curated map (handles acronyms like "HR" correctly),
 * falls back to title-casing the slug.
 */
const ROLE_LABELS: Record<string, string> = {
  system_admin: 'System Admin',
  school_manager: 'School Manager',
  transport_admin: 'Transport Admin',
  finance_admin: 'Finance Admin',
  hr_admin: 'HR Admin',
  compliance_officer: 'Compliance Officer',
  dispatcher: 'Dispatcher',
  driver: 'Driver',
  assistant: 'Assistant',
  parent: 'Parent',
  caretaker: 'Caretaker',
};

export function humanizeRole(slug: string | undefined | null): string {
  if (!slug) return '—';
  if (ROLE_LABELS[slug]) return ROLE_LABELS[slug];
  return slug
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Show the "highest" role a user has, based on a curated priority order.
 * When a user has multiple roles, this picks the most representative one
 * to show in the Topbar chip.
 */
const ROLE_PRIORITY = [
  'system_admin',
  'school_manager',
  'compliance_officer',
  'finance_admin',
  'hr_admin',
  'transport_admin',
  'dispatcher',
  'driver',
  'assistant',
  'caretaker',
  'parent',
];

export function primaryRoleSlug(roles: readonly string[] | undefined): string | undefined {
  if (!roles || roles.length === 0) return undefined;
  for (const preferred of ROLE_PRIORITY) {
    if (roles.includes(preferred)) return preferred;
  }
  return roles[0];
}
