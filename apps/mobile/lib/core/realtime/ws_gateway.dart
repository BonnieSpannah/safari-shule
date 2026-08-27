import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/auth/session.dart';
import 'package:mobile/core/config/env.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

class WsEvent {
  const WsEvent({required this.tripId, required this.lat, required this.lng});

  final String tripId;
  final double lat;
  final double lng;
}

final wsSocketProvider = Provider<io.Socket?>((ref) {
  final session = ref.watch(sessionNotifierProvider).value;
  if (session == null) {
    return null;
  }

  final socket = io.io(
    ApiConfig.wsUrl,
    io.OptionBuilder()
        .setAuth(<String, Object?>{'token': session.accessToken})
        .setTransports(<String>['websocket'])
        .disableAutoConnect()
        .build(),
  );
  socket.connect();
  ref.onDispose(() {
    socket.dispose();
  });
  return socket;
});

final wsTripLocationProvider =
    StreamProvider.family<WsEvent?, String>((ref, tripId) async* {
  final socket = ref.watch(wsSocketProvider);
  if (socket == null) {
    yield null;
    return;
  }

  socket.emit('trip.subscribe', <String, Object?>{'tripId': tripId});

  final controller = StreamController<WsEvent?>();
  void handler(Object? payload) {
    if (payload is Map) {
      final lat = payload['lat'];
      final lng = payload['lng'];
      final id = payload['tripId'];
      if (lat is num && lng is num && id is String) {
        controller.add(WsEvent(tripId: id, lat: lat.toDouble(), lng: lng.toDouble()));
      }
    }
  }

  socket.on('trip.location', handler);
  ref.onDispose(() {
    socket.emit('trip.unsubscribe', <String, Object?>{'tripId': tripId});
    socket.off('trip.location', handler);
    controller.close();
  });

  yield* controller.stream;
});
