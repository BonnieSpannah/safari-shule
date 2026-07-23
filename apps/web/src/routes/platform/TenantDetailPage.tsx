import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, formatDistanceToNow, differenceInYears } from 'date-fns';
import {
  ArrowLeft, Pencil, Users, Truck, GraduationCap, Route, UserCog,
  X, ChevronRight, Loader2, Mail, Phone, Calendar, BadgeCheck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  getTenantDetail, updateTenant,
  type TenantDetail, type TenantUser, type TenantStudent, type TenantStaff,
  type TenantVehicle, type TenantRoute, type PlanTier, type UpdateTenantInput,
} from '@/lib/api/tenants';

const optionalPhone = z
  .string().trim()
  .regex(/^\+254[17]\d{8}$/, 'Must be a valid Kenyan mobile number, e.g. +254712345678')
  .or(z.literal('')).transform((v) => (v === '' ? undefined : v));
const SLUG_PATTERN = /^[a-z][a-z0-9-]{1,40}$/;

const editSchema = z.object({
  slug: z.string().min(2).max(41).regex(SLUG_PATTERN),
  subdomain: z.string().min(2).max(41).regex(SLUG_PATTERN),
  name: z.string().min(2, 'Enter a school name'),
  contactEmail: z.string().email('Enter a valid email'),
  contactPhone: optionalPhone,
  planTier: z.enum(['basic', 'pro', 'enterprise'] as const),
});
type EditForm = z.infer<typeof editSchema>;

const PLAN_OPTIONS = [
  { value: 'basic', label: 'Basic' },
  { value: 'pro', label: 'Pro (recommended)' },
  { value: 'enterprise', label: 'Enterprise' },
];

export function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const query = useQuery({
    queryKey: ['tenant', id],
    queryFn: () => getTenantDetail(id!),
    enabled: !!id,
  });

  const form = useForm<EditForm>({ resolver: zodResolver(editSchema), mode: 'onChange' });
  const { register, handleSubmit, control, formState: { errors } } = form;

  const updateMutation = useMutation({
    mutationFn: (input: UpdateTenantInput) => updateTenant(id!, input),
    onSuccess: async () => {
      toast.success('Tenant updated.');
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: ['tenant', id] });
      await queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
    onError: () => toast.error('Could not update tenant.'),
  });

  const openEdit = () => {
    if (!query.data) return;
    const t = query.data;
    form.reset({ slug: t.slug, subdomain: t.subdomain, name: t.name, contactEmail: t.contactEmail, contactPhone: t.contactPhone ?? '', planTier: t.planTier });
    setEditing(true);
  };

  const onSubmit = handleSubmit((values) => {
    updateMutation.mutate({ name: values.name, contactEmail: values.contactEmail, contactPhone: values.contactPhone ?? null, planTier: values.planTier as PlanTier });
  });

  if (query.isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (query.isError || !query.data) {
    return (
      <div className="rounded-md border border-danger/30 bg-danger/5 p-6 text-sm text-danger">
        Failed to load tenant. <button className="underline" onClick={() => navigate(-1)}>Go back</button>
      </div>
    );
  }

  const t: TenantDetail = query.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.name}
        description={<span className="flex items-center gap-2"><StatusBadge status={t.status} /><span className="font-mono text-xs text-muted-foreground">{t.slug}</span></span>}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(-1)} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Back</Button>
            <Button onClick={openEdit} className="gap-1.5 bg-green-600 hover:bg-green-700"><Pencil className="h-4 w-4" /> Edit details</Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard icon={<Users className="h-5 w-5" />} label="Users" value={t._count.users} color="blue" />
        <StatCard icon={<UserCog className="h-5 w-5" />} label="Staff" value={t._count.staff} color="violet" />
        <StatCard icon={<GraduationCap className="h-5 w-5" />} label="Students" value={t._count.students} color="emerald" />
        <StatCard icon={<Truck className="h-5 w-5" />} label="Vehicles" value={t._count.vehicles} color="amber" />
        <StatCard icon={<Route className="h-5 w-5" />} label="Routes" value={t._count.routes} color="rose" />
      </div>

      {/* Tabbed content */}
      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users <CountBadge n={t._count.users} /></TabsTrigger>
          <TabsTrigger value="staff">Staff <CountBadge n={t._count.staff} /></TabsTrigger>
          <TabsTrigger value="students">Students <CountBadge n={t._count.students} /></TabsTrigger>
          <TabsTrigger value="vehicles">Vehicles <CountBadge n={t._count.vehicles} /></TabsTrigger>
          <TabsTrigger value="routes">Routes <CountBadge n={t._count.routes} /></TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Tenant/School details</CardTitle></CardHeader>
              <CardContent>
                <dl className="divide-y divide-border/50 text-sm">
                  <DetailRow label="Name" value={t.name} />
                  <DetailRow label="Slug" value={t.slug} mono />
                  <DetailRow label="Subdomain" value={t.subdomain} mono />
                  <DetailRow label="Plan" value={<PlanBadge tier={t.planTier} />} />
                  <DetailRow label="Status" value={<StatusBadge status={t.status} />} />
                  <DetailRow label="Contact email" value={<a href={`mailto:${t.contactEmail}`} className="flex items-center gap-1 text-primary hover:underline"><Mail className="h-3.5 w-3.5" />{t.contactEmail}</a>} />
                  {t.contactPhone && <DetailRow label="Contact phone" value={<a href={`tel:${t.contactPhone}`} className="flex items-center gap-1 text-primary hover:underline"><Phone className="h-3.5 w-3.5" />{t.contactPhone}</a>} />}
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Timeline</CardTitle></CardHeader>
              <CardContent>
                <dl className="divide-y divide-border/50 text-sm">
                  <DetailRow label="Created" value={`${format(new Date(t.createdAt), 'd MMM yyyy')} · ${formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}`} />
                  <DetailRow label="Updated" value={`${format(new Date(t.updatedAt), 'd MMM yyyy')} · ${formatDistanceToNow(new Date(t.updatedAt), { addSuffix: true })}`} />
                  {t.activatedAt && <DetailRow label="Activated" value={`${format(new Date(t.activatedAt), 'd MMM yyyy')} · ${formatDistanceToNow(new Date(t.activatedAt), { addSuffix: true })}`} />}
                  {t.suspendedAt && <DetailRow label="Suspended" value={`${format(new Date(t.suspendedAt), 'd MMM yyyy')} · ${formatDistanceToNow(new Date(t.suspendedAt), { addSuffix: true })}`} />}
                  {t.cancelledAt && <DetailRow label="Deactivated" value={`${format(new Date(t.cancelledAt), 'd MMM yyyy')} · ${formatDistanceToNow(new Date(t.cancelledAt), { addSuffix: true })}`} />}
                  {t.deletedAt && <DetailRow label="Deleted" value={`${format(new Date(t.deletedAt), 'd MMM yyyy')} · ${formatDistanceToNow(new Date(t.deletedAt), { addSuffix: true })}`} />}
                  {t.restoredAt && <DetailRow label="Restored" value={`${format(new Date(t.restoredAt), 'd MMM yyyy')} · ${formatDistanceToNow(new Date(t.restoredAt), { addSuffix: true })}`} />}
                </dl>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Users ── */}
        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">System users
                <span className="ml-2 text-sm font-normal text-muted-foreground">({t._count.users} total · showing {t.users.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {t.users.length === 0
                ? <Empty label="No users yet" />
                : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                          <th className="py-2 pr-4 font-medium">Name</th>
                          <th className="py-2 pr-4 font-medium">Contact</th>
                          <th className="py-2 pr-4 font-medium">Status</th>
                          <th className="py-2 pr-4 font-medium">Last sign-in</th>
                          <th className="py-2 font-medium">Joined</th>
                        </tr>
                      </thead>
                      <tbody>
                        {t.users.map((u: TenantUser) => (
                          <tr key={u.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                            <td className="py-2.5 pr-4">
                              <div className="font-medium">{u.fullName || '—'}</div>
                              {u.userRoles.length > 0
                                ? <div className="flex flex-wrap gap-1">{u.userRoles.map(r => <RolePill key={r.role.key} name={r.role.label} />)}</div>
                                : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="py-2.5 pr-4">
                              <div className="text-muted-foreground">{u.email}</div>
                              {u.phoneE164 && <div className="text-xs text-muted-foreground">{u.phoneE164}</div>}
                            </td>
                            <td className="py-2.5 pr-4"><StatusBadge status={u.status} /></td>
                            <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                              {u.lastLoginAt ? formatDistanceToNow(new Date(u.lastLoginAt), { addSuffix: true }) : '—'}
                            </td>
                            <td className="py-2.5 text-xs text-muted-foreground">{format(new Date(u.createdAt), 'd MMM yyyy')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Staff ── */}
        <TabsContent value="staff" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Staff
                <span className="ml-2 text-sm font-normal text-muted-foreground">({t._count.staff} total · showing {t.staff.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {t.staff.length === 0
                ? <Empty label="No staff members added" />
                : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                          <th className="py-2 pr-4 font-medium">Name</th>
                          <th className="py-2 pr-4 font-medium">Employee #</th>
                          <th className="py-2 pr-4 font-medium">Position</th>
                          <th className="py-2 pr-4 font-medium">Contact</th>
                          <th className="py-2 pr-4 font-medium">Gender</th>
                          <th className="py-2 font-medium">Added</th>
                        </tr>
                      </thead>
                      <tbody>
                        {t.staff.map((s: TenantStaff) => (
                          <tr key={s.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                            <td className="py-2.5 pr-4 font-medium">{s.legalName}</td>
                            <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">{s.employeeNumber}</td>
                            <td className="py-2.5 pr-4 text-muted-foreground">{s.position}</td>
                            <td className="py-2.5 pr-4">
                              <div className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3.5 w-3.5" />{s.phoneE164}</div>
                              {s.email && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="h-3 w-3" />{s.email}</div>}
                            </td>
                            <td className="py-2.5 pr-4 capitalize text-muted-foreground">{s.gender}</td>
                            <td className="py-2.5 text-xs text-muted-foreground">{format(new Date(s.createdAt), 'd MMM yyyy')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Students ── */}
        <TabsContent value="students" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Students
                <span className="ml-2 text-sm font-normal text-muted-foreground">({t._count.students} total · showing {t.students.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {t.students.length === 0
                ? <Empty label="No students enrolled" />
                : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                          <th className="py-2 pr-4 font-medium">Student</th>
                          <th className="py-2 pr-4 font-medium">Admission #</th>
                          <th className="py-2 pr-4 font-medium">Class</th>
                          <th className="py-2 pr-4 font-medium">Age</th>
                          <th className="py-2 pr-4 font-medium">Gender</th>
                          <th className="py-2 pr-4 font-medium">Primary contact</th>
                          <th className="py-2 font-medium">Enrolled</th>
                        </tr>
                      </thead>
                      <tbody>
                        {t.students.map((s: TenantStudent) => {
                          const primary = s.parents.find(p => p.parent) ?? s.parents[0];
                          return (
                            <tr key={s.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                              <td className="py-2.5 pr-4 font-medium">{s.legalName}</td>
                              <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">{s.admissionNumber}</td>
                              <td className="py-2.5 pr-4 text-muted-foreground">{s.classroom ?? '—'}</td>
                              <td className="py-2.5 pr-4 text-muted-foreground">{differenceInYears(new Date(), new Date(s.dateOfBirth))} yrs</td>
                              <td className="py-2.5 pr-4 capitalize text-muted-foreground">{s.gender}</td>
                              <td className="py-2.5 pr-4">
                                {primary ? (
                                  <div>
                                    <div className="text-sm">{primary.parent.legalName}</div>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{primary.parent.phoneE164}</div>
                                  </div>
                                ) : <span className="text-muted-foreground">—</span>}
                              </td>
                              <td className="py-2.5 text-xs text-muted-foreground">{format(new Date(s.createdAt), 'd MMM yyyy')}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Vehicles ── */}
        <TabsContent value="vehicles" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vehicles
                <span className="ml-2 text-sm font-normal text-muted-foreground">({t._count.vehicles} total · showing {t.vehicles.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {t.vehicles.length === 0
                ? <Empty label="No vehicles added" />
                : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                          <th className="py-2 pr-4 font-medium">Vehicle</th>
                          <th className="py-2 pr-4 font-medium">Registration #</th>
                          <th className="py-2 pr-4 font-medium">Type</th>
                          <th className="py-2 pr-4 font-medium">Capacity</th>
                          <th className="py-2 font-medium">Added</th>
                        </tr>
                      </thead>
                      <tbody>
                        {t.vehicles.map((v: TenantVehicle) => (
                          <tr key={v.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                            <td className="py-2.5 pr-4 font-medium">{v.makeModel}</td>
                            <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">{v.registrationNumber}</td>
                            <td className="py-2.5 pr-4 capitalize text-muted-foreground">{v.type}</td>
                            <td className="py-2.5 pr-4 text-muted-foreground">{v.capacity}</td>
                            <td className="py-2.5 text-xs text-muted-foreground">{format(new Date(v.createdAt), 'd MMM yyyy')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Routes ── */}
        <TabsContent value="routes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Routes
                <span className="ml-2 text-sm font-normal text-muted-foreground">({t._count.routes} total · showing {t.routes.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {t.routes.length === 0
                ? <Empty label="No routes added" />
                : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                          <th className="py-2 pr-4 font-medium">Route</th>
                          <th className="py-2 pr-4 font-medium">Status</th>
                          <th className="py-2 pr-4 font-medium">Bus stops</th>
                          <th className="py-2 pr-4 font-medium">Students</th>
                          <th className="py-2 pr-4 font-medium">Assigned vehicle</th>
                          <th className="py-2 font-medium">Added</th>
                        </tr>
                      </thead>
                      <tbody>
                        {t.routes.map((r: TenantRoute) => {
                          const vehicle = r.assignments[0]?.vehicle;
                          return (
                            <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                              <td className="py-2.5 pr-4">
                                <div className="font-medium">{r.name}</div>
                                {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}
                              </td>
                              <td className="py-2.5 pr-4">
                                <StatusBadge status={r.isActive ? 'active' : 'inactive'} />
                              </td>
                              <td className="py-2.5 pr-4 text-muted-foreground">{r._count.busStops}</td>
                              <td className="py-2.5 pr-4 text-muted-foreground">{r._count.studentAssignments}</td>
                              <td className="py-2.5 pr-4 text-muted-foreground">
                                {vehicle
                                  ? <span>{vehicle.make} {vehicle.model} <span className="font-mono text-xs">({vehicle.registration})</span></span>
                                  : <span className="text-muted-foreground">—</span>}
                              </td>
                              <td className="py-2.5 text-xs text-muted-foreground">{format(new Date(r.createdAt), 'd MMM yyyy')}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <Dialog open={editing} onOpenChange={(open) => { if (!open) setEditing(false); }}>
        <DialogContent hideCloseButton className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit tenant — {t.name}</DialogTitle>
            <p className="text-sm text-muted-foreground">School / tenant details</p>
            <hr className="mt-1 border-border" />
          </DialogHeader>
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="School name" required error={errors.name?.message}>
                <Input placeholder="School name" invalid={!!errors.name} {...register('name')} />
              </FormField>
              <FormField label="Slug (login code)" hint="Cannot be changed after creation">
                <Input value={t.slug} readOnly disabled className="opacity-60" />
              </FormField>
              <FormField label="Subdomain" required error={errors.subdomain?.message}>
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
                <Input type="email" placeholder="contact@school.ac.ke" invalid={!!errors.contactEmail} {...register('contactEmail')} />
              </FormField>
              <FormField label="Contact phone" error={errors.contactPhone?.message} hint="Valid Kenyan mobile, e.g. +254712345678">
                <Input type="tel" placeholder="+254712345678" invalid={!!errors.contactPhone} {...register('contactPhone')} />
              </FormField>
            </div>
            <DialogFooter className="flex items-center justify-between border-t border-border pt-4 sm:justify-between">
              <Button type="button" variant="destructive" className="gap-1.5" onClick={() => setEditing(false)}>
                <X className="h-4 w-4" /> Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending} className="gap-1.5 bg-green-600 hover:bg-green-700 focus-visible:ring-green-600">
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save changes
                {!updateMutation.isPending && <ChevronRight className="h-4 w-4" />}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function CountBadge({ n }: { n: number }) {
  return <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{n}</span>;
}

function RolePill({ name }: { name: string }) {
  return <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">{name}</span>;
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const bg: Record<string, string> = { blue: 'bg-blue-500/10 text-blue-600', violet: 'bg-violet-500/10 text-violet-600', emerald: 'bg-emerald-500/10 text-emerald-600', amber: 'bg-amber-500/10 text-amber-600', rose: 'bg-rose-500/10 text-rose-600' };
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-lg p-2 ${bg[color] ?? 'bg-muted text-muted-foreground'}`}>{icon}</div>
        <div>
          <div className="text-xl font-bold leading-none">{value.toLocaleString()}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center gap-4 py-2.5">
      <span className="w-28 shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}

function FormField({ label, required, error, hint, children }: { label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}{required && <span className="ml-0.5 text-danger">*</span>}</Label>
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function PlanBadge({ tier }: { tier: PlanTier }) {
  const styles: Record<PlanTier, string> = { basic: 'bg-zinc-500/15 text-zinc-700 ring-zinc-400/30', pro: 'bg-blue-500/15 text-blue-700 ring-blue-400/30', enterprise: 'bg-violet-500/15 text-violet-700 ring-violet-400/30' };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset capitalize ${styles[tier]}`}>{tier}</span>;
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <BadgeCheck className="h-8 w-8 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}


