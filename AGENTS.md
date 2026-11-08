# Qooti Agent & Developer Engineering Guidelines

Welcome to the Qooti codebase. All agents and developers working on this repository must adhere to the permanent design and engineering standards documented below.

---

## 1. Primary Design & Engineering Standards

Before creating or modifying any screen, component, or user interaction, read and comply with:
- [Cross-Platform UI/UX Principles](file:///mnt/samsungSSD/Projects/Qooti-app/docs/design/cross-platform-uiux-principles.md)
- [Phase 1A UI/UX Audit & Issue Inventory](file:///mnt/samsungSSD/Projects/Qooti-app/docs/design/phase-1a-uiux-audit.md)
- [Phase 1A Improvement Backlog](file:///mnt/samsungSSD/Projects/Qooti-app/docs/design/phase-1a-improvement-backlog.md)
- [Platform Acceptance Test Matrix](file:///mnt/samsungSSD/Projects/Qooti-app/docs/design/platform-acceptance-matrix.md)

---

## 2. Mandatory Rules of Engagement

1. **Dual-Platform Citizenship:**
   - Every UI modification must be verified for **both Android and iOS**.
   - Follow Apple Human Interface Guidelines (HIG) on iOS (SF Pro system font metrics, smooth opacity dimming, swipe gestures).
   - Follow Material Design 3 on Android (`android_ripple` touch feedback, 3-button navigation clearance, hardware back handling).

2. **Bidirectional (RTL / LTR) Parity:**
   - English (LTR) and Arabic (RTL) must maintain visual and functional symmetry.
   - Use `activeRowStyle()`, `activeTextAlign()`, and `activeWritingDirection()`.
   - Never use `I18nManager.forceRTL()` during normal in-app language switching.
   - Preserve Latin digits for fitness numbers, dates, and measurements in Arabic (`ar-SA-u-nu-latn`).

3. **Universal Theme Support:**
   - Always support `light`, `dark`, and `system` theme preferences.
   - Use dynamic tokens from `themeColors()` or `getActiveTheme()`.
   - Ensure WCAG 2.1 AA color contrast.

4. **Data & State Preservation:**
   - Never destroy or reseed user SQLite data during language or theme changes.
   - SQLite (`qooti.db`) is the authoritative storage layer on native platforms.

5. **Quality Gates:**
   Before committing any changes, you must ensure all automated checks pass:
   ```bash
   npm run typecheck
   npm run lint
   npm test
   npx expo-doctor
   ```

6. **Branching & Git Safety:**
   - Never commit directly to `main`.
   - Never discard uncommitted work without explicit confirmation.
