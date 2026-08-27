// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'session_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_SessionUser _$SessionUserFromJson(Map<String, dynamic> json) => _SessionUser(
  id: json['id'] as String,
  email: json['email'] as String,
  fullName: json['fullName'] as String,
  roles:
      (json['roles'] as List<dynamic>?)?.map((e) => e as String).toList() ??
      const <String>[],
);

Map<String, dynamic> _$SessionUserToJson(_SessionUser instance) =>
    <String, dynamic>{
      'id': instance.id,
      'email': instance.email,
      'fullName': instance.fullName,
      'roles': instance.roles,
    };

_ImpersonationState _$ImpersonationStateFromJson(Map<String, dynamic> json) =>
    _ImpersonationState(
      impersonatedUserEmail: json['impersonatedUserEmail'] as String,
      approverEmail: json['approverEmail'] as String,
      sessionId: json['sessionId'] as String,
    );

Map<String, dynamic> _$ImpersonationStateToJson(_ImpersonationState instance) =>
    <String, dynamic>{
      'impersonatedUserEmail': instance.impersonatedUserEmail,
      'approverEmail': instance.approverEmail,
      'sessionId': instance.sessionId,
    };

_Session _$SessionFromJson(Map<String, dynamic> json) => _Session(
  accessToken: json['accessToken'] as String,
  refreshToken: json['refreshToken'] as String,
  tenantSlug: json['tenantSlug'] as String,
  user: SessionUser.fromJson(json['user'] as Map<String, dynamic>),
  impersonation: json['impersonation'] == null
      ? null
      : ImpersonationState.fromJson(
          json['impersonation'] as Map<String, dynamic>,
        ),
);

Map<String, dynamic> _$SessionToJson(_Session instance) => <String, dynamic>{
  'accessToken': instance.accessToken,
  'refreshToken': instance.refreshToken,
  'tenantSlug': instance.tenantSlug,
  'user': instance.user,
  'impersonation': instance.impersonation,
};
