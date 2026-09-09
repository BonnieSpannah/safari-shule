import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/core/api/api_error.dart';
import 'package:mobile/features/caretaker/assistant_trip_providers.dart';
import 'package:mobile/features/driver/driver_trip_models.dart';
import 'package:mobile/features/driver/trip_time_format.dart';

String _statusLabel(DriverTripStatus status) => switch (status) {
  DriverTripStatus.completed => 'Completed',
  DriverTripStatus.cancelled => 'Cancelled',
  DriverTripStatus.scheduled => 'Scheduled',
  DriverTripStatus.inProgress => 'In progress',
};

class AssistantDashboardScreen extends ConsumerWidget {
  const AssistantDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final workspaceAsync = ref.watch(assistantWorkspaceProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('My assigned trip')),
      body: workspaceAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              const Icon(Icons.cloud_off_outlined, size: 40),
              const SizedBox(height: 12),
              Text('Trip could not load', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 6),
              Text(apiErrorMessage(error), textAlign: TextAlign.center),
              const SizedBox(height: 12),
              IconButton.filled(
                onPressed: () => ref.invalidate(assistantWorkspaceProvider),
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
        ),
        data: (workspace) {
          final activeTrip = workspace.activeTrip;
          if (activeTrip == null) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text('No trip assigned yet. Check back when your route is scheduled.'),
              ),
            );
          }

          return Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Row(
                          children: <Widget>[
                            Expanded(
                              child: Text(
                                activeTrip.route.name,
                                style: Theme.of(context).textTheme.titleLarge,
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: Theme.of(context).colorScheme.primaryContainer,
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                _statusLabel(activeTrip.status),
                                style: Theme.of(context).textTheme.labelLarge,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text('Vehicle: ${activeTrip.vehicle.registration}'),
                        Text('Direction: ${formatTripDirection(activeTrip.direction)}'),
                        Text('Passengers: ${activeTrip.passengerCount}'),
                        const SizedBox(height: 16),
                        FilledButton.icon(
                          onPressed: () => context.go('/assistant/trip/${activeTrip.id}'),
                          icon: const Icon(Icons.route_outlined),
                          label: const Text('Open trip'),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
