# Driver Trip Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a driver-only, task-first trip workflow with one database-enforced active trip, reliable resume behavior, server-backed status actions, and useful maps for every trip state.

**Architecture:** NestJS exposes JWT-scoped driver workspace and detail contracts while PostgreSQL enforces one `in_progress` trip per tenant and driver. Flutter uses typed immutable domain models and Riverpod providers; the dashboard promotes the active or next trip, the detail screen derives actions and map layers from server status, and an app-level coordinator restores telemetry after login or resume.

**Tech Stack:** Node 20.11.0, pnpm 9, NestJS 10.4.4, TypeScript 5.5.4 strict, Prisma 5.20.0, PostgreSQL 16/PostGIS 3.4, Zod 3.23.8, Flutter 3.47.1/Dart 3.13.1, Riverpod 3, Dio 5, flutter_map 8, flutter_test.

## Global Constraints

- Preserve tenant scoping: driver queries derive tenant and user identity from the JWT and never accept a driver ID.
- Preserve existing generic admin trip APIs and existing client response fields.
- Every trip create continues to pass an explicit tenant ID under request context rules.
- The database, not the mobile client, is the final authority for one active trip.
- Trip status comes only from server responses; no optimistic start/end state transitions.
- Planned maps use start point, ordered stops, and end point as an operational polyline, not road navigation.
- Cards use at most 8 dp radius, touch targets are at least 48 dp, and status is not conveyed by color alone.
- Keep existing offline SOS and telemetry outbox behavior.
- Leave the unrelated CocoaPods worktree changes untouched.

---

## File Structure

### API and shared contracts

- Modify `packages/shared-types/src/errors.ts`: add the stable `TRIP_ALREADY_ACTIVE` error code.
- Modify `apps/api/prisma/schema.prisma`: persist `Trip.cancellationReason`.
- Create `apps/api/prisma/migrations/0006_driver_trip_invariant/migration.sql`: add cancellation reason and the partial unique driver index with a duplicate precondition.
- Modify `apps/api/src/modules/trips/trips.controller.ts`: pass cancellation reasons and add driver workspace/detail routes before `:id`.
- Modify `apps/api/src/modules/trips/trips.service.ts`: centralize start logic, map unique races, scope driver reads, shape map/passenger data, and persist cancellation reasons.
- Modify `apps/api/test/trips.e2e-spec.ts`: verify cancellation persistence and one-active-trip behavior for driver, dispatch, reassignment, and concurrency.
- Create `apps/api/test/driver-workspace.e2e-spec.ts`: verify JWT-scoped workspace/detail contracts and ordering.

### Flutter domain and UI

- Create `apps/mobile/lib/features/driver/driver_trip_models.dart`: immutable parsing models and status/map policy.
- Create `apps/mobile/lib/features/driver/driver_trip_providers.dart`: workspace/detail fetch and transition providers.
- Create `apps/mobile/lib/features/driver/driver_trip_map.dart`: planned, travelled, live, and cancelled map layers.
- Modify `apps/mobile/lib/core/realtime/ws_gateway.dart`: expose socket connection health with trip events.
- Rewrite `apps/mobile/lib/features/driver/driver_dashboard_screen.dart`: task-first command center.
- Rewrite `apps/mobile/lib/features/driver/driver_trip_screen.dart`: server-backed status detail and confirmations.
- Create `apps/mobile/lib/features/driver/driver_trip_coordinator.dart`: lifecycle-aware, idempotent telemetry restoration.
- Modify `apps/mobile/lib/core/telemetry/trip_telemetry_service.dart`: expose current trip and make start/stop idempotent.
- Modify `apps/mobile/lib/app/app.dart`: own the lifecycle coordinator.
- Update `apps/mobile/test/widget/driver_trip_screen_test.dart`: status/action/map/confirmation behavior.
- Create `apps/mobile/test/unit/driver_trip_models_test.dart`: JSON parsing and map policy.
- Create `apps/mobile/test/unit/trip_telemetry_service_test.dart`: idempotent coordinator behavior through a test double boundary.
- Create `apps/mobile/test/widget/driver_dashboard_screen_test.dart`: active-first, next-trip, recent, empty, and error states.

---

### Task 1: Persist Cancellation Reasons and Enforce One Active Trip

**Files:**

- Modify: `packages/shared-types/src/errors.ts`
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/0006_driver_trip_invariant/migration.sql`
- Modify: `apps/api/src/modules/trips/trips.controller.ts`
- Modify: `apps/api/src/modules/trips/trips.service.ts`
- Modify: `apps/api/test/trips.e2e-spec.ts`

**Interfaces:**

- Produces `ERROR_CODES.TRIP_ALREADY_ACTIVE`.
- Produces `Trip.cancellationReason: string | null`.
- Produces a `409` API error shaped as `{ code, message, details: { activeTripId } }`.
- Produces a shared invariant-aware `startTrip(id, assignedDriverUserId?)` service path used by driver and dispatch starts.

- [ ] **Step 1: Add failing e2e coverage for cancellation persistence and competing starts**

Extend the fixture to keep two scheduled trip IDs for `alpha.driverUserId`. Add tests with these assertions:

```ts
it('persists the validated cancellation reason', async () => {
  const response = await request(app.getHttpServer())
    .post(`/v1/trips/${alphaSecondTripId}/cancel`)
    .set('Authorization', `Bearer ${alpha.adminAccessToken}`)
    .set('x-tenant-id', alpha.tenantId)
    .send({ reason: 'Vehicle unavailable after inspection.' });

  expect(response.status).toBe(201);
  expect(response.body).toMatchObject({
    status: 'cancelled',
    cancellationReason: 'Vehicle unavailable after inspection.',
  });
});

it('returns the active trip when the driver starts a second trip', async () => {
  await runWithBypass(() =>
    prisma.trip.update({
      where: { id: alphaTripId },
      data: { status: 'in_progress', startedAt: new Date(), endedAt: null },
    }),
  );

  const response = await request(app.getHttpServer())
    .post(`/v1/trips/${alphaSecondTripId}/driver-start`)
    .set('Authorization', `Bearer ${alpha.driverAccessToken}`)
    .set('x-tenant-id', alpha.tenantId);

  expect(response.status).toBe(409);
  expect(response.body).toMatchObject({
    code: 'TRIP_ALREADY_ACTIVE',
    details: { activeTripId: alphaTripId },
  });
});

it('allows only one winner when two assigned trips start concurrently', async () => {
  await resetDriverTripsToScheduled();

  const responses = await Promise.all([
    request(app.getHttpServer())
      .post(`/v1/trips/${alphaTripId}/driver-start`)
      .set('Authorization', `Bearer ${alpha.driverAccessToken}`)
      .set('x-tenant-id', alpha.tenantId),
    request(app.getHttpServer())
      .post(`/v1/trips/${alphaSecondTripId}/driver-start`)
      .set('Authorization', `Bearer ${alpha.driverAccessToken}`)
      .set('x-tenant-id', alpha.tenantId),
  ]);

  expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
  const activeCount = await runWithBypass(() =>
    prisma.trip.count({
      where: {
        tenantId: alpha.tenantId,
        driverUserId: alpha.driverUserId,
        status: 'in_progress',
      },
    }),
  );
  expect(activeCount).toBe(1);
});
```

Add a dispatch second-start request to `/v1/trips/:id/start` and an in-progress reassignment request to `/v1/trips/:id/assignment`. Seed the target driver with `alphaTripId` in progress before each request. Assert both responses have status `409`, code `TRIP_ALREADY_ACTIVE`, and `details.activeTripId == alphaTripId`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
pnpm --filter @safari-shule/api run test:e2e -- --runTestsByPath test/trips.e2e-spec.ts
```

Expected: cancellation reason is absent and competing starts do not consistently return `409`.

- [ ] **Step 3: Add the shared error and Prisma field**

Add to `ERROR_CODES`:

```ts
TRIP_ALREADY_ACTIVE: 'TRIP_ALREADY_ACTIVE',
```

Add to `Trip` next to `endedAt`:

```prisma
cancellationReason String?
```

- [ ] **Step 4: Create the migration with an explicit duplicate precondition**

Create `0006_driver_trip_invariant/migration.sql`:

```sql
ALTER TABLE "trips"
  ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;

DO $$
DECLARE
  duplicate_record RECORD;
BEGIN
  SELECT "tenantId", "driverUserId", COUNT(*) AS active_count
  INTO duplicate_record
  FROM "trips"
  WHERE "status" = 'in_progress'
  GROUP BY "tenantId", "driverUserId"
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'Cannot add one-active-trip invariant: tenant %, driver % has % active trips',
      duplicate_record."tenantId",
      duplicate_record."driverUserId",
      duplicate_record.active_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "trips_one_active_per_driver_idx"
  ON "trips"("tenantId", "driverUserId")
  WHERE "status" = 'in_progress';
```

Apply and regenerate:

```bash
make db-migrate
make db-generate
```

Expected: migration deploys or aborts with the exact duplicate driver information; Prisma generation succeeds.

- [ ] **Step 5: Centralize invariant-aware starts and cancellation persistence**

In `TripsService`, import `ConflictException`, `Prisma`, and `ERROR_CODES`. Add:

```ts
private activeTripConflict(activeTripId: string): ConflictException {
  return new ConflictException({
    code: ERROR_CODES.TRIP_ALREADY_ACTIVE,
    message: 'Driver already has a trip in progress.',
    details: { activeTripId },
  });
}

private async findActiveTripId(
  tenantId: string,
  driverUserId: string,
  excludeTripId?: string,
): Promise<string | null> {
  const active = await this.prisma.trip.findFirst({
    where: {
      tenantId,
      driverUserId,
      status: 'in_progress',
      ...(excludeTripId ? { id: { not: excludeTripId } } : {}),
    },
    select: { id: true },
  });
  return active?.id ?? null;
}
```

Replace duplicate start updates with this shared operation and keep the public methods as delegates:

```ts
private async startTrip(id: string, assignedDriverUserId?: string) {
  const trip = await this.prisma.trip.findFirst({
    where: {
      id,
      ...(assignedDriverUserId ? { driverUserId: assignedDriverUserId } : {}),
    },
  });
  if (!trip) throw new NotFoundException();
  if (trip.status !== 'scheduled') {
    throw new BadRequestException({ code: 'TRIP_NOT_SCHEDULED' });
  }

  const activeTripId = await this.findActiveTripId(
    trip.tenantId,
    trip.driverUserId,
    trip.id,
  );
  if (activeTripId) throw this.activeTripConflict(activeTripId);

  try {
    return await this.prisma.trip.update({
      where: { id: trip.id },
      data: { status: 'in_progress', startedAt: new Date() },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const winnerId = await this.findActiveTripId(trip.tenantId, trip.driverUserId);
      if (winnerId) throw this.activeTripConflict(winnerId);
    }
    throw error;
  }
}

start(id: string) {
  return this.startTrip(id);
}

startForAssignedDriver(id: string, driverUserId: string) {
  return this.startTrip(id, driverUserId);
}
```

In `updateAssignment`, when an in-progress trip gets a new driver, call `findActiveTripId(tenantId, nextDriverUserId, id)` before update and return the same conflict if found. Catch the same unique race around the update.

Change cancellation to:

```ts
async cancel(id: string, reason: string) {
  const trip = await this.prisma.trip.findFirst({ where: { id } });
  if (!trip) throw new NotFoundException();
  if (trip.status === 'completed' || trip.status === 'cancelled') {
    throw new BadRequestException({ code: 'TRIP_FINAL_STATE' });
  }
  return this.prisma.trip.update({
    where: { id },
    data: {
      status: 'cancelled',
      endedAt: new Date(),
      cancellationReason: reason,
    },
  });
}
```

Pass `body.reason` from the controller.

- [ ] **Step 6: Run the focused tests and verify GREEN**

Run:

```bash
pnpm --filter @safari-shule/api run test:e2e -- --runTestsByPath test/trips.e2e-spec.ts
pnpm --filter @safari-shule/api exec tsc --noEmit
```

Expected: all trip e2e tests pass and TypeScript reports no errors.

- [ ] **Step 7: Commit the invariant**

```bash
git add packages/shared-types/src/errors.ts apps/api/prisma/schema.prisma apps/api/prisma/migrations/0006_driver_trip_invariant/migration.sql apps/api/src/modules/trips/trips.controller.ts apps/api/src/modules/trips/trips.service.ts apps/api/test/trips.e2e-spec.ts
git commit -m "feat(trips): enforce one active driver trip"
```

---

### Task 2: Add JWT-Scoped Driver Workspace and Detail Contracts

**Files:**

- Create: `apps/api/test/driver-workspace.e2e-spec.ts`
- Modify: `apps/api/src/modules/trips/trips.controller.ts`
- Modify: `apps/api/src/modules/trips/trips.service.ts`

**Interfaces:**

- Produces `GET /v1/trips/driver-workspace` returning `activeTrip`, `upcomingTrips`, and at most 20 `recentTrips`.
- Produces `GET /v1/trips/driver/:id` returning route control points, vehicle, passenger counts, snapshots, and cancellation reason.
- Both endpoints derive `driverUserId` from `req.user.userId` and return `404` for unassigned trips.

- [ ] **Step 1: Write failing workspace and detail e2e tests**

Seed active, upcoming, completed, cancelled, other-driver, and other-tenant trips. Assert:

```ts
const workspace = await request(app.getHttpServer())
  .get('/v1/trips/driver-workspace')
  .set('Authorization', `Bearer ${alpha.driverAccessToken}`)
  .set('x-tenant-id', alpha.tenantId)
  .expect(200);

expect(workspace.body.activeTrip.id).toBe(activeTripId);
expect(workspace.body.upcomingTrips.map((trip: { id: string }) => trip.id)).toEqual([
  nextTripId,
  laterTripId,
]);
expect(workspace.body.recentTrips.map((trip: { id: string }) => trip.id)).toEqual([
  latestFinalTripId,
  olderFinalTripId,
]);
expect(JSON.stringify(workspace.body)).not.toContain(otherDriverTripId);
expect(JSON.stringify(workspace.body)).not.toContain(betaTripId);
```

For detail, assert exact coordinates and counts:

```ts
expect(detail.body).toMatchObject({
  id: activeTripId,
  route: {
    name: 'Alpha Route',
    startPoint: { lat: -1.2864, lng: 36.8219 },
    endPoint: { lat: -1.3, lng: 36.83 },
    busStops: [
      {
        name: 'Junction A',
        pickupOrder: 1,
        location: { lat: -1.29, lng: 36.825 },
      },
    ],
  },
  vehicle: { registration: expect.any(String) },
  passengerSummary: {
    expected: 2,
    boarded: 2,
    onBoard: 1,
    alighted: 1,
  },
});
expect(detail.body.locationSnapshots).toEqual([
  expect.objectContaining({ lat: -1.2921, lng: 36.8219 }),
]);
```

Assert another driver's trip and a beta trip both return `404` to the alpha driver. Seed 21 final trips and assert only 20 return.

- [ ] **Step 2: Run the new test and verify RED**

```bash
pnpm --filter @safari-shule/api run test:e2e -- --runTestsByPath test/driver-workspace.e2e-spec.ts
```

Expected: `404` because both routes are absent.

- [ ] **Step 3: Add routes in static-before-parameter order**

Place these before `@Get(':id')`:

```ts
@Get('driver-workspace')
@RequirePermission('trips.view')
driverWorkspace(@Req() req: Request) {
  return this.svc.driverWorkspace(requireAuthenticatedUserId(req));
}

@Get('driver/:id')
@RequirePermission('trips.view')
driverDetail(@Param('id') id: string, @Req() req: Request) {
  return this.svc.driverDetail(id, requireAuthenticatedUserId(req));
}
```

- [ ] **Step 4: Implement workspace summaries**

Add `driverWorkspace(driverUserId: string)` using three scoped Prisma queries. Select only mobile summary fields plus `route.name` and `vehicle.registration`. Use:

```ts
const summaryInclude = {
  route: { select: { id: true, name: true } },
  vehicle: { select: { id: true, registration: true, capacity: true } },
  _count: { select: { passengers: true } },
} satisfies Prisma.TripInclude;
```

Query active with `findFirst`, upcoming with ascending `scheduledStart`, and recent with `status: { in: ['completed', 'cancelled'] }`, `take: 20`, and ordering by `endedAt desc`, then `scheduledStart desc`.

- [ ] **Step 5: Implement owned detail with PostGIS coordinate extraction**

First load the owned row with:

```ts
where: {
  id, driverUserId;
}
```

Include vehicle and passengers, then aggregate passenger counts in TypeScript. Use one tenant-scoped raw SQL query joining `routes` and `bus_stops` to extract points with `ST_Y(location::geometry)` and `ST_X(location::geometry)`, ordered by `pickupOrder`. Use the existing snapshot extraction query ordered by `recordedAt`; alias JSON response fields to `lat`, `lng`, `speedKph`, `headingDeg`, and `recordedAt`.

Return:

```ts
{
  ...trip,
  route: {
    id: route.id,
    name: route.name,
    startPoint: route.startPoint,
    endPoint: route.endPoint,
    busStops: route.busStops,
  },
  vehicle: trip.vehicle,
  passengerSummary,
  locationSnapshots,
}
```

Every raw query must include both trip/route ID and `tenantId` from the owned row.

- [ ] **Step 6: Verify workspace contracts GREEN**

```bash
pnpm --filter @safari-shule/api run test:e2e -- --runTestsByPath test/driver-workspace.e2e-spec.ts
pnpm --filter @safari-shule/api exec tsc --noEmit -p test/tsconfig.test.json
pnpm --filter @safari-shule/api run build
```

Expected: new e2e suite passes; test and production TypeScript compile.

- [ ] **Step 7: Commit the driver APIs**

```bash
git add apps/api/test/driver-workspace.e2e-spec.ts apps/api/src/modules/trips/trips.controller.ts apps/api/src/modules/trips/trips.service.ts
git commit -m "feat(api): add driver trip workspace"
```

---

### Task 3: Add Typed Mobile Trip Models and Map Policy

**Files:**

- Create: `apps/mobile/lib/features/driver/driver_trip_models.dart`
- Create: `apps/mobile/test/unit/driver_trip_models_test.dart`

**Interfaces:**

- Produces `DriverTripStatus`, `DriverTripSummary`, `DriverTripDetail`, `DriverWorkspace`, `TripPoint`, `TripStop`, `PassengerSummary`, and `TripMapPolicy`.
- Produces `plannedPoints`, `travelledPoints`, `primaryAction`, and `mapMode` derived from immutable server state.

- [ ] **Step 1: Write failing parsing and policy tests**

Cover all four statuses, ISO timestamps, integer-to-double coordinates, malformed required fields, ordered planned points, zero/one snapshot behavior, cancelled-before-start, and cancelled-after-start.

```dart
test('active trip policy resumes and overlays travelled path', () {
  final detail = DriverTripDetail.fromJson(activeTripJson);

  expect(detail.status, DriverTripStatus.inProgress);
  expect(detail.primaryAction, DriverTripAction.resume);
  expect(detail.mapMode, TripMapMode.live);
  expect(detail.plannedPoints, hasLength(3));
  expect(detail.travelledPoints, hasLength(2));
});

test('cancelled trip with snapshots shows planned and travelled paths', () {
  final detail = DriverTripDetail.fromJson(cancelledTripJson);

  expect(detail.primaryAction, DriverTripAction.none);
  expect(detail.mapMode, TripMapMode.cancelledPartial);
});
```

- [ ] **Step 2: Run the model test and verify RED**

```bash
cd apps/mobile
flutter test test/unit/driver_trip_models_test.dart
```

Expected: compile failure because the model file does not exist.

- [ ] **Step 3: Implement hand-written immutable models**

Use enums with exhaustive switch parsing and `final` fields. Keep JSON parsing in named `fromJson(Map<String, Object?> json)` factory constructors. Do not add generated files for these small API models.

Define policy enums:

```dart
enum DriverTripStatus { scheduled, inProgress, completed, cancelled }
enum DriverTripAction { start, resume, none }
enum TripMapMode { planned, live, travelled, cancelledPlanned, cancelledPartial }
```

Define `plannedPoints` as `[route.startPoint, ...route.busStops.map((stop) => stop.location), route.endPoint]`. Define `travelledPoints` from ordered snapshots. Derive map mode exclusively from status and whether snapshots are empty.

- [ ] **Step 4: Verify model tests GREEN**

```bash
flutter test test/unit/driver_trip_models_test.dart
flutter analyze
```

Expected: all model tests pass and analyzer reports no issues.

- [ ] **Step 5: Commit the domain layer**

```bash
git add apps/mobile/lib/features/driver/driver_trip_models.dart apps/mobile/test/unit/driver_trip_models_test.dart
git commit -m "feat(mobile): model driver trip states"
```

---

### Task 4: Build the Driver Providers and Task-First Dashboard

**Files:**

- Create: `apps/mobile/lib/features/driver/driver_trip_providers.dart`
- Create: `apps/mobile/lib/features/driver/driver_trip_map.dart`
- Rewrite: `apps/mobile/lib/features/driver/driver_dashboard_screen.dart`
- Create: `apps/mobile/test/widget/driver_dashboard_screen_test.dart`

**Interfaces:**

- Consumes `DriverWorkspace` and `DriverTripSummary` from Task 3.
- Produces `driverWorkspaceProvider`, `driverTripDetailProvider`, `startDriverTripProvider`, and `endDriverTripProvider`.
- Dashboard navigation remains `/driver/trip/:id`.

- [ ] **Step 1: Write failing dashboard widget tests**

Override `driverWorkspaceProvider` with active, no-active, empty, loading, and error values. Assert:

```dart
expect(find.text('Resume trip'), findsOneWidget);
expect(find.text('Kilimani to Hillcrest'), findsOneWidget);
expect(find.text('Up next'), findsOneWidget);
expect(find.text('View all'), findsOneWidget);
```

For an active trip, override `driverTripDetailProvider(activeTrip.id)` and assert a compact map preview is present. For no active trip, assert the earliest upcoming route is visually first and exposes **View route**, with no **Resume trip**. Tap retry in the error test and assert the provider refresh callback runs. Use keys `driver-active-trip`, `driver-active-map-preview`, `driver-next-trip`, `driver-recent-trips`, and `driver-workspace-retry` for stable test selection.

- [ ] **Step 2: Run the widget test and verify RED**

```bash
cd apps/mobile
flutter test test/widget/driver_dashboard_screen_test.dart
```

Expected: compile failure because the provider and new dashboard contract do not exist.

- [ ] **Step 3: Implement providers**

Use `FutureProvider` families consistent with the existing codebase:

```dart
final driverWorkspaceProvider = FutureProvider<DriverWorkspace>((ref) async {
  final response = await ref
      .read(apiClientProvider)
      .get<Map<String, Object?>>('/trips/driver-workspace');
  return DriverWorkspace.fromJson(response.data ?? const <String, Object?>{});
});

final driverTripDetailProvider =
    FutureProvider.family<DriverTripDetail, String>((ref, tripId) async {
  final response = await ref
      .read(apiClientProvider)
      .get<Map<String, Object?>>('/trips/driver/$tripId');
  return DriverTripDetail.fromJson(response.data ?? const <String, Object?>{});
});
```

Provide transition functions that return parsed detail/summary responses and invalidate both workspace and detail only after success. Parse `TRIP_ALREADY_ACTIVE` from Dio response data and expose `activeTripId` through a typed `ActiveTripConflict` exception.

- [ ] **Step 4: Implement the task-first dashboard**

Use `RefreshIndicator` rather than a persistent refresh FAB. Active trip content is first and dominant with **Resume trip**. Fetch `driverTripDetailProvider(activeTrip.id)` for its compact `DriverTripMap`; while detail loads, preserve fixed preview dimensions and show route context rather than a second page spinner. Without active work, promote `upcomingTrips.first`. Render remaining upcoming rows and at most the recent records returned by the API. Use route names and vehicle registration; never use the UUID as the title.

Create `DriverTripMap` in compact and full modes. Compact mode disables gestures and attribution interaction, fits known points, and draws the same policy-selected planned/travelled layers as full mode. Use a lower-emphasis solid slate-blue planned line and a higher-contrast emerald travelled line; do not depend on an optional dash-pattern API.

Use status text plus icon, 8 dp maximum card radius, emerald primary action, amber active indicator, and 48 dp action heights. Loading skeleton dimensions must match loaded cards. Error state uses `apiErrorMessage` and a retry icon button with tooltip. Empty state says **No trips assigned** and explains that new assignments will appear here.

- [ ] **Step 5: Verify dashboard tests GREEN**

```bash
flutter test test/widget/driver_dashboard_screen_test.dart
flutter analyze
```

Expected: dashboard tests pass and analyzer is clean.

- [ ] **Step 6: Commit the dashboard**

```bash
git add apps/mobile/lib/features/driver/driver_trip_providers.dart apps/mobile/lib/features/driver/driver_trip_map.dart apps/mobile/lib/features/driver/driver_dashboard_screen.dart apps/mobile/test/widget/driver_dashboard_screen_test.dart
git commit -m "feat(mobile): add driver trip command center"
```

---

### Task 5: Build Status-Aware Trip Detail and Maps

**Files:**

- Modify: `apps/mobile/lib/features/driver/driver_trip_map.dart`
- Modify: `apps/mobile/lib/core/realtime/ws_gateway.dart`
- Rewrite: `apps/mobile/lib/features/driver/driver_trip_screen.dart`
- Modify: `apps/mobile/test/widget/driver_trip_screen_test.dart`

**Interfaces:**

- Consumes `DriverTripDetail`, provider transitions, websocket events, and telemetry service.
- Produces `DriverTripMap(detail: detail, livePoint: point)` with deterministic planned/travelled layers.
- Produces server-status actions: scheduled=`Start trip`, in-progress=`End trip` and `SOS`, final states=read-only.

- [ ] **Step 1: Rewrite widget tests first**

Test scheduled, in-progress, completed, cancelled-planned, cancelled-partial, and active conflict states. Include:

```dart
expect(find.byKey(const Key('planned-route-polyline')), findsOneWidget);
expect(find.text('Start trip'), findsOneWidget);
expect(find.text('End trip'), findsNothing);
```

For active detail:

```dart
expect(find.byKey(const Key('travelled-route-polyline')), findsOneWidget);
expect(find.text('End trip'), findsOneWidget);
expect(find.text('SOS'), findsOneWidget);
```

Tap **Start trip**, assert the confirmation sheet includes route, vehicle, scheduled time, and passenger count, then confirm and assert the endpoint. Return a `409` Dio response in another test and assert **Resume trip** targets `details.activeTripId`.

Tap **End trip** with `onBoard > 0`; assert the warning includes the exact on-board count. Return a network failure and assert status/actions remain in progress and telemetry is not stopped. Keep the existing offline SOS outbox assertion. Override websocket state as disconnected and reconnecting, then assert the persistent **Live updates reconnecting** status appears without hiding trip actions.

- [ ] **Step 2: Run the focused widget tests and verify RED**

```bash
cd apps/mobile
flutter test test/widget/driver_trip_screen_test.dart
```

Expected: failures because the current screen uses a local `_inProgress` boolean and has no map.

- [ ] **Step 3: Implement the reusable map**

Complete `DriverTripMap` with `FlutterMap`, OpenStreetMap tiles, `PolylineLayer`, and `MarkerLayer`. Assign keys to planned and travelled layer wrappers for tests. Planned uses a 3 px slate-blue line at 70% opacity; travelled uses a 5 px emerald line. Current vehicle uses `Icons.navigation` rotated by heading. Start, stop, and end markers use distinct icons and semantic labels.

Compute bounds from all visible points. For no points, show an inline location-unavailable state; for one travelled point, show the marker without a travelled polyline. Keep attribution and `userAgentPackageName: 'ke.co.safarishule.mobile'`.

- [ ] **Step 4: Implement server-backed detail and confirmations**

Add `WsConnectionStatus { disconnected, connecting, connected }` and a `wsConnectionStatusProvider` driven by Socket.IO connect, reconnect-attempt, disconnect, and error callbacks. Watch `driverTripDetailProvider(tripId)`. Append matching `wsTripLocationProvider(tripId)` coordinates to an in-memory display-only tail while preserving REST history as the source on refresh. Display reconnecting state whenever the active trip's socket status is not connected.

Scheduled UI shows planned route and **Start trip**. In-progress UI shows live/travelled map, GPS age, boarding summary, **End trip**, and **SOS**. Completed UI shows travelled route and summary only. Cancelled UI shows cancellation reason or **Reason unavailable**, and chooses planned or partial map from policy.

Disable mutation buttons while pending. On success, refresh detail/workspace and start or stop telemetry only after the server response. On stale status, invalidate providers and show a concise snackbar. On `404`, navigate back to `/driver/dashboard` after refresh.

- [ ] **Step 5: Verify detail tests GREEN**

```bash
flutter test test/widget/driver_trip_screen_test.dart
flutter analyze
```

Expected: all state/action/map tests pass and analyzer is clean.

- [ ] **Step 6: Commit detail and map behavior**

```bash
git add apps/mobile/lib/core/realtime/ws_gateway.dart apps/mobile/lib/features/driver/driver_trip_map.dart apps/mobile/lib/features/driver/driver_trip_screen.dart apps/mobile/test/widget/driver_trip_screen_test.dart
git commit -m "feat(mobile): add status-aware trip maps"
```

---

### Task 6: Restore Active Telemetry Across Login and App Resume

**Files:**

- Modify: `apps/mobile/lib/core/telemetry/trip_telemetry_service.dart`
- Create: `apps/mobile/lib/features/driver/driver_trip_coordinator.dart`
- Modify: `apps/mobile/lib/app/app.dart`
- Create: `apps/mobile/test/unit/trip_telemetry_service_test.dart`
- Modify: `apps/mobile/test/widget/app_router_test.dart`

**Interfaces:**

- `TripTelemetryService.activeTripId` exposes current tracking ownership.
- `start(tripId)` is a no-op when already tracking that ID.
- `DriverTripCoordinator.sync()` starts the workspace active trip or stops tracking when no active trip exists.
- `SafariShuleApp` calls sync after driver login and on `AppLifecycleState.resumed`; logout stops telemetry.

- [ ] **Step 1: Write failing idempotency and lifecycle tests**

Extract background geolocation behind a small injectable adapter so unit tests do not invoke the native plugin. Assert:

```dart
await service.start('trip-1');
await service.start('trip-1');
expect(adapter.startCalls, 1);

await service.start('trip-2');
expect(adapter.stopCalls, 1);
expect(service.activeTripId, 'trip-2');
```

For coordinator tests, return a workspace with `activeTrip.id == 'trip-1'`, call `sync()` twice, and assert one effective telemetry start. Return no active trip and assert stop. In a widget lifecycle test, dispatch `AppLifecycleState.resumed`, settle, and assert the workspace is refreshed and coordinator sync is invoked.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
cd apps/mobile
flutter test test/unit/trip_telemetry_service_test.dart test/widget/app_router_test.dart
```

Expected: compile or assertion failures because there is no adapter, active trip state, coordinator, or lifecycle observer.

- [ ] **Step 3: Make telemetry idempotent**

Add a `TripLocationAdapter` interface wrapping ready, listener registration/removal, start, and stop. The production adapter delegates to `bg.BackgroundGeolocation`; tests use a fake. Track `_activeTripId` and return early from `start` when it matches. When switching IDs, call `stop` before registering the new listener. Clear `_activeTripId` only after stop cleanup.

- [ ] **Step 4: Add the coordinator and app lifecycle ownership**

`DriverTripCoordinator` receives a Riverpod `Ref`, loads/refreshes `driverWorkspaceProvider`, and synchronizes telemetry to `activeTrip?.id`. Serialize concurrent `sync()` calls with one in-flight future.

Make `_SafariShuleAppState` implement `WidgetsBindingObserver`. Register in `initState`, unregister in `dispose`, and call coordinator sync only for authenticated sessions containing the `driver` role. On logout, stop telemetry and invalidate driver providers. On `resumed`, invalidate workspace then sync. Keep push notification and outbox initialization behavior unchanged.

- [ ] **Step 5: Verify lifecycle behavior GREEN**

```bash
flutter test test/unit/trip_telemetry_service_test.dart test/widget/app_router_test.dart
flutter analyze
```

Expected: idempotency/lifecycle tests pass and analyzer reports no issues.

- [ ] **Step 6: Commit lifecycle restoration**

```bash
git add apps/mobile/lib/core/telemetry/trip_telemetry_service.dart apps/mobile/lib/features/driver/driver_trip_coordinator.dart apps/mobile/lib/app/app.dart apps/mobile/test/unit/trip_telemetry_service_test.dart apps/mobile/test/widget/app_router_test.dart
git commit -m "feat(mobile): restore active trip telemetry"
```

---

### Task 7: Full Verification and Android UX Check

**Files:**

- Modify only files required by failures caused by Tasks 1-6.
- Do not stage `apps/mobile/ios/Flutter/Debug.xcconfig`, `apps/mobile/ios/Flutter/Release.xcconfig`, or `apps/mobile/ios/Podfile` unless separately requested.

**Interfaces:**

- Consumes the completed API and Flutter workflow.
- Produces verified behavior on tests, builds, and the configured `Pixel_7` emulator.

- [ ] **Step 1: Run API verification**

```bash
pnpm --filter @safari-shule/api run test:e2e -- --runTestsByPath test/trips.e2e-spec.ts test/driver-workspace.e2e-spec.ts
pnpm --filter @safari-shule/api exec tsc --noEmit
pnpm --filter @safari-shule/api exec tsc --noEmit -p test/tsconfig.test.json
pnpm --filter @safari-shule/api run build
```

Expected: every command exits 0.

- [ ] **Step 2: Run Flutter verification**

```bash
cd apps/mobile
flutter test test/unit/driver_trip_models_test.dart test/unit/trip_telemetry_service_test.dart
flutter test test/widget/driver_dashboard_screen_test.dart test/widget/driver_trip_screen_test.dart test/widget/app_router_test.dart
flutter test
flutter analyze
```

Expected: all tests pass and analyzer reports no issues.

- [ ] **Step 3: Run the app against local HTTPS**

Ensure API and web proxy are running, then:

```bash
cd apps/mobile
flutter run \
  -d emulator-5554 \
  --dart-define=API_BASE_URL=https://api.safari-shule.test/v1 \
  --dart-define=API_HOST_OVERRIDE=10.0.2.2
```

Expected: driver login reaches the task-first dashboard through the trusted canonical host override.

- [ ] **Step 4: Verify practical workflows manually**

On `Pixel_7`, verify:

1. Active trip appears first after login and **Resume trip** opens it without another start request.
2. Starting a scheduled trip shows readiness confirmation and prevents a second active trip.
3. In-progress map updates, survives background/resume, and retains visible GPS health.
4. Failed end leaves the trip active; successful end stops telemetry and moves it to recent history.
5. Completed trip shows travelled path; scheduled/cancelled trips show the correct planned/partial path.
6. Large Android font scale does not overlap route titles, map controls, status, or actions.
7. Offline SOS still queues and confirms the queued state.

- [ ] **Step 5: Inspect final changes**

```bash
git diff --check
git status --short
git diff --stat HEAD~6..HEAD
```

Expected: no whitespace errors; only planned driver-trip files plus the pre-existing uncommitted CocoaPods files are present.

- [ ] **Step 6: Commit any verification-only repair**

If verification required a focused correction, stage only its files and commit:

```bash
git commit -m "fix(mobile): harden driver trip workflow"
```

If no correction was needed, do not create an empty commit.
