// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'outbox.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_OutboxEntry _$OutboxEntryFromJson(Map<String, dynamic> json) => _OutboxEntry(
  id: json['id'] as String,
  endpoint: json['endpoint'] as String,
  method: json['method'] as String,
  body: json['body'] as Map<String, dynamic>,
  createdAt: DateTime.parse(json['createdAt'] as String),
  attempts: (json['attempts'] as num?)?.toInt() ?? 0,
);

Map<String, dynamic> _$OutboxEntryToJson(_OutboxEntry instance) =>
    <String, dynamic>{
      'id': instance.id,
      'endpoint': instance.endpoint,
      'method': instance.method,
      'body': instance.body,
      'createdAt': instance.createdAt.toIso8601String(),
      'attempts': instance.attempts,
    };
