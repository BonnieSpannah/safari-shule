import { useState, useMemo, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { format, formatDistanceToNow, subDays, startOfDay, endOfDay } from 'date-fns';
import {
  Building2, Plus, Copy, CheckCircle2, Loader2, X, ChevronRight,
  MoreHorizontal, Pencil, ShieldOff, ShieldCheck, PauseCircle, Trash2, Eye,
  Search, Filter, ChevronDown, Check, CalendarDays, RotateCcw,
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
import { useNavigate } from 'react-router-dom';
import {
  listTenants, createTenant, updateTenant, setTenantStatus,
  type PlanTier, type Tenant, type UpdateTenantInput,
} from '@/lib/api/tenants';
import { hasPermission } from '@/stores/auth.store';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const SLUG_PATTERN = /^[a-z][a-z0-9-]{1,40}$/;
// Inline so the correct message shows regardless of baked-in shared-types dist.
const optionalPhone = z
  .string()
  .trim()
  .regex(/^\+254[17]\d{8}$/, 'Must be a valid Kenyan mobile number, e.g. +254712345678')
  .or(z.literal(''))
  .transform((v) => (v === '' ? undefined : v));

const schoolSchema = z.object({
  slug: z.string().min(2, 'At least 2 characters').max(41, 'Too long')
    .regex(SLUG_PATTERN, 'Lowercase letters, digits, hyphens; must start with a letter'),
  subdomain: z.string().min(2, 'At least 2 characters').max(41, 'Too long')
    .regex(SLUG_PATTERN, 'Lowercase letters, digits, hyphens; must start with a letter'),
  name: z.string().min(2, 'Enter a school name'),
  contactEmail: z.string().email('Enter a valid email'),
  contactPhone: optionalPhone,
  planTier: z.enum(['basic', 'pro', 'enterprise'] as const),
});

const createSchema = schoolSchema.extend({
  adminFullName: z.string().min(2, 'Enter a full name'),
  adminEmail: z.string().email('Enter a valid email'),
  adminPhone: optionalPhone,
  adminPassword: z.string().min(10, 'At least 10 characters'),
});

type CreateForm = z.infer<typeof createSchema>;

const PLAN_OPTIONS: { value: PlanTier; label: string }[] = [
  { value: 'basic', label: 'Basic' },
  { value: 'pro', label: 'Pro (recommended)' },
  { value: 'enterprise', label: 'Enterprise' },
];

// ─── Status transition rules ───────────────────────────────────────────────────

type StatusAction = 'activate' | 'suspend' | 'deactivate' | 'delete' | 'restore';

const STATUS_ACTIONS: Record<string, StatusAction[]> = {
  active:      ['suspend', 'deactivate', 'delete'],
  suspended:   ['activate', 'deactivate', 'delete'],
  deactivated: ['activate', 'delete'],
  pending:     ['activate', 'delete'],
  cancelled:   ['delete'],
  deleted:     ['restore'],
};

const ACTION_META: Record<StatusAction, { label: string; icon: React.ReactNode; danger?: boolean; targetStatus: 'active' | 'suspended' | 'deactivated' | 'deleted' }> = {
  activate:   { label: 'Activate',   icon: <ShieldCheck className="h-4 w-4" />,  targetStatus: 'active' },
  restore:    { label: 'Restore',    icon: <RotateCcw className="h-4 w-4" />,   targetStatus: 'active' },
  suspend:    { label: 'Suspend',    icon: <PauseCircle className="h-4 w-4" />,  targetStatus: 'suspended' },
  deactivate: { label: 'Deactivate', icon: <ShieldOff className="h-4 w-4" />,   targetStatus: 'deactivated' },
  delete:     { label: 'Delete',     icon: <Trash2 className="h-4 w-4" />,      targetStatus: 'deleted', danger: true },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export function TenantsPage() {
  const queryClient = useQueryClient();
  const canManage = hasPermission('tenants.manage');
  const navigate = useNavigate();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [preview, setPreview] = useState<CreateForm | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ tenant: Tenant; action: StatusAction } | null>(null);
  const [lastCreated, setLastCreated] = useState<{ slug: string; adminEmail: string; adminPassword: string } | null>(null);

  // ── Filter / search / pagination state
  const [search, setSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [planFilters, setPlanFilters] = useState<string[]>([]);
  const [createdFrom, setCreatedFrom] = useState<string>(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [createdTo, setCreatedTo] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [showFilters, setShowFilters] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'status' | 'plan' | 'date' | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const DATE_PRESETS = [
    { label: 'Last 7 days', from: format(subDays(new Date(), 7), 'yyyy-MM-dd'), to: todayStr },
    { label: 'Last 30 days', from: format(subDays(new Date(), 30), 'yyyy-MM-dd'), to: todayStr },
    { label: 'Last 90 days', from: format(subDays(new Date(), 90), 'yyyy-MM-dd'), to: todayStr },
    { label: 'All time', from: '', to: '' },
  ];

  const tenantsQuery = useQuery({ queryKey: ['tenants'], queryFn: listTenants, staleTime: 30_000 });

  const filtered = useMemo(() => {
    const all = tenantsQuery.data ?? [];
    const q = search.trim().toLowerCase();
    const from = createdFrom ? startOfDay(new Date(createdFrom)).getTime() : null;
    const to = createdTo ? endOfDay(new Date(createdTo)).getTime() : null;
    return all.filter((t) => {
      if (q && !t.name.toLowerCase().includes(q) && !t.slug.toLowerCase().includes(q) && !t.contactEmail.toLowerCase().includes(q)) return false;
      if (statusFilters.length > 0 && !statusFilters.includes(t.status)) return false;
      if (planFilters.length > 0 && !planFilters.includes(t.planTier)) return false;
      if (from && new Date(t.createdAt).getTime() < from) return false;
      if (to && new Date(t.createdAt).getTime() > to) return false;
      return true;
    });
  }, [tenantsQuery.data, search, statusFilters, planFilters, createdFrom, createdTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const setFilter = (fn: () => void) => { fn(); setPage(1); };

  const toggleStatus = (s: string) => setFilter(() => setStatusFilters((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  const togglePlan = (p: string) => setFilter(() => setPlanFilters((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  const defaultFrom = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const hasActiveFilters = statusFilters.length > 0 || planFilters.length > 0 || createdFrom !== defaultFrom || createdTo !== todayStr;
  const resetFilters = () => setFilter(() => { setStatusFilters([]); setPlanFilters([]); setCreatedFrom(defaultFrom); setCreatedTo(todayStr); });

  // Close any open filter dropdown when clicking outside the filter panel
  const filterPanelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!openDropdown) return;
    const handler = (e: MouseEvent) => {
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openDropdown]);

  const createForm = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    mode: 'onChange',
    defaultValues: {
      slug: '', subdomain: '', name: '', contactEmail: '', contactPhone: '',
      planTier: 'pro', adminFullName: '', adminEmail: '', adminPhone: '', adminPassword: '',
    },
  });
  const { register, handleSubmit, control, reset, watch, setValue, formState: { errors } } = createForm;

  const editForm = useForm<z.infer<typeof schoolSchema>>({
    resolver: zodResolver(schoolSchema),
    mode: 'onChange',
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

  const STATUS_MESSAGES: Record<StatusAction, string> = {
    activate:   'Tenant activated.',
    restore:    'Tenant restored.',
    suspend:    'Tenant suspended.',
    deactivate: 'Tenant deactivated.',
    delete:     'Tenant deleted.',
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'suspended' | 'deactivated' | 'deleted'; action: StatusAction }) =>
      setTenantStatus(id, status),
    onSuccess: async (_, vars) => {
      toast.success(STATUS_MESSAGES[vars.action]);
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
        title="Tenants/Schools"
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
                  <FormField label="Phone" error={errors.adminPhone?.message} hint="Valid Kenyan mobile, e.g. +254712345678">
                    <Input type="tel" placeholder="+254712345678" invalid={!!errors.adminPhone} {...register('adminPhone')} />
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
        <DialogContent hideCloseButton className="max-w-2xl">
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
        <DialogContent hideCloseButton className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit tenant — {editTenant?.name}</DialogTitle>
            <p className="text-sm text-muted-foreground">School / tenant details</p>
            <hr className="mt-1 border-border" />
          </DialogHeader>
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
            <DialogFooter className="flex items-center justify-between border-t border-border pt-4 sm:justify-between">
              <Button type="button" variant="destructive" className="gap-1.5" onClick={() => setEditTenant(null)}>
                <X className="h-4 w-4" /> Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}
                className="gap-1.5 bg-green-600 hover:bg-green-700 focus-visible:ring-green-600">
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save changes
                {!updateMutation.isPending && <ChevronRight className="h-4 w-4" />}
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
              : confirmAction?.action === 'restore'
              ? 'This will restore the tenant and reactivate all associated users.'
              : confirmAction?.action === 'suspend'
              ? 'Users in this school will be locked out until the tenant is reactivated.'
              : confirmAction?.action === 'deactivate'
              ? 'The school will be deactivated and all users locked out.'
              : 'The school will be reactivated and users can sign in again.'}
          </p>
          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <Button type="button" variant="destructive" className="gap-1.5" onClick={() => setConfirmAction(null)}>
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button
              type="button"
              disabled={statusMutation.isPending}
              onClick={() => confirmAction && statusMutation.mutate({ id: confirmAction.tenant.id, status: ACTION_META[confirmAction.action].targetStatus, action: confirmAction.action })}
              variant={confirmAction?.action === 'activate' || confirmAction?.action === 'restore' ? 'default' : 'destructive'}
              className={`gap-1.5 ${confirmAction?.action === 'activate' || confirmAction?.action === 'restore' ? 'bg-green-600 hover:bg-green-700 text-white focus-visible:ring-green-600' : ''}`}
            >
              {statusMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {confirmAction && ACTION_META[confirmAction.action].label}
              {!statusMutation.isPending && <ChevronRight className="h-4 w-4" />}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tenants table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>All tenants</CardTitle>
              <CardDescription className="mt-0.5">
                {tenantsQuery.isLoading ? 'Loading…' : `${filtered.length} of ${tenantsQuery.data?.length ?? 0} tenant${(tenantsQuery.data?.length ?? 0) === 1 ? '' : 's'}`}
              </CardDescription>
            </div>
            {/* Search + filter toggle */}
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search name, slug or email…"
                  value={search}
                  onChange={(e) => setFilter(() => setSearch(e.target.value))}
                  className="pl-8 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                title="Toggle filters"
                className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md border transition-colors ${showFilters || hasActiveFilters ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}
              >
                <Filter className="h-4 w-4" />
                {hasActiveFilters && (
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-primary" />
                )}
              </button>
            </div>
          </div>

          {/* Collapsible filter panel */}
          {showFilters && (
            <div ref={filterPanelRef} className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">

              {/* Status multi-select */}
              <div className="relative">
                <button type="button" onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
                  className={`flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors ${statusFilters.length > 0 ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}>
                  Status {statusFilters.length > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{statusFilters.length}</span>}
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
                {openDropdown === 'status' && (
                  <div className="absolute left-0 top-full z-20 mt-1 w-44 rounded-lg border border-border bg-card shadow-lg">
                    <div className="p-1">
                      {['active', 'pending', 'suspended', 'deactivated', 'cancelled', 'deleted'].map((s) => (
                        <button key={s} type="button" onClick={() => toggleStatus(s)}
                          className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs capitalize hover:bg-muted">
                          <span className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${statusFilters.includes(s) ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>
                            {statusFilters.includes(s) && <Check className="h-2.5 w-2.5" />}
                          </span>
                          {s}
                        </button>
                      ))}
                      {statusFilters.length > 0 && (
                        <button type="button" onClick={() => setFilter(() => setStatusFilters([]))}
                          className="mt-1 w-full rounded px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground border-t border-border pt-2">
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Plan multi-select */}
              <div className="relative">
                <button type="button" onClick={() => setOpenDropdown(openDropdown === 'plan' ? null : 'plan')}
                  className={`flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors ${planFilters.length > 0 ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}>
                  Plan {planFilters.length > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{planFilters.length}</span>}
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
                {openDropdown === 'plan' && (
                  <div className="absolute left-0 top-full z-20 mt-1 w-36 rounded-lg border border-border bg-card shadow-lg">
                    <div className="p-1">
                      {['basic', 'pro', 'enterprise'].map((p) => (
                        <button key={p} type="button" onClick={() => togglePlan(p)}
                          className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs capitalize hover:bg-muted">
                          <span className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${planFilters.includes(p) ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>
                            {planFilters.includes(p) && <Check className="h-2.5 w-2.5" />}
                          </span>
                          {p}
                        </button>
                      ))}
                      {planFilters.length > 0 && (
                        <button type="button" onClick={() => setFilter(() => setPlanFilters([]))}
                          className="mt-1 w-full rounded px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground border-t border-border pt-2">
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Date range */}
              <div className="relative">
                <button type="button" onClick={() => setOpenDropdown(openDropdown === 'date' ? null : 'date')}
                  className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {createdFrom && createdTo ? `${format(new Date(createdFrom + 'T12:00:00'), 'd MMM')} – ${format(new Date(createdTo + 'T12:00:00'), 'd MMM yyyy')}` : createdFrom ? `From ${format(new Date(createdFrom + 'T12:00:00'), 'd MMM yyyy')}` : 'All time'}
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
                {openDropdown === 'date' && (
                  <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-lg border border-border bg-card shadow-lg">
                    <div className="p-3 space-y-3">
                      <div className="grid grid-cols-2 gap-1">
                        {DATE_PRESETS.map((preset) => {
                          const active = createdFrom === preset.from && createdTo === preset.to;
                          return (
                            <button key={preset.label} type="button"
                              onClick={() => setFilter(() => { setCreatedFrom(preset.from); setCreatedTo(preset.to); })}
                              className={`rounded px-2 py-1.5 text-xs font-medium transition-colors text-left ${active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}>
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="border-t border-border pt-2 space-y-2">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Custom range</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <label className="block text-[10px] text-muted-foreground mb-0.5">From</label>
                            <input type="date" value={createdFrom} max={createdTo || undefined}
                              onChange={(e) => setFilter(() => setCreatedFrom(e.target.value))}
                              className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
                          </div>
                          <div className="flex-1">
                            <label className="block text-[10px] text-muted-foreground mb-0.5">To</label>
                            <input type="date" value={createdTo} min={createdFrom || undefined}
                              onChange={(e) => setFilter(() => setCreatedTo(e.target.value))}
                              className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {hasActiveFilters && (
                <button type="button" onClick={resetFilters}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground ml-1">
                  <X className="h-3 w-3" /> Reset all
                </button>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {tenantsQuery.isLoading && <ListSkeleton />}
          {tenantsQuery.isError && (
            <div className="rounded-md border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
              Failed to load tenants. Retry the page or check your connection.
            </div>
          )}
          {tenantsQuery.data?.length === 0 && <EmptyState />}
          {!tenantsQuery.isLoading && tenantsQuery.data && tenantsQuery.data.length > 0 && filtered.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">No tenants match your filters.</div>
          )}
          {paginated.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="py-3 pr-6 font-medium">Tenant/School</th>
                      <th className="py-3 pr-6 font-medium">Plan</th>
                      <th className="py-3 pr-6 font-medium">Contact</th>
                      <th className="py-3 pr-6 font-medium">Since</th>
                      <th className="py-3 pr-6 font-medium">Status</th>
                      <th className="py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((t) => (
                      <TenantRow
                        key={t.id}
                        tenant={t}
                        canManage={canManage}
                        onView={() => navigate(`/platform/tenants/${t.id}`)}
                        onEdit={() => openEdit(t)}
                        onAction={(action) => setConfirmAction({ tenant: t, action })}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm text-muted-foreground">
                  <span className="text-xs">{((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                      className="rounded px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-40">← Prev</button>
                    <span className="px-2 text-xs">{page} / {totalPages}</span>
                    <button type="button" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
                      className="rounded px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-40">Next →</button>
                  </div>
                </div>
              )}
            </>
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: any; control: any; setValue: any;
  errors: Record<string, { message?: string } | undefined>;
  slug: string; contactEmail: string; currentSubdomain: string; currentAdminEmail: string;
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
        <FormField label="Contact phone" error={errors.contactPhone?.message} hint="Valid Kenyan mobile, e.g. +254712345678">
          <Input type="tel" placeholder="+254712345678" invalid={!!errors.contactPhone} {...register('contactPhone')} />
        </FormField>
      </div>
    </section>
  );
}

// ─── Table row ────────────────────────────────────────────────────────────────

function TenantRow({ tenant: t, canManage, onView, onEdit, onAction }: {
  tenant: Tenant;
  canManage: boolean;
  onView: () => void;
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
              <DropdownMenuItem onSelect={onView} className="gap-2">
                <Eye className="h-4 w-4" /> View
              </DropdownMenuItem>
              {t.status !== 'deleted' && (
                <DropdownMenuItem onSelect={onEdit} className="gap-2">
                  <Pencil className="h-4 w-4" /> Edit
                </DropdownMenuItem>
              )}
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
