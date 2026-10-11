import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:jobpilot/main.dart';

void main() {
  testWidgets('JobPilotApp boots and renders navigation shell and dashboard', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(
      const ProviderScope(
        child: JobPilotApp(),
      ),
    );
    await tester.pumpAndSettle();

    // Verify that the title and bottom navigation destinations are rendered.
    expect(find.text('JobPilot Dashboard'), findsOneWidget);
    expect(find.text('Dashboard'), findsOneWidget);
    expect(find.text('Jobs'), findsOneWidget);
    expect(find.text('Applications'), findsOneWidget);
    expect(find.text('Profile'), findsOneWidget);

    // Tap on the 'Jobs' tab.
    await tester.tap(find.text('Jobs'));
    await tester.pumpAndSettle();

    // Verify that the Job Discovery screen is shown.
    expect(find.text('Job Discovery'), findsOneWidget);
    expect(find.text('All Countries'), findsOneWidget);
    expect(find.text('Canada 🇨🇦'), findsOneWidget);
    expect(find.text('Italy 🇮🇹'), findsOneWidget);
  });
}
