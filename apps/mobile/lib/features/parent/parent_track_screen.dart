import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';
import 'package:mobile/core/api/client.dart';
import 'package:mobile/core/realtime/ws_gateway.dart';

class ParentTrackScreen extends ConsumerStatefulWidget {
  const ParentTrackScreen({super.key, required this.childId});

  final String childId;

  @override
  ConsumerState<ParentTrackScreen> createState() => _ParentTrackScreenState();
}

class _ParentTrackScreenState extends ConsumerState<ParentTrackScreen> {
  Timer? _pollTimer;
  LatLng _location = const LatLng(-1.2921, 36.8219);

  @override
  void initState() {
    super.initState();
    _pollTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      _pollFallback();
    });
  }

  Future<void> _pollFallback() async {
    final response = await ref
        .read(apiClientProvider)
        .get<Map<String, Object?>>('/trips/${widget.childId}');
    final loc = response.data?['currentLocation'];
    if (loc is Map<String, Object?>) {
      final lat = loc['lat'];
      final lng = loc['lng'];
      if (lat is num && lng is num) {
        if (!mounted) {
          return;
        }
        setState(() {
          _location = LatLng(lat.toDouble(), lng.toDouble());
        });
      }
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AsyncValue<WsEvent?>>(wsTripLocationProvider(widget.childId), (_, next) {
      next.whenData((event) {
        if (event == null || !mounted) {
          return;
        }
        setState(() {
          _location = LatLng(event.lat, event.lng);
        });
      });
    });

    return Column(
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.all(8),
          child: Text(
            'Bus at ${_location.latitude.toStringAsFixed(4)}, ${_location.longitude.toStringAsFixed(4)}',
            key: const Key('track-coordinates'),
          ),
        ),
        Expanded(
          child: FlutterMap(
            options: MapOptions(initialCenter: _location, initialZoom: 14),
            children: <Widget>[
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'ke.co.safarishule.mobile',
              ),
              MarkerLayer(markers: <Marker>[
                Marker(
                  point: _location,
                  width: 44,
                  height: 44,
                  child: const Icon(Icons.directions_bus, color: Colors.blue, size: 32),
                ),
              ]),
            ],
          ),
        ),
      ],
    );
  }
}
