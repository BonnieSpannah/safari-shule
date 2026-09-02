import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:mobile/core/api/client.dart';
import 'package:mobile/core/offline/outbox.dart';
import 'package:mobile/core/telemetry/trip_telemetry_service.dart';
import 'package:mobile/features/driver/driver_trip_map.dart';
import 'package:mobile/features/driver/driver_trip_screen.dart';

Map<String, Object?> _tripDetailResponse(
  String tripId,
  String status, {
  Map<String, Object?>? assistant,
  Map<String, Object?>? passengerSummary,
  List<Object?>? locationSnapshots,
}) {
  final isInProgress = status == 'in_progress';
  final isCompleted = status == 'completed';
  return <String, Object?>{
    'id': tripId,
    'status': status,
    'scheduledStart': '2026-09-02T06:30:00.000Z',
    'startedAt': isInProgress || isCompleted
        ? '2026-09-02T06:35:00.000Z'
        : null,
    'endedAt': isCompleted ? '2026-09-02T07:15:00.000Z' : null,
    'direction': 'morning',
    'routeId': 'route-$tripId',
    'vehicleId': 'vehicle-$tripId',
    'route': <String, Object?>{
      'id': 'route-$tripId',
      'name': 'Kilimani Morning Run',
      'startPoint': <String, Object?>{'lat': -1.29, 'lng': 36.79},
      'endPoint': <String, Object?>{'lat': -1.28, 'lng': 36.80},
      'busStops': <Object?>[],
    },
    'vehicle': <String, Object?>{
      'id': 'vehicle-$tripId',
      'registration': 'KCA 123A',
      'capacity': 33,
    },
    'passengerSummary':
        passengerSummary ??
        <String, Object?>{
          'expected': 18,
          'boarded': 0,
          'onBoard': 0,
          'alighted': 0,
        },
    'cancellationReason': null,
    'locationSnapshots': locationSnapshots ?? <Object?>[],
    'assistant': assistant,
  };
}

class _FakeTelemetryService extends TripTelemetryService {
  _FakeTelemetryService() : super(client: Dio());

  bool started = false;
  bool stopped = false;
  ({double lat, double lng})? fakeLocation;

  @override
  ({double lat, double lng})? get lastKnownLocation => fakeLocation;

  @override
  Future<void> start(String tripId) async {
    started = true;
  }

  @override
  Future<void> stop() async {
    stopped = true;
  }
}

Dio _dioReturning(Map<String, Object?> Function(RequestOptions) responder) {
  final dio = Dio();
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) {
        handler.resolve(
          Response<Map<String, Object?>>(
            requestOptions: options,
            statusCode: 200,
            data: responder(options),
          ),
        );
      },
    ),
  );
  return dio;
}

// Widget test pumps run inside a FakeAsync zone, which does not let real
// dart:io operations (like Hive's file-backed box writes) progress. Any
// interaction that triggers real async I/O must run inside tester.runAsync
// so the real event loop gets a chance to complete it, then a pump() lets
// the resulting widget rebuild (e.g. a SnackBar) materialize in the tree.
Future<void> _tapAndAwaitRealAsync(WidgetTester tester, Finder tapTarget) async {
  await tester.runAsync(() async {
    await tester.tap(tapTarget);
    await Future<void>.delayed(const Duration(milliseconds: 300));
  });
  await tester.pump();
}

void main() {
  setUpAll(() {
    Hive.init('.dart_tool/hive_test_driver');
  });

  setUp(() async {
    if (!Hive.isBoxOpen(OutboxStore.boxName)) {
      await OutboxStore.open();
    }
    // A persistent on-disk box can carry stale entries from an earlier test
    // process; always clear so each test starts from a known-empty outbox.
    await Hive.box<String>(OutboxStore.boxName).clear();
  });

  testWidgets('scheduled trip renders its server route and start-only action', (
    WidgetTester tester,
  ) async {
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (options.path == '/trips/driver/trip-789') {
            handler.resolve(
              Response<Map<String, Object?>>(
                requestOptions: options,
                statusCode: 200,
                data: _tripDetailResponse('trip-789', 'scheduled'),
              ),
            );
            return;
          }
          handler.resolve(
            Response<void>(requestOptions: options, statusCode: 200),
          );
        },
      ),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [apiClientProvider.overrideWithValue(dio)],
        child: const MaterialApp(home: DriverTripScreen(tripId: 'trip-789')),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Kilimani Morning Run'), findsOneWidget);
    expect(find.text('Start trip'), findsOneWidget);
    expect(find.text('End trip'), findsNothing);
    expect(find.text('SOS'), findsNothing);
  });

  testWidgets(
    'scheduled trip view shows planned route, schedule chip, and start action',
    (WidgetTester tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            apiClientProvider.overrideWithValue(
              _dioReturning(
                (_) =>
                    _tripDetailResponse('trip-scheduled-shell', 'scheduled'),
              ),
            ),
          ],
          child: const MaterialApp(
            home: DriverTripScreen(tripId: 'trip-scheduled-shell'),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Scheduled'), findsOneWidget);
      expect(find.textContaining('Passengers'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Start trip'), findsOneWidget);
      final map = tester.widget<DriverTripMap>(find.byType(DriverTripMap));
      expect(map.compact, isFalse);
    },
  );

  testWidgets('scheduled trip requires confirmation before starting', (
    WidgetTester tester,
  ) async {
    final requests = <String>[];
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          requests.add('${options.method} ${options.path}');
          if (options.path == '/trips/driver/trip-confirm') {
            handler.resolve(
              Response<Map<String, Object?>>(
                requestOptions: options,
                statusCode: 200,
                data: _tripDetailResponse('trip-confirm', 'scheduled'),
              ),
            );
            return;
          }
          handler.resolve(
            Response<Map<String, Object?>>(
              requestOptions: options,
              statusCode: 200,
              data: _tripDetailResponse('trip-confirm', 'in_progress'),
            ),
          );
        },
      ),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(dio),
          tripTelemetryProvider.overrideWithValue(_FakeTelemetryService()),
        ],
        child: const MaterialApp(
          home: DriverTripScreen(tripId: 'trip-confirm'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Start trip'));
    await tester.pumpAndSettle();

    expect(find.text('Confirm start trip'), findsOneWidget);
    expect(requests.contains('POST /trips/trip-confirm/driver-start'), isFalse);

    await tester.tap(find.text('Confirm start'));
    await tester.pumpAndSettle();

    expect(requests.contains('POST /trips/trip-confirm/driver-start'), isTrue);
  });

  group('in-progress trip screen', () {
    testWidgets('shows the live map as the dominant view, never offering start', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            apiClientProvider.overrideWithValue(
              _dioReturning(
                (_) => _tripDetailResponse('trip-resume', 'in_progress'),
              ),
            ),
          ],
          child: const MaterialApp(
            home: DriverTripScreen(tripId: 'trip-resume'),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final map = tester.widget<DriverTripMap>(find.byType(DriverTripMap));
      expect(map.compact, isFalse);
      expect(find.text('Start trip'), findsNothing);
    });

    testWidgets('shows status, vehicle, direction, and elapsed time', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            apiClientProvider.overrideWithValue(
              _dioReturning(
                (_) => _tripDetailResponse('trip-resume', 'in_progress'),
              ),
            ),
          ],
          child: const MaterialApp(
            home: DriverTripScreen(tripId: 'trip-resume'),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('In progress'), findsOneWidget);
      expect(find.text('KCA 123A'), findsOneWidget);
      expect(find.text('Morning'), findsOneWidget);
      expect(find.textContaining('Started'), findsOneWidget);
    });

    testWidgets('keeps End trip and SOS immediately reachable', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            apiClientProvider.overrideWithValue(
              _dioReturning(
                (_) => _tripDetailResponse('trip-resume', 'in_progress'),
              ),
            ),
          ],
          child: const MaterialApp(
            home: DriverTripScreen(tripId: 'trip-resume'),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('End trip'), findsOneWidget);
      expect(find.text('SOS'), findsOneWidget);
    });

    testWidgets('shows the assigned assistant name', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            apiClientProvider.overrideWithValue(
              _dioReturning(
                (_) => _tripDetailResponse(
                  'trip-resume',
                  'in_progress',
                  assistant: <String, Object?>{
                    'id': 'assistant-1',
                    'fullName': 'Jane Assistant',
                  },
                ),
              ),
            ),
          ],
          child: const MaterialApp(
            home: DriverTripScreen(tripId: 'trip-resume'),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('Jane Assistant'), findsOneWidget);
    });

    testWidgets('omits the assistant row when unassigned', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            apiClientProvider.overrideWithValue(
              _dioReturning(
                (_) => _tripDetailResponse('trip-resume', 'in_progress'),
              ),
            ),
          ],
          child: const MaterialApp(
            home: DriverTripScreen(tripId: 'trip-resume'),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('Assistant'), findsNothing);
    });

    testWidgets('shows the passenger board breakdown', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            apiClientProvider.overrideWithValue(
              _dioReturning(
                (_) => _tripDetailResponse(
                  'trip-resume',
                  'in_progress',
                  passengerSummary: <String, Object?>{
                    'expected': 12,
                    'boarded': 9,
                    'onBoard': 7,
                    'alighted': 2,
                  },
                ),
              ),
            ),
          ],
          child: const MaterialApp(
            home: DriverTripScreen(tripId: 'trip-resume'),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('12'), findsOneWidget);
      expect(find.text('9'), findsOneWidget);
      expect(find.text('7'), findsOneWidget);
      expect(find.text('2'), findsOneWidget);
    });

    testWidgets('shows location unavailable with zero snapshots', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            apiClientProvider.overrideWithValue(
              _dioReturning(
                (_) => _tripDetailResponse('trip-resume', 'in_progress'),
              ),
            ),
          ],
          child: const MaterialApp(
            home: DriverTripScreen(tripId: 'trip-resume'),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Location unavailable'), findsOneWidget);
    });

    testWidgets('shows GPS live with a very recent snapshot', (
      WidgetTester tester,
    ) async {
      final recordedAt = DateTime.now().toUtc().subtract(
        const Duration(seconds: 10),
      );
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            apiClientProvider.overrideWithValue(
              _dioReturning(
                (_) => _tripDetailResponse(
                  'trip-resume',
                  'in_progress',
                  locationSnapshots: <Object?>[
                    <String, Object?>{
                      'lat': -1.29,
                      'lng': 36.79,
                      'headingDeg': 45.0,
                      'speedKph': 20.0,
                      'recordedAt': recordedAt.toIso8601String(),
                    },
                  ],
                ),
              ),
            ),
          ],
          child: const MaterialApp(
            home: DriverTripScreen(tripId: 'trip-resume'),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('GPS live'), findsOneWidget);
    });

    testWidgets('End trip confirmation warns when passengers remain on board', (
      WidgetTester tester,
    ) async {
      final requests = <String>[];
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            requests.add('${options.method} ${options.path}');
            handler.resolve(
              Response<Map<String, Object?>>(
                requestOptions: options,
                statusCode: 200,
                data: _tripDetailResponse(
                  'trip-resume',
                  'in_progress',
                  passengerSummary: <String, Object?>{
                    'expected': 10,
                    'boarded': 8,
                    'onBoard': 3,
                    'alighted': 5,
                  },
                ),
              ),
            );
          },
        ),
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            apiClientProvider.overrideWithValue(dio),
            tripTelemetryProvider.overrideWithValue(_FakeTelemetryService()),
          ],
          child: const MaterialApp(
            home: DriverTripScreen(tripId: 'trip-resume'),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('End trip'));
      await tester.pumpAndSettle();

      expect(find.textContaining('still on board'), findsOneWidget);
      expect(requests.contains('POST /trips/trip-resume/driver-end'), isFalse);

      await tester.tap(find.text('Confirm end'));
      await tester.pumpAndSettle();

      expect(requests.contains('POST /trips/trip-resume/driver-end'), isTrue);
    });

    testWidgets(
      'End trip confirmation has no on-board warning when nobody remains on board',
      (WidgetTester tester) async {
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              apiClientProvider.overrideWithValue(
                _dioReturning(
                  (_) => _tripDetailResponse('trip-resume', 'in_progress'),
                ),
              ),
              tripTelemetryProvider.overrideWithValue(_FakeTelemetryService()),
            ],
            child: const MaterialApp(
              home: DriverTripScreen(tripId: 'trip-resume'),
            ),
          ),
        );
        await tester.pumpAndSettle();

        await tester.tap(find.text('End trip'));
        await tester.pumpAndSettle();

        expect(find.text('Confirm end trip'), findsOneWidget);
        expect(find.textContaining('still on board'), findsNothing);
      },
    );
  });

  group('completed trip screen', () {
    testWidgets(
      'completed trip view shows travelled route, duration, and passenger totals with no actions',
      (WidgetTester tester) async {
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              apiClientProvider.overrideWithValue(
                _dioReturning(
                  (_) => _tripDetailResponse(
                    'trip-done',
                    'completed',
                    passengerSummary: <String, Object?>{
                      'expected': 12,
                      'boarded': 11,
                      'onBoard': 0,
                      'alighted': 11,
                    },
                  ),
                ),
              ),
            ],
            child: const MaterialApp(
              home: DriverTripScreen(tripId: 'trip-done'),
            ),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('Completed'), findsOneWidget);
        expect(find.textContaining('Boarded'), findsOneWidget);
        expect(find.byType(FilledButton), findsNothing);
        expect(find.byType(ElevatedButton), findsNothing);
        final map = tester.widget<DriverTripMap>(find.byType(DriverTripMap));
        expect(map.compact, isFalse);
      },
    );
  });

  testWidgets('driver start and end trip call endpoints and update status', (
    WidgetTester tester,
  ) async {
    final requests = <String>[];
    var status = 'scheduled';
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          requests.add('${options.method} ${options.path}');
          if (options.method == 'GET' &&
              options.path == '/trips/driver/trip-123') {
            handler.resolve(
              Response<Map<String, Object?>>(
                requestOptions: options,
                statusCode: 200,
                data: _tripDetailResponse('trip-123', status),
              ),
            );
            return;
          }
          if (options.path.endsWith('/driver-start')) {
            status = 'in_progress';
            handler.resolve(
              Response<Map<String, Object?>>(
                requestOptions: options,
                statusCode: 200,
                data: _tripDetailResponse('trip-123', status),
              ),
            );
            return;
          }
          if (options.path.endsWith('/driver-end')) {
            status = 'completed';
            handler.resolve(
              Response<Map<String, Object?>>(
                requestOptions: options,
                statusCode: 200,
                data: _tripDetailResponse('trip-123', status),
              ),
            );
            return;
          }
          handler.resolve(
            Response<void>(requestOptions: options, statusCode: 200),
          );
        },
      ),
    );
    final telemetry = _FakeTelemetryService();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(dio),
          tripTelemetryProvider.overrideWithValue(telemetry),
        ],
        child: const MaterialApp(home: DriverTripScreen(tripId: 'trip-123')),
      ),
    );

    await tester.pumpAndSettle();
    expect(find.text('Scheduled'), findsOneWidget);

    await tester.tap(find.text('Start trip'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Confirm start'));
    await tester.pumpAndSettle();

    expect(requests.contains('POST /trips/trip-123/driver-start'), isTrue);
    expect(telemetry.started, isTrue);
    expect(find.text('In progress'), findsOneWidget);

    await tester.tap(find.text('End trip'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Confirm end'));
    await tester.pumpAndSettle();

    expect(requests.contains('POST /trips/trip-123/driver-end'), isTrue);
    expect(telemetry.stopped, isTrue);
    expect(find.text('Completed'), findsOneWidget);
  });

  testWidgets('driver SOS failure queues outbox entry', (
    WidgetTester tester,
  ) async {
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (options.path == '/trips/driver/trip-456') {
            handler.resolve(
              Response<Map<String, Object?>>(
                requestOptions: options,
                statusCode: 200,
                data: _tripDetailResponse('trip-456', 'in_progress'),
              ),
            );
            return;
          }
          if (options.path.endsWith('/sos')) {
            handler.reject(
              DioException(
                requestOptions: options,
                type: DioExceptionType.connectionError,
              ),
            );
            return;
          }
          handler.resolve(
            Response<void>(requestOptions: options, statusCode: 200),
          );
        },
      ),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(dio),
          tripTelemetryProvider.overrideWithValue(_FakeTelemetryService()),
        ],
        child: const MaterialApp(home: DriverTripScreen(tripId: 'trip-456')),
      ),
    );

    await tester.pumpAndSettle();
    await _tapAndAwaitRealAsync(tester, find.text('SOS'));

    final entries = await OutboxStore.all();
    expect(entries, hasLength(1));
    expect(entries.first.endpoint, '/trips/trip-456/sos');
    expect(find.textContaining('queued'), findsOneWidget);
  });

  testWidgets('driver SOS success sends the real last-known location and confirms', (
    WidgetTester tester,
  ) async {
    Map<String, Object?>? capturedBody;
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (options.path == '/trips/driver/trip-789') {
            handler.resolve(
              Response<Map<String, Object?>>(
                requestOptions: options,
                statusCode: 200,
                data: _tripDetailResponse('trip-789', 'in_progress'),
              ),
            );
            return;
          }
          if (options.path.endsWith('/sos')) {
            capturedBody = options.data as Map<String, Object?>;
            handler.resolve(
              Response<void>(requestOptions: options, statusCode: 202),
            );
            return;
          }
          handler.resolve(
            Response<void>(requestOptions: options, statusCode: 200),
          );
        },
      ),
    );
    final telemetry = _FakeTelemetryService()
      ..fakeLocation = (lat: -1.2921, lng: 36.8219);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(dio),
          tripTelemetryProvider.overrideWithValue(telemetry),
        ],
        child: const MaterialApp(home: DriverTripScreen(tripId: 'trip-789')),
      ),
    );

    await tester.pumpAndSettle();
    await _tapAndAwaitRealAsync(tester, find.text('SOS'));

    expect(capturedBody?['location'], <String, Object?>{
      'lat': -1.2921,
      'lng': 36.8219,
    });
    expect(find.text('SOS sent'), findsOneWidget);
  });

  testWidgets('driver SOS omits location when no fix is known yet', (
    WidgetTester tester,
  ) async {
    Map<String, Object?>? capturedBody;
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (options.path == '/trips/driver/trip-789') {
            handler.resolve(
              Response<Map<String, Object?>>(
                requestOptions: options,
                statusCode: 200,
                data: _tripDetailResponse('trip-789', 'in_progress'),
              ),
            );
            return;
          }
          if (options.path.endsWith('/sos')) {
            capturedBody = options.data as Map<String, Object?>;
            handler.resolve(
              Response<void>(requestOptions: options, statusCode: 202),
            );
            return;
          }
          handler.resolve(
            Response<void>(requestOptions: options, statusCode: 200),
          );
        },
      ),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(dio),
          tripTelemetryProvider.overrideWithValue(_FakeTelemetryService()),
        ],
        child: const MaterialApp(home: DriverTripScreen(tripId: 'trip-789')),
      ),
    );

    await tester.pumpAndSettle();
    await _tapAndAwaitRealAsync(tester, find.text('SOS'));

    expect(capturedBody?.containsKey('location'), isFalse);
  });
}
