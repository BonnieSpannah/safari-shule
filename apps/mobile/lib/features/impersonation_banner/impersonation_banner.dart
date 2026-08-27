import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/auth/session.dart';

class ImpersonationBanner extends ConsumerWidget {
  const ImpersonationBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionNotifierProvider).value;
    final impersonation = session?.impersonation;
    if (impersonation == null) {
      return const SizedBox.shrink();
    }

    return Container(
      width: double.infinity,
      color: const Color(0xFFFFF8E1),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: <Widget>[
          const Icon(Icons.visibility, color: Color(0xFFB26A00), size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  'Impersonating ${impersonation.impersonatedUserEmail}',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF6D4C00),
                  ),
                ),
                Text(
                  'Approved by ${impersonation.approverEmail}',
                  style: const TextStyle(fontSize: 11, color: Color(0xFF7C6400)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
