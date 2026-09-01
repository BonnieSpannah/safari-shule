# Driver Trip Workflow Design

**Goal:** Give drivers a safe, task-first mobile workflow that exposes only their assignments, enforces one active trip, restores an in-progress trip after login, and presents useful status-specific maps and actions.

## Product Principles

The driver app answers one question first: "What do I need to do now?" It is not a compact version of the dispatch console. An active trip owns the dashboard. Without an active trip, the next scheduled assignment is primary. Remaining upcoming work and final trip history stay available without competing with the immediate task.

The server is authoritative for assignment, status, and the one-active-trip rule. The mobile app never infers status from local booleans, never relies on client-side ownership filtering, and never optimistically changes a trip state before the API confirms it.

## Architecture

A dedicated driver workspace endpoint derives the driver identity from the JWT and returns an active trip, upcoming scheduled trips, and recent final trips. It does not accept a driver ID. A driver detail endpoint applies the same server-side ownership rule and returns the route, passenger summary, and location data needed by the mobile experience. Existing generic trip endpoints remain available to authorized dispatch and administrative workflows.

PostgreSQL enforces at most one `in_progress` trip for each tenant and driver with a partial unique index over `(tenantId, driverUserId)` where status is `in_progress`. The migration preserves the existing trip indexes and adds this unique driver invariant. It performs a duplicate precondition check and aborts with an actionable error instead of silently changing existing trip statuses. Every start path, including driver and dispatch starts, uses the same service operation. Assignment changes also respect the invariant. This prevents races across devices, repeated taps, and concurrent dispatch actions.

A conflicting start returns HTTP `409` with `{ "code": "TRIP_ALREADY_ACTIVE", "message": "Driver already has a trip in progress.", "details": { "activeTripId": "<uuid>" } }`. The service checks for an existing active trip to provide a clear response. If concurrent starts pass that check, the unique-index violation is caught, the winning active trip is queried, and the same domain response is returned. The mobile app refreshes the workspace and offers **Resume trip** for that trip.

## API Contracts

`GET /v1/trips/driver-workspace` requires `trips.view`, derives the user ID from the authenticated request, and returns:

```json
{
  "activeTrip": null,
  "upcomingTrips": [],
  "recentTrips": []
}
```

`activeTrip` is the driver's single `in_progress` trip or `null`. `upcomingTrips` contains all of the driver's `scheduled` trips ordered by `scheduledStart` ascending. `recentTrips` contains at most 20 of the driver's `completed` and `cancelled` trips ordered by `endedAt` descending, then `scheduledStart` descending as a stable fallback. A later history pagination endpoint is outside this change; **View all** presents these 20 recent records.

`GET /v1/trips/driver/:id` returns a trip only when `driverUserId` matches the authenticated user. A missing, cross-tenant, or differently assigned trip returns `404`. The response includes:

- Trip timestamps, status, direction, and assignment IDs.
- Route name, start point, ordered bus stops, and end point.
- Vehicle registration and operational label.
- Passenger counts derived from `expected`, `boardedAt`, and `alightedAt`: expected, boarded, currently on board, and alighted.
- Ordered location snapshots with coordinates, speed, heading, and recorded time.
- Persisted cancellation reason when the trip is cancelled.

The existing `POST /v1/trips/:id/driver-start` and `POST /v1/trips/:id/driver-end` routes remain the mobile transition commands. Both validate assignment and current server status. Generic dispatch start uses the same invariant-aware service method.

The Trip model gains a nullable `cancellationReason` column. `POST /v1/trips/:id/cancel` continues to require the existing validated reason, passes it to the service, and persists it with the cancelled state. Existing cancelled records remain valid with a null reason and display a neutral "Reason unavailable" fallback.

## Dashboard

The driver lands on a task-first command center after login.

When an active trip exists, the dashboard shows its route, vehicle, elapsed time, latest GPS health, passenger summary, a compact live-map preview, and one dominant **Resume trip** action. The app restores background telemetry as soon as the server-confirmed active trip loads. The driver deliberately taps **Resume trip** to enter the full trip screen.

When no trip is active, the next scheduled trip is primary. It shows route, scheduled time, vehicle, direction, passenger count, and **View route**. **Start trip** is available from its detail screen after a readiness confirmation. Additional scheduled trips appear as compact chronological rows.

Recent completed and cancelled trips are secondary and available through **View all**. They never displace the active or next assignment. Pull-to-refresh, app resume, successful mutations, and active-trip conflicts refresh the workspace. Loading uses a stable skeleton, empty state says that no trips are assigned, and errors preserve the last safe server-confirmed state with a retry action.

## Trip Status Experience

### Scheduled

The screen shows the planned route, start and end points, ordered stops with their scheduled pickup or drop-off times, vehicle, and passenger count. **Start trip** is the primary action. Starting requires a confirmation sheet summarizing the route, vehicle, scheduled time, and passenger count. If another trip is active, the API rejects the start and the app offers to resume the existing trip.

### In Progress

The full live map dominates the screen. It shows the planned route, travelled path, current vehicle marker and heading, last GPS update age, and location health. Operational summaries show elapsed time, distance covered when derivable, and boarding counts.

**End trip** is visually distinct and requires confirmation. If the `boardedAt != null && alightedAt == null` count is greater than zero, the confirmation warns the driver without silently discarding attendance state. **SOS** remains immediately available as a labeled destructive action. Telemetry runs only for the server-confirmed active trip.

### Completed

The screen is read-only. It fits the camera to the actual travelled path reconstructed from ordered location snapshots and shows start/end times, duration, distance when derivable, vehicle, and passenger summary. Start, end, and SOS controls are absent.

### Cancelled

The screen is read-only and displays the cancellation reason when available. A trip cancelled before movement shows the planned route. A trip cancelled after movement distinguishes the travelled segment from the untravelled plan. Start and end controls are absent.

## Map Semantics

The route model currently stores a start point, ordered bus stops, and an end point rather than a road-snapped LineString. The planned map therefore draws an explicit operational control-point polyline through those points. It must be labeled as a planned route and must not imply turn-by-turn road navigation.

An in-progress map overlays the actual snapshot polyline and latest location marker on the planned path. A completed map emphasizes the actual snapshot polyline. A cancelled map selects planned-only or planned-plus-travelled treatment based on whether snapshots exist.

No-location states are intentional: zero points show the planned map with a location-unavailable message, and one point shows a marker without inventing a travelled line. The map fits known points, uses accessible contrast, and keeps controls clear of system insets. REST detail snapshots provide the initial and reconnect fallback; Socket.IO location events append live points without replacing server history.

## Resume And Telemetry

After login or app process restoration, the dashboard fetches the driver workspace. If `activeTrip` exists, telemetry starts for that ID even before the driver opens the full trip screen. Repeated restoration is idempotent and cannot start multiple telemetry subscriptions.

The **Resume trip** action opens the server-backed in-progress detail. It does not call the start endpoint again. Ending a trip stops telemetry only after the API confirms `completed`. A failed end leaves tracking active and displays a retryable error.

WebSocket disconnects show a nonblocking reconnecting state while location uploads and REST snapshots remain available. Stale GPS, denied location permission, disabled device location, and upload failures are visible but do not fabricate trip status. Existing offline location and SOS outbox behavior remains intact.

## Error Handling

- `TRIP_ALREADY_ACTIVE` (`409`): read `details.activeTripId`, refresh the workspace, and show **Resume trip** for that trip.
- `TRIP_NOT_SCHEDULED`: refresh detail and workspace because another actor changed the trip.
- `TRIP_NOT_IN_PROGRESS`: refresh detail and stop telemetry only when the server confirms a final state.
- `404` from driver detail or mutation: remove inaccessible stale data and return to the workspace.
- Network failure during start or end: retain the prior server-confirmed status and offer retry.
- Location or WebSocket failure: keep the trip active, expose tracking health, and use persisted snapshots as fallback.

Mutation buttons disable while a request is pending to prevent duplicate local submissions. The database invariant remains the final protection against concurrency.

## Visual And Interaction Direction

The mobile experience follows the existing Safari Shule visual system: restrained zinc surfaces, emerald primary actions, amber for active operational attention, and rose only for SOS and destructive confirmation. Cards use no more than 8 dp radius and are reserved for discrete trip summaries. There are no nested cards.

Primary touch targets are at least 48 dp. Route names and the next action have the strongest hierarchy; opaque trip IDs are not used as titles. Buttons use familiar icons with concise labels. Status is communicated with text and iconography as well as color. Dynamic text scaling must not overlap map controls or actions.

## Security And Tenant Isolation

Driver workspace and detail queries always include the authenticated JWT user ID and tenant context. No request parameter can select another driver. Cross-tenant and same-tenant unassigned trips are indistinguishable from missing records to the mobile caller.

All Prisma creates continue to pass an explicit `tenantId: requireTenantId()`. Reads use the scoped Prisma client and the existing request context. The partial unique index includes `tenantId` and `driverUserId` and applies only to `in_progress` rows.

## Testing

API e2e tests cover:

- A driver workspace returns only the authenticated driver's trips.
- Active, upcoming, and recent groups are correctly ordered and bounded.
- A relogged driver receives the existing active trip.
- A driver cannot retrieve, start, or end another driver's trip.
- Driver and dispatch attempts to start a second active trip return `409` and `activeTripId`.
- Concurrent start requests cannot create two active trips.
- Reassignment cannot give an active trip to a driver who already has one.
- Ending the active trip permits a later scheduled trip to start.
- Tenant isolation remains intact.
- Detail returns planned route points and ordered snapshots.

Flutter unit tests cover workspace parsing, status-to-action rules, path selection for all statuses, single-point and empty-location behavior, active-trip conflict recovery, and idempotent telemetry restoration.

Flutter widget tests cover active-first dashboard hierarchy, no-active next-trip hierarchy, deliberate resume navigation, start and end confirmations, passenger warning, read-only completed and cancelled views, loading/error/empty states, and accessible labels.

Verification runs the focused API e2e trip suite, focused Flutter tests, Flutter analyzer, API TypeScript test typecheck, API build, and existing mobile test suite. Map behavior is also verified on the configured Android emulator at compact and large text scales.

## Out Of Scope

This change does not add turn-by-turn navigation, a road-routing provider, route optimization, or a road-snapped route geometry editor. It does not redesign dispatch trip management or parent tracking. Those workflows continue to consume existing APIs and may adopt shared map components later without changing the driver contracts defined here.
