import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { FileText, Search, Building2, Eye, X } from 'lucide-react';
import { FilterDropdown } from '@/components/ui/filter-dropdown';

import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useDebounce } from '@/hooks/useDebounce';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { listAuditLogs, type AuditEntry } from '@/lib/api/audit';

const PAGE_SIZE = 15;

// e.g. "rfid_device.status_change" → "RFID Device · Status Change"
const WORD_OVERRIDES: Record<string, string> = {
  rfid: 'RFID', id: 'ID', sos: 'SOS', sms: 'SMS', otp: 'OTP', api: 'API',
};

function humanizeAction(raw: string): { entity: string; action: string } {
  const [entityPart = '', actionPart = ''] = raw.split('.');
  const capitalize = (s: string) =>
    s.split('_').map((w) => WORD_OVERRIDES[w.toLowerCase()] ?? (w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
  return { entity: capitalize(entityPart), action: capitalize(actionPart) };
}

const ACTION_PREFIXES: Record<string, string> = {
  'tenant.': 'bg-violet-500/10 text-violet-700',
  'student.': 'bg-emerald-500/10 text-emerald-700',
  'staff.': 'bg-violet-500/10 text-violet-600',
  'vehicle.': 'bg-amber-500/10 text-amber-700',
  'route.': 'bg-sky-500/10 text-sky-700',
  'trip.': 'bg-blue-500/10 text-blue-700',
  'invitation.': 'bg-pink-500/10 text-pink-700',
  'rfid_device.': 'bg-orange-500/10 text-orange-700',
};

function ActionBadge({ action }: { action: string }) {
  const cls = Object.entries(ACTION_PREFIXES).find(([k]) => action.startsWith(k))?.[1] ?? 'bg-zinc-500/10 text-zinc-600';
  const { entity, action: verb } = humanizeAction(action);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      <span className="font-semibold">{entity}</span>
      <span className="opacity-70">·</span>
      <span>{verb}</span>
    </span>
  );
}

const ENTITY_TYPES = ['tenant', 'student', 'staff', 'vehicle', 'route', 'trip', 'invitation', 'rfid_device', 'parent', 'user'];

// ─── Detail modal ─────────────────────────────────────────────────────────────

function DiffBlock({ label, data }: { label: string; data: Record<string, unknown> | null }) {
  if (!data) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 text-[11px] leading-relaxed">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function AuditDetailModal({ entry, onClose }: { entry: AuditEntry; onClose: () => void }) {
  const { entity, action: verb } = humanizeAction(entry.action);
  const hasDiff = entry.before ?? entry.after;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent hideCloseButton className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ActionBadge action={entry.action} />
            <span className="text-base font-semibold">{entity} — {verb}</span>
          </DialogTitle>
          <hr className="mt-1 border-border" />
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Entity type', value: entry.entityType },
              { label: 'Entity ID', value: entry.entityId ?? '—', mono: true },
              { label: 'Actor', value: entry.actor ? `${entry.actor.fullName} (${entry.actor.email})` : 'System' },
              { label: 'Tenant', value: entry.tenant ? `${entry.tenant.name} (${entry.tenant.slug})` : '—' },
              { label: 'IP address', value: entry.ipAddress ?? '—', mono: true },
              { label: 'When', value: `${format(new Date(entry.createdAt), 'd MMM yyyy, HH:mm:ss')} · ${formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}` },
              { label: 'Request ID', value: entry.requestId ?? '—', mono: true },
              { label: 'User agent', value: entry.userAgent ?? '—' },
            ].map(({ label, value, mono }) => (
              <div key={label} className="space-y-0.5">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`break-all text-sm ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Diff */}
          {hasDiff && (
            <div className="space-y-3 border-t border-border pt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Change diff</p>
              <DiffBlock label="Before" data={entry.before} />
              <DiffBlock label="After" data={entry.after} />
            </div>
          )}

          {!hasDiff && (
            <p className="text-xs text-muted-foreground italic border-t border-border pt-3">
              No before/after snapshot recorded for this action type.
            </p>
          )}
        </div>

        <div className="flex justify-end border-t border-border pt-3 mt-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AuditPage() {
  const { isSuperAdmin, tenants } = useTenantFilter();
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  const dSearch = useDebounce(search, 300);

  const query = useQuery({
    queryKey: ['audit', dSearch, entityFilter, tenantFilter, page],
    queryFn: () => listAuditLogs({
      q: dSearch || undefined,
      entityType: entityFilter || undefined,
      tenantId: tenantFilter || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    placeholderData: (prev) => prev,
  });

  const entries = query.data?.data ?? [];
  const total = query.data?.meta.total ?? 0;

  const columns: Column<AuditEntry>[] = [
    {
      key: 'action',
      header: 'Action',
      width: 'w-full',
      exportValue: (e) => { const { entity, action } = humanizeAction(e.action); return `${entity} — ${action}`; },
      render: (e) => <ActionBadge action={e.action} />,
    },
    {
      key: 'actor',
      header: 'Actor',
      exportValue: (e) => e.actor ? `${e.actor.fullName} (${e.actor.email})` : 'System',
      render: (e) => (
        <div>
          <div className="text-sm font-medium">{e.actor?.fullName ?? <span className="text-muted-foreground">System</span>}</div>
          {e.actor?.email && <div className="text-xs text-muted-foreground">{e.actor.email}</div>}
        </div>
      ),
    },
    ...(isSuperAdmin ? [{
      key: 'tenant',
      header: 'Tenant',
      exportValue: (e: AuditEntry) => e.tenant?.name ?? '',
      render: (e: AuditEntry) => e.tenant
        ? <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Building2 className="h-3 w-3" />{e.tenant.name}</span>
        : <span className="text-muted-foreground">—</span>,
    }] : []),
    {
      key: 'entity',
      header: 'Entity',
      exportValue: (e) => `${e.entityType}${e.entityId ? ` (${e.entityId})` : ''}`,
      render: (e) => (
        <div>
          <span className="text-xs capitalize text-muted-foreground">{e.entityType}</span>
          {e.entityId && <div className="font-mono text-[10px] text-muted-foreground/70 truncate max-w-[120px]">{e.entityId}</div>}
        </div>
      ),
    },
    { key: 'ip', header: 'IP', exportValue: (e) => e.ipAddress ?? '', render: (e) => <span className="font-mono text-xs text-muted-foreground">{e.ipAddress ?? '—'}</span> },
    {
      key: 'when',
      header: 'When',
      exportValue: (e) => format(new Date(e.createdAt), 'd MMM yyyy, HH:mm'),
      render: (e) => (
        <div>
          <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}</div>
          <div className="text-[10px] text-muted-foreground/70">{format(new Date(e.createdAt), 'd MMM yyyy, HH:mm')}</div>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (e) => (
        <button
          onClick={() => setSelectedEntry(e)}
          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="View full details"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit log"
        description={isSuperAdmin ? 'All tenants — immutable, timestamped record of every mutation.' : 'Every mutation, sign-in and sensitive read — immutable, timestamped.'}
      />

      <DataTable
        title="Audit log"
        description={total > 0 ? `${total} entr${total !== 1 ? 'ies' : 'y'}` : undefined}
        search={<div className="relative w-full"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input placeholder="Search actions…" className="pl-8 h-9 text-sm" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>}

        filters={<div className="flex flex-wrap items-center gap-2"><FilterDropdown label="Entity" options={ENTITY_TYPES.map((t) => ({ value: t, label: t.replace('_', ' ') }))} selected={entityFilter ? [entityFilter] : []} onChange={(v) => { setEntityFilter(v[v.length-1] ?? ''); setPage(1); }} />{isSuperAdmin && <FilterDropdown label="Tenant" options={tenants.map((t) => ({ value: t.id, label: t.name }))} selected={tenantFilter ? [tenantFilter] : []} onChange={(v) => { setTenantFilter(v[v.length-1] ?? ''); setPage(1); }} />}{(entityFilter || tenantFilter) && <button type="button" onClick={() => { setEntityFilter(''); setTenantFilter(''); setPage(1); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><X className="h-3 w-3" />Clear</button>}</div>}

        filtersActive={entityFilter !== "" || tenantFilter !== ""}
        exportFilename="audit-log"

        selectable
        page={page} pageSize={PAGE_SIZE} total={total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)}
        columns={columns} rows={entries} rowKey={(e) => e.id} loading={query.isLoading} skeletonRows={PAGE_SIZE}
        empty={<EmptyState icon={<FileText className="h-6 w-6" />} title="No audit entries found" />}
      />

      {selectedEntry && <AuditDetailModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />}
    </div>
  );
}
