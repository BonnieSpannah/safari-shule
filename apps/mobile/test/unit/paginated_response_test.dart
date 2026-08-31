import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/paginated_response.dart';

void main() {
  test('reads API paginated data records', () {
    final records = readPaginatedRecords(<String, Object?>{
      'data': <Object?>[
        <String, Object?>{'id': 'trip-1'},
        <String, Object?>{'id': 'trip-2'},
      ],
      'meta': <String, Object?>{'page': 1, 'total': 2},
    });

    expect(records.map((record) => record['id']), <String>['trip-1', 'trip-2']);
  });
}
