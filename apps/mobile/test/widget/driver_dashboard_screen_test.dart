import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/driver/driver_dashboard_screen.dart';
import 'package:mobile/features/driver/driver_trip_models.dart';
import 'package:mobile/features/driver/driver_trip_providers.dart';
import 'package:mobile/features/driver/driver_recent_trips_screen.dart';

void _registerFormattingTests() {
  group('formatTripSchedule', () {
    final now = DateTime(2026, 9, 2, 10);

    test('uses a relative day label for today and tomorrow', () {
      expect(
        formatTripSchedule(DateTime(2026, 9, 2, 18), now: now),
        'Today 6:00 PM',
      );
      expect(
        formatTripSchedule(DateTime(2026, 9, 3, 7), now: now),
        'Tomorrow 7:00 AM',
      );
    });

    test('uses an absolute date outside yesterday, today, and tomorrow', () {
      expect(
        formatTripSchedule(DateTime(2026, 9, 5, 7), now: now),
        '5 Sep 2026, 7:00 AM',
      );
    });
  });

  group('formatTripStarted', () {
    test('shows an elapsed duration for a recent start', () {
      expect(
        formatTripStarted(
          DateTime(2026, 9, 2, 9, 36),
          now: DateTime(2026, 9, 2, 10),
        ),
        'Started 24 min ago',
      );
    });

    test('includes the start time once a trip has run for a day', () {
      expect(
        formatTripStarted(
          DateTime(2026, 8, 31, 6, 5),
          now: DateTime(2026, 9, 2, 10),
        ),
        'Started 2 days ago, 6:05 AM',
      );
    });
  });

  group('formatGpsHealth', () {
    final now = DateTime.utc(2026, 9, 2, 10);

    test('reports unavailable when there is no snapshot', () {
      expect(formatGpsHealth(null, now: now), 'Location unavailable');
    });

    test('reports live for a very recent snapshot', () {
      expect(
        formatGpsHealth(now.subtract(const Duration(seconds: 20)), now: now),
        'GPS live',
      );
    });

    test('reports elapsed minutes for a moderately stale snapshot', () {
      expect(
        formatGpsHealth(now.subtract(const Duration(minutes: 5)), now: now),
        'GPS 5 min ago',
      );
    });

    test('flags a very stale snapshot without implying trip status', () {
      expect(
        formatGpsHealth(now.subtract(const Duration(minutes: 40)), now: now),
        'GPS stale · 40 min ago',
      );
    });
  });
}

// ── Fixtures ──────────────────────────────────────────────────────────────

DriverTripDetail _makeDetail({
  String id = 'trip-active',
  DriverTripStatus status = DriverTripStatus.inProgress,
}) {
  return DriverTripDetail.fromJson(<String, Object?>{
    'id': id,
    'status': switch (status) {
      DriverTripStatus.scheduled => 'scheduled',
      DriverTripStatus.inProgress => 'in_progress',
      DriverTripStatus.completed => 'completed',
      DriverTripStatus.cancelled => 'cancelled',
    },
    'scheduledStart': '2026-09-01T06:00:00.000Z',
    'startedAt': '2026-09-01T06:05:00.000Z',
    'endedAt': null,
    'direction': 'outbound',
    'routeId': 'route-1',
    'vehicleId': 'vehicle-1',
    'route': <String, Object?>{
      'id': 'route-1',
      'name': 'Kilimani to Hillcrest',
      'startPoint': <String, Object?>{'lat': -1.2921, 'lng': 36.8219},
      'endPoint': <String, Object?>{'lat': -1.2800, 'lng': 36.8300},
      'busStops': <Object?>[],
    },
    'passengerSummary': <String, Object?>{
      'expected': 10,
      'boarded': 8,
      'onBoard': 8,
      'alighted': 0,
    },
    'cancellationReason': null,
    'locationSnapshots': <Object?>[
      <String, Object?>{
        'lat': -1.2921,
        'lng': 36.8219,
        'headingDeg': 45.0,
        'speedKph': 30.0,
        'recordedAt': '2026-09-01T06:10:00.000Z',
      },
    ],
  });
}

DriverWorkspace _activeWorkspace() =>
    DriverWorkspace.fromJson(<String, Object?>{
      'activeTrip': <String, Object?>{
        'id': 'trip-active',
        'status': 'in_progress',
        'scheduledStart': '2026-09-01T06:00:00.000Z',
        'startedAt': '2026-09-01T06:05:00.000Z',
        'endedAt': null,
        'direction': 'outbound',
        'routeId': 'route-1',
        'vehicleId': 'vehicle-1',
        'route': <String, Object?>{
          'id': 'route-1',
          'name': 'Kilimani to Hillcrest',
        },
        'vehicle': <String, Object?>{
          'id': 'vehicle-1',
          'registration': 'KCA 123A',
          'capacity': 14,
        },
        '_count': <String, Object?>{'passengers': 8},
      },
      'upcomingTrips': <Object?>[
        <String, Object?>{
          'id': 'trip-2',
          'status': 'scheduled',
          'scheduledStart': '2026-09-01T14:00:00.000Z',
          'startedAt': null,
          'endedAt': null,
          'direction': 'inbound',
          'routeId': 'route-2',
          'vehicleId': 'vehicle-1',
          'route': <String, Object?>{
            'id': 'route-2',
            'name': 'Hillcrest to Kilimani',
          },
          'vehicle': <String, Object?>{
            'id': 'vehicle-1',
            'registration': 'KCA 123A',
            'capacity': 14,
          },
          '_count': <String, Object?>{'passengers': 5},
        },
      ],
      'recentTrips': <Object?>[
        <String, Object?>{
          'id': 'trip-old',
          'status': 'completed',
          'scheduledStart': '2026-08-31T06:00:00.000Z',
          'startedAt': '2026-08-31T06:05:00.000Z',
          'endedAt': '2026-08-31T07:10:00.000Z',
          'direction': 'outbound',
          'routeId': 'route-1',
          'vehicleId': 'vehicle-1',
          'route': <String, Object?>{
            'id': 'route-1',
            'name': 'Kilimani to Hillcrest',
          },
          'vehicle': <String, Object?>{
            'id': 'vehicle-1',
            'registration': 'KCA 123A',
            'capacity': 14,
          },
          '_count': <String, Object?>{'passengers': 10},
        },
      ],
    });

DriverWorkspace _noActiveWorkspace() =>
    DriverWorkspace.fromJson(<String, Object?>{
      'activeTrip': null,
      'upcomingTrips': <Object?>[
        <String, Object?>{
          'id': 'trip-next',
          'status': 'scheduled',
          'scheduledStart': '2026-09-01T07:00:00.000Z',
          'startedAt': null,
          'endedAt': null,
          'direction': 'outbound',
          'routeId': 'route-1',
          'vehicleId': 'vehicle-1',
          'route': <String, Object?>{
            'id': 'route-1',
            'name': 'Kilimani to Hillcrest',
          },
          'vehicle': <String, Object?>{
            'id': 'vehicle-1',
            'registration': 'KCA 123A',
            'capacity': 14,
          },
          '_count': <String, Object?>{'passengers': 6},
        },
        <String, Object?>{
          'id': 'trip-later',
          'status': 'scheduled',
          'scheduledStart': '2026-09-01T14:00:00.000Z',
          'startedAt': null,
          'endedAt': null,
          'direction': 'inbound',
          'routeId': 'route-2',
          'vehicleId': 'vehicle-1',
          'route': <String, Object?>{
            'id': 'route-2',
            'name': 'Hillcrest to Kilimani',
          },
          'vehicle': <String, Object?>{
            'id': 'vehicle-1',
            'registration': 'KCA 123A',
            'capacity': 14,
          },
          '_count': <String, Object?>{'passengers': 4},
        },
      ],
      'recentTrips': <Object?>[],
    });

DriverWorkspace _emptyWorkspace() => DriverWorkspace.fromJson(<String, Object?>{
  'activeTrip': null,
  'upcomingTrips': <Object?>[],
  'recentTrips': <Object?>[],
});

// ── Helpers ───────────────────────────────────────────────────────────────

Widget _wrap(Widget child, {List<Object> overrides = const []}) =>
    ProviderScope(
      overrides: overrides.cast(),
      child: MaterialApp(home: child),
    );

// ── Tests ─────────────────────────────────────────────────────────────────

void main() {
  _registerFormattingTests();

  group('DriverDashboardScreen — active trip', () {
    testWidgets('shows Resume trip, route name, and compact map preview', (
      WidgetTester tester,
    ) async {
      final workspace = _activeWorkspace();
      final detail = _makeDetail();

      await tester.pumpWidget(
        _wrap(
          const DriverDashboardScreen(),
          overrides: [
            driverWorkspaceProvider.overrideWith((_) async => workspace),
            driverTripDetailProvider(
              'trip-active',
            ).overrideWith((_) async => detail),
          ],
        ),
      );
      await tester.pump(); // schedule futures
      await tester.pump(); // settle providers

      expect(find.byKey(const Key('driver-active-trip')), findsOneWidget);
      expect(find.text('Resume trip'), findsOneWidget);
      expect(find.text('Kilimani to Hillcrest'), findsOneWidget);
      expect(
        find.byKey(const Key('driver-active-map-preview')),
        findsOneWidget,
      );
    });

    testWidgets(
      'pushes elapsed time to the status line and direction to the vehicle line',
      (WidgetTester tester) async {
        final workspace = _activeWorkspace();
        final detail = _makeDetail();

        await tester.pumpWidget(
          _wrap(
            const DriverDashboardScreen(),
            overrides: [
              driverWorkspaceProvider.overrideWith((_) async => workspace),
              driverTripDetailProvider(
                'trip-active',
              ).overrideWith((_) async => detail),
            ],
          ),
        );
        await tester.pump();
        await tester.pump();

        final statusPos = tester.getTopLeft(find.text('In progress'));
        final elapsedPos = tester.getTopLeft(find.textContaining('Started'));
        expect(elapsedPos.dx, greaterThan(statusPos.dx));
        expect(elapsedPos.dy, closeTo(statusPos.dy, 4));

        // 'KCA 123A'/'Outbound' also appear in the compact upcoming row, so scope to the active card's key.
        final activeCard = find.byKey(const Key('driver-active-trip'));
        final vehicleFinder = find.descendant(
          of: activeCard,
          matching: find.text('KCA 123A'),
        );
        final directionFinder = find.descendant(
          of: activeCard,
          matching: find.text('Outbound'),
        );
        expect(vehicleFinder, findsOneWidget);
        expect(directionFinder, findsOneWidget);
        final vehiclePos = tester.getTopLeft(vehicleFinder);
        final directionPos = tester.getTopLeft(directionFinder);
        expect(directionPos.dx, greaterThan(vehiclePos.dx));
        expect(directionPos.dy, closeTo(vehiclePos.dy, 4));
      },
    );

    testWidgets('shows Up next section for additional upcoming trips', (
      WidgetTester tester,
    ) async {
      final workspace = _activeWorkspace();
      final detail = _makeDetail();

      await tester.pumpWidget(
        _wrap(
          const DriverDashboardScreen(),
          overrides: [
            driverWorkspaceProvider.overrideWith((_) async => workspace),
            driverTripDetailProvider(
              'trip-active',
            ).overrideWith((_) async => detail),
          ],
        ),
      );
      await tester.pump();
      await tester.pump();

      expect(find.text('Up next'), findsOneWidget);
    });

    testWidgets('shows View all for recent trips', (WidgetTester tester) async {
      final workspace = _activeWorkspace();
      final detail = _makeDetail();

      await tester.pumpWidget(
        _wrap(
          const DriverDashboardScreen(),
          overrides: [
            driverWorkspaceProvider.overrideWith((_) async => workspace),
            driverTripDetailProvider(
              'trip-active',
            ).overrideWith((_) async => detail),
          ],
        ),
      );
      await tester.pump();
      await tester.pump();

      expect(find.byKey(const Key('driver-recent-trips')), findsOneWidget);
      expect(find.text('View all'), findsOneWidget);
    });
  });

  group('DriverDashboardScreen — no active trip', () {
    testWidgets(
      'earliest upcoming is primary, shows View route, no Resume trip',
      (WidgetTester tester) async {
        final workspace = _noActiveWorkspace();
        final detail = _makeDetail(
          id: 'trip-next',
          status: DriverTripStatus.scheduled,
        );

        await tester.pumpWidget(
          _wrap(
            const DriverDashboardScreen(),
            overrides: [
              driverWorkspaceProvider.overrideWith((_) async => workspace),
              driverTripDetailProvider(
                'trip-next',
              ).overrideWith((_) async => detail),
            ],
          ),
        );
        await tester.pump();
        await tester.pump();

        expect(find.byKey(const Key('driver-next-trip')), findsOneWidget);
        expect(find.text('Kilimani to Hillcrest'), findsOneWidget);
        expect(find.text('View route'), findsOneWidget);
        expect(find.text('Resume trip'), findsNothing);
      },
    );

    testWidgets('additional upcoming trips are shown compactly', (
      WidgetTester tester,
    ) async {
      final workspace = _noActiveWorkspace();
      final detail = _makeDetail(
        id: 'trip-next',
        status: DriverTripStatus.scheduled,
      );

      await tester.pumpWidget(
        _wrap(
          const DriverDashboardScreen(),
          overrides: [
            driverWorkspaceProvider.overrideWith((_) async => workspace),
            driverTripDetailProvider(
              'trip-next',
            ).overrideWith((_) async => detail),
          ],
        ),
      );
      await tester.pump();
      await tester.pump();

      expect(find.text('Hillcrest to Kilimani'), findsOneWidget);
    });

    testWidgets('does not show a Start button on dashboard', (
      WidgetTester tester,
    ) async {
      final workspace = _noActiveWorkspace();
      final detail = _makeDetail(
        id: 'trip-next',
        status: DriverTripStatus.scheduled,
      );

      await tester.pumpWidget(
        _wrap(
          const DriverDashboardScreen(),
          overrides: [
            driverWorkspaceProvider.overrideWith((_) async => workspace),
            driverTripDetailProvider(
              'trip-next',
            ).overrideWith((_) async => detail),
          ],
        ),
      );
      await tester.pump();
      await tester.pump();

      expect(find.text('Start'), findsNothing);
      expect(find.text('Start trip'), findsNothing);
    });

    testWidgets(
      'next trip card shows map preview and expected passenger count',
      (WidgetTester tester) async {
        final workspace = _noActiveWorkspace();
        final upcomingSummary = workspace.upcomingTrips.first;
        final detail = _makeDetail(
          id: 'trip-next',
          status: DriverTripStatus.scheduled,
        );

        await tester.pumpWidget(
          _wrap(
            const DriverDashboardScreen(),
            overrides: [
              driverWorkspaceProvider.overrideWith((_) async => workspace),
              driverTripDetailProvider(
                'trip-next',
              ).overrideWith((_) async => detail),
            ],
          ),
        );
        await tester.pump();
        await tester.pump();

        final nextCard = find.byKey(const Key('driver-next-trip'));
        expect(
          find.descendant(
            of: nextCard,
            matching: find.byKey(const Key('driver-active-map-preview')),
          ),
          findsOneWidget,
        );
        expect(
          find.text(
            'Passengers expected: ${detail.passengerSummary.expected}',
          ),
          findsOneWidget,
        );
        expect(
          find.text(formatTripSchedule(upcomingSummary.scheduledStart)),
          findsOneWidget,
        );
        expect(
          find.descendant(
            of: nextCard,
            matching: find.text(
              formatTripDirection(upcomingSummary.direction),
            ),
          ),
          findsOneWidget,
        );
      },
    );
  });

  group('DriverDashboardScreen — upcoming row layout', () {
    testWidgets('compact trip row shows time left, vehicle + direction right', (
      WidgetTester tester,
    ) async {
      final workspace = _activeWorkspace();
      final detail = _makeDetail();
      final upcomingSummary = workspace.upcomingTrips.single;

      await tester.pumpWidget(
        _wrap(
          const DriverDashboardScreen(),
          overrides: [
            driverWorkspaceProvider.overrideWith((_) async => workspace),
            driverTripDetailProvider(
              'trip-active',
            ).overrideWith((_) async => detail),
          ],
        ),
      );
      await tester.pump();
      await tester.pump();

      // Scope to the compact row's own key: 'KCA 123A' also appears on the active trip card.
      final row = find.byKey(Key('driver-upcoming-trip-${upcomingSummary.id}'));
      final timeFinder = find.descendant(
        of: row,
        matching: find.text(formatTripSchedule(upcomingSummary.scheduledStart)),
      );
      final vehicleFinder = find.descendant(
        of: row,
        matching: find.text('KCA 123A'),
      );
      final directionFinder = find.descendant(
        of: row,
        matching: find.text('Inbound'),
      );

      expect(timeFinder, findsOneWidget);
      expect(vehicleFinder, findsOneWidget);
      expect(directionFinder, findsOneWidget);

      final timeX = tester.getTopLeft(timeFinder).dx;
      final vehicleX = tester.getTopLeft(vehicleFinder).dx;
      final directionX = tester.getTopLeft(directionFinder).dx;

      expect(timeX, lessThan(vehicleX));
      expect(vehicleX, lessThan(directionX));
    });
  });

  group('DriverRecentTripsScreen', () {
    testWidgets('renders server-scoped recent trips as read-only rows', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        _wrap(
          const DriverRecentTripsScreen(),
          overrides: [
            driverWorkspaceProvider.overrideWith(
              (_) async => _activeWorkspace(),
            ),
          ],
        ),
      );
      await tester.pump();
      await tester.pump();

      expect(find.text('Recent trips'), findsOneWidget);
      expect(find.text('Kilimani to Hillcrest'), findsOneWidget);
      expect(find.text('Completed'), findsOneWidget);
      expect(find.text('Start trip'), findsNothing);
      expect(find.text('End trip'), findsNothing);
      expect(find.text('SOS'), findsNothing);
    });
  });

  group('DriverDashboardScreen — empty', () {
    testWidgets('shows No trips assigned message', (WidgetTester tester) async {
      final workspace = _emptyWorkspace();

      await tester.pumpWidget(
        _wrap(
          const DriverDashboardScreen(),
          overrides: [
            driverWorkspaceProvider.overrideWith((_) async => workspace),
          ],
        ),
      );
      await tester.pump();
      await tester.pump();

      expect(find.text('No trips assigned'), findsOneWidget);
    });
  });

  group('DriverDashboardScreen — loading', () {
    testWidgets('shows skeleton with stable dimensions while loading', (
      WidgetTester tester,
    ) async {
      final never = Completer<DriverWorkspace>();

      await tester.pumpWidget(
        _wrap(
          const DriverDashboardScreen(),
          overrides: [
            driverWorkspaceProvider.overrideWith((_) => never.future),
          ],
        ),
      );
      await tester.pump();

      // Loading skeleton must be visible; no spinner fallback that collapses content area
      expect(
        find.byKey(const Key('driver-workspace-skeleton')),
        findsOneWidget,
      );
    });
  });

  group('DriverDashboardScreen — error', () {
    testWidgets('shows error message and retry button', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        _wrap(
          const DriverDashboardScreen(),
          overrides: [
            driverWorkspaceProvider.overrideWithValue(
              AsyncValue.error(
                Exception('Network unavailable'),
                StackTrace.empty,
              ),
            ),
          ],
        ),
      );
      await tester.pump();

      expect(find.byKey(const Key('driver-workspace-retry')), findsOneWidget);
    });

    testWidgets('retry button triggers provider refresh', (
      WidgetTester tester,
    ) async {
      var callCount = 0;

      // Use overrideWith so invalidate actually re-runs the build function.
      await tester.pumpWidget(
        _wrap(
          const DriverDashboardScreen(),
          overrides: [
            driverWorkspaceProvider.overrideWith((_) {
              callCount++;
              // Return a rejected Future — Riverpod 3 exposes this as AsyncLoading+hasError.
              return Future.error(Exception('fail'), StackTrace.empty);
            }),
          ],
        ),
      );

      // Let the async provider run and error.
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      await tester.pump();

      // The provider ran at least once.
      expect(callCount, greaterThanOrEqualTo(1));
      final countBefore = callCount;

      // Error view is now showing (Riverpod 3 retry keeps state as AsyncLoading+hasError).
      expect(find.byKey(const Key('driver-workspace-retry')), findsOneWidget);

      // Tap the retry button — triggers ref.invalidate(driverWorkspaceProvider).
      await tester.tap(find.byKey(const Key('driver-workspace-retry')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      await tester.pump();

      expect(callCount, greaterThan(countBefore));
    });
  });
}
