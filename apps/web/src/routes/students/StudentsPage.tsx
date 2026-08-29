import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { format, differenceInYears } from 'date-fns';
import { GraduationCap, Plus, Search, Pencil, Trash2, Eye, Phone, Mail, X } from 'lucide-react';

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
import { FilterDropdown } from '@/components/ui/filter-dropdown';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { usePermission } from '@/hooks/usePermission';
import { useDebounce } from '@/hooks/useDebounce';
import { useClientEvents } from '@/hooks/useClientEvents';
import { useTenantFilter, TenantBadge } from '@/hooks/useTenantFilter';
import { listStudents, getStudent, createStudent, updateStudent, deleteStudent, type Student } from '@/lib/api/students';

const PAGE_SIZE = 15;
const GENDER_OPTIONS = [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }];

const schema = z.object({
  targetTenantId: z.string().uuid().or(z.literal('')).optional(),
  legalName: z.string().min(2, 'Enter full name'),
  admissionNumber: z.string().min(1, 'Enter admission number'),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  gender: z.enum(['male', 'female', 'other'] as const),
  classroom: z.string().max(40).optional().or(z.literal('')),
  birthCertificateNumber: z.string().max(32).optional().or(z.literal('')),
});
type Form = z.infer<typeof schema>;

export function StudentsPage() {
  const { emit } = useClientEvents();
  const canCreate = usePermission('students.create');
  const { isSuperAdmin, tenants } = useTenantFilter();
  const qc = useQueryClient();

  useEffect(() => {
    emit('view', { entityType: 'student_list' });
  }, [emit]);
  const [search, setSearch] = useState(''); const [genderFilter, setGenderFilter] = useState(''); const [tenantFilter, setTenantFilter] = useState(''); const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false); const [editing, setEditing] = useState<Student | null>(null); const [deleteTarget, setDeleteTarget] = useState<Student | null>(null); const [viewTarget, setViewTarget] = useState<Student | null>(null);
  const dSearch = useDebounce(search, 300);

  const query = useQuery({ queryKey: ['students', dSearch, genderFilter, tenantFilter, page], queryFn: () => listStudents({ q: dSearch || undefined, gender: genderFilter || undefined, tenantId: tenantFilter || undefined, page, pageSize: PAGE_SIZE }), placeholderData: (prev) => prev });
  const students = query.data?.data ?? []; const total = query.data?.meta.total ?? 0;
  const form = useForm<Form>({ resolver: zodResolver(schema), mode: 'onChange' });

  const openCreate = () => { setEditing(null); form.reset({}); setDialogOpen(true); };
  const openEdit = (s: Student) => { setEditing(s); form.reset({ targetTenantId: s.tenant?.id ?? '', legalName: s.legalName, admissionNumber: s.admissionNumber, dateOfBirth: s.dateOfBirth.slice(0, 10), gender: s.gender as 'male' | 'female' | 'other', classroom: s.classroom ?? '', birthCertificateNumber: s.birthCertificateNumber ?? '' }); setDialogOpen(true); };

  const saveMutation = useMutation({
    mutationFn: (v: Form) => editing
      ? updateStudent(editing.id, { legalName: v.legalName, admissionNumber: v.admissionNumber, dateOfBirth: v.dateOfBirth, gender: v.gender, classroom: v.classroom || null, birthCertificateNumber: v.birthCertificateNumber || null, flexibleAttributes: {}, sourceTenantId: editing.tenant?.id, targetTenantId: v.targetTenantId || undefined })
      : createStudent({ legalName: v.legalName, admissionNumber: v.admissionNumber, dateOfBirth: v.dateOfBirth, gender: v.gender, classroom: v.classroom || null, birthCertificateNumber: v.birthCertificateNumber || null, flexibleAttributes: {}, targetTenantId: v.targetTenantId || undefined }),
    onSuccess: () => { toast.success(editing ? 'Student updated.' : 'Student enrolled.'); setDialogOpen(false); qc.invalidateQueries({ queryKey: ['students'] }); },
    onError: () => toast.error('Could not save student.'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteStudent(id),
    onSuccess: () => { toast.success('Student removed.'); setDeleteTarget(null); qc.invalidateQueries({ queryKey: ['students'] }); },
    onError: () => toast.error('Could not remove student.'),
  });

  const columns: Column<Student>[] = [
    { key: 'student', header: 'Student', width: 'w-full', sortable: true, exportValue: (s) => s.legalName, render: (s) => (<div><p className="font-medium">{s.legalName}</p><p className="text-xs text-muted-foreground font-mono">{s.admissionNumber}</p></div>) },
    { key: 'admission', header: 'Admission #', exportValue: (s) => s.admissionNumber, render: (s) => <span className="font-mono text-xs text-muted-foreground">{s.admissionNumber}</span> },
    { key: 'class', header: 'Class', sortable: true, exportValue: (s) => s.classroom ?? '', render: (s) => <span className="whitespace-nowrap text-sm text-muted-foreground">{s.classroom ?? '—'}</span> },
    { key: 'age', header: 'Age', exportValue: (s) => differenceInYears(new Date(), new Date(s.dateOfBirth)), render: (s) => <span className="whitespace-nowrap text-sm text-muted-foreground">{differenceInYears(new Date(), new Date(s.dateOfBirth))} yrs</span> },
    { key: 'gender', header: 'Gender', exportValue: (s) => s.gender, render: (s) => <span className="capitalize text-sm text-muted-foreground">{s.gender}</span> },
    { key: 'enrolled', header: 'Enrolled', sortable: true, exportValue: (s) => format(new Date(s.createdAt), 'd MMM yyyy'), render: (s) => <span className="whitespace-nowrap text-xs text-muted-foreground">{format(new Date(s.createdAt), 'd MMM yyyy')}</span> },
    ...(isSuperAdmin ? [{ key: 'tenant', header: 'Tenant', exportValue: (s: Student) => s.tenant?.name ?? '', render: (s: Student) => <TenantBadge tenant={s.tenant} /> }] : []),
    { key: 'actions', header: '', render: (s) => (<ActionMenu items={[{ label: 'View', icon: <Eye className="h-4 w-4" />, permission: 'students.view', onClick: () => setViewTarget(s) }, { label: 'Edit', icon: <Pencil className="h-4 w-4" />, permission: 'students.edit', onClick: () => openEdit(s) }, { label: 'Remove', icon: <Trash2 className="h-4 w-4" />, permission: 'students.delete', onClick: () => setDeleteTarget(s), variant: 'destructive' }]} />) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Students" description="Enrolled students, class assignments and guardian links." actions={canCreate ? <Button onClick={openCreate} size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700"><Plus className="h-4 w-4" />Enrol student</Button> : undefined} />

      {query.error && (
        <ErrorState
          title="Failed to load students"
          error={query.error}
          onRetry={() => query.refetch()}
        />
      )}

      {!query.error && (
      <DataTable
        title="All students"
        description={total > 0 ? `${total} student${total !== 1 ? 's' : ''}` : undefined}
        search={<div className="relative w-full"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input placeholder="Search…" className="pl-8 h-9 text-sm" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>}
        filters={<div className="flex flex-wrap items-center gap-2"><FilterDropdown label="Gender" options={GENDER_OPTIONS} selected={genderFilter ? [genderFilter] : []} onChange={(v) => { setGenderFilter(v[v.length-1] ?? ''); setPage(1); }} />{isSuperAdmin && <FilterDropdown label="Tenant" options={tenants.map((t) => ({ value: t.id, label: t.name }))} selected={tenantFilter ? [tenantFilter] : []} onChange={(v) => { setTenantFilter(v[v.length-1] ?? ''); setPage(1); }} />}{(genderFilter || tenantFilter) && <button type="button" onClick={() => { setGenderFilter(''); setTenantFilter(''); setPage(1); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><X className="h-3 w-3" />Clear</button>}</div>}
        filtersActive={genderFilter !== '' || tenantFilter !== ''}
        selectable exportFilename="students"
        page={page} pageSize={PAGE_SIZE} total={total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)}
        columns={columns} rows={students} rowKey={(s) => s.id} loading={query.isLoading} skeletonRows={PAGE_SIZE}
        empty={<EmptyState icon={<GraduationCap className="h-6 w-6" />} title="No students found" description={canCreate ? 'Enrol the first student above.' : undefined} />}
      />
      )}

      <FormModal open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? `Edit — ${editing.legalName}` : 'Enrol student'} subtitle="Student enrolment and demographic details" onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} submitLabel={editing ? 'Save changes' : 'Enrol student'} submitting={saveMutation.isPending}>
        <div className="grid gap-4 sm:grid-cols-2">
          {isSuperAdmin && <div className="sm:col-span-2"><TenantSelectorField value={form.watch('targetTenantId') ?? ''} onChange={(v) => form.setValue('targetTenantId', v)} error={form.formState.errors.targetTenantId?.message} hint={editing ? 'Change to reassign this student to a different school' : undefined} /></div>}
          <FormField label="Full name" required error={form.formState.errors.legalName?.message}><Input placeholder="Jane Wanjiku" {...form.register('legalName')} /></FormField>
          <FormField label="Admission #" required error={form.formState.errors.admissionNumber?.message}><Input placeholder="ADM-2024-001" {...form.register('admissionNumber')} /></FormField>
          <FormField label="Date of birth" required error={form.formState.errors.dateOfBirth?.message} hint="YYYY-MM-DD"><Input type="date" {...form.register('dateOfBirth')} /></FormField>
          <FormField label="Gender" required error={form.formState.errors.gender?.message}><SearchableSelect options={GENDER_OPTIONS} value={form.watch('gender') ?? ''} onChange={(v) => form.setValue('gender', v as 'male' | 'female' | 'other')} placeholder="Select gender" /></FormField>
          <FormField label="Class" error={form.formState.errors.classroom?.message}><Input placeholder="Grade 5" {...form.register('classroom')} /></FormField>
          <FormField label="Birth cert #" error={form.formState.errors.birthCertificateNumber?.message}><Input placeholder="BRT-001" {...form.register('birthCertificateNumber')} /></FormField>
        </div>
      </FormModal>

      {deleteTarget && <ConfirmDialog open onOpenChange={(o) => { if (!o) setDeleteTarget(null); }} title="Remove student?" description={`${deleteTarget.legalName} (${deleteTarget.admissionNumber}) will be permanently removed.`} confirmLabel="Remove" destructive onConfirm={() => deleteMutation.mutate(deleteTarget.id)} pending={deleteMutation.isPending} />}

      {viewTarget && <StudentDetailDialog student={viewTarget} onClose={() => setViewTarget(null)} />}
    </div>
  );
}

function StudentDetailDialog({ student, onClose }: { student: Student; onClose: () => void }) {
  const detail = useQuery({
    queryKey: ['student-detail', student.id, student.tenant?.id],
    queryFn: () => getStudent(student.id, student.tenant?.id),
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent hideCloseButton className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{student.legalName}</DialogTitle>
          <p className="text-sm text-muted-foreground font-mono">{student.admissionNumber}</p>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {([
              ['Class', student.classroom ?? '—', false],
              ['Gender', student.gender, true],
              ['Date of birth', format(new Date(student.dateOfBirth), 'd MMM yyyy'), false],
              ['Age', `${differenceInYears(new Date(), new Date(student.dateOfBirth))} yrs`, false],
              ['Enrolled', format(new Date(student.createdAt), 'd MMM yyyy'), false],
              ...(student.birthCertificateNumber ? [['Birth cert #', student.birthCertificateNumber, false]] : []),
              ...(student.tenant ? [['School', student.tenant.name, false]] : []),
            ] as [string, string, boolean][]).map(([label, value, cap]) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`font-medium ${cap ? 'capitalize' : ''}`}>{value}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Guardians</p>
            {detail.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (detail.data?.parents?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No guardians linked yet.</p>
            ) : (
              <div className="space-y-2">
                {detail.data?.parents.map(({ parent }) => (
                  <div key={parent.id} className="flex items-start gap-3 rounded-md border border-border px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{parent.legalName}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{parent.phoneE164}</span>
                        {parent.email && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="h-3 w-3" />{parent.email}</span>}
                      </div>
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
