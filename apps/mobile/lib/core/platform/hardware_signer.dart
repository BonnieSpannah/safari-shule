import 'dart:convert';

import 'package:crypto/crypto.dart';

class HardwareSigner {
  const HardwareSigner();

  String signature({
    required String deviceId,
    required String hmacSecret,
    required int timestamp,
    required Map<String, Object?> body,
  }) {
    final rawBody = jsonEncode(body);
    final message = '$deviceId.$timestamp.$rawBody';
    return Hmac(sha256, utf8.encode(hmacSecret))
        .convert(utf8.encode(message))
        .toString();
  }
}
