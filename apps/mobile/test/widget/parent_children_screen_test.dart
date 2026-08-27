import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/parent/parent_children_screen.dart';

void main() {
  testWidgets('children list shows loading state', (WidgetTester tester) async {
    final completer = Completer<List<Map<String, Object?>>>();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          childrenProvider.overrideWith((ref) => completer.future),
        ],
        child: const MaterialApp(home: Scaffold(body: ParentChildrenScreen())),
      ),
    );

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });

  testWidgets('children list shows empty state', (WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          childrenProvider.overrideWith((ref) async => const <Map<String, Object?>>[]),
        ],
        child: const MaterialApp(home: Scaffold(body: ParentChildrenScreen())),
      ),
    );

    await tester.pumpAndSettle();
    expect(find.text('No linked children found'), findsOneWidget);
  });

  testWidgets('children list shows error state', (WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          childrenProvider.overrideWith((ref) async {
            throw Exception('boom');
          }),
        ],
        child: const MaterialApp(home: Scaffold(body: ParentChildrenScreen())),
      ),
    );

    await tester.pumpAndSettle();
    expect(find.textContaining('Failed to load children'), findsOneWidget);
  });
}
