import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/auth/session_models.dart';
import 'package:mobile/core/auth/session_storage.dart';

final sessionStorageProvider = Provider<SessionStorage>((ref) {
  return SessionStorage(const FlutterSecureStorage());
});

final sessionNotifierProvider =
    AsyncNotifierProvider<SessionNotifier, Session?>(SessionNotifier.new);

class SessionNotifier extends AsyncNotifier<Session?> {
  SessionStorage get _storage => ref.read(sessionStorageProvider);

  @override
  Future<Session?> build() async {
    return _storage.read();
  }

  Future<void> login({
    required Dio client,
    required String email,
    required String password,
    required String tenantSlug,
  }) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final response = await client.post<Map<String, Object?>>(
        '/auth/login',
        data: <String, Object?>{
          'email': email,
          'password': password,
        },
        options: Options(headers: <String, Object?>{'X-Tenant-Slug': tenantSlug}),
      );
      final data = response.data ?? <String, Object?>{};
      final accessToken = (data['accessToken'] as String?) ?? '';
      final refreshToken = (data['refreshToken'] as String?) ?? '';
      final me = await client.get<Map<String, Object?>>(
        '/auth/me',
        options: Options(
          headers: <String, Object?>{
            'Authorization': 'Bearer $accessToken',
            'X-Tenant-Slug': tenantSlug,
          },
        ),
      );
      final meData = me.data ?? <String, Object?>{};
      final rolesRaw = meData['roles'];
      final roles = rolesRaw is List
          ? rolesRaw.whereType<String>().toList(growable: false)
          : const <String>[];
      final permissionsRaw = meData['permissions'];
      final permissions = permissionsRaw is List
          ? permissionsRaw.whereType<String>().toList(growable: false)
          : const <String>[];
      final user = SessionUser(
        id: (meData['id'] as String?) ?? '',
        email: (meData['email'] as String?) ?? email,
        fullName: (meData['fullName'] as String?) ?? '',
        roles: roles,
        permissions: permissions,
      );
      final session = Session(
        accessToken: accessToken,
        refreshToken: refreshToken,
        tenantSlug: tenantSlug,
        user: user,
      );
      await _storage.write(session);
      return session;
    });
  }

  Future<Session?> refresh({required Dio client}) async {
    final current = state.value;
    if (current == null) {
      return null;
    }
    final response = await client.post<Map<String, Object?>>(
      '/auth/refresh',
      data: <String, Object?>{'refreshToken': current.refreshToken},
      options: Options(headers: <String, Object?>{'X-Tenant-Slug': current.tenantSlug}),
    );
    final payload = response.data ?? <String, Object?>{};
    final updated = current.copyWith(
      accessToken: (payload['accessToken'] as String?) ?? current.accessToken,
      refreshToken: (payload['refreshToken'] as String?) ?? current.refreshToken,
    );
    await _storage.write(updated);
    state = AsyncValue.data(updated);
    return updated;
  }

  Future<void> logout({required Dio client}) async {
    final current = state.value;
    try {
      if (current != null) {
        await client.post<void>(
          '/auth/logout',
          data: <String, Object?>{'refreshToken': current.refreshToken},
          options: Options(headers: <String, Object?>{'X-Tenant-Slug': current.tenantSlug}),
        );
      }
    } finally {
      await clear();
    }
  }

  Future<void> clear() async {
    await _storage.clear();
    state = const AsyncValue.data(null);
  }
}
