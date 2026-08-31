import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/shared/widgets/adaptive_scaffold.dart';

void main() {
  testWidgets('compact shell exposes account destination in bottom navigation', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: MediaQuery(
          data: const MediaQueryData(size: Size(390, 844)),
          child: AdaptiveScaffold(
            tenantLabel: 'Hillcrest Academy',
            roleLabel: 'Driver',
            selectedIndex: 0,
            destinations: const <MobileDestination>[
              MobileDestination(
                label: 'Trips',
                icon: Icons.directions_bus_outlined,
                selectedIcon: Icons.directions_bus,
              ),
              MobileDestination(
                label: 'Account',
                icon: Icons.person_outline,
                selectedIcon: Icons.person,
              ),
            ],
            onDestinationSelected: (_) {},
            child: const Center(child: Text('Trip content')),
          ),
        ),
      ),
    );

    expect(find.text('Safari Shule'), findsOneWidget);
    expect(find.text('Hillcrest Academy · Driver'), findsOneWidget);
    expect(find.text('Account'), findsOneWidget);
  });
}
