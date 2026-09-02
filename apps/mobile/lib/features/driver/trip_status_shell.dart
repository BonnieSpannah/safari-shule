import 'package:flutter/material.dart';
import 'package:mobile/features/driver/driver_trip_map.dart';
import 'package:mobile/features/driver/driver_trip_models.dart';

class TripStatusShell extends StatelessWidget {
  const TripStatusShell({
    super.key,
    required this.mapPolicy,
    required this.badgeLabel,
    required this.badgeColor,
    required this.chipsRow,
    required this.bottomPanel,
    this.topBarActions = const <Widget>[],
  });

  final TripMapPolicy mapPolicy;
  final String badgeLabel;
  final Color badgeColor;
  final Widget chipsRow;
  final Widget bottomPanel;
  final List<Widget> topBarActions;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: <Widget>[
        Expanded(
          child: Stack(
            children: <Widget>[
              Positioned.fill(
                child: DriverTripMap(policy: mapPolicy, compact: false),
              ),
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: SafeArea(
                  bottom: false,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    child: Row(
                      children: <Widget>[
                        _CircleIconButton(
                          icon: Icons.arrow_back,
                          tooltip: 'Back to dashboard',
                          onTap: () => Navigator.of(context).maybePop(),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _StatusBadge(
                            label: badgeLabel,
                            color: badgeColor,
                          ),
                        ),
                        const SizedBox(width: 8),
                        ...topBarActions,
                      ],
                    ),
                  ),
                ),
              ),
              Positioned(left: 12, right: 12, top: 64, child: chipsRow),
            ],
          ),
        ),
        bottomPanel,
      ],
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: const BorderRadius.all(Radius.circular(20)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(Icons.circle, size: 10, color: color),
          const SizedBox(width: 6),
          Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class _CircleIconButton extends StatelessWidget {
  const _CircleIconButton({
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: Theme.of(context).colorScheme.surface,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: SizedBox(width: 48, height: 48, child: Icon(icon, size: 22)),
        ),
      ),
    );
  }
}

class InfoChipsRow extends StatelessWidget {
  const InfoChipsRow({
    super.key,
    required this.elapsedLabel,
    required this.vehicleRegistration,
    required this.directionLabel,
    required this.gpsHealthLabel,
  });

  final String elapsedLabel;
  final String? vehicleRegistration;
  final String directionLabel;
  final String gpsHealthLabel;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: <Widget>[
        _InfoChip(text: elapsedLabel),
        _InfoChip(text: vehicleRegistration ?? 'Vehicle unavailable'),
        _InfoChip(text: directionLabel),
        _InfoChip(text: gpsHealthLabel),
      ],
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.text});
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
