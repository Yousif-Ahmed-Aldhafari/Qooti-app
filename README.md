# Qooti / قوتي

Qooti is a cross-platform Expo mobile app for tracking meals, calories, macronutrients, workouts, and daily/weekly health progress.

Built with:

- Expo + React Native
- TypeScript
- React Navigation
- AsyncStorage local persistence
- English and Arabic localization with RTL-aware layouts

## Run on Windows with iPhone and Expo Go

Run these commands in PowerShell or Git Bash inside:

```bash
D:\Users\yyy\Desktop\Qooti-app
```

Install dependencies:

```bash
npm install
```

Start Expo:

```bash
npm run start
```

Then:

- Install **Expo Go** from the iPhone App Store.
- Make sure the iPhone and Windows laptop are on the same Wi-Fi network.
- Scan the QR code shown in the terminal or Expo DevTools.
- Qooti should open on the iPhone through Expo Go.

If the QR code does not open:

- Confirm both devices are on the same network, not guest Wi-Fi or a VPN.
- Allow Node.js/Expo through Windows Firewall if prompted.
- Restart Expo in LAN mode with cache cleared:

```bash
npx expo start --lan --clear
```

- If local network discovery is blocked, use tunnel mode:

```bash
npx expo start --tunnel
```

For Android:

- Install Expo Go from Google Play, then scan the QR code.
- Or start an Android Emulator and press `a` in the Expo terminal.

## Scripts

```bash
npm run start
npm run android
npm run ios
npm run web
npm run typecheck
```

On Windows, `npm run ios` is only useful for opening a physical iPhone through Expo Go. iOS Simulator requires macOS. Future production builds can use EAS Build without needing Xcode locally.

## MVP Features

- Onboarding and language selection
- English and Arabic UI
- RTL-aware Arabic layout and LTR English layout
- Bottom tabs: Dashboard, Meals, Workouts, History, Settings
- Stack screens for add/edit/detail flows
- Add, edit, delete, and persist meals
- Add food items with quantity, unit, calories, protein, carbs, and fat
- Meal and daily nutrition totals
- Add, edit, delete, and persist workout sessions
- Add exercises with sets, reps, weight, duration, and notes
- Dashboard with today and weekly summaries
- History screen with meal/workout filtering
- Local settings for language, theme mode, and measurement units
- Sample seed data on first app launch

## Project Structure

```text
App.tsx
app.json
package.json
src/
  components/
    common/
    dashboard/
    meals/
    workouts/
  constants/
  data/
  hooks/
  i18n/
  models/
  navigation/
  screens/
    onboarding/
    dashboard/
    meals/
    workouts/
    history/
    settings/
  services/
  store/
  theme/
  utils/
```

## Local Data

The MVP stores data on the device with AsyncStorage:

- Meals: `src/services/mealService.ts`
- Workouts: `src/services/workoutService.ts`
- Settings: `src/services/settingsService.ts`
- Seed data: `src/data/seedData.ts`

If no saved meals or workouts exist, seed data is loaded once. After that, edits are stored locally.

## Translations

Translations live in:

- `src/i18n/en.json`
- `src/i18n/ar.json`

To add a new label:

1. Add the same key to both JSON files.
2. Use it in code with `t('section.key')`.
3. Keep Arabic natural and concise.
4. Check the screen in both languages from Settings.

RTL helpers are exposed through `src/hooks/useLanguage.ts`.

## Future-Ready Areas

The structure is prepared for:

- User accounts
- Cloud sync
- Barcode scanning
- Food database APIs
- Charts and analytics
- Reminders
- Calorie and macro goals
- Weight tracking
- Progress photos
- Report export
- Apple Health / Google Fit integrations

For production later, configure EAS Build and keep Expo-compatible libraries unless a custom development build is intentionally introduced.
