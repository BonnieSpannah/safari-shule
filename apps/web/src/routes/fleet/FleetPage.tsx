import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Bus, Plus, Search, Pencil, Trash2, Eye } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/ui/data-table';
import { ActionMenu } from '@/components/ui/action-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FormModal } from '@/components/ui/form-modal';
import { FormField } from '@/components/ui/form-field';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TenantSelectorField } from '@/components/ui/tenant-selector-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';

import { usePermission } from '@/hooks/usePermission';
import { useDebounce } from '@/hooks/useDebounce';
import { useTenantFilter, TenantBadge, TenantFilterSelect } from '@/hooks/useTenantFilter';
import { listVehicles, createVehicle, updateVehicle, deleteVehicle, type Vehicle } from '@/lib/api/fleet';

const PAGE_SIZE = 15;

const STATUS_OPTS = [{ value: 'active', label: 'Active' }, { value: 'maintenance', label: 'Maintenance' }, { value: 'retired', label: 'Retired' }];
const OWNERSHIP_OPTS = [{ value: 'school', label: 'School-owned' }, { value: 'hired', label: 'Hired' }];

function VehicleStatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = { active: 'bg-green-500/10 text-green-700', maintenance: 'bg-amber-500/10 text-amber-700', retired: 'bg-zinc-500/10 text-zinc-500' };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${cls[status] ?? ''}`}>{status}</span>;
}

const schema = z.object({
  targetTenantId: z.string().uuid().or(z.literal('')).optional(),
  registration: z.string().trim().regex(/^K[A-Z]{2}\s?\d{3}[A-Z]$/i, 'Must be a Kenyan plate (e.g. KCB 123X)'),
  make: z.string().min(1, 'Enter make'), model: z.string().min(1, 'Enter model'),
  year: z.coerce.number().int().min(1980).max(2100),
  capacity: z.coerce.number().int().min(1).max(120),
  ownership: z.enum(['school', 'hired'] as const),
  status: z.enum(['active', 'maintenance', 'retired'] as const),
  odometerKm: z.coerce.number().int().min(0).default(0),
});
type Form = z.infer<typeof schema>;

export function FleetPage() {
  const canCreate = usePermission('vehicles.create');
  const { isSuperAdmin, tenants } = useTenantFilter();
  const qc = useQueryClient();
  const [search, setSearch] = useState(''); const [statusFilter, setStatusFilter] = useState(''); const [ownershipFilter, setOwnershipFilter] = useState(''); const [tenantFilter, setTenantFilter] = useState(''); const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false); const [editing, setEditing] = useState<Vehicle | null>(null); const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null); const [viewTarget, setViewTarget] = useState<Vehicle | null>(null);
  const dSearch = useDebounce(search, 300);

  const query = useQuery({ queryKey: ['vehicles', dSearch, statusFilter, ownershipFilter, tenantFilter, page], queryFn: () => listVehicles({ q: dSearch || undefined, status: statusFilter || undefined, ownership: ownershipFilter || undefined, tenantId: tenantFilter || undefined, page, pageSize: PAGE_SIZE }), placeholderData: (prev) => prev });
  const vehicles = query.data?.data ?? []; const total = query.data?.meta.total ?? 0;
  const form = useForm<Form>({ resolver: zodResolver(schema), mode: 'onChange' });

  const openCreate = () => { setEditing(null); form.reset({ status: 'active', ownership: 'school', odometerKm: 0 }); setDialogOpen(true); };
  const openEdit = (v: Vehicle) => { setEditing(v); form.reset({ targetTenantId: v.tenant?.id ?? '', registration: v.registration, make: v.make, model: v.model, year: v.year, capacity: v.capacity, ownership: v.ownership, status: v.status, odometerKm: v.odometerKm }); setDialogOpen(true); };

  const saveMutation = useMutation({
    mutationFn: (v: Form) => editing
      ? updateVehicle(editing.id, { registration: v.registration, make: v.make, model: v.model, year: v.year, capacity: v.capacity, ownership: v.ownership, status: v.status, odometerKm: v.odometerKm, targetTenantId: v.targetTenantId || undefined })
      : createVehicle({ registration: v.registration, make: v.make, model: v.model, year: v.year, capacity: v.capacity, ownership: v.ownership, status: v.status, odometerKm: v.odometerKm, targetTenantId: v.targetTenantId || undefined }),
    onSuccess: () => { toast.success(editing ? 'Vehicle updated.' : 'Vehicle registered.'); setDialogOpen(false); qc.invalidateQueries({ queryKey: ['vehicles'] }); },
    onError: () => toast.error('Could not save vehicle.'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVehicle(id),
    onSuccess: () => { toast.success('Vehicle removed.'); setDeleteTarget(null); qc.invalidateQueries({ queryKey: ['vehicles'] }); },
    onError: () => toast.error('Could not remove vehicle.'),
  });

  const columns: Column<Vehicle>[] = [
    { key: 'vehicle', header: 'Vehicle', width: 'w-full', exportValue: (v) => `${v.make} ${v.model} (${v.year}) — ${v.registration}`, render: (v) => (<div><p className="font-medium">{v.make} {v.model} <span className="text-muted-foreground font-normal">({v.year})</span></p><p className="text-xs text-muted-foreground font-mono">{v.registration}</p></div>) },
    { key: 'capacity', header: 'Seats', exportValue: (v) => v.capacity, render: (v) => <span className="whitespace-nowrap text-sm text-muted-foreground">{v.capacity}</span> },
    { key: 'ownership', header: 'Ownership', exportValue: (v) => v.ownership, render: (v) => <span className="capitalize text-sm text-muted-foreground">{v.ownership}</span> },
    { key: 'status', header: 'Status', exportValue: (v) => v.status, render: (v) => <VehicleStatusBadge status={v.status} /> },
    { key: 'odometer', header: 'Odometer', exportValue: (v) => `${v.odometerKm} km`, render: (v) => <span className="whitespace-nowrap text-xs text-muted-foreground">{v.odometerKm.toLocaleString()} km</span> },
    { key: 'added', header: 'Added', exportValue: (v) => format(new Date(v.createdAt), 'd MMM yyyy'), render: (v) => <span className="whitespace-nowrap text-xs text-muted-foreground">{format(new Date(v.createdAt), 'd MMM yyyy')}</span> },
    ...(isSuperAdmin ? [{ key: 'tenant', header: 'Tenant', render: (v: Vehicle) => <TenantBadge tenant={v.tenant} /> }] : []),
    { key: 'actions', header: '', align: 'right' as const, width: 'w-10', render: (v) => (<ActionMenu items={[{ label: 'View', icon: <Eye className="h-4 w-4" />, permission: 'vehicles.view', onClick: () => setViewTarget(v) }, { label: 'Edit', icon: <Pencil className="h-4 w-4" />, permission: 'vehicles.edit', onClick: () => openEdit(v) }, { label: 'Remove', icon: <Trash2 className="h-4 w-4" />, permission: 'vehicles.delete', onClick: () => setDeleteTarget(v), variant: 'destructive' }]} />) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Fleet" description="Vehicles, registrations and operational status." actions={canCreate ? <Button onClick={openCreate} size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700"><Plus className="h-4 w-4" />Add vehicle</Button> : undefined} />

      {query.error && (
        <ErrorState
          title="Failed to load vehicles"
          error={query.error}
          onRetry={() => query.refetch()}
        />
      )}

      {!query.error && (
        <DataTable
        title="All vehicles"
        description={total > 0 ? `${total} vehicle${total !== 1 ? 's' : ''}` : undefined}
        search={<div className="relative w-full"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input placeholder="Search plate, make or model…" className="pl-8 h-9 text-sm" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>}
        filters={<><SearchableSelect options={[{ value: '', label: 'All statuses' }, ...STATUS_OPTS]} value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} placeholder="Status" className="h-9 min-w-[120px]" /><SearchableSelect options={[{ value: '', label: 'All ownership' }, ...OWNERSHIP_OPTS]} value={ownershipFilter} onChange={(v) => { setOwnershipFilter(v); setPage(1); }} placeholder="Ownership" className="h-9 min-w-[130px]" />{isSuperAdmin && <TenantFilterSelect tenants={tenants} value={tenantFilter} onChange={(v) => { setTenantFilter(v); setPage(1); }} />}</>}
        filtersActive={statusFilter !== '' || ownershipFilter !== '' || tenantFilter !== ''}
        selectable exportFilename="fleet"
        page={page} pageSize={PAGE_SIZE} total={total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)}
        columns={columns} rows={vehicles} rowKey={(v) => v.id} loading={query.isLoading} skeletonRows={PAGE_SIZE}
        empty={<EmptyState icon={<Bus className="h-6 w-6" />} title="No vehicles found" description={canCreate ? 'Register the first vehicle above.' : undefined} />}
      />
      )}

      <FormModal open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? `Edit — ${editing.registration}` : 'Register vehicle'} subtitle="Vehicle registration and operational details" onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} submitLabel={editing ? 'Save changes' : 'Register vehicle'} submitting={saveMutation.isPending}>
        <div className="grid gap-4 sm:grid-cols-2">
          {isSuperAdmin && <div className="sm:col-span-2"><TenantSelectorField value={form.watch('targetTenantId') ?? ''} onChange={(v) => form.setValue('targetTenantId', v)} error={form.formState.errors.targetTenantId?.message} hint={editing ? 'Change to reassign this vehicle to a different school' : undefined} /></div>}
          <FormField label="Registration plate" required error={form.formState.errors.registration?.message}><Input placeholder="KCB 123X" {...form.register('registration')} /></FormField>
          <FormField label="Make" required error={form.formState.errors.make?.message}><Input placeholder="Toyota" {...form.register('make')} /></FormField>
          <FormField label="Model" required error={form.formState.errors.model?.message}><Input placeholder="Hiace" {...form.register('model')} /></FormField>
          <FormField label="Year" required error={form.formState.errors.year?.message}><Input type="number" placeholder="2020" {...form.register('year')} /></FormField>
          <FormField label="Seats (capacity)" required error={form.formState.errors.capacity?.message}><Input type="number" placeholder="14" {...form.register('capacity')} /></FormField>
          <FormField label="Odometer (km)" error={form.formState.errors.odometerKm?.message}><Input type="number" placeholder="0" {...form.register('odometerKm')} /></FormField>
          <FormField label="Ownership" required error={form.formState.errors.ownership?.message}><SearchableSelect options={OWNERSHIP_OPTS} value={form.watch('ownership') ?? ''} onChange={(v) => form.setValue('ownership', v as 'school' | 'hired')} placeholder="Select ownership" /></FormField>
          <FormField label="Status" required error={form.formState.errors.status?.message}><SearchableSelect options={STATUS_OPTS} value={form.watch('status') ?? ''} onChange={(v) => form.setValue('status', v as 'active' | 'maintenance' | 'retired')} placeholder="Select status" /></FormField>
        </div>
      </FormModal>

      {deleteTarget && <ConfirmDialog open onOpenChange={(o) => { if (!o) setDeleteTarget(null); }} title="Remove vehicle?" description={`${deleteTarget.registration} (${deleteTarget.make} ${deleteTarget.model}) will be permanently removed.`} confirmLabel="Remove" destructive onConfirm={() => deleteMutation.mutate(deleteTarget.id)} pending={deleteMutation.isPending} />}
      {viewTarget && <VehicleDetailDialog vehicle={viewTarget} onClose={() => setViewTarget(null)} />}
    </div>
  );
}

function VehicleDetailDialog({ vehicle: v, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent hideCloseButton className="max-w-md">
        <DialogHeader>
          <DialogTitle>{v.make} {v.model} <span className="font-mono text-base font-normal text-muted-foreground">{v.registration}</span></DialogTitle>
          {v.tenant && <p className="text-sm text-muted-foreground">{v.tenant.name}</p>}
        </DialogHeader>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {([
            ['Year', String(v.year)],
            ['Seats', String(v.capacity)],
            ['Ownership', v.ownership === 'school' ? 'School-owned' : 'Hired'],
            ['Status', v.status],
            ['Odometer', `${v.odometerKm.toLocaleString()} km`],
            ['Added', format(new Date(v.createdAt), 'd MMM yyyy')],
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
