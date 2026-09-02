import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/telemetry/trip_telemetry_service.dart';
import 'package:mobile/features/driver/driver_trip_coordinator.dart';
import 'package:mobile/features/driver/driver_trip_models.dart';
import 'package:mobile/features/driver/driver_trip_providers.dart';
import 'package:mobile/features/driver/driver_trip_screen.dart';

class _FakeTelemetryService extends TripTelemetryService {
  _FakeTelemetryService() : super(client: Dio());

  int startCalls = 0;
  int stopCalls = 0;
  String? lastStartedTripId;

  @override
  Future<void> start(String tripId) async {
    startCalls++;
    lastStartedTripId = tripId;
  }

  @override
  Future<void> stop() async {
    stopCalls++;
  }
}

DriverTripSummary _summary(String id) {
  return DriverTripSummary(
    id: id,
    status: DriverTripStatus.inProgress,
    scheduledStart: DateTime.utc(2026, 9, 2, 6, 30),
    startedAt: DateTime.utc(2026, 9, 2, 6, 35),
    endedAt: null,
    direction: 'morning',
    routeId: 'route-1',
    vehicleId: 'vehicle-1',
    route: const SummaryRoute(id: 'route-1', name: 'Kilimani Morning Run'),
    vehicle: const SummaryVehicle(
      id: 'vehicle-1',
      registration: 'KCA 123A',
      capacity: 33,
    ),
    passengerCount: 10,
  );
}

DriverWorkspace _workspace({DriverTripSummary? activeTrip}) {
  return DriverWorkspace(
    activeTrip: activeTrip,
    upcomingTrips: const <DriverTripSummary>[],
    recentTrips: const <DriverTripSummary>[],
  );
}

void main() {
  group('DriverTripCoordinator', () {
    test('sync() starts telemetry for the workspace active trip', () async {
      final telemetry = _FakeTelemetryService();
      final container = ProviderContainer(
        overrides: [
          driverWorkspaceProvider.overrideWith(
            (ref) async => _workspace(activeTrip: _summary('trip-1')),
          ),
          tripTelemetryProvider.overrideWithValue(telemetry),
        ],
      );
      addTearDown(container.dispose);

      await container.read(driverTripCoordinatorProvider).sync();

      expect(telemetry.startCalls, 1);
      expect(telemetry.lastStartedTripId, 'trip-1');
      expect(telemetry.stopCalls, 0);
    });

    test('sync() stops telemetry when there is no active trip', () async {
      final telemetry = _FakeTelemetryService();
      final container = ProviderContainer(
        overrides: [
          driverWorkspaceProvider.overrideWith((ref) async => _workspace()),
          tripTelemetryProvider.overrideWithValue(telemetry),
        ],
      );
      addTearDown(container.dispose);

      await container.read(driverTripCoordinatorProvider).sync();

      expect(telemetry.stopCalls, 1);
      expect(telemetry.startCalls, 0);
    });

    test(
      'concurrent sync() calls are serialized into a single underlying sync',
      () async {
        final telemetry = _FakeTelemetryService();
        final completer = Completer<DriverWorkspace>();
        final container = ProviderContainer(
          overrides: [
            driverWorkspaceProvider.overrideWith((ref) => completer.future),
            tripTelemetryProvider.overrideWithValue(telemetry),
          ],
        );
        addTearDown(container.dispose);

        final coordinator = container.read(driverTripCoordinatorProvider);

        // Call sync() twice before the workspace future resolves.
        final first = coordinator.sync();
        final second = coordinator.sync();

        // The second call must reuse the in-flight future rather than
        // starting a second, independent sync operation.
        expect(identical(first, second), isTrue);

        completer.complete(_workspace(activeTrip: _summary('trip-1')));
        await Future.wait(<Future<void>>[first, second]);

        expect(telemetry.startCalls, 1);

        // Once resolved, a subsequent sync() call performs a fresh sync.
        final third = coordinator.sync();
        expect(identical(first, third), isFalse);
        await third;
        expect(telemetry.startCalls, 2);
      },
    );
  });
}
