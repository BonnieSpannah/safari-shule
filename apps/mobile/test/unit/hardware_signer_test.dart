import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/platform/hardware_signer.dart';

void main() {
  test('HardwareSigner generates expected HMAC SHA256 signature', () {
    const signer = HardwareSigner();
    final payload = <String, Object?>{
      'device_id': 'dev-1',
      'tag_uid': 'ABC123',
      'timestamp': 1724750000000,
    };

    final signature = signer.signature(
      deviceId: 'dev-1',
      hmacSecret: 'secret-key',
      timestamp: 1724750000000,
      body: payload,
    );

    expect(signature, 'eda87617f38544cd88dccd76886cd5347303f71ca343f4bff484a7c57ae7421f');
  });
}
