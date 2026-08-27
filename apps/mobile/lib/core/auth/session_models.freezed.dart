// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'session_models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$SessionUser {

 String get id; String get email; String get fullName; List<String> get roles;
/// Create a copy of SessionUser
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SessionUserCopyWith<SessionUser> get copyWith => _$SessionUserCopyWithImpl<SessionUser>(this as SessionUser, _$identity);

  /// Serializes this SessionUser to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SessionUser&&(identical(other.id, id) || other.id == id)&&(identical(other.email, email) || other.email == email)&&(identical(other.fullName, fullName) || other.fullName == fullName)&&const DeepCollectionEquality().equals(other.roles, roles));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,email,fullName,const DeepCollectionEquality().hash(roles));

@override
String toString() {
  return 'SessionUser(id: $id, email: $email, fullName: $fullName, roles: $roles)';
}


}

/// @nodoc
abstract mixin class $SessionUserCopyWith<$Res>  {
  factory $SessionUserCopyWith(SessionUser value, $Res Function(SessionUser) _then) = _$SessionUserCopyWithImpl;
@useResult
$Res call({
 String id, String email, String fullName, List<String> roles
});




}
/// @nodoc
class _$SessionUserCopyWithImpl<$Res>
    implements $SessionUserCopyWith<$Res> {
  _$SessionUserCopyWithImpl(this._self, this._then);

  final SessionUser _self;
  final $Res Function(SessionUser) _then;

/// Create a copy of SessionUser
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? email = null,Object? fullName = null,Object? roles = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,email: null == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String,fullName: null == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String,roles: null == roles ? _self.roles : roles // ignore: cast_nullable_to_non_nullable
as List<String>,
  ));
}

}


/// Adds pattern-matching-related methods to [SessionUser].
extension SessionUserPatterns on SessionUser {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SessionUser value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SessionUser() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SessionUser value)  $default,){
final _that = this;
switch (_that) {
case _SessionUser():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SessionUser value)?  $default,){
final _that = this;
switch (_that) {
case _SessionUser() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String email,  String fullName,  List<String> roles)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SessionUser() when $default != null:
return $default(_that.id,_that.email,_that.fullName,_that.roles);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String email,  String fullName,  List<String> roles)  $default,) {final _that = this;
switch (_that) {
case _SessionUser():
return $default(_that.id,_that.email,_that.fullName,_that.roles);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String email,  String fullName,  List<String> roles)?  $default,) {final _that = this;
switch (_that) {
case _SessionUser() when $default != null:
return $default(_that.id,_that.email,_that.fullName,_that.roles);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SessionUser implements SessionUser {
  const _SessionUser({required this.id, required this.email, required this.fullName, final  List<String> roles = const <String>[]}): _roles = roles;
  factory _SessionUser.fromJson(Map<String, dynamic> json) => _$SessionUserFromJson(json);

@override final  String id;
@override final  String email;
@override final  String fullName;
 final  List<String> _roles;
@override@JsonKey() List<String> get roles {
  if (_roles is EqualUnmodifiableListView) return _roles;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_roles);
}


/// Create a copy of SessionUser
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SessionUserCopyWith<_SessionUser> get copyWith => __$SessionUserCopyWithImpl<_SessionUser>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SessionUserToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SessionUser&&(identical(other.id, id) || other.id == id)&&(identical(other.email, email) || other.email == email)&&(identical(other.fullName, fullName) || other.fullName == fullName)&&const DeepCollectionEquality().equals(other._roles, _roles));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,email,fullName,const DeepCollectionEquality().hash(_roles));

@override
String toString() {
  return 'SessionUser(id: $id, email: $email, fullName: $fullName, roles: $roles)';
}


}

/// @nodoc
abstract mixin class _$SessionUserCopyWith<$Res> implements $SessionUserCopyWith<$Res> {
  factory _$SessionUserCopyWith(_SessionUser value, $Res Function(_SessionUser) _then) = __$SessionUserCopyWithImpl;
@override @useResult
$Res call({
 String id, String email, String fullName, List<String> roles
});




}
/// @nodoc
class __$SessionUserCopyWithImpl<$Res>
    implements _$SessionUserCopyWith<$Res> {
  __$SessionUserCopyWithImpl(this._self, this._then);

  final _SessionUser _self;
  final $Res Function(_SessionUser) _then;

/// Create a copy of SessionUser
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? email = null,Object? fullName = null,Object? roles = null,}) {
  return _then(_SessionUser(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,email: null == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String,fullName: null == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String,roles: null == roles ? _self._roles : roles // ignore: cast_nullable_to_non_nullable
as List<String>,
  ));
}


}


/// @nodoc
mixin _$ImpersonationState {

 String get impersonatedUserEmail; String get approverEmail; String get sessionId;
/// Create a copy of ImpersonationState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ImpersonationStateCopyWith<ImpersonationState> get copyWith => _$ImpersonationStateCopyWithImpl<ImpersonationState>(this as ImpersonationState, _$identity);

  /// Serializes this ImpersonationState to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ImpersonationState&&(identical(other.impersonatedUserEmail, impersonatedUserEmail) || other.impersonatedUserEmail == impersonatedUserEmail)&&(identical(other.approverEmail, approverEmail) || other.approverEmail == approverEmail)&&(identical(other.sessionId, sessionId) || other.sessionId == sessionId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,impersonatedUserEmail,approverEmail,sessionId);

@override
String toString() {
  return 'ImpersonationState(impersonatedUserEmail: $impersonatedUserEmail, approverEmail: $approverEmail, sessionId: $sessionId)';
}


}

/// @nodoc
abstract mixin class $ImpersonationStateCopyWith<$Res>  {
  factory $ImpersonationStateCopyWith(ImpersonationState value, $Res Function(ImpersonationState) _then) = _$ImpersonationStateCopyWithImpl;
@useResult
$Res call({
 String impersonatedUserEmail, String approverEmail, String sessionId
});




}
/// @nodoc
class _$ImpersonationStateCopyWithImpl<$Res>
    implements $ImpersonationStateCopyWith<$Res> {
  _$ImpersonationStateCopyWithImpl(this._self, this._then);

  final ImpersonationState _self;
  final $Res Function(ImpersonationState) _then;

/// Create a copy of ImpersonationState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? impersonatedUserEmail = null,Object? approverEmail = null,Object? sessionId = null,}) {
  return _then(_self.copyWith(
impersonatedUserEmail: null == impersonatedUserEmail ? _self.impersonatedUserEmail : impersonatedUserEmail // ignore: cast_nullable_to_non_nullable
as String,approverEmail: null == approverEmail ? _self.approverEmail : approverEmail // ignore: cast_nullable_to_non_nullable
as String,sessionId: null == sessionId ? _self.sessionId : sessionId // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [ImpersonationState].
extension ImpersonationStatePatterns on ImpersonationState {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ImpersonationState value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ImpersonationState() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ImpersonationState value)  $default,){
final _that = this;
switch (_that) {
case _ImpersonationState():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ImpersonationState value)?  $default,){
final _that = this;
switch (_that) {
case _ImpersonationState() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String impersonatedUserEmail,  String approverEmail,  String sessionId)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ImpersonationState() when $default != null:
return $default(_that.impersonatedUserEmail,_that.approverEmail,_that.sessionId);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String impersonatedUserEmail,  String approverEmail,  String sessionId)  $default,) {final _that = this;
switch (_that) {
case _ImpersonationState():
return $default(_that.impersonatedUserEmail,_that.approverEmail,_that.sessionId);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String impersonatedUserEmail,  String approverEmail,  String sessionId)?  $default,) {final _that = this;
switch (_that) {
case _ImpersonationState() when $default != null:
return $default(_that.impersonatedUserEmail,_that.approverEmail,_that.sessionId);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ImpersonationState implements ImpersonationState {
  const _ImpersonationState({required this.impersonatedUserEmail, required this.approverEmail, required this.sessionId});
  factory _ImpersonationState.fromJson(Map<String, dynamic> json) => _$ImpersonationStateFromJson(json);

@override final  String impersonatedUserEmail;
@override final  String approverEmail;
@override final  String sessionId;

/// Create a copy of ImpersonationState
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ImpersonationStateCopyWith<_ImpersonationState> get copyWith => __$ImpersonationStateCopyWithImpl<_ImpersonationState>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ImpersonationStateToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ImpersonationState&&(identical(other.impersonatedUserEmail, impersonatedUserEmail) || other.impersonatedUserEmail == impersonatedUserEmail)&&(identical(other.approverEmail, approverEmail) || other.approverEmail == approverEmail)&&(identical(other.sessionId, sessionId) || other.sessionId == sessionId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,impersonatedUserEmail,approverEmail,sessionId);

@override
String toString() {
  return 'ImpersonationState(impersonatedUserEmail: $impersonatedUserEmail, approverEmail: $approverEmail, sessionId: $sessionId)';
}


}

/// @nodoc
abstract mixin class _$ImpersonationStateCopyWith<$Res> implements $ImpersonationStateCopyWith<$Res> {
  factory _$ImpersonationStateCopyWith(_ImpersonationState value, $Res Function(_ImpersonationState) _then) = __$ImpersonationStateCopyWithImpl;
@override @useResult
$Res call({
 String impersonatedUserEmail, String approverEmail, String sessionId
});




}
/// @nodoc
class __$ImpersonationStateCopyWithImpl<$Res>
    implements _$ImpersonationStateCopyWith<$Res> {
  __$ImpersonationStateCopyWithImpl(this._self, this._then);

  final _ImpersonationState _self;
  final $Res Function(_ImpersonationState) _then;

/// Create a copy of ImpersonationState
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? impersonatedUserEmail = null,Object? approverEmail = null,Object? sessionId = null,}) {
  return _then(_ImpersonationState(
impersonatedUserEmail: null == impersonatedUserEmail ? _self.impersonatedUserEmail : impersonatedUserEmail // ignore: cast_nullable_to_non_nullable
as String,approverEmail: null == approverEmail ? _self.approverEmail : approverEmail // ignore: cast_nullable_to_non_nullable
as String,sessionId: null == sessionId ? _self.sessionId : sessionId // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$Session {

 String get accessToken; String get refreshToken; String get tenantSlug; SessionUser get user; ImpersonationState? get impersonation;
/// Create a copy of Session
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SessionCopyWith<Session> get copyWith => _$SessionCopyWithImpl<Session>(this as Session, _$identity);

  /// Serializes this Session to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Session&&(identical(other.accessToken, accessToken) || other.accessToken == accessToken)&&(identical(other.refreshToken, refreshToken) || other.refreshToken == refreshToken)&&(identical(other.tenantSlug, tenantSlug) || other.tenantSlug == tenantSlug)&&(identical(other.user, user) || other.user == user)&&(identical(other.impersonation, impersonation) || other.impersonation == impersonation));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,accessToken,refreshToken,tenantSlug,user,impersonation);

@override
String toString() {
  return 'Session(accessToken: $accessToken, refreshToken: $refreshToken, tenantSlug: $tenantSlug, user: $user, impersonation: $impersonation)';
}


}

/// @nodoc
abstract mixin class $SessionCopyWith<$Res>  {
  factory $SessionCopyWith(Session value, $Res Function(Session) _then) = _$SessionCopyWithImpl;
@useResult
$Res call({
 String accessToken, String refreshToken, String tenantSlug, SessionUser user, ImpersonationState? impersonation
});


$SessionUserCopyWith<$Res> get user;$ImpersonationStateCopyWith<$Res>? get impersonation;

}
/// @nodoc
class _$SessionCopyWithImpl<$Res>
    implements $SessionCopyWith<$Res> {
  _$SessionCopyWithImpl(this._self, this._then);

  final Session _self;
  final $Res Function(Session) _then;

/// Create a copy of Session
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? accessToken = null,Object? refreshToken = null,Object? tenantSlug = null,Object? user = null,Object? impersonation = freezed,}) {
  return _then(_self.copyWith(
accessToken: null == accessToken ? _self.accessToken : accessToken // ignore: cast_nullable_to_non_nullable
as String,refreshToken: null == refreshToken ? _self.refreshToken : refreshToken // ignore: cast_nullable_to_non_nullable
as String,tenantSlug: null == tenantSlug ? _self.tenantSlug : tenantSlug // ignore: cast_nullable_to_non_nullable
as String,user: null == user ? _self.user : user // ignore: cast_nullable_to_non_nullable
as SessionUser,impersonation: freezed == impersonation ? _self.impersonation : impersonation // ignore: cast_nullable_to_non_nullable
as ImpersonationState?,
  ));
}
/// Create a copy of Session
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$SessionUserCopyWith<$Res> get user {
  
  return $SessionUserCopyWith<$Res>(_self.user, (value) {
    return _then(_self.copyWith(user: value));
  });
}/// Create a copy of Session
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ImpersonationStateCopyWith<$Res>? get impersonation {
    if (_self.impersonation == null) {
    return null;
  }

  return $ImpersonationStateCopyWith<$Res>(_self.impersonation!, (value) {
    return _then(_self.copyWith(impersonation: value));
  });
}
}


/// Adds pattern-matching-related methods to [Session].
extension SessionPatterns on Session {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Session value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Session() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Session value)  $default,){
final _that = this;
switch (_that) {
case _Session():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Session value)?  $default,){
final _that = this;
switch (_that) {
case _Session() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String accessToken,  String refreshToken,  String tenantSlug,  SessionUser user,  ImpersonationState? impersonation)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Session() when $default != null:
return $default(_that.accessToken,_that.refreshToken,_that.tenantSlug,_that.user,_that.impersonation);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String accessToken,  String refreshToken,  String tenantSlug,  SessionUser user,  ImpersonationState? impersonation)  $default,) {final _that = this;
switch (_that) {
case _Session():
return $default(_that.accessToken,_that.refreshToken,_that.tenantSlug,_that.user,_that.impersonation);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String accessToken,  String refreshToken,  String tenantSlug,  SessionUser user,  ImpersonationState? impersonation)?  $default,) {final _that = this;
switch (_that) {
case _Session() when $default != null:
return $default(_that.accessToken,_that.refreshToken,_that.tenantSlug,_that.user,_that.impersonation);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _Session extends Session {
  const _Session({required this.accessToken, required this.refreshToken, required this.tenantSlug, required this.user, this.impersonation}): super._();
  factory _Session.fromJson(Map<String, dynamic> json) => _$SessionFromJson(json);

@override final  String accessToken;
@override final  String refreshToken;
@override final  String tenantSlug;
@override final  SessionUser user;
@override final  ImpersonationState? impersonation;

/// Create a copy of Session
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SessionCopyWith<_Session> get copyWith => __$SessionCopyWithImpl<_Session>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SessionToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _Session&&(identical(other.accessToken, accessToken) || other.accessToken == accessToken)&&(identical(other.refreshToken, refreshToken) || other.refreshToken == refreshToken)&&(identical(other.tenantSlug, tenantSlug) || other.tenantSlug == tenantSlug)&&(identical(other.user, user) || other.user == user)&&(identical(other.impersonation, impersonation) || other.impersonation == impersonation));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,accessToken,refreshToken,tenantSlug,user,impersonation);

@override
String toString() {
  return 'Session(accessToken: $accessToken, refreshToken: $refreshToken, tenantSlug: $tenantSlug, user: $user, impersonation: $impersonation)';
}


}

/// @nodoc
abstract mixin class _$SessionCopyWith<$Res> implements $SessionCopyWith<$Res> {
  factory _$SessionCopyWith(_Session value, $Res Function(_Session) _then) = __$SessionCopyWithImpl;
@override @useResult
$Res call({
 String accessToken, String refreshToken, String tenantSlug, SessionUser user, ImpersonationState? impersonation
});


@override $SessionUserCopyWith<$Res> get user;@override $ImpersonationStateCopyWith<$Res>? get impersonation;

}
/// @nodoc
class __$SessionCopyWithImpl<$Res>
    implements _$SessionCopyWith<$Res> {
  __$SessionCopyWithImpl(this._self, this._then);

  final _Session _self;
  final $Res Function(_Session) _then;

/// Create a copy of Session
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? accessToken = null,Object? refreshToken = null,Object? tenantSlug = null,Object? user = null,Object? impersonation = freezed,}) {
  return _then(_Session(
accessToken: null == accessToken ? _self.accessToken : accessToken // ignore: cast_nullable_to_non_nullable
as String,refreshToken: null == refreshToken ? _self.refreshToken : refreshToken // ignore: cast_nullable_to_non_nullable
as String,tenantSlug: null == tenantSlug ? _self.tenantSlug : tenantSlug // ignore: cast_nullable_to_non_nullable
as String,user: null == user ? _self.user : user // ignore: cast_nullable_to_non_nullable
as SessionUser,impersonation: freezed == impersonation ? _self.impersonation : impersonation // ignore: cast_nullable_to_non_nullable
as ImpersonationState?,
  ));
}

/// Create a copy of Session
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$SessionUserCopyWith<$Res> get user {
  
  return $SessionUserCopyWith<$Res>(_self.user, (value) {
    return _then(_self.copyWith(user: value));
  });
}/// Create a copy of Session
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ImpersonationStateCopyWith<$Res>? get impersonation {
    if (_self.impersonation == null) {
    return null;
  }

  return $ImpersonationStateCopyWith<$Res>(_self.impersonation!, (value) {
    return _then(_self.copyWith(impersonation: value));
  });
}
}

// dart format on
