import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/api/client.dart';
import 'package:mobile/core/offline/outbox.dart';
import 'package:mobile/core/realtime/ws_gateway.dart';
import 'package:mobile/core/telemetry/trip_telemetry_service.dart';
import 'package:uuid/uuid.dart';

final tripTelemetryProvider = Provider<TripTelemetryService>((ref) {
  return TripTelemetryService(client: ref.read(apiClientProvider));
});

class DriverTripScreen extends ConsumerStatefulWidget {
  const DriverTripScreen({super.key, required this.tripId});

  final String tripId;

  @override
  ConsumerState<DriverTripScreen> createState() => _DriverTripScreenState();
}

class _DriverTripScreenState extends ConsumerState<DriverTripScreen> {
  bool _inProgress = false;

  Future<void> _start(WidgetRef ref) {
    return ref.read(apiClientProvider).post<void>('/trips/${widget.tripId}/start');
  }

  Future<void> _end(WidgetRef ref) {
    return ref.read(apiClientProvider).post<void>('/trips/${widget.tripId}/end');
  }

  Future<void> _sendSos(WidgetRef ref) async {
    final payload = <String, Object?>{
      'description': 'SOS from mobile app',
      'location': <String, Object?>{'lat': 0.0, 'lng': 0.0},
    };
    try {
      await ref
          .read(apiClientProvider)
          .post<void>('/trips/${widget.tripId}/sos', data: payload);
    } on DioException {
      await OutboxStore.put(
        OutboxEntry(
          id: const Uuid().v4(),
          endpoint: '/trips/${widget.tripId}/sos',
          method: 'POST',
          body: payload,
          createdAt: DateTime.now().toUtc(),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AsyncValue<WsEvent?>>(wsTripLocationProvider(widget.tripId), (_, next) {
      next.whenData((_) {});
    });
    return Scaffold(
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text('Trip ${widget.tripId}', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () async {
                await _start(ref);
                await ref.read(tripTelemetryProvider).start(widget.tripId);
                if (!mounted) {
                  return;
                }
                setState(() {
                  _inProgress = true;
                });
              },
              child: const Text('Start trip'),
            ),
            ElevatedButton(
              onPressed: () async {
                await _end(ref);
                await ref.read(tripTelemetryProvider).stop();
                if (!mounted) {
                  return;
                }
                setState(() {
                  _inProgress = false;
                });
              },
              child: const Text('End trip'),
            ),
            ElevatedButton(
              onPressed: () => _sendSos(ref),
              child: const Text('SOS'),
            ),
            const SizedBox(height: 12),
            Text(_inProgress ? 'Trip status: in_progress' : 'Trip status: scheduled'),
          ],
        ),
      ),
    );
  }
}
