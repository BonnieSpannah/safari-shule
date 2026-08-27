import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/caretaker/assistant_scan_screen.dart';

void main() {
  testWidgets('assistant NFC scan success shows confirmation', (
    WidgetTester tester,
  ) async {
    String? submittedTag;

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: AssistantScanScreen(
              scanNfcTag: () async => 'NFC-TAG-1',
              submitTag: (ref, tagUid) async {
                submittedTag = tagUid;
                return 'Boarding recorded for Achieng';
              },
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.byKey(const Key('scan-nfc-button')));
    await tester.pumpAndSettle();

    expect(submittedTag, 'NFC-TAG-1');
    expect(find.text('Boarding recorded for Achieng'), findsOneWidget);
  });

  testWidgets('assistant QR scan success shows confirmation', (
    WidgetTester tester,
  ) async {
    String? submittedTag;

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: AssistantScanScreen(
              scanQrTag: (context) async => 'QR-TAG-2',
              submitTag: (ref, tagUid) async {
                submittedTag = tagUid;
                return 'Boarding recorded for Otieno';
              },
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.byKey(const Key('scan-qr-button')));
    await tester.pumpAndSettle();

    expect(submittedTag, 'QR-TAG-2');
    expect(find.text('Boarding recorded for Otieno'), findsOneWidget);
  });
}
