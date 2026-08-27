import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/core/api/client.dart';

final driverTripsProvider = FutureProvider<List<Map<String, Object?>>>(
  (ref) async {
    final response = await ref.read(apiClientProvider).get<Map<String, Object?>>(
      '/trips',
      queryParameters: <String, Object?>{'status': 'scheduled'},
    );
    final items = response.data?['items'];
    if (items is! List) {
      return const <Map<String, Object?>>[];
    }
    return items
        .whereType<Map<Object?, Object?>>()
        .map((item) => Map<String, Object?>.from(item))
        .toList(growable: false);
  },
);

class DriverDashboardScreen extends ConsumerWidget {
  const DriverDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final trips = ref.watch(driverTripsProvider);
    return Scaffold(
      body: trips.when(
        data: (items) {
          if (items.isEmpty) {
            return const Center(child: Text('No scheduled trips'));
          }
          return ListView.builder(
            itemCount: items.length,
            itemBuilder: (context, index) {
              final trip = items[index];
              final id = (trip['id'] as String?) ?? '';
              return ListTile(
                title: Text('Trip $id'),
                subtitle: Text((trip['status'] as String?) ?? 'scheduled'),
                onTap: () => context.push('/driver/trip/$id'),
              );
            },
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('Failed to load trips: $error')),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          ref.invalidate(driverTripsProvider);
        },
        icon: const Icon(Icons.play_arrow),
        label: const Text('Start shift'),
      ),
    );
  }
}
