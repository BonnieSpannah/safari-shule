import 'package:dio/dio.dart';

String apiErrorMessage(Object error) {
  if (error is DioException) {
    final data = error.response?.data;
    if (data is Map<Object?, Object?>) {
      final message = data['message'];
      if (message is String && message.isNotEmpty) {
        return message;
      }
    }
    final statusCode = error.response?.statusCode;
    if (statusCode != null) {
      return 'Request failed with status $statusCode.';
    }
  }
  return 'Unable to load data. Check your connection and try again.';
}
