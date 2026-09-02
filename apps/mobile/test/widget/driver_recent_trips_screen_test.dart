import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/driver/driver_recent_trips_screen.dart';
import 'package:mobile/features/driver/driver_trip_models.dart';
import 'package:mobile/features/driver/driver_trip_providers.dart';
import 'package:mobile/features/driver/trip_time_format.dart';

DriverWorkspace _workspaceWithRecentTrip() =>
    DriverWorkspace.fromJson(<String, Object?>{
      'activeTrip': null,
      'upcomingTrips': <Object?>[],
      'recentTrips': <Object?>[
        <String, Object?>{
          'id': 'trip-recent-1',
          'status': 'completed',
          'scheduledStart': '2026-09-01T06:30:00.000Z',
          'startedAt': '2026-09-01T06:35:00.000Z',
          'endedAt': '2026-09-01T07:10:00.000Z',
          'direction': 'morning_pickup',
          'routeId': 'route-a',
          'vehicleId': 'vehicle-a',
          'route': <String, Object?>{'id': 'route-a', 'name': 'Route A'},
          'vehicle': <String, Object?>{
            'id': 'vehicle-a',
            'registration': 'KDA 123X',
            'capacity': 14,
          },
          '_count': <String, Object?>{'passengers': 12},
        },
      ],
    });

Widget _wrap(Widget child, {List<Object> overrides = const []}) =>
    ProviderScope(
      overrides: overrides.cast(),
      child: MaterialApp(home: child),
    );

void main() {
  group('DriverRecentTripsScreen — row layout', () {
    testWidgets('recent trip row shows status left, completion time right', (
      WidgetTester tester,
    ) async {
      final workspace = _workspaceWithRecentTrip();
      final recentSummary = workspace.recentTrips.single;

      await tester.pumpWidget(
        _wrap(
          const DriverRecentTripsScreen(),
          overrides: [
            driverWorkspaceProvider.overrideWith((_) async => workspace),
          ],
        ),
      );
      await tester.pump();
      await tester.pump();

      // Scope to the row's own key in case fixtures reuse route/vehicle text elsewhere.
      final row = find.byKey(Key('driver-recent-trip-${recentSummary.id}'));
      final statusFinder = find.descendant(
        of: row,
        matching: find.text('Completed'),
      );
      final timeFinder = find.descendant(
        of: row,
        matching: find.text(formatClockTime(recentSummary.endedAt!)),
      );

      expect(statusFinder, findsOneWidget);
      expect(timeFinder, findsOneWidget);

      final statusX = tester.getTopLeft(statusFinder).dx;
      final timeX = tester.getTopLeft(timeFinder).dx;
      expect(statusX, lessThan(timeX));
    });
  });
}
