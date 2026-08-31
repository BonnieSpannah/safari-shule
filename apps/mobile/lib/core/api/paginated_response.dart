List<Map<String, Object?>> readPaginatedRecords(Map<String, Object?> payload) {
  final rawRecords = payload['data'];
  if (rawRecords is! List) {
    return const <Map<String, Object?>>[];
  }

  return rawRecords
      .whereType<Map<Object?, Object?>>()
      .map(Map<String, Object?>.from)
      .toList(growable: false);
}
