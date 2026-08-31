import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/core/auth/session.dart';
import 'package:mobile/features/impersonation_banner/impersonation_banner.dart';
import 'package:mobile/shared/widgets/adaptive_scaffold.dart';

class ParentShell extends ConsumerWidget {
  const ParentShell({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    const destinations = <MobileDestination>[
      MobileDestination(label: 'Children', icon: Icons.family_restroom_outlined, selectedIcon: Icons.family_restroom),
      MobileDestination(label: 'Payments', icon: Icons.account_balance_wallet_outlined, selectedIcon: Icons.account_balance_wallet),
      MobileDestination(label: 'Account', icon: Icons.person_outline, selectedIcon: Icons.person),
    ];
    const locations = <String>['/parent/children', '/parent/payments', '/parent/account'];
    final path = GoRouterState.of(context).uri.path;
    final routeIndex = locations.indexOf(path);
    final selectedIndex = routeIndex < 0 ? 0 : routeIndex;

    return AdaptiveScaffold(
      tenantLabel: ref.watch(sessionNotifierProvider).value?.tenantSlug ?? 'Safari Shule',
      roleLabel: 'Parent',
      selectedIndex: selectedIndex,
      destinations: destinations,
      onDestinationSelected: (index) => context.go(locations[index]),
      child: Column(
        children: <Widget>[const ImpersonationBanner(), Expanded(child: child)],
      ),
    );
  }
}
