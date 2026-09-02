// Domain models and map policy for the driver trip feature.
// Hand-written, immutable, no codegen. Parsing uses strict FormatException on bad input.

enum DriverTripStatus { scheduled, inProgress, completed, cancelled }

enum DriverTripAction { start, resume, none }

enum TripMapMode { planned, live, travelled, cancelledPlanned, cancelledPartial }

// ── Primitives ─────────────────────────────────────────────────────────────

class TripPoint {
  const TripPoint({required this.lat, required this.lng});

  final double lat;
  final double lng;

  factory TripPoint.fromJson(Map<String, Object?> json) {
    final lat = json['lat'];
    final lng = json['lng'];
    if (lat == null) throw const FormatException('TripPoint: missing lat');
    if (lng == null) throw const FormatException('TripPoint: missing lng');
    return TripPoint(
      lat: (lat as num).toDouble(),
      lng: (lng as num).toDouble(),
    );
  }
}

class TripStop {
  const TripStop({
    required this.id,
    required this.name,
    required this.pickupOrder,
    required this.location,
  });

  final String id;
  final String name;
  final int pickupOrder;
  final TripPoint location;

  factory TripStop.fromJson(Map<String, Object?> json) {
    final id = json['id'];
    final name = json['name'];
    final pickupOrder = json['pickupOrder'];
    final location = json['location'];
    if (id == null) throw const FormatException('TripStop: missing id');
    if (name == null) throw const FormatException('TripStop: missing name');
    if (pickupOrder == null) throw const FormatException('TripStop: missing pickupOrder');
    if (location == null) throw const FormatException('TripStop: missing location');
    return TripStop(
      id: id as String,
      name: name as String,
      pickupOrder: pickupOrder as int,
      location: TripPoint.fromJson(location as Map<String, Object?>),
    );
  }
}

class PassengerSummary {
  const PassengerSummary({
    required this.expected,
    required this.boarded,
    required this.onBoard,
    required this.alighted,
  });

  final int expected;
  final int boarded;
  final int onBoard;
  final int alighted;

  factory PassengerSummary.fromJson(Map<String, Object?> json) {
    final expected = json['expected'];
    final boarded = json['boarded'];
    final onBoard = json['onBoard'];
    final alighted = json['alighted'];
    if (expected == null) throw const FormatException('PassengerSummary: missing expected');
    if (boarded == null) throw const FormatException('PassengerSummary: missing boarded');
    if (onBoard == null) throw const FormatException('PassengerSummary: missing onBoard');
    if (alighted == null) throw const FormatException('PassengerSummary: missing alighted');
    return PassengerSummary(
      expected: expected as int,
      boarded: boarded as int,
      onBoard: onBoard as int,
      alighted: alighted as int,
    );
  }
}

// ── Route ──────────────────────────────────────────────────────────────────

class TripAssistant {
  const TripAssistant({required this.id, required this.fullName});

  final String id;
  final String fullName;

  factory TripAssistant.fromJson(Map<String, Object?> json) {
    if (json['id'] == null) throw const FormatException('TripAssistant: missing id');
    if (json['fullName'] == null) throw const FormatException('TripAssistant: missing fullName');
    return TripAssistant(id: json['id'] as String, fullName: json['fullName'] as String);
  }
}

class _TripRoute {
  const _TripRoute({
    required this.id,
    required this.name,
    required this.startPoint,
    required this.endPoint,
    required this.busStops,
  });

  final String id;
  final String name;
  final TripPoint startPoint;
  final TripPoint endPoint;

  // Stops are sorted by pickupOrder ascending at parse time.
  final List<TripStop> busStops;

  factory _TripRoute.fromJson(Map<String, Object?> json) {
    final id = json['id'];
    final name = json['name'];
    final startPoint = json['startPoint'];
    final endPoint = json['endPoint'];
    if (id == null) throw const FormatException('_TripRoute: missing id');
    if (name == null) throw const FormatException('_TripRoute: missing name');
    if (startPoint == null) throw const FormatException('_TripRoute: missing startPoint');
    if (endPoint == null) throw const FormatException('_TripRoute: missing endPoint');

    final stopsRaw = (json['busStops'] as List<Object?>?) ?? [];
    final stops = stopsRaw
        .map((s) => TripStop.fromJson(s as Map<String, Object?>))
        .toList()
      ..sort((a, b) => a.pickupOrder.compareTo(b.pickupOrder));

    return _TripRoute(
      id: id as String,
      name: name as String,
      startPoint: TripPoint.fromJson(startPoint as Map<String, Object?>),
      endPoint: TripPoint.fromJson(endPoint as Map<String, Object?>),
      busStops: List.unmodifiable(stops),
    );
  }
}

class TripLocationSnapshot {
  const TripLocationSnapshot({
    required this.lat,
    required this.lng,
    required this.headingDeg,
    required this.speedKph,
    required this.recordedAt,
  });

  final double lat;
  final double lng;
  final double headingDeg;
  final double speedKph;
  final DateTime recordedAt;

  factory TripLocationSnapshot.fromJson(Map<String, Object?> json) {
    final lat = json['lat'];
    final lng = json['lng'];
    final headingDeg = json['headingDeg'];
    final speedKph = json['speedKph'];
    final recordedAt = json['recordedAt'];
    if (lat == null) throw const FormatException('TripLocationSnapshot: missing lat');
    if (lng == null) throw const FormatException('TripLocationSnapshot: missing lng');
    if (headingDeg == null) throw const FormatException('TripLocationSnapshot: missing headingDeg');
    if (speedKph == null) throw const FormatException('TripLocationSnapshot: missing speedKph');
    if (recordedAt == null) throw const FormatException('TripLocationSnapshot: missing recordedAt');
    return TripLocationSnapshot(
      lat: (lat as num).toDouble(),
      lng: (lng as num).toDouble(),
      headingDeg: (headingDeg as num).toDouble(),
      speedKph: (speedKph as num).toDouble(),
      recordedAt: DateTime.parse(recordedAt as String),
    );
  }
}

// ── Status parser ──────────────────────────────────────────────────────────

DriverTripStatus _parseStatus(Object? raw) {
  if (raw == null) throw const FormatException('DriverTripStatus: missing status');
  return switch (raw as String) {
    'scheduled' => DriverTripStatus.scheduled,
    'in_progress' => DriverTripStatus.inProgress,
    'completed' => DriverTripStatus.completed,
    'cancelled' => DriverTripStatus.cancelled,
    _ => throw FormatException('DriverTripStatus: unknown value "$raw"'),
  };
}

// ── DriverTripDetail ───────────────────────────────────────────────────────

class DriverTripDetail {
  const DriverTripDetail._({
    required this.id,
    required this.status,
    required this.scheduledStart,
    required this.startedAt,
    required this.endedAt,
    required this.direction,
    required this.routeId,
    required this.vehicleId,
    required _TripRoute route,
    required this.passengerSummary,
    required this.cancellationReason,
    required List<TripLocationSnapshot> locationSnapshots,
    this.assistant,
    this.vehicle,
  })  : _route = route,
        _locationSnapshots = locationSnapshots;

  final String id;
  final DriverTripStatus status;
  final DateTime scheduledStart;
  final DateTime? startedAt;
  final DateTime? endedAt;
  final String direction;
  final String routeId;
  final String vehicleId;
  final PassengerSummary passengerSummary;
  final String? cancellationReason;
  final TripAssistant? assistant;
  final SummaryVehicle? vehicle;

  final _TripRoute _route;
  final List<TripLocationSnapshot> _locationSnapshots;

  String get routeName => _route.name;

  // ── Derived policy ───────────────────────────────────────────────────────

  DriverTripAction get primaryAction => switch (status) {
        DriverTripStatus.scheduled => DriverTripAction.start,
        DriverTripStatus.inProgress => DriverTripAction.resume,
        DriverTripStatus.completed => DriverTripAction.none,
        DriverTripStatus.cancelled => DriverTripAction.none,
      };

  TripMapMode get mapMode => switch (status) {
        DriverTripStatus.scheduled => TripMapMode.planned,
        DriverTripStatus.inProgress => TripMapMode.live,
        DriverTripStatus.completed => TripMapMode.travelled,
        DriverTripStatus.cancelled => _locationSnapshots.isEmpty
            ? TripMapMode.cancelledPlanned
            : TripMapMode.cancelledPartial,
      };

  List<TripPoint> get plannedPoints => [
        _route.startPoint,
        ..._route.busStops.map((s) => s.location),
        _route.endPoint,
      ];

  List<TripPoint> get travelledPoints =>
      _locationSnapshots.map((s) => TripPoint(lat: s.lat, lng: s.lng)).toList();

  List<TripLocationSnapshot> get locationSnapshots => _locationSnapshots;

  TripLocationSnapshot? get latestSnapshot =>
      _locationSnapshots.isNotEmpty ? _locationSnapshots.last : null;

  factory DriverTripDetail.fromJson(Map<String, Object?> json) {
    if (!json.containsKey('id') || json['id'] == null) {
      throw const FormatException('DriverTripDetail: missing id');
    }
    if (!json.containsKey('status')) {
      throw const FormatException('DriverTripDetail: missing status');
    }
    if (!json.containsKey('route') || json['route'] == null) {
      throw const FormatException('DriverTripDetail: missing route');
    }
    if (!json.containsKey('scheduledStart') || json['scheduledStart'] == null) {
      throw const FormatException('DriverTripDetail: missing scheduledStart');
    }
    if (!json.containsKey('direction') || json['direction'] == null) {
      throw const FormatException('DriverTripDetail: missing direction');
    }
    if (!json.containsKey('routeId') || json['routeId'] == null) {
      throw const FormatException('DriverTripDetail: missing routeId');
    }
    if (!json.containsKey('vehicleId') || json['vehicleId'] == null) {
      throw const FormatException('DriverTripDetail: missing vehicleId');
    }
    if (!json.containsKey('passengerSummary') || json['passengerSummary'] == null) {
      throw const FormatException('DriverTripDetail: missing passengerSummary');
    }

    final snapshotsRaw = (json['locationSnapshots'] as List<Object?>?) ?? [];
    final snapshots = snapshotsRaw
        .map((s) => TripLocationSnapshot.fromJson(s as Map<String, Object?>))
        .toList()
      ..sort((a, b) => a.recordedAt.compareTo(b.recordedAt));

    return DriverTripDetail._(
      id: json['id'] as String,
      status: _parseStatus(json['status']),
      scheduledStart: DateTime.parse(json['scheduledStart'] as String),
      startedAt: json['startedAt'] != null
          ? DateTime.parse(json['startedAt'] as String)
          : null,
      endedAt: json['endedAt'] != null ? DateTime.parse(json['endedAt'] as String) : null,
      direction: json['direction'] as String,
      routeId: json['routeId'] as String,
      vehicleId: json['vehicleId'] as String,
      route: _TripRoute.fromJson(json['route'] as Map<String, Object?>),
      passengerSummary:
          PassengerSummary.fromJson(json['passengerSummary'] as Map<String, Object?>),
      cancellationReason: json['cancellationReason'] as String?,
      locationSnapshots: List.unmodifiable(snapshots),
      assistant: json['assistant'] != null
          ? TripAssistant.fromJson(json['assistant'] as Map<String, Object?>)
          : null,
      vehicle: json['vehicle'] != null
          ? SummaryVehicle.fromJson(json['vehicle'] as Map<String, Object?>)
          : null,
    );
  }
}

// ── DriverTripSummary (workspace list items) ───────────────────────────────

class SummaryRoute {
  const SummaryRoute({required this.id, required this.name});

  final String id;
  final String name;

  factory SummaryRoute.fromJson(Map<String, Object?> json) {
    if (json['id'] == null) throw const FormatException('SummaryRoute: missing id');
    if (json['name'] == null) throw const FormatException('SummaryRoute: missing name');
    return SummaryRoute(id: json['id'] as String, name: json['name'] as String);
  }
}

class SummaryVehicle {
  const SummaryVehicle({
    required this.id,
    required this.registration,
    required this.capacity,
  });

  final String id;
  final String registration;
  final int capacity;

  factory SummaryVehicle.fromJson(Map<String, Object?> json) {
    if (json['id'] == null) throw const FormatException('SummaryVehicle: missing id');
    if (json['registration'] == null) throw const FormatException('SummaryVehicle: missing registration');
    if (json['capacity'] == null) throw const FormatException('SummaryVehicle: missing capacity');
    return SummaryVehicle(
      id: json['id'] as String,
      registration: json['registration'] as String,
      capacity: json['capacity'] as int,
    );
  }
}

class DriverTripSummary {
  const DriverTripSummary({
    required this.id,
    required this.status,
    required this.scheduledStart,
    required this.startedAt,
    required this.endedAt,
    required this.direction,
    required this.routeId,
    required this.vehicleId,
    required this.route,
    required this.vehicle,
    required this.passengerCount,
  });

  final String id;
  final DriverTripStatus status;
  final DateTime scheduledStart;
  final DateTime? startedAt;
  final DateTime? endedAt;
  final String direction;
  final String routeId;
  final String vehicleId;
  final SummaryRoute route;
  final SummaryVehicle vehicle;

  // Sourced from the `_count.passengers` Prisma aggregate field.
  final int passengerCount;

  factory DriverTripSummary.fromJson(Map<String, Object?> json) {
    if (json['id'] == null) throw const FormatException('DriverTripSummary: missing id');
    if (json['scheduledStart'] == null) throw const FormatException('DriverTripSummary: missing scheduledStart');
    if (json['direction'] == null) throw const FormatException('DriverTripSummary: missing direction');
    if (json['routeId'] == null) throw const FormatException('DriverTripSummary: missing routeId');
    if (json['vehicleId'] == null) throw const FormatException('DriverTripSummary: missing vehicleId');
    if (json['route'] == null) throw const FormatException('DriverTripSummary: missing route');
    if (json['vehicle'] == null) throw const FormatException('DriverTripSummary: missing vehicle');
    final count = json['_count'] as Map<String, Object?>?;
    return DriverTripSummary(
      id: json['id'] as String,
      status: _parseStatus(json['status']),
      scheduledStart: DateTime.parse(json['scheduledStart'] as String),
      startedAt: json['startedAt'] != null
          ? DateTime.parse(json['startedAt'] as String)
          : null,
      endedAt:
          json['endedAt'] != null ? DateTime.parse(json['endedAt'] as String) : null,
      direction: json['direction'] as String,
      routeId: json['routeId'] as String,
      vehicleId: json['vehicleId'] as String,
      route: SummaryRoute.fromJson(json['route'] as Map<String, Object?>),
      vehicle: SummaryVehicle.fromJson(json['vehicle'] as Map<String, Object?>),
      passengerCount: (count?['passengers'] as int?) ?? 0,
    );
  }
}

// ── DriverWorkspace ────────────────────────────────────────────────────────

class DriverWorkspace {
  const DriverWorkspace({
    required this.activeTrip,
    required this.upcomingTrips,
    required this.recentTrips,
  });

  final DriverTripSummary? activeTrip;
  final List<DriverTripSummary> upcomingTrips;
  final List<DriverTripSummary> recentTrips;

  factory DriverWorkspace.fromJson(Map<String, Object?> json) {
    if (!json.containsKey('upcomingTrips') || json['upcomingTrips'] == null) {
      throw const FormatException('DriverWorkspace: missing upcomingTrips');
    }
    if (!json.containsKey('recentTrips') || json['recentTrips'] == null) {
      throw const FormatException('DriverWorkspace: missing recentTrips');
    }
    final activeTripRaw = json['activeTrip'];
    return DriverWorkspace(
      activeTrip: activeTripRaw != null
          ? DriverTripSummary.fromJson(activeTripRaw as Map<String, Object?>)
          : null,
      upcomingTrips: (json['upcomingTrips'] as List<Object?>)
          .map((t) => DriverTripSummary.fromJson(t as Map<String, Object?>))
          .toList(),
      recentTrips: (json['recentTrips'] as List<Object?>)
          .map((t) => DriverTripSummary.fromJson(t as Map<String, Object?>))
          .toList(),
    );
  }
}

// ── TripMapPolicy ──────────────────────────────────────────────────────────

class TripMapPolicy {
  const TripMapPolicy({
    required this.primaryAction,
    required this.mapMode,
    required this.plannedPoints,
    required this.travelledPoints,
  });

  final DriverTripAction primaryAction;
  final TripMapMode mapMode;
  final List<TripPoint> plannedPoints;
  final List<TripPoint> travelledPoints;

  factory TripMapPolicy.from(DriverTripDetail detail) {
    return TripMapPolicy(
      primaryAction: detail.primaryAction,
      mapMode: detail.mapMode,
      plannedPoints: detail.plannedPoints,
      travelledPoints: detail.travelledPoints,
    );
  }
}
