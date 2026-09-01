import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:mobile/features/driver/driver_trip_models.dart';

/// Renders the planned route (slate-blue) and travelled path (emerald).
///
/// Compact mode: fixed 160 dp height, gestures disabled, no attribution tap.
/// Full mode: fills parent, full interaction enabled.
class DriverTripMap extends StatelessWidget {
  const DriverTripMap({
    super.key,
    required this.policy,
    this.compact = false,
  });

  final TripMapPolicy policy;
  final bool compact;

  static const Color _plannedColor = Color(0xFF5B8DB8); // slate-blue
  static const Color _travelledColor = Color(0xFF10B981); // emerald

  @override
  Widget build(BuildContext context) {
    final plannedLatLngs = policy.plannedPoints
        .map((p) => LatLng(p.lat, p.lng))
        .toList(growable: false);
    final travelledLatLngs = policy.travelledPoints
        .map((p) => LatLng(p.lat, p.lng))
        .toList(growable: false);

    final center = plannedLatLngs.isNotEmpty
        ? plannedLatLngs.first
        : const LatLng(-1.2921, 36.8219);

    final polylines = <Polyline<Object>>[
      if (plannedLatLngs.length >= 2)
        Polyline(
          points: plannedLatLngs,
          color: _plannedColor,
          strokeWidth: compact ? 2.5 : 3.5,
        ),
      if (travelledLatLngs.length >= 2)
        Polyline(
          points: travelledLatLngs,
          color: _travelledColor,
          strokeWidth: compact ? 3.0 : 4.0,
        ),
    ];

    final map = FlutterMap(
      options: MapOptions(
        initialCenter: center,
        initialZoom: compact ? 13.0 : 14.0,
        interactionOptions: InteractionOptions(
          flags: compact ? InteractiveFlag.none : InteractiveFlag.all,
        ),
      ),
      children: <Widget>[
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'ke.co.safarishule.mobile',
        ),
        if (polylines.isNotEmpty) PolylineLayer(polylines: polylines),
      ],
    );

    if (compact) {
      return SizedBox(
        height: 160,
        child: ClipRRect(
          borderRadius: const BorderRadius.all(Radius.circular(8)),
          child: AbsorbPointer(child: map),
        ),
      );
    }
    return map;
  }
}
