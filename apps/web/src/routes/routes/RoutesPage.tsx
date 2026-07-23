import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { RouteIcon, Plus, Search, Pencil, Power, MapPin } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { ActionMenu } from '@/components/ui/action-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormActions } from '@/components/ui/form-actions';

import { usePermission } from '@/hooks/usePermission';
import { useDebounce } from '@/hooks/useDebounce';
import { listRoutes, createRoute, updateRoute, type Route } from '@/lib/api/routes';

const PAGE_SIZE = 10;

const schema = z.object({
  name: z.string().min(1, 'Enter route name').max(80),
  description: z.string().max(500).optional().or(z.literal('')),
  isActive: z.boolean().default(true),
});
type Form = z.infer<typeof schema>;

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${active ? 'bg-green-500/10 text-green-700' : 'bg-zinc-500/10 text-zinc-500'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

// Map placeholder — swapped for react-leaflet in M3
function MapPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 py-12">
      <MapPin className="h-8 w-8 text-muted-foreground/40" />
      <p className="text-sm font-medium text-muted-foreground">Interactive map coming in M3</p>
      <p className="text-xs text-muted-foreground/70">Route drawing, bus stop placement and geofence editing will appear here.</p>
    </div>
  );
}

export function RoutesPage() {
  const canManage = usePermission('routes.manage');
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Route | null>(null);
  const [toggleTarget, setToggleTarget] = useState<Route | null>(null);

  const dSearch = useDebounce(search, 300);

  const query = useQuery({
    queryKey: ['routes', dSearch, activeFilter, page],
    queryFn: () => listRoutes({ q: dSearch || undefined, isActive: activeFilter || undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: (prev) => prev,
  });

  const routes = query.data?.data ?? [];
  const total = query.data?.meta.total ?? 0;

  const form = useForm<Form>({ resolver: zodResolver(schema), mode: 'onChange' });

  const openCreate = () => { setEditing(null); form.reset({ isActive: true }); setDialogOpen(true); };
  const openEdit = (r: Route) => {
    setEditing(r);
    form.reset({ name: r.name, description: r.description ?? '', isActive: r.isActive });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: (v: Form) => {
      if (editing) {
        return updateRoute(editing.id, { name: v.name, description: v.description || null, isActive: v.isActive });
      }
      // Create needs geo points — stub with 0,0 until map integration
      return createRoute({
        name: v.name,
        description: v.description || null,
        isActive: v.isActive,
        startPoint: { lat: 0, lng: 0 },
        endPoint: { lat: 0, lng: 0 },
        busStops: [{ name: 'TBD', location: { lat: 0, lng: 0 }, pickupOrder: 1, scheduledPickupTime: '07:00', scheduledDropoffTime: '16:00' }],
      });
    },
    onSuccess: () => {
      toast.success(editing ? 'Route updated.' : 'Route created. Use the map editor in M3 to add exact coordinates and bus stops.');
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ['routes'] });
    },
    onError: () => toast.error('Could not save route.'),
  });

  const toggleMutation = useMutation({
    mutationFn: (r: Route) => updateRoute(r.id, { isActive: !r.isActive }),
    onSuccess: (_, r) => {
      toast.success(r.isActive ? 'Route deactivated.' : 'Route activated.');
      setToggleTarget(null);
      qc.invalidateQueries({ queryKey: ['routes'] });
    },
    onError: () => toast.error('Could not update route status.'),
  });

  const columns: Column<Route>[] = [
    {
      key: 'route',
      header: 'Route',
      render: (r) => (
        <div>
          <div className="font-medium">{r.name}</div>
          {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}
        </div>
      ),
    },
    { key: 'status', header: 'Status', width: 'w-24', render: (r) => <ActiveBadge active={r.isActive} /> },
    {
      key: 'stops',
      header: 'Bus stops',
      width: 'w-24',
      render: (r) => <span className="text-muted-foreground">{r._count?.busStops ?? '—'}</span>,
    },
    {
      key: 'students',
      header: 'Students',
      width: 'w-24',
      render: (r) => <span className="text-muted-foreground">{r._count?.studentAssignments ?? '—'}</span>,
    },
    { key: 'added', header: 'Added', width: 'w-28', render: (r) => <span className="text-xs text-muted-foreground">{format(new Date(r.createdAt), 'd MMM yyyy')}</span> },
    {
      key: 'actions',
      header: '',
      width: 'w-10',
      render: (r) => (
        <ActionMenu items={[
          { label: 'Edit details', icon: <Pencil className="h-4 w-4" />, permission: 'routes.manage', onClick: () => openEdit(r) },
          {
            label: r.isActive ? 'Deactivate' : 'Activate',
            icon: <Power className="h-4 w-4" />,
            permission: 'routes.manage',
            onClick: () => setToggleTarget(r),
            variant: r.isActive ? 'destructive' : 'default',
          },
        ]} />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Routes"
        description="School bus routes, bus stops and student assignments."
        actions={canManage ? (
          <Button onClick={openCreate} className="gap-1.5 bg-green-600 hover:bg-green-700">
            <Plus className="h-4 w-4" /> Add route
          </Button>
        ) : undefined}
      />

      <MapPlaceholder />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search routes…" className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={activeFilter} onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}>
          <option value="">All routes</option>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
        </select>
      </div>

      <Card>
        <CardContent className="pt-4">
          <DataTable columns={columns} rows={routes} rowKey={(r) => r.id} loading={query.isLoading} skeletonRows={PAGE_SIZE} empty={
            <div className="flex flex-col items-center gap-3 py-12">
              <RouteIcon className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No routes yet. {canManage && 'Add the first route above.'}</p>
            </div>
          } />
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
        </CardContent>
      </Card>

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false); }}>
        <DialogContent hideCloseButton className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit route — ${editing.name}` : 'Add route'}</DialogTitle>
            <p className="text-sm text-muted-foreground">Route name and description. Bus stops and geo-coordinates are managed via the map editor (M3).</p>
            <hr className="mt-1 border-border" />
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label>Route name <span className="text-danger">*</span></Label>
              <Input placeholder="Morning Route A" invalid={!!form.formState.errors.name} {...form.register('name')} />
              {form.formState.errors.name && <p className="text-xs text-danger">{form.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input placeholder="Covers Zone 3 estates…" {...form.register('description')} />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="accent-primary" {...form.register('isActive')} />
              Active (students are assigned to this route)
            </label>
            <FormActions onCancel={() => setDialogOpen(false)} submitLabel={editing ? 'Save changes' : 'Create route'} pending={saveMutation.isPending} />
          </form>
        </DialogContent>
      </Dialog>

      {toggleTarget && (
        <ConfirmDialog
          open
          onOpenChange={(o) => { if (!o) setToggleTarget(null); }}
          title={toggleTarget.isActive ? 'Deactivate route?' : 'Activate route?'}
          description={toggleTarget.isActive
            ? `Students assigned to "${toggleTarget.name}" will not be picked up while inactive.`
            : `"${toggleTarget.name}" will resume normal operations.`}
          confirmLabel={toggleTarget.isActive ? 'Deactivate' : 'Activate'}
          destructive={toggleTarget.isActive}
          onConfirm={() => toggleMutation.mutate(toggleTarget)}
          pending={toggleMutation.isPending}
        />
      )}
    </div>
  );
}
