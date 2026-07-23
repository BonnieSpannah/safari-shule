import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Bus, Plus, Search, Pencil, Trash2 } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
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

import { usePermission } from '@/hooks/usePermission';
import { useDebounce } from '@/hooks/useDebounce';
import { listVehicles, createVehicle, updateVehicle, deleteVehicle, type Vehicle } from '@/lib/api/fleet';

const PAGE_SIZE = 10;

const schema = z.object({
  registration: z.string().trim().regex(/^K[A-Z]{2}\s?\d{3}[A-Z]$/i, 'Must be a Kenyan plate (e.g. KCB 123X)'),
  make: z.string().min(1, 'Enter make'),
  model: z.string().min(1, 'Enter model'),
  year: z.coerce.number().int().min(1980).max(2100),
  capacity: z.coerce.number().int().min(1).max(120),
  ownership: z.enum(['school', 'hired'] as const),
  status: z.enum(['active', 'maintenance', 'retired'] as const),
  odometerKm: z.coerce.number().int().min(0).default(0),
});
type Form = z.infer<typeof schema>;

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-700 bg-green-500/10',
  maintenance: 'text-amber-700 bg-amber-500/10',
  retired: 'text-zinc-500 bg-zinc-500/10',
};

function VehicleStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_COLORS[status] ?? ''}`}>
      {status}
    </span>
  );
}

export function FleetPage() {
  const canCreate = usePermission('vehicles.create');
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [ownershipFilter, setOwnershipFilter] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);

  const dSearch = useDebounce(search, 300);

  const query = useQuery({
    queryKey: ['vehicles', dSearch, statusFilter, ownershipFilter, page],
    queryFn: () => listVehicles({ q: dSearch || undefined, status: statusFilter || undefined, ownership: ownershipFilter || undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: (prev) => prev,
  });

  const vehicles = query.data?.data ?? [];
  const total = query.data?.meta.total ?? 0;

  const form = useForm<Form>({ resolver: zodResolver(schema), mode: 'onChange' });

  const openCreate = () => { setEditing(null); form.reset({ status: 'active', ownership: 'school', odometerKm: 0 }); setDialogOpen(true); };
  const openEdit = (v: Vehicle) => {
    setEditing(v);
    form.reset({
      registration: v.registration,
      make: v.make,
      model: v.model,
      year: v.year,
      capacity: v.capacity,
      ownership: v.ownership,
      status: v.status,
      odometerKm: v.odometerKm,
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: (v: Form) => editing ? updateVehicle(editing.id, v) : createVehicle(v as any),
    onSuccess: () => {
      toast.success(editing ? 'Vehicle updated.' : 'Vehicle added.');
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ['vehicles'] });
    },
    onError: () => toast.error('Could not save vehicle.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVehicle(id),
    onSuccess: () => {
      toast.success('Vehicle removed.');
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ['vehicles'] });
    },
    onError: () => toast.error('Could not remove vehicle.'),
  });

  const columns: Column<Vehicle>[] = [
    {
      key: 'vehicle',
      header: 'Vehicle',
      render: (v) => (
        <div>
          <div className="font-medium">{v.make} {v.model} <span className="text-muted-foreground">({v.year})</span></div>
          <div className="font-mono text-xs text-muted-foreground">{v.registration}</div>
        </div>
      ),
    },
    { key: 'capacity', header: 'Capacity', width: 'w-24', render: (v) => <span className="text-muted-foreground">{v.capacity} seats</span> },
    { key: 'ownership', header: 'Ownership', width: 'w-28', render: (v) => <span className="capitalize text-muted-foreground">{v.ownership}</span> },
    { key: 'status', header: 'Status', width: 'w-28', render: (v) => <VehicleStatusBadge status={v.status} /> },
    { key: 'odometer', header: 'Odometer', width: 'w-28', render: (v) => <span className="text-xs text-muted-foreground">{v.odometerKm.toLocaleString()} km</span> },
    { key: 'added', header: 'Added', width: 'w-28', render: (v) => <span className="text-xs text-muted-foreground">{format(new Date(v.createdAt), 'd MMM yyyy')}</span> },
    {
      key: 'actions',
      header: '',
      width: 'w-10',
      render: (v) => (
        <ActionMenu items={[
          { label: 'Edit', icon: <Pencil className="h-4 w-4" />, permission: 'vehicles.edit', onClick: () => openEdit(v) },
          { label: 'Remove', icon: <Trash2 className="h-4 w-4" />, permission: 'vehicles.delete', onClick: () => setDeleteTarget(v), variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fleet"
        description="Vehicles, registrations and operational status."
        actions={canCreate ? (
          <Button onClick={openCreate} className="gap-1.5 bg-green-600 hover:bg-green-700">
            <Plus className="h-4 w-4" /> Add vehicle
          </Button>
        ) : undefined}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by registration or make…" className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="maintenance">Maintenance</option>
          <option value="retired">Retired</option>
        </select>
        <select className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={ownershipFilter} onChange={(e) => { setOwnershipFilter(e.target.value); setPage(1); }}>
          <option value="">All ownership</option>
          <option value="school">School-owned</option>
          <option value="hired">Hired</option>
        </select>
      </div>

      <Card>
        <CardContent className="pt-4">
          <DataTable columns={columns} rows={vehicles} rowKey={(v) => v.id} loading={query.isLoading} skeletonRows={PAGE_SIZE} empty={
            <div className="flex flex-col items-center gap-3 py-12">
              <Bus className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No vehicles registered. {canCreate && 'Add the first vehicle above.'}</p>
            </div>
          } />
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
        </CardContent>
      </Card>

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false); }}>
        <DialogContent hideCloseButton className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit — ${editing.registration}` : 'Add vehicle'}</DialogTitle>
            <p className="text-sm text-muted-foreground">Vehicle registration and operational details</p>
            <hr className="mt-1 border-border" />
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {([
                ['registration', 'Registration', 'text', 'KCB 123X', true],
                ['make', 'Make', 'text', 'Toyota', true],
                ['model', 'Model', 'text', 'Hiace', true],
                ['year', 'Year', 'number', '2020', true],
                ['capacity', 'Capacity (seats)', 'number', '14', true],
                ['odometerKm', 'Odometer (km)', 'number', '0', false],
              ] as const).map(([field, label, type, placeholder, required]) => (
                <div key={field} className="space-y-1.5">
                  <Label>{label}{required && <span className="text-danger ml-0.5">*</span>}</Label>
                  <Input type={type} placeholder={placeholder} invalid={!!(form.formState.errors as any)[field]} {...form.register(field)} />
                  {(form.formState.errors as any)[field] && <p className="text-xs text-danger">{(form.formState.errors as any)[field]?.message}</p>}
                </div>
              ))}
              <div className="space-y-1.5">
                <Label>Ownership <span className="text-danger">*</span></Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...form.register('ownership')}>
                  <option value="school">School-owned</option>
                  <option value="hired">Hired</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Status <span className="text-danger">*</span></Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...form.register('status')}>
                  <option value="active">Active</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="retired">Retired</option>
                </select>
              </div>
            </div>
            <FormActions onCancel={() => setDialogOpen(false)} submitLabel={editing ? 'Save changes' : 'Add vehicle'} pending={saveMutation.isPending} />
          </form>
        </DialogContent>
      </Dialog>

      {deleteTarget && (
        <ConfirmDialog
          open
          onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
          title="Remove vehicle?"
          description={`${deleteTarget.registration} (${deleteTarget.make} ${deleteTarget.model}) will be permanently removed.`}
          confirmLabel="Remove"
          destructive
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          pending={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
