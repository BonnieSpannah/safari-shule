import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Building2, Plus, Copy, CheckCircle2, Loader2, X, ChevronRight,
  MoreHorizontal, Pencil, ShieldOff, ShieldCheck, PauseCircle, Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusBadge } from '@/components/ui/status-badge';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  listTenants, createTenant, updateTenant, setTenantStatus,
  type PlanTier, type Tenant, type UpdateTenantInput,
} from '@/lib/api/tenants';
import { hasPermission } from '@/stores/auth.store';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const PHONE_RE = /^\+\d{7,15}$/;
const SLUG_PATTERN = /^[a-z][a-z0-9-]{1,40}$/;

const schoolSchema = z.object({
  slug: z.string().min(2, 'At least 2 characters').max(41, 'Too long')
    .regex(SLUG_PATTERN, 'Lowercase letters, digits, hyphens; must start with a letter'),
  subdomain: z.string().min(2, 'At least 2 characters').max(41, 'Too long')
    .regex(SLUG_PATTERN, 'Lowercase letters, digits, hyphens; must start with a letter'),
  name: z.string().min(2, 'Enter a school name'),
  contactEmail: z.string().email('Enter a valid email'),
  contactPhone: z.string().regex(PHONE_RE, 'E.164 format, e.g. +254712000001')
    .or(z.literal('')).transform((v) => (v === '' ? undefined : v)),
  planTier: z.enum(['basic', 'pro', 'enterprise'] as const),
});

const createSchema = schoolSchema.extend({
  adminFullName: z.string().min(2, 'Enter a full name'),
  adminEmail: z.string().email('Enter a valid email'),
  adminPhone: z.string().regex(PHONE_RE, 'E.164 format, e.g. +254712000001')
    .or(z.literal('')).transform((v) => (v === '' ? undefined : v)),
  adminPassword: z.string().min(10, 'At least 10 characters'),
});

type CreateForm = z.infer<typeof createSchema>;

const PLAN_OPTIONS: { value: PlanTier; label: string }[] = [
  { value: 'basic', label: 'Basic' },
  { value: 'pro', label: 'Pro (recommended)' },
  { value: 'enterprise', label: 'Enterprise' },
];

// ─── Status transition rules ───────────────────────────────────────────────────

type StatusAction = 'activate' | 'suspend' | 'deactivate' | 'delete';

const STATUS_ACTIONS: Record<string, StatusAction[]> = {
  active:      ['suspend', 'deactivate', 'delete'],
  suspended:   ['activate', 'deactivate', 'delete'],
  deactivated: ['activate', 'delete'],
  pending:     ['activate', 'delete'],
  cancelled:   ['delete'],
  deleted:     [],
};

const ACTION_META: Record<StatusAction, { label: string; icon: React.ReactNode; danger?: boolean; targetStatus: 'active' | 'suspended' | 'deactivated' | 'deleted' }> = {
  activate:   { label: 'Activate',   icon: <ShieldCheck className="h-4 w-4" />,  targetStatus: 'active' },
  suspend:    { label: 'Suspend',    icon: <PauseCircle className="h-4 w-4" />,  targetStatus: 'suspended' },
  deactivate: { label: 'Deactivate', icon: <ShieldOff className="h-4 w-4" />,   targetStatus: 'deactivated' },
  delete:     { label: 'Delete',     icon: <Trash2 className="h-4 w-4" />,      targetStatus: 'deleted', danger: true },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export function TenantsPage() {
  const queryClient = useQueryClient();
  const canManage = hasPermission('tenants.manage');

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [preview, setPreview] = useState<CreateForm | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ tenant: Tenant; action: StatusAction } | null>(null);
  const [lastCreated, setLastCreated] = useState<{ slug: string; adminEmail: string; adminPassword: string } | null>(null);

  const tenantsQuery = useQuery({ queryKey: ['tenants'], queryFn: listTenants, staleTime: 30_000 });

  const createForm = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      slug: '', subdomain: '', name: '', contactEmail: '', contactPhone: '',
      planTier: 'pro', adminFullName: '', adminEmail: '', adminPhone: '', adminPassword: '',
    },
  });
  const { register, handleSubmit, control, reset, watch, setValue, formState: { errors } } = createForm;

  const editForm = useForm<z.infer<typeof schoolSchema>>({
    resolver: zodResolver(schoolSchema),
  });

  const slug = watch('slug');
  const contactEmail = watch('contactEmail');
  const currentSubdomain = watch('subdomain');
  const currentAdminEmail = watch('adminEmail');

  const createMutation = useMutation({
    mutationFn: createTenant,
    onSuccess: async (data, variables) => {
      setLastCreated({ slug: data.tenant.slug, adminEmail: variables.initialAdmin.email, adminPassword: variables.initialAdmin.password });
      toast.success(`Tenant "${data.tenant.name}" created.`);
      reset(); setShowCreateForm(false); setPreview(null);
      await queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
    onError: (err) => {
      setPreview(null);
      if (err instanceof AxiosError) {
        const s = err.response?.status;
        if (s === 409) { toast.error('That slug or subdomain is already taken.'); return; }
        if (s === 400) { toast.error(err.response?.data?.message ?? 'Invalid input.'); return; }
        if (s === 403) { toast.error('You do not have permission to create tenants.'); return; }
      }
      toast.error('Could not create tenant. Please try again.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTenantInput }) => updateTenant(id, input),
    onSuccess: async () => {
      toast.success('Tenant updated.');
      setEditTenant(null);
      await queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
    onError: () => toast.error('Could not update tenant. Please try again.'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'suspended' | 'deactivated' | 'deleted' }) =>
      setTenantStatus(id, status),
    onSuccess: async (_, vars) => {
      toast.success(`Tenant ${vars.status}.`);
      setConfirmAction(null);
      await queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
    onError: () => toast.error('Could not update status. Please try again.'),
  });

  const onSubmitCreate = handleSubmit((values) => setPreview(values));

  const confirmCreate = () => {
    if (!preview) return;
    createMutation.mutate({
      slug: preview.slug, subdomain: preview.subdomain || preview.slug,
      name: preview.name, contactEmail: preview.contactEmail, contactPhone: preview.contactPhone,
      planTier: preview.planTier as PlanTier,
      initialAdmin: { email: preview.adminEmail, fullName: preview.adminFullName, phone: preview.adminPhone, password: preview.adminPassword },
    });
  };

  const openEdit = (tenant: Tenant) => {
    setEditTenant(tenant);
    editForm.reset({
      slug: tenant.slug,
      subdomain: tenant.subdomain,
      name: tenant.name,
      contactEmail: tenant.contactEmail,
      contactPhone: tenant.contactPhone ?? '',
      planTier: tenant.planTier,
    });
  };

  const onSubmitEdit = editForm.handleSubmit((values) => {
    if (!editTenant) return;
    updateMutation.mutate({
      id: editTenant.id,
      input: {
        name: values.name,
        contactEmail: values.contactEmail,
        contactPhone: values.contactPhone ?? null,
        planTier: values.planTier as PlanTier,
      },
    });
  });

  const cancelCreate = () => { setShowCreateForm(false); setPreview(null); reset(); };

  return (
    <div>
      <PageHeader
        title="Tenants"
        description="Every school on Safari Shule. Create a new tenant to onboard a school."
        actions={!showCreateForm && canManage && (
          <Button onClick={() => { setShowCreateForm(true); setLastCreated(null); }}>
            <Plus className="h-4 w-4" /> New tenant
          </Button>
        )}
      />

      {/* Credential reveal after creation */}
      {lastCreated && (
        <Card className="mb-6 border-emerald-500/40 bg-emerald-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" /> Tenant created
            </CardTitle>
            <CardDescription>
              Share these one-time credentials with the school's administrator — the password is only shown here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <CredentialRow label="Tenant slug" value={lastCreated.slug} />
            <CredentialRow label="Admin email" value={lastCreated.adminEmail} />
            <CredentialRow label="Admin password" value={lastCreated.adminPassword} sensitive />
          </CardContent>
        </Card>
      )}

      {/* Create form */}
      {showCreateForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>New tenant</CardTitle>
            <CardDescription>
              Fields marked <span className="text-danger font-medium">*</span> are required. The slug is the short code schools type on login (e.g.{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">school-name</code>). The subdomain auto-fills from the slug.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-8" onSubmit={onSubmitCreate} noValidate>
              <SchoolFields
                register={register} control={control} errors={errors}
                slug={slug} contactEmail={contactEmail}
                currentSubdomain={currentSubdomain} currentAdminEmail={currentAdminEmail}
                setValue={setValue}
              />
              <section>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Initial administrator</h4>
                <p className="mb-4 text-xs text-muted-foreground">
                  Receives the <code className="rounded bg-muted px-1 py-0.5">school_manager</code> role — full control over their school, no cross-tenant access.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Full name" required error={errors.adminFullName?.message}>
                    <Input placeholder="Full name" invalid={!!errors.adminFullName} {...register('adminFullName')} />
                  </FormField>
                  <FormField label="Email" required error={errors.adminEmail?.message}>
                    <Input type="email" placeholder={contactEmail || 'admin@school.ac.ke'} invalid={!!errors.adminEmail} {...register('adminEmail')} />
                  </FormField>
                  <FormField label="Phone" error={errors.adminPhone?.message} hint="E.164 format, e.g. +254712000001">
                    <Input type="tel" placeholder="+254712000001" invalid={!!errors.adminPhone} {...register('adminPhone')} />
                  </FormField>
                  <FormField label="Temporary password" required error={errors.adminPassword?.message} hint="Share securely — admin changes on first login.">
                    <Input type="text" placeholder="At least 10 characters" invalid={!!errors.adminPassword} autoComplete="new-password" {...register('adminPassword')} />
                  </FormField>
                </div>
              </section>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <Button type="button" variant="destructive" className="gap-1.5" onClick={cancelCreate}>
                  <X className="h-4 w-4" /> Cancel
                </Button>
                <Button type="submit" className="gap-1.5 bg-green-600 hover:bg-green-700 focus-visible:ring-green-600">
                  Review &amp; create <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Create preview dialog */}
      <Dialog open={!!preview} onOpenChange={(open) => { if (!open) setPreview(null); }}>
        <DialogContent hideCloseButton>
          <DialogHeader><DialogTitle>Confirm new tenant</DialogTitle></DialogHeader>
          {preview && (
            <div className="space-y-4 text-sm">
              <PreviewSection title="School">
                <PreviewRow label="Name" value={preview.name} />
                <PreviewRow label="Slug" value={preview.slug} mono />
                <PreviewRow label="Subdomain" value={preview.subdomain} mono />
                <PreviewRow label="Plan" value={preview.planTier} />
                <PreviewRow label="Contact email" value={preview.contactEmail} />
                {preview.contactPhone && <PreviewRow label="Contact phone" value={preview.contactPhone} />}
              </PreviewSection>
              <PreviewSection title="Initial administrator">
                <PreviewRow label="Name" value={preview.adminFullName} />
                <PreviewRow label="Email" value={preview.adminEmail} />
                {preview.adminPhone && <PreviewRow label="Phone" value={preview.adminPhone} />}
                <PreviewRow label="Password" value={preview.adminPassword} sensitive />
              </PreviewSection>
            </div>
          )}
          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <Button type="button" variant="destructive" className="gap-1.5" onClick={() => setPreview(null)}>
              <X className="h-4 w-4" /> Back
            </Button>
            <Button type="button" disabled={createMutation.isPending} onClick={confirmCreate}
              className="gap-1.5 bg-green-600 hover:bg-green-700 focus-visible:ring-green-600">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
              Confirm &amp; create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTenant} onOpenChange={(open) => { if (!open) setEditTenant(null); }}>
        <DialogContent hideCloseButton className="max-w-2xl">
          <DialogHeader><DialogTitle>Edit tenant — {editTenant?.name}</DialogTitle></DialogHeader>
          <form onSubmit={onSubmitEdit} noValidate className="space-y-6">
            <SchoolFields
              register={editForm.register}
              control={editForm.control}
              errors={editForm.formState.errors}
              slug={editTenant?.slug ?? ''}
              contactEmail=""
              currentSubdomain=""
              currentAdminEmail=""
              setValue={editForm.setValue}
              readOnlySlug
            />
            <DialogFooter className="flex items-center justify-between sm:justify-between">
              <Button type="button" variant="destructive" className="gap-1.5" onClick={() => setEditTenant(null)}>
                <X className="h-4 w-4" /> Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}
                className="gap-1.5 bg-green-600 hover:bg-green-700 focus-visible:ring-green-600">
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Status-change confirm dialog */}
      <Dialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <DialogContent hideCloseButton>
          <DialogHeader>
            <DialogTitle>
              {confirmAction && ACTION_META[confirmAction.action].label}{' '}
              {confirmAction?.tenant.name}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmAction?.action === 'delete'
              ? 'This will soft-delete the tenant. Users will be locked out immediately. The record is retained for compliance.'
              : confirmAction?.action === 'suspend'
              ? 'Users in this school will be locked out until the tenant is reactivated.'
              : confirmAction?.action === 'deactivate'
              ? 'The school will be deactivated and all users locked out.'
              : 'The school will be reactivated and users can sign in again.'}
          </p>
          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button
              type="button"
              disabled={statusMutation.isPending}
              onClick={() => confirmAction && statusMutation.mutate({ id: confirmAction.tenant.id, status: ACTION_META[confirmAction.action].targetStatus })}
              className={confirmAction?.action === 'delete' || confirmAction?.action === 'suspend' ? 'bg-destructive hover:bg-destructive/90' : 'bg-green-600 hover:bg-green-700'}
            >
              {statusMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {confirmAction && ACTION_META[confirmAction.action].label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tenants table */}
      <Card>
        <CardHeader>
          <CardTitle>All tenants</CardTitle>
          <CardDescription>
            {tenantsQuery.data ? `${tenantsQuery.data.length} tenant${tenantsQuery.data.length === 1 ? '' : 's'} on the platform` : 'Loading…'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tenantsQuery.isLoading && <ListSkeleton />}
          {tenantsQuery.isError && (
            <div className="rounded-md border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
              Failed to load tenants. Retry the page or check your connection.
            </div>
          )}
          {tenantsQuery.data?.length === 0 && <EmptyState />}
          {tenantsQuery.data && tenantsQuery.data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-3 pr-6 font-medium">School</th>
                    <th className="py-3 pr-6 font-medium">Plan</th>
                    <th className="py-3 pr-6 font-medium">Contact</th>
                    <th className="py-3 pr-6 font-medium">Since</th>
                    <th className="py-3 pr-6 font-medium">Status</th>
                    <th className="py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {tenantsQuery.data.map((t) => (
                    <TenantRow
                      key={t.id}
                      tenant={t}
                      canManage={canManage}
                      onEdit={() => openEdit(t)}
                      onAction={(action) => setConfirmAction({ tenant: t, action })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Shared school form fields ────────────────────────────────────────────────

function SchoolFields({
  register, control, errors, slug, contactEmail, currentSubdomain, currentAdminEmail, setValue, readOnlySlug,
}: {
  register: ReturnType<typeof useForm>['register'];
  control: ReturnType<typeof useForm>['control'];
  errors: Record<string, { message?: string } | undefined>;
  slug: string; contactEmail: string; currentSubdomain: string; currentAdminEmail: string;
  setValue: ReturnType<typeof useForm>['setValue'];
  readOnlySlug?: boolean;
}) {
  return (
    <section>
      <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">School details</h4>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="School name" required error={errors.name?.message}>
          <Input autoFocus placeholder="School name" invalid={!!errors.name} {...register('name')} />
        </FormField>
        <FormField label="Slug (login code)" required error={errors.slug?.message} hint={readOnlySlug ? 'Slug cannot be changed after creation' : 'Lowercase letters, digits and hyphens only'}>
          <Input placeholder="school-name" invalid={!!errors.slug} autoCapitalize="off" spellCheck={false}
            readOnly={readOnlySlug} disabled={readOnlySlug}
            {...register('slug')}
            onBlur={(e) => { if (!readOnlySlug && !currentSubdomain && e.target.value) setValue('subdomain', e.target.value); }}
          />
        </FormField>
        <FormField label="Subdomain" required error={errors.subdomain?.message} hint={slug ? `Defaults to "${slug}"` : 'Auto-filled from slug'}>
          <Input placeholder="school-name" invalid={!!errors.subdomain} autoCapitalize="off" spellCheck={false} {...register('subdomain')} />
        </FormField>
        <FormField label="Plan tier" required error={errors.planTier?.message}>
          <Controller name="planTier" control={control} render={({ field }) => (
            <Select invalid={!!errors.planTier} {...field}>
              {PLAN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          )} />
        </FormField>
        <FormField label="Contact email" required error={errors.contactEmail?.message}>
          <Input type="email" placeholder="contact@school.ac.ke" invalid={!!errors.contactEmail}
            {...register('contactEmail')}
            onBlur={(e) => { if (!currentAdminEmail && e.target.value) setValue('adminEmail', e.target.value); }}
          />
        </FormField>
        <FormField label="Contact phone" error={errors.contactPhone?.message} hint="E.164 format, e.g. +254712000001">
          <Input type="tel" placeholder="+254712000001" invalid={!!errors.contactPhone} {...register('contactPhone')} />
        </FormField>
      </div>
    </section>
  );
}

// ─── Table row ────────────────────────────────────────────────────────────────

function TenantRow({ tenant: t, canManage, onEdit, onAction }: {
  tenant: Tenant;
  canManage: boolean;
  onEdit: () => void;
  onAction: (action: StatusAction) => void;
}) {
  const availableActions = STATUS_ACTIONS[t.status] ?? [];
  return (
    <tr className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
      <td className="py-3 pr-6">
        <div className="font-medium">{t.name}</div>
        <span className="mt-0.5 inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{t.slug}</span>
      </td>
      <td className="py-3 pr-6"><PlanBadge tier={t.planTier} /></td>
      <td className="py-3 pr-6">
        <div className="text-muted-foreground">{t.contactEmail}</div>
        {t.contactPhone && <div className="mt-0.5 text-xs text-muted-foreground">{t.contactPhone}</div>}
      </td>
      <td className="py-3 pr-6">
        <div className="text-muted-foreground">{format(new Date(t.createdAt), 'd MMM yyyy')}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
        </div>
      </td>
      <td className="py-3 pr-6"><StatusBadge status={t.status} /></td>
      <td className="py-3">
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded p-1.5 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Tenant actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={onEdit} className="gap-2">
                <Pencil className="h-4 w-4" /> Edit details
              </DropdownMenuItem>
              {availableActions.length > 0 && <DropdownMenuSeparator />}
              {availableActions.map((action) => {
                const meta = ACTION_META[action];
                return (
                  <DropdownMenuItem
                    key={action}
                    onSelect={() => onAction(action)}
                    className={`gap-2 ${meta.danger ? 'text-destructive focus:text-destructive' : ''}`}
                  >
                    {meta.icon} {meta.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </td>
    </tr>
  );
}

// ─── Form helpers ─────────────────────────────────────────────────────────────

function FormField({ label, required, error, hint, children }: {
  label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}{required && <span className="ml-0.5 text-danger">*</span>}</Label>
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="divide-y divide-border/50 rounded-md border border-border">{children}</div>
    </div>
  );
}

function PreviewRow({ label, value, mono, sensitive }: {
  label: string; value: string; mono?: boolean; sensitive?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="flex items-center gap-4 px-3 py-2 text-sm">
      <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
      <span className={`flex-1 truncate ${mono ? 'font-mono text-xs' : ''}`}>
        {sensitive && !revealed ? '••••••••••' : value}
      </span>
      {sensitive && (
        <button type="button" className="shrink-0 text-xs text-muted-foreground underline" onClick={() => setRevealed((v) => !v)}>
          {revealed ? 'hide' : 'show'}
        </button>
      )}
    </div>
  );
}

function CredentialRow({ label, value, sensitive }: { label: string; value: string; sensitive?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
      <code className="flex-1 rounded bg-background px-2 py-1 font-mono text-xs">{value}</code>
      <button type="button" aria-label={`Copy ${label}`} className="rounded p-1 text-muted-foreground hover:bg-muted"
        onClick={() => { void navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
        {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

function PlanBadge({ tier }: { tier: PlanTier }) {
  const styles: Record<PlanTier, string> = {
    basic: 'bg-zinc-500/15 text-zinc-700 ring-zinc-400/30',
    pro: 'bg-blue-500/15 text-blue-700 ring-blue-400/30',
    enterprise: 'bg-violet-500/15 text-violet-700 ring-violet-400/30',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset capitalize ${styles[tier]}`}>
      {tier}
    </span>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-md bg-muted/40" />)}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <Building2 className="h-10 w-10 text-muted-foreground" />
      <div className="text-sm font-medium">No tenants yet</div>
      <p className="max-w-md text-xs text-muted-foreground">
        Click <span className="font-medium">New tenant</span> above to onboard the first school.
        Credentials are shown once after creation — save them before closing.
      </p>
    </div>
  );
}
