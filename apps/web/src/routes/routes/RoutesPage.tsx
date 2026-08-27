import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Route as RouteIcon, Plus, Search, Pencil, Power, MapPin, Eye } from 'lucide-react';

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
import { useClientEvents } from '@/hooks/useClientEvents';
import { useTenantFilter, TenantBadge, TenantFilterSelect } from '@/hooks/useTenantFilter';
import { listRoutes, createRoute, updateRoute, type Route } from '@/lib/api/routes';

const PAGE_SIZE = 15;

function ActiveBadge({ active }: { active: boolean }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${active ? 'bg-green-500/10 text-green-700' : 'bg-zinc-500/10 text-zinc-500'}`}>{active ? 'Active' : 'Inactive'}</span>;
}

function MapPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 py-8 mb-5">
      <MapPin className="h-6 w-6 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">Interactive map editor coming in the next milestone — route drawing, bus stop placement and geofence tools.</p>
    </div>
  );
}

const schema = z.object({
  name: z.string().min(1, 'Enter route name').max(80),
  description: z.string().max(500).optional().or(z.literal('')),
  isActive: z.boolean().default(true),
});
type Form = z.infer<typeof schema>;

export function RoutesPage() {
  const { emit } = useClientEvents();
  const canManage = usePermission('routes.manage');
  const { isSuperAdmin, tenants } = useTenantFilter();
  const qc = useQueryClient();

  useEffect(() => {
    emit('view', { entityType: 'route_list' });
  }, [emit]);
  const [search, setSearch] = useState(''); const [activeFilter, setActiveFilter] = useState(''); const [tenantFilter, setTenantFilter] = useState(''); const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false); const [editing, setEditing] = useState<Route | null>(null); const [toggleTarget, setToggleTarget] = useState<Route | null>(null); const [viewTarget, setViewTarget] = useState<Route | null>(null);
  const dSearch = useDebounce(search, 300);

  const query = useQuery({ queryKey: ['routes', dSearch, activeFilter, tenantFilter, page], queryFn: () => listRoutes({ q: dSearch || undefined, isActive: activeFilter || undefined, tenantId: tenantFilter || undefined, page, pageSize: PAGE_SIZE }), placeholderData: (prev) => prev });
  const routes = query.data?.data ?? []; const total = query.data?.meta.total ?? 0;
  const form = useForm<Form>({ resolver: zodResolver(schema), mode: 'onChange' });

  const openCreate = () => { setEditing(null); form.reset({ isActive: true }); setDialogOpen(true); };
  const openEdit = (r: Route) => { setEditing(r); form.reset({ name: r.name, description: r.description ?? '', isActive: r.isActive }); setDialogOpen(true); };

  const saveMutation = useMutation({
    mutationFn: (v: Form) => editing ? updateRoute(editing.id, { name: v.name, description: v.description || null, isActive: v.isActive }) : createRoute({ name: v.name, description: v.description || null, isActive: v.isActive, startPoint: { lat: 0, lng: 0 }, endPoint: { lat: 0, lng: 0 }, busStops: [{ name: 'TBD', location: { lat: 0, lng: 0 }, pickupOrder: 1, scheduledPickupTime: '07:00', scheduledDropoffTime: '16:00' }] }),
    onSuccess: () => { toast.success(editing ? 'Route updated.' : 'Route created. Use the map editor to add exact coordinates and stops.'); setDialogOpen(false); qc.invalidateQueries({ queryKey: ['routes'] }); },
    onError: () => toast.error('Could not save route.'),
  });
  const toggleMutation = useMutation({
    mutationFn: (r: Route) => updateRoute(r.id, { isActive: !r.isActive }),
    onSuccess: (_, r) => { toast.success(r.isActive ? 'Route deactivated.' : 'Route activated.'); setToggleTarget(null); qc.invalidateQueries({ queryKey: ['routes'] }); },
    onError: () => toast.error('Could not update route status.'),
  });

  const columns: Column<Route>[] = [
    { key: 'route', header: 'Route', width: 'w-full', exportValue: (r) => r.name, render: (r) => (<div><p className="font-medium">{r.name}</p>{r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}</div>) },
    { key: 'status', header: 'Status', exportValue: (r) => r.isActive ? 'Active' : 'Inactive', render: (r) => <ActiveBadge active={r.isActive} /> },
    { key: 'stops', header: 'Bus stops', exportValue: (r) => r._count?.busStops ?? 0, render: (r) => <span className="text-sm text-muted-foreground">{r._count?.busStops ?? '—'}</span> },
    { key: 'students', header: 'Students', exportValue: (r) => r._count?.studentAssignments ?? 0, render: (r) => <span className="text-sm text-muted-foreground">{r._count?.studentAssignments ?? '—'}</span> },
    { key: 'added', header: 'Added', exportValue: (r) => format(new Date(r.createdAt), 'd MMM yyyy'), render: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{format(new Date(r.createdAt), 'd MMM yyyy')}</span> },
    ...(isSuperAdmin ? [{ key: 'tenant', header: 'Tenant', render: (r: Route) => <TenantBadge tenant={r.tenant} /> }] : []),
    { key: 'actions', header: '', align: 'right' as const, width: 'w-10', render: (r) => (<ActionMenu items={[{ label: 'View', icon: <Eye className="h-4 w-4" />, permission: 'routes.view', onClick: () => setViewTarget(r) }, { label: 'Edit details', icon: <Pencil className="h-4 w-4" />, permission: 'routes.manage', onClick: () => openEdit(r) }, { label: r.isActive ? 'Deactivate' : 'Activate', icon: <Power className="h-4 w-4" />, permission: 'routes.manage', onClick: () => setToggleTarget(r), variant: r.isActive ? 'destructive' as const : 'default' as const }]} />) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Routes" description="School bus routes, bus stops and student assignments." actions={canManage ? <Button onClick={openCreate} size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700"><Plus className="h-4 w-4" />Add route</Button> : undefined} />
      <MapPlaceholder />

      {query.error && (
        <ErrorState
          title="Failed to load routes"
          error={query.error}
          onRetry={() => query.refetch()}
        />
      )}

      {!query.error && (
      <DataTable
        title="All routes"
        description={total > 0 ? `${total} route${total !== 1 ? 's' : ''}` : undefined}
        search={<div className="relative w-full"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input placeholder="Search routes…" className="pl-8 h-9 text-sm" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>}

        filters={<><SearchableSelect options={[{ value: '', label: 'All routes' }, { value: 'true', label: 'Active only' }, { value: 'false', label: 'Inactive only' }]} value={activeFilter} onChange={(v) => { setActiveFilter(v); setPage(1); }} placeholder="Status" className="h-9 min-w-[120px]" />{isSuperAdmin && <TenantFilterSelect tenants={tenants} value={tenantFilter} onChange={(v) => { setTenantFilter(v); setPage(1); }} />}</>}

        filtersActive={activeFilter !== "" || tenantFilter !== ""}
        exportFilename="routes"

        selectable
        page={page} pageSize={PAGE_SIZE} total={total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)}
        columns={columns} rows={routes} rowKey={(r) => r.id} loading={query.isLoading} skeletonRows={PAGE_SIZE}
        empty={<EmptyState icon={<RouteIcon className="h-6 w-6" />} title="No routes found" description={canManage ? 'Create the first route above.' : undefined} />}
      />
      )}

      <FormModal open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? `Edit route — ${editing.name}` : 'Add route'} subtitle="Route name and description. Bus stops and geo-coordinates are managed via the map editor." size="md" onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} submitLabel={editing ? 'Save changes' : 'Create route'} submitting={saveMutation.isPending}>
        <div className="space-y-4">
          <FormField label="Route name" required error={form.formState.errors.name?.message}><Input placeholder="Morning Route A" {...form.register('name')} /></FormField>
          <FormField label="Description" error={form.formState.errors.description?.message}><Input placeholder="Covers Zone 3 estates…" {...form.register('description')} /></FormField>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none"><input type="checkbox" className="accent-primary" {...form.register('isActive')} /><span>Active — students will be assigned to this route</span></label>
        </div>
      </FormModal>

      {toggleTarget && <ConfirmDialog open onOpenChange={(o) => { if (!o) setToggleTarget(null); }} title={toggleTarget.isActive ? 'Deactivate route?' : 'Activate route?'} description={toggleTarget.isActive ? `Students assigned to "${toggleTarget.name}" will not be picked up while inactive.` : `"${toggleTarget.name}" will resume normal operations.`} confirmLabel={toggleTarget.isActive ? 'Deactivate' : 'Activate'} destructive={toggleTarget.isActive} onConfirm={() => toggleMutation.mutate(toggleTarget)} pending={toggleMutation.isPending} />}
      {viewTarget && <RouteDetailDialog route={viewTarget} onClose={() => setViewTarget(null)} />}
    </div>
  );
}

function RouteDetailDialog({ route: r, onClose }: { route: Route; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent hideCloseButton className="max-w-md">
        <DialogHeader>
          <DialogTitle>{r.name}</DialogTitle>
          {r.tenant && <p className="text-sm text-muted-foreground">{r.tenant.name}</p>}
        </DialogHeader>
        {r.description && <p className="text-sm text-muted-foreground -mt-2">{r.description}</p>}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {([
            ['Status', r.isActive ? 'Active' : 'Inactive'],
            ['Bus stops', String(r._count?.busStops ?? '—')],
            ['Students assigned', String(r._count?.studentAssignments ?? '—')],
            ['Added', format(new Date(r.createdAt), 'd MMM yyyy')],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-medium">{value}</p>
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
