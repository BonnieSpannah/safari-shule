# Phase 1B — Audit Integration Guide

This guide shows how to integrate audit events and data protection across Safari Shule web screens.

## Overview

Three components work together to implement compliance audit trails:

1. **ErrorState** — Error handling with retry (Phase 1A)
2. **LoadingState** — Loading indicators (Phase 1A)
3. **Sensitive** — Data protection wrapper for P0/P1 classification
4. **useClientEvents** — Audit event emission hook
5. **ImpersonationBanner** — Admin impersonation warning

## Integration Patterns

### 1. Wrap Sensitive Data with `<Sensitive>`

P1 data (PII, credentials, financial info) should be wrapped to block copy/print/download:

```typescript
// Example: Student contact information
<Sensitive level="P1">
  <div className="space-y-2">
    <p><strong>Email:</strong> {student.email}</p>
    <p><strong>Phone:</strong> {student.phoneNumber}</p>
    <p><strong>Guardian Email:</strong> {student.guardianEmail}</p>
  </div>
</Sensitive>
```

P0 data (public, non-sensitive) allows all actions:

```typescript
// Example: Vehicle registration (public)
<Sensitive level="P0">
  <p className="font-mono">{vehicle.registration}</p>
</Sensitive>
```

### 2. Emit Audit Events with `useClientEvents`

Emit events when users interact with data:

```typescript
import { useClientEvents } from '@/hooks/useClientEvents';

export function StudentDetailsPage() {
  const { emit, handleDownload, handleCopy, handlePrint } = useClientEvents();

  // Emit view event on page load
  useEffect(() => {
    emit('view', {
      entityType: 'student',
      entityId: studentId,
    });
  }, [studentId, emit]);

  // Download transcript
  const onDownloadTranscript = async () => {
    const pdf = await generateTranscriptPdf(studentId);
    handleDownload(
      `transcript_${student.id}.pdf`,
      pdf,
      'application/pdf',
      { studentId, action: 'transcript_download' },
    );
  };

  // Print report
  const onPrint = () => {
    handlePrint({ studentId, reportType: 'attendance' });
  };

  return (
    <>
      <button onClick={onDownloadTranscript}>Download Transcript</button>
      <button onClick={onPrint}>Print Report</button>
    </>
  );
}
```

### 3. Integration with DataTable Export

Audit exports when users download table data:

```typescript
import { useClientEvents } from '@/hooks/useClientEvents';
import { DataTable } from '@/components/ui/data-table';

export function ParentsPage() {
  const { emit, handleDownload } = useClientEvents();

  const onExportCsv = async (rows: Parent[]) => {
    const csv = generateCsv(rows);
    handleDownload(
      'parents.csv',
      csv,
      'text/csv',
      { entityType: 'parent', count: rows.length },
    );
    emit('download', {
      entityType: 'parent_bulk',
      metadata: { count: rows.length, format: 'csv' },
    });
  };

  return (
    <DataTable
      {...props}
      onExport={onExportCsv}
    />
  );
}
```

### 4. List Screens with P1 Data

Example: Students list with email addresses (P1):

```typescript
import { Sensitive } from '@/components/audit/Sensitive';
import { useClientEvents } from '@/hooks/useClientEvents';

export function StudentsPage() {
  const { emit } = useClientEvents();

  useEffect(() => {
    emit('view', { entityType: 'student_list' });
  }, [emit]);

  const columns: Column<Student>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (student) => student.name,
    },
    {
      key: 'email',
      header: 'Email',
      render: (student) => (
        <Sensitive level="P1">
          <a href={`mailto:${student.email}`}>{student.email}</a>
        </Sensitive>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (student) => (
        <Sensitive level="P1">
          <span className="font-mono">{formatPhoneNumber(student.phone)}</span>
        </Sensitive>
      ),
    },
    {
      key: 'grade',
      header: 'Grade',
      render: (student) => student.grade,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={students}
      selectable
      exportFilename="students"
      // ... other props
    />
  );
}
```

### 5. Impersonation Integration

When admin impersonates a user, ImpersonationBanner shows automatically:

```typescript
// In platform admin panel
const onImpersonate = async (userId: string, userEmail: string) => {
  // Request impersonation API call
  await api.post('/v1/auth/impersonate', { userId });

  // Update store
  useImpersonationStore.setState({
    isImpersonating: true,
    impersonatedUserId: userId,
    impersonatedUserEmail: userEmail,
    approverEmail: useAuthStore.getState().user?.email,
  });

  // Redirect to user's dashboard
  navigate('/dashboard');
};

// On page, emit audit event
useEffect(() => {
  if (useImpersonationStore.getState().isImpersonating) {
    emit('view', {
      entityType: 'impersonated_session',
      metadata: {
        impersonatedUserId: useImpersonationStore.getState().impersonatedUserId,
      },
    });
  }
}, [emit]);
```

To end impersonation:

```typescript
const onEndImpersonation = () => {
  useImpersonationStore.getState().endImpersonation();
  navigate('/admin/users');
};
```

## API Audit Endpoint

Audit events are sent to `POST /v1/audit/events`:

```typescript
interface ClientAuditEvent {
  action: 'view' | 'print' | 'download' | 'copy' | 'screenshot';
  timestamp: string; // ISO 8601
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}
```

The backend stores these in `audit_log` table for compliance reporting.

## Data Classification (P0/P1)

**P0 — Public data:**

- Vehicle registration plates
- Route names
- Trip schedules
- Student names
- School names
- Status values

**P1 — Sensitive/Personal data:**

- Email addresses
- Phone numbers
- ID card numbers
- Payment information
- Guardian contact details
- Driver personal info
- Student addresses

When in doubt, use `level="P1"` to block copy/print/download.

## Testing Audit Components

```typescript
import { renderHook, act } from '@testing-library/react';
import { useClientEvents } from '@/hooks/useClientEvents';

describe('audit integration', () => {
  it('emits view event on screen load', async () => {
    const { result } = renderHook(() => useClientEvents());

    await act(async () => {
      await result.current.emit('view', {
        entityType: 'student',
        entityId: '123',
      });
    });

    // API call would be verified here in integration test
  });

  it('blocks copy on P1 data', () => {
    const { render } = renderTest();
    render(
      <Sensitive level="P1">
        <span>confidential@example.com</span>
      </Sensitive>,
    );

    const sensitive = screen.getByText('confidential@example.com').closest('[data-sensitive]');
    expect(sensitive).toHaveAttribute('data-sensitive', 'true');
  });
});
```

## Rollout Checklist

- [ ] Add `useClientEvents` to StudentsPage
- [ ] Add `useClientEvents` to RoutesPage
- [ ] Add `useClientEvents` to IncidentsPage
- [ ] Add `useClientEvents` to PaymentsPage
- [ ] Add `useClientEvents` to SettingsPage
- [ ] Wrap P1 data in StudentsPage with `<Sensitive level="P1">`
- [ ] Wrap P1 data in ParentsPage with `<Sensitive level="P1">`
- [ ] Verify ImpersonationBanner displays in admin panel
- [ ] Test audit events in dev tools network tab
- [ ] Confirm audit logs appear in database

## Next Phase (Phase 2)

After audit integration is complete, implement remaining screens:

1. StudentsPage (with audit events + P1 data wrapping)
2. RoutesPage (with audit events)
3. IncidentsPage (with audit events + sensitive data)
4. PaymentsPage (with audit events + P1 wrapping)
5. SettingsPage (with audit events)

Each screen follows the same pattern:

1. Import `useClientEvents`
2. Emit 'view' on mount
3. Wrap P1 data with `<Sensitive level="P1">`
4. Emit 'download'/'print'/'copy' on actions
5. Add 4-state handling (loading, error, empty, data)
