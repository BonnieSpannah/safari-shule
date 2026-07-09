# Mobile — Safari Shule

**One Flutter codebase, six targets.** Android, iOS, Web, macOS, Windows, Linux — same UI, same business logic, adaptive layout.

## 1. Why Flutter (and only Flutter)

- Single codebase reduces engineering cost ~60% vs. native-per-platform.
- Skia rendering → pixel-perfect parity across OSes; brand looks the same everywhere.
- Native performance for map + real-time list rendering (parents watching a live bus).
- Excellent offline support (Hive / Drift) — critical because Kenyan mobile networks are inconsistent.
- Same team ships Android + iOS + web (progressive-web-app fallback) simultaneously.

## 2. Target matrix

| Platform | Primary role | Distribution |
|---|---|---|
| **Android** | Driver + Assistant + Parent | Google Play (production track), APK sideload for pilot schools |
| **iOS** | Parent (largely) | App Store — TestFlight for pilots |
| **Web (PWA)** | Parents on feature-phone-adjacent handsets or without app-install permission | Vercel / Cloudflare Pages under `m.safari-shule.co.ke` |
| **macOS** | Ops console **companion** (not a replacement for the web admin) | Notarized DMG via GitHub Releases |
| **Windows** | Same as macOS — school office desktop use | Signed MSIX via winget |
| **Linux** | Same, for tech-forward schools | AppImage + Snap |

**One code path, one release cadence.** Platform-specific tweaks live in `lib/platform/*` behind a `PlatformService` abstraction (permissions, biometrics, notifications, background location).

## 3. Application shells

Three role-scoped shells share a single build:

- **Driver shell** — start shift, accept trip, mark boarding, trigger SOS, receive dispatch messages
- **Assistant / Caretaker shell** — scan RFID (NFC on Android + iOS 13+, camera QR fallback on web/desktop), boarding/alighting confirmations
- **Parent shell** — child list, live bus map, notifications, payments, receipts, statement of account, DSR requests, consent management

The shell is selected at login based on the user's role. All three ship in the same binary so a user with multiple roles can switch without reinstalling.

## 4. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Flutter 3.24+ (Dart 3.5) | Stable channel |
| State | **Riverpod 2** | AsyncNotifierProvider for server state; StateNotifier for UI |
| HTTP | **Dio** with retry + circuit breaker interceptors | JWT refresh + trace-id headers |
| Realtime | **socket_io_client** | Sits behind the same `WsGateway` abstraction as the web app |
| Offline | **Drift** (SQLite, type-safe) + **Hive** (KV outbox for pending writes) | See §7 |
| DI | **get_it** + Riverpod | Riverpod for widgets, get_it for services |
| Routing | **go_router** | Declarative, deep-link-friendly |
| Maps | **flutter_map** (OpenStreetMap by default) with **mapbox_maps_flutter** as premium option | Tenant-configurable via feature flag |
| Charts | **fl_chart** | For finance / payments screens |
| Forms | **flutter_hooks** + **reactive_forms** | With shared Zod-parity validators |
| Push | **flutter_local_notifications** + **firebase_messaging** (Android/iOS) + **web_push** (browser) | Server sends the same push payload for all |
| Biometrics | **local_auth** | Optional session unlock |
| RFID / NFC | **flutter_nfc_kit** | Android + iOS |
| Background location (driver) | **flutter_background_geolocation** | Battery-optimized, geofence triggers |
| L10n | Flutter's `intl` package | Swahili + English day one; French/Amharic on roadmap for regional expansion |
| Theming | Material 3 with Safari Shule "Savanna" tokens | Mirrors web `docs/DESIGN-SYSTEM.md` |
| Testing | `flutter_test` + `integration_test` + **golden_toolkit** | Widget + integration + golden-file (pixel) tests per platform |

## 5. Repository layout (M8)

```
apps/mobile/
├── pubspec.yaml
├── analysis_options.yaml           strict lints
├── build.yaml                      code-gen config
├── lib/
│   ├── main.dart
│   ├── app/                        top-level App widget + theme + router
│   ├── core/
│   │   ├── api/                    Dio + interceptors + generated client
│   │   ├── auth/                   session, JWT refresh, biometric unlock
│   │   ├── offline/                Drift + Hive + outbox worker
│   │   ├── platform/               permissions, notifications, background location
│   │   ├── realtime/               socket_io wrapper
│   │   ├── telemetry/              client_events emitter
│   │   └── config/                 flavors, env, feature flags
│   ├── shared/
│   │   ├── design/                 Savanna tokens as Dart classes
│   │   ├── widgets/                Button, Input, Card, Sheet — mirrors web primitives
│   │   ├── forms/                  form-field wrappers
│   │   └── i18n/                   Swahili + English strings
│   ├── features/
│   │   ├── auth/                   login, biometric setup, MFA
│   │   ├── driver/                 shift, trip, attendance, SOS
│   │   ├── caretaker/              RFID/NFC scan, attendance
│   │   ├── parent/                 children, live bus, payments, receipts, consent, DSR
│   │   ├── notifications/          inbox + push handling
│   │   ├── settings/               profile, security, DNC preferences, theme
│   │   └── impersonation-banner/   red banner when a support session is active
│   └── platform/
│       ├── android/
│       ├── ios/
│       ├── web/                    PWA manifest + service worker overrides
│       ├── macos/
│       ├── windows/
│       └── linux/
├── test/
│   ├── unit/
│   ├── widget/
│   ├── golden/
│   └── integration/
├── android/
├── ios/
├── web/                            index.html, manifest.json, sw.js
├── macos/
├── windows/
└── linux/
```

## 6. Adaptive UI — one layout, six sizes

We use **layout builders** that inspect `MediaQuery.of(context).size.width` and switch between:

- **Compact** (< 600 dp) → phone
- **Medium** (600–840 dp) → tablet + foldable
- **Expanded** (> 840 dp) → tablet-landscape, desktop, web

Navigation:

- Compact: bottom nav bar (3 tabs for parent, 3 for driver, 2 for caretaker)
- Medium: navigation rail
- Expanded: navigation drawer + master-detail split view

Everything above is one widget tree with an `AdaptiveScaffold` wrapper — no forked layouts.

## 7. Offline-first — because networks fail

**The rule**: every write attempts online first; if it fails, it lands in the **offline outbox** (Hive box `outbox`), reconciled when connectivity returns.

Writes that must survive offline:

- Boarding / alighting events
- SOS trigger (yes — SOS works offline; buffered + resent within seconds of reconnect)
- Location pings (batched, deduplicated)
- Attendance overrides

Reads served from Drift when offline:

- Assigned children / route / vehicle
- Recent trips
- Notification inbox
- Fees / statement of account (last synced)

**Sync model** — event-sourced. Each offline event has a client-generated UUID (`clientEventId`) so the server can idempotently accept, avoiding duplicates. Conflict resolution: last-writer-wins for most events; SOS is always additive (never overwritten).

## 8. Realtime

One shared `SocketService` connects on login. Subscriptions:

- `tenant:<tid>:trip:<tripId>` — driver + caretaker + assigned parents
- `tenant:<tid>:incidents` — ops (not on mobile) + driver (for driver's assigned incidents)
- `user:<userId>:notifications` — replaces push while app is open

Reconnect strategy — exponential backoff 1s → 60s; on visibility change (app back to foreground), immediate reconnect + delta pull.

## 9. Push notifications

Unified payload from the server; each platform's transport is a detail:

- Android + iOS → FCM (with APNs upstream on iOS)
- Web (PWA) → Web Push (VAPID)
- Desktop → local system notifications when the app is running

Categories:

- `trip.started` / `trip.arrived-stop` / `trip.completed`
- `attendance.child-boarded` / `attendance.child-alighted`
- `incident.sos` (high priority; bypass DND on Android)
- `payment.receipt` (M-Pesa receipt with eTIMS reference)
- `notice.school` (marketing-adjacent — respects DNC)

Every push respects the tenant + user DNC + quiet-hours rules server-side, then client-side (double-check because push can be delivered even during quiet hours by the OS).

## 10. Platform-specific concerns (isolated behind interfaces)

| Concern | Android | iOS | Web | Desktop |
|---|---|---|---|---|
| Background location (driver) | `flutter_background_geolocation` with foreground service | `flutter_background_geolocation` with Always Location | Foreground only + user-consent banner | Foreground only |
| Biometrics | Fingerprint / Face | Face ID / Touch ID | WebAuthn | Windows Hello / Touch ID |
| NFC | Yes | Yes (iOS 13+, background NFC scanning iOS 14+) | No — camera-based QR fallback | No — camera-based QR fallback |
| Storage | Encrypted SQLite (Drift + sqlcipher plugin) | Same | IndexedDB via Drift's web target | Same as mobile |
| Deep links | App Links | Universal Links | Standard URLs | Custom URI schemes |
| App update | Play Store | App Store | Service worker + `skipWaiting` | Sparkle / Squirrel |

All the above are called through `PlatformService` — feature code never imports platform packages directly.

## 11. CI/CD (M8)

Workflows:

| File | Trigger | Output |
|---|---|---|
| `mobile-ci.yml` | PR + push main | analyze, format, unit + widget + golden tests, coverage |
| `mobile-build-android.yml` | push main → tag | signed AAB + APK, uploaded to Firebase App Distribution (internal), Play Store (production track) |
| `mobile-build-ios.yml` | push main → tag | signed IPA, uploaded to TestFlight (internal) + App Store Connect (production) |
| `mobile-build-web.yml` | push main | PWA build → Cloudflare Pages (`m.safari-shule.co.ke`) |
| `mobile-build-desktop.yml` | on tag | signed macOS DMG, signed Windows MSIX, AppImage — attached to GitHub Release |

Signing keys in GitHub Environments; only usable from the tagged workflow.

## 12. Store compliance

- **Google Play** — targets latest API level; Data Safety form auto-generated from Prisma `/// @data.category` tags. Family Policy program enrolment (children's data present).
- **App Store** — App Tracking Transparency (ATT) prompt only if tracking added (not currently). Kids Category compliance if enrolled.
- **Chrome Web Store / TWA** — not required; PWA installs from the web.
- **Age gate** — the app is used by parents about their children, not directly by children. In future, a "student self-service" build would need COPPA + KOICA + DPA §33 (children's data) reviews.

## 13. Accessibility

- Every widget has a `Semantics` label.
- Minimum tap target 48×48 dp.
- Colour contrast ≥ 4.5:1 (design tokens tuned for this).
- Screen-reader tested on TalkBack + VoiceOver (release checklist).
- Dynamic type: text scales up to 200% without breaking layout.

## 14. Localization

- English + Swahili on day one; strings in `.arb` files.
- Right-to-left ready (no RTL languages today, but layout uses `Directionality`-aware widgets).
- Number, date, currency formatted per locale (KES vs. USD, EAT vs. local device time).

## 15. Governance parity with web + API

- Same DNC + quiet-hours rules honoured client-side.
- `<Sensitive>` equivalent (`SensitiveText` widget) masks P1 fields unless authorized.
- Screenshot detection on Android + iOS (`flutter_screenshot_callback`) → emits `client_events.screenshot_attempt`.
- Impersonation banner: when logged in via impersonated token, the entire app is wrapped in a red border + persistent banner.
- Session idle → auto-lock (biometric or PIN); auto-sign-out after configurable window.

## 16. Rollout plan (M8)

1. Alpha (internal) — driver + caretaker shells on Android with the pilot school (Hillcrest demo tenant).
2. Beta (Firebase App Distribution + TestFlight) — parent shell added; 3–5 pilot schools.
3. Public — Play Store + App Store on the same day; PWA public simultaneously.
4. Desktop — after 3 months of stable mobile, if demand exists.

## 17. Success metrics

- Crash-free sessions ≥ 99.5% (Sentry / Firebase Crashlytics).
- App start (cold) < 2s on Android mid-range (Redmi 9-class).
- Live map first paint < 1s on 3G.
- Offline SOS delivery: median 8 seconds after reconnect.
- App size: Android AAB < 30 MB; iOS IPA < 60 MB.
