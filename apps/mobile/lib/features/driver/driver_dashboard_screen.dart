import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/core/api/api_error.dart';
import 'package:mobile/features/driver/driver_trip_map.dart';
import 'package:mobile/features/driver/driver_trip_models.dart';
import 'package:mobile/features/driver/driver_trip_providers.dart';

// Design tokens
const _cardRadius = BorderRadius.all(Radius.circular(8));
const _actionHeight = 48.0;
const Color _emerald = Color(0xFF10B981);
const Color _amber = Color(0xFFF59E0B);

class DriverDashboardScreen extends ConsumerWidget {
  const DriverDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final workspaceAsync = ref.watch(driverWorkspaceProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('My trips')),
      body: workspaceAsync.when(
        loading: () => workspaceAsync.hasError
            ? _ErrorView(
                message: apiErrorMessage(workspaceAsync.error!),
                onRetry: () => ref.invalidate(driverWorkspaceProvider),
              )
            : _WorkspaceSkeleton(),
        error: (error, _) => _ErrorView(
          message: apiErrorMessage(error),
          onRetry: () => ref.invalidate(driverWorkspaceProvider),
        ),
        data: (workspace) => _WorkspaceContent(workspace: workspace),
      ),
    );
  }
}

// ── Loading skeleton ───────────────────────────────────────────────────────

class _WorkspaceSkeleton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return const SingleChildScrollView(
      key: Key('driver-workspace-skeleton'),
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          _SkeletonCard(height: 260),
          SizedBox(height: 12),
          _SkeletonCard(height: 72),
          SizedBox(height: 12),
          _SkeletonCard(height: 72),
        ],
      ),
    );
  }
}

class _SkeletonCard extends StatelessWidget {
  const _SkeletonCard({required this.height});
  final double height;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: _cardRadius,
      ),
    );
  }
}

// ── Error view ─────────────────────────────────────────────────────────────

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
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
            Text(
              'Trips could not load',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 4),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            Tooltip(
              message: 'Retry',
              child: IconButton.filled(
                key: const Key('driver-workspace-retry'),
                icon: const Icon(Icons.refresh),
                onPressed: onRetry,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Main content ───────────────────────────────────────────────────────────

class _WorkspaceContent extends ConsumerWidget {
  const _WorkspaceContent({required this.workspace});
  final DriverWorkspace workspace;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final active = workspace.activeTrip;
    final upcoming = workspace.upcomingTrips;
    final recent = workspace.recentTrips;
    final hasContent = active != null || upcoming.isNotEmpty || recent.isNotEmpty;

    if (!hasContent) {
      return const _EmptyState();
    }

    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(driverWorkspaceProvider),
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        children: <Widget>[
          if (active != null) ...<Widget>[
            _ActiveTripCard(summary: active),
            const SizedBox(height: 16),
          ] else if (upcoming.isNotEmpty) ...<Widget>[
            _NextTripCard(summary: upcoming.first),
            const SizedBox(height: 16),
          ],
          if (upcoming.isNotEmpty) ...<Widget>[
            const Text(
              'Up next',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
            ),
            const SizedBox(height: 8),
            ...List<Widget>.generate(
              active != null ? upcoming.length : upcoming.length - 1,
              (i) {
                final trip = active != null ? upcoming[i] : upcoming[i + 1];
                return _CompactTripRow(summary: trip);
              },
            ),
            const SizedBox(height: 16),
          ],
          if (recent.isNotEmpty) ...<Widget>[
            _RecentRow(count: recent.length),
          ],
        ],
      ),
    );
  }
}

// ── Empty state ────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(
              Icons.directions_bus_outlined,
              size: 48,
              color: Theme.of(context).colorScheme.outline,
            ),
            const SizedBox(height: 16),
            Text(
              'No trips assigned',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(
              'New assignments will appear here once your\nschool schedules trips for you.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}

// ── Active trip card ───────────────────────────────────────────────────────

class _ActiveTripCard extends ConsumerWidget {
  const _ActiveTripCard({required this.summary});
  final DriverTripSummary summary;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailAsync = ref.watch(driverTripDetailProvider(summary.id));

    return Card(
      key: const Key('driver-active-trip'),
      shape: const RoundedRectangleBorder(borderRadius: _cardRadius),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            const Row(
              children: <Widget>[
                Icon(Icons.circle, size: 10, color: _amber),
                SizedBox(width: 6),
                Text(
                  'In progress',
                  style: TextStyle(
                    color: _amber,
                    fontWeight: FontWeight.w600,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              summary.route.name,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            Text(
              summary.vehicle.registration,
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 10),
            _CompactMapPreview(detailAsync: detailAsync),
            const SizedBox(height: 12),
            SizedBox(
              height: _actionHeight,
              child: FilledButton.icon(
                style: FilledButton.styleFrom(backgroundColor: _emerald),
                icon: const Icon(Icons.play_arrow),
                label: const Text('Resume trip'),
                onPressed: () => context.push('/driver/trip/${summary.id}'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CompactMapPreview extends StatelessWidget {
  const _CompactMapPreview({required this.detailAsync});
  final AsyncValue<DriverTripDetail> detailAsync;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      key: const Key('driver-active-map-preview'),
      height: 160,
      child: ClipRRect(
        borderRadius: _cardRadius,
        child: detailAsync.when(
          loading: () => Container(
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
          ),
          error: (_, _) => Container(
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            child: const Center(
              child: Icon(Icons.map_outlined, color: Colors.grey),
            ),
          ),
          data: (detail) => DriverTripMap(
            policy: TripMapPolicy.from(detail),
            compact: true,
          ),
        ),
      ),
    );
  }
}

// ── Next trip card (no active trip) ───────────────────────────────────────

class _NextTripCard extends StatelessWidget {
  const _NextTripCard({required this.summary});
  final DriverTripSummary summary;

  @override
  Widget build(BuildContext context) {
    final timeLabel = _formatTime(summary.scheduledStart);

    return Card(
      key: const Key('driver-next-trip'),
      shape: const RoundedRectangleBorder(borderRadius: _cardRadius),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Row(
              children: <Widget>[
                const Icon(Icons.schedule, size: 14, color: Colors.grey),
                const SizedBox(width: 4),
                Text(
                  timeLabel,
                  style: const TextStyle(fontSize: 12, color: Colors.grey),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              summary.route.name,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            Text(
              summary.vehicle.registration,
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 10),
            SizedBox(
              height: _actionHeight,
              child: OutlinedButton.icon(
                icon: const Icon(Icons.map_outlined),
                label: const Text('View route'),
                onPressed: () => context.push('/driver/trip/${summary.id}'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Compact upcoming row ───────────────────────────────────────────────────

class _CompactTripRow extends StatelessWidget {
  const _CompactTripRow({required this.summary});
  final DriverTripSummary summary;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: Theme.of(context).colorScheme.surfaceContainerLow,
        borderRadius: _cardRadius,
        child: InkWell(
          borderRadius: _cardRadius,
          onTap: () => context.push('/driver/trip/${summary.id}'),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        summary.route.name,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      Text(
                        _formatTime(summary.scheduledStart),
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, color: Colors.grey),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Recent row ─────────────────────────────────────────────────────────────

class _RecentRow extends StatelessWidget {
  const _RecentRow({required this.count});
  final int count;

  @override
  Widget build(BuildContext context) {
    return Material(
      key: const Key('driver-recent-trips'),
      color: Theme.of(context).colorScheme.surfaceContainerLow,
      borderRadius: _cardRadius,
      child: InkWell(
        borderRadius: _cardRadius,
        onTap: () {},
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          child: Row(
            children: <Widget>[
              const Icon(Icons.history, size: 18, color: Colors.grey),
              const SizedBox(width: 8),
              Text(
                'Recent trips',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const Spacer(),
              const Text(
                'View all',
                style: TextStyle(color: _emerald, fontWeight: FontWeight.w600),
              ),
              const SizedBox(width: 4),
              const Icon(Icons.chevron_right, color: _emerald, size: 18),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Utility ────────────────────────────────────────────────────────────────

String _formatTime(DateTime dt) {
  final local = dt.toLocal();
  final h = local.hour;
  final m = local.minute.toString().padLeft(2, '0');
  final period = h >= 12 ? 'PM' : 'AM';
  final hour12 = h % 12 == 0 ? 12 : h % 12;
  return '$hour12:$m $period';
}
