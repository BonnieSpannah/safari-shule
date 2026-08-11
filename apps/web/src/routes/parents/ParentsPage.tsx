import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Users, Plus, Search, Pencil, Trash2, Phone, Mail } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/ui/data-table';
import { ActionMenu } from '@/components/ui/action-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FormModal } from '@/components/ui/form-modal';
import { FormField } from '@/components/ui/form-field';
import { EmptyState } from '@/components/ui/empty-state';
import { TenantSelectorField } from '@/components/ui/tenant-selector-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';

import { usePermission } from '@/hooks/usePermission';
import { useDebounce } from '@/hooks/useDebounce';
import { useTenantFilter, TenantBadge, TenantFilterSelect } from '@/hooks/useTenantFilter';
import { listParents, createParent, updateParent, deleteParent, type Parent } from '@/lib/api/parents';

const PAGE_SIZE = 15;
const GENDER_OPTIONS = [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }];

const schema = z.object({
  targetTenantId: z.string().uuid().optional(),
  legalName: z.string().min(2, 'Enter full name'),
  phoneE164: z.string().trim().regex(/^\+254[17]\d{8}$/, 'Must be a valid Kenyan mobile number, e.g. +254712345678'),
  email: z.string().email('Enter a valid email').or(z.literal('')).optional(),
  gender: z.enum(['male', 'female', 'other'] as const),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
  nationalId: z.string().min(4).max(20).optional().or(z.literal('')),
  occupation: z.string().max(80).optional().or(z.literal('')),
});
type Form = z.infer<typeof schema>;

export function ParentsPage() {
  const canCreate = usePermission('parents.create');
  const { isSuperAdmin, tenants } = useTenantFilter();
  const qc = useQueryClient();
  const [search, setSearch] = useState(''); const [tenantFilter, setTenantFilter] = useState(''); const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false); const [editing, setEditing] = useState<Parent | null>(null); const [deleteTarget, setDeleteTarget] = useState<Parent | null>(null);
  const dSearch = useDebounce(search, 300);

  const query = useQuery({ queryKey: ['parents', dSearch, tenantFilter, page], queryFn: () => listParents({ q: dSearch || undefined, tenantId: tenantFilter || undefined, page, pageSize: PAGE_SIZE }), placeholderData: (prev) => prev });
  const parents = query.data?.data ?? []; const total = query.data?.meta.total ?? 0;
  const form = useForm<Form>({ resolver: zodResolver(schema), mode: 'onChange' });

  const openCreate = () => { setEditing(null); form.reset({}); setDialogOpen(true); };
  const openEdit = (p: Parent) => { setEditing(p); form.reset({ legalName: p.legalName, phoneE164: p.phoneE164, email: p.email ?? '', gender: p.gender as any, dateOfBirth: p.dateOfBirth.slice(0, 10), nationalId: p.nationalId ?? '', occupation: p.occupation ?? '' }); setDialogOpen(true); };

  const saveMutation = useMutation({
    mutationFn: (v: Form) => {
      const input = { legalName: v.legalName, phone: v.phoneE164, email: v.email || null, gender: v.gender, dateOfBirth: v.dateOfBirth, nationalId: v.nationalId || null, occupation: v.occupation || null, flexibleAttributes: {} };
      return editing ? updateParent(editing.id, input as any) : createParent({ ...input, targetTenantId: v.targetTenantId } as any);
    },
    onSuccess: () => { toast.success(editing ? 'Guardian updated.' : 'Guardian added.'); setDialogOpen(false); qc.invalidateQueries({ queryKey: ['parents'] }); },
    onError: () => toast.error('Could not save guardian.'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteParent(id),
    onSuccess: () => { toast.success('Guardian removed.'); setDeleteTarget(null); qc.invalidateQueries({ queryKey: ['parents'] }); },
    onError: () => toast.error('Could not remove guardian.'),
  });

  const columns: Column<Parent>[] = [
    { key: 'guardian', header: 'Guardian', width: 'w-full', exportValue: (p) => p.legalName, render: (p) => (<div><p className="font-medium">{p.legalName}</p><div className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{p.phoneE164}{p.email && <><span className="mx-1">·</span><Mail className="h-3 w-3" />{p.email}</>}</div></div>) },
    { key: 'phone', header: 'Phone', exportValue: (p) => p.phoneE164, render: (p) => <span className="whitespace-nowrap text-sm text-muted-foreground">{p.phoneE164}</span> },
    { key: 'gender', header: 'Gender', exportValue: (p) => p.gender, render: (p) => <span className="capitalize text-sm text-muted-foreground">{p.gender}</span> },
    { key: 'occupation', header: 'Occupation', exportValue: (p) => p.occupation ?? '', render: (p) => <span className="text-sm text-muted-foreground">{p.occupation ?? '—'}</span> },
    { key: 'added', header: 'Added', exportValue: (p) => format(new Date(p.createdAt), 'd MMM yyyy'), render: (p) => <span className="whitespace-nowrap text-xs text-muted-foreground">{format(new Date(p.createdAt), 'd MMM yyyy')}</span> },
    ...(isSuperAdmin ? [{ key: 'tenant', header: 'Tenant', render: (p: Parent) => <TenantBadge tenant={p.tenant} /> }] : []),
    { key: 'actions', header: '', align: 'right' as const, width: 'w-10', render: (p) => (<ActionMenu items={[{ label: 'Edit', icon: <Pencil className="h-4 w-4" />, permission: 'parents.edit', onClick: () => openEdit(p) }, { label: 'Remove', icon: <Trash2 className="h-4 w-4" />, permission: 'parents.delete', onClick: () => setDeleteTarget(p), variant: 'destructive' }]} />) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Parents & Guardians" description="Parent and guardian contacts linked to enrolled students." actions={canCreate ? <Button onClick={openCreate} size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700"><Plus className="h-4 w-4" />Add guardian</Button> : undefined} />

      <DataTable
        title="All guardians"
        description={total > 0 ? `${total} guardian${total !== 1 ? 's' : ''}` : undefined}
        search={<div className="relative w-full"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input placeholder="Search name or phone…" className="pl-8 h-9 text-sm" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>}

        filters={<>{isSuperAdmin && <TenantFilterSelect tenants={tenants} value={tenantFilter} onChange={(v) => { setTenantFilter(v); setPage(1); }} />}</>}

        filtersActive={tenantFilter !== ""}
        exportFilename="parents"

        selectable
        page={page} pageSize={PAGE_SIZE} total={total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)}
        columns={columns} rows={parents} rowKey={(p) => p.id} loading={query.isLoading} skeletonRows={PAGE_SIZE}
        empty={<EmptyState icon={<Users className="h-6 w-6" />} title="No guardians found" description={canCreate ? 'Add the first guardian above.' : undefined} />}
      />

      <FormModal open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? `Edit — ${editing.legalName}` : 'Add guardian'} subtitle="Parent or guardian contact details" onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} submitLabel={editing ? 'Save changes' : 'Add guardian'} submitting={saveMutation.isPending}>
        <div className="grid gap-4 sm:grid-cols-2">
          {!editing && <div className="sm:col-span-2"><TenantSelectorField value={form.watch('targetTenantId') ?? ''} onChange={(v) => form.setValue('targetTenantId', v)} error={form.formState.errors.targetTenantId?.message} /></div>}
          <FormField label="Full name" required error={form.formState.errors.legalName?.message}><Input placeholder="Mary Wanjiku" {...form.register('legalName')} /></FormField>
          <FormField label="Phone" required error={form.formState.errors.phoneE164?.message} hint="e.g. +254712345678"><Input type="tel" placeholder="+254712345678" {...form.register('phoneE164')} /></FormField>
          <FormField label="Email" error={form.formState.errors.email?.message}><Input type="email" placeholder="mary@example.com" {...form.register('email')} /></FormField>
          <FormField label="Date of birth" required error={form.formState.errors.dateOfBirth?.message}><Input type="date" {...form.register('dateOfBirth')} /></FormField>
          <FormField label="Gender" required error={form.formState.errors.gender?.message}><SearchableSelect options={GENDER_OPTIONS} value={form.watch('gender') ?? ''} onChange={(v) => form.setValue('gender', v as any)} placeholder="Select gender" /></FormField>
          <FormField label="National ID" error={form.formState.errors.nationalId?.message}><Input placeholder="12345678" {...form.register('nationalId')} /></FormField>
          <FormField label="Occupation" error={form.formState.errors.occupation?.message} className="sm:col-span-2"><Input placeholder="Teacher" {...form.register('occupation')} /></FormField>
        </div>
      </FormModal>

      {deleteTarget && <ConfirmDialog open onOpenChange={(o) => { if (!o) setDeleteTarget(null); }} title="Remove guardian?" description={`${deleteTarget.legalName} will be permanently removed. Student links will also be removed.`} confirmLabel="Remove" destructive onConfirm={() => deleteMutation.mutate(deleteTarget.id)} pending={deleteMutation.isPending} />}
    </div>
  );
}
