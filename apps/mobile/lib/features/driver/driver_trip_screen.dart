import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/api/client.dart';
import 'package:mobile/core/offline/outbox.dart';
import 'package:mobile/core/telemetry/trip_telemetry_service.dart';
import 'package:mobile/features/driver/driver_trip_models.dart';
import 'package:mobile/features/driver/driver_trip_providers.dart';
import 'package:mobile/features/driver/trip_status_shell.dart';
import 'package:mobile/features/driver/trip_time_format.dart';
import 'package:uuid/uuid.dart';

const Color _rose = Color(0xFFE11D48);

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
  DriverTripDetail? _confirmedDetail;

  Future<void> _sendSos(WidgetRef ref) async {
    final location = ref.read(tripTelemetryProvider).lastKnownLocation;
    final payload = <String, Object?>{
      'description': 'SOS from mobile app',
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
    final detailAsync = ref.watch(driverTripDetailProvider(widget.tripId));
    final detail =
        _confirmedDetail ??
        detailAsync.when(
          data: (value) => value,
          loading: () => null,
          error: (_, _) => null,
        );
    return Scaffold(
      body: detail == null
          ? detailAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (_, _) => Center(
                child: IconButton(
                  tooltip: 'Retry trip details',
                  icon: const Icon(Icons.refresh),
                  onPressed: () =>
                      ref.invalidate(driverTripDetailProvider(widget.tripId)),
                ),
              ),
              data: (_) => const SizedBox.shrink(),
            )
          : _TripDetailContent(
              detail: detail,
              onStart: () async {
                final confirmedDetail = await ref.read(startDriverTripProvider)(
                  widget.tripId,
                );
                await ref.read(tripTelemetryProvider).start(confirmedDetail.id);
                if (mounted) setState(() => _confirmedDetail = confirmedDetail);
              },
              onEnd: () async {
                final confirmedDetail = await ref.read(endDriverTripProvider)(
                  widget.tripId,
                );
                if (confirmedDetail.status == DriverTripStatus.completed) {
                  await ref.read(tripTelemetryProvider).stop();
                }
                if (mounted) setState(() => _confirmedDetail = confirmedDetail);
              },
              onSendSos: () => _sendSos(ref),
            ),
    );
  }
}

class _TripDetailContent extends StatelessWidget {
  const _TripDetailContent({
    required this.detail,
    required this.onStart,
    required this.onEnd,
    required this.onSendSos,
  });

  final DriverTripDetail detail;
  final Future<void> Function() onStart;
  final Future<void> Function() onEnd;
  final VoidCallback onSendSos;

  @override
  Widget build(BuildContext context) {
    return switch (detail.status) {
      DriverTripStatus.scheduled =>
        _ScheduledTripView(detail: detail, onStart: onStart),
      DriverTripStatus.inProgress =>
        _InProgressTripView(detail: detail, onEnd: onEnd, onSendSos: onSendSos),
      DriverTripStatus.completed => _CompletedTripView(detail: detail),
      DriverTripStatus.cancelled => _CancelledTripView(detail: detail),
    };
  }
}

class _ScheduledTripView extends StatelessWidget {
  const _ScheduledTripView({required this.detail, required this.onStart});

  final DriverTripDetail detail;
  final Future<void> Function() onStart;

  @override
  Widget build(BuildContext context) {
    return TripStatusShell(
      mapPolicy: TripMapPolicy.from(detail),
      badgeLabel: 'Scheduled',
      badgeColor: Theme.of(context).colorScheme.primary,
      chipsRow: _ScheduledInfoColumn(detail: detail),
      bottomPanel: _ScheduledBottomPanel(detail: detail, onStart: onStart),
    );
  }
}

class _ScheduledInfoColumn extends StatelessWidget {
  const _ScheduledInfoColumn({required this.detail});

  final DriverTripDetail detail;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            borderRadius: const BorderRadius.all(Radius.circular(16)),
          ),
          child: Text(
            detail.routeName,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: <Widget>[
            _TripInfoChip(text: formatTripSchedule(detail.scheduledStart)),
            _TripInfoChip(
              text: 'Passengers expected: ${detail.passengerSummary.expected}',
            ),
            _TripInfoChip(text: formatTripDirection(detail.direction)),
          ],
        ),
      ],
    );
  }
}

class _TripInfoChip extends StatelessWidget {
  const _TripInfoChip({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: const BorderRadius.all(Radius.circular(16)),
      ),
      child: Text(text, style: Theme.of(context).textTheme.bodySmall),
    );
  }
}

class _ScheduledBottomPanel extends StatelessWidget {
  const _ScheduledBottomPanel({required this.detail, required this.onStart});

  final DriverTripDetail detail;
  final Future<void> Function() onStart;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Theme.of(context).colorScheme.surface,
      elevation: 8,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: SizedBox(
            height: 48,
            child: FilledButton(
              onPressed: () async {
                final confirmed = await showModalBottomSheet<bool>(
                  context: context,
                  builder: (sheetContext) =>
                      _StartTripConfirmationSheet(detail: detail),
                );
                if (confirmed == true) await onStart();
              },
              child: const Text('Start trip'),
            ),
          ),
        ),
      ),
    );
  }
}

// Its own widget so Phase C can extend it with student-onboarding UI without
// touching the caller.
class _StartTripConfirmationSheet extends StatelessWidget {
  const _StartTripConfirmationSheet({required this.detail});

  final DriverTripDetail detail;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(
            'Confirm start trip',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Text(detail.routeName),
          Text('Passengers expected: ${detail.passengerSummary.expected}'),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Confirm start'),
          ),
        ],
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
          _TripInfoChip(
            text: duration != null
                ? '${duration.inMinutes} min'
                : 'Duration unavailable',
          ),
          _TripInfoChip(
            text: detail.vehicle?.registration ?? 'Vehicle unavailable',
          ),
          _TripInfoChip(text: formatTripDirection(detail.direction)),
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
          _TripInfoChip(text: formatTripSchedule(detail.scheduledStart)),
          _TripInfoChip(text: formatTripDirection(detail.direction)),
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

// Loading and retry states are handled above in DriverTripScreen before
// _TripDetailContent is ever built; every DriverTripStatus value has its
// own view here, dispatched exhaustively in _TripDetailContent.build().
class _InProgressTripView extends StatelessWidget {
  const _InProgressTripView({
    required this.detail,
    required this.onEnd,
    required this.onSendSos,
  });

  static const Color _amber = Color(0xFFF59E0B);

  final DriverTripDetail detail;
  final Future<void> Function() onEnd;
  final VoidCallback onSendSos;

  @override
  Widget build(BuildContext context) {
    final latest = detail.latestSnapshot;
    return TripStatusShell(
      mapPolicy: TripMapPolicy.from(detail),
      badgeLabel: 'In progress',
      badgeColor: _amber,
      topBarActions: <Widget>[_SosButton(onPressed: onSendSos)],
      chipsRow: InfoChipsRow(
        elapsedLabel: detail.startedAt != null
            ? formatTripStarted(detail.startedAt!)
            : 'Elapsed time unavailable',
        vehicleRegistration: detail.vehicle?.registration,
        directionLabel: formatTripDirection(detail.direction),
        gpsHealthLabel: formatGpsHealth(latest?.recordedAt),
      ),
      bottomPanel: _InProgressBottomPanel(detail: detail, onEnd: onEnd),
    );
  }
}

class _SosButton extends StatelessWidget {
  const _SosButton({required this.onPressed});
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Send SOS emergency alert',
      button: true,
      child: FilledButton.icon(
        style: FilledButton.styleFrom(
          backgroundColor: _rose,
          minimumSize: const Size(64, 48),
        ),
        onPressed: onPressed,
        icon: const Icon(Icons.warning_amber_rounded),
        label: const Text('SOS'),
      ),
    );
  }
}

class _InProgressBottomPanel extends StatefulWidget {
  const _InProgressBottomPanel({required this.detail, required this.onEnd});

  final DriverTripDetail detail;
  final Future<void> Function() onEnd;

  @override
  State<_InProgressBottomPanel> createState() => _InProgressBottomPanelState();
}

class _InProgressBottomPanelState extends State<_InProgressBottomPanel> {
  bool _expanded = true;

  Future<void> _confirmEnd(BuildContext context) async {
    final onBoard = widget.detail.passengerSummary.onBoard;
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      builder: (sheetContext) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text(
              'Confirm end trip',
              style: Theme.of(sheetContext).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(widget.detail.routeName),
            if (onBoard > 0) ...<Widget>[
              const SizedBox(height: 12),
              Text(
                '$onBoard ${onBoard == 1 ? 'passenger is' : 'passengers are'} still on board.',
                style: TextStyle(
                  color: Theme.of(sheetContext).colorScheme.error,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () => Navigator.of(sheetContext).pop(true),
              child: const Text('Confirm end'),
            ),
          ],
        ),
      ),
    );
    if (confirmed == true) await widget.onEnd();
  }

  @override
  Widget build(BuildContext context) {
    final detail = widget.detail;
    return Material(
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
                child: FilledButton.icon(
                  onPressed: () => _confirmEnd(context),
                  icon: const Icon(Icons.flag_outlined),
                  label: const Text('End trip'),
                ),
              ),
              const SizedBox(height: 8),
              InkWell(
                onTap: () => setState(() => _expanded = !_expanded),
                child: Row(
                  children: <Widget>[
                    Text(
                      'Trip details',
                      style: Theme.of(
                        context,
                      ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                    ),
                    const Spacer(),
                    Icon(_expanded ? Icons.expand_less : Icons.expand_more),
                  ],
                ),
              ),
              if (_expanded) ...<Widget>[
                const Divider(height: 20),
                if (detail.assistant != null)
                  _DetailRow(label: 'Assistant', value: detail.assistant!.fullName),
                const SizedBox(height: 8),
                _PassengerBreakdown(summary: detail.passengerSummary),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: <Widget>[
          Text(label, style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(width: 8),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _PassengerBreakdown extends StatelessWidget {
  const _PassengerBreakdown({required this.summary});
  final PassengerSummary summary;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        Expanded(child: _CountTile(label: 'Expected', value: summary.expected)),
        Expanded(child: _CountTile(label: 'Boarded', value: summary.boarded)),
        Expanded(child: _CountTile(label: 'On board', value: summary.onBoard)),
        Expanded(child: _CountTile(label: 'Alighted', value: summary.alighted)),
      ],
    );
  }
}

class _CountTile extends StatelessWidget {
  const _CountTile({required this.label, required this.value});
  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: <Widget>[
        Text(
          '$value',
          style: Theme.of(
            context,
          ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
        ),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}

