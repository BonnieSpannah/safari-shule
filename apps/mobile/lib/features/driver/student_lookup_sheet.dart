import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:mobile/core/api/api_error.dart';

// Reusable bottom sheet for manual admission-number entry (board/alight).
// NFC/QR scanning is out of scope for this iteration — manual entry only.
class StudentLookupSheet extends StatefulWidget {
  const StudentLookupSheet({
    super.key,
    required this.title,
    required this.onSubmit,
  });

  final String title;
  final Future<void> Function(String admissionNumber) onSubmit;

  @override
  State<StudentLookupSheet> createState() => _StudentLookupSheetState();
}

class _StudentLookupSheetState extends State<StudentLookupSheet> {
  final _controller = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _confirm() async {
    final value = _controller.text.trim();
    if (value.isEmpty) {
      setState(() => _error = 'Enter an admission number.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await widget.onSubmit(value);
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error is DioException
            ? apiErrorMessage(error)
            : 'Could not confirm: $error';
        _submitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(widget.title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          TextField(
            key: const Key('student-lookup-input'),
            controller: _controller,
            autofocus: true,
            decoration: const InputDecoration(
              labelText: 'Admission number',
              hintText: 'e.g. ADM-0123',
            ),
            onSubmitted: (_) => _confirm(),
          ),
          if (_error != null) ...<Widget>[
            const SizedBox(height: 8),
            Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _submitting ? null : _confirm,
            child: _submitting
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Confirm'),
          ),
        ],
      ),
    );
  }
}
