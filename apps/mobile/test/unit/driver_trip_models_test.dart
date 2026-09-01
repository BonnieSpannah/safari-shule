import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/driver/driver_trip_models.dart';

void main() {
  // ── Shared fixtures ────────────────────────────────────────────────────────

  final Map<String, Object?> routeJson = {
    'id': 'route-1',
    'name': 'School Route A',
    'startPoint': {'lat': -1.2864, 'lng': 36.8219},
    'endPoint': {'lat': -1.30, 'lng': 36.83},
    'busStops': [
      {
        'id': 'stop-1',
        'name': 'Junction A',
        'pickupOrder': 1,
        'location': {'lat': -1.29, 'lng': 36.825},
      },
    ],
  };

  Map<String, Object?> tripDetailBase({
    required String status,
    List<Map<String, Object?>> snapshots = const [],
  }) =>
      <String, Object?>{
        'id': 'trip-1',
        'status': status,
        'scheduledStart': '2024-01-15T07:00:00.000Z',
        'startedAt': status == 'scheduled' ? null : '2024-01-15T07:05:00.000Z',
        'endedAt':
            (status == 'completed' || status == 'cancelled') ? '2024-01-15T08:00:00.000Z' : null,
        'direction': 'morning_pickup',
        'routeId': 'route-1',
        'vehicleId': 'vehicle-1',
        'route': routeJson,
        'passengerSummary': <String, Object?>{
          'expected': 10,
          'boarded': 8,
          'onBoard': 8,
          'alighted': 0
        },
        'locationSnapshots': snapshots,
      };

  final Map<String, Object?> snapshot1 = {
    'lat': -1.287,
    'lng': 36.822,
    'speedKph': 30.0,
    'headingDeg': 90.0,
    'recordedAt': '2024-01-15T07:10:00.000Z',
  };

  final Map<String, Object?> snapshot2 = {
    'lat': -1.288,
    'lng': 36.823,
    'speedKph': 40.0,
    'headingDeg': 95.0,
    'recordedAt': '2024-01-15T07:15:00.000Z',
  };

  // ── TripPoint ──────────────────────────────────────────────────────────────

  group('TripPoint', () {
    test('parses double coords', () {
      final p = TripPoint.fromJson({'lat': -1.2864, 'lng': 36.8219});
      expect(p.lat, -1.2864);
      expect(p.lng, 36.8219);
    });

    test('coerces integer coords to double', () {
      final p = TripPoint.fromJson({'lat': 0, 'lng': 36});
      expect(p.lat, 0.0);
      expect(p.lng, 36.0);
    });

    test('throws FormatException on missing lat', () {
      expect(
        () => TripPoint.fromJson({'lng': 36.0}),
        throwsA(isA<FormatException>()),
      );
    });

    test('throws FormatException on missing lng', () {
      expect(
        () => TripPoint.fromJson({'lat': -1.0}),
        throwsA(isA<FormatException>()),
      );
    });
  });

  // ── TripStop ───────────────────────────────────────────────────────────────

  group('TripStop', () {
    test('parses all fields correctly', () {
      final stop = TripStop.fromJson({
        'id': 'stop-1',
        'name': 'Junction A',
        'pickupOrder': 1,
        'location': {'lat': -1.29, 'lng': 36.825},
      });
      expect(stop.id, 'stop-1');
      expect(stop.name, 'Junction A');
      expect(stop.pickupOrder, 1);
      expect(stop.location.lat, -1.29);
    });
  });

  // ── PassengerSummary ───────────────────────────────────────────────────────

  group('PassengerSummary', () {
    test('parses all fields', () {
      final ps = PassengerSummary.fromJson(
        {'expected': 10, 'boarded': 8, 'onBoard': 8, 'alighted': 0},
      );
      expect(ps.expected, 10);
      expect(ps.boarded, 8);
      expect(ps.onBoard, 8);
      expect(ps.alighted, 0);
    });
  });

  // ── DriverTripDetail - scheduled ───────────────────────────────────────────

  group('DriverTripDetail scheduled', () {
    late DriverTripDetail detail;

    setUp(() {
      detail = DriverTripDetail.fromJson(tripDetailBase(status: 'scheduled'));
    });

    test('parses status as scheduled', () {
      expect(detail.status, DriverTripStatus.scheduled);
    });

    test('primary action is start', () {
      expect(detail.primaryAction, DriverTripAction.start);
    });

    test('map mode is planned', () {
      expect(detail.mapMode, TripMapMode.planned);
    });

    test('planned points are startPoint + stops + endPoint', () {
      expect(detail.plannedPoints, hasLength(3));
      expect(detail.plannedPoints.first.lat, closeTo(-1.2864, 0.0001));
      expect(detail.plannedPoints[1].lat, closeTo(-1.29, 0.0001)); // stop
      expect(detail.plannedPoints.last.lat, closeTo(-1.30, 0.0001));
    });

    test('travelled points are empty for scheduled trip', () {
      expect(detail.travelledPoints, isEmpty);
    });

    test('parses scheduledStart as UTC DateTime', () {
      expect(detail.scheduledStart, DateTime.utc(2024, 1, 15, 7, 0, 0));
    });

    test('startedAt is null', () {
      expect(detail.startedAt, isNull);
    });
  });

  // ── DriverTripDetail - in_progress ─────────────────────────────────────────

  group('DriverTripDetail in_progress', () {
    late DriverTripDetail detail;

    setUp(() {
      detail = DriverTripDetail.fromJson(
        tripDetailBase(status: 'in_progress', snapshots: [snapshot1, snapshot2]),
      );
    });

    test('status is inProgress', () {
      expect(detail.status, DriverTripStatus.inProgress);
    });

    test('primary action is resume', () {
      expect(detail.primaryAction, DriverTripAction.resume);
    });

    test('map mode is live', () {
      expect(detail.mapMode, TripMapMode.live);
    });

    test('planned points has 3 entries', () {
      expect(detail.plannedPoints, hasLength(3));
    });

    test('travelled points has 2 entries from snapshots', () {
      expect(detail.travelledPoints, hasLength(2));
      expect(detail.travelledPoints.first.lat, closeTo(-1.287, 0.0001));
      expect(detail.travelledPoints.last.lat, closeTo(-1.288, 0.0001));
    });

    test('startedAt is non-null', () {
      expect(detail.startedAt, isNotNull);
    });
  });

  // ── DriverTripDetail - in_progress with zero snapshots ────────────────────

  group('DriverTripDetail in_progress zero snapshots', () {
    test('travelled points is empty', () {
      final detail = DriverTripDetail.fromJson(
        tripDetailBase(status: 'in_progress'),
      );
      expect(detail.travelledPoints, isEmpty);
    });

    test('map mode is still live', () {
      final detail = DriverTripDetail.fromJson(
        tripDetailBase(status: 'in_progress'),
      );
      expect(detail.mapMode, TripMapMode.live);
    });
  });

  // ── DriverTripDetail - completed ───────────────────────────────────────────

  group('DriverTripDetail completed', () {
    late DriverTripDetail detail;

    setUp(() {
      detail = DriverTripDetail.fromJson(
        tripDetailBase(status: 'completed', snapshots: [snapshot1, snapshot2]),
      );
    });

    test('status is completed', () {
      expect(detail.status, DriverTripStatus.completed);
    });

    test('primary action is none', () {
      expect(detail.primaryAction, DriverTripAction.none);
    });

    test('map mode is travelled', () {
      expect(detail.mapMode, TripMapMode.travelled);
    });

    test('planned points has 3 entries', () {
      expect(detail.plannedPoints, hasLength(3));
    });

    test('travelled points has 2 entries', () {
      expect(detail.travelledPoints, hasLength(2));
    });
  });

  // ── DriverTripDetail - cancelled, no snapshots (before start) ─────────────

  group('DriverTripDetail cancelled-before-start (no snapshots)', () {
    late DriverTripDetail detail;

    setUp(() {
      detail = DriverTripDetail.fromJson(tripDetailBase(status: 'cancelled'));
    });

    test('status is cancelled', () {
      expect(detail.status, DriverTripStatus.cancelled);
    });

    test('primary action is none', () {
      expect(detail.primaryAction, DriverTripAction.none);
    });

    test('map mode is cancelledPlanned when no snapshots', () {
      expect(detail.mapMode, TripMapMode.cancelledPlanned);
    });

    test('travelled points is empty', () {
      expect(detail.travelledPoints, isEmpty);
    });
  });

  // ── DriverTripDetail - cancelled with snapshots (after start) ─────────────

  group('DriverTripDetail cancelled-after-start (with snapshots)', () {
    late DriverTripDetail detail;

    setUp(() {
      detail = DriverTripDetail.fromJson(
        tripDetailBase(status: 'cancelled', snapshots: [snapshot1, snapshot2]),
      );
    });

    test('map mode is cancelledPartial when snapshots exist', () {
      expect(detail.mapMode, TripMapMode.cancelledPartial);
    });

    test('travelled points has 2 entries', () {
      expect(detail.travelledPoints, hasLength(2));
    });

    test('primary action is none', () {
      expect(detail.primaryAction, DriverTripAction.none);
    });
  });

  // ── plannedPoints ordering ─────────────────────────────────────────────────

  group('plannedPoints ordering', () {
    test('stops appear in pickupOrder between startPoint and endPoint', () {
      final json = <String, Object?>{
        'id': 'trip-1',
        'status': 'scheduled',
        'scheduledStart': '2024-01-15T07:00:00.000Z',
        'startedAt': null,
        'endedAt': null,
        'direction': 'morning_pickup',
        'routeId': 'route-2',
        'vehicleId': 'vehicle-1',
        'route': <String, Object?>{
          'id': 'route-2',
          'name': 'Multi-stop Route',
          'startPoint': {'lat': 0.0, 'lng': 1.0},
          'endPoint': {'lat': 9.0, 'lng': 10.0},
          // Stops are deliberately out of order in the JSON
          'busStops': [
            {'id': 's2', 'name': 'Stop 2', 'pickupOrder': 2, 'location': {'lat': 5.0, 'lng': 6.0}},
            {'id': 's1', 'name': 'Stop 1', 'pickupOrder': 1, 'location': {'lat': 3.0, 'lng': 4.0}},
          ],
        },
        'passengerSummary': {'expected': 0, 'boarded': 0, 'onBoard': 0, 'alighted': 0},
        'locationSnapshots': <Map<String, Object?>>[],
      };
      final detail = DriverTripDetail.fromJson(json);

      expect(detail.plannedPoints, hasLength(4)); // start + 2 stops + end
      expect(detail.plannedPoints[0].lat, 0.0); // startPoint
      expect(detail.plannedPoints[1].lat, 3.0); // stop1 (order=1) - not stop2
      expect(detail.plannedPoints[2].lat, 5.0); // stop2 (order=2)
      expect(detail.plannedPoints[3].lat, 9.0); // endPoint
    });

    test('route with no stops has exactly 2 points', () {
      final json = <String, Object?>{
        'id': 'trip-1',
        'status': 'scheduled',
        'scheduledStart': '2024-01-15T07:00:00.000Z',
        'startedAt': null,
        'endedAt': null,
        'direction': 'morning_pickup',
        'routeId': 'route-3',
        'vehicleId': 'vehicle-1',
        'route': <String, Object?>{
          'id': 'route-3',
          'name': 'Direct Route',
          'startPoint': {'lat': 0.0, 'lng': 0.0},
          'endPoint': {'lat': 1.0, 'lng': 1.0},
          'busStops': <Map<String, Object?>>[],
        },
        'passengerSummary': {'expected': 0, 'boarded': 0, 'onBoard': 0, 'alighted': 0},
        'locationSnapshots': <Map<String, Object?>>[],
      };
      final detail = DriverTripDetail.fromJson(json);
      expect(detail.plannedPoints, hasLength(2));
    });
  });

  // ── Malformed JSON ─────────────────────────────────────────────────────────

  group('malformed JSON', () {
    test('throws FormatException on missing id', () {
      final json = Map<String, Object?>.from(tripDetailBase(status: 'scheduled'))
        ..remove('id');
      expect(() => DriverTripDetail.fromJson(json), throwsA(isA<FormatException>()));
    });

    test('throws FormatException on missing status', () {
      final json = Map<String, Object?>.from(tripDetailBase(status: 'scheduled'))
        ..remove('status');
      expect(() => DriverTripDetail.fromJson(json), throwsA(isA<FormatException>()));
    });

    test('throws FormatException on unknown status value', () {
      final json = Map<String, Object?>.from(tripDetailBase(status: 'scheduled'))
        ..['status'] = 'invalid_status';
      expect(() => DriverTripDetail.fromJson(json), throwsA(isA<FormatException>()));
    });

    test('throws FormatException on missing route', () {
      final json = Map<String, Object?>.from(tripDetailBase(status: 'scheduled'))
        ..remove('route');
      expect(() => DriverTripDetail.fromJson(json), throwsA(isA<FormatException>()));
    });
  });

  // ── DriverTripSummary ──────────────────────────────────────────────────────

  group('DriverTripSummary', () {
    final Map<String, Object?> summaryJson = {
      'id': 'trip-2',
      'status': 'scheduled',
      'scheduledStart': '2024-01-15T09:00:00.000Z',
      'startedAt': null,
      'endedAt': null,
      'direction': 'morning_pickup',
      'routeId': 'route-1',
      'vehicleId': 'vehicle-1',
      'route': {'id': 'route-1', 'name': 'Alpha Route'},
      'vehicle': {'id': 'vehicle-1', 'registration': 'KCB 001A', 'capacity': 45},
      '_count': {'passengers': 10},
    };

    test('parses status', () {
      final s = DriverTripSummary.fromJson(summaryJson);
      expect(s.status, DriverTripStatus.scheduled);
    });

    test('parses passengerCount from _count.passengers', () {
      final s = DriverTripSummary.fromJson(summaryJson);
      expect(s.passengerCount, 10);
    });

    test('parses null startedAt', () {
      final s = DriverTripSummary.fromJson(summaryJson);
      expect(s.startedAt, isNull);
    });

    test('parses vehicle registration', () {
      final s = DriverTripSummary.fromJson(summaryJson);
      expect(s.vehicle.registration, 'KCB 001A');
    });

    test('parses vehicle capacity', () {
      final s = DriverTripSummary.fromJson(summaryJson);
      expect(s.vehicle.capacity, 45);
    });

    test('parses route name', () {
      final s = DriverTripSummary.fromJson(summaryJson);
      expect(s.route.name, 'Alpha Route');
    });

    test('parses in_progress status', () {
      final json = Map<String, Object?>.from(summaryJson)..['status'] = 'in_progress';
      final s = DriverTripSummary.fromJson(json);
      expect(s.status, DriverTripStatus.inProgress);
    });
  });

  // ── DriverWorkspace ────────────────────────────────────────────────────────

  group('DriverWorkspace', () {
    final Map<String, Object?> upcomingTripJson = {
      'id': 'trip-2',
      'status': 'scheduled',
      'scheduledStart': '2024-01-15T09:00:00.000Z',
      'startedAt': null,
      'endedAt': null,
      'direction': 'morning_pickup',
      'routeId': 'route-1',
      'vehicleId': 'vehicle-1',
      'route': {'id': 'route-1', 'name': 'Alpha Route'},
      'vehicle': {'id': 'vehicle-1', 'registration': 'KCB 001A', 'capacity': 45},
      '_count': {'passengers': 10},
    };

    test('parses null activeTrip', () {
      final ws = DriverWorkspace.fromJson({
        'activeTrip': null,
        'upcomingTrips': <Object?>[],
        'recentTrips': <Object?>[],
      });
      expect(ws.activeTrip, isNull);
    });

    test('parses upcomingTrips list', () {
      final ws = DriverWorkspace.fromJson({
        'activeTrip': null,
        'upcomingTrips': [upcomingTripJson],
        'recentTrips': <Object?>[],
      });
      expect(ws.upcomingTrips, hasLength(1));
      expect(ws.upcomingTrips.first.id, 'trip-2');
    });

    test('parses empty recentTrips', () {
      final ws = DriverWorkspace.fromJson({
        'activeTrip': null,
        'upcomingTrips': <Object?>[],
        'recentTrips': <Object?>[],
      });
      expect(ws.recentTrips, isEmpty);
    });

    test('parses non-null activeTrip', () {
      final activeTripJson = Map<String, Object?>.from(upcomingTripJson)
        ..['id'] = 'trip-active'
        ..['status'] = 'in_progress';
      final ws = DriverWorkspace.fromJson({
        'activeTrip': activeTripJson,
        'upcomingTrips': <Object?>[],
        'recentTrips': <Object?>[],
      });
      expect(ws.activeTrip, isNotNull);
      expect(ws.activeTrip!.id, 'trip-active');
      expect(ws.activeTrip!.status, DriverTripStatus.inProgress);
    });
  });

  // ── TripMapPolicy ──────────────────────────────────────────────────────────

  group('TripMapPolicy', () {
    test('from scheduled detail has start action and planned mode', () {
      final detail = DriverTripDetail.fromJson(tripDetailBase(status: 'scheduled'));
      final policy = TripMapPolicy.from(detail);
      expect(policy.primaryAction, DriverTripAction.start);
      expect(policy.mapMode, TripMapMode.planned);
      expect(policy.plannedPoints, hasLength(3));
      expect(policy.travelledPoints, isEmpty);
    });

    test('from in_progress detail has resume action and live mode', () {
      final detail = DriverTripDetail.fromJson(
        tripDetailBase(status: 'in_progress', snapshots: [snapshot1]),
      );
      final policy = TripMapPolicy.from(detail);
      expect(policy.primaryAction, DriverTripAction.resume);
      expect(policy.mapMode, TripMapMode.live);
      expect(policy.travelledPoints, hasLength(1));
    });

    test('from completed detail has none action and travelled mode', () {
      final detail = DriverTripDetail.fromJson(
        tripDetailBase(status: 'completed', snapshots: [snapshot1, snapshot2]),
      );
      final policy = TripMapPolicy.from(detail);
      expect(policy.primaryAction, DriverTripAction.none);
      expect(policy.mapMode, TripMapMode.travelled);
    });

    test('from cancelled-no-snapshots detail has cancelledPlanned mode', () {
      final detail = DriverTripDetail.fromJson(tripDetailBase(status: 'cancelled'));
      final policy = TripMapPolicy.from(detail);
      expect(policy.primaryAction, DriverTripAction.none);
      expect(policy.mapMode, TripMapMode.cancelledPlanned);
    });

    test('from cancelled-with-snapshots detail has cancelledPartial mode', () {
      final detail = DriverTripDetail.fromJson(
        tripDetailBase(status: 'cancelled', snapshots: [snapshot1]),
      );
      final policy = TripMapPolicy.from(detail);
      expect(policy.mapMode, TripMapMode.cancelledPartial);
    });
  });

  // ── TripLocationSnapshot telemetry ─────────────────────────────────────────

  group('TripLocationSnapshot', () {
    test('exposes all telemetry fields via locationSnapshots', () {
      final detail = DriverTripDetail.fromJson(
        tripDetailBase(status: 'in_progress', snapshots: [snapshot1]),
      );
      final snap = detail.locationSnapshots.first;
      expect(snap.lat, closeTo(-1.287, 0.0001));
      expect(snap.lng, closeTo(36.822, 0.0001));
      expect(snap.headingDeg, 90.0);
      expect(snap.speedKph, 30.0);
      expect(snap.recordedAt, DateTime.utc(2024, 1, 15, 7, 10, 0));
    });

    test('locationSnapshots are ordered by recordedAt ascending even when JSON is reversed', () {
      final detail = DriverTripDetail.fromJson(
        tripDetailBase(status: 'in_progress', snapshots: [snapshot2, snapshot1]),
      );
      expect(detail.locationSnapshots.first.headingDeg, 90.0); // snapshot1 earlier
      expect(detail.locationSnapshots.last.headingDeg, 95.0); // snapshot2 later
    });

    test('single snapshot produces travelledPoints of length 1', () {
      final detail = DriverTripDetail.fromJson(
        tripDetailBase(status: 'in_progress', snapshots: [snapshot1]),
      );
      expect(detail.travelledPoints, hasLength(1));
      expect(detail.travelledPoints.first.lat, closeTo(-1.287, 0.0001));
    });

    test('latestSnapshot is the most recent snapshot', () {
      final detail = DriverTripDetail.fromJson(
        tripDetailBase(status: 'in_progress', snapshots: [snapshot1, snapshot2]),
      );
      expect(detail.latestSnapshot, isNotNull);
      expect(detail.latestSnapshot!.headingDeg, 95.0);
      expect(detail.latestSnapshot!.speedKph, 40.0);
    });

    test('latestSnapshot is null when no snapshots', () {
      final detail = DriverTripDetail.fromJson(
        tripDetailBase(status: 'in_progress'),
      );
      expect(detail.latestSnapshot, isNull);
    });

    test('throws FormatException on snapshot missing lat', () {
      final snapMissingLat = <String, Object?>{
        'lng': 36.822,
        'speedKph': 30.0,
        'headingDeg': 90.0,
        'recordedAt': '2024-01-15T07:10:00.000Z',
      };
      expect(
        () => DriverTripDetail.fromJson(
          tripDetailBase(status: 'in_progress', snapshots: [snapMissingLat]),
        ),
        throwsA(isA<FormatException>()),
      );
    });
  });

  // ── cancellationReason ─────────────────────────────────────────────────────

  group('cancellationReason', () {
    test('is null when not present in JSON', () {
      final detail = DriverTripDetail.fromJson(tripDetailBase(status: 'scheduled'));
      expect(detail.cancellationReason, isNull);
    });

    test('is parsed when present', () {
      final json = Map<String, Object?>.from(tripDetailBase(status: 'cancelled'))
        ..['cancellationReason'] = 'Driver absence';
      final detail = DriverTripDetail.fromJson(json);
      expect(detail.cancellationReason, 'Driver absence');
    });
  });

  // ── malformed required detail fields ──────────────────────────────────────

  group('malformed required detail fields', () {
    test('throws FormatException on missing scheduledStart', () {
      final json = Map<String, Object?>.from(tripDetailBase(status: 'scheduled'))
        ..remove('scheduledStart');
      expect(() => DriverTripDetail.fromJson(json), throwsA(isA<FormatException>()));
    });

    test('throws FormatException on missing direction', () {
      final json = Map<String, Object?>.from(tripDetailBase(status: 'scheduled'))
        ..remove('direction');
      expect(() => DriverTripDetail.fromJson(json), throwsA(isA<FormatException>()));
    });

    test('throws FormatException on missing vehicleId', () {
      final json = Map<String, Object?>.from(tripDetailBase(status: 'scheduled'))
        ..remove('vehicleId');
      expect(() => DriverTripDetail.fromJson(json), throwsA(isA<FormatException>()));
    });

    test('throws FormatException on missing routeId', () {
      final json = Map<String, Object?>.from(tripDetailBase(status: 'scheduled'))
        ..remove('routeId');
      expect(() => DriverTripDetail.fromJson(json), throwsA(isA<FormatException>()));
    });

    test('throws FormatException on missing passengerSummary', () {
      final json = Map<String, Object?>.from(tripDetailBase(status: 'scheduled'))
        ..remove('passengerSummary');
      expect(() => DriverTripDetail.fromJson(json), throwsA(isA<FormatException>()));
    });
  });

  // ── locationSnapshots immutability ──────────────────────────────────────────

  group('locationSnapshots immutability', () {
    test('mutating the locationSnapshots list throws UnsupportedError', () {
      final detail = DriverTripDetail.fromJson(
        tripDetailBase(status: 'in_progress', snapshots: [snapshot1]),
      );
      expect(
        () => detail.locationSnapshots.add(TripLocationSnapshot.fromJson(snapshot2)),
        throwsA(isA<UnsupportedError>()),
      );
    });
  });

  // ── malformed route fields ───────────────────────────────────────────────

  group('malformed route fields', () {
    test('throws FormatException when route is missing required fields', () {
      // Covers id, name, startPoint, endPoint — one representative case (missing id)
      final json = Map<String, Object?>.from(tripDetailBase(status: 'scheduled'));
      final routeCopy = Map<String, Object?>.from(json['route'] as Map<String, Object?>)
        ..remove('id');
      json['route'] = routeCopy;
      expect(() => DriverTripDetail.fromJson(json), throwsA(isA<FormatException>()));
    });
  });

  // ── malformed required workspace fields ───────────────────────────────────

  group('malformed required workspace fields', () {
    test('throws FormatException on missing upcomingTrips', () {
      expect(
        () => DriverWorkspace.fromJson({'activeTrip': null, 'recentTrips': <Object?>[]}),
        throwsA(isA<FormatException>()),
      );
    });

    test('throws FormatException on missing recentTrips', () {
      expect(
        () => DriverWorkspace.fromJson({'activeTrip': null, 'upcomingTrips': <Object?>[]}),
        throwsA(isA<FormatException>()),
      );
    });
  });

  // ── unknown summary status ─────────────────────────────────────────────────

  group('unknown summary status', () {
    test('throws FormatException on unknown status in DriverTripSummary', () {
      final json = <String, Object?>{
        'id': 'trip-x',
        'status': 'unknown_value',
        'scheduledStart': '2024-01-15T09:00:00.000Z',
        'startedAt': null,
        'endedAt': null,
        'direction': 'morning_pickup',
        'routeId': 'route-1',
        'vehicleId': 'vehicle-1',
        'route': {'id': 'route-1', 'name': 'Alpha Route'},
        'vehicle': {'id': 'vehicle-1', 'registration': 'KCB 001A', 'capacity': 45},
        '_count': {'passengers': 0},
      };
      expect(
        () => DriverTripSummary.fromJson(json),
        throwsA(isA<FormatException>()),
      );
    });
  });
}
