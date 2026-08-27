import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/realtime/ws_gateway.dart';
import 'package:mobile/features/parent/parent_track_screen.dart';

void main() {
  testWidgets('parent track updates from websocket event', (WidgetTester tester) async {
    final controller = StreamController<WsEvent?>();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          wsTripLocationProvider.overrideWith(
            (ref, tripId) => controller.stream,
          ),
        ],
        child: const MaterialApp(
          home: Scaffold(
            body: SizedBox(
              height: 600,
              child: ParentTrackScreen(childId: 'trip-1'),
            ),
          ),
        ),
      ),
    );

    await tester.pump();
    expect(find.byKey(const Key('track-coordinates')), findsOneWidget);

    controller.add(const WsEvent(tripId: 'trip-1', lat: -1.3000, lng: 36.8100));
    await tester.pump();
    await tester.pump();

    expect(find.textContaining('Bus at -1.3000, 36.8100'), findsOneWidget);

    await controller.close();
  });
}
