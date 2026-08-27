import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/features/impersonation_banner/impersonation_banner.dart';

class DriverShell extends StatelessWidget {
  const DriverShell({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Driver'),
        actions: <Widget>[
          IconButton(
            onPressed: () => context.push('/driver/sos'),
            icon: const Icon(Icons.warning_rounded),
          ),
        ],
      ),
      body: Column(
        children: <Widget>[
          const ImpersonationBanner(),
          Expanded(child: child),
        ],
      ),
    );
  }
}
