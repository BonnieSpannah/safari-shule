class ApiConfig {
  ApiConfig._();

  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000/v1',
  );

  static String get wsUrl => '${baseUrl.replaceFirst('/v1', '')}/ws';

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
}
