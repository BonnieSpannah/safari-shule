import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/api/api_error.dart';
import 'package:mobile/core/api/client.dart';
import 'package:mobile/core/auth/session.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _tenant = TextEditingController();
  String? _errorMessage;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _tenant.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final messenger = ScaffoldMessenger.of(context);
    final tenantSlug = _tenant.text.trim();
    if (tenantSlug.isEmpty) {
      setState(() {
        _errorMessage = 'Enter your school tenant slug.';
      });
      return;
    }
    try {
      setState(() {
        _errorMessage = null;
      });
      await ref.read(sessionNotifierProvider.notifier).login(
            client: ref.read(apiClientProvider),
            email: _email.text.trim(),
            password: _password.text,
            tenantSlug: tenantSlug,
          );
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _errorMessage = 'Login failed. Check credentials and tenant.';
      });
      messenger.showSnackBar(SnackBar(content: Text('Login failed: $error')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(sessionNotifierProvider);
    final loading = state.isLoading;
    final errorMessage = _errorMessage ??
      (state.hasError ? apiErrorMessage(state.error!) : null);

    return Scaffold(
      appBar: AppBar(title: const Text('Safari Shule Login')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: <Widget>[
            TextField(
              key: const Key('login-email'),
              controller: _email,
              decoration: const InputDecoration(labelText: 'Email'),
            ),
            TextField(
              key: const Key('login-password'),
              controller: _password,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Password'),
            ),
            TextField(
              key: const Key('login-tenant'),
              controller: _tenant,
              decoration: const InputDecoration(labelText: 'Tenant slug'),
            ),
            const SizedBox(height: 16),
            if (errorMessage != null)
              Text(
                errorMessage,
                key: const Key('login-error'),
                style: const TextStyle(color: Colors.red),
              ),
            if (errorMessage != null) const SizedBox(height: 8),
            ElevatedButton(
              key: const Key('login-submit'),
              onPressed: loading ? null : _submit,
              child: loading
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Sign in'),
            ),
          ],
        ),
      ),
    );
  }
}
