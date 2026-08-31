import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/config/env.dart';

void main() {
  test('uses canonical API URL by default', () {
    expect(ApiConfig.baseUrl, 'https://api.safari-shule.test/v1');
  });

  test('has no host override unless explicitly configured', () {
    expect(ApiConfig.hostOverride, isEmpty);
  });

  test('uses host override only as the connection URL', () {
    expect(
      ApiConfig.connectionUrlFor(
        'https://api.safari-shule.test/v1',
        '10.0.2.2',
      ),
      'https://10.0.2.2/v1',
    );
  });
}
