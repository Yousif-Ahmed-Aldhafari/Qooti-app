# Qooti Cross-Platform UI/UX Engineering Principles

**Status:** Permanent Project Architecture Standard  
**Version:** 1.0.0  
**Scope:** All existing and future user interfaces, components, and screen flows in Qooti  
**Target Platforms:** Android (API 26+) & iOS (16.0+)  
**Framework:** React Native / Expo SDK 58 / TypeScript  
**Languages:** English (LTR) & العربية (RTL)  

---

## 1. Core Mission & Philosophy

Qooti delivers a high-performance, wellness, nutrition, and workout tracking experience across Android and iOS. The user interface must feel **indigenous** to both operating systems while maintaining an unmistakable, cohesive **Qooti brand identity**.

We reject the false dichotomy between generic cross-platform compromises and costly dual-codebase divergence. Qooti adheres to **one unified codebase** that delivers **two equally polished, platform-appropriate experiences**.

---

## 2. The Twelve Binding Principles

### Principle 1: Platform Dual-Citizenship
Every UI feature, screen, component, and interaction must be designed, implemented, and verified for **both Android and iOS** from day one. No feature is complete if it only satisfies one operating system.

### Principle 2: Unified Qooti Brand Identity
Qooti's visual signature is defined by:
- **Calm, modern wellness aesthetics:** Light card surfaces (`#FFFFFF` in light mode, `#161B18` in dark mode), soft organic backgrounds (`#F7F8F3` / `#0D110F`).
- **Signature Green Accents:** Primary vibrant green (`#2F9E67` / `#22C55E`) and energetic lime (`#DFF6B8`) representing vital health and physical progress.
- **Translucent Layering (Glassmorphism):** High-taste frosted card shells and floating navigation with controlled blur effects.
- **Consistent Rounded Geometry:** Smooth radii (`radius.md: 12px`, `radius.lg: 20px`, `radius.pill: 9999px`) creating approachable, tactile cards and buttons.

Platform conventions adapt *around* this identity—they do not erase it.

### Principle 3: Apple Human Interface Guidelines (HIG) Alignment
When running on iOS, Qooti must respect:
- **Visual hierarchy:** Clean typography hierarchy using Apple system font metrics (SF Pro), subtle 0.5pt hair-line borders (`colors.border`), and frosted blur vibrancy (`expo-blur`).
- **Interaction Feedback:** Standard iOS press feedback via smooth opacity dimming (`opacity: pressed ? 0.72 : 1`) with subtle spring curves.
- **Navigation:** Standard navigation bars with left/right bar buttons, swipe-from-edge back gestures, and standard Tab Bar behaviors.
- **Touch Targets:** Minimum accessible touch target size of **44 × 44 pt**.
- **Safe Area Insets:** Dynamic Island, notch, and home indicator clearance via `react-native-safe-area-context`.

### Principle 4: Material Design 3 (M3) Alignment
When running on Android, Qooti must respect:
- **Elevation and Surfaces:** Expressive tonal elevation (`elevation: 1–8`, surface tinted cards) rather than pure blur.
- **Interaction Feedback:** Standard Material ink ripple (`Pressable` with `android_ripple={{ color: colors.cardMuted, borderless: false }}`) on all tactile elements.
- **Navigation & Back Flow:** Strict compliance with Android system back navigation (both 3-button navigation and edge gesture navigation). Pressing Back on sub-screens must navigate up the hierarchy; pressing Back on Home must exit cleanly.
- **Touch Targets:** Minimum accessible touch target size of **48 × 48 dp**.
- **System Navigation Clearance:** Explicit clearance for Android 3-button navigation bars (`insets.bottom` up to 48dp) and transparent status bar edge-to-edge rendering.

### Principle 5: Shared Code by Default
By default, screens, domain models, business logic, translation keys, database repositories, and layout structures are shared. Dual implementations are prohibited unless a genuine platform divergence justifies it.

### Principle 6: Justified Platform Divergence
Platform divergence is permitted exclusively through:
1. `Platform.select({ ios: ..., android: ... })` for micro-tuning (touch feedback, elevations, shadow vs elevation, font weights, keyboard return types).
2. Platform-specific components (e.g., `Component.android.tsx` vs `Component.ios.tsx`) when native controls or gestures radically differ.
3. Operating-system specific hooks (e.g., Android `BackHandler`, iOS swipe gestures).

*Rule:* Never fork an entire screen when a localized platform hook or token will suffice.

### Principle 7: Bidirectional Dual-Locale Parity (English LTR & Arabic RTL)
Qooti treats Arabic as a first-class citizen, not an afterthought:
- **Zero layout distortion:** Screens must symmetrically mirror in Arabic without double-mirroring.
- **Directional Iconography:** Direction-sensitive icons (arrows, chevrons, back navigation, progress indicators) must mirror automatically using `mirrorDirectionalIcon()`.
- **Measurement & Digits:** Fitness numbers, dates, weights, sets, and calories must preserve legible Latin digits (`u-nu-latn`) across Arabic locales for maximum readability in health contexts.
- **Text Alignment:** All text components must enforce language-aware `textAlign` and `writingDirection` (`activeTextAlign()`, `activeWritingDirection()`).

### Principle 8: Universal Theme Parity (Light & Dark)
All UI elements must support:
- `light`: Crisp, high-contrast daylight theme.
- `dark`: Low-strain, battery-efficient OLED/AMOLED dark theme.
- `system`: Automatic synchronization with OS appearance preference.
- All text and interactive controls must pass **WCAG AA contrast** (minimum 4.5:1 for body text, 3:1 for large headings and icons).

### Principle 9: Ergonomics, Safe Areas & Dynamic Type Accessibility
- **Safe Areas:** Every screen must wrap inside safe area boundaries. Bottom navigation, sticky action bars, and headers must never be clipped by notches, cutouts, or system navigation bars.
- **Dynamic Type & Font Scaling:** UI layouts must not break when users increase OS font size (Dynamic Type on iOS or Font Scaling on Android). Avoid hardcoded container heights that clip text.
- **Keyboard Ergonomics:** Every form must handle virtual keyboards smoothly via `KeyboardAvoidingView` or `ScrollView` with `keyboardShouldPersistTaps="handled"`. Inputs must not be obscured by the soft keyboard.

### Principle 10: Data & State Preservation
UI transitions, theme changes, and language switches must **never lose user input or state**.
- SQLite is the single source of truth for persistent data.
- Language switches must never reseed sample data or wipe user form inputs.
- Temporary screen state must be preserved across app minimization and orientation lock.

### Principle 11: Cross-Platform Acceptance Required
No screen or UI component may be marked "done" without explicit verification on both Android and iOS targets against the `platform-acceptance-matrix.md`.

### Principle 12: Intentional Platform Documentation
Any intentional UI or UX divergence between Android and iOS must be documented in the component source code and in the design system documentation with clear rationale.

---

## 3. Engineering Token Standards

### Spacing Scale
All layout margins, paddings, and gaps must strictly use `spacing` tokens:
```typescript
export const spacing = {
  xs: 4,    // Micro spacing (icon-to-text, badge insets)
  sm: 8,    // Dense spacing (pill padding, chip gaps)
  md: 12,   // Standard intra-component gap (card item rows)
  lg: 16,   // Standard component padding & screen edge minimum
  xl: 20,   // Standard screen horizontal padding & section gaps
  xxl: 24,  // Major section separation
  xxxl: 32, // Hero / Splash spacing
} as const;
```

### Corner Radius Scale
```typescript
export const radius = {
  sm: 6,    // Checkboxes, tags, mini-chips
  md: 12,   // Form inputs, list items, action buttons
  lg: 20,   // Standard content cards, metric tiles
  xl: 26,   // Modal sheets, hero containers
  pill: 9999, // Floating pills, chips, circular avatars
} as const;
```

### Minimum Touch Targets
```typescript
export const minTouchTarget = Platform.select({
  android: 48, // Material 3 recommended minimum
  ios: 44,     // Apple HIG recommended minimum
  default: 48,
});
```

---

## 4. Enforcement & Governance

1. **Pre-Commit Checks:** All modifications must satisfy `npm run typecheck`, `npm run lint`, and `npm test`.
2. **Component Pull Requests:** Must include screenshots/recordings of both iOS and Android renderings in both English (LTR) and Arabic (RTL).
3. **No Third-Party Bloat:** Do not introduce heavy UI component libraries (e.g., Paper, NativeBase, Tamagui) that alter the lightweight bundle or fight with Expo 58 / React Native 0.88 architecture. Extend Qooti's native design system primitives.
