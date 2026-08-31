# Mobile Role-Aware Shell Design

**Goal:** Replace title-only mobile shells with role-aware navigation that exposes the correct daily workflow, tenant context, account controls, and safety actions.

## Architecture

`AdaptiveScaffold` will own compact, medium, and expanded navigation. Compact screens use a role-specific bottom navigation bar. Medium screens use a navigation rail and expanded screens use a navigation drawer. Feature routes remain owned by `go_router`; the scaffold derives selected navigation state from the active location.

Every shell obtains the active `Session` from Riverpod. The session supplies tenant slug, identity, roles, and permissions. Navigation choices are role-scoped and permission-aware; a user is never routed into a shell intended for a different role.

## Visual Direction

The redesign follows the Savanna system: zinc surfaces, emerald primary actions, amber for in-progress transport activity, and rose only for SOS/destructive actions. The top app bar carries the Safari Shule wordmark and a concise tenant-and-role label rather than a bare role title. Compact dashboards use clear operational hierarchy with a title, a concise status summary, and actionable list rows.

Buttons use familiar icons for refresh, SOS, navigation, and account actions. All interactive targets are at least 48 dp. Cards are reserved for trip and safety summaries, with an 8 dp radius and no nested-card layout.

## Role Navigation

### Driver

Bottom navigation: **Trips**, **Messages**, **Account**. Trips is the home route and lists only trips assigned to the logged-in driver. A trip detail exposes state-appropriate start/end actions. SOS remains visible as a labeled, rose emergency action in the app bar and trip view. Refresh is labeled and only refreshes assigned trips.

### Assistant / Caretaker

Bottom navigation: **Scan**, **Trips**, **Account**. Scan is the home route and makes NFC and QR fallback the primary actions. Trips is read-only operational context. Account exposes identity, tenant, and sign out.

### Parent

Bottom navigation: **Children**, **Payments**, **Account**. Children is the home route and links to tracking. Tracking preserves map focus and shows the latest vehicle location/status. Account exposes identity, tenant, and sign out.

### Operations Roles

System admins, school managers, transport admins, dispatchers, and other non-mobile-specific roles retain the Operations dashboard. It presents only shortcuts authorized by the active permission set and includes Account/sign out access. It does not masquerade as a Parent experience.

## Account and Session

All shells provide an Account destination with user full name, email, role labels, tenant slug, and a sign-out command. Sign out calls the auth logout endpoint when a session exists, clears secure storage, and redirects to Login. The app bar account icon provides a direct route to this destination.

## States and Errors

Dashboards use skeleton layouts for loading, centered empty states that explain the role-specific condition, and inline retry actions for errors. Trip transitions show a progress indicator while a request is pending and surface API failures in a snackbar. Offline SOS and telemetry retain the existing Hive outbox behavior and visibly confirm queuing.

## Testing

Widget tests cover role-to-shell routing, active navigation selection, Account visibility, sign-out transition, and Driver/Assistant/Parent home navigation. Existing trip, scan, and parent tracking tests remain and are updated only where labels or navigation structure changes.
