import 'package:flutter/foundation.dart';

class ApiConfig {
  ApiConfig._();

  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.safari-shule.test/v1',
  );

  static String get wsUrl => '${baseUrl.replaceFirst('/v1', '')}/ws';

  static const String hostOverride = String.fromEnvironment(
    'API_HOST_OVERRIDE',
    defaultValue: '',
  );

  static bool get usesHostOverride => kDebugMode && hostOverride.isNotEmpty;

  static String get connectionBaseUrl =>
      connectionUrlFor(baseUrl, usesHostOverride ? hostOverride : '');

  static String connectionUrlFor(String configuredUrl, String hostOverride) {
    if (hostOverride.isEmpty) {
      return configuredUrl;
    }
    final uri = Uri.parse(configuredUrl);
    return uri.replace(host: hostOverride).toString();
  }

  static String get canonicalHost => Uri.parse(baseUrl).host;

  static const String deviceId = String.fromEnvironment(
    'DEVICE_ID',
    defaultValue: '',
  );

  static const String deviceApiKey = String.fromEnvironment(
    'DEVICE_API_KEY',
    defaultValue: '',
  );

  static const String deviceHmacSecret = String.fromEnvironment(
    'DEVICE_HMAC_SECRET',
    defaultValue: '',
  );

  static const String fcmTokenEndpoint = String.fromEnvironment(
    'FCM_TOKEN_ENDPOINT',
    defaultValue: '/users/me/fcm-token',
  );
}
