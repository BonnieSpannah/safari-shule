import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { UserPlus, Mail, Phone, UserX, UserCheck, Search } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { ActionMenu } from '@/components/ui/action-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormActions } from '@/components/ui/form-actions';

import { usePermission, useAnyPermission } from '@/hooks/usePermission';
import { useDebounce } from '@/hooks/useDebounce';
import { humanizeRole } from '@/lib/roles';
import { listUsers, inviteUser, deactivateUser, activateUser, type User } from '@/lib/api/users';
import { listStaff, createStaffMember, updateStaffMember, deleteStaffMember, type StaffMember } from '@/lib/api/staff';

// ─── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 10;

const STAFF_ROLES = [
  { value: 'school_manager', label: 'School Manager' },
  { value: 'transport_admin', label: 'Transport Admin' },
  { value: 'dispatcher', label: 'Dispatcher' },
  { value: 'driver', label: 'Driver' },
  { value: 'assistant', label: 'Assistant' },
];

// ─── Invite schema ─────────────────────────────────────────────────────────────
const inviteSchema = z.object({
  email: z.string().email('Enter a valid email'),
  fullName: z.string().min(2, 'Enter a full name'),
  phone: z.string().trim().regex(/^\+254[17]\d{8}$/, 'Must be a valid Kenyan mobile number, e.g. +254712345678').or(z.literal('')).optional(),
  roleKeys: z.array(z.string()).min(1, 'Select at least one role'),
});
type InviteForm = z.infer<typeof inviteSchema>;

// ─── Staff schema ──────────────────────────────────────────────────────────────
const staffSchema = z.object({
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

// ─── Users tab ────────────────────────────────────────────────────────────────
function UsersTab() {
  const canManage = usePermission('invitations.send');
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmUser, setConfirmUser] = useState<{ user: User; action: 'deactivate' | 'activate' } | null>(null);

  const dSearch = useDebounce(search, 300);

  const query = useQuery({
    queryKey: ['users', dSearch, page],
    queryFn: () => listUsers({ q: dSearch || undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: (prev) => prev,
  });

  const users = query.data?.data ?? [];
  const total = query.data?.meta.total ?? 0;

  const form = useForm<InviteForm>({ resolver: zodResolver(inviteSchema), mode: 'onChange' });

  const inviteMutation = useMutation({
    mutationFn: (v: InviteForm) => inviteUser({ ...v, phone: v.phone || undefined }),
    onSuccess: () => {
      toast.success('Invitation sent.');
      setInviteOpen(false);
      form.reset();
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () => toast.error('Failed to send invitation.'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ user, action }: { user: User; action: 'deactivate' | 'activate' }) =>
      action === 'deactivate' ? deactivateUser(user.id) : activateUser(user.id),
    onSuccess: (_, { action }) => {
      toast.success(action === 'deactivate' ? 'User deactivated.' : 'User activated.');
      setConfirmUser(null);
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () => toast.error('Could not update user status.'),
  });

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'Name',
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
      render: (u) => <StatusBadge status={u.status} />,
    },
    {
      key: 'lastLogin',
      header: 'Last sign-in',
      width: 'w-36',
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
      render: (u) => <span className="text-xs text-muted-foreground">{format(new Date(u.createdAt), 'd MMM yyyy')}</span>,
    },
    {
      key: 'actions',
      header: '',
      width: 'w-10',
      render: (u) => (
        <ActionMenu items={[
          u.status === 'active'
            ? { label: 'Deactivate', icon: <UserX className="h-4 w-4" />, permission: 'invitations.send', onClick: () => setConfirmUser({ user: u, action: 'deactivate' }), variant: 'destructive' }
            : { label: 'Activate', icon: <UserCheck className="h-4 w-4" />, permission: 'invitations.send', onClick: () => setConfirmUser({ user: u, action: 'activate' }) },
        ]} />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search users…" className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        {canManage && (
          <Button onClick={() => setInviteOpen(true)} className="gap-1.5 bg-green-600 hover:bg-green-700">
            <UserPlus className="h-4 w-4" /> Invite user
          </Button>
        )}
      </div>

      <DataTable columns={columns} rows={users} rowKey={(u) => u.id} loading={query.isLoading} skeletonRows={PAGE_SIZE} empty={<div className="py-10 text-center text-sm text-muted-foreground">No users found.</div>} />
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={(o) => { if (!o) { setInviteOpen(false); form.reset(); } }}>
        <DialogContent hideCloseButton className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite user</DialogTitle>
            <p className="text-sm text-muted-foreground">An invitation email will be sent with a link to set their password.</p>
            <hr className="mt-1 border-border" />
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => inviteMutation.mutate(v))} noValidate className="space-y-4">
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
            <FormActions onCancel={() => { setInviteOpen(false); form.reset(); }} submitLabel="Send invitation" pending={inviteMutation.isPending} />
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm deactivate/activate */}
      {confirmUser && (
        <ConfirmDialog
          open
          onOpenChange={(o) => { if (!o) setConfirmUser(null); }}
          title={confirmUser.action === 'deactivate' ? 'Deactivate user?' : 'Activate user?'}
          description={confirmUser.action === 'deactivate'
            ? `${confirmUser.user.fullName} will lose access immediately.`
            : `${confirmUser.user.fullName} will regain access.`}
          confirmLabel={confirmUser.action === 'deactivate' ? 'Deactivate' : 'Activate'}
          destructive={confirmUser.action === 'deactivate'}
          onConfirm={() => statusMutation.mutate(confirmUser)}
          pending={statusMutation.isPending}
        />
      )}
    </div>
  );
}

// ─── Staff tab ────────────────────────────────────────────────────────────────
function StaffTab() {
  const canManage = usePermission('staff.create');
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);

  const dSearch = useDebounce(search, 300);

  const query = useQuery({
    queryKey: ['staff', dSearch, page],
    queryFn: () => listStaff({ q: dSearch || undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: (prev) => prev,
  });

  const staff = query.data?.data ?? [];
  const total = query.data?.meta.total ?? 0;

  const form = useForm<StaffForm>({ resolver: zodResolver(staffSchema), mode: 'onChange' });

  const openCreate = () => { setEditing(null); form.reset({}); setDialogOpen(true); };
  const openEdit = (s: StaffMember) => {
    setEditing(s);
    form.reset({
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
    mutationFn: (v: StaffForm) => {
      const input = { ...v, phone: v.phoneE164, email: v.email || null };
      return editing ? updateStaffMember(editing.id, input as any) : createStaffMember(input as any);
    },
    onSuccess: () => {
      toast.success(editing ? 'Staff member updated.' : 'Staff member added.');
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ['staff'] });
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
      render: (s) => (
        <div>
          <div className="font-medium">{s.legalName}</div>
          <div className="text-xs text-muted-foreground">{s.employeeNumber}</div>
        </div>
      ),
    },
    { key: 'position', header: 'Position', render: (s) => <span className="text-muted-foreground">{s.position}</span> },
    {
      key: 'contact',
      header: 'Contact',
      render: (s) => (
        <div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{s.phoneE164}</div>
          {s.email && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="h-3 w-3" />{s.email}</div>}
        </div>
      ),
    },
    { key: 'gender', header: 'Gender', width: 'w-24', render: (s) => <span className="capitalize text-muted-foreground">{s.gender}</span> },
    { key: 'joined', header: 'Added', width: 'w-28', render: (s) => <span className="text-xs text-muted-foreground">{format(new Date(s.createdAt), 'd MMM yyyy')}</span> },
    {
      key: 'actions',
      header: '',
      width: 'w-10',
      render: (s) => (
        <ActionMenu items={[
          { label: 'Edit', permission: 'staff.edit', onClick: () => openEdit(s) },
          { label: 'Remove', permission: 'staff.delete', onClick: () => setDeleteTarget(s), variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search staff…" className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        {canManage && (
          <Button onClick={openCreate} className="gap-1.5 bg-green-600 hover:bg-green-700">
            <UserPlus className="h-4 w-4" /> Add staff
          </Button>
        )}
      </div>

      <DataTable columns={columns} rows={staff} rowKey={(s) => s.id} loading={query.isLoading} skeletonRows={PAGE_SIZE} empty={<div className="py-10 text-center text-sm text-muted-foreground">No staff members found.</div>} />
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false); }}>
        <DialogContent hideCloseButton className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit — ${editing.legalName}` : 'Add staff member'}</DialogTitle>
            <p className="text-sm text-muted-foreground">School staff member details</p>
            <hr className="mt-1 border-border" />
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} noValidate className="space-y-4">
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
                  <Input type={type} placeholder={placeholder} invalid={!!(form.formState.errors as any)[field]} {...form.register(field)} />
                  {(form.formState.errors as any)[field] && <p className="text-xs text-danger">{(form.formState.errors as any)[field]?.message}</p>}
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
            <FormActions onCancel={() => setDialogOpen(false)} submitLabel={editing ? 'Save changes' : 'Add staff member'} pending={saveMutation.isPending} />
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
            <Card><CardHeader><CardTitle className="text-base">System users</CardTitle></CardHeader><CardContent><UsersTab /></CardContent></Card>
          </TabsContent>
        )}
        {canSeeStaff && (
          <TabsContent value="staff" className="mt-4">
            <Card><CardHeader><CardTitle className="text-base">Staff members</CardTitle></CardHeader><CardContent><StaffTab /></CardContent></Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
