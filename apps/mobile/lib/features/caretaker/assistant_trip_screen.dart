import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/api/client.dart';
import 'package:mobile/core/offline/outbox.dart';
import 'package:mobile/features/caretaker/assistant_trip_providers.dart';
import 'package:mobile/features/driver/driver_trip_models.dart';
import 'package:mobile/features/driver/driver_trip_providers.dart';
import 'package:mobile/features/driver/driver_trip_screen.dart' show tripTelemetryProvider;
import 'package:mobile/features/driver/student_lookup_sheet.dart';
import 'package:mobile/features/driver/trip_status_shell.dart';
import 'package:mobile/features/driver/trip_time_format.dart';
import 'package:uuid/uuid.dart';

const Color _rose = Color(0xFFE11D48);

class AssistantTripScreen extends ConsumerStatefulWidget {
  const AssistantTripScreen({super.key, required this.tripId});

  final String tripId;

  @override
  ConsumerState<AssistantTripScreen> createState() => _AssistantTripScreenState();
}

class _AssistantTripScreenState extends ConsumerState<AssistantTripScreen> {
  Future<void> _sendSos(WidgetRef ref) async {
    final location = ref.read(tripTelemetryProvider).lastKnownLocation;
    final payload = <String, Object?>{
      'description': 'SOS from assistant mobile app',
      if (location != null)
        'location': <String, Object?>{'lat': location.lat, 'lng': location.lng},
    };
    try {
      await ref
          .read(apiClientProvider)
          .post<void>('/trips/${widget.tripId}/sos', data: payload);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('SOS sent')));
    } catch (_) {
      await OutboxStore.put(
        OutboxEntry(
          id: const Uuid().v4(),
          endpoint: '/trips/${widget.tripId}/sos',
          method: 'POST',
          body: payload,
          createdAt: DateTime.now().toUtc(),
        ),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('SOS queued — will resend when back online'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final detailAsync = ref.watch(assistantTripDetailProvider(widget.tripId));
    final detail = detailAsync.value;
    if (detail == null) {
      return Scaffold(
        body: detailAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, _) => Center(
            child: IconButton(
              tooltip: 'Retry trip details',
              icon: const Icon(Icons.refresh),
              onPressed: () => ref.invalidate(assistantTripDetailProvider(widget.tripId)),
            ),
          ),
          data: (_) => const SizedBox.shrink(),
        ),
      );
    }

    return Scaffold(
      body: _TripDetailContent(
        detail: detail,
        onSendSos: () => _sendSos(ref),
      ),
    );
  }
}

class _TripDetailContent extends StatelessWidget {
  const _TripDetailContent({
    required this.detail,
    required this.onSendSos,
  });

  final DriverTripDetail detail;
  final VoidCallback onSendSos;

  @override
  Widget build(BuildContext context) {
    return switch (detail.status) {
      DriverTripStatus.scheduled => _ScheduledTripView(
          detail: detail,
          onSendSos: onSendSos,
        ),
      DriverTripStatus.inProgress => _InProgressTripView(
          detail: detail,
          onSendSos: onSendSos,
        ),
      DriverTripStatus.completed => _CompletedTripView(detail: detail),
      DriverTripStatus.cancelled => _CancelledTripView(detail: detail),
    };
  }
}

class _ScheduledTripView extends StatelessWidget {
  const _ScheduledTripView({required this.detail, required this.onSendSos});

  final DriverTripDetail detail;
  final VoidCallback onSendSos;

  @override
  Widget build(BuildContext context) {
    return TripStatusShell(
      mapPolicy: TripMapPolicy.from(detail),
      badgeLabel: 'Scheduled',
      badgeColor: Theme.of(context).colorScheme.primary,
      chipsRow: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: <Widget>[
          InfoChip(text: formatTripSchedule(detail.scheduledStart)),
          InfoChip(text: 'Passengers expected: ${detail.passengerSummary.expected}'),
          InfoChip(text: formatTripDirection(detail.direction)),
        ],
      ),
      bottomPanel: Material(
        color: Theme.of(context).colorScheme.surface,
        elevation: 8,
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: SizedBox(
              height: 48,
              child: FilledButton.icon(
                onPressed: onSendSos,
                icon: const Icon(Icons.warning_amber_rounded),
                label: const Text('SOS'),
              ),
            ),
          ),
        ),
      ),
      topBarActions: <Widget>[
        FilledButton.icon(
          style: FilledButton.styleFrom(
            backgroundColor: _rose,
            minimumSize: const Size(64, 48),
          ),
          onPressed: onSendSos,
          icon: const Icon(Icons.warning_amber_rounded),
          label: const Text('SOS'),
        ),
      ],
    );
  }
}

class _InProgressTripView extends ConsumerWidget {
  const _InProgressTripView({required this.detail, required this.onSendSos});

  final DriverTripDetail detail;
  final VoidCallback onSendSos;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final latest = detail.latestSnapshot;
    return TripStatusShell(
      mapPolicy: TripMapPolicy.from(detail),
      badgeLabel: 'In progress',
      badgeColor: const Color(0xFFF59E0B),
      topBarActions: <Widget>[
        FilledButton.icon(
          style: FilledButton.styleFrom(
            backgroundColor: _rose,
            minimumSize: const Size(64, 48),
          ),
          onPressed: onSendSos,
          icon: const Icon(Icons.warning_amber_rounded),
          label: const Text('SOS'),
        ),
      ],
      chipsRow: InfoChipsRow(
        elapsedLabel: detail.startedAt != null
            ? formatTripStarted(detail.startedAt!)
            : 'Elapsed time unavailable',
        vehicleRegistration: detail.vehicle?.registration,
        directionLabel: formatTripDirection(detail.direction),
        gpsHealthLabel: formatGpsHealth(latest?.recordedAt),
      ),
      bottomPanel: Material(
        color: Theme.of(context).colorScheme.surface,
        elevation: 8,
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                SizedBox(
                  height: 48,
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.person_add_alt_1),
                    label: const Text('Board student'),
                    onPressed: () => showModalBottomSheet<bool>(
                      context: context,
                      isScrollControlled: true,
                      builder: (_) => StudentLookupSheet(
                        title: 'Board student',
                        onSubmit: (admissionNumber) =>
                            ref.read(boardStudentProvider)(detail.id, admissionNumber),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  height: 48,
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.person_remove_alt_1),
                    label: const Text('Alight student'),
                    onPressed: () => showModalBottomSheet<bool>(
                      context: context,
                      isScrollControlled: true,
                      builder: (_) => StudentLookupSheet(
                        title: 'Alight student',
                        onSubmit: (admissionNumber) =>
                            ref.read(alightStudentProvider)(detail.id, admissionNumber),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CompletedTripView extends StatelessWidget {
  const _CompletedTripView({required this.detail});

  final DriverTripDetail detail;

  @override
  Widget build(BuildContext context) {
    final duration = (detail.startedAt != null && detail.endedAt != null)
        ? detail.endedAt!.difference(detail.startedAt!)
        : null;
    return TripStatusShell(
      mapPolicy: TripMapPolicy.from(detail),
      badgeLabel: 'Completed',
      badgeColor: Colors.green,
      chipsRow: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: <Widget>[
          InfoChip(
            text: duration != null
                ? '${duration.inMinutes} min'
                : 'Duration unavailable',
          ),
          InfoChip(text: detail.vehicle?.registration ?? 'Vehicle unavailable'),
          InfoChip(text: formatTripDirection(detail.direction)),
        ],
      ),
      bottomPanel: Material(
        color: Theme.of(context).colorScheme.surface,
        elevation: 8,
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: _CountTile(
                    label: 'Boarded',
                    value: detail.passengerSummary.boarded,
                  ),
                ),
                Expanded(
                  child: _CountTile(
                    label: 'Alighted',
                    value: detail.passengerSummary.alighted,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CancelledTripView extends StatelessWidget {
  const _CancelledTripView({required this.detail});

  final DriverTripDetail detail;

  @override
  Widget build(BuildContext context) {
    return TripStatusShell(
      mapPolicy: TripMapPolicy.from(detail),
      badgeLabel: 'Cancelled',
      badgeColor: Colors.redAccent,
      chipsRow: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: <Widget>[
          InfoChip(text: formatTripSchedule(detail.scheduledStart)),
          InfoChip(text: formatTripDirection(detail.direction)),
        ],
      ),
      bottomPanel: Material(
        color: Theme.of(context).colorScheme.surface,
        elevation: 8,
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              (detail.cancellationReason?.isNotEmpty ?? false)
                  ? 'Cancelled: ${detail.cancellationReason}'
                  : 'This trip was cancelled.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ),
      ),
    );
  }
}

class _CountTile extends StatelessWidget {
  const _CountTile({required this.label, required this.value});

  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 4),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: <Widget>[
          Text(label, style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 4),
          Text('$value', style: Theme.of(context).textTheme.titleLarge),
        ],
      ),
    );
  }
}
