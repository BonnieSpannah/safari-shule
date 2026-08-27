import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:mobile/core/offline/outbox.dart';
import 'package:mobile/core/offline/outbox_worker.dart';

void main() {
  late Dio dio;

  setUpAll(() {
    Hive.init('.dart_tool/hive_test');
  });

  setUp(() async {
    if (Hive.isBoxOpen(OutboxStore.boxName)) {
      await Hive.box<String>(OutboxStore.boxName).clear();
    } else {
      await OutboxStore.open();
    }
    dio = Dio();
  });

  test('enqueue persists entries in hive', () async {
    await OutboxStore.put(
      OutboxEntry(
        id: '1',
        endpoint: '/trips/1/sos',
        method: 'POST',
        body: <String, Object?>{'description': 'help'},
        createdAt: DateTime.parse('2026-08-27T10:00:00Z'),
      ),
    );

    final entries = await OutboxStore.all();
    expect(entries, hasLength(1));
    expect(entries.first.endpoint, '/trips/1/sos');
  });

  test('drain removes successful entries on reconnect', () async {
    dio.interceptors.add(
      InterceptorsWrapper(onRequest: (options, handler) {
        handler.resolve(
          Response<void>(
            requestOptions: options,
            statusCode: 200,
          ),
        );
      }),
    );

    await OutboxStore.put(
      OutboxEntry(
        id: '2',
        endpoint: '/trips/2/sos',
        method: 'POST',
        body: <String, Object?>{'description': 'ok'},
        createdAt: DateTime.parse('2026-08-27T10:05:00Z'),
      ),
    );

    final worker = OutboxWorker(
      client: dio,
      connectivityStream: Stream<List<ConnectivityResult>>.value(
        <ConnectivityResult>[ConnectivityResult.wifi],
      ),
    );

    await worker.drain();
    final entries = await OutboxStore.all();
    expect(entries, isEmpty);
  });

  test('dead letters after 3 failed attempts', () async {
    dio.interceptors.add(
      InterceptorsWrapper(onRequest: (options, handler) {
        handler.reject(
          DioException(
            requestOptions: options,
            type: DioExceptionType.connectionError,
          ),
        );
      }),
    );

    await OutboxStore.put(
      OutboxEntry(
        id: '3',
        endpoint: '/trips/3/sos',
        method: 'POST',
        body: <String, Object?>{'description': 'retry'},
        createdAt: DateTime.parse('2026-08-27T10:10:00Z'),
      ),
    );

    final worker = OutboxWorker(client: dio);
    await worker.drain();
    await worker.drain();
    final deadLetters = await worker.drain();

    expect(deadLetters, hasLength(1));
    expect(deadLetters.first.attempts, 3);
    final entries = await OutboxStore.all();
    expect(entries, isEmpty);
  });
}
