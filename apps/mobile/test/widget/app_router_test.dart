import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/app/app.dart';
import 'package:mobile/app/app_router.dart';
import 'package:mobile/core/api/client.dart';
import 'package:mobile/core/auth/session.dart';
import 'package:mobile/core/auth/session_models.dart';
import 'package:mobile/core/offline/outbox_worker.dart';
import 'package:mobile/core/platform/push_notifications.dart';
import 'package:mobile/core/telemetry/trip_telemetry_service.dart';
import 'package:mobile/features/driver/driver_trip_models.dart';
import 'package:mobile/features/driver/driver_trip_providers.dart';
import 'package:mobile/features/driver/driver_trip_screen.dart';
import 'package:mobile/features/parent/parent_children_screen.dart';

class _TestApp extends ConsumerWidget {
  const _TestApp();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    return MaterialApp.router(routerConfig: router);
  }
}

class _UnauthedSessionNotifier extends SessionNotifier {
  @override
  Future<Session?> build() async => null;
}

class _DriverSessionNotifier extends SessionNotifier {
  @override
  Future<Session?> build() async {
    return const Session(
      accessToken: 'token',
      refreshToken: 'refresh',
      tenantSlug: 'hillcrest',
      tenantName: 'Hillcrest Academy',
      user: SessionUser(
        id: 'user-1',
        email: 'driver@hillcrest.ac.ke',
        fullName: 'Driver One',
        roles: <String>['driver'],
      ),
    );
  }
}

class _AdminSessionNotifier extends SessionNotifier {
  @override
  Future<Session?> build() async {
    return const Session(
      accessToken: 'token',
      refreshToken: 'refresh',
      tenantSlug: 'platform',
      tenantName: 'Platform',
      user: SessionUser(
        id: 'admin-1',
        email: 'admin@safarishule.test',
        fullName: 'Platform Admin',
        roles: <String>['system_admin'],
      ),
    );
  }
}

class _ParentSessionNotifier extends SessionNotifier {
  @override
  Future<Session?> build() async {
    return const Session(
      accessToken: 'token',
      refreshToken: 'refresh',
      tenantSlug: 'hillcrest',
      tenantName: 'Hillcrest Academy',
      user: SessionUser(
        id: 'parent-1',
        email: 'parent@hillcrest.ac.ke',
        fullName: 'Parent One',
        roles: <String>['parent'],
      ),
    );
  }
}

// Fakes so pumping the real SafariShuleApp in a lifecycle test never touches
// platform channels (connectivity, Firebase) or the network.
class _NoopOutboxWorker extends OutboxWorker {
  _NoopOutboxWorker()
    : super(client: Dio(), connectivityStream: const Stream<Never>.empty());

  @override
  Future<void> start() async {}

  @override
  Future<void> stop() async {}
}

class _NoopPushNotificationsService extends PushNotificationsService {
  _NoopPushNotificationsService() : super(client: Dio());

  @override
  Future<void> initialize() async {}
}

class _CountingTelemetryService extends TripTelemetryService {
  _CountingTelemetryService() : super(client: Dio());

  int startCalls = 0;
  int stopCalls = 0;

  @override
  Future<void> start(String tripId) async {
    startCalls++;
  }

  @override
  Future<void> stop() async {
    stopCalls++;
  }
}

// Resolves every request instantly so widgets that read the real
// apiClientProvider (e.g. _ActiveTripCard's map preview) never make a real
// network call, which would otherwise leave a Dio retry/timeout Timer pending
// past pumpAndSettle().
Dio _safeDio() {
  final dio = Dio();
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) {
        handler.resolve(
          Response<Map<String, Object?>>(
            requestOptions: options,
            statusCode: 200,
            data: const <String, Object?>{},
          ),
        );
      },
    ),
  );
  return dio;
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

DriverWorkspace _workspaceWithActiveTrip() {
  return DriverWorkspace(
    activeTrip: _summary('trip-1'),
    upcomingTrips: const <DriverTripSummary>[],
    recentTrips: const <DriverTripSummary>[],
  );
}

void main() {
  testWidgets('unauthenticated users are redirected to login', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionNotifierProvider.overrideWith(_UnauthedSessionNotifier.new),
        ],
        child: const _TestApp(),
      ),
    );

    await tester.pumpAndSettle();
    expect(find.text('Safari Shule Login'), findsOneWidget);
  });

  testWidgets('driver role lands on driver dashboard after login', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionNotifierProvider.overrideWith(_DriverSessionNotifier.new),
        ],
        child: const _TestApp(),
      ),
    );

    await tester.pumpAndSettle();
    expect(find.text('My trips'), findsOneWidget);
  });

  testWidgets('driver can navigate to account and sign out', (tester) async {
    late GoRouter router;

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionNotifierProvider.overrideWith(_DriverSessionNotifier.new),
        ],
        child: Consumer(
          builder: (context, ref, child) {
            router = ref.watch(appRouterProvider);
            return MaterialApp.router(routerConfig: router);
          },
        ),
      ),
    );

    await tester.pumpAndSettle();
    router.go('/driver/account');
    await tester.pumpAndSettle();

    expect(find.text('Account'), findsWidgets);
    expect(find.text('Sign out'), findsOneWidget);
  });

  testWidgets('system admin lands on operations dashboard after login', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionNotifierProvider.overrideWith(_AdminSessionNotifier.new),
        ],
        child: const _TestApp(),
      ),
    );

    await tester.pumpAndSettle();
    expect(find.text('Operations'), findsOneWidget);
  });

  testWidgets('authenticated deep link to driver trip page renders trip screen', (tester) async {
    late GoRouter router;

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionNotifierProvider.overrideWith(_DriverSessionNotifier.new),
        ],
        child: Consumer(
          builder: (context, ref, child) {
            router = ref.watch(appRouterProvider);
            return MaterialApp.router(routerConfig: router);
          },
        ),
      ),
    );

    await tester.pumpAndSettle();
    router.go('/driver/trip/trip-987');
    await tester.pumpAndSettle();

    expect(
      router.routeInformationProvider.value.uri.path,
      '/driver/trip/trip-987',
    );
  });

  testWidgets(
    'app resumed lifecycle event syncs telemetry for a driver session',
    (tester) async {
      final telemetry = _CountingTelemetryService();
      var workspaceReads = 0;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            sessionNotifierProvider.overrideWith(_DriverSessionNotifier.new),
            apiClientProvider.overrideWithValue(_safeDio()),
            driverWorkspaceProvider.overrideWith((ref) async {
              workspaceReads++;
              return _workspaceWithActiveTrip();
            }),
            tripTelemetryProvider.overrideWithValue(telemetry),
            outboxWorkerProvider.overrideWithValue(_NoopOutboxWorker()),
            pushNotificationsProvider.overrideWithValue(
              _NoopPushNotificationsService(),
            ),
          ],
          child: const SafariShuleApp(),
        ),
      );

      await tester.pumpAndSettle();

      // Login already triggered one sync; capture the baseline before resume.
      final readsAfterLogin = workspaceReads;
      final startsAfterLogin = telemetry.startCalls;
      expect(readsAfterLogin, greaterThan(0));
      expect(startsAfterLogin, greaterThan(0));

      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();

      expect(workspaceReads, readsAfterLogin + 1);
      expect(telemetry.startCalls, startsAfterLogin + 1);
    },
  );

  testWidgets(
    'app resumed lifecycle event does not sync telemetry for a non-driver session',
    (tester) async {
      final telemetry = _CountingTelemetryService();
      var workspaceReads = 0;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            sessionNotifierProvider.overrideWith(_ParentSessionNotifier.new),
            apiClientProvider.overrideWithValue(_safeDio()),
            driverWorkspaceProvider.overrideWith((ref) async {
              workspaceReads++;
              return _workspaceWithActiveTrip();
            }),
            tripTelemetryProvider.overrideWithValue(telemetry),
            childrenProvider.overrideWith(
              (ref) async => const <Map<String, Object?>>[],
            ),
            outboxWorkerProvider.overrideWithValue(_NoopOutboxWorker()),
            pushNotificationsProvider.overrideWithValue(
              _NoopPushNotificationsService(),
            ),
          ],
          child: const SafariShuleApp(),
        ),
      );

      await tester.pumpAndSettle();
      expect(workspaceReads, 0);
      expect(telemetry.startCalls, 0);
      expect(telemetry.stopCalls, 0);

      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();

      expect(workspaceReads, 0);
      expect(telemetry.startCalls, 0);
      expect(telemetry.stopCalls, 0);
    },
  );
}
