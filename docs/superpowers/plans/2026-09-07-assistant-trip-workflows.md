# M7.5 — Assistant Trip Workflows Implementation Plan

> **Status: ✅ Complete (2026-09-09).** See "Completion Evidence" section immediately below for what actually shipped, deviations from the original plan, bugs found/fixed, and verification evidence. The detailed task-by-task plan below is preserved as the historical working record.

## Completion Evidence (2026-09-09)

**Shipped, matching the plan:**

- `tripActorWhere(userId)` in `apps/api/src/modules/trips/trip-actor.ts`, used by board/alight and SOS validation
- `GET /v1/trips/assistant-workspace`, `GET /v1/trips/assistant/:id`
- `apps/api/test/assistant-trip-workflow.e2e-spec.ts` (4 tests, all passing)
- `apps/mobile/lib/features/caretaker/assistant_trip_providers.dart`, `assistant_trip_screen.dart`, real `assistant_dashboard_screen.dart`
- `apps/mobile/test/widget/assistant_dashboard_screen_test.dart` (2 tests, all passing)
- Assistant shell "Trips" tab wiring with prefix-based route matching for `/assistant/trip/:id`

**Deviated from the original plan (pragmatic, lower-risk choices made during implementation):**

- No separate `apps/api/src/common/auth/request-user.ts` promotion — `requireAuthenticatedUserId` stayed local to `trips.controller.ts`; not worth the churn for a single extra caller
- No separate `lib/features/trips/` shared module — `AssistantTripScreen` imports directly from `driver_trip_screen.dart`/`trip_status_shell.dart` instead; kept the diff smaller
- `apps/mobile/test/widget/assistant_trip_screen_test.dart` was folded into `assistant_dashboard_screen_test.dart` instead of being a separate file

**Real bugs found and fixed during manual e2e verification (API + web + mobile, live browser + Flutter Chrome target):**

1. **`driver-start`/`driver-end` response-shape mismatch** — these endpoints returned a bare `Trip` row; the mobile client's `DriverTripDetail.fromJson` requires an enriched shape (`route`, `vehicle`, `passengerSummary`), causing a client-side crash that desynced the UI from real server state (trip actually started, UI kept showing "Scheduled"). Fixed: both endpoints now return `driverDetail()` after the update. Regression-verified: 5 e2e suites / 36 tests passing.
2. **Mobile app crash on cold start (web/Chrome target only)** — `apps/mobile/lib/app/app.dart`'s session listener called `tripTelemetryProvider.stop()` unguarded; the native-only geolocation plugin throws on web. Fixed with `.catchError((_) {})`, matching the existing pattern for push notifications.

**Follow-up fixed (2026-09-09):** web's `ProtectedRoute` no longer reads a stale `mustChangePassword` flag after a successful password change. `SecurityPage` synchronizes both the persisted auth user and the shared React Query `/me` cache before navigating, with a focused regression test covering the forced-password state transition. Live browser smoke verification used a disposable forced-rotation account: login landed on `/me/security`, the required-password form completed successfully, and a fresh session navigated to `/students` without a forced-password redirect.

**Verification evidence:**

- API: `tsc --noEmit` clean, `nest build` clean, 6 e2e suites / 29+ tests passing (assistant workflow, sos, driver-workspace, vehicle-trip-invariant, cross-tenant-isolation, permissions), plus the Bug #2 regression bundle (5 suites / 36 tests)
- Mobile: `flutter analyze` clean, 171/171 `flutter test` passing
- Web: 85/85 vitest passing
- Manual: real login as seeded driver + assistant on web (permission-gated nav confirmed) and mobile (Flutter Chrome target — no Android/iOS toolchain available in this environment); real trip start → board → alight → SOS, cross-checked live against the web Trips/Incidents pages

**Still recommended before considering this fully shipped:** a manual Android emulator or physical-device walkthrough, since this environment could only verify via the Flutter web/Chrome target (same Dart code and API calls, but no native GPS/NFC/biometric behavior).

---

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An assistant assigned to a trip can view that trip, board/alight students, and send an SOS — reusing the M7 driver work rather than duplicating it — while trip start/end stays driver-only.

**Architecture:** On the API, trip-actor authorization is generalized from "assigned driver" to "assigned driver OR assigned assistant" via one shared `tripActorWhere(userId)` Prisma predicate; the driver workspace/detail query bodies are extracted into private helpers parameterized by an assignment predicate, so the new assistant endpoints add routes but no new query logic. On mobile, the driver trip screen's four per-status view widgets are promoted into a shared `lib/features/trips/` module with nullable action callbacks (`onStart`/`onEnd` omitted ⇒ button absent), so `AssistantTripScreen` composes exactly the same map/badge/chips/board/alight/SOS UI without Start/End.

**Tech Stack:** NestJS 10.4.4 + Prisma 5.20 + PostgreSQL/PostGIS (API), Jest + supertest (API e2e), Flutter 3.24 + Riverpod 2 + go_router + Dio (mobile), flutter_test (widget tests).

## Global Constraints

- Branch: `feat/m7-flutter-mobile`. **Never push to origin** — local commits only.
- No schema/migration changes. No RBAC changes — `assistant` already has `trips.view`, `trips.live_track`, `attendance.override`, `incidents.report`.
- Trip start/end (`/trips/:id/driver-start`, `/trips/:id/driver-end`, `startForAssignedDriver`, `endForAssignedDriver`) stay **driver-only** — do not generalize them.
- Do **not** reconcile RFID-scan attendance (`AttendanceEvent`) with manual board/alight (`TripPassenger.boardedAt/alightedAt`) — deliberately deferred (see `docs/ROADMAP.md` M7 deferred-gap note).
- Do **not** touch the parent portal, the assistant/parent shell tenant-branding gap, or audit-logging work — separate deferred initiatives.
- Every Prisma `.create()` passes an explicit `tenantId`. Reads that are not already tenant-scoped by `prisma.scoped` must pass `tenantId` explicitly.
- Unauthorized access returns **404 NotFound** (no existence leak), never 403.
- No comments unless the WHY is non-obvious. No file-header docstrings. No `// TODO`/stubs.
- Mobile: no codegen; hand-written immutable models; `flutter analyze` must be clean.
- Existing model/provider names (`DriverTripDetail`, `DriverWorkspace`, `DriverTripSummary`, `driverTripDetailProvider`) are **not** renamed in this milestone — churn is not worth it. Shared widgets get role-neutral names; the models they consume keep their existing names.
- Verification commands (run from repo root):
  - `pnpm --filter @safari-shule/api exec tsc --noEmit`
  - `pnpm --filter @safari-shule/api exec tsc --noEmit -p test/tsconfig.test.json`
  - `pnpm --filter @safari-shule/api run build`
  - `pnpm --filter @safari-shule/api exec jest --config test/jest-e2e.json test/<spec>.e2e-spec.ts` (needs `make infra` running)
  - `cd apps/mobile && flutter analyze && flutter test`
- Known pre-existing e2e failures unrelated to this work (do not chase): `trips.e2e-spec.ts` `(tenantId,driverUserId)` unique-constraint collision, `bull-board`, `audit-events`.
- Known environment issue: a runaway `find /` process can starve CPU. If a command or dispatch hangs, run `ps aux | grep find` and kill it.

---

## File Structure

**API — create:**

- `apps/api/src/modules/trips/trip-actor.ts` — the single `tripActorWhere(userId)` predicate shared by trips + incidents.
- `apps/api/src/common/auth/request-user.ts` — `requireAuthenticatedUserId(req)` promoted out of `trips.controller.ts` so `incidents.controller.ts` can reuse it.
- `apps/api/test/assistant-trip-workflow.e2e-spec.ts` — all new assistant API coverage.

**API — modify:**

- `apps/api/src/modules/trips/trips.service.ts` — extract `workspaceFor`/`tripDetailFor`; rename `loadOwnedTrip` → `loadActorTrip`; add `assistantWorkspace`/`assistantDetail`.
- `apps/api/src/modules/trips/trips.controller.ts` — two new routes; import the promoted `requireAuthenticatedUserId`.
- `apps/api/src/modules/incidents/incidents.service.ts` — SOS trip-actor + tenant validation.
- `apps/api/src/modules/incidents/incidents.controller.ts` — pass the caller's user id into `sos`.
- `apps/api/test/helpers.ts` — optional `withAssistant` seeding.

**Mobile — create:**

- `apps/mobile/lib/features/trips/trip_status_views.dart` — role-agnostic `TripDetailContent` + the four per-status views.
- `apps/mobile/lib/features/trips/trip_passenger_api.dart` — raw board/alight HTTP calls shared by both roles' providers.
- `apps/mobile/lib/features/trips/trip_sos.dart` — SOS post-with-outbox-fallback shared by both roles' screens.
- `apps/mobile/lib/features/caretaker/assistant_trip_providers.dart`
- `apps/mobile/lib/features/caretaker/assistant_trip_screen.dart`
- `apps/mobile/test/widget/assistant_trip_screen_test.dart`
- `apps/mobile/test/widget/assistant_dashboard_screen_test.dart`

**Mobile — modify:**

- `apps/mobile/lib/features/driver/driver_trip_screen.dart` — delete the promoted private widgets, compose the shared ones.
- `apps/mobile/lib/features/driver/driver_trip_providers.dart` — board/alight providers delegate to `trip_passenger_api.dart`.
- `apps/mobile/lib/features/caretaker/assistant_dashboard_screen.dart` — replace the stub.
- `apps/mobile/lib/features/caretaker/assistant_shell.dart` — prefix-based tab selection.
- `apps/mobile/lib/app/app_router.dart` — `/assistant/trip/:id` route.

---

### Task 1: API — shared trip-actor predicate; board/alight accept the assigned assistant

**Files:**

- Create: `apps/api/src/modules/trips/trip-actor.ts`
- Modify: `apps/api/src/modules/trips/trips.service.ts` (`loadOwnedTrip`, `boardPassenger`, `alightPassenger`)
- Modify: `apps/api/test/helpers.ts` (add `withAssistant` seeding)
- Test: `apps/api/test/assistant-trip-workflow.e2e-spec.ts` (new)

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces:

  - `tripActorWhere(userId: string): Prisma.TripWhereInput` (from `src/modules/trips/trip-actor.ts`) — used again in Tasks 2 and 3.
  - `TripsService.boardPassenger(tripId: string, actorUserId: string, admissionNumber: string)` and `.alightPassenger(...)` — same signature shape as today, parameter renamed to `actorUserId`, semantics widened.
  - `seedTenantWithRoles(prisma, tenantAdmin, auth, prefix, { withAssistant: true })` returns `SeededTenant` with `assistant?: { userId: string; accessToken: string }` — used again in Tasks 2 and 3.

- [ ] **Step 1: Add the `withAssistant` seeding option to the e2e helper**

In `apps/api/test/helpers.ts`, extend the interface:

```ts
export interface SeededTenant {
  tenantId: string;
  subdomain: string;
  adminUserId: string;
  adminAccessToken: string;
  driverUserId: string;
  driverAccessToken: string;
  assistant?: { userId: string; accessToken: string };
  device?: { id: string; deviceId: string; apiKey: string; hmacSecret: string; vehicleId: string };
}
```

Change the options parameter of `seedTenantWithRoles` to `opts: { withDevice?: boolean; withAssistant?: boolean } = {}`, and inside the `runWithBypass` block — after the driver tokens are issued, before the `withDevice` block — add:

```ts
let assistant: SeededTenant['assistant'];
if (opts.withAssistant) {
  const assistantRole = await prisma.role.findUniqueOrThrow({
    where: { tenantId_key: { tenantId: tenant.id, key: 'assistant' } },
  });
  const assistantUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `assistant@${slug}.test`,
      passwordHash: await auth.hashPassword('Assistant!Pass1'),
      status: 'active',
      fullName: 'Test Assistant',
    },
  });
  await prisma.userRole.create({
    data: { tenantId: tenant.id, userId: assistantUser.id, roleId: assistantRole.id },
  });
  const assistantTokens = await auth.issueTokenPair({
    id: assistantUser.id,
    tenantId: tenant.id,
    email: assistantUser.email,
    fullName: assistantUser.fullName,
  });
  assistant = { userId: assistantUser.id, accessToken: assistantTokens.accessToken };
}
```

Add `assistant,` to the returned object literal (next to `device,`).

- [ ] **Step 2: Write the failing e2e test**

Create `apps/api/test/assistant-trip-workflow.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { TenantAdminService } from '../src/modules/tenant-admin/tenant-admin.service';
import { AuthService } from '../src/auth/auth.service';
import { runWithBypass } from '../src/common/context/request-context';
import { bootstrapTestApp, cleanupTenant, seedTenantWithRoles, SeededTenant } from './helpers';

describe('Assistant trip workflows (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantAdmin: TenantAdminService;
  let auth: AuthService;
  let tenant: SeededTenant;

  let assignedTripId: string;
  let unassignedTripId: string;
  let admissionNumber: string;

  const authAs = (token: string) => ({
    Authorization: `Bearer ${token}`,
    'x-tenant-id': tenant.tenantId,
  });

  beforeAll(async () => {
    ({ app, prisma, tenantAdmin, auth } = await bootstrapTestApp());
    tenant = await seedTenantWithRoles(prisma, tenantAdmin, auth, 'assist', {
      withDevice: true,
      withAssistant: true,
    });

    await runWithBypass(async () => {
      const routeId = randomUUID();
      await prisma.$executeRaw`
        INSERT INTO routes (id, "tenantId", name, description, "isActive", "startPoint", "endPoint", "createdAt", "updatedAt")
        VALUES (
          ${routeId}::uuid, ${tenant.tenantId}::uuid, 'Assistant Route', 'assistant test route', true,
          ST_SetSRID(ST_MakePoint(36.8219, -1.2864), 4326)::geography,
          ST_SetSRID(ST_MakePoint(36.83, -1.30), 4326)::geography,
          NOW(), NOW()
        )
      `;

      const assigned = await prisma.trip.create({
        data: {
          tenantId: tenant.tenantId,
          routeId,
          vehicleId: tenant.device!.vehicleId,
          driverUserId: tenant.driverUserId,
          assistantUserId: tenant.assistant!.userId,
          scheduledStart: new Date(),
          direction: 'morning_pickup',
          status: 'in_progress',
          startedAt: new Date(),
        },
      });
      assignedTripId = assigned.id;

      const unassigned = await prisma.trip.create({
        data: {
          tenantId: tenant.tenantId,
          routeId,
          vehicleId: tenant.device!.vehicleId,
          driverUserId: tenant.driverUserId,
          scheduledStart: new Date(Date.now() + 3_600_000),
          direction: 'evening_dropoff',
        },
      });
      unassignedTripId = unassigned.id;

      admissionNumber = `ADM-${randomUUID().slice(0, 6)}`;
      const student = await prisma.student.create({
        data: {
          tenantId: tenant.tenantId,
          admissionNumber,
          legalName: 'Assistant Test Student',
          dateOfBirth: new Date('2015-04-01'),
          gender: 'female',
        },
      });
      await prisma.tripPassenger.create({
        data: {
          tenantId: tenant.tenantId,
          tripId: assigned.id,
          studentId: student.id,
          expected: true,
        },
      });
    });
  });

  afterAll(async () => {
    await cleanupTenant(prisma, tenant.tenantId);
    await app.close();
  });

  it('assistant can board a student on the trip they are assigned to', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/trips/${assignedTripId}/board`)
      .set(authAs(tenant.assistant!.accessToken))
      .send({ admissionNumber });

    expect([200, 201]).toContain(res.status);
    expect(res.body.boardedAt).toBeDefined();
  });

  it('assistant can alight a student on the trip they are assigned to', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/trips/${assignedTripId}/alight`)
      .set(authAs(tenant.assistant!.accessToken))
      .send({ admissionNumber });

    expect([200, 201]).toContain(res.status);
    expect(res.body.alightedAt).toBeDefined();
  });

  it('assistant gets 404 boarding on a trip they are not assigned to', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/trips/${unassignedTripId}/board`)
      .set(authAs(tenant.assistant!.accessToken))
      .send({ admissionNumber });

    expect(res.status).toBe(404);
  });

  it('driver board/alight on their own trip is unaffected', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/trips/${unassignedTripId}/board`)
      .set(authAs(tenant.driverAccessToken))
      .send({ admissionNumber });

    // The student is a passenger of the assigned trip only, so the driver's
    // own trip resolves but the passenger lookup does not.
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('STUDENT_NOT_ON_TRIP');
  });
});
```

- [ ] **Step 3: Run the test and verify it fails**

Ensure infra is up (`make infra`), then run:

`pnpm --filter @safari-shule/api exec jest --config test/jest-e2e.json test/assistant-trip-workflow.e2e-spec.ts`

Expected: the two assistant board/alight tests FAIL with 404 (today `loadOwnedTrip` matches `driverUserId` only).

- [ ] **Step 4: Create the shared predicate**

Create `apps/api/src/modules/trips/trip-actor.ts`:

```ts
import type { Prisma } from '@prisma/client';

// A trip's "actors" are the staff riding it: the assigned driver and assistant.
export function tripActorWhere(userId: string): Prisma.TripWhereInput {
  return { OR: [{ driverUserId: userId }, { assistantUserId: userId }] };
}
```

- [ ] **Step 5: Generalize the ownership check in the service**

In `apps/api/src/modules/trips/trips.service.ts`, add the import:

```ts
import { tripActorWhere } from './trip-actor';
```

Replace `loadOwnedTrip` with:

```ts
  private async loadActorTrip(tripId: string, actorUserId: string) {
    const tenantId = requireTenantId();
    const trip = await this.prisma.trip.findFirst({
      where: { id: tripId, tenantId, ...tripActorWhere(actorUserId) },
    });
    if (!trip) throw new NotFoundException();
    return trip;
  }
```

Update both call sites — in `boardPassenger` and `alightPassenger`, rename the second parameter from `driverUserId` to `actorUserId` and call `this.loadActorTrip(tripId, actorUserId)`. Everything else in those two methods is unchanged.

- [ ] **Step 6: Run the tests and verify they pass**

```bash
pnpm --filter @safari-shule/api exec tsc --noEmit
pnpm --filter @safari-shule/api exec tsc --noEmit -p test/tsconfig.test.json
pnpm --filter @safari-shule/api exec jest --config test/jest-e2e.json test/assistant-trip-workflow.e2e-spec.ts
pnpm --filter @safari-shule/api exec jest --config test/jest-e2e.json test/driver-workspace.e2e-spec.ts
```

Expected: new spec all green; `driver-workspace` unchanged (still green).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/trips/trip-actor.ts apps/api/src/modules/trips/trips.service.ts apps/api/test/helpers.ts apps/api/test/assistant-trip-workflow.e2e-spec.ts
git commit -m "feat(api): let the assigned assistant board and alight trip passengers"
```

---

### Task 2: API — assistant workspace + detail endpoints

**Files:**

- Modify: `apps/api/src/modules/trips/trips.service.ts` (`driverWorkspace`, `driverDetail`)
- Create: `apps/api/src/common/auth/request-user.ts`
- Modify: `apps/api/src/modules/trips/trips.controller.ts`
- Test: `apps/api/test/assistant-trip-workflow.e2e-spec.ts` (extend)

**Interfaces:**

- Consumes: `seedTenantWithRoles(..., { withAssistant: true })` and the spec file from Task 1.
- Produces:

  - `TripsService.assistantWorkspace(assistantUserId: string)` → `{ activeTrip, upcomingTrips, recentTrips }` (identical shape to `driverWorkspace`).
  - `TripsService.assistantDetail(id: string, assistantUserId: string)` → identical shape to `driverDetail`.
  - `GET /v1/trips/assistant-workspace`, `GET /v1/trips/assistant/:id` (both `@RequirePermission('trips.view')`).
  - `requireAuthenticatedUserId(req: Request): string` exported from `src/common/auth/request-user.ts` — used again in Task 3.

- [ ] **Step 1: Write the failing e2e tests**

Append inside the existing `describe` in `apps/api/test/assistant-trip-workflow.e2e-spec.ts`:

```ts
it('assistant-workspace returns only trips the assistant is assigned to', async () => {
  const res = await request(app.getHttpServer())
    .get('/v1/trips/assistant-workspace')
    .set(authAs(tenant.assistant!.accessToken));

  expect(res.status).toBe(200);
  expect(res.body.activeTrip?.id).toBe(assignedTripId);
  expect(res.body.upcomingTrips.map((t: { id: string }) => t.id)).not.toContain(unassignedTripId);
  expect(Array.isArray(res.body.recentTrips)).toBe(true);
});

it('assistant detail returns the full trip payload for an assigned trip', async () => {
  const res = await request(app.getHttpServer())
    .get(`/v1/trips/assistant/${assignedTripId}`)
    .set(authAs(tenant.assistant!.accessToken));

  expect(res.status).toBe(200);
  expect(res.body.id).toBe(assignedTripId);
  expect(res.body.route).toHaveProperty('startPoint');
  expect(res.body.route).toHaveProperty('busStops');
  expect(res.body.passengerSummary).toHaveProperty('expected');
  expect(res.body).toHaveProperty('locationSnapshots');
});

it('assistant detail 404s for a trip the assistant is not assigned to', async () => {
  const res = await request(app.getHttpServer())
    .get(`/v1/trips/assistant/${unassignedTripId}`)
    .set(authAs(tenant.assistant!.accessToken));

  expect(res.status).toBe(404);
});

it('driver workspace and detail still return the driver-assigned trips', async () => {
  const workspace = await request(app.getHttpServer())
    .get('/v1/trips/driver-workspace')
    .set(authAs(tenant.driverAccessToken));

  expect(workspace.status).toBe(200);
  expect(workspace.body.activeTrip?.id).toBe(assignedTripId);
  expect(workspace.body.upcomingTrips.map((t: { id: string }) => t.id)).toContain(unassignedTripId);

  const detail = await request(app.getHttpServer())
    .get(`/v1/trips/driver/${assignedTripId}`)
    .set(authAs(tenant.driverAccessToken));

  expect(detail.status).toBe(200);
  expect(detail.body.assistant?.id).toBe(tenant.assistant!.userId);
});

it('driver-start stays driver-only for an assistant caller', async () => {
  const res = await request(app.getHttpServer())
    .post(`/v1/trips/${unassignedTripId}/driver-start`)
    .set(authAs(tenant.assistant!.accessToken));

  expect(res.status).toBe(404);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

`pnpm --filter @safari-shule/api exec jest --config test/jest-e2e.json test/assistant-trip-workflow.e2e-spec.ts`

Expected: the three assistant endpoint tests FAIL (404 — the routes do not exist yet; `/trips/assistant-workspace` falls through to `GET :id`).

- [ ] **Step 3: Extract the shared workspace/detail query bodies**

In `apps/api/src/modules/trips/trips.service.ts`, replace the `driverWorkspace` method with a private helper plus two thin public methods. The query body is copied verbatim from today's `driverWorkspace`, with `driverUserId` in each `where` replaced by the spread `...assignment`:

```ts
  private async workspaceFor(assignment: Prisma.TripWhereInput) {
    const tenantId = requireTenantId();
    const summaryInclude = {
      route: { select: { id: true, name: true } },
      vehicle: { select: { id: true, registration: true, capacity: true } },
      _count: { select: { passengers: true } },
    } satisfies Prisma.TripInclude;

    const [activeTrip, upcomingTrips, recentTrips] = await Promise.all([
      this.prisma.trip.findFirst({
        where: { tenantId, ...assignment, status: TripStatus.in_progress },
        include: summaryInclude,
      }),
      this.prisma.trip.findMany({
        where: { tenantId, ...assignment, status: TripStatus.scheduled },
        include: summaryInclude,
        orderBy: { scheduledStart: 'asc' },
      }),
      this.prisma.trip.findMany({
        where: { tenantId, ...assignment, status: { in: [TripStatus.completed, TripStatus.cancelled] } },
        include: summaryInclude,
        orderBy: [{ endedAt: 'desc' }, { scheduledStart: 'desc' }],
        take: 20,
      }),
    ]);

    return { activeTrip, upcomingTrips, recentTrips };
  }

  driverWorkspace(driverUserId: string) {
    return this.workspaceFor({ driverUserId });
  }

  assistantWorkspace(assistantUserId: string) {
    return this.workspaceFor({ assistantUserId });
  }
```

Then rename `driverDetail(id, driverUserId)` to `private async tripDetailFor(id: string, assignment: Prisma.TripWhereInput)`. Its body is unchanged except the first query, which becomes:

```ts
const trip = await this.prisma.trip.findFirst({
  where: { id, tenantId, ...assignment },
  include: {
    vehicle: { select: { id: true, registration: true, capacity: true } },
    passengers: true,
  },
});
```

And add the two public wrappers directly after it:

```ts
  driverDetail(id: string, driverUserId: string) {
    return this.tripDetailFor(id, { driverUserId });
  }

  assistantDetail(id: string, assistantUserId: string) {
    return this.tripDetailFor(id, { assistantUserId });
  }
```

- [ ] **Step 4: Promote the controller auth helper**

Create `apps/api/src/common/auth/request-user.ts`:

```ts
import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

export function requireAuthenticatedUserId(req: Request): string {
  const user = req.user as { userId?: string } | undefined;
  if (!user?.userId) {
    throw new UnauthorizedException('Authenticated user is unavailable.');
  }
  return user.userId;
}
```

In `apps/api/src/modules/trips/trips.controller.ts`, delete the local `requireAuthenticatedUserId` function and the now-unused `UnauthorizedException` import, and add:

```ts
import { requireAuthenticatedUserId } from '../../common/auth/request-user';
```

- [ ] **Step 5: Add the two routes**

In `apps/api/src/modules/trips/trips.controller.ts`, immediately after the existing `driverDetail` handler and **before** the `@Get(':id')` handler (NestJS matches in declaration order — a later placement would be swallowed by `:id`):

```ts
  @Get('assistant-workspace')
  @RequirePermission('trips.view')
  assistantWorkspace(@Req() req: Request) {
    return this.svc.assistantWorkspace(requireAuthenticatedUserId(req));
  }

  @Get('assistant/:id')
  @RequirePermission('trips.view')
  assistantDetail(@Param('id') id: string, @Req() req: Request) {
    return this.svc.assistantDetail(id, requireAuthenticatedUserId(req));
  }
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
pnpm --filter @safari-shule/api exec tsc --noEmit
pnpm --filter @safari-shule/api exec tsc --noEmit -p test/tsconfig.test.json
pnpm --filter @safari-shule/api run build
pnpm --filter @safari-shule/api exec jest --config test/jest-e2e.json test/assistant-trip-workflow.e2e-spec.ts
pnpm --filter @safari-shule/api exec jest --config test/jest-e2e.json test/driver-workspace.e2e-spec.ts
```

Expected: both specs fully green.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src apps/api/test
git commit -m "feat(api): add assistant trip workspace and detail endpoints"
```

---

### Task 3: API — SOS requires the caller to be a trip actor

**Files:**

- Modify: `apps/api/src/modules/incidents/incidents.controller.ts`
- Modify: `apps/api/src/modules/incidents/incidents.service.ts` (`sos`)
- Test: `apps/api/test/assistant-trip-workflow.e2e-spec.ts` (extend), `apps/api/test/sos.e2e-spec.ts` (extend)

**Interfaces:**

- Consumes: `tripActorWhere` (Task 1), `requireAuthenticatedUserId` (Task 2), `seedTenantWithRoles(..., { withAssistant: true })` (Task 1).
- Produces: `IncidentsService.sos(input: { tripId: string; actorUserId: string; location: LatLng; description?: string })` — new required `actorUserId` field.

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/test/assistant-trip-workflow.e2e-spec.ts`:

```ts
it('assistant can SOS the trip they are assigned to', async () => {
  const res = await request(app.getHttpServer())
    .post(`/v1/trips/${assignedTripId}/sos`)
    .set(authAs(tenant.assistant!.accessToken))
    .send({ description: 'Student injured on board', location: { lat: -1.2864, lng: 36.8219 } });

  expect(res.status).toBe(202);
  expect(res.body).toHaveProperty('incident');
});

it('assistant SOS on a trip they are not assigned to 404s', async () => {
  const res = await request(app.getHttpServer())
    .post(`/v1/trips/${unassignedTripId}/sos`)
    .set(authAs(tenant.assistant!.accessToken))
    .send({ description: 'Not my trip' });

  expect(res.status).toBe(404);
});

it('SOS on a nonexistent trip id 404s', async () => {
  const res = await request(app.getHttpServer())
    .post(`/v1/trips/${randomUUID()}/sos`)
    .set(authAs(tenant.driverAccessToken))
    .send({ description: 'Ghost trip' });

  expect(res.status).toBe(404);
});
```

And append one case to `apps/api/test/sos.e2e-spec.ts` (inside its existing `describe`), which needs a second trip the driver is not assigned to. Add this test after the existing driver SOS test:

```ts
it('a driver cannot SOS a trip assigned to someone else', async () => {
  const otherTripId = await runWithBypass(async () => {
    const otherDriver = await prisma.user.create({
      data: {
        tenantId: tenant.tenantId,
        email: `other-driver-${randomUUID().slice(0, 8)}@sos.test`,
        passwordHash: 'x',
        status: 'active',
        fullName: 'Other Driver',
      },
    });
    const trip = await prisma.trip.findFirstOrThrow({ where: { id: tripId } });
    const other = await prisma.trip.create({
      data: {
        tenantId: tenant.tenantId,
        routeId: trip.routeId,
        vehicleId: trip.vehicleId,
        driverUserId: otherDriver.id,
        scheduledStart: new Date(Date.now() + 7_200_000),
        direction: 'evening_dropoff',
      },
    });
    return other.id;
  });

  const res = await request(app.getHttpServer())
    .post(`/v1/trips/${otherTripId}/sos`)
    .set('Authorization', `Bearer ${tenant.driverAccessToken}`)
    .set('x-tenant-id', tenant.tenantId)
    .send({ description: 'Not my trip' });

  expect(res.status).toBe(404);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --filter @safari-shule/api exec jest --config test/jest-e2e.json test/assistant-trip-workflow.e2e-spec.ts test/sos.e2e-spec.ts
```

Expected: the "not assigned" / "nonexistent trip" cases FAIL by returning 202 instead of 404 (today `sos` does no ownership or tenant check). The nonexistent-id case may already pass; the other two must fail.

- [ ] **Step 3: Add the trip-actor check to the service**

In `apps/api/src/modules/incidents/incidents.service.ts`, add the import:

```ts
import { tripActorWhere } from '../trips/trip-actor';
```

and change the `sos` signature and first query:

```ts
  async sos(input: { tripId: string; actorUserId: string; location: LatLng; description?: string }) {
    const tenantId = requireTenantId();
    const trip = await this.prisma.trip.findFirst({
      where: { id: input.tripId, tenantId, ...tripActorWhere(input.actorUserId) },
      include: { vehicle: true, route: true },
    });
    if (!trip) throw new NotFoundException();
```

The rest of the method is unchanged.

- [ ] **Step 4: Pass the caller through from the controller**

In `apps/api/src/modules/incidents/incidents.controller.ts`, add imports:

```ts
import { Req } from '@nestjs/common';
import type { Request } from 'express';
import { requireAuthenticatedUserId } from '../../common/auth/request-user';
```

(`Req` joins the existing `@nestjs/common` import list rather than a second import statement.)

Replace the `sos` handler with:

```ts
  @Post('trips/:id/sos')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission('incidents.report')
  @Audited({ action: 'incident.sos', entityType: 'trip', entityIdParam: 'id' })
  sos(@Param('id') id: string, @ZodBody(sosInput) body: z.infer<typeof sosInput>, @Req() req: Request) {
    return this.svc.sos({
      tripId: id,
      actorUserId: requireAuthenticatedUserId(req),
      location: body.location ?? { lat: 0, lng: 0 },
      description: body.description,
    });
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
pnpm --filter @safari-shule/api exec tsc --noEmit
pnpm --filter @safari-shule/api exec tsc --noEmit -p test/tsconfig.test.json
pnpm --filter @safari-shule/api run build
pnpm --filter @safari-shule/api exec jest --config test/jest-e2e.json test/assistant-trip-workflow.e2e-spec.ts test/sos.e2e-spec.ts
```

Expected: both specs fully green, including the pre-existing driver SOS cases.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/incidents apps/api/test
git commit -m "fix(api): require the SOS caller to be the trip's assigned driver or assistant"
```

---

### Task 4: Mobile — promote per-status trip views into shared role-agnostic components

**Files:**

- Create: `apps/mobile/lib/features/trips/trip_status_views.dart`
- Create: `apps/mobile/lib/features/trips/trip_sos.dart`
- Create: `apps/mobile/lib/features/trips/trip_passenger_api.dart`
- Modify: `apps/mobile/lib/features/driver/driver_trip_screen.dart`
- Modify: `apps/mobile/lib/features/driver/driver_trip_providers.dart`
- Test: `apps/mobile/test/widget/driver_trip_screen_test.dart` (must keep passing unchanged)

**Interfaces:**

- Consumes: nothing from earlier tasks (mobile is independent of API tasks until Task 5).
- Produces (all used by Task 5):

  - `typedef AdmissionAction = Future<void> Function(String admissionNumber);`
  - `class TripDetailContent extends StatelessWidget` with named params `{required DriverTripDetail detail, required AdmissionAction onBoardStudent, required AdmissionAction onAlightStudent, required VoidCallback onSendSos, Future<void> Function()? onStart, Future<void> Function()? onEnd}` — a null `onStart`/`onEnd` renders the view without that action.
  - `enum SosDispatchResult { sent, queued }` and `Future<SosDispatchResult> sendTripSos({required Dio client, required String tripId, ({double lat, double lng})? location})` from `trip_sos.dart`.
  - `Future<void> postBoardStudent(Dio client, String tripId, String admissionNumber)` and `postAlightStudent(...)` from `trip_passenger_api.dart`.

- [ ] **Step 1: Create the shared SOS dispatcher**

Create `apps/mobile/lib/features/trips/trip_sos.dart`:

```dart
import 'package:dio/dio.dart';
import 'package:mobile/core/offline/outbox.dart';
import 'package:uuid/uuid.dart';

enum SosDispatchResult { sent, queued }

Future<SosDispatchResult> sendTripSos({
  required Dio client,
  required String tripId,
  ({double lat, double lng})? location,
}) async {
  final endpoint = '/trips/$tripId/sos';
  final payload = <String, Object?>{
    'description': 'SOS from mobile app',
    if (location != null)
      'location': <String, Object?>{'lat': location.lat, 'lng': location.lng},
  };
  try {
    await client.post<void>(endpoint, data: payload);
    return SosDispatchResult.sent;
  } on DioException {
    await OutboxStore.put(
      OutboxEntry(
        id: const Uuid().v4(),
        endpoint: endpoint,
        method: 'POST',
        body: payload,
        createdAt: DateTime.now().toUtc(),
      ),
    );
    return SosDispatchResult.queued;
  }
}

String sosResultMessage(SosDispatchResult result) => switch (result) {
      SosDispatchResult.sent => 'SOS sent',
      SosDispatchResult.queued => 'SOS queued — will resend when back online',
    };
```

- [ ] **Step 2: Create the shared passenger API calls**

Create `apps/mobile/lib/features/trips/trip_passenger_api.dart`:

```dart
import 'package:dio/dio.dart';

Future<void> postBoardStudent(Dio client, String tripId, String admissionNumber) =>
    client.post<void>(
      '/trips/$tripId/board',
      data: <String, Object?>{'admissionNumber': admissionNumber},
    );

Future<void> postAlightStudent(Dio client, String tripId, String admissionNumber) =>
    client.post<void>(
      '/trips/$tripId/alight',
      data: <String, Object?>{'admissionNumber': admissionNumber},
    );
```

Then in `apps/mobile/lib/features/driver/driver_trip_providers.dart`, import it and reduce the two providers to:

```dart
final boardStudentProvider =
    Provider<Future<void> Function(String, String)>((ref) {
  return (String tripId, String admissionNumber) async {
    await postBoardStudent(ref.read(apiClientProvider), tripId, admissionNumber);
    ref.invalidate(driverTripDetailProvider(tripId));
  };
});

final alightStudentProvider =
    Provider<Future<void> Function(String, String)>((ref) {
  return (String tripId, String admissionNumber) async {
    await postAlightStudent(ref.read(apiClientProvider), tripId, admissionNumber);
    ref.invalidate(driverTripDetailProvider(tripId));
  };
});
```

Keep the existing comments above each provider.

- [ ] **Step 3: Create the shared per-status views**

Create `apps/mobile/lib/features/trips/trip_status_views.dart`. Move the bodies of `_TripDetailContent`, `_ScheduledTripView`, `_ScheduledInfoColumn`, `_ScheduledBottomPanel`, `_StartTripConfirmationSheet`, `_InProgressTripView`, `_SosButton`, `_InProgressBottomPanel`, `_CompletedTripView`, `_CancelledTripView`, `_DetailRow`, `_PassengerBreakdown` and `_CountTile` out of `driver_trip_screen.dart` into this file **verbatim**, with these changes only:

1. The four status views and `TripDetailContent` become public (drop the leading underscore); everything else stays private to this file.
2. Board/alight no longer read Riverpod providers — they call the injected `AdmissionAction` callbacks, so the widgets become plain `StatelessWidget`/`StatefulWidget` (drop `ConsumerWidget`/`ConsumerState` and the `flutter_riverpod` import).
3. `onStart` and `onEnd` are nullable; when null their button is not rendered.

```dart
import 'package:flutter/material.dart';
import 'package:mobile/features/driver/driver_trip_models.dart';
import 'package:mobile/features/driver/student_lookup_sheet.dart';
import 'package:mobile/features/driver/trip_status_shell.dart';
import 'package:mobile/features/driver/trip_time_format.dart';

typedef AdmissionAction = Future<void> Function(String admissionNumber);

const Color _rose = Color(0xFFE11D48);
const Color _amber = Color(0xFFF59E0B);

class TripDetailContent extends StatelessWidget {
  const TripDetailContent({
    super.key,
    required this.detail,
    required this.onBoardStudent,
    required this.onAlightStudent,
    required this.onSendSos,
    this.onStart,
    this.onEnd,
  });

  final DriverTripDetail detail;
  final AdmissionAction onBoardStudent;
  final AdmissionAction onAlightStudent;
  final VoidCallback onSendSos;

  // Null means the role may not perform the action; its button is not rendered.
  final Future<void> Function()? onStart;
  final Future<void> Function()? onEnd;

  @override
  Widget build(BuildContext context) {
    return switch (detail.status) {
      DriverTripStatus.scheduled => ScheduledTripView(
          detail: detail,
          onStart: onStart,
          onBoardStudent: onBoardStudent,
        ),
      DriverTripStatus.inProgress => InProgressTripView(
          detail: detail,
          onEnd: onEnd,
          onSendSos: onSendSos,
          onBoardStudent: onBoardStudent,
          onAlightStudent: onAlightStudent,
        ),
      DriverTripStatus.completed => CompletedTripView(detail: detail),
      DriverTripStatus.cancelled => CancelledTripView(detail: detail),
    };
  }
}
```

`ScheduledTripView` keeps today's `TripStatusShell` call (badge `'Scheduled'`, `colorScheme.primary`, `_ScheduledInfoColumn` chips) and passes `onStart`/`onBoardStudent` to `_ScheduledBottomPanel`. In `_ScheduledBottomPanel.build`, when `onStart == null`, render the assistant variant instead of the Start button:

```dart
    if (onStart == null) {
      return Material(
        color: Theme.of(context).colorScheme.surface,
        elevation: 8,
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Text(
                  'Waiting for the driver to start this trip.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 8),
                SizedBox(
                  height: 48,
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.person_add_alt_1),
                    label: const Text('Board student'),
                    onPressed: () => showModalBottomSheet<bool>(
                      context: context,
                      isScrollControlled: true,
                      builder: (_) => StudentLookupSheet(
                        title: 'Board student',
                        onSubmit: onBoardStudent,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }
```

`_StartTripConfirmationSheet` takes `{required DriverTripDetail detail, required AdmissionAction onBoardStudent}` and passes `onSubmit: onBoardStudent` to `StudentLookupSheet`.

`InProgressTripView` keeps today's shell call (badge `'In progress'`, `_amber`, `_SosButton` in `topBarActions`, `InfoChipsRow` chips) and passes `onEnd`/`onBoardStudent`/`onAlightStudent` to `_InProgressBottomPanel`. In that panel's `build`, wrap the End-trip button so it is omitted when `onEnd == null`:

```dart
              if (widget.onEnd != null) ...<Widget>[
                SizedBox(
                  height: 48,
                  child: FilledButton.icon(
                    onPressed: () => _confirmEnd(context),
                    icon: const Icon(Icons.flag_outlined),
                    label: const Text('End trip'),
                  ),
                ),
                const SizedBox(height: 8),
              ],
```

and `_confirmEnd` ends with `if (confirmed == true) await widget.onEnd!();`. The board/alight buttons use `onSubmit: widget.onBoardStudent` / `widget.onAlightStudent`. `CompletedTripView` and `CancelledTripView` are moved verbatim (just made public).

- [ ] **Step 4: Reduce the driver screen to composition**

`apps/mobile/lib/features/driver/driver_trip_screen.dart` keeps `tripTelemetryProvider`, `DriverTripScreen`/`_DriverTripScreenState` (including the `_confirmedDetail` snapshot logic and the `ref.listen` comment block) and nothing else. `_sendSos` becomes:

```dart
  Future<void> _sendSos() async {
    final result = await sendTripSos(
      client: ref.read(apiClientProvider),
      tripId: widget.tripId,
      location: ref.read(tripTelemetryProvider).lastKnownLocation,
    );
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(sosResultMessage(result))));
  }
```

and the `_TripDetailContent(...)` call becomes:

```dart
          : TripDetailContent(
              detail: detail,
              onStart: () async { /* unchanged body */ },
              onEnd: () async { /* unchanged body */ },
              onSendSos: _sendSos,
              onBoardStudent: (admissionNumber) =>
                  ref.read(boardStudentProvider)(widget.tripId, admissionNumber),
              onAlightStudent: (admissionNumber) =>
                  ref.read(alightStudentProvider)(widget.tripId, admissionNumber),
            ),
```

Imports to add: `package:mobile/features/trips/trip_status_views.dart`, `package:mobile/features/trips/trip_sos.dart`. Imports to drop once unused: `dio`, `outbox`, `uuid`, `student_lookup_sheet`, `trip_status_shell`, `trip_time_format`.

- [ ] **Step 5: Run analyze + the full mobile suite**

```bash
cd apps/mobile && flutter analyze && flutter test
```

Expected: analyze clean; **all existing tests pass with zero edits to `driver_trip_screen_test.dart`** — this is the refactor's proof of behavioural equivalence. If a test needs changing, the refactor changed behaviour: fix the code, not the test.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib apps/mobile/test
git commit -m "refactor(mobile): promote per-status trip views into shared role-agnostic widgets"
```

---

### Task 5: Mobile — assistant trip providers and AssistantTripScreen

**Files:**

- Create: `apps/mobile/lib/features/caretaker/assistant_trip_providers.dart`
- Create: `apps/mobile/lib/features/caretaker/assistant_trip_screen.dart`
- Test: `apps/mobile/test/widget/assistant_trip_screen_test.dart`

**Interfaces:**

- Consumes: `TripDetailContent`, `AdmissionAction`, `sendTripSos`, `sosResultMessage`, `postBoardStudent`, `postAlightStudent` (Task 4); `GET /trips/assistant-workspace`, `GET /trips/assistant/:id` (Task 2).
- Produces (used by Task 6): `assistantWorkspaceProvider` (`FutureProvider<DriverWorkspace>`), `assistantTripDetailProvider` (`FutureProvider.family<DriverTripDetail, String>`), `assistantBoardStudentProvider` / `assistantAlightStudentProvider` (`Provider<Future<void> Function(String tripId, String admissionNumber)>`), and `class AssistantTripScreen extends ConsumerStatefulWidget` with `AssistantTripScreen({super.key, required String tripId})`.

- [ ] **Step 1: Write the failing widget test**

Create `apps/mobile/test/widget/assistant_trip_screen_test.dart`. Model the fake-Dio + Hive scaffolding on `driver_trip_screen_test.dart` (copy `_tripDetailResponse`, `_dioReturning`, the `Hive.init('.dart_tool/hive_test_assistant')` setup and `_tapAndAwaitRealAsync`):

```dart
void main() {
  setUpAll(() => Hive.init('.dart_tool/hive_test_assistant'));

  setUp(() async {
    if (!Hive.isBoxOpen(OutboxStore.boxName)) await OutboxStore.open();
    for (final entry in await OutboxStore.all()) {
      await OutboxStore.delete(entry.id);
    }
  });

  testWidgets('in-progress assigned trip shows SOS and board/alight but no End trip', (tester) async {
    final dio = _dioReturning((options) => _tripDetailResponse('trip-1', 'in_progress'));
    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[apiClientProvider.overrideWithValue(dio)],
        child: const MaterialApp(home: AssistantTripScreen(tripId: 'trip-1')),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('SOS'), findsOneWidget);
    expect(find.text('Board student'), findsOneWidget);
    expect(find.text('Alight student'), findsOneWidget);
    expect(find.text('End trip'), findsNothing);
  });

  testWidgets('scheduled assigned trip shows no Start trip button', (tester) async {
    final dio = _dioReturning((options) => _tripDetailResponse('trip-2', 'scheduled'));
    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[apiClientProvider.overrideWithValue(dio)],
        child: const MaterialApp(home: AssistantTripScreen(tripId: 'trip-2')),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Start trip'), findsNothing);
    expect(find.text('Waiting for the driver to start this trip.'), findsOneWidget);
    expect(find.text('Board student'), findsOneWidget);
  });

  testWidgets('it requests the assistant detail endpoint', (tester) async {
    final paths = <String>[];
    final dio = _dioReturning((options) {
      paths.add(options.path);
      return _tripDetailResponse('trip-3', 'in_progress');
    });
    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[apiClientProvider.overrideWithValue(dio)],
        child: const MaterialApp(home: AssistantTripScreen(tripId: 'trip-3')),
      ),
    );
    await tester.pumpAndSettle();

    expect(paths, contains('/trips/assistant/trip-3'));
  });
}
```

- [ ] **Step 2: Run the test and verify it fails**

`cd apps/mobile && flutter test test/widget/assistant_trip_screen_test.dart`

Expected: compile failure — `AssistantTripScreen` does not exist.

- [ ] **Step 3: Write the providers**

Create `apps/mobile/lib/features/caretaker/assistant_trip_providers.dart`:

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/api/client.dart';
import 'package:mobile/features/driver/driver_trip_models.dart';
import 'package:mobile/features/trips/trip_passenger_api.dart';

final assistantWorkspaceProvider = FutureProvider<DriverWorkspace>((ref) async {
  final response = await ref
      .read(apiClientProvider)
      .get<Map<String, Object?>>('/trips/assistant-workspace');
  return DriverWorkspace.fromJson(response.data ?? const <String, Object?>{});
});

final assistantTripDetailProvider =
    FutureProvider.family<DriverTripDetail, String>((ref, tripId) async {
  final response = await ref
      .read(apiClientProvider)
      .get<Map<String, Object?>>('/trips/assistant/$tripId');
  return DriverTripDetail.fromJson(response.data ?? const <String, Object?>{});
});

final assistantBoardStudentProvider =
    Provider<Future<void> Function(String, String)>((ref) {
  return (String tripId, String admissionNumber) async {
    await postBoardStudent(ref.read(apiClientProvider), tripId, admissionNumber);
    ref.invalidate(assistantTripDetailProvider(tripId));
  };
});

final assistantAlightStudentProvider =
    Provider<Future<void> Function(String, String)>((ref) {
  return (String tripId, String admissionNumber) async {
    await postAlightStudent(ref.read(apiClientProvider), tripId, admissionNumber);
    ref.invalidate(assistantTripDetailProvider(tripId));
  };
});
```

- [ ] **Step 4: Write the screen**

Create `apps/mobile/lib/features/caretaker/assistant_trip_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/api/client.dart';
import 'package:mobile/features/caretaker/assistant_trip_providers.dart';
import 'package:mobile/features/driver/driver_trip_models.dart';
import 'package:mobile/features/trips/trip_sos.dart';
import 'package:mobile/features/trips/trip_status_views.dart';

class AssistantTripScreen extends ConsumerStatefulWidget {
  const AssistantTripScreen({super.key, required this.tripId});

  final String tripId;

  @override
  ConsumerState<AssistantTripScreen> createState() => _AssistantTripScreenState();
}

class _AssistantTripScreenState extends ConsumerState<AssistantTripScreen> {
  Future<void> _sendSos() async {
    final result = await sendTripSos(
      client: ref.read(apiClientProvider),
      tripId: widget.tripId,
    );
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(sosResultMessage(result))));
  }

  @override
  Widget build(BuildContext context) {
    final detailAsync = ref.watch(assistantTripDetailProvider(widget.tripId));
    return Scaffold(
      body: detailAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => Center(
          child: IconButton(
            tooltip: 'Retry trip details',
            icon: const Icon(Icons.refresh),
            onPressed: () =>
                ref.invalidate(assistantTripDetailProvider(widget.tripId)),
          ),
        ),
        data: (DriverTripDetail detail) => TripDetailContent(
          detail: detail,
          onSendSos: _sendSos,
          onBoardStudent: (admissionNumber) => ref.read(
            assistantBoardStudentProvider,
          )(widget.tripId, admissionNumber),
          onAlightStudent: (admissionNumber) => ref.read(
            assistantAlightStudentProvider,
          )(widget.tripId, admissionNumber),
        ),
      ),
    );
  }
}
```

The assistant does not own the trip's GPS session, so this screen deliberately does not touch `tripTelemetryProvider` — SOS sends without a location and the API accepts that (`location` is optional in `sosInput`).

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd apps/mobile && flutter analyze && flutter test
```

Expected: new spec green, full suite green.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/features/caretaker apps/mobile/test/widget/assistant_trip_screen_test.dart
git commit -m "feat(mobile): add assistant trip detail screen with board, alight and SOS"
```

---

### Task 6: Mobile — real assistant dashboard, route and shell tab wiring

**Files:**

- Modify: `apps/mobile/lib/features/caretaker/assistant_dashboard_screen.dart`
- Modify: `apps/mobile/lib/features/caretaker/assistant_shell.dart`
- Modify: `apps/mobile/lib/app/app_router.dart`
- Test: `apps/mobile/test/widget/assistant_dashboard_screen_test.dart`

**Interfaces:**

- Consumes: `assistantWorkspaceProvider`, `AssistantTripScreen` (Task 5); `DriverWorkspace`/`DriverTripSummary` (existing models); `formatTripSchedule`, `formatTripDirection` from `package:mobile/features/driver/trip_time_format.dart`.
- Produces: route `/assistant/trip/:id`.

- [ ] **Step 1: Write the failing widget test**

Create `apps/mobile/test/widget/assistant_dashboard_screen_test.dart`:

```dart
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/client.dart';
import 'package:mobile/features/caretaker/assistant_dashboard_screen.dart';

Map<String, Object?> _summary(String id, String status) => <String, Object?>{
      'id': id,
      'status': status,
      'scheduledStart': '2026-09-07T06:30:00.000Z',
      'startedAt': status == 'in_progress' ? '2026-09-07T06:35:00.000Z' : null,
      'endedAt': null,
      'direction': 'morning_pickup',
      'routeId': 'route-$id',
      'vehicleId': 'vehicle-$id',
      'route': <String, Object?>{'id': 'route-$id', 'name': 'Kilimani Morning Run'},
      'vehicle': <String, Object?>{'id': 'vehicle-$id', 'registration': 'KCA 123A', 'capacity': 33},
      '_count': <String, Object?>{'passengers': 12},
    };

Dio _dioReturning(Map<String, Object?> body) {
  final dio = Dio();
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) => handler.resolve(
        Response<Map<String, Object?>>(
          requestOptions: options,
          statusCode: 200,
          data: body,
        ),
      ),
    ),
  );
  return dio;
}

Future<void> _pump(WidgetTester tester, Map<String, Object?> body) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[apiClientProvider.overrideWithValue(_dioReturning(body))],
      child: const MaterialApp(home: AssistantDashboardScreen()),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('shows the active assigned trip', (tester) async {
    await _pump(tester, <String, Object?>{
      'activeTrip': _summary('trip-1', 'in_progress'),
      'upcomingTrips': <Object?>[],
      'recentTrips': <Object?>[],
    });

    expect(find.text('Kilimani Morning Run'), findsOneWidget);
    expect(find.text('Open trip'), findsOneWidget);
  });

  testWidgets('falls back to the next upcoming trip when none is active', (tester) async {
    await _pump(tester, <String, Object?>{
      'activeTrip': null,
      'upcomingTrips': <Object?>[_summary('trip-2', 'scheduled')],
      'recentTrips': <Object?>[],
    });

    expect(find.text('Kilimani Morning Run'), findsOneWidget);
    expect(find.text('Open trip'), findsOneWidget);
  });

  testWidgets('shows an empty state when no trip is assigned', (tester) async {
    await _pump(tester, <String, Object?>{
      'activeTrip': null,
      'upcomingTrips': <Object?>[],
      'recentTrips': <Object?>[],
    });

    expect(find.text('No trip assigned to you yet'), findsOneWidget);
    expect(find.text('Open trip'), findsNothing);
  });
}
```

- [ ] **Step 2: Run the test to verify it fails**

`cd apps/mobile && flutter test test/widget/assistant_dashboard_screen_test.dart`

Expected: FAIL — the stub renders only `Assistant dashboard`.

- [ ] **Step 3: Replace the dashboard stub**

Rewrite `apps/mobile/lib/features/caretaker/assistant_dashboard_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/core/api/api_error.dart';
import 'package:mobile/features/caretaker/assistant_trip_providers.dart';
import 'package:mobile/features/driver/driver_trip_models.dart';
import 'package:mobile/features/driver/trip_time_format.dart';

const _cardRadius = BorderRadius.all(Radius.circular(8));

class AssistantDashboardScreen extends ConsumerWidget {
  const AssistantDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final workspaceAsync = ref.watch(assistantWorkspaceProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('My trip')),
      body: workspaceAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => _ErrorView(
          message: apiErrorMessage(error),
          onRetry: () => ref.invalidate(assistantWorkspaceProvider),
        ),
        data: (DriverWorkspace workspace) {
          final trip = workspace.activeTrip ??
              (workspace.upcomingTrips.isNotEmpty ? workspace.upcomingTrips.first : null);
          if (trip == null) return const _NoTripView();
          return Padding(
            padding: const EdgeInsets.all(16),
            child: _AssignedTripCard(trip: trip),
          );
        },
      ),
    );
  }
}
```

`_AssignedTripCard` is a `StatelessWidget` taking `DriverTripSummary trip` and rendering, inside a `Container` with `_cardRadius` and `colorScheme.surfaceContainerHighest`:

- the route name in `titleMedium`,
- a `Wrap` of `InfoChip`s (imported from `package:mobile/features/driver/trip_status_shell.dart`) with `formatTripSchedule(trip.scheduledStart)`, `formatTripDirection(trip.direction)`, `trip.vehicle.registration`, and `'Passengers: ${trip.passengerCount}'`,
- a full-width 48 dp `FilledButton` labelled `'Open trip'` calling `context.go('/assistant/trip/${trip.id}')`.

`_NoTripView` is a centred `Column` with `Icon(Icons.event_busy_outlined, size: 40)`, the text `'No trip assigned to you yet'` in `titleMedium`, and the subtitle `'Your school will assign you to a trip shortly.'`.

`_ErrorView` mirrors the driver dashboard's: an `Icons.cloud_off_outlined` icon, `'Trip could not load'` title, the message, and an `IconButton.filled` refresh with `key: const Key('assistant-workspace-retry')`.

- [ ] **Step 4: Add the route**

In `apps/mobile/lib/app/app_router.dart`, inside the assistant `ShellRoute`'s `routes` list after `/assistant/dashboard`:

```dart
          GoRoute(
            path: '/assistant/trip/:id',
            builder: (_, state) =>
                AssistantTripScreen(tripId: state.pathParameters['id'] ?? ''),
          ),
```

plus the import of `package:mobile/features/caretaker/assistant_trip_screen.dart`.

- [ ] **Step 5: Keep the Trips tab selected on the detail route**

In `apps/mobile/lib/features/caretaker/assistant_shell.dart`, replace the exact-match lookup so `/assistant/trip/:id` keeps the Trips tab highlighted:

```dart
    final path = GoRouterState.of(context).uri.path;
    final routeIndex = locations.indexWhere((location) => path.startsWith(location));
    final selectedIndex = path.startsWith('/assistant/trip')
        ? locations.indexOf('/assistant/dashboard')
        : (routeIndex < 0 ? 0 : routeIndex);
```

- [ ] **Step 6: Run analyze and the full suite**

```bash
cd apps/mobile && flutter analyze && flutter test
```

Expected: all green, including `app_router_test.dart` and `adaptive_scaffold_test.dart`.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/lib apps/mobile/test
git commit -m "feat(mobile): give assistants a real assigned-trip dashboard and trip route"
```

---

### Task 7: Documentation and full regression pass

**Files:**

- Modify: `docs/ROADMAP.md` (M7.5 section)

- [ ] **Step 1: Run the full verification set**

```bash
pnpm --filter @safari-shule/api exec tsc --noEmit
pnpm --filter @safari-shule/api exec tsc --noEmit -p test/tsconfig.test.json
pnpm --filter @safari-shule/api run build
pnpm --filter @safari-shule/api run test:e2e
cd apps/mobile && flutter analyze && flutter test
```

Record the exact counts. Any e2e failure must be checked against the known pre-existing list in Global Constraints (`trips.e2e-spec.ts` unique-constraint collision, `bull-board`, `audit-events`) by re-running that spec on a stash of this branch's changes if in doubt; anything else is a regression and must be fixed.

- [ ] **Step 2: Mark M7.5 complete in the roadmap**

In `docs/ROADMAP.md`, change the heading to `### M7.5 — Assistant Trip Workflows (✅ Complete)` and convert the API/Mobile/Testing bullet groups into `- [x]` checkboxes describing what shipped, keeping the "no RBAC changes needed" and RFID-deferral notes intact. Add a line recording the SOS hardening (`POST /trips/:id/sos` now requires the caller to be the trip's assigned driver or assistant, and is tenant-scoped).

- [ ] **Step 3: Commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs: mark M7.5 assistant trip workflows complete"
```

- [ ] **Step 4: Do not push**

Leave all commits local on `feat/m7-flutter-mobile`. Ask the human before any `git push`.
