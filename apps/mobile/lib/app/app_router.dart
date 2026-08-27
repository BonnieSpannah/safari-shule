import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/core/auth/session.dart';
import 'package:mobile/features/auth/login_screen.dart';
import 'package:mobile/features/caretaker/assistant_dashboard_screen.dart';
import 'package:mobile/features/caretaker/assistant_scan_screen.dart';
import 'package:mobile/features/caretaker/assistant_shell.dart';
import 'package:mobile/features/driver/driver_dashboard_screen.dart';
import 'package:mobile/features/driver/driver_shell.dart';
import 'package:mobile/features/driver/driver_sos_screen.dart';
import 'package:mobile/features/driver/driver_trip_screen.dart';
import 'package:mobile/features/parent/parent_children_screen.dart';
import 'package:mobile/features/parent/parent_payments_screen.dart';
import 'package:mobile/features/parent/parent_shell.dart';
import 'package:mobile/features/parent/parent_track_screen.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();

final appRouterProvider = Provider<GoRouter>((ref) {
  final session = ref.watch(sessionNotifierProvider).value;

  String homeForRole() {
    final roles = session?.user.roles ?? const <String>[];
    if (roles.contains('driver')) {
      return '/driver/dashboard';
    }
    if (roles.contains('assistant') || roles.contains('caretaker')) {
      return '/assistant/dashboard';
    }
    return '/parent/children';
  }

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/login',
    redirect: (context, state) {
      final loggedIn = session?.isAuthenticated == true;
      final inLogin = state.matchedLocation == '/login';
      if (!loggedIn && !inLogin) {
        return '/login';
      }
      if (loggedIn && inLogin) {
        return homeForRole();
      }
      return null;
    },
    routes: <RouteBase>[
      GoRoute(
        path: '/login',
        builder: (_, state) => const LoginScreen(),
      ),
      ShellRoute(
        builder: (_, state, child) => DriverShell(child: child),
        routes: <RouteBase>[
          GoRoute(
            path: '/driver/dashboard',
            builder: (_, state) => const DriverDashboardScreen(),
          ),
          GoRoute(
            path: '/driver/trip/:id',
            builder: (_, state) =>
                DriverTripScreen(tripId: state.pathParameters['id'] ?? ''),
          ),
          GoRoute(
            path: '/driver/sos',
            builder: (_, state) => const DriverSosScreen(),
          ),
        ],
      ),
      ShellRoute(
        builder: (_, state, child) => AssistantShell(child: child),
        routes: <RouteBase>[
          GoRoute(
            path: '/assistant/dashboard',
            builder: (_, state) => const AssistantDashboardScreen(),
          ),
          GoRoute(
            path: '/assistant/scan',
            builder: (_, state) => const AssistantScanScreen(),
          ),
        ],
      ),
      ShellRoute(
        builder: (_, state, child) => ParentShell(child: child),
        routes: <RouteBase>[
          GoRoute(
            path: '/parent/children',
            builder: (_, state) => const ParentChildrenScreen(),
          ),
          GoRoute(
            path: '/parent/track/:childId',
            builder: (_, state) => ParentTrackScreen(
              childId: state.pathParameters['childId'] ?? '',
            ),
          ),
          GoRoute(
            path: '/parent/payments',
            builder: (_, state) => const ParentPaymentsScreen(),
          ),
        ],
      ),
    ],
  );
});
