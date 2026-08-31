import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_error.dart';

void main() {
  test('uses API response message for Dio errors', () {
    final error = DioException(
      requestOptions: RequestOptions(path: '/trips'),
      response: Response<Object?>(
        requestOptions: RequestOptions(path: '/trips'),
        statusCode: 400,
        data: <String, Object?>{
          'code': 'TENANT_NOT_RESOLVED',
          'message': 'Tenant could not be resolved.',
        },
      ),
    );

    expect(apiErrorMessage(error), 'Tenant could not be resolved.');
  });
}
