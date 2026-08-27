import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/app/app_router.dart';
import 'package:mobile/core/auth/session.dart';
import 'package:mobile/core/auth/session_models.dart';

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
      user: SessionUser(
        id: 'user-1',
        email: 'driver@hillcrest.ac.ke',
        fullName: 'Driver One',
        roles: <String>['driver'],
      ),
    );
  }
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
    expect(find.text('Start shift'), findsOneWidget);
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
}
