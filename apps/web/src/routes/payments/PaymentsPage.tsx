import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatDistanceToNow } from 'date-fns';
import { CreditCard, Plus, Search, X } from 'lucide-react';
import { FilterDropdown } from '@/components/ui/filter-dropdown';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FormModal } from '@/components/ui/form-modal';
import { FormField } from '@/components/ui/form-field';
import { useDebounce } from '@/hooks/useDebounce';
import { TenantBadge, useTenantFilter } from '@/hooks/useTenantFilter';
import {
  initiateFuelPayment,
  initiateRepairPayment,
  listPayments,
  type PaymentTransaction,
} from '@/lib/api/payments';
import { trackClientEvent } from '@/lib/audit-events';
import { usePermission } from '@/hooks/usePermission';

const PAGE_SIZE = 15;

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'initiated', label: 'Initiated' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PURPOSE_OPTIONS = [
  { value: '', label: 'All purposes' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'repair', label: 'Repair' },
];

const initiateSchema = z
  .object({
    purpose: z.enum(['fuel', 'repair'] as const),
    fuelLogId: z.string().uuid().optional(),
    repairLogId: z.string().uuid().optional(),
    amountKes: z.coerce.number().int().positive('Amount must be a positive integer'),
    phoneE164: z
      .string()
      .trim()
      .regex(/^\+254[17]\d{8}$/, 'Use a valid Kenyan mobile number, e.g. +254712345678'),
    description: z.string().trim().min(3, 'Description is required').max(120, 'Use 120 characters or less'),
  })
  .superRefine((v, ctx) => {
    if (v.purpose === 'fuel' && !v.fuelLogId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Fuel log ID is required', path: ['fuelLogId'] });
    }
    if (v.purpose === 'repair' && !v.repairLogId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Repair log ID is required', path: ['repairLogId'] });
    }
  });

type InitiateForm = z.infer<typeof initiateSchema>;

function StatusBadge({ status }: { status: PaymentTransaction['status'] }) {
  const cls: Record<PaymentTransaction['status'], string> = {
    initiated: 'bg-blue-500/10 text-blue-700',
    succeeded: 'bg-emerald-500/10 text-emerald-700',
    failed: 'bg-red-500/10 text-red-700',
    cancelled: 'bg-zinc-500/10 text-zinc-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cls[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function formatKes(amount: number) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(amount);
}

export function PaymentsPage() {
  const qc = useQueryClient();
  const canInitiate = usePermission('payments.initiate');
  const { isSuperAdmin, tenants } = useTenantFilter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [purposeFilter, setPurposeFilter] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [page, setPage] = useState(1);
  const [initiateOpen, setInitiateOpen] = useState(false);
  const debounced = useDebounce(search, 300);

  const form = useForm<InitiateForm>({
    resolver: zodResolver(initiateSchema),
    mode: 'onChange',
    defaultValues: {
      purpose: 'fuel',
      amountKes: 0,
      phoneE164: '+2547',
      description: '',
    },
  });

  useEffect(() => {
    trackClientEvent({ kind: 'view', resource: 'payments', path: '/payments' });
  }, []);

  const paymentsQuery = useQuery({
    queryKey: ['payments', debounced, statusFilter, purposeFilter, tenantFilter, page],
    queryFn: () =>
      listPayments({
        q: debounced || undefined,
        status: statusFilter || undefined,
        purpose: purposeFilter || undefined,
        tenantId: tenantFilter || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: (prev) => prev,
    refetchInterval: 20_000,
  });

  const payments = paymentsQuery.data?.data ?? [];
  const total = paymentsQuery.data?.meta.total ?? 0;

  const initiateMutation = useMutation({
    mutationFn: async (v: InitiateForm) => {
      if (v.purpose === 'fuel') {
        return initiateFuelPayment({
          fuelLogId: v.fuelLogId!,
          amountKes: v.amountKes,
          phoneE164: v.phoneE164,
          description: v.description,
        });
      }
      return initiateRepairPayment({
        repairLogId: v.repairLogId!,
        amountKes: v.amountKes,
        phoneE164: v.phoneE164,
        description: v.description,
      });
    },
    onSuccess: () => {
      toast.success('M-Pesa STK request sent.');
      setInitiateOpen(false);
      form.reset({
        purpose: 'fuel',
        amountKes: 0,
        phoneE164: '+2547',
        description: '',
      });
      qc.invalidateQueries({ queryKey: ['payments'] });
      trackClientEvent({
        kind: 'bulk_action',
        resource: 'payments',
        path: '/payments',
        payload: { action: 'stk_initiate' },
      });
    },
    onError: () => toast.error('Could not initiate STK payment.'),
  });

  const columns: Column<PaymentTransaction>[] = [
    {
      key: 'purpose',
      header: 'Purpose',
      width: 'w-full',
      sortable: true,
      exportValue: (p) => p.purpose,
      render: (p) => (
        <div>
          <p className="font-medium capitalize">{p.purpose}</p>
          <p className="text-xs text-muted-foreground">{p.accountReference}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      exportValue: (p) => p.amountKes,
      render: (p) => <span className="whitespace-nowrap font-medium">{formatKes(p.amountKes)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      exportValue: (p) => p.status,
      render: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: 'phone',
      header: 'Phone',
      exportValue: (p) => p.phoneE164,
      render: (p) => <span className="font-mono text-xs text-muted-foreground">{p.phoneE164}</span>,
    },
    {
      key: 'receipt',
      header: 'Receipt',
      exportValue: (p) => p.mpesaReceiptNumber ?? '',
      render: (p) => <span className="font-mono text-xs text-muted-foreground">{p.mpesaReceiptNumber ?? 'Pending'}</span>,
    },
    {
      key: 'initiatedAt',
      header: 'Initiated',
      sortable: true,
      exportValue: (p) => p.initiatedAt,
      render: (p) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(p.initiatedAt), { addSuffix: true })}
        </span>
      ),
    },
    ...(isSuperAdmin
      ? [
          {
            key: 'tenant',
            header: 'Tenant',
            render: (p: PaymentTransaction) => <TenantBadge tenant={p.tenant} />,
          } satisfies Column<PaymentTransaction>,
        ]
      : []),
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payments"
        description="M-Pesa fuel and repair transactions. Auto-refreshes every 20 seconds."
        actions={
          canInitiate ? (
            <Button
              onClick={() => setInitiateOpen(true)}
              size="sm"
              className="gap-1.5 bg-green-600 hover:bg-green-700"
            >
              <Plus className="h-4 w-4" />
              Initiate STK
            </Button>
          ) : undefined
        }
      />

      {paymentsQuery.error && (
        <ErrorState
          title="Failed to load payments"
          error={paymentsQuery.error}
          onRetry={() => paymentsQuery.refetch()}
        />
      )}

      {!paymentsQuery.error && (
      <DataTable
        title="Transaction history"
        description={total > 0 ? `${total} transaction${total !== 1 ? 's' : ''}` : undefined}
        search={
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by phone, receipt, reference..."
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
          <div className="flex flex-wrap items-center gap-2">
            <FilterDropdown label="Status" options={STATUS_OPTIONS.filter(o => o.value)} selected={statusFilter ? [statusFilter] : []} onChange={(v) => { setStatusFilter(v[v.length-1] ?? ''); setPage(1); }} />
            <FilterDropdown label="Purpose" options={PURPOSE_OPTIONS.filter(o => o.value)} selected={purposeFilter ? [purposeFilter] : []} onChange={(v) => { setPurposeFilter(v[v.length-1] ?? ''); setPage(1); }} />
            {isSuperAdmin && <FilterDropdown label="Tenant" options={tenants.map((t) => ({ value: t.id, label: t.name }))} selected={tenantFilter ? [tenantFilter] : []} onChange={(v) => { setTenantFilter(v[v.length-1] ?? ''); setPage(1); }} />}
            {(statusFilter || purposeFilter || tenantFilter) && <button type="button" onClick={() => { setStatusFilter(''); setPurposeFilter(''); setTenantFilter(''); setPage(1); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><X className="h-3 w-3" />Clear</button>}
          </div>
        }
        filtersActive={statusFilter !== '' || purposeFilter !== '' || tenantFilter !== ''}
        exportFilename="payments"
        selectable
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
        columns={columns}
        rows={payments}
        rowKey={(p) => p.id}
        loading={paymentsQuery.isLoading}
        skeletonRows={PAGE_SIZE}
        empty={
          <EmptyState
            icon={<CreditCard className="h-6 w-6" />}
            title="No transactions found"
            description="Initiated M-Pesa payments will appear here."
          />
        }
      />
      )}

      <FormModal
        open={initiateOpen}
        onClose={() => {
          setInitiateOpen(false);
          form.reset({ purpose: 'fuel', amountKes: 0, phoneE164: '+2547', description: '' });
        }}
        title="Initiate M-Pesa STK"
        subtitle="Trigger a fuel or repair payment request to a phone number."
        size="md"
        onSubmit={form.handleSubmit((v) => initiateMutation.mutate(v))}
        submitLabel="Send STK request"
        submitting={initiateMutation.isPending}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Purpose"
            required
            error={form.formState.errors.purpose?.message}
            className="sm:col-span-2"
          >
            <SearchableSelect
              options={[
                { value: 'fuel', label: 'Fuel' },
                { value: 'repair', label: 'Repair' },
              ]}
              value={form.watch('purpose')}
              onChange={(v) => form.setValue('purpose', v as 'fuel' | 'repair', { shouldValidate: true })}
              placeholder="Choose purpose"
            />
          </FormField>

          {form.watch('purpose') === 'fuel' ? (
            <FormField label="Fuel log ID" required error={form.formState.errors.fuelLogId?.message}>
              <Input placeholder="Fuel log UUID" {...form.register('fuelLogId')} />
            </FormField>
          ) : (
            <FormField label="Repair log ID" required error={form.formState.errors.repairLogId?.message}>
              <Input placeholder="Repair log UUID" {...form.register('repairLogId')} />
            </FormField>
          )}

          <FormField label="Amount (KES)" required error={form.formState.errors.amountKes?.message}>
            <Input type="number" min={1} step={1} placeholder="0" {...form.register('amountKes')} />
          </FormField>

          <FormField label="Phone (E.164)" required error={form.formState.errors.phoneE164?.message}>
            <Input placeholder="+254712345678" {...form.register('phoneE164')} />
          </FormField>

          <FormField
            label="Description"
            required
            error={form.formState.errors.description?.message}
            className="sm:col-span-2"
          >
            <Input placeholder="Fuel payment" {...form.register('description')} />
          </FormField>
        </div>
      </FormModal>
    </div>
  );
}
