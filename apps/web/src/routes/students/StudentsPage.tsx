import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { format, differenceInYears } from 'date-fns';
import { GraduationCap, Plus, Search, Pencil, Trash2 } from 'lucide-react';

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
import { listStudents, createStudent, updateStudent, deleteStudent, type Student } from '@/lib/api/students';

const PAGE_SIZE = 15;
const GENDER_OPTIONS = [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }];

const schema = z.object({
  targetTenantId: z.string().uuid().optional(),
  legalName: z.string().min(2, 'Enter full name'),
  admissionNumber: z.string().min(1, 'Enter admission number'),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  gender: z.enum(['male', 'female', 'other'] as const),
  classroom: z.string().max(40).optional().or(z.literal('')),
  birthCertificateNumber: z.string().max(32).optional().or(z.literal('')),
});
type Form = z.infer<typeof schema>;

export function StudentsPage() {
  const canCreate = usePermission('students.create');
  const { isSuperAdmin, tenants } = useTenantFilter();
  const qc = useQueryClient();
  const [search, setSearch] = useState(''); const [genderFilter, setGenderFilter] = useState(''); const [tenantFilter, setTenantFilter] = useState(''); const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false); const [editing, setEditing] = useState<Student | null>(null); const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const dSearch = useDebounce(search, 300);

  const query = useQuery({ queryKey: ['students', dSearch, genderFilter, tenantFilter, page], queryFn: () => listStudents({ q: dSearch || undefined, gender: genderFilter || undefined, tenantId: tenantFilter || undefined, page, pageSize: PAGE_SIZE }), placeholderData: (prev) => prev });
  const students = query.data?.data ?? []; const total = query.data?.meta.total ?? 0;
  const form = useForm<Form>({ resolver: zodResolver(schema), mode: 'onChange' });

  const openCreate = () => { setEditing(null); form.reset({}); setDialogOpen(true); };
  const openEdit = (s: Student) => { setEditing(s); form.reset({ legalName: s.legalName, admissionNumber: s.admissionNumber, dateOfBirth: s.dateOfBirth.slice(0, 10), gender: s.gender as any, classroom: s.classroom ?? '', birthCertificateNumber: s.birthCertificateNumber ?? '' }); setDialogOpen(true); };

  const saveMutation = useMutation({
    mutationFn: (v: Form) => editing ? updateStudent(editing.id, { legalName: v.legalName, admissionNumber: v.admissionNumber, dateOfBirth: v.dateOfBirth, gender: v.gender, classroom: v.classroom || null, birthCertificateNumber: v.birthCertificateNumber || null, flexibleAttributes: {} }) : createStudent({ legalName: v.legalName, admissionNumber: v.admissionNumber, dateOfBirth: v.dateOfBirth, gender: v.gender, classroom: v.classroom || null, birthCertificateNumber: v.birthCertificateNumber || null, flexibleAttributes: {}, targetTenantId: v.targetTenantId } as any),
    onSuccess: () => { toast.success(editing ? 'Student updated.' : 'Student enrolled.'); setDialogOpen(false); qc.invalidateQueries({ queryKey: ['students'] }); },
    onError: () => toast.error('Could not save student.'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteStudent(id),
    onSuccess: () => { toast.success('Student removed.'); setDeleteTarget(null); qc.invalidateQueries({ queryKey: ['students'] }); },
    onError: () => toast.error('Could not remove student.'),
  });

  const columns: Column<Student>[] = [
    { key: 'student', header: 'Student', width: 'w-full', exportValue: (s) => s.legalName, render: (s) => (<div><p className="font-medium">{s.legalName}</p><p className="text-xs text-muted-foreground font-mono">{s.admissionNumber}</p></div>) },
    { key: 'admission', header: 'Admission #', exportValue: (s) => s.admissionNumber, render: (s) => <span className="font-mono text-xs text-muted-foreground">{s.admissionNumber}</span> },
    { key: 'class', header: 'Class', exportValue: (s) => s.classroom ?? '', render: (s) => <span className="whitespace-nowrap text-sm text-muted-foreground">{s.classroom ?? '—'}</span> },
    { key: 'age', header: 'Age', exportValue: (s) => differenceInYears(new Date(), new Date(s.dateOfBirth)), render: (s) => <span className="whitespace-nowrap text-sm text-muted-foreground">{differenceInYears(new Date(), new Date(s.dateOfBirth))} yrs</span> },
    { key: 'gender', header: 'Gender', exportValue: (s) => s.gender, render: (s) => <span className="capitalize text-sm text-muted-foreground">{s.gender}</span> },
    { key: 'enrolled', header: 'Enrolled', exportValue: (s) => format(new Date(s.createdAt), 'd MMM yyyy'), render: (s) => <span className="whitespace-nowrap text-xs text-muted-foreground">{format(new Date(s.createdAt), 'd MMM yyyy')}</span> },
    ...(isSuperAdmin ? [{ key: 'tenant', header: 'Tenant', exportValue: (s: Student) => s.tenant?.name ?? '', render: (s: Student) => <TenantBadge tenant={s.tenant} /> }] : []),
    { key: 'actions', header: '', render: (s) => (<ActionMenu items={[{ label: 'Edit', icon: <Pencil className="h-4 w-4" />, permission: 'students.edit', onClick: () => openEdit(s) }, { label: 'Remove', icon: <Trash2 className="h-4 w-4" />, permission: 'students.delete', onClick: () => setDeleteTarget(s), variant: 'destructive' }]} />) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Students" description="Enrolled students, class assignments and guardian links." actions={canCreate ? <Button onClick={openCreate} size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700"><Plus className="h-4 w-4" />Enrol student</Button> : undefined} />

      <DataTable
        title="All students"
        description={total > 0 ? `${total} student${total !== 1 ? 's' : ''}` : undefined}
        search={<div className="relative w-full"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input placeholder="Search…" className="pl-8 h-9 text-sm" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>}
        filters={<><SearchableSelect options={[{ value: '', label: 'All genders' }, ...GENDER_OPTIONS]} value={genderFilter} onChange={(v) => { setGenderFilter(v); setPage(1); }} placeholder="Gender" className="h-9 min-w-[120px]" />{isSuperAdmin && <TenantFilterSelect tenants={tenants} value={tenantFilter} onChange={(v) => { setTenantFilter(v); setPage(1); }} />}</>}
        filtersActive={genderFilter !== '' || tenantFilter !== ''}
        selectable exportFilename="students"
        page={page} pageSize={PAGE_SIZE} total={total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)}
        columns={columns} rows={students} rowKey={(s) => s.id} loading={query.isLoading} skeletonRows={PAGE_SIZE}
        empty={<EmptyState icon={<GraduationCap className="h-6 w-6" />} title="No students found" description={canCreate ? 'Enrol the first student above.' : undefined} />}
      />

      <FormModal open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? `Edit — ${editing.legalName}` : 'Enrol student'} subtitle="Student enrolment and demographic details" onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} submitLabel={editing ? 'Save changes' : 'Enrol student'} submitting={saveMutation.isPending}>
        <div className="grid gap-4 sm:grid-cols-2">
          {!editing && <div className="sm:col-span-2"><TenantSelectorField value={form.watch('targetTenantId') ?? ''} onChange={(v) => form.setValue('targetTenantId', v)} error={form.formState.errors.targetTenantId?.message} /></div>}
          <FormField label="Full name" required error={form.formState.errors.legalName?.message}><Input placeholder="Jane Wanjiku" {...form.register('legalName')} /></FormField>
          <FormField label="Admission #" required error={form.formState.errors.admissionNumber?.message}><Input placeholder="ADM-2024-001" {...form.register('admissionNumber')} /></FormField>
          <FormField label="Date of birth" required error={form.formState.errors.dateOfBirth?.message}><Input type="date" {...form.register('dateOfBirth')} /></FormField>
          <FormField label="Gender" required error={form.formState.errors.gender?.message}><SearchableSelect options={GENDER_OPTIONS} value={form.watch('gender') ?? ''} onChange={(v) => form.setValue('gender', v as any)} placeholder="Select gender" /></FormField>
          <FormField label="Class" error={form.formState.errors.classroom?.message}><Input placeholder="Grade 5" {...form.register('classroom')} /></FormField>
          <FormField label="Birth cert #" error={form.formState.errors.birthCertificateNumber?.message}><Input placeholder="BRT-001" {...form.register('birthCertificateNumber')} /></FormField>
        </div>
      </FormModal>

      {deleteTarget && <ConfirmDialog open onOpenChange={(o) => { if (!o) setDeleteTarget(null); }} title="Remove student?" description={`${deleteTarget.legalName} (${deleteTarget.admissionNumber}) will be permanently removed.`} confirmLabel="Remove" destructive onConfirm={() => deleteMutation.mutate(deleteTarget.id)} pending={deleteMutation.isPending} />}
    </div>
  );
}
