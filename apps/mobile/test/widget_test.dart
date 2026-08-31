import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/features/auth/login_screen.dart';
import 'package:mobile/core/auth/session.dart';
import 'package:mobile/core/auth/session_models.dart';
import 'package:mobile/core/api/client.dart';

class FakeSessionNotifierSuccess extends SessionNotifier {
  @override
  Future<Session?> build() async => null;

  @override
  Future<void> login({
    required Dio client,
    required String email,
    required String password,
    required String tenantSlug,
  }) async {
    state = const AsyncLoading();
    state = AsyncValue.data(
      Session(
        accessToken: 'token',
        refreshToken: 'refresh',
        tenantSlug: tenantSlug,
        user: SessionUser(
          id: 'u1',
          email: email,
          fullName: 'Test User',
          roles: const <String>['driver'],
        ),
      ),
    );
  }
}

class FakeSessionNotifierError extends SessionNotifier {
  @override
  Future<Session?> build() async => null;

  @override
  Future<void> login({
    required Dio client,
    required String email,
    required String password,
    required String tenantSlug,
  }) async {
    state = const AsyncLoading();
    throw Exception('bad credentials');
  }
}

class FakeSessionNotifierStateError extends SessionNotifier {
  @override
  Future<Session?> build() async => null;

  @override
  Future<void> login({
    required Dio client,
    required String email,
    required String password,
    required String tenantSlug,
  }) async {
    state = AsyncValue.error(
      DioException(
        requestOptions: RequestOptions(path: '/auth/login'),
        response: Response<Object?>(
          requestOptions: RequestOptions(path: '/auth/login'),
          statusCode: 400,
          data: <String, Object?>{'message': 'Tenant could not be resolved.'},
        ),
      ),
      StackTrace.current,
    );
  }
}

class FakeSessionNotifierLoading extends SessionNotifier {
  final Completer<void> _completer = Completer<void>();

  @override
  Future<Session?> build() async => null;

  @override
  Future<void> login({
    required Dio client,
    required String email,
    required String password,
    required String tenantSlug,
  }) async {
    state = const AsyncLoading();
    await _completer.future;
  }
}

void main() {
  testWidgets('LoginScreen happy path renders and submits', (WidgetTester tester) async {
    final client = Dio();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(client),
          sessionNotifierProvider.overrideWith(FakeSessionNotifierSuccess.new),
        ],
        child: const MaterialApp(home: LoginScreen()),
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('login-email')), 'admin@hillcrest.ac.ke');
    await tester.enterText(find.byKey(const Key('login-password')), 'Demo!Password1');
    await tester.enterText(find.byKey(const Key('login-tenant')), 'hillcrest');
    await tester.tap(find.byKey(const Key('login-submit')));
    await tester.pump();

    expect(find.text('Sign in'), findsOneWidget);
  });

  testWidgets('LoginScreen error state shows snackbar', (WidgetTester tester) async {
    final client = Dio();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(client),
          sessionNotifierProvider.overrideWith(FakeSessionNotifierError.new),
        ],
        child: const MaterialApp(home: LoginScreen()),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('login-submit')));
    await tester.pump();

    expect(find.byKey(const Key('login-error')), findsOneWidget);
    expect(find.text('Login failed. Check credentials and tenant.'), findsOneWidget);
  });

  testWidgets('LoginScreen displays SessionNotifier API errors', (WidgetTester tester) async {
    final client = Dio();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(client),
          sessionNotifierProvider.overrideWith(FakeSessionNotifierStateError.new),
        ],
        child: const MaterialApp(home: LoginScreen()),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('login-submit')));
    await tester.pump();

    expect(find.byKey(const Key('login-error')), findsOneWidget);
    expect(find.text('Tenant could not be resolved.'), findsOneWidget);
  });

  testWidgets('LoginScreen loading state disables submit', (WidgetTester tester) async {
    final client = Dio();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(client),
          sessionNotifierProvider.overrideWith(FakeSessionNotifierLoading.new),
        ],
        child: const MaterialApp(home: LoginScreen()),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('login-submit')));
    await tester.pump();

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });
}
