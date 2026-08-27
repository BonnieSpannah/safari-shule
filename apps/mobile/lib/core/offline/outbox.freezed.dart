// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'outbox.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$OutboxEntry {

 String get id; String get endpoint; String get method; Map<String, Object?> get body; DateTime get createdAt; int get attempts;
/// Create a copy of OutboxEntry
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$OutboxEntryCopyWith<OutboxEntry> get copyWith => _$OutboxEntryCopyWithImpl<OutboxEntry>(this as OutboxEntry, _$identity);

  /// Serializes this OutboxEntry to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is OutboxEntry&&(identical(other.id, id) || other.id == id)&&(identical(other.endpoint, endpoint) || other.endpoint == endpoint)&&(identical(other.method, method) || other.method == method)&&const DeepCollectionEquality().equals(other.body, body)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.attempts, attempts) || other.attempts == attempts));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,endpoint,method,const DeepCollectionEquality().hash(body),createdAt,attempts);

@override
String toString() {
  return 'OutboxEntry(id: $id, endpoint: $endpoint, method: $method, body: $body, createdAt: $createdAt, attempts: $attempts)';
}


}

/// @nodoc
abstract mixin class $OutboxEntryCopyWith<$Res>  {
  factory $OutboxEntryCopyWith(OutboxEntry value, $Res Function(OutboxEntry) _then) = _$OutboxEntryCopyWithImpl;
@useResult
$Res call({
 String id, String endpoint, String method, Map<String, Object?> body, DateTime createdAt, int attempts
});




}
/// @nodoc
class _$OutboxEntryCopyWithImpl<$Res>
    implements $OutboxEntryCopyWith<$Res> {
  _$OutboxEntryCopyWithImpl(this._self, this._then);

  final OutboxEntry _self;
  final $Res Function(OutboxEntry) _then;

/// Create a copy of OutboxEntry
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? endpoint = null,Object? method = null,Object? body = null,Object? createdAt = null,Object? attempts = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,endpoint: null == endpoint ? _self.endpoint : endpoint // ignore: cast_nullable_to_non_nullable
as String,method: null == method ? _self.method : method // ignore: cast_nullable_to_non_nullable
as String,body: null == body ? _self.body : body // ignore: cast_nullable_to_non_nullable
as Map<String, Object?>,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,attempts: null == attempts ? _self.attempts : attempts // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [OutboxEntry].
extension OutboxEntryPatterns on OutboxEntry {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _OutboxEntry value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _OutboxEntry() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _OutboxEntry value)  $default,){
final _that = this;
switch (_that) {
case _OutboxEntry():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _OutboxEntry value)?  $default,){
final _that = this;
switch (_that) {
case _OutboxEntry() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String endpoint,  String method,  Map<String, Object?> body,  DateTime createdAt,  int attempts)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _OutboxEntry() when $default != null:
return $default(_that.id,_that.endpoint,_that.method,_that.body,_that.createdAt,_that.attempts);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String endpoint,  String method,  Map<String, Object?> body,  DateTime createdAt,  int attempts)  $default,) {final _that = this;
switch (_that) {
case _OutboxEntry():
return $default(_that.id,_that.endpoint,_that.method,_that.body,_that.createdAt,_that.attempts);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String endpoint,  String method,  Map<String, Object?> body,  DateTime createdAt,  int attempts)?  $default,) {final _that = this;
switch (_that) {
case _OutboxEntry() when $default != null:
return $default(_that.id,_that.endpoint,_that.method,_that.body,_that.createdAt,_that.attempts);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _OutboxEntry implements OutboxEntry {
  const _OutboxEntry({required this.id, required this.endpoint, required this.method, required final  Map<String, Object?> body, required this.createdAt, this.attempts = 0}): _body = body;
  factory _OutboxEntry.fromJson(Map<String, dynamic> json) => _$OutboxEntryFromJson(json);

@override final  String id;
@override final  String endpoint;
@override final  String method;
 final  Map<String, Object?> _body;
@override Map<String, Object?> get body {
  if (_body is EqualUnmodifiableMapView) return _body;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(_body);
}

@override final  DateTime createdAt;
@override@JsonKey() final  int attempts;

/// Create a copy of OutboxEntry
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$OutboxEntryCopyWith<_OutboxEntry> get copyWith => __$OutboxEntryCopyWithImpl<_OutboxEntry>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$OutboxEntryToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _OutboxEntry&&(identical(other.id, id) || other.id == id)&&(identical(other.endpoint, endpoint) || other.endpoint == endpoint)&&(identical(other.method, method) || other.method == method)&&const DeepCollectionEquality().equals(other._body, _body)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.attempts, attempts) || other.attempts == attempts));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,endpoint,method,const DeepCollectionEquality().hash(_body),createdAt,attempts);

@override
String toString() {
  return 'OutboxEntry(id: $id, endpoint: $endpoint, method: $method, body: $body, createdAt: $createdAt, attempts: $attempts)';
}


}

/// @nodoc
abstract mixin class _$OutboxEntryCopyWith<$Res> implements $OutboxEntryCopyWith<$Res> {
  factory _$OutboxEntryCopyWith(_OutboxEntry value, $Res Function(_OutboxEntry) _then) = __$OutboxEntryCopyWithImpl;
@override @useResult
$Res call({
 String id, String endpoint, String method, Map<String, Object?> body, DateTime createdAt, int attempts
});




}
/// @nodoc
class __$OutboxEntryCopyWithImpl<$Res>
    implements _$OutboxEntryCopyWith<$Res> {
  __$OutboxEntryCopyWithImpl(this._self, this._then);

  final _OutboxEntry _self;
  final $Res Function(_OutboxEntry) _then;

/// Create a copy of OutboxEntry
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? endpoint = null,Object? method = null,Object? body = null,Object? createdAt = null,Object? attempts = null,}) {
  return _then(_OutboxEntry(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,endpoint: null == endpoint ? _self.endpoint : endpoint // ignore: cast_nullable_to_non_nullable
as String,method: null == method ? _self.method : method // ignore: cast_nullable_to_non_nullable
as String,body: null == body ? _self._body : body // ignore: cast_nullable_to_non_nullable
as Map<String, Object?>,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,attempts: null == attempts ? _self.attempts : attempts // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}

// dart format on
