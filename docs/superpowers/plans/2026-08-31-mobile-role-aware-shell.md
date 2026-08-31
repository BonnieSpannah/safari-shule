# Mobile Role-Aware Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each mobile role an intuitive, tenant-aware operational shell with navigation and a working account/sign-out destination.

**Architecture:** Introduce a shared adaptive scaffold that derives selected navigation from `GoRouter`. Role shells define their destinations; the account screen reads the Riverpod session and invokes the existing logout lifecycle. Existing feature screens remain route-owned and are composed inside the scaffold.

**Tech Stack:** Flutter Material 3, Riverpod, go_router, flutter_test.

## Global Constraints

- Preserve Savanna semantic colors: emerald primary, amber transit activity, rose SOS/destructive actions.
- Compact navigation uses bottom navigation; wider layouts use a navigation rail.
- Keep all interactive targets at least 48 dp and preserve tenant-scoped session behavior.
- Do not commit this work until the user requests it.

---

### Task 1: Shared Adaptive Shell and Account

**Files:**

- Create: `apps/mobile/lib/shared/widgets/adaptive_scaffold.dart`
- Create: `apps/mobile/lib/features/settings/account_screen.dart`
- Test: `apps/mobile/test/widget/adaptive_scaffold_test.dart`

- [ ] Write a failing widget test asserting compact bottom navigation exposes an Account destination.
- [ ] Implement `AdaptiveScaffold` with app brand, tenant/role context, compact bottom navigation, and medium-width navigation rail.
- [ ] Implement `AccountScreen` with active identity, tenant, role labels, and sign out.
- [ ] Run `flutter test test/widget/adaptive_scaffold_test.dart`.

### Task 2: Role Shell Destinations

**Files:**

- Modify: `apps/mobile/lib/features/driver/driver_shell.dart`
- Modify: `apps/mobile/lib/features/caretaker/assistant_shell.dart`
- Modify: `apps/mobile/lib/features/parent/parent_shell.dart`
- Modify: `apps/mobile/lib/app/app_router.dart`
- Test: `apps/mobile/test/widget/app_router_test.dart`

- [ ] Write failing route tests for Driver, Assistant, and Parent account navigation.
- [ ] Replace title-only shells with role destination definitions backed by `AdaptiveScaffold`.
- [ ] Add role-specific message/trip placeholders only where a required destination has no screen.
- [ ] Run focused route tests, then `flutter analyze && flutter test`.
