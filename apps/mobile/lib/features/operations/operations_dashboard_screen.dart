import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/core/api/client.dart';
import 'package:mobile/core/auth/session.dart';
import 'package:mobile/core/auth/session_models.dart';

class OperationsDashboardScreen extends ConsumerWidget {
  const OperationsDashboardScreen({super.key});

  bool _can(Session? session, String permission) {
    final roles = session?.user.roles ?? const <String>[];
    final permissions = session?.user.permissions ?? const <String>[];
    return roles.contains('system_admin') || permissions.contains(permission);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionNotifierProvider).value;
    final notifier = ref.read(sessionNotifierProvider.notifier);
    final roles = session?.user.roles.join(', ') ?? 'No assigned role';

    return Scaffold(
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: <Widget>[
          Text('Operations', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 4),
          Text(session?.tenantSlug ?? ''),
          const SizedBox(height: 4),
          Text(roles),
          const SizedBox(height: 24),
          if (_can(session, 'trips.view'))
            ListTile(
              leading: const Icon(Icons.directions_bus),
              title: const Text('Trip dispatch'),
              subtitle: const Text('View scheduled transport trips'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.go('/driver/dashboard'),
            ),
          if (_can(session, 'rfid_devices.manage'))
            ListTile(
              leading: const Icon(Icons.nfc),
              title: const Text('Boarding scan'),
              subtitle: const Text('Open the assistant RFID and QR scanner'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.go('/assistant/scan'),
            ),
          if (_can(session, 'incidents.view'))
            const ListTile(
              leading: Icon(Icons.warning_amber_rounded),
              title: Text('Incident response'),
              subtitle: Text('Use the web admin for incident triage'),
              trailing: Icon(Icons.open_in_browser),
              onTap: null,
            ),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: () async {
              await notifier.logout(client: ref.read(apiClientProvider));
            },
            icon: const Icon(Icons.logout),
            label: const Text('Sign out'),
          ),
        ],
      ),
    );
  }
}
