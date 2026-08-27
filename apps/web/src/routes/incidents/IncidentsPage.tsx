import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { AlertTriangle, Check, CheckCheck, Search } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/ui/data-table';
import { ActionMenu } from '@/components/ui/action-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { FormModal } from '@/components/ui/form-modal';
import { FormField } from '@/components/ui/form-field';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDebounce } from '@/hooks/useDebounce';
import {
  acknowledgeIncident,
  getIncident,
  listIncidentNotifications,
  listIncidents,
  resolveIncident,
  type Incident,
} from '@/lib/api/incidents';
import { trackClientEvent } from '@/lib/audit-events';

const PAGE_SIZE = 15;

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'reported', label: 'Reported' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'resolved', label: 'Resolved' },
];

const resolveSchema = z.object({
  resolution: z.string().trim().min(2, 'Resolution is required').max(500, 'Use 500 characters or less'),
});

type ResolveForm = z.infer<typeof resolveSchema>;

function StatusBadge({ status }: { status: Incident['status'] }) {
  const styles: Record<Incident['status'], string> = {
    reported: 'bg-red-500/10 text-red-700',
    acknowledged: 'bg-amber-500/10 text-amber-700',
    resolved: 'bg-emerald-500/10 text-emerald-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export function IncidentsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [resolving, setResolving] = useState<Incident | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const debounced = useDebounce(search, 300);

  const form = useForm<ResolveForm>({
    resolver: zodResolver(resolveSchema),
    mode: 'onChange',
    defaultValues: { resolution: '' },
  });

  useEffect(() => {
    trackClientEvent({ kind: 'view', resource: 'incidents', path: '/incidents' });
  }, []);

  const incidentsQuery = useQuery({
    queryKey: ['incidents', debounced, statusFilter, page],
    queryFn: () =>
      listIncidents({
        q: debounced || undefined,
        status: statusFilter || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: (prev) => prev,
    refetchInterval: 15_000,
  });

  const incidents = incidentsQuery.data?.data ?? [];
  const total = incidentsQuery.data?.meta.total ?? 0;

  const incidentDetailQuery = useQuery({
    queryKey: ['incident-detail', selectedIncidentId],
    queryFn: () => getIncident(selectedIncidentId!),
    enabled: !!selectedIncidentId,
  });

  const notificationsQuery = useQuery({
    queryKey: ['incident-notifications', selectedIncidentId],
    queryFn: () => listIncidentNotifications(selectedIncidentId!),
    enabled: !!selectedIncidentId,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) => acknowledgeIncident(id),
    onSuccess: () => {
      toast.success('Incident acknowledged.');
      qc.invalidateQueries({ queryKey: ['incidents'] });
    },
    onError: () => toast.error('Could not acknowledge incident.'),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, resolution }: { id: string; resolution: string }) => resolveIncident(id, resolution),
    onSuccess: () => {
      toast.success('Incident resolved.');
      setResolving(null);
      form.reset({ resolution: '' });
      qc.invalidateQueries({ queryKey: ['incidents'] });
    },
    onError: () => toast.error('Could not resolve incident.'),
  });

  const columns: Column<Incident>[] = [
    {
      key: 'kind',
      header: 'Incident',
      width: 'w-full',
      exportValue: (i) => `${i.kind} (${i.severity})`,
      render: (i) => (
        <div>
          <p className="font-medium capitalize">{i.kind.replace('_', ' ')}</p>
          <p className="text-xs text-muted-foreground capitalize">{i.severity}</p>
        </div>
      ),
    },
    {
      key: 'trip',
      header: 'Trip',
      exportValue: (i) => i.tripId,
      render: (i) => <span className="font-mono text-xs text-muted-foreground">{i.tripId.slice(0, 8)}...</span>,
    },
    {
      key: 'status',
      header: 'Status',
      exportValue: (i) => i.status,
      render: (i) => <StatusBadge status={i.status} />,
    },
    {
      key: 'occurredAt',
      header: 'Occurred',
      exportValue: (i) => i.occurredAt,
      render: (i) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(i.occurredAt), { addSuffix: true })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 'w-10',
      render: (i) => (
        <ActionMenu
          items={[
            {
              label: 'View details',
              permission: 'incidents.view',
              onClick: () => setSelectedIncidentId(i.id),
            },
            {
              label: 'Acknowledge',
              icon: <Check className="h-4 w-4" />,
              permission: 'incidents.acknowledge',
              disabled: i.status !== 'reported',
              onClick: () => acknowledgeMutation.mutate(i.id),
            },
            {
              label: 'Resolve',
              icon: <CheckCheck className="h-4 w-4" />,
              permission: 'incidents.resolve',
              disabled: i.status === 'resolved',
              onClick: () => setResolving(i),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Incidents"
        description="Track SOS and operational incidents. Auto-refreshes every 15 seconds."
      />

      {incidentsQuery.error && (
        <ErrorState
          title="Failed to load incidents"
          error={incidentsQuery.error}
          onRetry={() => incidentsQuery.refetch()}
        />
      )}

      {!incidentsQuery.error && (
      <DataTable
        title="Incident queue"
        description={total > 0 ? `${total} incident${total !== 1 ? 's' : ''}` : undefined}
        search={
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by trip ID, kind..."
              className="pl-8 h-9 text-sm"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        }
        filters={
          <SearchableSelect
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
            placeholder="Status"
            className="h-9 min-w-[140px]"
          />
        }
        filtersActive={statusFilter !== ''}
        exportFilename="incidents"
        selectable
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
        columns={columns}
        rows={incidents}
        rowKey={(i) => i.id}
        loading={incidentsQuery.isLoading}
        skeletonRows={PAGE_SIZE}
        empty={
          <EmptyState
            icon={<AlertTriangle className="h-6 w-6" />}
            title="No incidents found"
            description="Reported, acknowledged and resolved incidents will appear here."
          />
        }
      />
      )}

      {selectedIncidentId && (
        <Card>
          <CardHeader>
            <CardTitle>Incident detail</CardTitle>
            <CardDescription>Resolution context and SOS SMS delivery log.</CardDescription>
          </CardHeader>
          <CardContent>
            {incidentDetailQuery.isLoading ? (
              <div className="text-sm text-muted-foreground">Loading incident detail...</div>
            ) : incidentDetailQuery.isError ? (
              <div className="text-sm text-red-600">Could not load incident detail.</div>
            ) : incidentDetailQuery.data ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Incident ID</p>
                    <p className="font-mono text-xs">{incidentDetailQuery.data.id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Trip</p>
                    <p className="text-sm">{incidentDetailQuery.data.trip?.route?.name ?? incidentDetailQuery.data.tripId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Vehicle</p>
                    <p className="text-sm">{incidentDetailQuery.data.trip?.vehicle?.registration ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Description</p>
                    <p className="text-sm">{incidentDetailQuery.data.description ?? '—'}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">SMS log</p>
                  {notificationsQuery.isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading SMS log...</p>
                  ) : notificationsQuery.isError ? (
                    <p className="text-sm text-red-600">Could not load SMS log.</p>
                  ) : (notificationsQuery.data?.messages.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground">No SMS records in the incident time window.</p>
                  ) : (
                    <div className="space-y-2">
                      {notificationsQuery.data?.messages.map((msg) => (
                        <div key={msg.id} className="rounded-md border border-border px-3 py-2 text-xs">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-mono">{msg.to}</span>
                            <span className="uppercase tracking-wide text-muted-foreground">{msg.status}</span>
                          </div>
                          <div className="mt-1 text-muted-foreground">
                            {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                          </div>
                          {msg.error && <div className="mt-1 text-red-600">{msg.error}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      <FormModal
        open={!!resolving}
        onClose={() => {
          setResolving(null);
          form.reset({ resolution: '' });
        }}
        title={resolving ? `Resolve incident ${resolving.id.slice(0, 8)}` : 'Resolve incident'}
        subtitle="Add short resolution notes for the operations timeline."
        size="md"
        onSubmit={form.handleSubmit((v) => {
          if (!resolving) return;
          resolveMutation.mutate({ id: resolving.id, resolution: v.resolution });
        })}
        submitLabel="Resolve incident"
        submitting={resolveMutation.isPending}
      >
        <FormField label="Resolution note" required error={form.formState.errors.resolution?.message}>
          <Input placeholder="Describe how this was resolved" {...form.register('resolution')} />
        </FormField>
      </FormModal>
    </div>
  );
}
