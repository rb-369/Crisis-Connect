# Push notifications, haptics, and physical/gesture shortcuts — readiness plan

Status as of 2026-09-03: **mechanisms are scaffolded, nothing is wired to
business logic.** Nobody has decided which server events should trigger a
push, a haptic pulse, or what a shortcut should do — that's intentional,
per the ask. This doc exists so that decision is a config/call-site change,
not a research project.

Everything here is on the Flutter volunteer app + backend. Web Push for the
React requester side is out of scope for now (different mechanism entirely —
Push API + Service Worker + VAPID, not FCM/APNs) and requesters are
one-shot/no-login by PRD design, so persistent push matters far less there.

---

## 1. Push notifications

### The real constraint: two tiers, and tier 2 needs your credentials

**Tier 1 — local notifications, works today, zero external accounts.**
`flutter_local_notifications` displays a system notification from code
already running in the app (foreground, or briefly in background). Good for
"you have a new nearby request" while the WS connection is still alive, or
turning a WS-delivered event into a system-tray notification instead of an
in-app banner. This is fully wired and testable right now — no Firebase, no
Apple Developer Program action needed.

**Tier 2 — real remote push (works when the app is killed/backgrounded,
no live WS connection needed), needs a Firebase project.** This is the
actual "phone buzzes even though the app isn't open" behavior, and it is
**not buildable without external setup only you can do**:
1. Create a Firebase project, add the iOS + Android apps to it.
2. Download `GoogleService-Info.plist` (iOS) and `google-services.json`
   (Android) into the Flutter project.
3. Generate an APNs Auth Key in your Apple Developer account, upload it to
   Firebase (Project Settings → Cloud Messaging → Apple app configuration).
4. Add `firebase_core` + `firebase_messaging` to `pubspec.yaml`.

Deliberately **not done yet**: adding the Firebase SDK before those files
exist causes iOS builds to crash at launch (`GoogleService-Info.plist` not
found) — it would break the app that's currently verified working end-to-end
on the simulator, for zero functional benefit (you can't send a real push
without the project anyway). The backend and client are shaped so this is a
clean drop-in once the credentials exist — see "Wiring it up later" below.

### What's built now

- **Backend**: `device_tokens` table (`helper_id`, `platform`, `token`),
  `POST /helpers/{id}/device-tokens` (register), `DELETE .../{token}`
  (unregister). `app/push.py` has `send_push(helper_id, title, body, data)`
  — right now it just logs what it *would* send. No endpoint calls it yet.
- **Flutter**: `lib/notifications.dart` — `NotificationService` requests
  permission, can display a local notification immediately
  (`showLocal(title, body)`), and has a `registerForPush()` stub that's a
  clean no-op until Firebase exists.

### Wiring it up later (once you have a Firebase project)

1. Drop the config files into `volunteer_app/ios/Runner/` and
   `volunteer_app/android/app/`.
2. Add `firebase_core`, `firebase_messaging` to `pubspec.yaml`; call
   `Firebase.initializeApp()` in `main()`.
3. In `NotificationService.registerForPush()`, get the FCM token and
   `POST` it to `/helpers/{id}/device-tokens`.
4. In `backend/app/push.py`, replace the log line with an actual FCM Admin
   SDK / HTTP v1 API call (needs a service-account JSON, same project).
5. Decide the actual trigger points and call `send_push(...)` from them —
   candidates already flagged with `# PUSH:` comments in the routers:
   `requests.py` (new high-urgency request near an available, offline
   volunteer), `messages.py` (new chat message while recipient's app is
   backgrounded), `matches.py` (status change the other party should know
   about immediately).

---

## 2. Haptics

No external dependency, no risk, fully working today via Flutter's built-in
`HapticFeedback` (from `flutter/services.dart` — already in the SDK, nothing
to add to `pubspec.yaml`).

`lib/haptics.dart` — `Haptics` with semantic calls: `Haptics.success()`,
`Haptics.warning()`, `Haptics.critical()` (a distinct triple-pulse pattern,
the closest Flutter equivalent to a physical alert most similar to what an
emergency app wants for "someone needs help right now"), `Haptics.error()`,
`Haptics.selection()`. Nothing calls these yet. Natural call sites once
decided: successful accept, lost the accept race (409), a high-urgency
request landing in the feed, message received.

---

## 3. Gesture / physical-button shortcuts

### The real constraint: no third-party app can intercept the power button

Neither iOS nor Android exposes a public API for a third-party app to detect
power-button presses, double/triple-press patterns, or any hardware button
beyond volume keys in narrow contexts (media playback). This isn't a gap in
what's built — it's not accessible to any app you could ship to the App
Store or Play Store. Apps that appear to do this either (a) are OS
accessibility settings the *user* configures, which then launch or deep-link
into the app, or (b) are jailbreak/root-only.

**The genuine, shippable equivalents**, in order of how close they get to
"instant, no-unlock-needed trigger":

| Mechanism | Platform | What it needs |
|---|---|---|
| **Back Tap** (double/triple-tap the *back* of the phone) → runs a Shortcut → opens a URL | iOS 14+ | Nothing from us to build beyond the deep link (below) — user enables it in Settings → Accessibility → Touch → Back Tap, points it at our URL scheme. |
| **Action Button** (iPhone 15 Pro+) → Shortcut → URL | iOS | Same deep link; user assigns it in Settings. |
| **Siri Shortcut** ("Hey Siri, send SOS") | iOS | Same deep link, surfaced via `NSUserActivity`/App Intents donation (not yet built — see below). |
| **Home-screen long-press → App Shortcut** | Android | Static shortcut declared in `AndroidManifest.xml` (not yet built). |
| **Quick Settings Tile** (swipe down, tap once, no unlock) | Android | A `TileService` — native Kotlin, not yet built (flagged as next step, see below). |
| **Shake the phone** | iOS + Android | Fully buildable *today*, in Dart, no OS configuration by the user needed. |

### What's built now

- **Deep link**: `crisisconnect://` URL scheme registered in both
  `Info.plist` and `AndroidManifest.xml`. `lib/deep_links.dart` listens for
  incoming links via `app_links` and logs them against an empty dispatch
  table (`Map<String, VoidCallback>`) — so "Back Tap → open Shortcuts app →
  point it at `crisisconnect://sos`" already reaches the app; deciding what
  `sos` *does* is a one-line addition to that map.
- **Shake gesture**: `lib/shake.dart` — `ShakeDetector` using `sensors_plus`,
  fires an `onShake` callback (currently unset) on a hard shake. This is the
  one item in this section that's a complete, working, physical-gesture
  trigger *today*, no user OS configuration required.

### Explicitly deferred (flagged, not built)

- **Android Quick Settings Tile** — needs a native Kotlin `TileService`
  class + manifest registration, genuinely separate from the Flutter/Dart
  layer. Real value (closest thing to "one tap, no unlock, from anywhere on
  Android"), but this session only built and verified against iOS Simulator
  — adding un-verified Android-native code isn't worth the risk without a
  way to test it here.
- **iOS Siri Shortcuts / App Intents donation** — needs `NSUserActivity` or
  the App Intents framework wired into the native iOS project; the deep link
  alone already covers the Back Tap / Action Button path, which is the more
  practical win for less native code.
- **Static Android App Shortcut** (home-screen long-press menu) — a manifest
  entry, cheap, just not done yet.

---

## Summary: what to do when you're ready to decide behavior

Every piece above is reachable and callable but inert. To wire something up:
1. Push: decide the trigger, add `await send_push(...)` at that call site
   (backend) — once Tier 2 exists; `showLocal(...)` (Flutter) works today.
2. Haptics: call `Haptics.<name>()` at the decided moment.
3. Shortcuts: add an entry to the dispatch map in `lib/deep_links.dart`, or
   set `ShakeDetector.onShake` in `lib/shake.dart`.

No further plumbing should be required for any of these three.
