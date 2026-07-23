import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { format, differenceInYears } from 'date-fns';
import { GraduationCap, Plus, Search, Pencil, Trash2 } from 'lucide-react';

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
import { listStudents, createStudent, updateStudent, deleteStudent, type Student } from '@/lib/api/students';

// ─── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 10;

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

// ─── Form schema ──────────────────────────────────────────────────────────────
const schema = z.object({
  legalName: z.string().min(2, 'Enter full name'),
  admissionNumber: z.string().min(1, 'Enter admission number'),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  gender: z.enum(['male', 'female', 'other'] as const),
  classroom: z.string().max(40).optional().or(z.literal('')),
  birthCertificateNumber: z.string().max(32).optional().or(z.literal('')),
});
type Form = z.infer<typeof schema>;

// ─── Component ────────────────────────────────────────────────────────────────
export function StudentsPage() {
  const canCreate = usePermission('students.create');
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);

  const dSearch = useDebounce(search, 300);

  const query = useQuery({
    queryKey: ['students', dSearch, genderFilter, page],
    queryFn: () => listStudents({ q: dSearch || undefined, gender: genderFilter || undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: (prev) => prev,
  });

  const students = query.data?.data ?? [];
  const total = query.data?.meta.total ?? 0;

  const form = useForm<Form>({ resolver: zodResolver(schema), mode: 'onChange' });

  const openCreate = () => { setEditing(null); form.reset({}); setDialogOpen(true); };
  const openEdit = (s: Student) => {
    setEditing(s);
    form.reset({
      legalName: s.legalName,
      admissionNumber: s.admissionNumber,
      dateOfBirth: s.dateOfBirth.slice(0, 10),
      gender: s.gender as 'male' | 'female' | 'other',
      classroom: s.classroom ?? '',
      birthCertificateNumber: s.birthCertificateNumber ?? '',
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: (v: Form) => {
      const input = {
        legalName: v.legalName,
        admissionNumber: v.admissionNumber,
        dateOfBirth: v.dateOfBirth,
        gender: v.gender,
        classroom: v.classroom || null,
        birthCertificateNumber: v.birthCertificateNumber || null,
        flexibleAttributes: {},
      };
      return editing ? updateStudent(editing.id, input) : createStudent(input);
    },
    onSuccess: () => {
      toast.success(editing ? 'Student updated.' : 'Student added.');
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ['students'] });
    },
    onError: () => toast.error('Could not save student.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteStudent(id),
    onSuccess: () => {
      toast.success('Student removed.');
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ['students'] });
    },
    onError: () => toast.error('Could not remove student.'),
  });

  const columns: Column<Student>[] = [
    {
      key: 'student',
      header: 'Student',
      render: (s) => (
        <div>
          <div className="font-medium">{s.legalName}</div>
          <div className="text-xs text-muted-foreground font-mono">{s.admissionNumber}</div>
        </div>
      ),
    },
    { key: 'classroom', header: 'Class', width: 'w-24', render: (s) => <span className="text-muted-foreground">{s.classroom ?? '—'}</span> },
    {
      key: 'age',
      header: 'Age',
      width: 'w-20',
      render: (s) => <span className="text-muted-foreground">{differenceInYears(new Date(), new Date(s.dateOfBirth))} yrs</span>,
    },
    { key: 'gender', header: 'Gender', width: 'w-24', render: (s) => <span className="capitalize text-muted-foreground">{s.gender}</span> },
    { key: 'enrolled', header: 'Enrolled', width: 'w-28', render: (s) => <span className="text-xs text-muted-foreground">{format(new Date(s.createdAt), 'd MMM yyyy')}</span> },
    {
      key: 'actions',
      header: '',
      width: 'w-10',
      render: (s) => (
        <ActionMenu items={[
          { label: 'Edit', icon: <Pencil className="h-4 w-4" />, permission: 'students.edit', onClick: () => openEdit(s) },
          { label: 'Remove', icon: <Trash2 className="h-4 w-4" />, permission: 'students.delete', onClick: () => setDeleteTarget(s), variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Students"
        description="Manage enrolled students, classes and guardians."
        actions={canCreate ? (
          <Button onClick={openCreate} className="gap-1.5 bg-green-600 hover:bg-green-700">
            <Plus className="h-4 w-4" /> Add student
          </Button>
        ) : undefined}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or admission #…" className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={genderFilter}
          onChange={(e) => { setGenderFilter(e.target.value); setPage(1); }}
        >
          <option value="">All genders</option>
          {GENDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <Card>
        <CardContent className="pt-4">
          <DataTable columns={columns} rows={students} rowKey={(s) => s.id} loading={query.isLoading} skeletonRows={PAGE_SIZE} empty={
            <div className="flex flex-col items-center gap-3 py-12">
              <GraduationCap className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No students found. {canCreate && 'Add the first student above.'}</p>
            </div>
          } />
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
        </CardContent>
      </Card>

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false); }}>
        <DialogContent hideCloseButton className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit — ${editing.legalName}` : 'Add student'}</DialogTitle>
            <p className="text-sm text-muted-foreground">Student enrolment details</p>
            <hr className="mt-1 border-border" />
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {([
                ['legalName', 'Full name', 'text', 'Jane Wanjiku', true],
                ['admissionNumber', 'Admission #', 'text', 'ADM-2024-001', true],
                ['dateOfBirth', 'Date of birth', 'date', '', true],
                ['classroom', 'Class', 'text', 'Grade 5', false],
                ['birthCertificateNumber', 'Birth cert #', 'text', '', false],
              ] as const).map(([field, label, type, placeholder, required]) => (
                <div key={field} className="space-y-1.5">
                  <Label>{label}{required && <span className="text-danger ml-0.5">*</span>}</Label>
                  <Input type={type} placeholder={placeholder} invalid={!!(form.formState.errors as any)[field]} {...form.register(field)} />
                  {(form.formState.errors as any)[field] && <p className="text-xs text-danger">{(form.formState.errors as any)[field]?.message}</p>}
                </div>
              ))}
              <div className="space-y-1.5">
                <Label>Gender <span className="text-danger">*</span></Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...form.register('gender')}>
                  <option value="">Select…</option>
                  {GENDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {form.formState.errors.gender && <p className="text-xs text-danger">{form.formState.errors.gender.message}</p>}
              </div>
            </div>
            <FormActions onCancel={() => setDialogOpen(false)} submitLabel={editing ? 'Save changes' : 'Add student'} pending={saveMutation.isPending} />
          </form>
        </DialogContent>
      </Dialog>

      {deleteTarget && (
        <ConfirmDialog
          open
          onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
          title="Remove student?"
          description={`${deleteTarget.legalName} (${deleteTarget.admissionNumber}) will be permanently removed.`}
          confirmLabel="Remove"
          destructive
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          pending={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
