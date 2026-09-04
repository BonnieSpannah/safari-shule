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
    try {
      return Session.fromJson(payload);
    } on TypeError {
      // A session written by an older build can be missing a field that's
      // since become required (e.g. tenantName) — treat it as no session
      // rather than crashing, forcing a fresh login.
      return null;
    }
  }

  Future<void> clear() => _storage.delete(key: _sessionKey);
}
