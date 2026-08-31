import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/core/api/api_error.dart';
import 'package:mobile/core/api/client.dart';
import 'package:mobile/core/api/paginated_response.dart';
import 'package:mobile/core/auth/session.dart';

final driverTripsProvider = FutureProvider<List<Map<String, Object?>>>(
  (ref) async {
    final response = await ref.read(apiClientProvider).get<Map<String, Object?>>(
      '/trips',
      queryParameters: <String, Object?>{'status': 'scheduled'},
    );
    final userId = ref.read(sessionNotifierProvider).value?.user.id;
    return readPaginatedRecords(response.data ?? <String, Object?>{})
        .where((trip) => trip['driverUserId'] == userId)
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
        error: (error, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Icon(
                  Icons.cloud_off_outlined,
                  size: 40,
                  color: Theme.of(context).colorScheme.error,
                ),
                const SizedBox(height: 12),
                Text('Trips could not load', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 4),
                Text(apiErrorMessage(error), textAlign: TextAlign.center),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: () => ref.invalidate(driverTripsProvider),
                  icon: const Icon(Icons.refresh),
                  label: const Text('Try again'),
                ),
              ],
            ),
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          ref.invalidate(driverTripsProvider);
        },
        icon: const Icon(Icons.refresh),
        label: const Text('Refresh trips'),
      ),
    );
  }
}
