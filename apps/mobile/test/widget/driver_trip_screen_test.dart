import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:mobile/core/api/client.dart';
import 'package:mobile/core/offline/outbox.dart';
import 'package:mobile/core/telemetry/trip_telemetry_service.dart';
import 'package:mobile/features/driver/driver_trip_screen.dart';

class _FakeTelemetryService extends TripTelemetryService {
  _FakeTelemetryService() : super(client: Dio());

  bool started = false;
  bool stopped = false;

  @override
  Future<void> start(String tripId) async {
    started = true;
  }

  @override
  Future<void> stop() async {
    stopped = true;
  }
}

void main() {
  setUpAll(() {
    Hive.init('.dart_tool/hive_test_driver');
  });

  setUp(() async {
    if (Hive.isBoxOpen(OutboxStore.boxName)) {
      await Hive.box<String>(OutboxStore.boxName).clear();
    } else {
      await OutboxStore.open();
    }
  });

  testWidgets('driver start and end trip call endpoints and update status', (
    WidgetTester tester,
  ) async {
    final requests = <String>[];
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(onRequest: (options, handler) {
        requests.add('${options.method} ${options.path}');
        handler.resolve(Response<void>(requestOptions: options, statusCode: 200));
      }),
    );
    final telemetry = _FakeTelemetryService();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(dio),
          tripTelemetryProvider.overrideWithValue(telemetry),
        ],
        child: const MaterialApp(
          home: DriverTripScreen(tripId: 'trip-123'),
        ),
      ),
    );

    expect(find.text('Trip status: scheduled'), findsOneWidget);

    await tester.tap(find.text('Start trip'));
    await tester.pumpAndSettle();

    expect(requests.contains('POST /trips/trip-123/start'), isTrue);
    expect(telemetry.started, isTrue);
    expect(find.text('Trip status: in_progress'), findsOneWidget);

    await tester.tap(find.text('End trip'));
    await tester.pumpAndSettle();

    expect(requests.contains('POST /trips/trip-123/end'), isTrue);
    expect(telemetry.stopped, isTrue);
    expect(find.text('Trip status: scheduled'), findsOneWidget);
  });

  testWidgets('driver SOS failure queues outbox entry', (WidgetTester tester) async {
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(onRequest: (options, handler) {
        if (options.path.endsWith('/sos')) {
          handler.reject(
            DioException(
              requestOptions: options,
              type: DioExceptionType.connectionError,
            ),
          );
          return;
        }
        handler.resolve(Response<void>(requestOptions: options, statusCode: 200));
      }),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(dio),
          tripTelemetryProvider.overrideWithValue(_FakeTelemetryService()),
        ],
        child: const MaterialApp(
          home: DriverTripScreen(tripId: 'trip-456'),
        ),
      ),
    );

    await tester.tap(find.text('SOS'));
    await tester.pumpAndSettle();

    final entries = await OutboxStore.all();
    expect(entries, hasLength(1));
    expect(entries.first.endpoint, '/trips/trip-456/sos');
  });
}
