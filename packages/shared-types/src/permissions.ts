/**
 * Safari Shule — canonical permission catalog.
 *
 * One source of truth for both API guards and web UI gating.
 * Every atomic capability is `resource.action[.qualifier]`.
 *
 * Add here first, then re-run `pnpm --filter @safari-shule/api db:seed` to sync.
 */

export const PERMISSION_ACTIONS = [
  'view',
  'list',
  'create',
  'update',
  'delete',
  'restore',
  'archive',
  'export',
  'import',
  'print',
  'share',
  'download',
  'screenshot',
  'bulk',
  'impersonate',
  'approve',
  'reject',
  'assign',
  'transfer',
  'rotate',
  'reset',
  'lock',
  'unlock',
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

interface ResourceSpec {
  key: string;
  label: string;
  description: string;
  actions: readonly PermissionAction[];
  extras?: readonly string[];
}

const CORE_CRUD: readonly PermissionAction[] = [
  'view',
  'list',
  'create',
  'update',
  'delete',
  'export',
] as const;

const READ_ONLY: readonly PermissionAction[] = ['view', 'list', 'export'] as const;

export const PERMISSION_RESOURCES: readonly ResourceSpec[] = [
  {
    key: 'tenants',
    label: 'Tenants',
    description: 'Multi-tenant provisioning and cross-tenant administration.',
    actions: ['view', 'list', 'create', 'update', 'archive', 'restore', 'export'],
    extras: ['tenants.manage', 'tenants.impersonate', 'tenants.suspend', 'tenants.plan.change'],
  },
  {
    key: 'users',
    label: 'Users',
    description: 'User accounts within a tenant.',
    actions: ['view', 'list', 'create', 'update', 'delete', 'archive', 'restore', 'export'],
    extras: ['users.reset-password', 'users.lock', 'users.unlock', 'users.impersonate', 'users.deactivate'],
  },
  {
    key: 'roles',
    label: 'Roles',
    description: 'Custom RBAC roles per tenant.',
    actions: ['view', 'list', 'create', 'update', 'delete'],
    extras: ['roles.assign'],
  },
  {
    key: 'permissions',
    label: 'Permissions',
    description: 'Assign / revoke individual permissions.',
    actions: ['view', 'list'],
    extras: ['permissions.assign', 'permissions.revoke'],
  },
  {
    key: 'invitations',
    label: 'Invitations',
    description: 'Invite users into a tenant.',
    actions: ['view', 'list', 'create', 'delete'],
    extras: ['invitations.resend', 'invitations.revoke'],
  },
  {
    key: 'sessions',
    label: 'Sessions',
    description: 'Active login sessions.',
    actions: ['view', 'list'],
    extras: ['sessions.terminate', 'sessions.terminate-others'],
  },
  {
    key: 'audit',
    label: 'Audit log',
    description: 'Read the immutable event log.',
    actions: ['view', 'list', 'export'],
    extras: ['audit.query.cross-tenant'],
  },
  {
    key: 'features',
    label: 'Feature flags',
    description: 'Toggle plan-tier features and quotas.',
    actions: ['view', 'list'],
    extras: ['features.override', 'features.quota.adjust'],
  },

  {
    key: 'attributes',
    label: 'Custom attributes',
    description: 'Per-tenant custom field definitions.',
    actions: CORE_CRUD,
  },

  {
    key: 'staff',
    label: 'Staff',
    description: 'School employees.',
    actions: [...CORE_CRUD, 'archive', 'restore', 'print'],
  },
  {
    key: 'students',
    label: 'Students',
    description: 'Student roster.',
    actions: [...CORE_CRUD, 'archive', 'restore', 'print', 'import', 'screenshot'],
    extras: ['students.rfid.assign', 'students.rfid.rotate', 'students.route.assign'],
  },
  {
    key: 'parents',
    label: 'Parents / guardians',
    description: 'Parent / guardian records.',
    actions: [...CORE_CRUD, 'print', 'import'],
    extras: ['parents.link-student'],
  },
  {
    key: 'caretakers',
    label: 'Caretakers',
    description: 'Onboard-assistant caretakers.',
    actions: [...CORE_CRUD, 'archive', 'restore'],
  },

  {
    key: 'vehicles',
    label: 'Fleet — vehicles',
    description: 'Buses and support vehicles.',
    actions: [...CORE_CRUD, 'archive', 'restore', 'print'],
    extras: ['vehicles.decommission', 'vehicles.transfer'],
  },
  {
    key: 'fuel',
    label: 'Fleet — fuel logs',
    description: 'Refuelling entries.',
    actions: [...CORE_CRUD, 'approve'],
  },
  {
    key: 'repairs',
    label: 'Fleet — repairs',
    description: 'Repair work orders.',
    actions: [...CORE_CRUD, 'approve', 'reject'],
  },
  {
    key: 'insurance',
    label: 'Fleet — insurance',
    description: 'Insurance policies per vehicle.',
    actions: CORE_CRUD,
  },

  {
    key: 'routes',
    label: 'Routes',
    description: 'Transport routes.',
    actions: [...CORE_CRUD, 'print'],
    extras: ['routes.publish', 'routes.geofence.manage'],
  },
  {
    key: 'bus-stops',
    label: 'Bus stops',
    description: 'Geo-located pickup points.',
    actions: CORE_CRUD,
  },

  {
    key: 'trips',
    label: 'Trips',
    description: 'Trip dispatch and history.',
    actions: [...CORE_CRUD, 'print'],
    extras: ['trips.dispatch', 'trips.cancel', 'trips.reassign', 'trips.live.view'],
  },
  {
    key: 'attendance',
    label: 'Attendance events',
    description: 'Boarding and alighting events.',
    actions: [...READ_ONLY, 'create'],
    extras: ['attendance.override'],
  },
  {
    key: 'telemetry',
    label: 'Live telemetry',
    description: 'GPS pings and live positions.',
    actions: READ_ONLY,
    extras: ['telemetry.replay'],
  },

  {
    key: 'hardware',
    label: 'Hardware devices',
    description: 'RFID readers and GPS trackers.',
    actions: [...CORE_CRUD, 'rotate'],
    extras: ['hardware.secret.reveal', 'hardware.firmware.push', 'hardware.enroll', 'hardware.deactivate'],
  },

  {
    key: 'incidents',
    label: 'Incidents',
    description: 'SOS and operational incidents.',
    actions: [...CORE_CRUD, 'print'],
    extras: ['incidents.sos.trigger', 'incidents.acknowledge', 'incidents.resolve', 'incidents.reopen'],
  },
  {
    key: 'emergency-contacts',
    label: 'Emergency contacts',
    description: 'Escalation contacts per incident type.',
    actions: CORE_CRUD,
  },

  {
    key: 'comms',
    label: 'Communications',
    description: 'SMS + email + push dispatch.',
    actions: [...READ_ONLY, 'create'],
    extras: ['comms.sms.send', 'comms.email.send', 'comms.push.send', 'comms.bulk', 'comms.templates.manage'],
  },
  {
    key: 'notifications',
    label: 'Notification history',
    description: 'Sent messages and delivery reports.',
    actions: READ_ONLY,
  },

  {
    key: 'fees',
    label: 'Fees & billing',
    description: 'Fee structures and invoices.',
    actions: [...CORE_CRUD, 'print'],
    extras: ['fees.structure.publish', 'fees.invoice.void', 'fees.waiver.approve'],
  },
  {
    key: 'invoices',
    label: 'Invoices',
    description: 'Issued invoices (eTIMS compliant).',
    actions: [...READ_ONLY, 'create', 'print'],
    extras: ['invoices.void', 'invoices.credit-note.issue'],
  },
  {
    key: 'receipts',
    label: 'Receipts',
    description: 'Payment receipts (eTIMS compliant).',
    actions: [...READ_ONLY, 'create', 'print'],
  },
  {
    key: 'payments',
    label: 'Payments',
    description: 'Payments received and disbursed.',
    actions: [...READ_ONLY, 'create'],
    extras: ['payments.mpesa.initiate', 'payments.refund', 'payments.reconcile'],
  },
  {
    key: 'accounts',
    label: 'Chart of accounts',
    description: 'Accounting chart and journal entries.',
    actions: CORE_CRUD,
    extras: ['accounts.journal.post', 'accounts.period.close'],
  },
  {
    key: 'reports-finance',
    label: 'Reports — finance',
    description: 'P&L, balance sheet, trial balance, cash flow.',
    actions: READ_ONLY,
  },

  {
    key: 'payroll',
    label: 'Payroll',
    description: 'Payslips and disbursements.',
    actions: [...CORE_CRUD, 'approve', 'print'],
    extras: ['payroll.run', 'payroll.disburse', 'payroll.rollback'],
  },
  {
    key: 'leave',
    label: 'Leave',
    description: 'Employee leave requests.',
    actions: [...CORE_CRUD, 'approve', 'reject'],
  },
  {
    key: 'contracts',
    label: 'Contracts',
    description: 'Employment contracts.',
    actions: [...CORE_CRUD, 'print'],
    extras: ['contracts.terminate', 'contracts.renew'],
  },
  {
    key: 'disciplinary',
    label: 'Disciplinary',
    description: 'Disciplinary cases and outcomes.',
    actions: CORE_CRUD,
  },
  {
    key: 'appraisals',
    label: 'Appraisals',
    description: 'Performance appraisals.',
    actions: [...CORE_CRUD, 'print'],
  },

  {
    key: 'kra',
    label: 'KRA compliance',
    description: 'KRA PIN, iTax integration and tax status.',
    actions: [...READ_ONLY, 'update'],
    extras: ['kra.pin.verify', 'kra.tcc.check'],
  },
  {
    key: 'etims',
    label: 'eTIMS invoices',
    description: 'Electronic Tax Invoice Management System.',
    actions: [...READ_ONLY, 'create'],
    extras: ['etims.transmit', 'etims.void', 'etims.credit-note'],
  },
  {
    key: 'statutory-returns',
    label: 'Statutory returns',
    description: 'PAYE (P9/P10/P10A), NSSF, SHIF, Housing Levy.',
    actions: [...READ_ONLY, 'create', 'print', 'export'],
    extras: ['statutory.paye.file', 'statutory.nssf.file', 'statutory.shif.file', 'statutory.housing-levy.file'],
  },
  {
    key: 'ntsa',
    label: 'NTSA compliance',
    description: 'Vehicle inspection, PSV license, driver license.',
    actions: [...READ_ONLY, 'update'],
    extras: ['ntsa.inspection.record', 'ntsa.license.renew'],
  },
  {
    key: 'nemis',
    label: 'NEMIS',
    description: 'National Education Management Information System UPI capture.',
    actions: [...READ_ONLY, 'update', 'export'],
  },

  {
    key: 'consent',
    label: 'ODPC consent',
    description: 'Data-subject consent registry (Kenya DPA 2019).',
    actions: [...READ_ONLY, 'create', 'update'],
    extras: ['consent.withdraw'],
  },
  {
    key: 'dsr',
    label: 'Data Subject Requests',
    description: 'Access / rectification / erasure requests.',
    actions: [...CORE_CRUD, 'approve', 'reject'],
    extras: ['dsr.fulfil', 'dsr.export-package.generate'],
  },
  {
    key: 'dpia',
    label: 'DPIA',
    description: 'Data Protection Impact Assessments.',
    actions: CORE_CRUD,
  },
  {
    key: 'retention',
    label: 'Retention policies',
    description: 'Configure and run data retention.',
    actions: [...READ_ONLY, 'update'],
    extras: ['retention.run'],
  },

  {
    key: 'reports',
    label: 'Reports (custom)',
    description: 'User-defined reports.',
    actions: [...CORE_CRUD, 'print', 'download', 'share', 'screenshot'],
    extras: ['reports.schedule'],
  },
  {
    key: 'files',
    label: 'File uploads',
    description: 'Document library.',
    actions: [...CORE_CRUD, 'download', 'share', 'print', 'screenshot'],
  },
  {
    key: 'exports',
    label: 'Data exports',
    description: 'CSV / XLSX / PDF exports.',
    actions: ['view', 'list', 'create', 'download'],
  },

  {
    key: 'settings',
    label: 'Settings',
    description: 'Tenant settings and integrations.',
    actions: [...READ_ONLY, 'update'],
    extras: ['settings.integrations.manage', 'settings.branding.manage'],
  },
  {
    key: 'billing',
    label: 'Platform billing',
    description: 'Safari Shule subscription billing.',
    actions: [...READ_ONLY, 'update'],
    extras: ['billing.plan.change', 'billing.invoice.download'],
  },
] as const;

const buildPermissions = () => {
  const out = new Set<string>();
  for (const r of PERMISSION_RESOURCES) {
    for (const a of r.actions) out.add(`${r.key}.${a}`);
    for (const e of r.extras ?? []) out.add(e);
  }
  return [...out].sort();
};

/**
 * Legacy permission keys still referenced by decorators in the current
 * codebase. Kept here so the RBAC seeder upserts them alongside the modern
 * catalog. Migrate a decorator to a modern key, then remove its legacy entry.
 */
export const LEGACY_PERMISSIONS = [
  'attribute_definitions.manage',
  'attribute_definitions.view',
  'audit.view',
  'caretakers.create',
  'caretakers.delete',
  'caretakers.edit',
  'caretakers.view',
  'feature_flags.manage',
  'fuel_logs.approve',
  'fuel_logs.create',
  'fuel_logs.view',
  'geofences.manage',
  'incidents.acknowledge',
  'incidents.report',
  'incidents.resolve',
  'incidents.view',
  'insurance.manage',
  'insurance.view',
  'invitations.revoke',
  'invitations.send',
  'notifications.broadcast',
  'notifications.view',
  'parents.create',
  'parents.delete',
  'parents.edit',
  'parents.view',
  'payments.initiate',
  'payments.view',
  'permissions.assign',
  'repair_logs.approve',
  'repair_logs.create',
  'repair_logs.view',
  'rfid_devices.manage',
  'rfid_devices.view',
  'rfid_tags.manage',
  'rfid_tags.view',
  'roles.manage',
  'roles.view',
  'routes.manage',
  'routes.view',
  'staff.create',
  'staff.delete',
  'staff.edit',
  'staff.view',
  'students.create',
  'students.delete',
  'students.edit',
  'students.view',
  'trips.dispatch',
  'trips.live_track',
  'trips.view',
  'vehicles.create',
  'vehicles.delete',
  'vehicles.edit',
  'vehicles.view',
] as const;

/** Every permission string that exists in the system (modern + legacy). */
export const PERMISSIONS = [...new Set([...buildPermissions(), ...LEGACY_PERMISSIONS])].sort();

export type PermissionString = (typeof PERMISSIONS)[number];

/** Curated bundles used by the RBAC seeder for default roles. */
export const PERMISSION_BUNDLES = {
  systemAdmin: PERMISSIONS,
  transportAdmin: PERMISSIONS.filter((p) =>
    /^(vehicles|fuel|repairs|insurance|routes|bus-stops|trips|attendance|telemetry|hardware|incidents|emergency-contacts|comms|notifications|reports|files|exports|settings|students|parents|caretakers|staff|audit)\./.test(
      p,
    ),
  ),
  financeAdmin: PERMISSIONS.filter((p) =>
    /^(fees|invoices|receipts|payments|accounts|reports-finance|payroll|kra|etims|statutory-returns|reports|files|exports)\./.test(
      p,
    ),
  ),
  hrAdmin: PERMISSIONS.filter((p) =>
    /^(staff|leave|contracts|disciplinary|appraisals|payroll|reports|files|exports)\./.test(p),
  ),
  complianceOfficer: PERMISSIONS.filter((p) =>
    /^(consent|dsr|dpia|retention|audit|kra|etims|ntsa|nemis|statutory-returns|reports|exports)\./.test(
      p,
    ),
  ),
  dispatcher: PERMISSIONS.filter((p) =>
    /^(trips|attendance|telemetry|incidents|routes|vehicles\.(view|list)|comms\.sms\.send|notifications)\./.test(
      p,
    ),
  ),
  driver: [
    'trips.view',
    'trips.list',
    'trips.live.view',
    'attendance.view',
    'attendance.list',
    'attendance.create',
    'incidents.sos.trigger',
    'incidents.view',
    'incidents.list',
    'routes.view',
    'routes.list',
    'vehicles.view',
  ] as string[],
  caretaker: [
    'trips.view',
    'trips.live.view',
    'attendance.view',
    'attendance.list',
    'attendance.create',
    'students.view',
    'students.list',
    'incidents.sos.trigger',
  ] as string[],
  parent: [
    'trips.view',
    'trips.live.view',
    'students.view',
    'students.list',
    'attendance.view',
    'attendance.list',
    'notifications.view',
    'notifications.list',
    'payments.view',
    'payments.list',
    'payments.mpesa.initiate',
    'receipts.view',
    'receipts.list',
    'receipts.print',
    'fees.view',
    'fees.list',
    'invoices.view',
    'invoices.list',
    'invoices.print',
    'consent.view',
    'consent.list',
    'consent.update',
    'consent.withdraw',
    'dsr.view',
    'dsr.create',
  ] as string[],
} as const;

export type RoleBundleKey = keyof typeof PERMISSION_BUNDLES;
