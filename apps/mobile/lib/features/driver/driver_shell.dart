import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/core/auth/session.dart';
import 'package:mobile/features/impersonation_banner/impersonation_banner.dart';
import 'package:mobile/shared/widgets/adaptive_scaffold.dart';

class DriverShell extends ConsumerWidget {
  const DriverShell({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    const destinations = <MobileDestination>[
      MobileDestination(label: 'Trips', icon: Icons.directions_bus_outlined, selectedIcon: Icons.directions_bus),
      MobileDestination(label: 'Messages', icon: Icons.forum_outlined, selectedIcon: Icons.forum),
      MobileDestination(label: 'Account', icon: Icons.person_outline, selectedIcon: Icons.person),
    ];
    const locations = <String>['/driver/dashboard', '/driver/messages', '/driver/account'];
    final path = GoRouterState.of(context).uri.path;
    final routeIndex = locations.indexOf(path);
    final selectedIndex = routeIndex < 0 ? 0 : routeIndex;
    final tenantLabel = ref.watch(sessionNotifierProvider).value?.tenantSlug ?? 'Safari Shule';

    return AdaptiveScaffold(
      tenantLabel: tenantLabel,
      roleLabel: 'Driver',
      selectedIndex: selectedIndex,
      destinations: destinations,
      onDestinationSelected: (index) => context.go(locations[index]),
      actions: <Widget>[
        IconButton(
          tooltip: 'Emergency SOS',
          onPressed: () => context.push('/driver/sos'),
          icon: const Icon(Icons.sos),
          color: Theme.of(context).colorScheme.error,
        ),
      ],
      child: Column(
        children: <Widget>[const ImpersonationBanner(), Expanded(child: child)],
      ),
    );
  }
}
