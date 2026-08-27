import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:mobile/app/app.dart';
import 'package:mobile/core/offline/outbox.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Hive.initFlutter();
  await OutboxStore.open();
  runApp(const ProviderScope(child: SafariShuleApp()));
}
