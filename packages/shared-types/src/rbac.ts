export const ROLE_KEYS = [
  'system_admin',
  'school_manager',
  'driver',
  'assistant',
  'parent',
  'caretaker',
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

export const PERMISSION_KEYS = [
  // Tenancy & system
  'tenants.manage',
  'feature_flags.manage',
  'audit.view',

  // RBAC
  'roles.view',
  'roles.manage',
  'permissions.assign',

  // Profiles
  'staff.view',
  'staff.create',
  'staff.edit',
  'staff.delete',
  'students.view',
  'students.create',
  'students.edit',
  'students.delete',
  'parents.view',
  'parents.create',
  'parents.edit',
  'parents.delete',
  'caretakers.view',
  'caretakers.create',
  'caretakers.edit',
  'caretakers.delete',

  // Custom attribute engine
  'attribute_definitions.view',
  'attribute_definitions.manage',

  // Onboarding
  'invitations.send',
  'invitations.revoke',

  // Fleet
  'vehicles.view',
  'vehicles.create',
  'vehicles.edit',
  'vehicles.delete',
  'fuel_logs.view',
  'fuel_logs.create',
  'fuel_logs.approve',
  'repair_logs.view',
  'repair_logs.create',
  'repair_logs.approve',
  'insurance.view',
  'insurance.manage',

  // Routes
  'routes.view',
  'routes.manage',
  'geofences.manage',

  // RFID hardware
  'rfid_devices.view',
  'rfid_devices.manage',
  'rfid_tags.view',
  'rfid_tags.manage',
  'attendance.view',
  'attendance.override',

  // Trips & telemetry
  'trips.view',
  'trips.dispatch',
  'trips.live_track',

  // Incidents
  'incidents.view',
  'incidents.report',
  'incidents.acknowledge',
  'incidents.resolve',

  // Notifications & comms
  'notifications.view',
  'notifications.broadcast',

  // Payments
  'payments.view',
  'payments.initiate',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, readonly PermissionKey[]> = {
  system_admin: PERMISSION_KEYS,
  school_manager: [
    'audit.view',
    'roles.view',
    'roles.manage',
    'permissions.assign',
    'staff.view', 'staff.create', 'staff.edit', 'staff.delete',
    'students.view', 'students.create', 'students.edit', 'students.delete',
    'parents.view', 'parents.create', 'parents.edit', 'parents.delete',
    'caretakers.view', 'caretakers.create', 'caretakers.edit', 'caretakers.delete',
    'attribute_definitions.view', 'attribute_definitions.manage',
    'invitations.send', 'invitations.revoke',
    'vehicles.view', 'vehicles.create', 'vehicles.edit', 'vehicles.delete',
    'fuel_logs.view', 'fuel_logs.create', 'fuel_logs.approve',
    'repair_logs.view', 'repair_logs.create', 'repair_logs.approve',
    'insurance.view', 'insurance.manage',
    'routes.view', 'routes.manage', 'geofences.manage',
    'rfid_devices.view', 'rfid_devices.manage',
    'rfid_tags.view', 'rfid_tags.manage',
    'attendance.view', 'attendance.override',
    'trips.view', 'trips.dispatch', 'trips.live_track',
    'incidents.view', 'incidents.acknowledge', 'incidents.resolve',
    'notifications.view', 'notifications.broadcast',
    'payments.view', 'payments.initiate',
  ],
  driver: [
    'students.view',
    'routes.view',
    'vehicles.view',
    'fuel_logs.view', 'fuel_logs.create',
    'repair_logs.view', 'repair_logs.create',
    'trips.view', 'trips.live_track',
    'attendance.view',
    'incidents.view', 'incidents.report',
  ],
  assistant: [
    'students.view',
    'routes.view',
    'trips.view', 'trips.live_track',
    'attendance.view', 'attendance.override',
    'incidents.view', 'incidents.report',
  ],
  parent: [
    'students.view',
    'trips.view', 'trips.live_track',
    'attendance.view',
    'notifications.view',
    'incidents.view',
  ],
  caretaker: [
    'students.view',
    'attendance.view',
    'trips.view',
  ],
};
