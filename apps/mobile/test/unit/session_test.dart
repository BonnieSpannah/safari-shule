import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/auth/session.dart';
import 'package:mobile/core/auth/session_models.dart';
import 'package:mobile/core/auth/session_storage.dart';

/// Overrides every method that touches the platform channel so tests never
/// hit the real secure storage plugin.
class _InMemorySessionStorage extends SessionStorage {
  _InMemorySessionStorage() : super(const FlutterSecureStorage());

  Session? _session;

  @override
  Future<void> write(Session session) async {
    _session = session;
  }

  @override
  Future<Session?> read() async => _session;

  @override
  Future<void> clear() async {
    _session = null;
  }
}

class _FakeAuthAdapter implements HttpClientAdapter {
  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    if (options.path == '/auth/login') {
      return _jsonResponse(<String, Object?>{
        'accessToken': 'access-token',
        'refreshToken': 'refresh-token',
      });
    }
    if (options.path == '/auth/me') {
      return _jsonResponse(<String, Object?>{
        'id': 'user-1',
        'email': 'driver@hillcrest.ac.ke',
        'fullName': 'Driver One',
        'roles': <String>['driver'],
        'permissions': <String>['trips.read'],
        'tenantName': 'Hillcrest Academy',
      });
    }
    throw UnsupportedError('Unexpected path: ${options.path}');
  }

  ResponseBody _jsonResponse(Map<String, Object?> body) {
    return ResponseBody.fromString(
      jsonEncode(body),
      200,
      headers: <String, List<String>>{
        Headers.contentTypeHeader: <String>[Headers.jsonContentType],
      },
    );
  }
}

void main() {
  test('login() carries tenantName from /auth/me into the stored Session', () async {
    final dio = Dio()..httpClientAdapter = _FakeAuthAdapter();
    final container = ProviderContainer(
      overrides: [
        sessionStorageProvider.overrideWithValue(_InMemorySessionStorage()),
      ],
    );
    addTearDown(container.dispose);

    await container.read(sessionNotifierProvider.future);
    final notifier = container.read(sessionNotifierProvider.notifier);

    await notifier.login(
      client: dio,
      email: 'driver@hillcrest.ac.ke',
      password: 'Demo!Password1',
      tenantSlug: 'hillcrest',
    );

    final session = container.read(sessionNotifierProvider).value;
    expect(session, isNotNull);
    expect(session!.tenantName, 'Hillcrest Academy');
  });
}
