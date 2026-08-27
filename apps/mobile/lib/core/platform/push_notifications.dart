import 'package:dio/dio.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class PushNotificationsService {
  PushNotificationsService({required Dio client}) : _client = client;

  final Dio _client;
  final FlutterLocalNotificationsPlugin _local = FlutterLocalNotificationsPlugin();

  Future<void> initialize() async {
    await _local.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      ),
    );

    await FirebaseMessaging.instance.requestPermission();

    final token = await FirebaseMessaging.instance.getToken();
    if (token != null && token.isNotEmpty) {
      await _registerToken(token);
    }

    FirebaseMessaging.onMessage.listen((message) async {
      final title = message.notification?.title ?? 'Safari Shule';
      final body = message.notification?.body ?? 'New update';
      await _local.show(
        title.hashCode,
        title,
        body,
        const NotificationDetails(
          android: AndroidNotificationDetails(
            'safari-shule-alerts',
            'Safari Shule Alerts',
            importance: Importance.high,
            priority: Priority.high,
          ),
          iOS: DarwinNotificationDetails(),
        ),
      );
    });
  }

  Future<void> _registerToken(String token) async {
    try {
      await _client.post<void>(
        '/users/me/fcm-token',
        data: <String, Object?>{'token': token},
      );
    } on DioException {
      // Best-effort registration because endpoint availability may vary by rollout.
    }
  }
}
