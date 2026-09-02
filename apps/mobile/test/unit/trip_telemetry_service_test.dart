import 'package:dio/dio.dart';
import 'package:flutter_background_geolocation/flutter_background_geolocation.dart'
    as bg;
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/telemetry/trip_telemetry_service.dart';

class _FakeTripLocationAdapter implements TripLocationAdapter {
  int readyCalls = 0;
  int startCalls = 0;
  int stopCalls = 0;
  int removeListenersCalls = 0;

  @override
  Future<void> ready(bg.Config config) async {
    readyCalls++;
  }

  @override
  void onLocation(void Function(bg.Location location) callback) {}

  @override
  Future<void> start() async {
    startCalls++;
  }

  @override
  Future<void> stop() async {
    stopCalls++;
  }

  @override
  Future<void> removeListeners() async {
    removeListenersCalls++;
  }
}

void main() {
  group('TripTelemetryService idempotency', () {
    test('starting the same trip twice only starts tracking once', () async {
      final adapter = _FakeTripLocationAdapter();
      final service = TripTelemetryService(client: Dio(), adapter: adapter);

      await service.start('trip-1');
      await service.start('trip-1');

      expect(adapter.startCalls, 1);
      expect(adapter.stopCalls, 0);
      expect(service.activeTripId, 'trip-1');
    });

    test('starting a different trip stops the previous tracking first', () async {
      final adapter = _FakeTripLocationAdapter();
      final service = TripTelemetryService(client: Dio(), adapter: adapter);

      await service.start('trip-1');
      await service.start('trip-2');

      expect(adapter.startCalls, 2);
      expect(adapter.stopCalls, 1);
      expect(service.activeTripId, 'trip-2');
    });

    test('stop() clears activeTripId', () async {
      final adapter = _FakeTripLocationAdapter();
      final service = TripTelemetryService(client: Dio(), adapter: adapter);

      await service.start('trip-1');
      await service.stop();

      expect(adapter.stopCalls, 1);
      expect(service.activeTripId, isNull);
    });

    test('start() after stop() re-registers tracking for a new trip', () async {
      final adapter = _FakeTripLocationAdapter();
      final service = TripTelemetryService(client: Dio(), adapter: adapter);

      await service.start('trip-1');
      await service.stop();
      await service.start('trip-1');

      expect(adapter.startCalls, 2);
      expect(adapter.stopCalls, 1);
      expect(service.activeTripId, 'trip-1');
    });
  });
}
