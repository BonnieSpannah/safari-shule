import 'dart:io';

import 'package:dio/dio.dart';
import 'package:dio/io.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/auth/session.dart';
import 'package:mobile/core/config/env.dart';
import 'package:uuid/uuid.dart';

final apiClientProvider = Provider<Dio>((ref) {
  final dio = Dio(BaseOptions(baseUrl: ApiConfig.connectionBaseUrl));
  if (ApiConfig.usesHostOverride) {
    final httpClient = HttpClient();
    httpClient.findProxy = (Uri uri) => 'DIRECT';
    httpClient.badCertificateCallback =
        (X509Certificate certificate, String host, int port) =>
            host == ApiConfig.hostOverride;
    dio.httpClientAdapter = IOHttpClientAdapter(
      createHttpClient: () => httpClient,
    );
  }

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) {
        if (ApiConfig.usesHostOverride) {
          options.headers['Host'] = ApiConfig.canonicalHost;
        }
        final session = ref.read(sessionNotifierProvider).value;
        final traceId = const Uuid().v4();
        options.headers['X-Trace-Id'] = traceId;
        if (session != null) {
          options.headers['Authorization'] = 'Bearer ${session.accessToken}';
          options.headers['X-Tenant-Slug'] = session.tenantSlug;
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode != 401) {
          handler.next(error);
          return;
        }

        final requestOptions = error.requestOptions;
        final isRefresh = requestOptions.path.contains('/auth/refresh');
        final alreadyRetried = requestOptions.extra['retried'] == true;
        if (isRefresh || alreadyRetried) {
          await ref.read(sessionNotifierProvider.notifier).clear();
          handler.next(error);
          return;
        }

        try {
          final refreshed = await ref
              .read(sessionNotifierProvider.notifier)
              .refresh(client: dio);
          if (refreshed == null) {
            await ref.read(sessionNotifierProvider.notifier).clear();
            handler.next(error);
            return;
          }

          final replay = requestOptions.copyWith(
            headers: <String, Object?>{
              ...requestOptions.headers,
              'Authorization': 'Bearer ${refreshed.accessToken}',
              'X-Tenant-Slug': refreshed.tenantSlug,
              'X-Trace-Id': const Uuid().v4(),
            },
            extra: <String, Object?>{
              ...requestOptions.extra,
              'retried': true,
            },
          );
          final response = await dio.fetch<Object?>(replay);
          handler.resolve(response);
        } on DioException {
          await ref.read(sessionNotifierProvider.notifier).clear();
          handler.next(error);
        }
      },
    ),
  );

  return dio;
});
