import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:mobile/core/auth/session_models.dart';

class SessionStorage {
  SessionStorage(this._storage);

  static const _sessionKey = 'safari_shule_session';

  final FlutterSecureStorage _storage;

  Future<void> write(Session session) async {
    await _storage.write(key: _sessionKey, value: jsonEncode(session.toJson()));
  }

  Future<Session?> read() async {
    final raw = await _storage.read(key: _sessionKey);
    if (raw == null || raw.isEmpty) {
      return null;
    }
    final payload = jsonDecode(raw);
    if (payload is! Map<String, Object?>) {
      return null;
    }
    return Session.fromJson(payload);
  }

  Future<void> clear() => _storage.delete(key: _sessionKey);
}
