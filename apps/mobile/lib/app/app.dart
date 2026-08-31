import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/app/app_router.dart';
import 'package:mobile/core/api/client.dart';
import 'package:mobile/core/auth/session.dart';
import 'package:mobile/core/auth/session_models.dart';
import 'package:mobile/core/offline/outbox_worker.dart';
import 'package:mobile/core/platform/push_notifications.dart';

final outboxWorkerProvider = Provider<OutboxWorker>((ref) {
  return OutboxWorker(client: ref.read(apiClientProvider));
});

final pushNotificationsProvider = Provider<PushNotificationsService>((ref) {
  return PushNotificationsService(client: ref.read(apiClientProvider));
});

class SafariShuleApp extends ConsumerStatefulWidget {
  const SafariShuleApp({super.key});

  @override
  ConsumerState<SafariShuleApp> createState() => _SafariShuleAppState();
}

class _SafariShuleAppState extends ConsumerState<SafariShuleApp> {
  bool _pushInitialized = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await ref.read(outboxWorkerProvider).start();
    });
  }

  @override
  void dispose() {
    ref.read(outboxWorkerProvider).stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AsyncValue<Session?>>(sessionNotifierProvider, (_, next) {
      final session = next.value;
      if (session != null && !_pushInitialized) {
        _pushInitialized = true;
        ref.read(pushNotificationsProvider).initialize().catchError((_) {});
      }
      if (session == null) {
        _pushInitialized = false;
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
