import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { Cpu, Plus, Search, CheckCircle2, Ban, RotateCcw, Copy } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/ui/data-table';
import { ActionMenu } from '@/components/ui/action-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FormModal } from '@/components/ui/form-modal';
import { FormField } from '@/components/ui/form-field';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';

import { usePermission } from '@/hooks/usePermission';
import { useDebounce } from '@/hooks/useDebounce';
import { useTenantFilter, TenantBadge, TenantFilterSelect } from '@/hooks/useTenantFilter';
import { listDevices, registerDevice, setDeviceStatus, type RfidDevice, type RegisterDeviceResult } from '@/lib/api/hardware';

const PAGE_SIZE = 15;
const STATUS_OPTS = [{ value: 'active', label: 'Active' }, { value: 'rotating', label: 'Key rotation' }, { value: 'disabled', label: 'Disabled' }];

function DeviceStatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = { active: 'bg-green-500/10 text-green-700', rotating: 'bg-amber-500/10 text-amber-700', disabled: 'bg-zinc-500/10 text-zinc-500' };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${cls[status] ?? ''}`}>{status === 'rotating' ? 'Key rotation' : status}</span>;
}

const schema = z.object({
  deviceId: z.string().min(3, 'Enter hardware device ID').max(64),
  vehicleId: z.string().uuid('Must be a valid vehicle UUID').optional().or(z.literal('')),
});
type Form = z.infer<typeof schema>;

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied.`));
}

export function HardwarePage() {
  const canManage = usePermission('rfid_devices.manage');
  const { isSuperAdmin, tenants } = useTenantFilter();
  const qc = useQueryClient();
  const [search, setSearch] = useState(''); const [statusFilter, setStatusFilter] = useState(''); const [tenantFilter, setTenantFilter] = useState(''); const [page, setPage] = useState(1);
  const [registerOpen, setRegisterOpen] = useState(false); const [credentials, setCredentials] = useState<RegisterDeviceResult | null>(null); const [statusTarget, setStatusTarget] = useState<{ device: RfidDevice; status: 'active' | 'rotating' | 'disabled' } | null>(null);
  const dSearch = useDebounce(search, 300);

  const query = useQuery({ queryKey: ['rfid-devices', dSearch, statusFilter, tenantFilter, page], queryFn: () => listDevices({ q: dSearch || undefined, status: statusFilter || undefined, tenantId: tenantFilter || undefined, page, pageSize: PAGE_SIZE }), placeholderData: (prev) => prev });
  const devices = query.data?.data ?? []; const total = query.data?.meta.total ?? 0;
  const form = useForm<Form>({ resolver: zodResolver(schema), mode: 'onChange' });

  const registerMutation = useMutation({
    mutationFn: (v: Form) => registerDevice({ deviceId: v.deviceId, vehicleId: v.vehicleId || null }),
    onSuccess: (result) => { setCredentials(result); setRegisterOpen(false); form.reset(); qc.invalidateQueries({ queryKey: ['rfid-devices'] }); },
    onError: () => toast.error('Could not register device.'),
  });
  const statusMutation = useMutation({
    mutationFn: ({ device, status }: { device: RfidDevice; status: 'active' | 'rotating' | 'disabled' }) => setDeviceStatus(device.id, status),
    onSuccess: (_, { status }) => { toast.success(`Device ${status === 'disabled' ? 'disabled.' : status === 'active' ? 'enabled.' : 'marked for key rotation.'}`); setStatusTarget(null); qc.invalidateQueries({ queryKey: ['rfid-devices'] }); },
    onError: () => toast.error('Could not update device status.'),
  });

  const columns: Column<RfidDevice>[] = [
    { key: 'device', header: 'Device', width: 'w-full', exportValue: (d) => d.deviceId, render: (d) => (<div><p className="font-mono font-medium text-sm">{d.deviceId}</p>{d.vehicle && <p className="text-xs text-muted-foreground">{d.vehicle.registration} — {d.vehicle.make} {d.vehicle.model}</p>}</div>) },
    { key: 'status', header: 'Status', exportValue: (d) => d.status, render: (d) => <DeviceStatusBadge status={d.status} /> },
    { key: 'lastSeen', header: 'Last seen', exportValue: (d) => d.lastSeenAt ? formatDistanceToNow(new Date(d.lastSeenAt), { addSuffix: true }) : 'Never', render: (d) => <span className="whitespace-nowrap text-xs text-muted-foreground">{d.lastSeenAt ? formatDistanceToNow(new Date(d.lastSeenAt), { addSuffix: true }) : 'Never'}</span> },
    { key: 'registered', header: 'Registered', exportValue: (d) => format(new Date(d.createdAt), 'd MMM yyyy'), render: (d) => <span className="whitespace-nowrap text-xs text-muted-foreground">{format(new Date(d.createdAt), 'd MMM yyyy')}</span> },
    ...(isSuperAdmin ? [{ key: 'tenant', header: 'Tenant', render: (d: RfidDevice) => <TenantBadge tenant={d.tenant} /> }] : []),
    { key: 'actions', header: '', align: 'right' as const, width: 'w-10', render: (d) => (<ActionMenu items={[
      ...(d.status !== 'active' ? [{ label: 'Enable', icon: <CheckCircle2 className="h-4 w-4" />, permission: 'rfid_devices.manage', onClick: () => setStatusTarget({ device: d, status: 'active' }) }] : []),
      ...(d.status === 'active' ? [{ label: 'Rotate keys', icon: <RotateCcw className="h-4 w-4" />, permission: 'rfid_devices.manage', onClick: () => setStatusTarget({ device: d, status: 'rotating' }) }] : []),
      ...(d.status !== 'disabled' ? [{ label: 'Disable', icon: <Ban className="h-4 w-4" />, permission: 'rfid_devices.manage', onClick: () => setStatusTarget({ device: d, status: 'disabled' }), variant: 'destructive' as const }] : []),
    ]} />) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Hardware Devices" description="RFID scanners and GPS tracking units registered to this tenant." actions={canManage ? <Button onClick={() => setRegisterOpen(true)} size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700"><Plus className="h-4 w-4" />Register device</Button> : undefined} />

      <DataTable
        title="All devices"
        description={total > 0 ? `${total} device${total !== 1 ? 's' : ''}` : undefined}
        search={<div className="relative w-full"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input placeholder="Search by device ID…" className="pl-8 h-9 text-sm" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>}

        filters={<><SearchableSelect options={[{ value: '', label: 'All statuses' }, ...STATUS_OPTS]} value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} placeholder="Status" className="h-9 min-w-[120px]" />{isSuperAdmin && <TenantFilterSelect tenants={tenants} value={tenantFilter} onChange={(v) => { setTenantFilter(v); setPage(1); }} />}</>}

        filtersActive={statusFilter !== "" || tenantFilter !== ""}
        exportFilename="hardware-devices"

        selectable
        page={page} pageSize={PAGE_SIZE} total={total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)}
        columns={columns} rows={devices} rowKey={(d) => d.id} loading={query.isLoading} skeletonRows={PAGE_SIZE}
        empty={<EmptyState icon={<Cpu className="h-6 w-6" />} title="No devices registered" description={canManage ? 'Register the first device above.' : undefined} />}
      />

      <FormModal open={registerOpen} onClose={() => { setRegisterOpen(false); form.reset(); }} title="Register device" subtitle="The API key and HMAC secret are shown once after registration — store them immediately." size="md" onSubmit={form.handleSubmit((v) => registerMutation.mutate(v))} submitLabel="Register device" submitting={registerMutation.isPending}>
        <div className="space-y-4">
          <FormField label="Hardware device ID" required error={form.formState.errors.deviceId?.message} hint="Unique identifier for this physical device (e.g. RFID-001-KCB)"><Input placeholder="RFID-001-KCB" {...form.register('deviceId')} /></FormField>
          <FormField label="Assign to vehicle" error={form.formState.errors.vehicleId?.message} hint="Optional — vehicle UUID from the Fleet module"><Input placeholder="Vehicle UUID" {...form.register('vehicleId')} /></FormField>
        </div>
      </FormModal>

      {credentials && (
        <Dialog open onOpenChange={() => setCredentials(null)}>
          <DialogContent hideCloseButton className="max-w-md p-0 gap-0 overflow-hidden">
            <div className="border-b border-border bg-green-500/5 px-6 py-4"><DialogHeader><DialogTitle className="flex items-center gap-2 text-green-700"><CheckCircle2 className="h-5 w-5" />Device registered</DialogTitle><p className="text-sm text-muted-foreground">Copy these credentials now. They will <strong>not</strong> be shown again.</p></DialogHeader></div>
            <div className="space-y-3 px-6 py-5">
              {[{ label: 'Device ID', value: credentials.deviceId }, { label: 'API Key', value: credentials.apiKey }, { label: 'HMAC Secret', value: credentials.hmacSecret }].map(({ label, value }) => (
                <div key={label} className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                    <code className="flex-1 break-all font-mono text-xs">{value}</code>
                    <button onClick={() => copyToClipboard(value, label)} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"><Copy className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border bg-muted/20 px-6 py-4"><Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => setCredentials(null)}>I have saved the credentials</Button></div>
          </DialogContent>
        </Dialog>
      )}

      {statusTarget && <ConfirmDialog open onOpenChange={(o) => { if (!o) setStatusTarget(null); }} title={statusTarget.status === 'disabled' ? 'Disable device?' : statusTarget.status === 'rotating' ? 'Rotate device keys?' : 'Enable device?'} description={statusTarget.status === 'disabled' ? `${statusTarget.device.deviceId} will stop accepting scans immediately.` : statusTarget.status === 'rotating' ? `${statusTarget.device.deviceId} will be marked for key rotation.` : `${statusTarget.device.deviceId} will resume accepting scans.`} confirmLabel={statusTarget.status === 'disabled' ? 'Disable' : statusTarget.status === 'rotating' ? 'Mark for rotation' : 'Enable'} destructive={statusTarget.status === 'disabled'} onConfirm={() => statusMutation.mutate(statusTarget)} pending={statusMutation.isPending} />}
    </div>
  );
}
