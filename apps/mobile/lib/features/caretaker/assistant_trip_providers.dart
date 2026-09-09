import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/api/client.dart';
import 'package:mobile/features/driver/driver_trip_models.dart';

final assistantWorkspaceProvider = FutureProvider<DriverWorkspace>((ref) async {
  final response = await ref
      .read(apiClientProvider)
      .get<Map<String, Object?>>('/trips/assistant-workspace');
  return DriverWorkspace.fromJson(response.data ?? const <String, Object?>{});
});

final assistantTripDetailProvider =
    FutureProvider.family<DriverTripDetail, String>((ref, tripId) async {
  final response = await ref
      .read(apiClientProvider)
      .get<Map<String, Object?>>('/trips/assistant/$tripId');
  return DriverTripDetail.fromJson(response.data ?? const <String, Object?>{});
});
