import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/features/driver/driver_trip_models.dart';
import 'package:mobile/features/driver/driver_trip_providers.dart';
import 'package:mobile/features/driver/trip_time_format.dart';

class DriverRecentTripsScreen extends ConsumerWidget {
  const DriverRecentTripsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final workspaceAsync = ref.watch(driverWorkspaceProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Recent trips')),
      body: workspaceAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => Center(
          child: IconButton(
            tooltip: 'Retry recent trips',
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(driverWorkspaceProvider),
          ),
        ),
        data: (workspace) {
          if (workspace.recentTrips.isEmpty) {
            return const Center(child: Text('No recent trips'));
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: workspace.recentTrips.length,
            separatorBuilder: (_, _) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final trip = workspace.recentTrips[index];
              return _RecentTripRow(summary: trip);
            },
          );
        },
      ),
    );
  }
}

class _RecentTripRow extends StatelessWidget {
  const _RecentTripRow({required this.summary});

  final DriverTripSummary summary;

  @override
  Widget build(BuildContext context) {
    return Material(
      key: Key('driver-recent-trip-${summary.id}'),
      color: Theme.of(context).colorScheme.surfaceContainerLow,
      borderRadius: const BorderRadius.all(Radius.circular(8)),
      child: InkWell(
        borderRadius: const BorderRadius.all(Radius.circular(8)),
        onTap: () => context.push('/driver/trip/${summary.id}'),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: <Widget>[
              const Icon(Icons.history, size: 20),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      summary.route.name,
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: <Widget>[
                        Text(_statusLabel(summary.status)),
                        const Spacer(),
                        if (summary.endedAt != null)
                          Text(
                            formatClockTime(summary.endedAt!),
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right),
            ],
          ),
        ),
      ),
    );
  }
}

String _statusLabel(DriverTripStatus status) => switch (status) {
  DriverTripStatus.completed => 'Completed',
  DriverTripStatus.cancelled => 'Cancelled',
  DriverTripStatus.scheduled => 'Scheduled',
  DriverTripStatus.inProgress => 'In progress',
};
