import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/core/auth/session.dart';
import 'package:mobile/features/impersonation_banner/impersonation_banner.dart';
import 'package:mobile/shared/widgets/adaptive_scaffold.dart';

class AssistantShell extends ConsumerWidget {
  const AssistantShell({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    const destinations = <MobileDestination>[
      MobileDestination(label: 'Scan', icon: Icons.nfc_outlined, selectedIcon: Icons.nfc),
      MobileDestination(label: 'Trips', icon: Icons.directions_bus_outlined, selectedIcon: Icons.directions_bus),
      MobileDestination(label: 'Account', icon: Icons.person_outline, selectedIcon: Icons.person),
    ];
    const locations = <String>['/assistant/scan', '/assistant/dashboard', '/assistant/account'];
    final path = GoRouterState.of(context).uri.path;
    final routeIndex = locations.indexOf(path);
    final selectedIndex = routeIndex < 0 ? 0 : routeIndex;

    return AdaptiveScaffold(
      tenantLabel: ref.watch(sessionNotifierProvider).value?.tenantSlug ?? 'Safari Shule',
      roleLabel: 'Assistant',
      selectedIndex: selectedIndex,
      destinations: destinations,
      onDestinationSelected: (index) => context.go(locations[index]),
      child: Column(
        children: <Widget>[const ImpersonationBanner(), Expanded(child: child)],
      ),
    );
  }
}
