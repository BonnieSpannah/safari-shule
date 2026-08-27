import 'package:flutter/material.dart';
import 'package:mobile/features/impersonation_banner/impersonation_banner.dart';

class ParentShell extends StatelessWidget {
  const ParentShell({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Parent')),
      body: Column(
        children: <Widget>[const ImpersonationBanner(), Expanded(child: child)],
      ),
    );
  }
}
