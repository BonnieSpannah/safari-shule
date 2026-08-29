import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { Radio, Plus, Search, Play, Square, X as XIcon, Eye, Pencil } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/ui/data-table';
import { ActionMenu } from '@/components/ui/action-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FormModal } from '@/components/ui/form-modal';
import { FormField } from '@/components/ui/form-field';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { TenantSelectorField } from '@/components/ui/tenant-selector-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FilterDropdown } from '@/components/ui/filter-dropdown';
import { SearchableSelect } from '@/components/ui/searchable-select';

import { useAnyPermission } from '@/hooks/usePermission';
import { useDebounce } from '@/hooks/useDebounce';
import { useTenantFilter, TenantBadge } from '@/hooks/useTenantFilter';
import { listTrips, createTrip, startTrip, endTrip, cancelTrip, type Trip } from '@/lib/api/trips';
import { listRoutes } from '@/lib/api/routes';
import { listVehicles } from '@/lib/api/fleet';
import { listUsers } from '@/lib/api/users';

const PAGE_SIZE = 15;

const STATUS_OPTS = [{ value: 'scheduled', label: 'Scheduled' }, { value: 'in_progress', label: 'In progress' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }];

function TripStatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = { scheduled: 'bg-blue-500/10 text-blue-700', in_progress: 'bg-green-500/10 text-green-700', completed: 'bg-zinc-500/10 text-zinc-500', cancelled: 'bg-red-500/10 text-red-600' };
  const label = status === 'in_progress' ? 'In progress' : status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cls[status] ?? ''}`}>{label}</span>;
}

const schema = z.object({
  routeId: z.string().uuid('Select a route'),
  vehicleId: z.string().uuid('Select a vehicle'),
  driverUserId: z.string().uuid('Select a driver'),
  assistantUserId: z.string().uuid().optional().or(z.literal('')),
  direction: z.enum(['morning_pickup', 'evening_dropoff'] as const),
  scheduledStart: z.string().min(1, 'Set a scheduled time'),
});
type Form = z.infer<typeof schema>;

export function TripsPage() {
  const navigate = useNavigate();
  const canDispatch = useAnyPermission('trips.dispatch', 'tenants.manage');
  const { isSuperAdmin, tenants } = useTenantFilter();
  const qc = useQueryClient();
  const [search, setSearch] = useState(''); const [statusFilter, setStatusFilter] = useState(''); const [tenantFilter, setTenantFilter] = useState(''); const [page, setPage] = useState(1);
  const [dispatchOpen, setDispatchOpen] = useState(false); const [dispatchTenantId, setDispatchTenantId] = useState(''); const [actionTarget, setActionTarget] = useState<{ trip: Trip; action: 'start' | 'end' | 'cancel' } | null>(null);
  const [recurring, setRecurring] = useState(false); const [recurDays, setRecurDays] = useState<number[]>([1,2,3,4,5]); const [recurFrom, setRecurFrom] = useState(''); const [recurTo, setRecurTo] = useState(''); const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const dSearch = useDebounce(search, 300);

  const query = useQuery({ queryKey: ['trips', dSearch, statusFilter, tenantFilter, page], queryFn: () => listTrips({ q: dSearch || undefined, status: statusFilter || undefined, tenantId: tenantFilter || undefined, page, pageSize: PAGE_SIZE }), placeholderData: (prev) => prev, refetchInterval: 15_000 });
  const trips = query.data?.data ?? []; const total = query.data?.meta.total ?? 0;
  const form = useForm<Form>({ resolver: zodResolver(schema), mode: 'onChange' });

  // Dispatch form — load routes, vehicles, and users scoped to the selected tenant.
  // Super admin: only load after a tenant is chosen (platform has no routes/vehicles).
  const scopedTenantId = dispatchTenantId || undefined;
  const canLoadDispatchData = dispatchOpen && (!isSuperAdmin || !!dispatchTenantId);
  const routesQuery = useQuery({ queryKey: ['dispatch-routes', scopedTenantId], queryFn: () => listRoutes({ isActive: 'true', tenantId: scopedTenantId, pageSize: 100 }), enabled: canLoadDispatchData });
  const vehiclesQuery = useQuery({ queryKey: ['dispatch-vehicles', scopedTenantId], queryFn: () => listVehicles({ status: 'active', tenantId: scopedTenantId, pageSize: 100 }), enabled: canLoadDispatchData });
  const driversQuery = useQuery({ queryKey: ['dispatch-drivers', scopedTenantId], queryFn: () => listUsers({ status: 'active', roleKey: 'driver', tenantId: scopedTenantId, pageSize: 100 }), enabled: canLoadDispatchData });
  const assistantsQuery = useQuery({ queryKey: ['dispatch-assistants', scopedTenantId], queryFn: () => listUsers({ status: 'active', roleKey: 'assistant', tenantId: scopedTenantId, pageSize: 100 }), enabled: canLoadDispatchData });

  const routeOptions = (routesQuery.data?.data ?? []).map((r) => ({ value: r.id, label: r.name }));
  const vehicleOptions = (vehiclesQuery.data?.data ?? []).map((v) => ({ value: v.id, label: `${v.registration} — ${v.make} ${v.model} (${v.capacity} seats)` }));
  const driverOptions = (driversQuery.data?.data ?? []).map((u) => ({ value: u.id, label: u.fullName ?? u.email }));
  const assistantOptions = [{ value: '', label: 'None' }, ...(assistantsQuery.data?.data ?? driversQuery.data?.data ?? []).map((u) => ({ value: u.id, label: u.fullName ?? u.email }))];

  // Pre-fill scheduled start with the next full hour
  const openDispatch = () => {
    const next = new Date(); next.setHours(next.getHours() + 1, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    const today = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
    const scheduledStart = `${today}T${pad(next.getHours())}:00`;
    form.reset({ direction: 'morning_pickup', scheduledStart });
    setDispatchTenantId(''); setRecurring(false);
    setRecurDays([1,2,3,4,5]); setRecurFrom(today); setRecurTo(today);
    setDispatchOpen(true);
  };

  // Generate all dates in [from, to] matching the selected days-of-week
  const buildRecurDates = (timeStr: string) => {
    const dates: string[] = [];
    const cur = new Date(recurFrom + 'T12:00:00');
    const end = new Date(recurTo + 'T12:00:00');
    while (cur <= end) {
      if (recurDays.includes(cur.getDay())) {
        const pad = (n: number) => String(n).padStart(2, '0');
        const d = `${cur.getFullYear()}-${pad(cur.getMonth()+1)}-${pad(cur.getDate())}`;
        dates.push(`${d}T${timeStr.slice(11, 16)}`);
      }
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  };

  const createMutation = useMutation<{ count?: number }, Error, Form>({
    mutationFn: async (v: Form) => {
      const base = { routeId: v.routeId, vehicleId: v.vehicleId, driverUserId: v.driverUserId, assistantUserId: v.assistantUserId || null, direction: v.direction, targetTenantId: dispatchTenantId || undefined };
      if (!recurring) { await createTrip({ ...base, scheduledStart: v.scheduledStart }); return {}; }
      const dates = buildRecurDates(v.scheduledStart);
      if (dates.length === 0) throw new Error('No dates match the selected days in that range.');
      setBatchProgress({ done: 0, total: dates.length });
      for (let i = 0; i < dates.length; i++) {
        await createTrip({ ...base, scheduledStart: dates[i]! });
        setBatchProgress({ done: i + 1, total: dates.length });
      }
      return { count: dates.length };
    },
    onSuccess: (result: { count?: number }) => {
      const count = result?.count ?? 1;
      toast.success(count > 1 ? `${count} recurring trips dispatched.` : 'Trip dispatched.');
      setDispatchOpen(false); form.reset(); setBatchProgress(null);
      qc.invalidateQueries({ queryKey: ['trips'] }); qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: (e: Error) => { setBatchProgress(null); toast.error(e?.message ?? 'Could not dispatch trip.'); },
  });
  const actionMutation = useMutation({
    mutationFn: ({ trip, action }: { trip: Trip; action: 'start' | 'end' | 'cancel' }) => action === 'start' ? startTrip(trip.id) : action === 'end' ? endTrip(trip.id) : cancelTrip(trip.id),
    onSuccess: (_, { action }) => { const labels = { start: 'Trip started.', end: 'Trip completed.', cancel: 'Trip cancelled.' }; toast.success(labels[action]); setActionTarget(null); qc.invalidateQueries({ queryKey: ['trips'] }); qc.invalidateQueries({ queryKey: ['dashboard-stats'] }); },
    onError: () => toast.error('Could not update trip status.'),
  });

  const columns: Column<Trip>[] = [
    { key: 'trip', header: 'Trip', width: 'w-full', sortable: true, exportValue: (t) => t.route?.name ?? t.routeId, render: (t) => (<div><p className="font-medium">{t.route?.name ?? t.routeId}</p><p className="text-xs text-muted-foreground capitalize">{t.direction.replace('_', ' ')}</p></div>) },
    { key: 'vehicle', header: 'Vehicle', exportValue: (t) => t.vehicle?.registration ?? '', render: (t) => <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">{t.vehicle?.registration ?? '—'}</span> },
    { key: 'status', header: 'Status', sortable: true, exportValue: (t) => t.status, render: (t) => <TripStatusBadge status={t.status} /> },
    { key: 'scheduled', header: 'Scheduled', sortable: true, exportValue: (t) => format(new Date(t.scheduledStart), 'd MMM yyyy HH:mm'), render: (t) => <span className="whitespace-nowrap text-xs text-muted-foreground">{format(new Date(t.scheduledStart), 'd MMM, HH:mm')}</span> },
    { key: 'started', header: 'Started', render: (t) => <span className="whitespace-nowrap text-xs text-muted-foreground">{t.startedAt ? formatDistanceToNow(new Date(t.startedAt), { addSuffix: true }) : '—'}</span> },
    ...(isSuperAdmin ? [{ key: 'tenant', header: 'Tenant', render: (t: Trip) => <TenantBadge tenant={t.tenant} /> }] : []),
      { key: 'actions', header: '', align: 'right' as const, width: 'w-10', render: (t) => (<ActionMenu items={[
      { label: 'View', icon: <Eye className="h-4 w-4" />, onClick: () => navigate(`/trips/${t.id}`) },
      ...(canDispatch && t.status === 'scheduled'
        ? [{ label: 'Edit', icon: <Pencil className="h-4 w-4" />, onClick: () => navigate(`/trips/${t.id}`) }]
        : []),
      ...(canDispatch && t.status === 'in_progress'
        ? [{ label: 'Reassign', icon: <Pencil className="h-4 w-4" />, onClick: () => navigate(`/trips/${t.id}`) }]
        : []),
      ...(t.status === 'scheduled' ? [{ label: 'Start trip', icon: <Play className="h-4 w-4" />, permission: 'trips.dispatch', onClick: () => setActionTarget({ trip: t, action: 'start' }) }] : []),
      ...(t.status === 'in_progress' ? [{ label: 'End trip', icon: <Square className="h-4 w-4" />, permission: 'trips.dispatch', onClick: () => setActionTarget({ trip: t, action: 'end' }) }] : []),
      ...(t.status !== 'completed' && t.status !== 'cancelled' ? [{ label: 'Cancel', icon: <XIcon className="h-4 w-4" />, permission: 'trips.dispatch', onClick: () => setActionTarget({ trip: t, action: 'cancel' }), variant: 'destructive' as const }] : []),
    ]} />) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Trips" description="Dispatch and track school bus trips. Auto-refreshes every 15 seconds." actions={canDispatch ? <Button onClick={openDispatch} size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700"><Plus className="h-4 w-4" />Dispatch trip</Button> : undefined} />

      {query.error && (
        <ErrorState
          title="Failed to load trips"
          error={query.error}
          onRetry={() => query.refetch()}
        />
      )}

      {!query.error && (
        <DataTable
        title="All trips"
        description={total > 0 ? `${total} trip${total !== 1 ? 's' : ''}` : undefined}
        search={<div className="relative w-full"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input placeholder="Search by route…" className="pl-8 h-9 text-sm" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>}

        filters={<div className="flex flex-wrap items-center gap-2"><FilterDropdown label="Status" options={STATUS_OPTS} selected={statusFilter ? [statusFilter] : []} onChange={(v) => { setStatusFilter(v[v.length-1] ?? ''); setPage(1); }} />{isSuperAdmin && <FilterDropdown label="Tenant" options={tenants.map((t) => ({ value: t.id, label: t.name }))} selected={tenantFilter ? [tenantFilter] : []} onChange={(v) => { setTenantFilter(v[v.length-1] ?? ''); setPage(1); }} />}{(statusFilter || tenantFilter) && <button type="button" onClick={() => { setStatusFilter(''); setTenantFilter(''); setPage(1); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><XIcon className="h-3 w-3" />Clear</button>}</div>}

        filtersActive={statusFilter !== "" || tenantFilter !== ""}
        exportFilename="trips"

        selectable
        page={page} pageSize={PAGE_SIZE} total={total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)}
        columns={columns} rows={trips} rowKey={(t) => t.id} loading={query.isLoading} skeletonRows={PAGE_SIZE}
        empty={<EmptyState icon={<Radio className="h-6 w-6" />} title="No trips found" description={canDispatch ? 'Dispatch the first trip above.' : undefined} />}
      />
      )}

      <FormModal open={dispatchOpen} onClose={() => { setDispatchOpen(false); form.reset(); setDispatchTenantId(''); }} title="Dispatch trip" subtitle="Schedule a new trip for today or a future date." size="lg" onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} submitLabel="Dispatch trip" submitting={createMutation.isPending}>
        <div className="grid gap-4 sm:grid-cols-2">
          {isSuperAdmin && (
            <div className="sm:col-span-2">
              <TenantSelectorField
                value={dispatchTenantId}
                onChange={(v) => { setDispatchTenantId(v); form.setValue('routeId', ''); form.setValue('vehicleId', ''); form.setValue('driverUserId', ''); form.setValue('assistantUserId', ''); }}
                hint="Select a school first — routes, vehicles, drivers and assistants are scoped to the chosen school"
              />
            </div>
          )}

          {isSuperAdmin && !dispatchTenantId ? (
            <div className="sm:col-span-2 flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-8 text-sm text-muted-foreground">
              Select a school above to load its routes, vehicles, drivers and assistants.
            </div>
          ) : (
            <>
              <FormField label="Route" required error={form.formState.errors.routeId?.message}
                hint={!routesQuery.isLoading && routeOptions.length === 0 ? undefined : undefined}>
                <SearchableSelect options={routeOptions} value={form.watch('routeId') ?? ''} onChange={(v) => form.setValue('routeId', v, { shouldValidate: true })} placeholder={routesQuery.isLoading ? 'Loading…' : routeOptions.length === 0 ? 'No active routes' : 'Select route'} />
                {!routesQuery.isLoading && routeOptions.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">No active routes yet. <Link to="/routes" className="text-primary underline" onClick={() => setDispatchOpen(false)}>Create one in Routes →</Link></p>
                )}
              </FormField>
              <FormField label="Direction" required error={form.formState.errors.direction?.message}>
                <SearchableSelect options={[{ value: 'morning_pickup', label: 'Morning pickup' }, { value: 'evening_dropoff', label: 'Evening drop-off' }]} value={form.watch('direction') ?? ''} onChange={(v) => form.setValue('direction', v as 'morning_pickup' | 'evening_dropoff', { shouldValidate: true })} placeholder="Select direction" />
              </FormField>
              <FormField label="Vehicle" required error={form.formState.errors.vehicleId?.message} className="sm:col-span-2">
                <SearchableSelect options={vehicleOptions} value={form.watch('vehicleId') ?? ''} onChange={(v) => form.setValue('vehicleId', v, { shouldValidate: true })} placeholder={vehiclesQuery.isLoading ? 'Loading…' : vehicleOptions.length === 0 ? 'No active vehicles' : 'Select vehicle'} />
                {!vehiclesQuery.isLoading && vehicleOptions.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">No active vehicles. <Link to="/fleet" className="text-primary underline" onClick={() => setDispatchOpen(false)}>Register one in Fleet →</Link></p>
                )}
              </FormField>
              <FormField label="Driver" required error={form.formState.errors.driverUserId?.message}>
                <SearchableSelect options={driverOptions} value={form.watch('driverUserId') ?? ''} onChange={(v) => form.setValue('driverUserId', v, { shouldValidate: true })} placeholder={driversQuery.isLoading ? 'Loading…' : driverOptions.length === 0 ? 'No drivers found' : 'Select driver'} />
                {!driversQuery.isLoading && driverOptions.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">No drivers found. <Link to="/settings" className="text-primary underline" onClick={() => setDispatchOpen(false)}>Invite a user with the Driver role →</Link></p>
                )}
              </FormField>
              <FormField label="Assistant" error={form.formState.errors.assistantUserId?.message}>
                <SearchableSelect options={assistantOptions} value={form.watch('assistantUserId') ?? ''} onChange={(v) => form.setValue('assistantUserId', v, { shouldValidate: true })} placeholder="None (optional)" />
              </FormField>
              <FormField label="Scheduled start" required error={form.formState.errors.scheduledStart?.message} className="sm:col-span-2">
                <Input type="datetime-local" {...form.register('scheduledStart')} />
              </FormField>

              {/* Recurring section */}
              <div className="sm:col-span-2 space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none font-medium">
                  <input type="checkbox" className="accent-primary" checked={recurring} onChange={e => setRecurring(e.target.checked)} />
                  Recurring — create this trip on multiple days
                </label>
                {recurring && (
                  <>
                    <p className="text-xs text-muted-foreground">Uses the same time from Scheduled start. Select days and the date range.</p>
                    <div className="flex flex-wrap gap-1">
                      {[['M',1],['T',2],['W',3],['Th',4],['F',5],['Sa',6],['Su',0]].map(([label, day]) => (
                        <button key={day} type="button"
                          className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${recurDays.includes(Number(day)) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}
                          onClick={() => setRecurDays(prev => prev.includes(Number(day)) ? prev.filter(d => d !== Number(day)) : [...prev, Number(day)])}>
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <FormField label="From date" required><Input type="date" value={recurFrom} onChange={e => setRecurFrom(e.target.value)} /></FormField>
                      <FormField label="To date" required><Input type="date" value={recurTo} min={recurFrom} onChange={e => setRecurTo(e.target.value)} /></FormField>
                    </div>
                    {recurFrom && recurTo && recurDays.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        ~{buildRecurDates(form.watch('scheduledStart') || '2000-01-01T00:00').length} trips will be created
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Batch progress */}
              {batchProgress && (
                <div className="sm:col-span-2 rounded-md bg-primary/10 px-3 py-2 text-sm">
                  Creating trip {batchProgress.done} of {batchProgress.total}…
                </div>
              )}
            </>
          )}
        </div>
      </FormModal>

      {actionTarget && <ConfirmDialog open onOpenChange={(o) => { if (!o) setActionTarget(null); }} title={actionTarget.action === 'start' ? 'Start trip?' : actionTarget.action === 'end' ? 'End trip?' : 'Cancel trip?'} description={actionTarget.action === 'start' ? `Mark "${actionTarget.trip.route?.name}" as in progress.` : actionTarget.action === 'end' ? `Mark "${actionTarget.trip.route?.name}" as completed.` : `Cancel "${actionTarget.trip.route?.name}". This cannot be undone.`} confirmLabel={actionTarget.action === 'start' ? 'Start' : actionTarget.action === 'end' ? 'End trip' : 'Cancel trip'} destructive={actionTarget.action === 'cancel'} onConfirm={() => actionMutation.mutate(actionTarget)} pending={actionMutation.isPending} />}
    </div>
  );
}
