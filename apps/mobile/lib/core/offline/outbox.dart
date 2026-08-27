import 'dart:convert';

import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:hive/hive.dart';

part 'outbox.freezed.dart';
part 'outbox.g.dart';

@freezed
abstract class OutboxEntry with _$OutboxEntry {
  const factory OutboxEntry({
    required String id,
    required String endpoint,
    required String method,
    required Map<String, Object?> body,
    required DateTime createdAt,
    @Default(0) int attempts,
  }) = _OutboxEntry;

  factory OutboxEntry.fromJson(Map<String, Object?> json) =>
      _$OutboxEntryFromJson(json);
}

class OutboxStore {
  OutboxStore._();

  static const boxName = 'mobile_outbox';

  static Future<Box<String>> open() {
    if (Hive.isBoxOpen(boxName)) {
      return Future.value(Hive.box<String>(boxName));
    }
    return Hive.openBox<String>(boxName);
  }

  static Future<List<OutboxEntry>> all() async {
    final box = await open();
    return box.values.map((raw) {
      final decoded = jsonDecode(raw);
      final payload = Map<String, Object?>.from(decoded as Map);
      return OutboxEntry.fromJson(payload);
    }).toList(growable: false);
  }

  static Future<void> put(OutboxEntry entry) async {
    final box = await open();
    await box.put(entry.id, jsonEncode(entry.toJson()));
  }

  static Future<void> delete(String id) async {
    final box = await open();
    await box.delete(id);
  }
}
