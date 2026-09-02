import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/auth/session.dart';
import 'package:mobile/core/auth/session_models.dart';
import 'package:mobile/features/settings/account_screen.dart';

class _TestSessionNotifier extends SessionNotifier {
  @override
  Future<Session?> build() async {
    return const Session(
      accessToken: 'token',
      refreshToken: 'refresh',
      tenantSlug: 'sunshine',
      tenantName: 'Sunshine School',
      user: SessionUser(
        id: 'user-1',
        email: 'driver@sunshine.ac.ke',
        fullName: 'Driver One',
        roles: <String>['driver'],
      ),
    );
  }
}

void main() {
  testWidgets('AccountScreen shows tenant name and capitalized role', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionNotifierProvider.overrideWith(_TestSessionNotifier.new),
        ],
        child: const MaterialApp(home: Scaffold(body: AccountScreen())),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Sunshine School'), findsOneWidget);
    expect(find.text('Driver'), findsOneWidget);
    expect(find.text('driver'), findsNothing);
    expect(find.text('sunshine'), findsNothing);
  });
}
