# Driver Experience Consolidated Enhancements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a consistent, market-ready driver experience across mobile: unified trip-status screens, in-app student boarding/alighting, a vehicle-level one-active-trip safety invariant (API-enforced, benefits web + mobile), corrected list orderings, and a rebranded app bar / login / account UI.

**Architecture:** All mobile trip-detail screens (scheduled/in_progress/completed/cancelled) are refactored to share one `_TripStatusShell` layout (map + top bar + info chips + bottom panel), varying only by status-specific content. Student boarding/alighting is a new authenticated, driver-trip-owned pair of API endpoints that write to the existing `TripPassenger.boardedAt`/`alightedAt` columns (no schema change needed) and reuse the existing `driverTripDetailProvider` invalidate-and-refetch pattern already used for start/end. The vehicle invariant mirrors the existing driver invariant exactly (new partial unique index + service-level pre-check) so `TripsService.startTrip`/`updateAssignment` reject a second active trip on the same vehicle with the same `TRIP_ALREADY_ACTIVE`-style contract already consumed by web and mobile.

**Tech Stack:** NestJS 10 + Prisma 5 + PostgreSQL (API), Flutter/Dart + Riverpod + go_router + Hive (mobile), React + TanStack Query (web), Zod (`packages/shared-types`).

## Global Constraints

- Every new/changed Prisma query must be tenant-scoped (`requireTenantId()` / existing `tenantId` filters) — no exceptions.
- No regressions: after every phase, run `flutter test` (currently 140 tests) and `flutter analyze` in `apps/mobile`, and `pnpm --filter @safari-shule/api run build` + relevant e2e specs in `apps/api`. All must be green before moving to the next phase.
- Mobile widget tests that touch Hive or any real `dart:io` work MUST wrap the interaction in `await tester.runAsync(() async { ... })` — `pump()`/`pumpAndSettle()` alone will not let real file I/O complete (see `/memories/repo/mobile-dev-environment-notes.md`).
- Follow existing patterns exactly: Riverpod providers (`Provider`, `FutureProvider.family`), `freezed` models where already used, Zod schemas live in `packages/shared-types`, API routes use `@RequirePermission`, `@Audited`, `@ZodBody`/`@ZodQuery`.
- No `// TODO`, no stub handlers, no placeholder copy — every task below ships working, tested code.
- Commit after each task with a conventional-commit-style message (`feat(mobile): ...`, `feat(api): ...`).

---

## File Structure Overview

**New files:**

- `apps/mobile/lib/features/driver/trip_status_shell.dart` — shared shell widget (map + top bar + chips + bottom panel scaffolding) used by all four trip statuses.
- `apps/mobile/lib/features/driver/student_lookup_sheet.dart` — the admission-number entry sheet used for both onboarding (start-trip dialog) and alighting (in-progress panel).
- `apps/api/prisma/migrations/0007_vehicle_trip_invariant/migration.sql` — vehicle-level one-active-trip unique partial index.
- `packages/shared-types/src/trip-passengers.ts` — Zod DTOs for the new board/alight endpoints.

**Modified files (by phase):**

- Phase A: `apps/mobile/lib/features/driver/driver_dashboard_screen.dart`, `apps/mobile/lib/features/driver/driver_recent_trips_screen.dart`, matching widget tests.
- Phase B: `apps/mobile/lib/features/driver/driver_trip_screen.dart` (major refactor), `apps/mobile/lib/features/driver/driver_dashboard_screen.dart` (`_NextTripCard`), `apps/mobile/test/widget/driver_trip_screen_test.dart`.
- Phase C: `apps/api/src/modules/trips/trips.service.ts`, `apps/api/src/modules/trips/trips.controller.ts`, `packages/shared-types/src/index.ts`, `apps/mobile/lib/features/driver/driver_trip_providers.dart`, `apps/mobile/lib/features/driver/driver_trip_screen.dart`, `apps/api/test/driver-workspace.e2e-spec.ts`.
- Phase D: `apps/api/prisma/schema.prisma` (no field changes, migration only), `apps/api/src/modules/trips/trips.service.ts`, `apps/web/src/routes/trips/TripsPage.tsx`, `apps/mobile/lib/features/driver/driver_trip_providers.dart`, `apps/api/test/driver-workspace.e2e-spec.ts` or a new `vehicle-trip-invariant.e2e-spec.ts`.
- Phase E: `apps/mobile/lib/core/auth/session_models.dart`, `apps/mobile/lib/core/auth/session.dart`, `apps/mobile/lib/features/driver/driver_shell.dart`, `apps/mobile/lib/features/settings/account_screen.dart`, `apps/mobile/lib/features/auth/login_screen.dart`, matching widget tests.

**Recommended order:** A → B → C → D → E. A is quick and isolates risk. B must land before C (the onboarding sheet plugs into B's new scheduled-trip bottom panel). D is independent and can run any time after A. E is purely cosmetic and safest last.

---

## PHASE A — List Reorders (mobile only)

### Task 1: Reorder the "Up next" compact trip row

**Files:**

- Modify: `apps/mobile/lib/features/driver/driver_dashboard_screen.dart` (`_CompactTripRow`, currently ~line 291-325)
- Test: `apps/mobile/test/widget/driver_dashboard_screen_test.dart`

**Interfaces:**

- Consumes: `DriverTripSummary` (`route.name`, `vehicle.registration`, `direction`, `scheduledStart`) from `driver_trip_models.dart`.
- Consumes: `formatTripSchedule`, `formatTripDirection` from `trip_time_format.dart`.

- [ ] **Step 1: Write the failing test.** Add to `driver_dashboard_screen_test.dart`:

```dart
testWidgets('DriverDashboardScreen — upcoming row shows time left, vehicle + direction right', (tester) async {
  await pumpDashboard(tester, workspace: workspaceWithUpcoming); // use existing test helper/fixture
  final timeFinder = find.text(formatTripSchedule(upcomingSummary.scheduledStart));
  final vehicleFinder = find.text(upcomingSummary.vehicle.registration);
  final directionFinder = find.text(formatTripDirection(upcomingSummary.direction));
  expect(timeFinder, findsOneWidget);
  expect(vehicleFinder, findsOneWidget);
  expect(directionFinder, findsOneWidget);
  final timeX = tester.getTopLeft(timeFinder).dx;
  final vehicleX = tester.getTopLeft(vehicleFinder).dx;
  expect(timeX, lessThan(vehicleX));
});
```

(Reuse whatever existing fixture/helper name the file already has for building an upcoming-trip workspace — check the top of the existing test file for the pattern used by the other `_CompactTripRow` tests before naming these.)

- [ ] **Step 2: Run test, confirm it fails** — `(cd apps/mobile && flutter test test/widget/driver_dashboard_screen_test.dart)`. Expect failure: vehicle/direction text not found (current row only shows route name + time).

- [ ] **Step 3: Implement.** Replace the `Column` body in `_CompactTripRow` with:

```dart
Expanded(
  child: Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: <Widget>[
      Text(
        summary.route.name,
        style: const TextStyle(fontWeight: FontWeight.w600),
      ),
      Row(
        children: <Widget>[
          Text(
            formatTripSchedule(summary.scheduledStart),
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const Spacer(),
          Text(
            summary.vehicle.registration,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(width: 6),
          Text(
            formatTripDirection(summary.direction),
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    ],
  ),
),
```

- [ ] **Step 4: Run test, confirm it passes.**

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(mobile): reorder upcoming trip row — time left, vehicle+direction right"`

### Task 2: Reorder the recent trips row (dashboard `_RecentRow` summary + full recent list)

**Files:**

- Modify: `apps/mobile/lib/features/driver/driver_recent_trips_screen.dart` (`_RecentTripRow`)
- Test: `apps/mobile/test/widget/driver_recent_trips_screen_test.dart` (create if it doesn't already exist — check first with `file_search` for `driver_recent_trips_screen_test.dart`)

**Interfaces:**

- Consumes: `DriverTripSummary.status`, `.endedAt` (verify this field exists on `DriverTripSummary` — the model summary in research only showed `startedAt`; if `endedAt`/cancellation timestamp isn't already on `DriverTripSummary`, add it by mirroring how `startedAt` is parsed in `DriverTripSummary.fromJson`, and confirm the API's `driverWorkspace()` response already includes an end/cancel timestamp for recent trips — check `apps/api/src/modules/trips/trips.service.ts`'s `driverWorkspace` method and `apps/api/test/driver-workspace.e2e-spec.ts` for the exact recent-trip JSON shape before assuming the field name).

- [ ] **Step 1: Confirm the API payload.** Read `TripsService.driverWorkspace()` and the recent-trips assertions in `driver-workspace.e2e-spec.ts` to find the exact field name used for the recent trip's completion/cancellation time (likely `endedAt`). Record the exact key.

- [ ] **Step 2: Add the field to the mobile model if missing.** In `driver_trip_models.dart`, add `final DateTime? endedAt;` to `DriverTripSummary` (constructor + `fromJson`) mirroring the existing `startedAt` nullable-DateTime parsing pattern.

- [ ] **Step 3: Write the failing test** for `_RecentTripRow`:

```dart
testWidgets('recent trip row shows status left, completion time right', (tester) async {
  final trip = DriverTripSummary(
    id: 't1',
    status: DriverTripStatus.completed,
    direction: 'morning_pickup',
    route: const SummaryRoute(id: 'r1', name: 'Route A'),
    vehicle: const SummaryVehicle(id: 'v1', registration: 'KDA 123X', capacity: 14),
    scheduledStart: DateTime.utc(2026, 9, 1, 6, 30),
    endedAt: DateTime.utc(2026, 9, 1, 7, 10),
  );
  await tester.pumpWidget(MaterialApp(home: _RecentTripRow(summary: trip)));
  expect(find.text('Completed'), findsOneWidget);
  expect(find.text(formatClockTime(trip.endedAt!)), findsOneWidget);
  final statusX = tester.getTopLeft(find.text('Completed')).dx;
  final timeX = tester.getTopLeft(find.text(formatClockTime(trip.endedAt!))).dx;
  expect(statusX, lessThan(timeX));
});
```

(`_RecentTripRow` is currently private to `driver_recent_trips_screen.dart` — either make the test live in the same library via a `part`/export-for-test shim consistent with how the codebase already tests other private widgets, or promote `_RecentTripRow` to a non-private top-level widget in the same file; check how `_ActiveTripCard`/`_CompactTripRow` are already tested in `driver_dashboard_screen_test.dart` and mirror that exact approach.)

- [ ] **Step 4: Run test, confirm it fails.**

- [ ] **Step 5: Implement.** Replace the `Row` body inside `_RecentTripRow.build()`:

```dart
Row(
  children: <Widget>[
    const Icon(Icons.history, size: 20),
    const SizedBox(width: 12),
    Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            summary.route.name,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 2),
          Row(
            children: <Widget>[
              Text(_statusLabel(summary.status)),
              const Spacer(),
              if (summary.endedAt != null)
                Text(
                  formatClockTime(summary.endedAt!),
                  style: Theme.of(context).textTheme.bodySmall,
                ),
            ],
          ),
        ],
      ),
    ),
    const Icon(Icons.chevron_right),
  ],
),
```

(`formatClockTime` already exists in `trip_time_format.dart` per the dashboard's existing usage — import it.)

- [ ] **Step 6: Run test, confirm it passes.**

- [ ] **Step 7: Run the full mobile suite** to confirm the `DriverTripSummary` field addition didn't break other tests that construct the model without `endedAt` (it's nullable/optional so existing call sites should be unaffected, but verify).

- [ ] **Step 8: Commit** — `git add -A && git commit -m "feat(mobile): reorder recent trips row — status left, completion time right"`

---

## PHASE B — Unified Trip-Status Design (mobile only)

This is the largest single refactor. `_TripDetailContent` currently branches to a fully-featured `_InProgressTripView` for `in_progress`, and a bare `Column` of `Text` widgets for every other status. The fix: extract a shared shell and give every status the same map+chips+panel treatment, varying only the panel content and available actions.

### Task 3: Extract `TripStatusShell` from `_InProgressTripView`

**Files:**

- Create: `apps/mobile/lib/features/driver/trip_status_shell.dart`
- Modify: `apps/mobile/lib/features/driver/driver_trip_screen.dart` (remove `_InProgressTripView`'s map/chip/top-bar plumbing, replace with a call into the new shell)
- Test: `apps/mobile/test/widget/driver_trip_screen_test.dart` (existing in-progress tests must still pass unchanged — this task is a pure refactor, no behavior change)

**Interfaces:**

- Produces: `TripStatusShell` widget with this signature:

```dart
class TripStatusShell extends StatelessWidget {
  const TripStatusShell({
    super.key,
    required this.mapPolicy,
    required this.badgeLabel,
    required this.badgeColor,
    required this.chips,
    required this.bottomPanel,
    this.topBarActions = const <Widget>[],
  });

  final TripMapPolicy mapPolicy;
  final String badgeLabel;
  final Color badgeColor;
  final List<Widget> chips; // rendered inside the existing _InfoChipsRow-equivalent
  final Widget bottomPanel;
  final List<Widget> topBarActions; // e.g. the SOS button, only passed for in_progress
}
```

- Consumes (unchanged, reused as-is from the current file): `DriverTripMap`, `TripMapPolicy.from(detail)`, `_CircleIconButton`, `_InfoChipsRow`/`_InfoChip` (promote these two from private to shared — move them into `trip_status_shell.dart` and export).

- [ ] **Step 1: Move `_CircleIconButton`, `_InfoChipsRow`, `_InfoChip`, `_InProgressBadge`-pattern into `trip_status_shell.dart`.** Generalize `_InProgressBadge` into a `_StatusBadge({required String label, required Color color})` since every status needs its own badge (In progress / Scheduled / Completed / Cancelled) with a different color.

- [ ] **Step 2: Write `TripStatusShell`** in the new file, reusing the exact `Stack`/`Positioned` layout currently in `_InProgressTripView.build()`:

```dart
class TripStatusShell extends StatelessWidget {
  const TripStatusShell({
    super.key,
    required this.mapPolicy,
    required this.badgeLabel,
    required this.badgeColor,
    required this.chips,
    required this.bottomPanel,
    this.topBarActions = const <Widget>[],
  });

  final TripMapPolicy mapPolicy;
  final String badgeLabel;
  final Color badgeColor;
  final List<Widget> chips;
  final Widget bottomPanel;
  final List<Widget> topBarActions;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: <Widget>[
        Expanded(
          child: Stack(
            children: <Widget>[
              Positioned.fill(
                child: DriverTripMap(policy: mapPolicy, compact: false),
              ),
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: SafeArea(
                  bottom: false,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    child: Row(
                      children: <Widget>[
                        _CircleIconButton(
                          icon: Icons.arrow_back,
                          tooltip: 'Back to dashboard',
                          onTap: () => Navigator.of(context).maybePop(),
                        ),
                        const SizedBox(width: 8),
                        Expanded(child: _StatusBadge(label: badgeLabel, color: badgeColor)),
                        const SizedBox(width: 8),
                        ...topBarActions,
                      ],
                    ),
                  ),
                ),
              ),
              Positioned(
                left: 12,
                right: 12,
                top: 64,
                child: _InfoChipsRow.fromChips(chips),
              ),
            ],
          ),
        ),
        bottomPanel,
      ],
    );
  }
}
```

(Confirm the real signature of `_InfoChipsRow` from the existing file before adding a `.fromChips` factory — it currently takes named parameters like `elapsedLabel`, `vehicleRegistration`, etc. Either keep that exact named-parameter API and have each status call site pass the specific labels it has (simplest, least risky), or refactor it to take a `List<Widget> chips` if you want full flexibility. **Recommendation: keep the existing named-parameter API unchanged** and instead make `TripStatusShell.chips` a required `Widget chipsRow` parameter (the caller builds its own `_InfoChipsRow(...)` with whatever labels apply to its status) — this avoids fabricating an API that doesn't exist yet and keeps the diff minimal.)

- [ ] **Step 3: Rewrite `_InProgressTripView` to use the shell**, passing the exact chips row and top bar action it already builds today (SOS button), and its existing `_InProgressBottomPanel` unchanged:

```dart
class _InProgressTripView extends StatelessWidget {
  const _InProgressTripView({required this.detail, required this.onEnd, required this.onSendSos});
  final DriverTripDetail detail;
  final Future<void> Function() onEnd;
  final VoidCallback onSendSos;

  @override
  Widget build(BuildContext context) {
    final latest = detail.latestSnapshot;
    return TripStatusShell(
      mapPolicy: TripMapPolicy.from(detail),
      badgeLabel: 'In progress',
      badgeColor: _amber,
      topBarActions: <Widget>[_SosButton(onPressed: onSendSos)],
      chips: <Widget>[], // unused now that chipsRow replaces this — see Step 2 note; wire chipsRow instead
      bottomPanel: _InProgressBottomPanel(detail: detail, onEnd: onEnd),
    );
  }
}
```

Reconcile this with whichever `chips` vs `chipsRow` decision was made in Step 2 so the code actually compiles — pick one approach and apply it consistently.

- [ ] **Step 4: Run the full existing in-progress test block** — `(cd apps/mobile && flutter test test/widget/driver_trip_screen_test.dart)`. Every currently-passing `in-progress trip screen ...` test must still pass unchanged (this step is a pure refactor; if any assertion breaks, the refactor changed visible behavior — fix the shell, not the test).

- [ ] **Step 5: Commit** — `git add -A && git commit -m "refactor(mobile): extract TripStatusShell from in-progress trip view"`

### Task 4: Scheduled-trip view using the shared shell

**Files:**

- Modify: `apps/mobile/lib/features/driver/driver_trip_screen.dart` (replace the scheduled branch of `_TripDetailContent`)
- Test: `apps/mobile/test/widget/driver_trip_screen_test.dart`

**Interfaces:**

- Consumes: `TripStatusShell` from Task 3, `DriverTripDetail.plannedPoints`, `.passengerSummary`, `.scheduledStart`.
- Produces: `_ScheduledTripView` widget, `onStart: Future<void> Function()` callback (unchanged signature from current `_TripDetailContent`).

- [ ] **Step 1: Write the failing test** — assert the scheduled view shows the route name, a "Scheduled" badge, expected-passenger count, and a "Start trip" button, using the map (not just plain text):

```dart
testWidgets('scheduled trip view shows planned route, schedule chip, and start action', (tester) async {
  await tester.pumpWidget(_wrapTripScreen(status: 'scheduled')); // reuse existing test harness helper
  await tester.pumpAndSettle();
  expect(find.text('Scheduled'), findsOneWidget);
  expect(find.textContaining('Passengers'), findsOneWidget);
  expect(find.widgetWithText(FilledButton, 'Start trip'), findsOneWidget);
});
```

- [ ] **Step 2: Run, confirm fail.**

- [ ] **Step 3: Implement `_ScheduledTripView`:**

```dart
class _ScheduledTripView extends StatelessWidget {
  const _ScheduledTripView({required this.detail, required this.onStart});
  final DriverTripDetail detail;
  final Future<void> Function() onStart;

  @override
  Widget build(BuildContext context) {
    return TripStatusShell(
      mapPolicy: TripMapPolicy.from(detail),
      badgeLabel: 'Scheduled',
      badgeColor: Theme.of(context).colorScheme.primary,
      chips: <Widget>[
        _InfoChip(icon: Icons.schedule, label: formatTripSchedule(detail.scheduledStart)),
        _InfoChip(icon: Icons.groups_outlined, label: 'Passengers ${detail.passengerSummary.expected}'),
        _InfoChip(icon: Icons.alt_route, label: formatTripDirection(detail.direction)),
      ],
      bottomPanel: Padding(
        padding: const EdgeInsets.all(16),
        child: FilledButton(
          onPressed: () async {
            final confirmed = await showModalBottomSheet<bool>(
              context: context,
              isScrollControlled: true,
              builder: (sheetContext) => StartTripConfirmationSheet(detail: detail),
            );
            if (confirmed == true) await onStart();
          },
          child: const Text('Start trip'),
        ),
      ),
    );
  }
}
```

(`StartTripConfirmationSheet` is built in Phase C, Task 8 — for this task, temporarily inline the existing simple confirmation sheet body from the current code so this task is independently shippable, then Task 8 replaces its content with the onboarding UI.)

- [ ] **Step 4: Update `_TripDetailContent.build()`** to dispatch on all four statuses:

```dart
@override
Widget build(BuildContext context) {
  return switch (detail.status) {
    DriverTripStatus.inProgress => _InProgressTripView(detail: detail, onEnd: onEnd, onSendSos: onSendSos),
    DriverTripStatus.scheduled => _ScheduledTripView(detail: detail, onStart: onStart),
    DriverTripStatus.completed => _CompletedTripView(detail: detail),
    DriverTripStatus.cancelled => _CancelledTripView(detail: detail),
  };
}
```

(`_CompletedTripView`/`_CancelledTripView` are built in Tasks 5–6; stub them minimally in this step only if needed to compile, then flesh out in their own tasks — do NOT leave a stub as the final state of this task; if sequencing requires it, do Tasks 4–6 together before running the full test suite.)

- [ ] **Step 5: Run test, confirm pass.**

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(mobile): scheduled trip view uses shared map+chips shell"`

### Task 5: Completed-trip view

**Files:** Modify `driver_trip_screen.dart`; Test: `driver_trip_screen_test.dart`

**Interfaces:** Consumes `DriverTripDetail.travelledPoints`, `.startedAt`, `.endedAt`, `.passengerSummary`.

- [ ] **Step 1: Write failing test** — assert badge "Completed", a duration chip, and passenger totals, with no action buttons:

```dart
testWidgets('completed trip view shows travelled route, duration, and passenger totals with no actions', (tester) async {
  await tester.pumpWidget(_wrapTripScreen(status: 'completed'));
  await tester.pumpAndSettle();
  expect(find.text('Completed'), findsOneWidget);
  expect(find.textContaining('Boarded'), findsOneWidget);
  expect(find.byType(FilledButton), findsNothing);
  expect(find.byType(ElevatedButton), findsNothing);
});
```

- [ ] **Step 2: Run, confirm fail.**

- [ ] **Step 3: Implement:**

```dart
class _CompletedTripView extends StatelessWidget {
  const _CompletedTripView({required this.detail});
  final DriverTripDetail detail;

  @override
  Widget build(BuildContext context) {
    final duration = (detail.startedAt != null && detail.endedAt != null)
        ? detail.endedAt!.difference(detail.startedAt!)
        : null;
    return TripStatusShell(
      mapPolicy: TripMapPolicy.from(detail),
      badgeLabel: 'Completed',
      badgeColor: Colors.green,
      chips: <Widget>[
        _InfoChip(
          icon: Icons.timer_outlined,
          label: duration != null ? '${duration.inMinutes} min' : 'Duration unavailable',
        ),
        _InfoChip(icon: Icons.directions_bus_outlined, label: detail.vehicle?.registration ?? 'Vehicle'),
        _InfoChip(icon: Icons.alt_route, label: formatTripDirection(detail.direction)),
      ],
      bottomPanel: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: <Widget>[
            Expanded(child: _CountTile(label: 'Boarded', value: detail.passengerSummary.boarded)),
            Expanded(child: _CountTile(label: 'Alighted', value: detail.passengerSummary.alighted)),
          ],
        ),
      ),
    );
  }
}
```

(`_CountTile` already exists in the file per the research report — reuse it as-is.)

- [ ] **Step 4: Run test, confirm pass.**

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(mobile): completed trip view uses shared shell"`

### Task 6: Cancelled-trip view

**Files:** Modify `driver_trip_screen.dart`; Test: `driver_trip_screen_test.dart`

**Interfaces:** Consumes `DriverTripDetail.cancellationReason`, `.mapMode` (already returns `cancelledPlanned`/`cancelledPartial` per the existing model).

- [ ] **Step 1: Write failing test** — assert badge "Cancelled" and the cancellation reason text render, no action buttons:

```dart
testWidgets('cancelled trip view shows cancellation reason and no actions', (tester) async {
  await tester.pumpWidget(_wrapTripScreen(status: 'cancelled', cancellationReason: 'Vehicle breakdown'));
  await tester.pumpAndSettle();
  expect(find.text('Cancelled'), findsOneWidget);
  expect(find.textContaining('Vehicle breakdown'), findsOneWidget);
  expect(find.byType(FilledButton), findsNothing);
});
```

- [ ] **Step 2: Run, confirm fail.**

- [ ] **Step 3: Implement:**

```dart
class _CancelledTripView extends StatelessWidget {
  const _CancelledTripView({required this.detail});
  final DriverTripDetail detail;

  @override
  Widget build(BuildContext context) {
    return TripStatusShell(
      mapPolicy: TripMapPolicy.from(detail),
      badgeLabel: 'Cancelled',
      badgeColor: Colors.redAccent,
      chips: <Widget>[
        _InfoChip(icon: Icons.schedule, label: formatTripSchedule(detail.scheduledStart)),
        _InfoChip(icon: Icons.alt_route, label: formatTripDirection(detail.direction)),
      ],
      bottomPanel: Padding(
        padding: const EdgeInsets.all(16),
        child: Text(
          detail.cancellationReason?.isNotEmpty == true
              ? 'Cancelled: ${detail.cancellationReason}'
              : 'This trip was cancelled.',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      ),
    );
  }
}
```

- [ ] **Step 4: Run test, confirm pass.**

- [ ] **Step 5: Run the FULL `driver_trip_screen_test.dart` file** (not filtered) to confirm the switch-based `_TripDetailContent.build()` didn't regress any status. Then run the full mobile suite (`flutter test`) and `flutter analyze`.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(mobile): cancelled trip view uses shared shell; unify all trip statuses"`

### Task 7: Dashboard "upcoming trip" summary card mirrors the in-progress look

**Files:** Modify `apps/mobile/lib/features/driver/driver_dashboard_screen.dart` (`_NextTripCard`); Test: `driver_dashboard_screen_test.dart`

- [ ] **Step 1: Write failing test** — assert `_NextTripCard` now shows a compact map preview (reuse `_CompactMapPreview`, already used by `_ActiveTripCard`) plus expected-students, scheduled-time, and direction chips/text:

```dart
testWidgets('DriverDashboardScreen — next trip card shows map preview and expected students/time/direction', (tester) async {
  await pumpDashboard(tester, workspace: workspaceWithUpcoming);
  expect(find.byKey(const Key('driver-next-trip')), findsOneWidget);
  expect(find.textContaining('Passengers'), findsOneWidget);
  expect(find.text(formatTripSchedule(upcomingSummary.scheduledStart)), findsOneWidget);
  expect(find.text(formatTripDirection(upcomingSummary.direction)), findsOneWidget);
});
```

- [ ] **Step 2: Run, confirm fail** (current card has no map preview / passenger count; it only calls `/driver/trip/:id` via a button — the count/direction text doesn't currently render on this card, only route name + vehicle reg per the research report).

- [ ] **Step 3: Implement.** `_NextTripCard` needs the trip's expected passenger count, which lives on `DriverTripDetail`, not the lightweight `DriverTripSummary` used on the dashboard. Mirror exactly how `_ActiveTripCard` already does this (`ref.watch(driverTripDetailProvider(summary.id))`) — convert `_NextTripCard` to a `ConsumerWidget` the same way:

```dart
class _NextTripCard extends ConsumerWidget {
  const _NextTripCard({required this.summary});
  final DriverTripSummary summary;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailAsync = ref.watch(driverTripDetailProvider(summary.id));
    return Card(
      key: const Key('driver-next-trip'),
      shape: const RoundedRectangleBorder(borderRadius: _cardRadius),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Row(
              children: <Widget>[
                const Icon(Icons.schedule, size: 14, color: Colors.grey),
                const SizedBox(width: 4),
                Text(formatTripSchedule(summary.scheduledStart), style: const TextStyle(fontSize: 12, color: Colors.grey)),
              ],
            ),
            const SizedBox(height: 4),
            Text(summary.route.name, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            Row(
              children: <Widget>[
                Text(summary.vehicle.registration, style: Theme.of(context).textTheme.bodySmall),
                const Spacer(),
                Text(formatTripDirection(summary.direction), style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
            const SizedBox(height: 10),
            _CompactMapPreview(detailAsync: detailAsync),
            const SizedBox(height: 6),
            detailAsync.when(
              data: (d) => Text('Passengers expected: ${d.passengerSummary.expected}', style: Theme.of(context).textTheme.bodySmall),
              loading: () => const SizedBox.shrink(),
              error: (_, _) => const SizedBox.shrink(),
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: _actionHeight,
              child: OutlinedButton.icon(
                icon: const Icon(Icons.map_outlined),
                label: const Text('View route'),
                onPressed: () => context.push('/driver/trip/${summary.id}'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 4: Run test, confirm pass.** Run the full mobile suite — this card now issues an extra `driverTripDetailProvider` fetch per upcoming trip shown; confirm existing dashboard tests that mock the API still provide a response for the upcoming trip's detail endpoint (`/trips/driver/:id`), adding a mock response in test setup if missing.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(mobile): upcoming trip card mirrors in-progress design with map preview and passenger count"`

---

## PHASE C — Student Onboarding & Alighting (API + shared-types + mobile)

### Task 8: API — board/alight endpoints

**Files:**

- Modify: `apps/api/src/modules/trips/trips.service.ts`
- Modify: `apps/api/src/modules/trips/trips.controller.ts`
- Create: `packages/shared-types/src/trip-passengers.ts`
- Modify: `packages/shared-types/src/index.ts` (export the new file)
- Modify: `packages/shared-types/src/rbac.ts` (driver gains `attendance.override`)
- Test: `apps/api/test/driver-workspace.e2e-spec.ts` or a new `apps/api/test/trip-passenger-attendance.e2e-spec.ts`

**Interfaces:**

- Produces (shared-types):

```typescript
// packages/shared-types/src/trip-passengers.ts
import { z } from 'zod';

export const tripPassengerLookupInput = z.object({
  admissionNumber: z.string().min(1).max(50),
});
export type TripPassengerLookupInput = z.infer<typeof tripPassengerLookupInput>;
```

- Produces (API): `TripsService.boardPassenger(tripId, driverUserId, admissionNumber)` and `TripsService.alightPassenger(tripId, driverUserId, admissionNumber)`, each returning `{ tripPassengerId: string; studentId: string; boardedAt?: string; alightedAt?: string }`.
- New error codes added to `packages/shared-types/src/errors.ts`: `STUDENT_NOT_ON_TRIP`, `ALREADY_BOARDED`, `ALREADY_ALIGHTED`, `NOT_BOARDED_YET`.

- [ ] **Step 1: Add error codes.** In `packages/shared-types/src/errors.ts`, add to `ERROR_CODES`:

```typescript
STUDENT_NOT_ON_TRIP: 'STUDENT_NOT_ON_TRIP',
ALREADY_BOARDED: 'ALREADY_BOARDED',
ALREADY_ALIGHTED: 'ALREADY_ALIGHTED',
NOT_BOARDED_YET: 'NOT_BOARDED_YET',
```

- [ ] **Step 2: Add `attendance.override` to the driver role.** In `packages/shared-types/src/rbac.ts`, add `'attendance.override'` to the `driver: [...]` array (alongside the existing `attendance.view`).

- [ ] **Step 3: Create the Zod DTO file** at `packages/shared-types/src/trip-passengers.ts` (content above), then add `export * from './trip-passengers';` to `packages/shared-types/src/index.ts` next to the other `export *` lines.

- [ ] **Step 4: Write the failing e2e test.** In `apps/api/test/driver-workspace.e2e-spec.ts`, add:

```typescript
it('driver can board and alight an expected passenger via admission number', async () => {
  const student = await prisma.student.findFirstOrThrow({ where: { tenantId: alpha.tenantId } });
  await prisma.tripPassenger.upsert({
    where: {
      tenantId_tripId_studentId: {
        tenantId: alpha.tenantId,
        tripId: activeTrip.id,
        studentId: student.id,
      },
    },
    create: {
      tenantId: alpha.tenantId,
      tripId: activeTrip.id,
      studentId: student.id,
      expected: true,
    },
    update: {},
  });

  const boardRes = await request(app.getHttpServer())
    .post(`/v1/trips/${activeTrip.id}/board`)
    .set('Authorization', `Bearer ${alpha.driverToken}`)
    .set('X-Tenant-Slug', alpha.tenantSlug)
    .send({ admissionNumber: student.admissionNumber })
    .expect(201);
  expect(boardRes.body.studentId).toBe(student.id);
  expect(boardRes.body.boardedAt).toBeTruthy();

  const doubleBoard = await request(app.getHttpServer())
    .post(`/v1/trips/${activeTrip.id}/board`)
    .set('Authorization', `Bearer ${alpha.driverToken}`)
    .set('X-Tenant-Slug', alpha.tenantSlug)
    .send({ admissionNumber: student.admissionNumber })
    .expect(409);
  expect(doubleBoard.body.code).toBe('ALREADY_BOARDED');

  const alightRes = await request(app.getHttpServer())
    .post(`/v1/trips/${activeTrip.id}/alight`)
    .set('Authorization', `Bearer ${alpha.driverToken}`)
    .set('X-Tenant-Slug', alpha.tenantSlug)
    .send({ admissionNumber: student.admissionNumber })
    .expect(201);
  expect(alightRes.body.alightedAt).toBeTruthy();
});

it('driver cannot board a student who is not on the trip manifest', async () => {
  const otherStudent = await prisma.student.create({
    data: {
      tenantId: alpha.tenantId,
      admissionNumber: `NOTONTRIP-${Date.now()}`,
      legalName: 'Not Onboard',
      dateOfBirth: new Date('2015-01-01'),
      gender: 'male' as any,
    },
  });
  await request(app.getHttpServer())
    .post(`/v1/trips/${activeTrip.id}/board`)
    .set('Authorization', `Bearer ${alpha.driverToken}`)
    .set('X-Tenant-Slug', alpha.tenantSlug)
    .send({ admissionNumber: otherStudent.admissionNumber })
    .expect(404)
    .expect((res) => expect(res.body.code).toBe('STUDENT_NOT_ON_TRIP'));
});
```

(Adjust to match this file's existing auth/token fixture helper names exactly — read the top of `driver-workspace.e2e-spec.ts` for how `alpha.driverToken`/`tenantSlug` are actually obtained before pasting this in verbatim.)

- [ ] **Step 5: Run test, confirm it fails (404 route not found).**

- [ ] **Step 6: Implement the service methods.** Add to `TripsService` in `trips.service.ts`:

```typescript
async boardPassenger(tripId: string, driverUserId: string, admissionNumber: string) {
  const trip = await this.prisma.trip.findFirst({ where: { id: tripId, driverUserId } });
  if (!trip) throw new NotFoundException();
  if (trip.status !== 'scheduled' && trip.status !== 'in_progress') {
    throw new BadRequestException({ code: 'TRIP_NOT_BOARDABLE' });
  }
  const student = await this.prisma.student.findFirst({
    where: { tenantId: trip.tenantId, admissionNumber },
    select: { id: true, legalName: true },
  });
  if (!student) throw new NotFoundException({ code: 'STUDENT_NOT_ON_TRIP' });
  const passenger = await this.prisma.tripPassenger.findFirst({
    where: { tenantId: trip.tenantId, tripId, studentId: student.id },
  });
  if (!passenger) throw new NotFoundException({ code: 'STUDENT_NOT_ON_TRIP' });
  if (passenger.boardedAt) throw new ConflictException({ code: 'ALREADY_BOARDED' });

  const updated = await this.prisma.tripPassenger.update({
    where: { id: passenger.id },
    data: { boardedAt: new Date() },
  });
  await this.notifyParents(trip.tenantId, student.id, 'boarding', trip.vehicleId);
  return { tripPassengerId: updated.id, studentId: student.id, boardedAt: updated.boardedAt!.toISOString() };
}

async alightPassenger(tripId: string, driverUserId: string, admissionNumber: string) {
  const trip = await this.prisma.trip.findFirst({ where: { id: tripId, driverUserId } });
  if (!trip) throw new NotFoundException();
  if (trip.status !== 'in_progress') throw new BadRequestException({ code: 'TRIP_NOT_IN_PROGRESS' });
  const student = await this.prisma.student.findFirst({
    where: { tenantId: trip.tenantId, admissionNumber },
    select: { id: true },
  });
  if (!student) throw new NotFoundException({ code: 'STUDENT_NOT_ON_TRIP' });
  const passenger = await this.prisma.tripPassenger.findFirst({
    where: { tenantId: trip.tenantId, tripId, studentId: student.id },
  });
  if (!passenger) throw new NotFoundException({ code: 'STUDENT_NOT_ON_TRIP' });
  if (!passenger.boardedAt) throw new BadRequestException({ code: 'NOT_BOARDED_YET' });
  if (passenger.alightedAt) throw new ConflictException({ code: 'ALREADY_ALIGHTED' });

  const updated = await this.prisma.tripPassenger.update({
    where: { id: passenger.id },
    data: { alightedAt: new Date() },
  });
  await this.notifyParents(trip.tenantId, student.id, 'alighting', trip.vehicleId);
  return { tripPassengerId: updated.id, studentId: student.id, alightedAt: updated.alightedAt!.toISOString() };
}
```

- [ ] **Step 7: Add the `notifyParents` helper.** Read `apps/api/src/modules/hardware/hardware.service.ts`'s constructor injection (what it calls the comms service, e.g. `CommsService`) and its `renderTemplate`/`sendSms` call block exactly, then add an equivalent private method to `TripsService`:

```typescript
private async notifyParents(tenantId: string, studentId: string, direction: 'boarding' | 'alighting', vehicleId: string) {
  const student = await this.prisma.student.findUniqueOrThrow({ where: { id: studentId } });
  const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
  const tpl = renderTemplate(direction === 'boarding' ? 'student.boarded' : 'student.alighted', {
    studentName: student.legalName,
    vehicleReg: vehicle?.registration ?? 'unknown',
    time: new Date().toISOString(),
    location: '',
  });
  const links = await this.prisma.parentStudent.findMany({ where: { studentId }, include: { parent: true } });
  for (const link of links) {
    if (link.parent.phoneE164) {
      await this.comms.sendSms({
        tenantId,
        to: link.parent.phoneE164,
        templateId: direction === 'boarding' ? 'student.boarded' : 'student.alighted',
        body: tpl.body,
      });
    }
  }
}
```

This requires `TripsService`'s constructor to inject the same comms service `HardwareService` uses, and to import `renderTemplate` from wherever `hardware.service.ts` imports it — copy those two import lines exactly from `hardware.service.ts` into `trips.service.ts`.

- [ ] **Step 8: Add the controller routes.** In `trips.controller.ts`:

```typescript
@Post(':id/board')
@RequirePermission('attendance.override')
@Audited({ action: 'trip.passenger_board', entityType: 'trip', entityIdParam: 'id' })
board(
  @Param('id') id: string,
  @ZodBody(tripPassengerLookupInput) body: z.infer<typeof tripPassengerLookupInput>,
  @Req() req: Request,
) {
  return this.svc.boardPassenger(id, requireAuthenticatedUserId(req), body.admissionNumber);
}

@Post(':id/alight')
@RequirePermission('attendance.override')
@Audited({ action: 'trip.passenger_alight', entityType: 'trip', entityIdParam: 'id' })
alight(
  @Param('id') id: string,
  @ZodBody(tripPassengerLookupInput) body: z.infer<typeof tripPassengerLookupInput>,
  @Req() req: Request,
) {
  return this.svc.alightPassenger(id, requireAuthenticatedUserId(req), body.admissionNumber);
}
```

Import `tripPassengerLookupInput` from `@safari-shule/shared-types` (match the existing import style at the top of this file).

- [ ] **Step 9: Run the e2e tests, confirm pass.** `pnpm --filter @safari-shule/api run test:e2e -- driver-workspace` (or the dedicated new spec file).

- [ ] **Step 10: Run the full API build + e2e suite** to confirm no regressions: `pnpm --filter @safari-shule/api run build && pnpm --filter @safari-shule/api exec tsc --noEmit -p test/tsconfig.test.json && pnpm --filter @safari-shule/api run test:e2e`.

- [ ] **Step 11: Commit** — `git add -A && git commit -m "feat(api): driver-initiated student board/alight endpoints"`

### Task 9: Mobile — providers + `StudentLookupSheet` shared widget

**Files:**

- Create: `apps/mobile/lib/features/driver/student_lookup_sheet.dart`
- Modify: `apps/mobile/lib/features/driver/driver_trip_providers.dart`
- Test: `apps/mobile/test/widget/student_lookup_sheet_test.dart` (new)

**Interfaces:**

- Produces: `boardStudentProvider`/`alightStudentProvider` — `Provider<Future<void> Function(String tripId, String admissionNumber)>`, calling `POST /trips/:id/board` / `/alight`, invalidating `driverTripDetailProvider(tripId)` on success (mirrors `startDriverTripProvider`'s exact invalidate pattern).
- Produces: `StudentLookupSheet` widget — takes a `title`, an `onSubmit: Future<void> Function(String admissionNumber)` callback, shows a text field for manual admission-number entry (NFC/QR "scan" is out of scope for this iteration — manual entry only, per the practical MVP; note this explicitly to the user rather than faking a scan UI), a submit button with loading state, and inline error text on failure.

- [ ] **Step 1: Add the providers** to `driver_trip_providers.dart`:

```dart
final boardStudentProvider =
    Provider<Future<void> Function(String, String)>((ref) {
  return (String tripId, String admissionNumber) async {
    await ref.read(apiClientProvider).post<void>(
      '/trips/$tripId/board',
      data: <String, Object?>{'admissionNumber': admissionNumber},
    );
    ref.invalidate(driverTripDetailProvider(tripId));
  };
});

final alightStudentProvider =
    Provider<Future<void> Function(String, String)>((ref) {
  return (String tripId, String admissionNumber) async {
    await ref.read(apiClientProvider).post<void>(
      '/trips/$tripId/alight',
      data: <String, Object?>{'admissionNumber': admissionNumber},
    );
    ref.invalidate(driverTripDetailProvider(tripId));
  };
});
```

- [ ] **Step 2: Write the failing widget test** for `StudentLookupSheet`:

```dart
testWidgets('StudentLookupSheet submits the entered admission number', (tester) async {
  String? submitted;
  await tester.pumpWidget(MaterialApp(
    home: StudentLookupSheet(
      title: 'Board student',
      onSubmit: (value) async {
        submitted = value;
      },
    ),
  ));
  await tester.enterText(find.byKey(const Key('student-lookup-input')), 'ADM-001');
  await tester.tap(find.text('Confirm'));
  await tester.runAsync(() async {
    await Future<void>.delayed(const Duration(milliseconds: 50));
  });
  await tester.pump();
  expect(submitted, 'ADM-001');
});

testWidgets('StudentLookupSheet shows an error message when onSubmit throws', (tester) async {
  await tester.pumpWidget(MaterialApp(
    home: StudentLookupSheet(
      title: 'Board student',
      onSubmit: (_) async => throw Exception('not on trip'),
    ),
  ));
  await tester.enterText(find.byKey(const Key('student-lookup-input')), 'ADM-002');
  await tester.runAsync(() async {
    await tester.tap(find.text('Confirm'));
    await Future<void>.delayed(const Duration(milliseconds: 50));
  });
  await tester.pump();
  expect(find.textContaining('not on trip'), findsOneWidget);
});
```

- [ ] **Step 3: Run, confirm fail (file doesn't exist yet).**

- [ ] **Step 4: Implement `StudentLookupSheet`:**

```dart
import 'package:flutter/material.dart';

class StudentLookupSheet extends StatefulWidget {
  const StudentLookupSheet({super.key, required this.title, required this.onSubmit});

  final String title;
  final Future<void> Function(String admissionNumber) onSubmit;

  @override
  State<StudentLookupSheet> createState() => _StudentLookupSheetState();
}

class _StudentLookupSheetState extends State<StudentLookupSheet> {
  final _controller = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _confirm() async {
    final value = _controller.text.trim();
    if (value.isEmpty) {
      setState(() => _error = 'Enter an admission number.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await widget.onSubmit(value);
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not confirm: $error';
        _submitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(widget.title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          TextField(
            key: const Key('student-lookup-input'),
            controller: _controller,
            autofocus: true,
            decoration: const InputDecoration(
              labelText: 'Admission number',
              hintText: 'e.g. ADM-0123',
            ),
            onSubmitted: (_) => _confirm(),
          ),
          if (_error != null) ...<Widget>[
            const SizedBox(height: 8),
            Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _submitting ? null : _confirm,
            child: _submitting
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Confirm'),
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 5: Run test, confirm pass** (remember: the second test taps and awaits inside `tester.runAsync` because `onSubmit` here doesn't do real I/O in the test, but if a future caller's `onSubmit` does real I/O, the same `runAsync` pattern applies — keep it in the test now for safety/consistency).

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(mobile): add student lookup sheet and board/alight providers"`

### Task 10: Wire onboarding into the Start Trip confirmation, and alighting into the in-progress panel

**Files:** Modify `apps/mobile/lib/features/driver/driver_trip_screen.dart` (the `StartTripConfirmationSheet` stubbed in Task 4, and `_InProgressBottomPanel`); Test: `driver_trip_screen_test.dart`

- [ ] **Step 1: Write the failing test** for onboarding from the start sheet:

```dart
testWidgets('start trip confirmation sheet can board a student before confirming start', (tester) async {
  final calls = <String>[];
  final dio = _dioReturning((options) {
    if (options.path == '/trips/trip-sched/board') {
      calls.add(jsonEncode(options.data));
      return <String, Object?>{};
    }
    return _tripDetailResponse('trip-sched', 'scheduled');
  });
  await tester.pumpWidget(_wrapTripScreen(dio: dio, tripId: 'trip-sched', status: 'scheduled'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Start trip'));
  await tester.pumpAndSettle();
  await tester.enterText(find.byKey(const Key('student-lookup-input')), 'ADM-1');
  await tester.runAsync(() async {
    await tester.tap(find.text('Board student'));
    await Future<void>.delayed(const Duration(milliseconds: 100));
  });
  await tester.pump();
  expect(calls, isNotEmpty);
});
```

(Adjust exact button label/key to whatever this task actually implements — see Step 2.)

- [ ] **Step 2: Implement.** Replace the placeholder bottom-sheet body built in Task 4 with a `StartTripConfirmationSheet` `ConsumerWidget`:

```dart
class StartTripConfirmationSheet extends ConsumerWidget {
  const StartTripConfirmationSheet({super.key, required this.detail});
  final DriverTripDetail detail;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text('Confirm start trip', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(detail.routeName),
          Text('Passengers expected: ${detail.passengerSummary.expected}'),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            icon: const Icon(Icons.qr_code_scanner),
            label: const Text('Board student'),
            onPressed: () async {
              await showModalBottomSheet<bool>(
                context: context,
                isScrollControlled: true,
                builder: (_) => StudentLookupSheet(
                  title: 'Board student',
                  onSubmit: (admissionNumber) =>
                      ref.read(boardStudentProvider)(detail.id, admissionNumber),
                ),
              );
            },
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Confirm start'),
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 3: Run test, confirm pass.**

- [ ] **Step 4: Write the failing test** for alighting from the in-progress bottom panel:

```dart
testWidgets('in-progress bottom panel can alight a boarded student', (tester) async {
  final calls = <String>[];
  final dio = _dioReturning((options) {
    if (options.path == '/trips/trip-live/alight') {
      calls.add(jsonEncode(options.data));
      return <String, Object?>{};
    }
    return _tripDetailResponse('trip-live', 'in_progress');
  });
  await tester.pumpWidget(_wrapTripScreen(dio: dio, tripId: 'trip-live', status: 'in_progress'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Alight student'));
  await tester.pumpAndSettle();
  await tester.enterText(find.byKey(const Key('student-lookup-input')), 'ADM-2');
  await tester.runAsync(() async {
    await tester.tap(find.text('Confirm'));
    await Future<void>.delayed(const Duration(milliseconds: 100));
  });
  await tester.pump();
  expect(calls, isNotEmpty);
});
```

- [ ] **Step 5: Implement.** In `_InProgressBottomPanel`, add an "Alight student" `OutlinedButton` (next to or below the existing "End trip" button) that opens `StudentLookupSheet(title: 'Alight student', onSubmit: (admissionNumber) => ref.read(alightStudentProvider)(detail.id, admissionNumber))`. Since `_InProgressBottomPanel` is currently a `StatelessWidget` (per the research report) with no `ref`, convert it to a `ConsumerWidget` (mirroring how `_ActiveTripCard` on the dashboard already does this conversion) and thread `ref` through.

- [ ] **Step 6: Run test, confirm pass.** Run the full mobile suite + `flutter analyze`.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat(mobile): wire student onboarding into start-trip flow and alighting into in-progress panel"`

---

## PHASE D — Vehicle-Level One-Active-Trip Invariant (API; web + mobile inherit automatically)

### Task 11: Migration — vehicle invariant unique index

**Files:**

- Create: `apps/api/prisma/migrations/0007_vehicle_trip_invariant/migration.sql`
- Test: run `pnpm --filter @safari-shule/api exec prisma migrate deploy` locally against the dev DB as verification (no automated test for a bare migration; Task 12's e2e test is the behavioral verification).

- [ ] **Step 1: Confirm the next migration number.** List `apps/api/prisma/migrations/` — if a migration newer than `0006_driver_trip_invariant` already exists, name this one accordingly (e.g. `0007_...` or the next free number); do not silently reuse a number.

- [ ] **Step 2: Write the migration**, mirroring `0006_driver_trip_invariant/migration.sql` exactly but keyed on `vehicleId` instead of `driverUserId`:

```sql
DO $$
DECLARE
  duplicate_record RECORD;
BEGIN
  SELECT "tenantId", "vehicleId", COUNT(*) AS active_count
  INTO duplicate_record
  FROM "trips"
  WHERE "status" = 'in_progress'::"TripStatus"
  GROUP BY "tenantId", "vehicleId"
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'Cannot add one-active-trip-per-vehicle invariant: tenant %, vehicle % has % active trips',
      duplicate_record."tenantId",
      duplicate_record."vehicleId",
      duplicate_record.active_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "trips_one_active_per_vehicle_idx"
  ON "trips"("tenantId", "vehicleId")
  WHERE "status" = 'in_progress'::"TripStatus";
```

- [ ] **Step 3: Apply the migration locally** — `make db-migrate-new NAME=vehicle_trip_invariant` (interactive; when prompted, confirm it detects no schema drift since this is a hand-written data migration + index, or use `prisma migrate dev --create-only` then paste the SQL above into the generated empty file, matching however `0006` was originally authored) — then `pnpm --filter @safari-shule/api exec prisma generate`.

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(api): add vehicle-level one-active-trip database invariant"`

### Task 12: Service-level vehicle conflict checks

**Files:** Modify `apps/api/src/modules/trips/trips.service.ts`; Test: new `apps/api/test/vehicle-trip-invariant.e2e-spec.ts`

**Interfaces:**

- Produces: `findActiveTripIdForVehicle(tenantId, vehicleId, excludeTripId?)` mirroring `findActiveTripId` exactly but filtering on `vehicleId`.
- New error code reused: `ERROR_CODES.TRIP_ALREADY_ACTIVE` (same code, extended `details` with `{ activeTripId, conflictType: 'vehicle' }` so clients can distinguish driver-vs-vehicle conflicts if they want to, while staying backward compatible with existing `TRIP_ALREADY_ACTIVE` handling that only reads `activeTripId`).

- [ ] **Step 1: Write the failing e2e test:**

```typescript
it('starting a trip fails with TRIP_ALREADY_ACTIVE when the vehicle already has an active trip with a different driver', async () => {
  const otherDriver = await createDriver(alpha.tenantId); // reuse whatever helper this test file already has for creating a driver + token
  const firstTrip = await prisma.trip.create({
    data: {
      tenantId: alpha.tenantId,
      routeId: alphaRouteId,
      vehicleId: alpha.device!.vehicleId,
      driverUserId: otherDriver.userId,
      scheduledStart: new Date(),
      direction: 'morning_pickup',
      status: 'scheduled',
    },
  });
  await request(app.getHttpServer())
    .post(`/v1/trips/${firstTrip.id}/start`)
    .set('Authorization', `Bearer ${adminToken}`)
    .set('X-Tenant-Slug', alpha.tenantSlug)
    .expect(200);

  const secondTrip = await prisma.trip.create({
    data: {
      tenantId: alpha.tenantId,
      routeId: alphaRouteId,
      vehicleId: alpha.device!.vehicleId, // same vehicle, different driver
      driverUserId: alpha.driverUserId,
      scheduledStart: new Date(),
      direction: 'evening_dropoff',
      status: 'scheduled',
    },
  });
  const res = await request(app.getHttpServer())
    .post(`/v1/trips/${secondTrip.id}/start`)
    .set('Authorization', `Bearer ${adminToken}`)
    .set('X-Tenant-Slug', alpha.tenantSlug)
    .expect(409);
  expect(res.body.code).toBe('TRIP_ALREADY_ACTIVE');
  expect(res.body.details.activeTripId).toBe(firstTrip.id);
});
```

(Match exact fixture/helper names — `adminToken`, `createDriver`, `alphaRouteId` etc. — to whatever `driver-workspace.e2e-spec.ts` or the closest existing trips e2e spec already defines; do not invent new helper names without checking first.)

- [ ] **Step 2: Run, confirm fail** (currently only the driver-level check exists; two different drivers on the same vehicle would both succeed today).

- [ ] **Step 3: Add `findActiveTripIdForVehicle` to `TripsService`:**

```typescript
private async findActiveTripIdForVehicle(
  tenantId: string,
  vehicleId: string,
  excludeTripId?: string,
): Promise<string | null> {
  const active = await this.prisma.trip.findFirst({
    where: {
      tenantId,
      vehicleId,
      status: 'in_progress',
      ...(excludeTripId ? { id: { not: excludeTripId } } : {}),
    },
    select: { id: true },
  });
  return active?.id ?? null;
}
```

- [ ] **Step 4: Wire the check into `startTrip`**, right after the existing driver check:

```typescript
const activeTripId = await this.findActiveTripId(trip.tenantId, trip.driverUserId, trip.id);
if (activeTripId) throw this.activeTripConflict(activeTripId);
const activeVehicleTripId = await this.findActiveTripIdForVehicle(
  trip.tenantId,
  trip.vehicleId,
  trip.id,
);
if (activeVehicleTripId) throw this.activeTripConflict(activeVehicleTripId);
```

Also extend the `catch` block's `P2002` recovery path to additionally check `findActiveTripIdForVehicle` (the DB might reject on the new vehicle index instead of the driver index under a race):

```typescript
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const winnerId =
      (await this.findActiveTripId(trip.tenantId, trip.driverUserId)) ??
      (await this.findActiveTripIdForVehicle(trip.tenantId, trip.vehicleId));
    throw winnerId
      ? this.activeTripConflict(winnerId)
      : new ConflictException({
          code: ERROR_CODES.TRIP_ALREADY_ACTIVE,
          message: 'Driver or vehicle already has a trip in progress.',
          details: { activeTripId: null },
        });
  }
  throw error;
}
```

- [ ] **Step 5: Wire the same check into `updateAssignment`** — right after the existing `if (nextDriverUserId) { ... activeForNewDriver ... }` block, add an equivalent block for vehicle reassignment:

```typescript
if (nextVehicleId) {
  // ...existing vehicle active/tenant validation stays above this...
  const activeForNewVehicle = await this.findActiveTripIdForVehicle(
    trip.tenantId,
    nextVehicleId,
    id,
  );
  if (activeForNewVehicle && trip.status === 'in_progress') {
    throw this.activeTripConflict(activeForNewVehicle);
  }
}
```

(Guard with `trip.status === 'in_progress'` because reassigning a _scheduled_ trip's vehicle to one that's currently mid-trip elsewhere is fine — the conflict only matters once this trip itself tries to go active on that vehicle, which `startTrip` already re-checks at start time.)

- [ ] **Step 6: Run the new e2e test, confirm pass.** Run the full API e2e suite to confirm no regressions to `driver-workspace.e2e-spec.ts`, `cross-tenant-isolation.e2e-spec.ts`, and any dispatch/assignment specs.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat(api): enforce one-active-trip-per-vehicle invariant in startTrip and updateAssignment"`

### Task 13: Web — surface the vehicle conflict clearly instead of the generic toast

**Files:** Modify `apps/web/src/routes/trips/TripsPage.tsx`

- [ ] **Step 1: Write a failing test** (check if `apps/web` has an existing test file for `TripsPage`; if `apps/web/src/routes/trips/TripsPage.test.tsx` or similar exists, add a case there using the project's existing test setup — likely Vitest + Testing Library per `vitest.config.ts` in the workspace tree. If no test file exists yet for this page, create one following the closest existing web test's setup/mocking pattern (check `apps/web/src` for any `*.test.tsx` to copy the harness from) asserting that a 409 response with `code: 'TRIP_ALREADY_ACTIVE'` renders a specific message mentioning the vehicle or driver, not the generic "Could not update trip status."):

```typescript
it('shows a specific message when the vehicle or driver already has an active trip', async () => {
  server.use(
    http.post('*/trips/:id/start', () =>
      HttpResponse.json(
        { code: 'TRIP_ALREADY_ACTIVE', message: 'Driver already has a trip in progress.' },
        { status: 409 },
      ),
    ),
  );
  // ...render TripsPage, trigger start action...
  expect(await screen.findByText(/already has a trip in progress/i)).toBeInTheDocument();
});
```

(Match this to whatever mocking library — MSW vs. manual fetch mocks — the existing web tests already use; do not introduce a new mocking dependency.)

- [ ] **Step 2: Run, confirm fail.**

- [ ] **Step 3: Implement.** Update the mutation's `onError` in `TripsPage.tsx`:

```typescript
onError: (error: unknown) => {
  const apiError = extractApiError(error); // check apps/web/src/lib/api for an existing error-parsing helper before writing a new one; reuse it if present
  if (apiError?.code === 'TRIP_ALREADY_ACTIVE') {
    toast.error(apiError.message || 'That driver or vehicle already has a trip in progress.');
    return;
  }
  toast.error('Could not update trip status.');
},
```

(If `apps/web/src/lib/api` has no existing `extractApiError`-style helper, check how other mutations in the web app already read `error.response.data` from Axios/fetch, and mirror that exact pattern instead of inventing a new one.)

- [ ] **Step 4: Run test, confirm pass.**

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(web): surface a specific message for vehicle/driver active-trip conflicts"`

### Task 14: Mobile — the existing `ActiveTripConflict` already covers this

**Files:** none required — verify only.

- [ ] **Step 1: Confirm** `startDriverTripProvider`'s existing `ActiveTripConflict` catch-and-rethrow (shown in the research report) already fires for a vehicle-caused 409 exactly the same way it does for a driver-caused one, since both return the same `TRIP_ALREADY_ACTIVE` code/`activeTripId` shape. No mobile code change needed. Add a short e2e-style widget test only if there's an existing test asserting this behavior for the driver case, to confirm the same code path is exercised (it is the same code path, so this is a documentation/verification step, not new code).

---

## PHASE E — Branding & Polish (mobile only)

### Task 15: Carry `tenantName` through session storage

**Files:**

- Modify: `apps/mobile/lib/core/auth/session_models.dart`
- Modify: `apps/mobile/lib/core/auth/session.dart`
- Test: existing session tests (search `apps/mobile/test` for `session` to find them) plus a new assertion

**Interfaces:** The API already returns `tenantName` from both `/auth/login` and `/auth/me` (confirmed in `apps/api/src/auth/auth.service.ts`) — this is mobile-only parsing work, no API change needed.

- [ ] **Step 1: Add the field to `Session`.** In `session_models.dart`:

```dart
const factory Session({
  required String accessToken,
  required String refreshToken,
  required String tenantSlug,
  required String tenantName,
  required SessionUser user,
  ImpersonationState? impersonation,
}) = _Session;
```

Run `dart run build_runner build --delete-conflicting-outputs` in `apps/mobile` to regenerate `session_models.freezed.dart`/`.g.dart`.

- [ ] **Step 2: Write the failing test** — find the existing session/login test that asserts on the constructed `Session` after `login()` (likely in `apps/mobile/test` under an `auth` or `session` folder, or inline in `widget_test.dart`'s login test) and add an assertion that `session.tenantName` equals the mocked `/auth/me` response's `tenantName` field.

- [ ] **Step 3: Run, confirm fail** (currently `tenantName` isn't parsed).

- [ ] **Step 4: Implement.** In `session.dart`'s `login()`, after reading `meData`:

```dart
final tenantName = (meData['tenantName'] as String?) ?? tenantSlug;
```

and pass `tenantName: tenantName` into the `Session(...)` constructor call.

- [ ] **Step 5: Run test, confirm pass.**

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(mobile): carry tenant display name through session storage"`

### Task 16: Rebrand the driver shell app bar

**Files:** Modify `apps/mobile/lib/features/driver/driver_shell.dart`; Test: search for an existing `driver_shell_test.dart` or the app-bar assertions inside `app_router_test.dart`.

- [ ] **Step 1: Write the failing test** — assert the app bar (or whatever `AdaptiveScaffold` renders as its title area) shows "Safari Shule" as the primary label and "{Tenant Name} · Driver" as a secondary label, using a session fixture with `tenantName: 'Sunshine School'`:

```dart
testWidgets('driver shell shows Safari Shule brand and tenant name + role', (tester) async {
  await tester.pumpWidget(_wrapDriverShell(tenantName: 'Sunshine School')); // adapt to existing test harness
  await tester.pumpAndSettle();
  expect(find.text('Safari Shule'), findsOneWidget);
  expect(find.text('Sunshine School · Driver'), findsOneWidget);
});
```

- [ ] **Step 2: Run, confirm fail** (current shell passes `tenantLabel: tenantSlug` and no separate brand title — check `AdaptiveScaffold`'s actual parameter names first; it may need a new `brandLabel` parameter if it doesn't already separate brand from tenant).

- [ ] **Step 3: Check `AdaptiveScaffold`'s API** (`apps/mobile/lib` — search for `class AdaptiveScaffold`) to see if it already supports a two-line title (brand + subtitle) or only a single `tenantLabel`. If it only supports one label, add an optional `brandLabel` parameter to `AdaptiveScaffold` (defaulting to null, so other shells — assistant/parent/operations — are unaffected unless they opt in) that renders above `tenantLabel` in smaller text, e.g.:

```dart
if (brandLabel != null)
  Text(brandLabel!, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
Text(tenantLabel, style: Theme.of(context).textTheme.bodySmall),
```

- [ ] **Step 4: Update `DriverShell`** to pass the new fields:

```dart
final session = ref.watch(sessionNotifierProvider).value;
final tenantName = session?.tenantName ?? 'Safari Shule';
return AdaptiveScaffold(
  brandLabel: 'Safari Shule',
  tenantLabel: '$tenantName · Driver',
  roleLabel: 'Driver',
  // ...unchanged...
);
```

- [ ] **Step 5: Run test, confirm pass.** Run the full mobile suite to confirm the `AdaptiveScaffold` change (if it's shared by other shells) doesn't break assistant/parent/operations shell tests — since `brandLabel` is optional/nullable and defaults to not rendering, other shells should be unaffected, but verify.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(mobile): rebrand driver app bar with Safari Shule + tenant name + role"`

### Task 17: Account page — real tenant name + capitalized role

**Files:** Modify `apps/mobile/lib/features/settings/account_screen.dart`; Test: existing or new `account_screen_test.dart`.

- [ ] **Step 1: Write the failing test:**

```dart
testWidgets('AccountScreen shows tenant name and capitalized role', (tester) async {
  await tester.pumpWidget(_wrapAccountScreen(tenantName: 'Sunshine School', roles: const ['driver']));
  await tester.pumpAndSettle();
  expect(find.text('Sunshine School'), findsOneWidget);
  expect(find.text('Driver'), findsOneWidget);
});
```

- [ ] **Step 2: Run, confirm fail** (current screen shows `session?.tenantSlug` and `user?.roles.join(', ')` lowercase, per the research report).

- [ ] **Step 3: Implement.** Add a small capitalizer and update the two `subtitle` values:

```dart
String _titleCase(String value) =>
    value.isEmpty ? value : '${value[0].toUpperCase()}${value.substring(1)}';
```

```dart
ListTile(
  contentPadding: EdgeInsets.zero,
  leading: const Icon(Icons.apartment_outlined),
  title: const Text('School tenant'),
  subtitle: Text(session?.tenantName ?? session?.tenantSlug ?? ''),
),
ListTile(
  contentPadding: EdgeInsets.zero,
  leading: const Icon(Icons.badge_outlined),
  title: const Text('Access role'),
  subtitle: Text((user?.roles ?? const <String>[]).map(_titleCase).join(', ')),
),
```

- [ ] **Step 4: Run test, confirm pass.**

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(mobile): show tenant name and title-cased role on account screen"`

### Task 18: Redesign the login screen

**Files:** Modify `apps/mobile/lib/features/auth/login_screen.dart`; Test: `apps/mobile/test/widget_test.dart` (existing `LoginScreen happy path renders and submits` and `LoginScreen requires a tenant slug before submitting` tests must still pass — this is a visual-only change, all existing `Key`s must be preserved).

- [ ] **Step 1: Confirm the existing tests only rely on `Key`s** (`login-email`, `login-password`, `login-tenant`, `login-error`, `login-submit`) and text content (`'Safari Shule Login'` app bar title used elsewhere, per `app_router_test.dart`'s `'Safari Shule Login'` assertion) — the redesign must keep the same keys and the same discoverable text so no test needs to change. Read both existing tests fully before touching the screen.

- [ ] **Step 2: Implement** — center the form in a scrollable, max-width-constrained column with branding, replacing the current bare `Padding(child: Column(...))` body:

```dart
@override
Widget build(BuildContext context) {
  final state = ref.watch(sessionNotifierProvider);
  final loading = state.isLoading;
  final errorMessage = _errorMessage ?? (state.hasError ? apiErrorMessage(state.error!) : null);

  return Scaffold(
    body: SafeArea(
      child: LayoutBuilder(
        builder: (context, constraints) {
          return SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: constraints.maxHeight),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      Icon(Icons.directions_bus_filled_rounded, size: 56, color: Theme.of(context).colorScheme.primary),
                      const SizedBox(height: 12),
                      Text(
                        'Safari Shule',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Safari Shule Login',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.grey),
                      ),
                      const SizedBox(height: 32),
                      Card(
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                          side: BorderSide(color: Theme.of(context).colorScheme.outlineVariant),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: <Widget>[
                              TextField(
                                key: const Key('login-tenant'),
                                controller: _tenant,
                                decoration: const InputDecoration(
                                  labelText: 'School tenant',
                                  prefixIcon: Icon(Icons.apartment_outlined),
                                  border: OutlineInputBorder(),
                                ),
                              ),
                              const SizedBox(height: 16),
                              TextField(
                                key: const Key('login-email'),
                                controller: _email,
                                decoration: const InputDecoration(
                                  labelText: 'Email',
                                  prefixIcon: Icon(Icons.email_outlined),
                                  border: OutlineInputBorder(),
                                ),
                              ),
                              const SizedBox(height: 16),
                              TextField(
                                key: const Key('login-password'),
                                controller: _password,
                                obscureText: true,
                                decoration: const InputDecoration(
                                  labelText: 'Password',
                                  prefixIcon: Icon(Icons.lock_outline),
                                  border: OutlineInputBorder(),
                                ),
                              ),
                              if (errorMessage != null) ...<Widget>[
                                const SizedBox(height: 16),
                                Text(
                                  errorMessage,
                                  key: const Key('login-error'),
                                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                                ),
                              ],
                              const SizedBox(height: 24),
                              SizedBox(
                                height: 48,
                                child: FilledButton(
                                  key: const Key('login-submit'),
                                  onPressed: loading ? null : _submit,
                                  child: loading
                                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                      : const Text('Sign in'),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    ),
  );
}
```

Note: this removes the bare `AppBar(title: Text('Safari Shule Login'))` in favor of putting that same string inline in the centered body — confirm `app_router_test.dart`'s `expect(find.text('Safari Shule Login'), findsOneWidget)` still passes since the exact text is preserved (now as body text, not an app-bar title); if that test specifically checks for an `AppBar`/`Scaffold.appBar` (not just any text), keep a minimal `AppBar` too, or adjust just that one assertion after confirming with a test run — do not guess, run the test.

- [ ] **Step 3: Run the two existing `widget_test.dart` login tests and `app_router_test.dart`'s unauthenticated redirect test, confirm all still pass.**

- [ ] **Step 4: Run the full mobile suite + `flutter analyze`.**

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(mobile): redesign login screen with centered, branded layout"`

---

---

## PHASE F — Restore Active Trip Telemetry Across Login and App Resume

This is carried over unchanged from the prior `docs/superpowers/plans/2026-09-01-driver-trip-workflow.md` plan's Task 6, which was never implemented (that plan's ledger shows Tasks 1-5 complete, Task 6-7 still open). Folding it in here so this execution run closes out that outstanding gap before final verification.

### Task 19: Restore active telemetry across login and app resume

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

- [ ] **Step 1: Write failing idempotency and lifecycle tests.** Extract background geolocation behind a small injectable adapter so unit tests do not invoke the native plugin. Assert:

```dart
await service.start('trip-1');
await service.start('trip-1');
expect(adapter.startCalls, 1);

await service.start('trip-2');
expect(adapter.stopCalls, 1);
expect(service.activeTripId, 'trip-2');
```

For coordinator tests, return a workspace with `activeTrip.id == 'trip-1'`, call `sync()` twice, and assert one effective telemetry start. Return no active trip and assert stop. In a widget lifecycle test, dispatch `AppLifecycleState.resumed`, settle, and assert the workspace is refreshed and coordinator sync is invoked.

- [ ] **Step 2: Run focused tests, verify RED.**

```bash
cd apps/mobile
flutter test test/unit/trip_telemetry_service_test.dart test/widget/app_router_test.dart
```

Expected: compile or assertion failures because there is no adapter, active trip state, coordinator, or lifecycle observer.

- [ ] **Step 3: Make telemetry idempotent.** Add a `TripLocationAdapter` interface wrapping ready, listener registration/removal, start, and stop. The production adapter delegates to `bg.BackgroundGeolocation`; tests use a fake. Track `_activeTripId` and return early from `start` when it matches. When switching IDs, call `stop` before registering the new listener. Clear `_activeTripId` only after stop cleanup.

- [ ] **Step 4: Add the coordinator and app lifecycle ownership.** `DriverTripCoordinator` receives a Riverpod `Ref`, loads/refreshes `driverWorkspaceProvider`, and synchronizes telemetry to `activeTrip?.id`. Serialize concurrent `sync()` calls with one in-flight future. Make `_SafariShuleAppState` implement `WidgetsBindingObserver`. Register in `initState`, unregister in `dispose`, and call coordinator sync only for authenticated sessions containing the `driver` role. On logout, stop telemetry and invalidate driver providers. On `resumed`, invalidate workspace then sync. Keep push notification and outbox initialization behavior unchanged.

- [ ] **Step 5: Verify lifecycle behavior GREEN.**

```bash
flutter test test/unit/trip_telemetry_service_test.dart test/widget/app_router_test.dart
flutter analyze
```

Expected: idempotency/lifecycle tests pass and analyzer reports no issues.

- [ ] **Step 6: Commit.**

```bash
git add apps/mobile/lib/core/telemetry/trip_telemetry_service.dart apps/mobile/lib/features/driver/driver_trip_coordinator.dart apps/mobile/lib/app/app.dart apps/mobile/test/unit/trip_telemetry_service_test.dart apps/mobile/test/widget/app_router_test.dart
git commit -m "feat(mobile): restore active trip telemetry across login and app resume"
```

## Final Verification (after all phases)

- [ ] Run `(cd apps/mobile && flutter test)` — expect all tests passing (baseline was 140; expect the count to grow with each phase's new tests).
- [ ] Run `(cd apps/mobile && flutter analyze)` — expect "No issues found!".
- [ ] Run `(cd apps/api && pnpm run build)` and `pnpm exec tsc --noEmit` — expect exit 0.
- [ ] Run `(cd apps/api && pnpm run test:e2e)` — expect all specs passing, including the new attendance and vehicle-invariant specs.
- [ ] Manually smoke-test on the emulator: log in, view an upcoming trip (map + chips), start it with a manual board, view in-progress (map + SOS + alight), end it, view it in "Recent trips" (status + time), sign out and confirm the login screen renders centered.
- [ ] Update `/memories/repo/driver-trip-workflow-evidence.md` (existing repo memory file) with a summary of what changed, so future sessions have accurate baseline facts.
