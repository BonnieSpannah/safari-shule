import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Users, Plus, Search, Pencil, Trash2, Phone, Mail, Eye, GraduationCap, Link2 } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/ui/data-table';
import { ActionMenu } from '@/components/ui/action-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FormModal } from '@/components/ui/form-modal';
import { FormField } from '@/components/ui/form-field';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TenantSelectorField } from '@/components/ui/tenant-selector-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';

import { usePermission } from '@/hooks/usePermission';
import { useDebounce } from '@/hooks/useDebounce';
import { useTenantFilter, TenantBadge, TenantFilterSelect } from '@/hooks/useTenantFilter';
import { listParents, getParent, createParent, updateParent, deleteParent, linkStudentToParent, type Parent } from '@/lib/api/parents';
import { listStudents } from '@/lib/api/students';

const PAGE_SIZE = 15;
const GENDER_OPTIONS = [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }];

const schema = z.object({
  targetTenantId: z.string().uuid().or(z.literal('')).optional(),
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
  const [dialogOpen, setDialogOpen] = useState(false); const [editing, setEditing] = useState<Parent | null>(null); const [deleteTarget, setDeleteTarget] = useState<Parent | null>(null); const [viewTarget, setViewTarget] = useState<Parent | null>(null);
  const dSearch = useDebounce(search, 300);

  const query = useQuery({ queryKey: ['parents', dSearch, tenantFilter, page], queryFn: () => listParents({ q: dSearch || undefined, tenantId: tenantFilter || undefined, page, pageSize: PAGE_SIZE }), placeholderData: (prev) => prev });
  const parents = query.data?.data ?? []; const total = query.data?.meta.total ?? 0;
  const form = useForm<Form>({ resolver: zodResolver(schema), mode: 'onChange' });

  const openCreate = () => { setEditing(null); form.reset({}); setDialogOpen(true); };
  const openEdit = (p: Parent) => { setEditing(p); form.reset({ targetTenantId: p.tenant?.id ?? '', legalName: p.legalName, phoneE164: p.phoneE164, email: p.email ?? '', gender: p.gender as 'male' | 'female' | 'other', dateOfBirth: p.dateOfBirth.slice(0, 10), nationalId: p.nationalId ?? '', occupation: p.occupation ?? '' }); setDialogOpen(true); };

  const saveMutation = useMutation({
    mutationFn: (v: Form) => {
      const input = { legalName: v.legalName, phone: v.phoneE164, email: v.email || null, gender: v.gender, dateOfBirth: v.dateOfBirth, nationalId: v.nationalId || null, occupation: v.occupation || null, flexibleAttributes: {} };
      return editing
        ? updateParent(editing.id, { ...input, sourceTenantId: editing.tenant?.id, targetTenantId: v.targetTenantId || undefined })
        : createParent({ ...input, targetTenantId: v.targetTenantId || undefined });
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
    { key: 'actions', header: '', align: 'right' as const, width: 'w-10', render: (p) => (<ActionMenu items={[{ label: 'View', icon: <Eye className="h-4 w-4" />, permission: 'parents.view', onClick: () => setViewTarget(p) }, { label: 'Edit', icon: <Pencil className="h-4 w-4" />, permission: 'parents.edit', onClick: () => openEdit(p) }, { label: 'Remove', icon: <Trash2 className="h-4 w-4" />, permission: 'parents.delete', onClick: () => setDeleteTarget(p), variant: 'destructive' }]} />) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Parents & Guardians" description="Parent and guardian contacts linked to enrolled students." actions={canCreate ? <Button onClick={openCreate} size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700"><Plus className="h-4 w-4" />Add guardian</Button> : undefined} />

      <DataTable
        title="All guardians"
        description={total > 0 ? `${total} guardian${total !== 1 ? 's' : ''}` : undefined}
        search={<div className="relative w-full"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input placeholder="Search name or phone…" className="pl-8 h-9 text-sm" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>}

        filters={isSuperAdmin ? <TenantFilterSelect tenants={tenants} value={tenantFilter} onChange={(v) => { setTenantFilter(v); setPage(1); }} /> : undefined}

        filtersActive={tenantFilter !== ""}
        exportFilename="parents"

        selectable
        page={page} pageSize={PAGE_SIZE} total={total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)}
        columns={columns} rows={parents} rowKey={(p) => p.id} loading={query.isLoading} skeletonRows={PAGE_SIZE}
        empty={<EmptyState icon={<Users className="h-6 w-6" />} title="No guardians found" description={canCreate ? 'Add the first guardian above.' : undefined} />}
      />

      <FormModal open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? `Edit — ${editing.legalName}` : 'Add guardian'} subtitle="Parent or guardian contact details" onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} submitLabel={editing ? 'Save changes' : 'Add guardian'} submitting={saveMutation.isPending}>
        <div className="grid gap-4 sm:grid-cols-2">
          {isSuperAdmin && <div className="sm:col-span-2"><TenantSelectorField value={form.watch('targetTenantId') ?? ''} onChange={(v) => form.setValue('targetTenantId', v)} error={form.formState.errors.targetTenantId?.message} hint={editing ? 'Change to reassign this guardian to a different school' : undefined} /></div>}
          <FormField label="Full name" required error={form.formState.errors.legalName?.message}><Input placeholder="Mary Wanjiku" {...form.register('legalName')} /></FormField>
          <FormField label="Phone" required error={form.formState.errors.phoneE164?.message} hint="e.g. +254712345678"><Input type="tel" placeholder="+254712345678" {...form.register('phoneE164')} /></FormField>
          <FormField label="Email" error={form.formState.errors.email?.message}><Input type="email" placeholder="mary@example.com" {...form.register('email')} /></FormField>
          <FormField label="Date of birth" required error={form.formState.errors.dateOfBirth?.message}><Input type="date" {...form.register('dateOfBirth')} /></FormField>
          <FormField label="Gender" required error={form.formState.errors.gender?.message}><SearchableSelect options={GENDER_OPTIONS} value={form.watch('gender') ?? ''} onChange={(v) => form.setValue('gender', v as 'male' | 'female' | 'other')} placeholder="Select gender" /></FormField>
          <FormField label="National ID" error={form.formState.errors.nationalId?.message}><Input placeholder="12345678" {...form.register('nationalId')} /></FormField>
          <FormField label="Occupation" error={form.formState.errors.occupation?.message} className="sm:col-span-2"><Input placeholder="Teacher" {...form.register('occupation')} /></FormField>
        </div>
      </FormModal>

      {deleteTarget && <ConfirmDialog open onOpenChange={(o) => { if (!o) setDeleteTarget(null); }} title="Remove guardian?" description={`${deleteTarget.legalName} will be permanently removed. Student links will also be removed.`} confirmLabel="Remove" destructive onConfirm={() => deleteMutation.mutate(deleteTarget.id)} pending={deleteMutation.isPending} />}

      {viewTarget && <GuardianDetailDialog guardian={viewTarget} onClose={() => setViewTarget(null)} />}
    </div>
  );
}

function GuardianDetailDialog({ guardian, onClose }: { guardian: Parent; onClose: () => void }) {
  const qc = useQueryClient();
  const [linkSearch, setLinkSearch] = useState('');
  const [linkStudentId, setLinkStudentId] = useState('');
  const [linkRelation, setLinkRelation] = useState('guardian');
  const [showLinkForm, setShowLinkForm] = useState(false);
  const dLinkSearch = useDebounce(linkSearch, 300);

  // Always fetch fresh detail so we see updates immediately after linking
  const detail = useQuery({
    queryKey: ['parent-detail', guardian.id, guardian.tenant?.id],
    queryFn: () => getParent(guardian.id, guardian.tenant?.id),
  });
  const linked = detail.data?.students ?? guardian.students ?? [];
  const linkedIds = new Set(linked.map((l) => l.student.id));

  // Students scoped to the guardian's tenant only
  const studentsQuery = useQuery({
    queryKey: ['students-for-link', guardian.tenant?.id, dLinkSearch],
    queryFn: () => listStudents({ tenantId: guardian.tenant?.id, q: dLinkSearch || undefined, pageSize: 50 }),
    enabled: showLinkForm,
  });

  const linkMutation = useMutation({
    mutationFn: () => linkStudentToParent(guardian.id, linkStudentId, linkRelation, guardian.tenant?.id),
    onSuccess: () => {
      toast.success('Student linked.');
      setLinkStudentId('');
      setLinkSearch('');
      setShowLinkForm(false);
      qc.invalidateQueries({ queryKey: ['parent-detail', guardian.id] });
      qc.invalidateQueries({ queryKey: ['parents'] });
    },
    onError: () => toast.error('Could not link student.'),
  });

  const RELATION_OPTIONS = [
    { value: 'guardian', label: 'Guardian' },
    { value: 'mother', label: 'Mother' },
    { value: 'father', label: 'Father' },
    { value: 'other', label: 'Other' },
  ];

  const availableStudents = (studentsQuery.data?.data ?? []).filter((s) => !linkedIds.has(s.id));

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent hideCloseButton className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{guardian.legalName}</DialogTitle>
          {guardian.tenant && <p className="text-sm text-muted-foreground">{guardian.tenant.name}</p>}
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {([
              ['Phone', guardian.phoneE164, false],
              ['Gender', guardian.gender, true],
              ['Date of birth', format(new Date(guardian.dateOfBirth), 'd MMM yyyy'), false],
              ...(guardian.email ? [['Email', guardian.email, false]] : []),
              ...(guardian.nationalId ? [['National ID', guardian.nationalId, false]] : []),
              ...(guardian.occupation ? [['Occupation', guardian.occupation, false]] : []),
              ['Added', format(new Date(guardian.createdAt), 'd MMM yyyy'), false],
            ] as [string, string, boolean][]).map(([label, value, cap]) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`font-medium ${cap ? 'capitalize' : ''}`}>{value}</p>
              </div>
            ))}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Linked students</p>
              {!showLinkForm && (
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setShowLinkForm(true)}>
                  <Link2 className="h-3 w-3" /> Link student
                </Button>
              )}
            </div>

            {showLinkForm && (
              <div className="mb-3 space-y-2 rounded-md border border-border bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Only students from <span className="font-semibold text-foreground">{guardian.tenant?.name ?? 'this school'}</span> can be linked.
                </p>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Search students…" className="pl-8 h-8 text-sm" value={linkSearch} onChange={(e) => setLinkSearch(e.target.value)} autoFocus />
                </div>
                <SearchableSelect
                  options={availableStudents.map((s) => ({ value: s.id, label: `${s.legalName} (${s.admissionNumber})` }))}
                  value={linkStudentId}
                  onChange={setLinkStudentId}
                  placeholder={studentsQuery.isLoading ? 'Loading…' : availableStudents.length === 0 ? 'No unlinked students found' : 'Select a student'}
                />
                <SearchableSelect
                  options={RELATION_OPTIONS}
                  value={linkRelation}
                  onChange={setLinkRelation}
                  placeholder="Relation"
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" className="h-7" onClick={() => { setShowLinkForm(false); setLinkStudentId(''); setLinkSearch(''); }}>Cancel</Button>
                  <Button size="sm" className="h-7 bg-green-600 hover:bg-green-700" disabled={!linkStudentId || linkMutation.isPending} onClick={() => linkMutation.mutate()}>
                    {linkMutation.isPending ? 'Linking…' : 'Link'}
                  </Button>
                </div>
              </div>
            )}

            {detail.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : linked.length === 0 ? (
              <p className="text-sm text-muted-foreground">No students linked yet.</p>
            ) : (
              <div className="space-y-2">
                {linked.map(({ student }) => (
                  <div key={student.id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
                    <GraduationCap className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{student.legalName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{student.admissionNumber}{student.classroom ? ` · ${student.classroom}` : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
