import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/app/app_router.dart';
import 'package:mobile/core/api/client.dart';
import 'package:mobile/core/auth/session.dart';
import 'package:mobile/core/auth/session_models.dart';
import 'package:mobile/core/offline/outbox_worker.dart';
import 'package:mobile/core/platform/push_notifications.dart';
import 'package:mobile/features/driver/driver_trip_coordinator.dart';
import 'package:mobile/features/driver/driver_trip_providers.dart';
import 'package:mobile/features/driver/driver_trip_screen.dart';

final outboxWorkerProvider = Provider<OutboxWorker>((ref) {
  return OutboxWorker(client: ref.read(apiClientProvider));
});

final pushNotificationsProvider = Provider<PushNotificationsService>((ref) {
  return PushNotificationsService(client: ref.read(apiClientProvider));
});

bool _isDriverSession(Session? session) =>
    session != null && session.user.roles.contains('driver');

class SafariShuleApp extends ConsumerStatefulWidget {
  const SafariShuleApp({super.key});

  @override
  ConsumerState<SafariShuleApp> createState() => _SafariShuleAppState();
}

class _SafariShuleAppState extends ConsumerState<SafariShuleApp>
    with WidgetsBindingObserver {
  bool _pushInitialized = false;
  late final OutboxWorker _outboxWorker;

  @override
  void initState() {
    super.initState();
    _outboxWorker = ref.read(outboxWorkerProvider);
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await _outboxWorker.start();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _outboxWorker.stop();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      final session = ref.read(sessionNotifierProvider).value;
      if (_isDriverSession(session)) {
        ref.invalidate(driverWorkspaceProvider);
        unawaited(ref.read(driverTripCoordinatorProvider).sync());
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AsyncValue<Session?>>(sessionNotifierProvider, (_, next) {
      final session = next.value;
      if (session != null && !_pushInitialized) {
        _pushInitialized = true;
        ref.read(pushNotificationsProvider).initialize().catchError((_) {});
      }
      if (_isDriverSession(session)) {
        unawaited(ref.read(driverTripCoordinatorProvider).sync());
      }
      if (session == null) {
        _pushInitialized = false;
        ref.invalidate(driverWorkspaceProvider);
        unawaited(ref.read(tripTelemetryProvider).stop());
      }
    });

    final router = ref.watch(appRouterProvider);
    return MaterialApp.router(
      title: 'Safari Shule',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0B6E4F)),
        useMaterial3: true,
      ),
      routerConfig: router,
    );
  }
}
