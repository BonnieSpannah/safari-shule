import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/api/client.dart';

final childrenProvider = FutureProvider<List<Map<String, Object?>>>((ref) async {
  final response = await ref.read(apiClientProvider).get<Map<String, Object?>>('/students');
  final items = response.data?['items'];
  if (items is! List) {
    return const <Map<String, Object?>>[];
  }
  return items
      .whereType<Map<Object?, Object?>>()
      .map((item) => Map<String, Object?>.from(item))
      .toList(growable: false);
});

class ParentChildrenScreen extends ConsumerWidget {
  const ParentChildrenScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final children = ref.watch(childrenProvider);
    return children.when(
      data: (items) {
        if (items.isEmpty) {
          return const Center(child: Text('No linked children found'));
        }
        return ListView.builder(
          itemCount: items.length,
          itemBuilder: (context, index) {
            final child = items[index];
            return ListTile(
              title: Text((child['legalName'] as String?) ?? 'Student'),
              subtitle: Text((child['admissionNumber'] as String?) ?? ''),
            );
          },
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(child: Text('Failed to load children: $error')),
    );
  }
}
