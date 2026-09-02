import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/driver/student_lookup_sheet.dart';

void main() {
  testWidgets('submits the entered admission number and pops with true', (
    tester,
  ) async {
    String? submitted;
    bool? popped;
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: ElevatedButton(
                onPressed: () async {
                  popped = await showModalBottomSheet<bool>(
                    context: context,
                    builder: (_) => StudentLookupSheet(
                      title: 'Board student',
                      onSubmit: (value) async {
                        submitted = value;
                      },
                    ),
                  );
                },
                child: const Text('open'),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byKey(const Key('student-lookup-input')),
      'ADM-001',
    );

    await tester.runAsync(() async {
      await tester.tap(find.text('Confirm'));
      await Future<void>.delayed(const Duration(milliseconds: 50));
    });
    await tester.pumpAndSettle();

    expect(submitted, 'ADM-001');
    expect(popped, true);
  });

  testWidgets(
    'shows a validation error for empty input and does not call onSubmit',
    (tester) async {
      var called = false;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StudentLookupSheet(
              title: 'Board student',
              onSubmit: (_) async {
                called = true;
              },
            ),
          ),
        ),
      );

      await tester.tap(find.text('Confirm'));
      await tester.pump();

      expect(called, isFalse);
      expect(find.textContaining('Enter an admission number'), findsOneWidget);
    },
  );

  testWidgets(
    'shows an inline error message when onSubmit throws and does not pop',
    (tester) async {
      bool? popped;
      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: Center(
                child: ElevatedButton(
                  onPressed: () async {
                    popped = await showModalBottomSheet<bool>(
                      context: context,
                      builder: (_) => StudentLookupSheet(
                        title: 'Board student',
                        onSubmit: (_) async => throw Exception('not on trip'),
                      ),
                    );
                  },
                  child: const Text('open'),
                ),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byKey(const Key('student-lookup-input')),
        'ADM-002',
      );

      await tester.runAsync(() async {
        await tester.tap(find.text('Confirm'));
        await Future<void>.delayed(const Duration(milliseconds: 50));
      });
      await tester.pumpAndSettle();

      expect(find.textContaining('not on trip'), findsOneWidget);
      expect(popped, isNull);
    },
  );
}
