import { type ReactNode, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { UserPlus, Mail, Phone, UserX, UserCheck, Search, Pencil, Lock, Unlock, X } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DataTable, type Column } from '@/components/ui/data-table';
import { ActionMenu } from '@/components/ui/action-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormActions } from '@/components/ui/form-actions';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { TenantSelectorField } from '@/components/ui/tenant-selector-field';

import { FilterDropdown } from '@/components/ui/filter-dropdown';
import { usePermission, useAnyPermission } from '@/hooks/usePermission';
import { useDebounce } from '@/hooks/useDebounce';
import { useTenantFilter, TenantBadge } from '@/hooks/useTenantFilter';
import { humanizeRole } from '@/lib/roles';
import { listUsers, inviteUser, deactivateUser, activateUser, suspendUser, lockUser, updateUser, type User } from '@/lib/api/users';
import { listStaff, createStaffMember, updateStaffMember, deleteStaffMember, type StaffMember } from '@/lib/api/staff';
import type { StaffInput } from '@safari-shule/shared-types';

// ─── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 10;

const STAFF_ROLES = [
  { value: 'school_manager', label: 'School Manager' },
  { value: 'transport_admin', label: 'Transport Admin' },
  { value: 'dispatcher', label: 'Dispatcher' },
  { value: 'driver', label: 'Driver' },
  { value: 'assistant', label: 'Assistant' },
];

// Map staff positions to system role keys for auto-invite
function staffPositionToRoles(position: string): string[] {
  const pos = position.toLowerCase();
  if (pos.includes('driver')) return ['driver'];
  if (pos.includes('assistant')) return ['assistant'];
  if (pos.includes('dispatcher')) return ['dispatcher'];
  if (pos.includes('manager')) return ['school_manager'];
  if (pos.includes('admin')) return ['transport_admin'];
  return ['driver']; // default
}

// ─── Invite schema ─────────────────────────────────────────────────────────────
const inviteSchema = z.object({
  targetTenantId: z.string().uuid().or(z.literal('')).optional(),
  email: z.string().email('Enter a valid email'),
  fullName: z.string().min(2, 'Enter a full name'),
  phone: z.string().trim().regex(/^\+254[17]\d{8}$/, 'Must be a valid Kenyan mobile number, e.g. +254712345678').or(z.literal('')).optional(),
  roleKeys: z.array(z.string()).min(1, 'Select at least one role'),
});
type InviteForm = z.infer<typeof inviteSchema>;

const editUserSchema = z.object({
  sourceTenantId: z.string().uuid().or(z.literal('')).optional(),  // current tenant — sent for lookup
  targetTenantId: z.string().uuid().or(z.literal('')).optional(),  // new tenant — triggers move
  fullName: z.string().min(2, 'Enter full name'),
  phoneE164: z.string().trim().regex(/^\+254[17]\d{8}$/, 'Must be a valid Kenyan mobile number').or(z.literal('')).optional(),
  roleKeys: z.array(z.string()).min(1, 'Select at least one role'),
});
type EditUserForm = z.infer<typeof editUserSchema>;

// ─── Staff schema ──────────────────────────────────────────────────────────────
const staffSchema = z.object({
  targetTenantId: z.string().uuid().or(z.literal('')).optional(),
  legalName: z.string().min(2, 'Enter full name'),
  employeeNumber: z.string().min(1, 'Enter employee number'),
  nationalId: z.string().min(4, 'Enter national ID'),
  position: z.string().min(1, 'Enter position'),
  phoneE164: z.string().trim().regex(/^\+254[17]\d{8}$/, 'Must be a valid Kenyan mobile number, e.g. +254712345678'),
  email: z.string().email('Enter a valid email').or(z.literal('')).optional(),
  gender: z.enum(['male', 'female', 'other'] as const),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
});
type StaffForm = z.infer<typeof staffSchema>;

// ─── RolePill ──────────────────────────────────────────────────────────────────
function RolePill({ roleKey }: { roleKey: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
      {humanizeRole(roleKey)}
    </span>
  );
}

function SectionHero({
  eyebrow,
  title,
  description,
  stats,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  stats: Array<{ label: string; value: string }>;
  action?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface-1 via-surface-1 to-surface-2 px-5 py-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">{eyebrow}</p>
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {stats.map((stat) => (
            <span key={stat.label} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 py-1 text-xs text-muted-foreground shadow-sm">
              <span className="font-semibold text-foreground">{stat.value}</span>
              <span>{stat.label}</span>
            </span>
          ))}
          {action}
        </div>
      </div>
    </div>
  );
}

// ─── Users tab ────────────────────────────────────────────────────────────────
function UsersTab() {
  const canManage = usePermission('invitations.send');
  const { isSuperAdmin, tenants } = useTenantFilter();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [confirmUser, setConfirmUser] = useState<{ user: User; action: 'deactivate' | 'activate' | 'suspend' | 'lock' } | null>(null);

  const dSearch = useDebounce(search, 300);

  const query = useQuery({
    queryKey: ['users', dSearch, tenantFilter, statusFilter, roleFilter, page],
    queryFn: () => listUsers({ q: dSearch || undefined, tenantId: tenantFilter || undefined, status: statusFilter || undefined, roleKey: roleFilter || undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: (prev) => prev,
  });

  const users = query.data?.data ?? [];
  const total = query.data?.meta.total ?? 0;

  const form = useForm<InviteForm>({ resolver: zodResolver(inviteSchema), mode: 'onChange' });
  const editForm = useForm<EditUserForm>({ resolver: zodResolver(editUserSchema), mode: 'onChange' });

  const openEdit = (u: User) => {
    setEditUser(u);
    editForm.reset({
      sourceTenantId: u.tenant?.id ?? '',
      targetTenantId: u.tenant?.id ?? '',
      fullName: u.fullName ?? '',
      phoneE164: u.phoneE164 ?? '',
      roleKeys: u.userRoles.map((r) => r.role.key),
    });
  };

  const editMutation = useMutation({
    mutationFn: (v: EditUserForm) => updateUser(editUser!.id, {
      fullName: v.fullName,
      phoneE164: v.phoneE164 || null,
      roleKeys: v.roleKeys,
      sourceTenantId: v.sourceTenantId || undefined,
      targetTenantId: v.targetTenantId !== v.sourceTenantId ? (v.targetTenantId || undefined) : undefined,
    }),
    onSuccess: () => {
      toast.success('User updated.');
      setEditUser(null);
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () => toast.error('Could not update user.'),
  });

  const inviteMutation = useMutation({
    mutationFn: (v: InviteForm) => inviteUser({ ...v, phone: v.phone || undefined, targetTenantId: v.targetTenantId || undefined }),
    onSuccess: () => {
      toast.success('Invitation sent.');
      setInviteOpen(false);
      form.reset();
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () => toast.error('Failed to send invitation.'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ user, action }: { user: User; action: 'deactivate' | 'activate' | 'suspend' | 'lock' }) => {
      if (action === 'deactivate') return deactivateUser(user.id);
      if (action === 'activate') return activateUser(user.id);
      if (action === 'suspend') return suspendUser(user.id);
      return lockUser(user.id);
    },
    onSuccess: (_, { action }) => {
      const labels: Record<string, string> = { deactivate: 'deactivated', activate: 'activated', suspend: 'suspended', lock: 'locked' };
      toast.success(`User ${labels[action] ?? 'updated'}.`);
      setConfirmUser(null);
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () => toast.error('Could not update user status.'),
  });

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'Name',
      width: 'w-full',
      sortable: true,
      exportValue: (u) => u.fullName || '—',
      render: (u) => (
        <div>
          <div className="font-medium">{u.fullName || '—'}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Mail className="h-3 w-3" /> {u.email}
          </div>
          {u.phoneE164 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" /> {u.phoneE164}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'roles',
      header: 'Roles',
      exportValue: (u) => u.userRoles.map((r) => humanizeRole(r.role.key)).join(', '),
      render: (u) => (
        <div className="flex flex-wrap gap-1">
          {u.userRoles.length > 0
            ? u.userRoles.map((r) => <RolePill key={r.role.key} roleKey={r.role.key} />)
            : <span className="text-muted-foreground">—</span>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 'w-28',
      sortable: true,
      exportValue: (u) => u.status,
      render: (u) => <StatusBadge status={u.status} />,
    },
    {
      key: 'lastLogin',
      header: 'Last sign-in',
      width: 'w-36',
      sortable: true,
      exportValue: (u) => u.lastLoginAt ?? '',
      render: (u) => (
        <span className="text-xs text-muted-foreground">
          {u.lastLoginAt ? formatDistanceToNow(new Date(u.lastLoginAt), { addSuffix: true }) : '—'}
        </span>
      ),
    },
    {
      key: 'joined',
      header: 'Joined',
      width: 'w-28',
      sortable: true,
      exportValue: (u) => format(new Date(u.createdAt), 'd MMM yyyy'),
      render: (u) => <span className="text-xs text-muted-foreground">{format(new Date(u.createdAt), 'd MMM yyyy')}</span>,
    },
    ...(isSuperAdmin ? [{ key: 'tenant', header: 'Tenant', width: 'w-32' as const, exportValue: (u: User) => u.tenant?.name ?? '', render: (u: User) => <TenantBadge tenant={u.tenant} /> }] : []),
    {
      key: 'actions',
      header: '',
      width: 'w-10',
      align: 'right' as const,
      render: (u) => (
        <ActionMenu items={[
          { label: 'Edit', icon: <Pencil className="h-4 w-4" />, permission: 'users.update', onClick: () => openEdit(u) },
          ...(u.status === 'active' ? [
            { label: 'Suspend', icon: <Lock className="h-4 w-4" />, permission: 'users.deactivate', onClick: () => setConfirmUser({ user: u, action: 'suspend' }), variant: 'destructive' as const },
            { label: 'Deactivate', icon: <UserX className="h-4 w-4" />, permission: 'users.deactivate', onClick: () => setConfirmUser({ user: u, action: 'deactivate' }), variant: 'destructive' as const },
          ] : [
            { label: 'Activate', icon: <UserCheck className="h-4 w-4" />, permission: 'users.deactivate', onClick: () => setConfirmUser({ user: u, action: 'activate' }) },
          ]),
          ...(['inactive', 'suspended'].includes(u.status) ? [
            { label: 'Lock account', icon: <Unlock className="h-4 w-4" />, permission: 'users.lock', onClick: () => setConfirmUser({ user: u, action: 'lock' }), variant: 'destructive' as const },
          ] : []),
        ]} />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <SectionHero
        eyebrow="Access management"
        title="System users"
        description="Invite users, tune role assignments, and keep account access aligned with the active school."
        stats={[
          { label: 'accounts', value: String(total) },
          { label: 'scope', value: isSuperAdmin ? 'all schools' : 'current school' },
          { label: 'mode', value: canManage ? 'editable' : 'read only' },
        ]}
        action={canManage ? (
          <Button onClick={() => setInviteOpen(true)} className="gap-1.5 bg-green-600 hover:bg-green-700">
            <UserPlus className="h-4 w-4" /> Invite user
          </Button>
        ) : undefined}
      />

      {query.error && (
        <ErrorState
          title="Failed to load users"
          error={query.error}
          onRetry={() => query.refetch()}
        />
      )}

      {!query.error && (
      <DataTable
        title="System users"
        description={total > 0 ? `${total} user${total !== 1 ? 's' : ''}` : undefined}
        search={<div className="relative w-full"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input placeholder="Search users…" className="pl-8 h-9 text-sm" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <FilterDropdown
              label="Status"
              options={[
                { value: 'active', label: 'Active' },
                { value: 'pending', label: 'Pending' },
                { value: 'suspended', label: 'Suspended' },
                { value: 'inactive', label: 'Inactive' },
              ]}
              selected={statusFilter ? [statusFilter] : []}
              onChange={(v) => { setStatusFilter(v[v.length - 1] ?? ''); setPage(1); }}
            />
            <FilterDropdown
              label="Role"
              options={STAFF_ROLES}
              selected={roleFilter ? [roleFilter] : []}
              onChange={(v) => { setRoleFilter(v[v.length - 1] ?? ''); setPage(1); }}
            />
            {isSuperAdmin && <FilterDropdown label="Tenant" options={tenants.map((t) => ({ value: t.id, label: t.name }))} selected={tenantFilter ? [tenantFilter] : []} onChange={(v) => { setTenantFilter(v[v.length - 1] ?? ''); setPage(1); }} />}
            {(statusFilter || roleFilter || tenantFilter) && (
              <button type="button" onClick={() => { setStatusFilter(''); setRoleFilter(''); setTenantFilter(''); setPage(1); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
        }
        filtersActive={!!statusFilter || !!roleFilter || !!tenantFilter}
        exportFilename="settings-users"
        selectable
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
        columns={columns}
        rows={users}
        rowKey={(u) => u.id}
        loading={query.isLoading}
        skeletonRows={PAGE_SIZE}
        empty={<EmptyState icon={<UserPlus className="h-6 w-6" />} title="No users found" description={canManage ? 'Invite the first user above.' : undefined} />}
      />
      )}

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={(o) => { if (!o) { setInviteOpen(false); form.reset(); } }}>
        <DialogContent hideCloseButton className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite user</DialogTitle>
            <p className="text-sm text-muted-foreground">An invitation email will be sent with a link to set their password.</p>
            <hr className="mt-1 border-border" />
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => inviteMutation.mutate(v))} noValidate className="space-y-4">
            {isSuperAdmin && (
              <TenantSelectorField value={form.watch('targetTenantId') ?? ''} onChange={(v) => form.setValue('targetTenantId', v)} hint="Invite this user to a specific school" />
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Full name <span className="text-danger">*</span></Label>
                <Input placeholder="Jane Mwangi" invalid={!!form.formState.errors.fullName} {...form.register('fullName')} />
                {form.formState.errors.fullName && <p className="text-xs text-danger">{form.formState.errors.fullName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Email <span className="text-danger">*</span></Label>
                <Input type="email" placeholder="jane@school.ac.ke" invalid={!!form.formState.errors.email} {...form.register('email')} />
                {form.formState.errors.email && <p className="text-xs text-danger">{form.formState.errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input type="tel" placeholder="+254712345678" invalid={!!form.formState.errors.phone} {...form.register('phone')} />
                {form.formState.errors.phone && <p className="text-xs text-danger">{form.formState.errors.phone.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Role <span className="text-danger">*</span></Label>
                <Controller name="roleKeys" control={form.control} render={({ field }) => (
                  <div className="space-y-1">
                    {STAFF_ROLES.map((r) => (
                      <label key={r.value} className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          className="accent-primary"
                          checked={field.value?.includes(r.value) ?? false}
                          onChange={(e) => {
                            const cur = field.value ?? [];
                            field.onChange(e.target.checked ? [...cur, r.value] : cur.filter((v) => v !== r.value));
                          }}
                        />
                        {r.label}
                      </label>
                    ))}
                    {form.formState.errors.roleKeys && <p className="text-xs text-danger">{form.formState.errors.roleKeys.message}</p>}
                  </div>
                )} />
              </div>
            </div>
            <FormActions onCancel={() => { setInviteOpen(false); form.reset(); }} submitLabel="Send invitation" submitting={inviteMutation.isPending} />
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit user dialog */}
      <Dialog open={!!editUser} onOpenChange={(o) => { if (!o) setEditUser(null); }}>
        <DialogContent hideCloseButton className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit — {editUser?.fullName ?? editUser?.email}</DialogTitle>
            <p className="text-sm text-muted-foreground">Update name, phone or roles.</p>
            <hr className="mt-1 border-border" />
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit((v) => editMutation.mutate(v))} noValidate className="space-y-4">
            {isSuperAdmin && (
              <TenantSelectorField
                value={editForm.watch('targetTenantId') ?? ''}
                onChange={(v) => editForm.setValue('targetTenantId', v)}
                hint={editForm.watch('targetTenantId') !== editForm.watch('sourceTenantId')
                  ? '⚠ Changing school will remove all current role assignments'
                  : 'Change to move this user to a different school'}
              />
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Full name <span className="text-danger">*</span></Label>
                <Input placeholder="Jane Mwangi" invalid={!!editForm.formState.errors.fullName} {...editForm.register('fullName')} />
                {editForm.formState.errors.fullName && <p className="text-xs text-danger">{editForm.formState.errors.fullName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input type="tel" placeholder="+254712345678" invalid={!!editForm.formState.errors.phoneE164} {...editForm.register('phoneE164')} />
                {editForm.formState.errors.phoneE164 && <p className="text-xs text-danger">{editForm.formState.errors.phoneE164.message}</p>}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Roles <span className="text-danger">*</span></Label>
                <Controller name="roleKeys" control={editForm.control} render={({ field }) => (
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {STAFF_ROLES.map((r) => (
                      <label key={r.value} className="flex items-center gap-2 cursor-pointer text-sm">
                        <input type="checkbox" className="accent-primary"
                          checked={field.value?.includes(r.value) ?? false}
                          onChange={(e) => {
                            const cur = field.value ?? [];
                            field.onChange(e.target.checked ? [...cur, r.value] : cur.filter((v) => v !== r.value));
                          }} />
                        {r.label}
                      </label>
                    ))}
                  </div>
                )} />
                {editForm.formState.errors.roleKeys && <p className="text-xs text-danger">{editForm.formState.errors.roleKeys.message}</p>}
              </div>
            </div>
            <FormActions onCancel={() => setEditUser(null)} submitLabel="Save changes" submitting={editMutation.isPending} />
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm status change */}
      {confirmUser && (() => {
        const { action, user } = confirmUser;
        const configs = {
          deactivate: { title: 'Deactivate user?', desc: `${user.fullName} will lose access immediately.`, label: 'Deactivate', destructive: true },
          activate:   { title: 'Activate user?', desc: `${user.fullName} will regain access.`, label: 'Activate', destructive: false },
          suspend:    { title: 'Suspend user?', desc: `${user.fullName} will be temporarily blocked from logging in.`, label: 'Suspend', destructive: true },
          lock:       { title: 'Lock account?', desc: `${user.fullName}'s account will be locked until an admin unlocks it.`, label: 'Lock', destructive: true },
        } as const;
        const cfg = configs[action as keyof typeof configs];
        return cfg ? (
          <ConfirmDialog
            open
            onOpenChange={(o) => { if (!o) setConfirmUser(null); }}
            title={cfg.title}
            description={cfg.desc}
            confirmLabel={cfg.label}
            destructive={cfg.destructive}
            onConfirm={() => statusMutation.mutate(confirmUser)}
            pending={statusMutation.isPending}
          />
        ) : null;
      })()}
    </div>
  );
}

// ─── Staff tab ────────────────────────────────────────────────────────────────
function StaffTab() {
  const canManage = usePermission('staff.create');
  const { isSuperAdmin, tenants } = useTenantFilter();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteStaff, setInviteStaff] = useState<StaffMember | null>(null);

  const dSearch = useDebounce(search, 300);

  const query = useQuery({
    queryKey: ['staff', dSearch, tenantFilter, page],
    queryFn: () => listStaff({ q: dSearch || undefined, tenantId: tenantFilter || undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: (prev) => prev,
  });

  const staff = query.data?.data ?? [];
  const total = query.data?.meta.total ?? 0;

  const form = useForm<StaffForm>({ resolver: zodResolver(staffSchema), mode: 'onChange' });
  const inviteForm = useForm<InviteForm>({ resolver: zodResolver(inviteSchema), mode: 'onChange' });

  const openInviteForStaff = (s: StaffMember) => {
    inviteForm.reset({
      targetTenantId: s.tenant?.id ?? '',
      email: s.email ?? '',
      fullName: s.legalName,
      phone: s.phoneE164,
      roleKeys: staffPositionToRoles(s.position),
    });
    setInviteStaff(s);
    setInviteOpen(true);
  };

  const inviteStaffMutation = useMutation({
    mutationFn: (v: InviteForm) => inviteUser({ ...v, phone: v.phone || undefined, targetTenantId: v.targetTenantId || undefined }),
    onSuccess: () => {
      toast.success('Invitation sent.');
      setInviteOpen(false);
      inviteForm.reset();
      setInviteStaff(null);
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: () => toast.error('Failed to send invitation.'),
  });

  const openCreate = () => { setEditing(null); form.reset({}); setDialogOpen(true); };
  const openEdit = (s: StaffMember) => {
    setEditing(s);
    form.reset({
      targetTenantId: s.tenant?.id ?? '',
      legalName: s.legalName,
      employeeNumber: s.employeeNumber,
      nationalId: s.nationalId,
      position: s.position,
      phoneE164: s.phoneE164,
      email: s.email ?? '',
      gender: s.gender as 'male' | 'female' | 'other',
      dateOfBirth: s.dateOfBirth.slice(0, 10),
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (v: StaffForm) => {
      const { phoneE164, email, targetTenantId, ...rest } = v;
      const input: StaffInput = { ...rest, phone: phoneE164, email: email || null, flexibleAttributes: {} };
      
      const staff = await (editing
        ? updateStaffMember(editing.id, { ...input, sourceTenantId: editing.tenant?.id, targetTenantId: targetTenantId || undefined })
        : createStaffMember({ ...input, targetTenantId: targetTenantId || undefined }));
      
      // Auto-invite staff as user on create
      if (!editing && email) {
        try {
          const roleKeys = staffPositionToRoles(v.position);
          // When super-admin creates staff for another tenant, don't auto-invite cross-tenant
          // (role validation becomes complex). They can manually invite from the Users tab instead.
          if (!targetTenantId) {
            await inviteUser({ email, fullName: v.legalName, phone: phoneE164, roleKeys });
          }
        } catch (err) {
          console.error('Invite failed:', err);
          toast.warning('Staff added but invitation failed. Send invitation from Users tab.');
        }
      }
      return staff;
    },
    onSuccess: (_, v) => {
      if (editing) {
        toast.success('Staff member updated.');
      } else {
        toast.success(v.email ? `Staff added and invitation sent to ${v.email}` : 'Staff added.');
      }
      setDialogOpen(false);
      form.reset();
      qc.invalidateQueries({ queryKey: ['staff'] });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () => toast.error('Could not save staff member.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteStaffMember(id),
    onSuccess: () => {
      toast.success('Staff member removed.');
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: () => toast.error('Could not remove staff member.'),
  });

  const columns: Column<StaffMember>[] = [
    {
      key: 'name',
      header: 'Name',
      width: 'w-full',
      sortable: true,
      exportValue: (s) => s.legalName,
      render: (s) => (
        <div>
          <div className="font-medium">{s.legalName}</div>
          <div className="text-xs text-muted-foreground">{s.employeeNumber}</div>
        </div>
      ),
    },
    { key: 'position', header: 'Position', width: 'w-32', sortable: true, exportValue: (s) => s.position, render: (s) => <span className="text-sm text-muted-foreground">{s.position}</span> },
    {
      key: 'contact',
      header: 'Contact',
      width: 'w-40',
      exportValue: (s) => [s.phoneE164, s.email].filter(Boolean).join(' | '),
      render: (s) => (
        <div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{s.phoneE164}</div>
          {s.email && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="h-3 w-3" />{s.email}</div>}
        </div>
      ),
    },
    {
      key: 'userStatus',
      header: 'User',
      width: 'w-28',
      exportValue: (s) => s.user ? 'Active' : 'Not invited',
      render: (s) => (
        s.user
          ? s.user.status === 'active'
            ? <div className="flex items-center gap-1 text-xs"><UserCheck className="h-3.5 w-3.5 text-green-600" />Active</div>
            : <div className="flex items-center gap-1 text-xs text-amber-600"><Mail className="h-3.5 w-3.5" />Pending</div>
          : s.email
            ? <button onClick={() => openInviteForStaff(s)} className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 underline-offset-2 hover:underline"><UserPlus className="h-3.5 w-3.5" />Invite</button>
            : <span className="text-xs text-muted-foreground">No email</span>
      ),
    },
    { key: 'joined', header: 'Added', width: 'w-28', sortable: true, exportValue: (s) => format(new Date(s.createdAt), 'd MMM yyyy'), render: (s) => <span className="text-xs text-muted-foreground">{format(new Date(s.createdAt), 'd MMM yyyy')}</span> },
    ...(isSuperAdmin ? [{ key: 'tenant', header: 'Tenant', width: 'w-32' as const, exportValue: (s: StaffMember) => s.tenant?.name ?? '', render: (s: StaffMember) => <TenantBadge tenant={s.tenant} /> }] : []),
    {
      key: 'actions',
      header: '',
      width: 'w-10',
      align: 'right' as const,
      render: (s) => (
        <ActionMenu items={[
          ...(s.email && !s.user ? [{ label: 'Invite as user', icon: <UserPlus className="h-4 w-4" />, permission: 'invitations.send', onClick: () => openInviteForStaff(s) }] : []),
          { label: 'Edit', permission: 'staff.edit', onClick: () => openEdit(s) },
          { label: 'Remove', permission: 'staff.delete', onClick: () => setDeleteTarget(s), variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <SectionHero
        eyebrow="Workforce management"
        title="Staff members"
        description="Track school staff, invite them into the platform, and keep their tenant assignment in sync."
        stats={[
          { label: 'staff', value: String(total) },
          { label: 'scope', value: isSuperAdmin ? 'all schools' : 'current school' },
          { label: 'mode', value: canManage ? 'editable' : 'read only' },
        ]}
        action={canManage ? (
          <Button onClick={openCreate} className="gap-1.5 bg-green-600 hover:bg-green-700">
            <UserPlus className="h-4 w-4" /> Add staff
          </Button>
        ) : undefined}
      />

      {query.error && (
        <ErrorState
          title="Failed to load staff"
          error={query.error}
          onRetry={() => query.refetch()}
        />
      )}

      {!query.error && (
      <DataTable
        title="Staff members"
        description={total > 0 ? `${total} staff member${total !== 1 ? 's' : ''}` : undefined}
        search={<div className="relative w-full"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input placeholder="Search staff…" className="pl-8 h-9 text-sm" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>}
        filters={isSuperAdmin ? <div className="flex flex-wrap items-center gap-2"><FilterDropdown label="Tenant" options={tenants.map((t) => ({ value: t.id, label: t.name }))} selected={tenantFilter ? [tenantFilter] : []} onChange={(v) => { setTenantFilter(v[v.length - 1] ?? ''); setPage(1); }} />{tenantFilter && <button type="button" onClick={() => { setTenantFilter(''); setPage(1); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><X className="h-3 w-3" />Clear</button>}</div> : undefined}
        filtersActive={tenantFilter !== ''}
        exportFilename="settings-staff"
        selectable
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
        columns={columns}
        rows={staff}
        rowKey={(s) => s.id}
        loading={query.isLoading}
        skeletonRows={PAGE_SIZE}
        empty={<EmptyState icon={<UserPlus className="h-6 w-6" />} title="No staff members found" description={canManage ? 'Add the first staff member above.' : undefined} />}
      />
      )}

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false); }}>
        <DialogContent hideCloseButton className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit — ${editing.legalName}` : 'Add staff member'}</DialogTitle>
            <p className="text-sm text-muted-foreground">School staff member details</p>
            <hr className="mt-1 border-border" />
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} noValidate className="space-y-4">
            {isSuperAdmin && (
              <TenantSelectorField value={form.watch('targetTenantId') ?? ''} onChange={(v) => form.setValue('targetTenantId', v)} hint={editing ? 'Change to reassign this staff member to a different school' : undefined} />
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {([
                ['legalName', 'Full name', 'text', 'Jane Wanjiku Mwangi', true],
                ['employeeNumber', 'Employee #', 'text', 'EMP-001', true],
                ['nationalId', 'National ID', 'text', '12345678', true],
                ['position', 'Position', 'text', 'Driver', true],
                ['phoneE164', 'Phone', 'tel', '+254712345678', true],
                ['email', 'Email', 'email', 'jane@school.ac.ke', false],
                ['dateOfBirth', 'Date of birth', 'date', '', true],
              ] as const).map(([field, label, type, placeholder, required]) => (
                <div key={field} className="space-y-1.5">
                  <Label>{label}{required && <span className="text-danger ml-0.5">*</span>}</Label>
                  <Input type={type} placeholder={placeholder} invalid={!!form.formState.errors[field as keyof StaffForm]} {...form.register(field)} />
                  {form.formState.errors[field as keyof StaffForm] && <p className="text-xs text-danger">{form.formState.errors[field as keyof StaffForm]?.message}</p>}
                </div>
              ))}
              <div className="space-y-1.5">
                <Label>Gender <span className="text-danger">*</span></Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...form.register('gender')}>
                  <option value="">Select…</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
                {form.formState.errors.gender && <p className="text-xs text-danger">{form.formState.errors.gender.message}</p>}
              </div>
            </div>
            <FormActions onCancel={() => setDialogOpen(false)} submitLabel={editing ? 'Save changes' : 'Add staff member'} submitting={saveMutation.isPending} />
          </form>
        </DialogContent>
      </Dialog>

      {deleteTarget && (
        <ConfirmDialog
          open
          onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
          title="Remove staff member?"
          description={`${deleteTarget.legalName} will be permanently removed. This cannot be undone.`}
          confirmLabel="Remove"
          destructive
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          pending={deleteMutation.isPending}
        />
      )}

      {/* Invite staff as user dialog */}
      <Dialog open={inviteOpen} onOpenChange={(o) => { if (!o) { setInviteOpen(false); setInviteStaff(null); inviteForm.reset(); } }}>
        <DialogContent hideCloseButton className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite {inviteStaff?.legalName ?? 'staff'} as user</DialogTitle>
            <p className="text-sm text-muted-foreground">An invitation email will be sent with a link to set their password.</p>
            <hr className="mt-1 border-border" />
          </DialogHeader>
          <form onSubmit={inviteForm.handleSubmit((v) => inviteStaffMutation.mutate(v))} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Full name <span className="text-danger">*</span></Label>
                <Input placeholder="Jane Mwangi" invalid={!!inviteForm.formState.errors.fullName} {...inviteForm.register('fullName')} />
                {inviteForm.formState.errors.fullName && <p className="text-xs text-danger">{inviteForm.formState.errors.fullName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Email <span className="text-danger">*</span></Label>
                <Input type="email" placeholder="jane@school.ac.ke" invalid={!!inviteForm.formState.errors.email} {...inviteForm.register('email')} />
                {inviteForm.formState.errors.email && <p className="text-xs text-danger">{inviteForm.formState.errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input type="tel" placeholder="+254712345678" invalid={!!inviteForm.formState.errors.phone} {...inviteForm.register('phone')} />
                {inviteForm.formState.errors.phone && <p className="text-xs text-danger">{inviteForm.formState.errors.phone.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Role <span className="text-danger">*</span></Label>
                <Controller name="roleKeys" control={inviteForm.control} render={({ field }) => (
                  <div className="space-y-1">
                    {STAFF_ROLES.map((r) => (
                      <label key={r.value} className="flex items-center gap-2 cursor-pointer text-sm">
                        <input type="checkbox" className="accent-primary" checked={field.value?.includes(r.value) ?? false}
                          onChange={(e) => {
                            const cur = field.value ?? [];
                            field.onChange(e.target.checked ? [...cur, r.value] : cur.filter((v) => v !== r.value));
                          }} />
                        {r.label}
                      </label>
                    ))}
                    {inviteForm.formState.errors.roleKeys && <p className="text-xs text-danger">{inviteForm.formState.errors.roleKeys.message}</p>}
                  </div>
                )} />
              </div>
            </div>
            <FormActions onCancel={() => { setInviteOpen(false); setInviteStaff(null); inviteForm.reset(); }} submitLabel="Send invitation" submitting={inviteStaffMutation.isPending} />
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Settings page ─────────────────────────────────────────────────────────────
export function SettingsPage() {
  const canSeeUsers = useAnyPermission('invitations.send', 'users.view');
  const canSeeStaff = useAnyPermission('staff.view', 'staff.create');

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Users, staff and tenant configuration." />
      <Tabs defaultValue={canSeeUsers ? 'users' : 'staff'}>
        <TabsList className="w-full justify-start">
          {canSeeUsers && <TabsTrigger value="users">Users</TabsTrigger>}
          {canSeeStaff && <TabsTrigger value="staff">Staff</TabsTrigger>}
        </TabsList>
        {canSeeUsers && (
          <TabsContent value="users" className="mt-4">
            <Card className="overflow-hidden border-border/70 shadow-sm"><CardHeader className="border-b border-border/60 bg-gradient-to-r from-surface-2/50 to-surface-1"><CardTitle className="text-base">System users</CardTitle></CardHeader><CardContent className="p-4 sm:p-6"><UsersTab /></CardContent></Card>
          </TabsContent>
        )}
        {canSeeStaff && (
          <TabsContent value="staff" className="mt-4">
            <Card className="overflow-hidden border-border/70 shadow-sm"><CardHeader className="border-b border-border/60 bg-gradient-to-r from-surface-2/50 to-surface-1"><CardTitle className="text-base">Staff members</CardTitle></CardHeader><CardContent className="p-4 sm:p-6"><StaffTab /></CardContent></Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
