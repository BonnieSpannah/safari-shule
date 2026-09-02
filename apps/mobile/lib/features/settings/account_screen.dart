import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/api/client.dart';
import 'package:mobile/core/auth/session.dart';

String _titleCase(String value) =>
    value.isEmpty ? value : '${value[0].toUpperCase()}${value.substring(1)}';

class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionNotifierProvider).value;
    final user = session?.user;

    return ListView(
      padding: const EdgeInsets.all(20),
      children: <Widget>[
        Text('Account', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 20),
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: CircleAvatar(
            child: Text((user?.fullName.isNotEmpty ?? false)
                ? user!.fullName.substring(0, 1).toUpperCase()
                : '?'),
          ),
          title: Text(user?.fullName ?? 'Unknown user'),
          subtitle: Text(user?.email ?? ''),
        ),
        const Divider(),
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.apartment_outlined),
          title: const Text('School tenant'),
          subtitle: Text(session?.tenantName ?? session?.tenantSlug ?? ''),
        ),
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.badge_outlined),
          title: const Text('Access role'),
          subtitle: Text((user?.roles ?? const <String>[]).map(_titleCase).join(', ')),
        ),
        const SizedBox(height: 32),
        FilledButton.tonalIcon(
          onPressed: () async {
            await ref.read(sessionNotifierProvider.notifier).logout(
                  client: ref.read(apiClientProvider),
                );
          },
          icon: const Icon(Icons.logout),
          label: const Text('Sign out'),
        ),
      ],
    );
  }
}
