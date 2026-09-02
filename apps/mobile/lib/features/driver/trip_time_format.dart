// Shared human-readable time/direction/GPS-health formatting for driver trip UI.

String formatClockTime(DateTime dt) {
  final local = dt.toLocal();
  final h = local.hour;
  final m = local.minute.toString().padLeft(2, '0');
  final period = h >= 12 ? 'PM' : 'AM';
  final hour12 = h % 12 == 0 ? 12 : h % 12;
  return '$hour12:$m $period';
}

String formatTripSchedule(DateTime scheduledStart, {DateTime? now}) {
  final localStart = scheduledStart.toLocal();
  final localNow = (now ?? DateTime.now()).toLocal();
  final startDay = DateTime(localStart.year, localStart.month, localStart.day);
  final today = DateTime(localNow.year, localNow.month, localNow.day);
  final dayDifference = startDay.difference(today).inDays;
  final time = formatClockTime(localStart);

  return switch (dayDifference) {
    -1 => 'Yesterday $time',
    0 => 'Today $time',
    1 => 'Tomorrow $time',
    _ =>
      '${localStart.day} ${_monthName(localStart.month)} ${localStart.year}, $time',
  };
}

String formatTripStarted(DateTime startedAt, {DateTime? now}) {
  final localStart = startedAt.toLocal();
  final elapsed = (now ?? DateTime.now()).toLocal().difference(localStart);
  final minutes = elapsed.inMinutes;
  if (minutes < 60) return 'Started ${minutes.clamp(0, 59)} min ago';
  final hours = elapsed.inHours;
  if (hours < 24) return 'Started $hours hr ago';
  return 'Started ${elapsed.inDays} days ago, ${formatClockTime(localStart)}';
}

String formatTripDirection(String direction) {
  if (direction.isEmpty) return 'Direction unavailable';
  return direction[0].toUpperCase() +
      direction.substring(1).replaceAll('_', ' ');
}

// Reports GPS freshness, not trip status; a stale/missing fix must never imply the trip stopped.
String formatGpsHealth(DateTime? lastRecordedAt, {DateTime? now}) {
  if (lastRecordedAt == null) return 'Location unavailable';
  final age = (now ?? DateTime.now()).toUtc().difference(
    lastRecordedAt.toUtc(),
  );
  if (age.isNegative || age.inSeconds < 90) return 'GPS live';
  if (age.inMinutes < 15) return 'GPS ${age.inMinutes} min ago';
  return 'GPS stale · ${age.inMinutes} min ago';
}

String _monthName(int month) => const <String>[
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
][month - 1];
