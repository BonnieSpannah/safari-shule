import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_secure_storage_platform_interface/flutter_secure_storage_platform_interface.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/auth/session_storage.dart';

// Fake platform implementation so tests exercise the real SessionStorage.read()
// parsing logic (jsonDecode + Session.fromJson) without touching a real
// platform channel. See flutter_secure_storage_platform_interface's own test
// suite for the same `FlutterSecureStoragePlatform.instance = fake` pattern.
class _FakeSecureStoragePlatform extends FlutterSecureStoragePlatform {
  _FakeSecureStoragePlatform(this._values);

  final Map<String, String> _values;

  @override
  Future<String?> read({
    required String key,
    required Map<String, String> options,
  }) async => _values[key];

  @override
  Future<bool> containsKey({
    required String key,
    required Map<String, String> options,
  }) async => _values.containsKey(key);

  @override
  Future<void> write({
    required String key,
    required String value,
    required Map<String, String> options,
  }) async {
    _values[key] = value;
  }

  @override
  Future<void> delete({
    required String key,
    required Map<String, String> options,
  }) async {
    _values.remove(key);
  }

  @override
  Future<Map<String, String>> readAll({
    required Map<String, String> options,
  }) async => Map<String, String>.of(_values);

  @override
  Future<void> deleteAll({required Map<String, String> options}) async {
    _values.clear();
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'read() returns null for a pre-migration session missing the now-required '
    'tenantName field, instead of throwing',
    () async {
      FlutterSecureStoragePlatform.instance = _FakeSecureStoragePlatform(
        <String, String>{
          'safari_shule_session': jsonEncode(<String, Object?>{
            'accessToken': 'token',
            'refreshToken': 'refresh',
            'tenantSlug': 'hillcrest',
            // tenantName intentionally omitted: pre-Task-15 stored payload.
            'user': <String, Object?>{
              'id': 'user-1',
              'email': 'driver@hillcrest.ac.ke',
              'fullName': 'Driver One',
              'roles': <String>['driver'],
              'permissions': <String>[],
            },
          }),
        },
      );

      final storage = SessionStorage(const FlutterSecureStorage());

      final session = await storage.read();

      expect(session, isNull);
    },
  );

  test('read() returns a valid session unaffected by the corrupt-data guard', () async {
    FlutterSecureStoragePlatform.instance = _FakeSecureStoragePlatform(
      <String, String>{
        'safari_shule_session': jsonEncode(<String, Object?>{
          'accessToken': 'token',
          'refreshToken': 'refresh',
          'tenantSlug': 'hillcrest',
          'tenantName': 'Hillcrest Academy',
          'user': <String, Object?>{
            'id': 'user-1',
            'email': 'driver@hillcrest.ac.ke',
            'fullName': 'Driver One',
            'roles': <String>['driver'],
            'permissions': <String>[],
          },
        }),
      },
    );

    final storage = SessionStorage(const FlutterSecureStorage());

    final session = await storage.read();

    expect(session, isNotNull);
    expect(session!.tenantName, 'Hillcrest Academy');
  });
}
