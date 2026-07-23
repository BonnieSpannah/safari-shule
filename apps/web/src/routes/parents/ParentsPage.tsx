import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Users, Plus, Search, Pencil, Trash2, Phone, Mail } from 'lucide-react';

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
import { listParents, createParent, updateParent, deleteParent, type Parent } from '@/lib/api/parents';

const PAGE_SIZE = 10;

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const schema = z.object({
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
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Parent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Parent | null>(null);

  const dSearch = useDebounce(search, 300);

  const query = useQuery({
    queryKey: ['parents', dSearch, page],
    queryFn: () => listParents({ q: dSearch || undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: (prev) => prev,
  });

  const parents = query.data?.data ?? [];
  const total = query.data?.meta.total ?? 0;

  const form = useForm<Form>({ resolver: zodResolver(schema), mode: 'onChange' });

  const openCreate = () => { setEditing(null); form.reset({}); setDialogOpen(true); };
  const openEdit = (p: Parent) => {
    setEditing(p);
    form.reset({
      legalName: p.legalName,
      phoneE164: p.phoneE164,
      email: p.email ?? '',
      gender: p.gender as 'male' | 'female' | 'other',
      dateOfBirth: p.dateOfBirth.slice(0, 10),
      nationalId: p.nationalId ?? '',
      occupation: p.occupation ?? '',
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: (v: Form) => {
      const input = {
        legalName: v.legalName,
        phone: v.phoneE164,
        email: v.email || null,
        gender: v.gender,
        dateOfBirth: v.dateOfBirth,
        nationalId: v.nationalId || null,
        occupation: v.occupation || null,
        flexibleAttributes: {},
      };
      return editing ? updateParent(editing.id, input as any) : createParent(input as any);
    },
    onSuccess: () => {
      toast.success(editing ? 'Guardian updated.' : 'Guardian added.');
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ['parents'] });
    },
    onError: () => toast.error('Could not save guardian.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteParent(id),
    onSuccess: () => {
      toast.success('Guardian removed.');
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ['parents'] });
    },
    onError: () => toast.error('Could not remove guardian.'),
  });

  const columns: Column<Parent>[] = [
    {
      key: 'guardian',
      header: 'Guardian',
      render: (p) => (
        <div>
          <div className="font-medium">{p.legalName}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{p.phoneE164}</div>
          {p.email && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="h-3 w-3" />{p.email}</div>}
        </div>
      ),
    },
    { key: 'gender', header: 'Gender', width: 'w-24', render: (p) => <span className="capitalize text-muted-foreground">{p.gender}</span> },
    { key: 'occupation', header: 'Occupation', render: (p) => <span className="text-muted-foreground">{p.occupation ?? '—'}</span> },
    { key: 'nationalId', header: 'National ID', width: 'w-32', render: (p) => <span className="font-mono text-xs text-muted-foreground">{p.nationalId ?? '—'}</span> },
    { key: 'joined', header: 'Added', width: 'w-28', render: (p) => <span className="text-xs text-muted-foreground">{format(new Date(p.createdAt), 'd MMM yyyy')}</span> },
    {
      key: 'actions',
      header: '',
      width: 'w-10',
      render: (p) => (
        <ActionMenu items={[
          { label: 'Edit', icon: <Pencil className="h-4 w-4" />, permission: 'parents.edit', onClick: () => openEdit(p) },
          { label: 'Remove', icon: <Trash2 className="h-4 w-4" />, permission: 'parents.delete', onClick: () => setDeleteTarget(p), variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Parents & Guardians"
        description="Parent and guardian contacts linked to enrolled students."
        actions={canCreate ? (
          <Button onClick={openCreate} className="gap-1.5 bg-green-600 hover:bg-green-700">
            <Plus className="h-4 w-4" /> Add guardian
          </Button>
        ) : undefined}
      />

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or phone…" className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <DataTable columns={columns} rows={parents} rowKey={(p) => p.id} loading={query.isLoading} skeletonRows={PAGE_SIZE} empty={
            <div className="flex flex-col items-center gap-3 py-12">
              <Users className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No guardians found. {canCreate && 'Add the first guardian above.'}</p>
            </div>
          } />
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false); }}>
        <DialogContent hideCloseButton className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit — ${editing.legalName}` : 'Add guardian'}</DialogTitle>
            <p className="text-sm text-muted-foreground">Parent or guardian contact details</p>
            <hr className="mt-1 border-border" />
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {([
                ['legalName', 'Full name', 'text', 'Mary Wanjiku', true],
                ['phoneE164', 'Phone', 'tel', '+254712345678', true],
                ['email', 'Email', 'email', 'mary@example.com', false],
                ['dateOfBirth', 'Date of birth', 'date', '', true],
                ['nationalId', 'National ID', 'text', '12345678', false],
                ['occupation', 'Occupation', 'text', 'Teacher', false],
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
            <FormActions onCancel={() => setDialogOpen(false)} submitLabel={editing ? 'Save changes' : 'Add guardian'} pending={saveMutation.isPending} />
          </form>
        </DialogContent>
      </Dialog>

      {deleteTarget && (
        <ConfirmDialog
          open
          onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
          title="Remove guardian?"
          description={`${deleteTarget.legalName} will be permanently removed. Student links will also be removed.`}
          confirmLabel="Remove"
          destructive
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          pending={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
