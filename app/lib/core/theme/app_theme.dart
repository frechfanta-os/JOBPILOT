import 'package:flutter/material.dart';

/// Design tokens and Material 3 theme configuration for JobPilot International.
class AppTheme {
  // Brand Color Roles
  static const Color primaryBlue = Color(0xFF0F52BA);     // Sapphire primary
  static const Color secondaryCyan = Color(0xFF007A87);   // Teal secondary
  static const Color accentAmber = Color(0xFFD97706);     // Alert / Pending amber
  static const Color successGreen = Color(0xFF15803D);    // Verified / Submitted green
  static const Color dangerRed = Color(0xFFB91C1C);       // Error / Ineligible red

  // Surface & Neutral Roles
  static const Color surfaceLight = Color(0xFFF8FAFC);
  static const Color surfaceDark = Color(0xFF0F172A);
  static const Color cardLight = Color(0xFFFFFFFF);
  static const Color cardDark = Color(0xFF1E293B);

  static ThemeData get lightTheme {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: primaryBlue,
      brightness: Brightness.light,
      surface: surfaceLight,
      primary: primaryBlue,
      secondary: secondaryCyan,
      error: dangerRed,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: surfaceLight,
      cardTheme: CardThemeData(
        color: cardLight,
        elevation: 1,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: surfaceLight,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: Color(0xFF0F172A),
          fontSize: 20,
          fontWeight: FontWeight.w700,
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        indicatorColor: primaryBlue.withAlpha(38),
        elevation: 3,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => TextStyle(
            fontSize: 12,
            fontWeight: states.contains(WidgetState.selected)
                ? FontWeight.w600
                : FontWeight.w500,
          ),
        ),
      ),
    );
  }

  static ThemeData get darkTheme {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: primaryBlue,
      brightness: Brightness.dark,
      surface: surfaceDark,
      primary: const Color(0xFF60A5FA),
      secondary: const Color(0xFF38BDF8),
      error: const Color(0xFFF87171),
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: surfaceDark,
      cardTheme: CardThemeData(
        color: cardDark,
        elevation: 1,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: surfaceDark,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: Color(0xFFF8FAFC),
          fontSize: 20,
          fontWeight: FontWeight.w700,
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: cardDark,
        indicatorColor: const Color(0xFF60A5FA).withAlpha(51),
        elevation: 3,
      ),
    );
  }
}
