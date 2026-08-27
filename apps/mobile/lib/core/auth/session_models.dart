import 'package:freezed_annotation/freezed_annotation.dart';

part 'session_models.freezed.dart';
part 'session_models.g.dart';

@freezed
abstract class SessionUser with _$SessionUser {
  const factory SessionUser({
    required String id,
    required String email,
    required String fullName,
    @Default(<String>[]) List<String> roles,
  }) = _SessionUser;

  factory SessionUser.fromJson(Map<String, Object?> json) =>
      _$SessionUserFromJson(json);
}

@freezed
abstract class ImpersonationState with _$ImpersonationState {
  const factory ImpersonationState({
    required String impersonatedUserEmail,
    required String approverEmail,
    required String sessionId,
  }) = _ImpersonationState;

  factory ImpersonationState.fromJson(Map<String, Object?> json) =>
      _$ImpersonationStateFromJson(json);
}

@freezed
abstract class Session with _$Session {
  const Session._();

  const factory Session({
    required String accessToken,
    required String refreshToken,
    required String tenantSlug,
    required SessionUser user,
    ImpersonationState? impersonation,
  }) = _Session;

  bool get isAuthenticated => accessToken.isNotEmpty;

  factory Session.fromJson(Map<String, Object?> json) => _$SessionFromJson(json);
}
