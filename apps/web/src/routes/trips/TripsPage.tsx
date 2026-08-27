import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { Radio, Plus, Search, Play, Square, X as XIcon, Eye } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/ui/data-table';
import { ActionMenu } from '@/components/ui/action-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FormModal } from '@/components/ui/form-modal';
import { FormField } from '@/components/ui/form-field';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';

import { usePermission } from '@/hooks/usePermission';
import { useDebounce } from '@/hooks/useDebounce';
import { useTenantFilter, TenantBadge, TenantFilterSelect } from '@/hooks/useTenantFilter';
import { listTrips, createTrip, startTrip, endTrip, cancelTrip, type Trip } from '@/lib/api/trips';

const PAGE_SIZE = 15;

const STATUS_OPTS = [{ value: 'scheduled', label: 'Scheduled' }, { value: 'in_progress', label: 'In progress' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }];

function TripStatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = { scheduled: 'bg-blue-500/10 text-blue-700', in_progress: 'bg-green-500/10 text-green-700', completed: 'bg-zinc-500/10 text-zinc-500', cancelled: 'bg-red-500/10 text-red-600' };
  const label = status === 'in_progress' ? 'In progress' : status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cls[status] ?? ''}`}>{label}</span>;
}

const schema = z.object({
  routeId: z.string().uuid('Select a route'), vehicleId: z.string().uuid('Select a vehicle'), driverUserId: z.string().uuid('Enter driver user ID'),
  direction: z.enum(['morning_pickup', 'evening_dropoff'] as const), scheduledStart: z.string().min(1, 'Set a scheduled time'),
});
type Form = z.infer<typeof schema>;

export function TripsPage() {
  const canDispatch = usePermission('trips.dispatch');
  const { isSuperAdmin, tenants } = useTenantFilter();
  const qc = useQueryClient();
  const [search, setSearch] = useState(''); const [statusFilter, setStatusFilter] = useState(''); const [tenantFilter, setTenantFilter] = useState(''); const [page, setPage] = useState(1);
  const [dispatchOpen, setDispatchOpen] = useState(false); const [actionTarget, setActionTarget] = useState<{ trip: Trip; action: 'start' | 'end' | 'cancel' } | null>(null); const [viewTarget, setViewTarget] = useState<Trip | null>(null);
  const dSearch = useDebounce(search, 300);

  const query = useQuery({ queryKey: ['trips', dSearch, statusFilter, tenantFilter, page], queryFn: () => listTrips({ q: dSearch || undefined, status: statusFilter || undefined, tenantId: tenantFilter || undefined, page, pageSize: PAGE_SIZE }), placeholderData: (prev) => prev, refetchInterval: 15_000 });
  const trips = query.data?.data ?? []; const total = query.data?.meta.total ?? 0;
  const form = useForm<Form>({ resolver: zodResolver(schema), mode: 'onChange' });

  const createMutation = useMutation({
    mutationFn: (v: Form) => createTrip({ ...v }),
    onSuccess: () => { toast.success('Trip dispatched.'); setDispatchOpen(false); form.reset(); qc.invalidateQueries({ queryKey: ['trips'] }); qc.invalidateQueries({ queryKey: ['dashboard-stats'] }); },
    onError: () => toast.error('Could not dispatch trip.'),
  });
  const actionMutation = useMutation({
    mutationFn: ({ trip, action }: { trip: Trip; action: 'start' | 'end' | 'cancel' }) => action === 'start' ? startTrip(trip.id) : action === 'end' ? endTrip(trip.id) : cancelTrip(trip.id),
    onSuccess: (_, { action }) => { const labels = { start: 'Trip started.', end: 'Trip completed.', cancel: 'Trip cancelled.' }; toast.success(labels[action]); setActionTarget(null); qc.invalidateQueries({ queryKey: ['trips'] }); qc.invalidateQueries({ queryKey: ['dashboard-stats'] }); },
    onError: () => toast.error('Could not update trip status.'),
  });

  const columns: Column<Trip>[] = [
    { key: 'trip', header: 'Trip', width: 'w-full', exportValue: (t) => t.route?.name ?? t.routeId, render: (t) => (<div><p className="font-medium">{t.route?.name ?? t.routeId}</p><p className="text-xs text-muted-foreground capitalize">{t.direction.replace('_', ' ')}</p></div>) },
    { key: 'vehicle', header: 'Vehicle', exportValue: (t) => t.vehicle?.registration ?? '', render: (t) => <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">{t.vehicle?.registration ?? '—'}</span> },
    { key: 'status', header: 'Status', exportValue: (t) => t.status, render: (t) => <TripStatusBadge status={t.status} /> },
    { key: 'scheduled', header: 'Scheduled', exportValue: (t) => format(new Date(t.scheduledStart), 'd MMM yyyy HH:mm'), render: (t) => <span className="whitespace-nowrap text-xs text-muted-foreground">{format(new Date(t.scheduledStart), 'd MMM, HH:mm')}</span> },
    { key: 'started', header: 'Started', render: (t) => <span className="whitespace-nowrap text-xs text-muted-foreground">{t.startedAt ? formatDistanceToNow(new Date(t.startedAt), { addSuffix: true }) : '—'}</span> },
    ...(isSuperAdmin ? [{ key: 'tenant', header: 'Tenant', render: (t: Trip) => <TenantBadge tenant={t.tenant} /> }] : []),
    { key: 'actions', header: '', align: 'right' as const, width: 'w-10', render: (t) => (<ActionMenu items={[
      { label: 'View', icon: <Eye className="h-4 w-4" />, permission: 'trips.view', onClick: () => setViewTarget(t) },
      ...(t.status === 'scheduled' ? [{ label: 'Start trip', icon: <Play className="h-4 w-4" />, permission: 'trips.dispatch', onClick: () => setActionTarget({ trip: t, action: 'start' }) }] : []),
      ...(t.status === 'in_progress' ? [{ label: 'End trip', icon: <Square className="h-4 w-4" />, permission: 'trips.dispatch', onClick: () => setActionTarget({ trip: t, action: 'end' }) }] : []),
      ...(t.status !== 'completed' && t.status !== 'cancelled' ? [{ label: 'Cancel', icon: <XIcon className="h-4 w-4" />, permission: 'trips.dispatch', onClick: () => setActionTarget({ trip: t, action: 'cancel' }), variant: 'destructive' as const }] : []),
    ]} />) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Trips" description="Dispatch and track school bus trips. Auto-refreshes every 15 seconds." actions={canDispatch ? <Button onClick={() => setDispatchOpen(true)} size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700"><Plus className="h-4 w-4" />Dispatch trip</Button> : undefined} />

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

        filters={<><SearchableSelect options={[{ value: '', label: 'All statuses' }, ...STATUS_OPTS]} value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} placeholder="Status" className="h-9 min-w-[130px]" />{isSuperAdmin && <TenantFilterSelect tenants={tenants} value={tenantFilter} onChange={(v) => { setTenantFilter(v); setPage(1); }} />}</>}

        filtersActive={statusFilter !== "" || tenantFilter !== ""}
        exportFilename="trips"

        selectable
        page={page} pageSize={PAGE_SIZE} total={total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)}
        columns={columns} rows={trips} rowKey={(t) => t.id} loading={query.isLoading} skeletonRows={PAGE_SIZE}
        empty={<EmptyState icon={<Radio className="h-6 w-6" />} title="No trips found" description={canDispatch ? 'Dispatch the first trip above.' : undefined} />}
      />
      )}

      <FormModal open={dispatchOpen} onClose={() => { setDispatchOpen(false); form.reset(); }} title="Dispatch trip" subtitle="Schedule a new trip for today or a future date." size="md" onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} submitLabel="Dispatch trip" submitting={createMutation.isPending}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Route ID" required error={form.formState.errors.routeId?.message} hint="UUID from the Routes module"><Input placeholder="UUID" {...form.register('routeId')} /></FormField>
          <FormField label="Vehicle ID" required error={form.formState.errors.vehicleId?.message} hint="UUID from the Fleet module"><Input placeholder="UUID" {...form.register('vehicleId')} /></FormField>
          <FormField label="Driver user ID" required error={form.formState.errors.driverUserId?.message} hint="UUID from the Users module"><Input placeholder="UUID" {...form.register('driverUserId')} /></FormField>
          <FormField label="Direction" required error={form.formState.errors.direction?.message}><SearchableSelect options={[{ value: 'morning_pickup', label: 'Morning pickup' }, { value: 'evening_dropoff', label: 'Evening drop-off' }]} value={form.watch('direction') ?? ''} onChange={(v) => form.setValue('direction', v as 'morning_pickup' | 'evening_dropoff')} placeholder="Select direction" /></FormField>
          <FormField label="Scheduled start" required error={form.formState.errors.scheduledStart?.message} className="sm:col-span-2"><Input type="datetime-local" {...form.register('scheduledStart')} /></FormField>
        </div>
      </FormModal>

      {actionTarget && <ConfirmDialog open onOpenChange={(o) => { if (!o) setActionTarget(null); }} title={actionTarget.action === 'start' ? 'Start trip?' : actionTarget.action === 'end' ? 'End trip?' : 'Cancel trip?'} description={actionTarget.action === 'start' ? `Mark "${actionTarget.trip.route?.name}" as in progress.` : actionTarget.action === 'end' ? `Mark "${actionTarget.trip.route?.name}" as completed.` : `Cancel "${actionTarget.trip.route?.name}". This cannot be undone.`} confirmLabel={actionTarget.action === 'start' ? 'Start' : actionTarget.action === 'end' ? 'End trip' : 'Cancel trip'} destructive={actionTarget.action === 'cancel'} onConfirm={() => actionMutation.mutate(actionTarget)} pending={actionMutation.isPending} />}
      {viewTarget && <TripDetailDialog trip={viewTarget} onClose={() => setViewTarget(null)} />}
    </div>
  );
}

function TripDetailDialog({ trip: t, onClose }: { trip: Trip; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent hideCloseButton className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t.route?.name ?? t.routeId}</DialogTitle>
          {t.tenant && <p className="text-sm text-muted-foreground">{t.tenant.name}</p>}
        </DialogHeader>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {([
            ['Vehicle', t.vehicle ? `${t.vehicle.registration} — ${t.vehicle.make} ${t.vehicle.model}` : '—'],
            ['Direction', t.direction.replace('_', ' ')],
            ['Status', t.status.replace('_', ' ')],
            ['Scheduled', format(new Date(t.scheduledStart), 'd MMM yyyy, HH:mm')],
            ['Started', t.startedAt ? format(new Date(t.startedAt), 'd MMM yyyy, HH:mm') : '—'],
            ['Ended', t.endedAt ? format(new Date(t.endedAt), 'd MMM yyyy, HH:mm') : '—'],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-medium capitalize">{value}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
