import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/api/client.dart';
import 'package:mobile/features/driver/driver_trip_models.dart';

// Thrown when a start is rejected because another trip is already active.
class ActiveTripConflict implements Exception {
  const ActiveTripConflict({required this.activeTripId});

  final String activeTripId;

  @override
  String toString() => 'ActiveTripConflict: activeTripId=$activeTripId';
}

final driverWorkspaceProvider = FutureProvider<DriverWorkspace>((ref) async {
  final response = await ref
      .read(apiClientProvider)
      .get<Map<String, Object?>>('/trips/driver-workspace');
  return DriverWorkspace.fromJson(response.data ?? const <String, Object?>{});
});

final driverTripDetailProvider =
    FutureProvider.family<DriverTripDetail, String>((ref, tripId) async {
  final response = await ref
      .read(apiClientProvider)
      .get<Map<String, Object?>>('/trips/driver/$tripId');
  return DriverTripDetail.fromJson(response.data ?? const <String, Object?>{});
});

// Starts a trip and returns the refreshed detail. Invalidates workspace + detail on success.
// Throws [ActiveTripConflict] if the server rejects with TRIP_ALREADY_ACTIVE.
final startDriverTripProvider =
    Provider<Future<DriverTripDetail> Function(String)>((ref) {
  return (String tripId) async {
    try {
      final response = await ref
          .read(apiClientProvider)
          .post<Map<String, Object?>>('/trips/$tripId/driver-start');
      final detail = DriverTripDetail.fromJson(
        response.data ?? const <String, Object?>{},
      );
      ref.invalidate(driverWorkspaceProvider);
      ref.invalidate(driverTripDetailProvider(tripId));
      return detail;
    } on DioException catch (e) {
      final data = e.response?.data;
      if (data is Map<Object?, Object?>) {
        final code = data['code'];
        final activeTripId = data['activeTripId'];
        if (code == 'TRIP_ALREADY_ACTIVE' && activeTripId is String) {
          throw ActiveTripConflict(activeTripId: activeTripId);
        }
      }
      rethrow;
    }
  };
});

// Ends a trip and returns the refreshed detail. Invalidates workspace + detail on success.
final endDriverTripProvider =
    Provider<Future<DriverTripDetail> Function(String)>((ref) {
  return (String tripId) async {
    final response = await ref
        .read(apiClientProvider)
        .post<Map<String, Object?>>('/trips/$tripId/driver-end');
    final detail = DriverTripDetail.fromJson(
      response.data ?? const <String, Object?>{},
    );
    ref.invalidate(driverWorkspaceProvider);
    ref.invalidate(driverTripDetailProvider(tripId));
    return detail;
  };
});
