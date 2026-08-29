import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Route as RouteIcon, Plus, Search, Pencil, Power, Eye, Trash2, GraduationCap, X } from 'lucide-react';
import { FilterDropdown } from '@/components/ui/filter-dropdown';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/ui/data-table';
import { ActionMenu } from '@/components/ui/action-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FormModal } from '@/components/ui/form-modal';
import { FormField } from '@/components/ui/form-field';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { TenantSelectorField } from '@/components/ui/tenant-selector-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { usePermission } from '@/hooks/usePermission';
import { useDebounce } from '@/hooks/useDebounce';
import { useClientEvents } from '@/hooks/useClientEvents';
import { useTenantFilter, TenantBadge } from '@/hooks/useTenantFilter';
import { listRoutes, createRoute, updateRoute, getRouteStops, replaceRouteStops, type Route, type BusStopDraft } from '@/lib/api/routes';
import { listStudents } from '@/lib/api/students';
import { assignStudentToRoute, listRouteAssignments } from '../../lib/api/route-assignments';

const PAGE_SIZE = 15;

function ActiveBadge({ active }: { active: boolean }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${active ? 'bg-green-500/10 text-green-700' : 'bg-zinc-500/10 text-zinc-500'}`}>{active ? 'Active' : 'Inactive'}</span>;
}

const schema = z.object({
  targetTenantId: z.string().uuid().or(z.literal('')).optional(),
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
  const openEdit = (r: Route) => { setEditing(r); form.reset({ targetTenantId: r.tenant?.id ?? '', name: r.name, description: r.description ?? '', isActive: r.isActive }); setDialogOpen(true); };

  const saveMutation = useMutation({
    mutationFn: (v: Form) => editing
      ? updateRoute(editing.id, { name: v.name, description: v.description || null, isActive: v.isActive, targetTenantId: v.targetTenantId || undefined })
      : createRoute({ name: v.name, description: v.description || null, isActive: v.isActive, startPoint: { lat: 0, lng: 0 }, endPoint: { lat: 0, lng: 0 }, busStops: [{ name: 'TBD', location: { lat: 0, lng: 0 }, pickupOrder: 1, scheduledPickupTime: '07:00', scheduledDropoffTime: '16:00' }], targetTenantId: v.targetTenantId || undefined }),
    onSuccess: () => { toast.success(editing ? 'Route updated.' : 'Route created — open View to add bus stops on the map.'); setDialogOpen(false); qc.invalidateQueries({ queryKey: ['routes'] }); },
    onError: () => toast.error('Could not save route.'),
  });
  const toggleMutation = useMutation({
    mutationFn: (r: Route) => updateRoute(r.id, { isActive: !r.isActive }),
    onSuccess: (_, r) => { toast.success(r.isActive ? 'Route deactivated.' : 'Route activated.'); setToggleTarget(null); qc.invalidateQueries({ queryKey: ['routes'] }); },
    onError: () => toast.error('Could not update route status.'),
  });

  const columns: Column<Route>[] = [
    { key: 'route', header: 'Route', width: 'w-full', sortable: true, exportValue: (r) => r.name, render: (r) => (<div><p className="font-medium">{r.name}</p>{r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}</div>) },
    { key: 'status', header: 'Status', width: 'w-24', exportValue: (r) => r.isActive ? 'Active' : 'Inactive', render: (r) => <ActiveBadge active={r.isActive} /> },
    { key: 'stops', header: 'Bus stops', width: 'w-24', sortable: true, exportValue: (r) => r._count?.busStops ?? 0, render: (r) => <span className="text-sm text-muted-foreground">{r._count?.busStops ?? '—'}</span> },
    { key: 'students', header: 'Students', width: 'w-24', exportValue: (r) => r._count?.studentAssignments ?? 0, render: (r) => <span className="text-sm text-muted-foreground">{r._count?.studentAssignments ?? '—'}</span> },
    { key: 'added', header: 'Added', width: 'w-28', sortable: true, exportValue: (r) => format(new Date(r.createdAt), 'd MMM yyyy'), render: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{format(new Date(r.createdAt), 'd MMM yyyy')}</span> },
    ...(isSuperAdmin ? [{ key: 'tenant', header: 'Tenant', width: 'w-32', render: (r: Route) => <TenantBadge tenant={r.tenant} /> }] : []),
    { key: 'actions', header: '', align: 'right' as const, width: 'w-10', render: (r) => (<ActionMenu items={[{ label: 'View', icon: <Eye className="h-4 w-4" />, permission: 'routes.view', onClick: () => setViewTarget(r) }, { label: 'Edit', icon: <Pencil className="h-4 w-4" />, permission: 'routes.manage', onClick: () => openEdit(r) }, { label: r.isActive ? 'Deactivate' : 'Activate', icon: <Power className="h-4 w-4" />, permission: 'routes.manage', onClick: () => setToggleTarget(r), variant: r.isActive ? 'destructive' as const : 'default' as const }]} />) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Routes" description="School bus routes, bus stops and student assignments." actions={canManage ? <Button onClick={openCreate} size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700"><Plus className="h-4 w-4" />Add route</Button> : undefined} />

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

        filters={<div className="flex flex-wrap items-center gap-2"><FilterDropdown label="Status" options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }]} selected={activeFilter ? [activeFilter] : []} onChange={(v) => { setActiveFilter(v[v.length-1] ?? ''); setPage(1); }} />{isSuperAdmin && <FilterDropdown label="Tenant" options={tenants.map((t) => ({ value: t.id, label: t.name }))} selected={tenantFilter ? [tenantFilter] : []} onChange={(v) => { setTenantFilter(v[v.length-1] ?? ''); setPage(1); }} />}{(activeFilter || tenantFilter) && <button type="button" onClick={() => { setActiveFilter(''); setTenantFilter(''); setPage(1); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><X className="h-3 w-3" />Clear</button>}</div>}

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
          {isSuperAdmin && <TenantSelectorField value={form.watch('targetTenantId') ?? ''} onChange={(v) => form.setValue('targetTenantId', v)} error={form.formState.errors.targetTenantId?.message} hint={editing ? 'Change to reassign this route to a different school' : undefined} />}
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

// ─── Leaflet icon fix (avoids broken default marker images in Vite) ─────────
const stopIcon = (order: number) => L.divIcon({
  className: '',
  html: `<div style="width:28px;height:28px;background:#16a34a;border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:bold;box-shadow:0 2px 8px rgba(0,0,0,.3)">${order}</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
});

function MapClickCapture({ onAdd }: { onAdd: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onAdd(e.latlng.lat, e.latlng.lng) });
  return null;
}

// ─── Route detail + map editor dialog ────────────────────────────────────────
function RouteDetailDialog({ route, onClose }: { route: Route; onClose: () => void }) {
  const qc = useQueryClient();
  const canManage = usePermission('routes.manage');
  const [stops, setStops] = useState<BusStopDraft[]>([]);
  const [addingStop, setAddingStop] = useState(false);
  const [pendingLatLng, setPendingLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [stopForm, setStopForm] = useState({ name: '', pickupTime: '07:00', dropoffTime: '16:00' });
  const [assignStudentOpen, setAssignStudentOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const dStudentSearch = useDebounce(studentSearch, 300);

  const stopsQuery = useQuery({
    queryKey: ['route-stops', route.id],
    queryFn: () => getRouteStops(route.id),
  });

  useEffect(() => {
    if (stopsQuery.data) {
      setStops(stopsQuery.data.map((s, i) => ({ ...s, draftId: s.id || String(i) })));
    }
  }, [stopsQuery.data]);

  const assignmentsQuery = useQuery({
    queryKey: ['route-assignments', route.id],
    queryFn: () => listRouteAssignments(route.id),
  });

  const studentsQuery = useQuery({
    queryKey: ['students-for-assign', route.tenant?.id, dStudentSearch],
    queryFn: () => listStudents({ tenantId: route.tenant?.id, q: dStudentSearch || undefined, pageSize: 50 }),
    enabled: assignStudentOpen,
  });

  const saveStopsMutation = useMutation({
    mutationFn: () => replaceRouteStops(route.id, stops.map((s, i) => ({
      name: s.name, lat: s.lat, lng: s.lng,
      pickupOrder: i + 1,
      scheduledPickupTime: s.scheduledPickupTime,
      scheduledDropoffTime: s.scheduledDropoffTime,
    }))),
    onSuccess: () => { toast.success(`${stops.length} bus stop${stops.length !== 1 ? 's' : ''} saved.`); qc.invalidateQueries({ queryKey: ['route-stops', route.id] }); qc.invalidateQueries({ queryKey: ['routes'] }); },
    onError: () => toast.error('Could not save stops.'),
  });

  const assignMutation = useMutation({
    mutationFn: () => {
      const firstStop = stops[0];
      if (!firstStop) throw new Error('Add at least one bus stop first.');
      return assignStudentToRoute({ studentId: selectedStudentId, routeId: route.id, busStopId: (firstStop as { id?: string }).id ?? '', validFrom: new Date().toISOString().slice(0, 10) });
    },
    onSuccess: () => { toast.success('Student assigned to route.'); setAssignStudentOpen(false); setSelectedStudentId(''); setStudentSearch(''); qc.invalidateQueries({ queryKey: ['route-assignments', route.id] }); qc.invalidateQueries({ queryKey: ['routes'] }); },
    onError: (e: Error) => toast.error(e?.message ?? 'Could not assign student.'),
  });

  const mapCenter: [number, number] = stops.length > 0 && stops[0] ? [stops[0].lat, stops[0].lng] : [-1.286, 36.817];

  const addStopAtPoint = (lat: number, lng: number) => {
    setPendingLatLng({ lat, lng });
    setStopForm({ name: '', pickupTime: '07:00', dropoffTime: '16:00' });
    setAddingStop(true);
  };

  const confirmAddStop = () => {
    if (!pendingLatLng || !stopForm.name.trim()) return;
    setStops(prev => [...prev, {
      draftId: crypto.randomUUID(),
      id: '', name: stopForm.name.trim(),
      lat: pendingLatLng.lat, lng: pendingLatLng.lng,
      pickupOrder: prev.length + 1,
      scheduledPickupTime: stopForm.pickupTime,
      scheduledDropoffTime: stopForm.dropoffTime,
    }]);
    setAddingStop(false);
    setPendingLatLng(null);
  };

  const removeStop = (draftId: string) => setStops(prev => prev.filter(s => s.draftId !== draftId).map((s, i) => ({ ...s, pickupOrder: i + 1 })));

  const studentOptions = (studentsQuery.data?.data ?? []).map(s => ({ value: s.id, label: `${s.legalName} (${s.admissionNumber})` }));

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent hideCloseButton className="max-w-5xl p-0 overflow-hidden">
        <div className="flex flex-col h-[85vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20 shrink-0">
            <div>
              <h2 className="font-semibold text-base">{route.name}</h2>
              <p className="text-sm text-muted-foreground">{route.tenant?.name ?? ''}{route.description ? ` · ${route.description}` : ''}</p>
            </div>
            <div className="flex items-center gap-2">
              {canManage && (
                <Button size="sm" disabled={saveStopsMutation.isPending || stops.length === 0} onClick={() => saveStopsMutation.mutate()} className="bg-green-600 hover:bg-green-700 h-8">
                  {saveStopsMutation.isPending ? 'Saving…' : `Save ${stops.length} stop${stops.length !== 1 ? 's' : ''}`}
                </Button>
              )}
              <Button variant="outline" size="sm" className="h-8" onClick={onClose}>Close</Button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Left panel */}
            <div className="w-72 shrink-0 border-r border-border overflow-y-auto flex flex-col">
              {/* Instructions */}
              {canManage && (
                <div className="px-4 py-3 bg-blue-50 dark:bg-blue-950/30 border-b border-border text-xs text-blue-700 dark:text-blue-400">
                  Click anywhere on the map to add a bus stop. Drag markers to reposition.
                </div>
              )}

              {/* Stops list */}
              <div className="p-4 space-y-2 flex-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Bus stops ({stops.length})</p>
                {stopsQuery.isLoading ? (
                  <p className="text-xs text-muted-foreground">Loading…</p>
                ) : stops.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No stops yet. Click the map to add the first one.</p>
                ) : (
                  stops.map((s, i) => (
                    <div key={s.draftId} className="flex items-start gap-2 rounded-md border border-border bg-background px-3 py-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-600 text-[10px] font-bold text-white">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.name}</p>
                        <p className="text-[10px] text-muted-foreground">{s.scheduledPickupTime} pickup · {s.scheduledDropoffTime} dropoff</p>
                      </div>
                      {canManage && <button onClick={() => removeStop(s.draftId)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}
                    </div>
                  ))
                )}
              </div>

              {/* Students */}
              <div className="border-t border-border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Students assigned</p>
                  {canManage && (
                    <Button variant="outline" size="sm" className="h-6 text-[11px] gap-1" onClick={() => setAssignStudentOpen(true)}>
                      <Plus className="h-3 w-3" /> Assign
                    </Button>
                  )}
                </div>
                {assignmentsQuery.isLoading ? (
                  <p className="text-xs text-muted-foreground">Loading…</p>
                ) : (assignmentsQuery.data?.length ?? 0) === 0 ? (
                  <p className="text-xs text-muted-foreground">No students assigned yet.</p>
                ) : (
                  (assignmentsQuery.data ?? []).map(a => (
                    <div key={a.id} className="flex items-center gap-2 text-xs">
                      <GraduationCap className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">{a.student.legalName}</span>
                      <span className="text-muted-foreground font-mono shrink-0">{a.student.admissionNumber}</span>
                    </div>
                  ))
                )}

                {assignStudentOpen && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <Input placeholder="Search students…" className="h-7 text-xs" value={studentSearch} onChange={e => setStudentSearch(e.target.value)} autoFocus />
                    <SearchableSelect
                      options={studentOptions}
                      value={selectedStudentId}
                      onChange={setSelectedStudentId}
                      placeholder={studentsQuery.isLoading ? 'Loading…' : 'Select student'}
                    />
                    <div className="flex gap-1">
                      <Button size="sm" className="h-6 text-[11px] flex-1 bg-green-600 hover:bg-green-700"
                        disabled={!selectedStudentId || assignMutation.isPending}
                        onClick={() => assignMutation.mutate()}>
                        {assignMutation.isPending ? '…' : 'Assign'}
                      </Button>
                      <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => { setAssignStudentOpen(false); setSelectedStudentId(''); }}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Map */}
            <div className="flex-1 relative">
              <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }} className="z-0">
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" />
                {canManage && <MapClickCapture onAdd={addStopAtPoint} />}
                {stops.map((s, i) => (
                  <Marker key={s.draftId} position={[s.lat, s.lng]} icon={stopIcon(i + 1)}
                    eventHandlers={{ dragend: (e) => {
                      const { lat, lng } = (e.target as L.Marker).getLatLng();
                      setStops(prev => prev.map(st => st.draftId === s.draftId ? { ...st, lat, lng } : st));
                    }}}
                    draggable={canManage}
                  />
                ))}
              </MapContainer>

              {/* Add stop overlay form */}
              {addingStop && pendingLatLng && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-80 rounded-xl border border-border bg-card shadow-xl p-4 space-y-3">
                  <p className="text-sm font-medium">Add bus stop at {pendingLatLng.lat.toFixed(4)}, {pendingLatLng.lng.toFixed(4)}</p>
                  <Input placeholder="Stop name (e.g. Westlands Junction)" value={stopForm.name} onChange={e => setStopForm(f => ({ ...f, name: e.target.value }))} autoFocus className="h-8 text-sm" />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-muted-foreground">Pickup time</label>
                      <Input type="time" value={stopForm.pickupTime} onChange={e => setStopForm(f => ({ ...f, pickupTime: e.target.value }))} className="h-8 text-sm" />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground">Drop-off time</label>
                      <Input type="time" value={stopForm.dropoffTime} onChange={e => setStopForm(f => ({ ...f, dropoffTime: e.target.value }))} className="h-8 text-sm" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 h-8" disabled={!stopForm.name.trim()} onClick={confirmAddStop}>Add stop</Button>
                    <Button size="sm" variant="outline" className="h-8" onClick={() => { setAddingStop(false); setPendingLatLng(null); }}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
