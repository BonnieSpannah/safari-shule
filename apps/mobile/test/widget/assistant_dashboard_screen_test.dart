import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/client.dart';
import 'package:mobile/features/caretaker/assistant_dashboard_screen.dart';
import 'package:mobile/features/caretaker/assistant_trip_providers.dart';
import 'package:mobile/features/caretaker/assistant_trip_screen.dart';
import 'package:mobile/features/driver/driver_trip_models.dart';

Map<String, Object?> _tripDetailResponse(
  String tripId,
  String status, {
  Map<String, Object?>? assistant,
  Map<String, Object?>? passengerSummary,
  List<Object?>? locationSnapshots,
}) {
  return <String, Object?>{
    'id': tripId,
    'status': status,
    'scheduledStart': '2026-09-02T06:30:00.000Z',
    'startedAt': status == 'in_progress' ? '2026-09-02T06:35:00.000Z' : null,
    'endedAt': status == 'completed' ? '2026-09-02T07:15:00.000Z' : null,
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
    'passengerSummary': passengerSummary ??
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

void main() {
  testWidgets('assistant dashboard shows assigned trip instead of a stub', (
    WidgetTester tester,
  ) async {
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (options.path == '/trips/assistant-workspace') {
            handler.resolve(
              Response<Map<String, Object?>>(
                requestOptions: options,
                statusCode: 200,
                data: <String, Object?>{
                  'activeTrip': <String, Object?>{
                    'id': 'trip-1',
                    'routeId': 'route-1',
                    'vehicleId': 'vehicle-1',
                    'direction': 'morning_pickup',
                    'status': 'in_progress',
                    'scheduledStart': '2026-09-02T06:30:00.000Z',
                    'startedAt': '2026-09-02T06:35:00.000Z',
                    'endedAt': null,
                    'route': <String, Object?>{'id': 'route-1', 'name': 'Kilimani Morning Run'},
                    'vehicle': <String, Object?>{
                      'id': 'vehicle-1',
                      'registration': 'KCA 123A',
                      'capacity': 33,
                    },
                    '_count': <String, Object?>{'passengers': 12},
                  },
                  'upcomingTrips': <Object?>[],
                  'recentTrips': <Object?>[],
                },
              ),
            );
            return;
          }
          handler.resolve(Response<void>(requestOptions: options, statusCode: 200));
        },
      ),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [apiClientProvider.overrideWithValue(dio)],
        child: const MaterialApp(home: AssistantDashboardScreen()),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('My assigned trip'), findsOneWidget);
    expect(find.text('Kilimani Morning Run'), findsWidgets);
    expect(find.text('Assistant dashboard'), findsNothing);
  });

  testWidgets('assistant trip screen renders without start or end actions', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          assistantTripDetailProvider.overrideWith((ref, tripId) => Future.value(
            DriverTripDetail.fromJson(_tripDetailResponse('trip-123', 'in_progress')),
          )),
        ],
        child: const MaterialApp(home: AssistantTripScreen(tripId: 'trip-123')),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('In progress'), findsOneWidget);
    expect(find.text('Start trip'), findsNothing);
    expect(find.text('End trip'), findsNothing);
    expect(find.text('SOS'), findsOneWidget);
  });
}
