import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_background_geolocation/flutter_background_geolocation.dart'
    as bg;
import 'package:mobile/core/offline/outbox.dart';
import 'package:uuid/uuid.dart';

class TripTelemetryService {
  TripTelemetryService({required Dio client}) : _client = client;

  final Dio _client;
  Timer? _fallbackTimer;
  bg.Coords? _lastCoords;

  // Test-friendly shape; keeps the plugin's Coords type out of the public API.
  ({double lat, double lng})? get lastKnownLocation {
    final coords = _lastCoords;
    return coords != null ? (lat: coords.latitude, lng: coords.longitude) : null;
  }

  Future<void> start(String tripId) async {
    await stop();

    await bg.BackgroundGeolocation.ready(
      bg.Config(
        desiredAccuracy: bg.Config.DESIRED_ACCURACY_NAVIGATION,
        distanceFilter: 25,
        stopOnTerminate: false,
        startOnBoot: true,
      ),
    );

    bg.BackgroundGeolocation.onLocation((location) {
      _lastCoords = location.coords;
      unawaited(_postLocation(tripId, location.coords));
    });

    await bg.BackgroundGeolocation.start();

    _fallbackTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      final coords = _lastCoords;
      if (coords != null) {
        unawaited(_postLocation(tripId, coords));
      }
    });
  }

  Future<void> stop() async {
    _fallbackTimer?.cancel();
    _fallbackTimer = null;
    bg.BackgroundGeolocation.removeListeners();
    await bg.BackgroundGeolocation.stop();
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
