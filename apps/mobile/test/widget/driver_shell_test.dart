import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/app/app_router.dart';
import 'package:mobile/core/api/client.dart';
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

class _DriverSessionNotifier extends SessionNotifier {
  @override
  Future<Session?> build() async {
    return const Session(
      accessToken: 'token',
      refreshToken: 'refresh',
      tenantSlug: 'sunshine',
      tenantName: 'Sunshine School',
      user: SessionUser(
        id: 'user-1',
        email: 'driver@sunshine.ac.ke',
        fullName: 'Driver One',
        roles: <String>['driver'],
      ),
    );
  }
}

void main() {
  testWidgets('driver shell shows Safari Shule brand above tenant name and role', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionNotifierProvider.overrideWith(_DriverSessionNotifier.new),
          apiClientProvider.overrideWithValue(_safeDio()),
        ],
        child: const _TestApp(),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Safari Shule'), findsOneWidget);
    expect(find.text('Sunshine School · Driver'), findsOneWidget);

    final brandTop = tester.getTopLeft(find.text('Safari Shule')).dy;
    final tenantRoleTop = tester.getTopLeft(find.text('Sunshine School · Driver')).dy;
    expect(brandTop, lessThan(tenantRoleTop));
  });
}

// Resolves every request instantly so widgets that read the real
// apiClientProvider (e.g. the dashboard's active/upcoming trip cards) never
// make a real network call, which would otherwise leave a Dio retry/timeout
// Timer pending past pumpAndSettle().
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
