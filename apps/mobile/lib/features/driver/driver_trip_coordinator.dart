import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/features/driver/driver_trip_providers.dart';
import 'package:mobile/features/driver/driver_trip_screen.dart';

// Keeps background trip telemetry in sync with the driver's real active trip —
// covers cases where telemetry didn't already reflect it (login, app resume).
class DriverTripCoordinator {
  DriverTripCoordinator(this._ref);

  final Ref _ref;
  Future<void>? _inFlight;

  Future<void> sync() {
    final inFlight = _inFlight;
    if (inFlight != null) {
      return inFlight;
    }
    final future = _sync().whenComplete(() => _inFlight = null);
    _inFlight = future;
    return future;
  }

  Future<void> _sync() async {
    final workspace = await _ref.read(driverWorkspaceProvider.future);
    final telemetry = _ref.read(tripTelemetryProvider);
    final activeTrip = workspace.activeTrip;
    if (activeTrip != null) {
      await telemetry.start(activeTrip.id);
    } else {
      await telemetry.stop();
    }
  }
}

final driverTripCoordinatorProvider = Provider<DriverTripCoordinator>((ref) {
  return DriverTripCoordinator(ref);
});
