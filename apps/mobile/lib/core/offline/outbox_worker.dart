import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:mobile/core/offline/outbox.dart';

class OutboxWorker {
  OutboxWorker({
    required Dio client,
    Stream<List<ConnectivityResult>>? connectivityStream,
  })
      : _client = client,
        _connectivityStream = connectivityStream ?? Connectivity().onConnectivityChanged;

  final Dio _client;
  final Stream<List<ConnectivityResult>> _connectivityStream;
  StreamSubscription<List<ConnectivityResult>>? _subscription;
  Timer? _timer;

  Future<void> start() async {
    await OutboxStore.open();
    _subscription = _connectivityStream.listen((result) {
      if (result.any((item) => item != ConnectivityResult.none)) {
        unawaited(drain());
      }
    });
    _timer = Timer.periodic(const Duration(seconds: 30), (_) {
      unawaited(drain());
    });
  }

  Future<void> stop() async {
    await _subscription?.cancel();
    _timer?.cancel();
  }

  Future<List<OutboxEntry>> drain() async {
    final entries = await OutboxStore.all();
    final deadLetters = <OutboxEntry>[];

    for (final entry in entries) {
      try {
        await _client.request<Object?>(
          entry.endpoint,
          data: entry.body,
          options: Options(method: entry.method),
        );
        await OutboxStore.delete(entry.id);
      } on DioException {
        final attempts = entry.attempts + 1;
        if (attempts >= 3) {
          deadLetters.add(entry.copyWith(attempts: attempts));
          await OutboxStore.delete(entry.id);
        } else {
          await OutboxStore.put(entry.copyWith(attempts: attempts));
        }
      }
    }

    return deadLetters;
  }
}
