import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_background_geolocation/flutter_background_geolocation.dart'
    as bg;
import 'package:mobile/core/offline/outbox.dart';
import 'package:uuid/uuid.dart';

// Wraps the bg.BackgroundGeolocation static API so it can be faked in tests.
abstract class TripLocationAdapter {
  Future<void> ready(bg.Config config);
  void onLocation(void Function(bg.Location location) callback);
  Future<void> start();
  Future<void> stop();
  Future<void> removeListeners();
}

class _BackgroundGeolocationAdapter implements TripLocationAdapter {
  const _BackgroundGeolocationAdapter();

  @override
  Future<void> ready(bg.Config config) async {
    await bg.BackgroundGeolocation.ready(config);
  }

  @override
  void onLocation(void Function(bg.Location location) callback) {
    bg.BackgroundGeolocation.onLocation(callback);
  }

  @override
  Future<void> start() async {
    await bg.BackgroundGeolocation.start();
  }

  @override
  Future<void> stop() async {
    await bg.BackgroundGeolocation.stop();
  }

  @override
  Future<void> removeListeners() async {
    await bg.BackgroundGeolocation.removeListeners();
  }
}

class TripTelemetryService {
  TripTelemetryService({required Dio client, TripLocationAdapter? adapter})
    : _client = client,
      _adapter = adapter ?? const _BackgroundGeolocationAdapter();

  final Dio _client;
  final TripLocationAdapter _adapter;
  Timer? _fallbackTimer;
  bg.Coords? _lastCoords;
  String? _activeTripId;

  // The trip currently being tracked, or null when telemetry is stopped.
  String? get activeTripId => _activeTripId;

  // Test-friendly shape; keeps the plugin's Coords type out of the public API.
  ({double lat, double lng})? get lastKnownLocation {
    final coords = _lastCoords;
    return coords != null ? (lat: coords.latitude, lng: coords.longitude) : null;
  }

  Future<void> start(String tripId) async {
    if (_activeTripId == tripId) {
      return;
    }
    if (_activeTripId != null) {
      await stop();
    }

    await _adapter.ready(
      bg.Config(
        desiredAccuracy: bg.Config.DESIRED_ACCURACY_NAVIGATION,
        distanceFilter: 25,
        stopOnTerminate: false,
        startOnBoot: true,
      ),
    );

    _adapter.onLocation((location) {
      _lastCoords = location.coords;
      unawaited(_postLocation(tripId, location.coords));
    });

    await _adapter.start();

    _fallbackTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      final coords = _lastCoords;
      if (coords != null) {
        unawaited(_postLocation(tripId, coords));
      }
    });

    _activeTripId = tripId;
  }

  Future<void> stop() async {
    _fallbackTimer?.cancel();
    _fallbackTimer = null;
    await _adapter.removeListeners();
    await _adapter.stop();
    _activeTripId = null;
  }

  Future<void> _postLocation(String tripId, bg.Coords coords) async {
    final payload = <String, Object?>{
      'lat': coords.latitude,
      'lng': coords.longitude,
      'heading_degrees': coords.heading,
      'speed_mps': coords.speed,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    };
    try {
      await _client.post<void>('/trips/$tripId/driver-location', data: payload);
    } on DioException {
      await OutboxStore.put(
        OutboxEntry(
          id: const Uuid().v4(),
          endpoint: '/trips/$tripId/driver-location',
          method: 'POST',
          body: payload,
          createdAt: DateTime.now().toUtc(),
        ),
      );
    }
  }
}
