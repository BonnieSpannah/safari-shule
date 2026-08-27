import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_nfc_kit/flutter_nfc_kit.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/api/client.dart';
import 'package:mobile/core/offline/outbox.dart';
import 'package:mobile/core/auth/session.dart';
import 'package:mobile/core/config/env.dart';
import 'package:mobile/core/platform/hardware_signer.dart';
import 'package:mobile/features/caretaker/qr_scan_fallback.dart';
import 'package:uuid/uuid.dart';

class AssistantScanScreen extends ConsumerStatefulWidget {
  const AssistantScanScreen({
    super.key,
    this.scanNfcTag,
    this.scanQrTag,
    this.submitTag,
  });

  final Future<String?> Function()? scanNfcTag;
  final Future<String?> Function(BuildContext context)? scanQrTag;
  final Future<String> Function(WidgetRef ref, String tagUid)? submitTag;

  @override
  ConsumerState<AssistantScanScreen> createState() => _AssistantScanScreenState();
}

class _AssistantScanScreenState extends ConsumerState<AssistantScanScreen> {
  Future<String> _postBoarding(
    WidgetRef ref, {
    required String tagUid,
  }) async {
    if (ApiConfig.deviceId.isEmpty ||
        ApiConfig.deviceApiKey.isEmpty ||
        ApiConfig.deviceHmacSecret.isEmpty) {
      if (!mounted) {
        return 'Missing DEVICE_ID / DEVICE_API_KEY / DEVICE_HMAC_SECRET.';
      }
      return 'Missing DEVICE_ID / DEVICE_API_KEY / DEVICE_HMAC_SECRET.';
    }

    final now = DateTime.now().millisecondsSinceEpoch;
    final payload = <String, Object?>{
      'device_id': ApiConfig.deviceId,
      'tag_uid': tagUid,
      'timestamp': now,
    };

    final signer = const HardwareSigner();
    final signature = signer.signature(
      deviceId: ApiConfig.deviceId,
      hmacSecret: ApiConfig.deviceHmacSecret,
      timestamp: now,
      body: payload,
    );

    try {
      final response = await ref.read(apiClientProvider).post<Map<String, Object?>>(
            '/hardware/rfid-scan',
            data: payload,
            options: Options(headers: <String, Object?>{
              'X-Device-Id': ApiConfig.deviceId,
              'X-Api-Key': ApiConfig.deviceApiKey,
              'X-Timestamp': '$now',
              'X-Signature': signature,
              'X-Tenant-Slug':
                  ref.read(sessionNotifierProvider).value?.tenantSlug ?? '',
            }),
          );
      if (!mounted) {
        return 'Boarding recorded for Student';
      }
      final studentName = (response.data?['studentName'] as String?) ?? 'Student';
      return 'Boarding recorded for $studentName';
    } on DioException {
      await OutboxStore.put(
        OutboxEntry(
          id: const Uuid().v4(),
          endpoint: '/hardware/rfid-scan',
          method: 'POST',
          body: payload,
          createdAt: DateTime.now().toUtc(),
        ),
      );
      if (!mounted) {
        return 'Offline: scan queued for retry';
      }
      return 'Offline: scan queued for retry';
    }
  }

  Future<void> _submitTag(WidgetRef ref, String tagUid) async {
    final message = widget.submitTag != null
        ? await widget.submitTag!(ref, tagUid)
        : await _postBoarding(ref, tagUid: tagUid);
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  Future<void> _scanNfc(WidgetRef ref) async {
    final tagUid = widget.scanNfcTag != null
        ? await widget.scanNfcTag!()
        : (await FlutterNfcKit.poll()).id;
    if (!mounted) {
      return;
    }
    if (tagUid != null && tagUid.isNotEmpty) {
      await _submitTag(ref, tagUid);
    }
    if (widget.scanNfcTag == null) {
      await FlutterNfcKit.finish();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          ElevatedButton(
            key: const Key('scan-nfc-button'),
            onPressed: () => _scanNfc(ref),
            child: const Text('Scan NFC tag'),
          ),
          ElevatedButton(
            key: const Key('scan-qr-button'),
            onPressed: () async {
              final tag = widget.scanQrTag != null
                  ? await widget.scanQrTag!(context)
                  : await Navigator.of(context).push<String>(
                      MaterialPageRoute(builder: (_) => const QrScanFallbackScreen()),
                    );
              if (!mounted) {
                return;
              }
              if (tag != null) {
                await _submitTag(ref, tag);
              }
            },
            child: const Text('Scan QR fallback'),
          ),
        ],
      ),
    );
  }
}
