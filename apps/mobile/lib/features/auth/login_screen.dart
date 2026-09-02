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
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 420),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: <Widget>[
                        Icon(
                          Icons.directions_bus_filled_rounded,
                          size: 56,
                          color: colorScheme.primary,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Safari Shule',
                          textAlign: TextAlign.center,
                          style: textTheme.headlineMedium
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Safari Shule Login',
                          textAlign: TextAlign.center,
                          style: textTheme.bodyMedium
                              ?.copyWith(color: Colors.grey),
                        ),
                        const SizedBox(height: 32),
                        Card(
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                            side: BorderSide(color: colorScheme.outlineVariant),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: <Widget>[
                                TextField(
                                  key: const Key('login-tenant'),
                                  controller: _tenant,
                                  decoration: const InputDecoration(
                                    labelText: 'Tenant slug',
                                    prefixIcon: Icon(Icons.apartment_outlined),
                                    border: OutlineInputBorder(),
                                  ),
                                ),
                                const SizedBox(height: 16),
                                TextField(
                                  key: const Key('login-email'),
                                  controller: _email,
                                  decoration: const InputDecoration(
                                    labelText: 'Email',
                                    prefixIcon: Icon(Icons.email_outlined),
                                    border: OutlineInputBorder(),
                                  ),
                                ),
                                const SizedBox(height: 16),
                                TextField(
                                  key: const Key('login-password'),
                                  controller: _password,
                                  obscureText: true,
                                  decoration: const InputDecoration(
                                    labelText: 'Password',
                                    prefixIcon: Icon(Icons.lock_outline),
                                    border: OutlineInputBorder(),
                                  ),
                                ),
                                if (errorMessage != null) ...<Widget>[
                                  const SizedBox(height: 16),
                                  Text(
                                    errorMessage,
                                    key: const Key('login-error'),
                                    style: TextStyle(color: colorScheme.error),
                                  ),
                                ],
                                const SizedBox(height: 24),
                                SizedBox(
                                  height: 48,
                                  child: FilledButton(
                                    key: const Key('login-submit'),
                                    onPressed: loading ? null : _submit,
                                    child: loading
                                        ? const SizedBox(
                                            width: 20,
                                            height: 20,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                              color: Colors.white,
                                            ),
                                          )
                                        : const Text('Sign in'),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
