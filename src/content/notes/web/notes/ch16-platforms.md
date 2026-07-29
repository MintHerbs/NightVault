# Chapter 16: Platforms

*Weeks 15-20 · 2+1 hrs · Developing Mobile Apps*

> **TL;DR** Two platforms matter: iOS and Android. They differ in language, in how
> strictly they police what you publish, and in how much variety of hardware you
> have to support. The practical consequences for you are that **every release
> waits in a review queue**, and that **Android's variety is your testing
> problem**.

## The two platforms side by side

|  | iOS | Android |
| --- | --- | --- |
| Store | App Store | Google Play |
| Language | Swift (formerly Objective-C) | Kotlin (formerly Java) |
| Tooling | Xcode, macOS only | Android Studio, any OS |
| Review | Human review, stricter, typically 1 to 3 days | Mostly automated, typically hours, policy checks still apply |
| Distribution | Store only, in practice | Store, or install an APK directly, or other stores |
| Device variety | A few dozen models | Thousands of models, many makers |
| OS adoption | Most users update quickly | Long tail of old versions |
| Developer account | Paid yearly | Small one-off fee |
| Revenue share | Platform takes a cut | Platform takes a cut |

> **You need a Mac to build for iOS.** Xcode does not run on Windows or Linux, and
> Apple's signing process runs through it. This is a real constraint on a student
> project. Cross-platform tools can be developed anywhere but still need macOS for
> the final iOS build.

## Fragmentation, and why it is your problem

iOS runs on hardware Apple designed, in a handful of screen sizes, and most users
are on a recent version within months. You can reasonably test on three devices
and be confident.

Android runs on hardware from dozens of manufacturers, with different screen
sizes, aspect ratios, chipsets, camera behaviours, and vendor modifications to the
OS. A layout that is perfect on one phone can be broken on another that is a year
older and slightly narrower.

> **Analogy:** iOS is a theatre where every seat is the same model, bolted the
> same distance apart. Android is a village hall where everyone brought their own
> chair. The play is the same; you have to make sure it is watchable from a
> beanbag as well as a bar stool.

Practically: design with flexible layouts rather than fixed pixel positions, and
test on the oldest and smallest device you can find, not the newest.

## Getting an app published

![Diagram: the path from a build through signing, review and staged rollout to users](/notes/img/web/ch16-submission-pipeline.svg)

The steps are the same on both platforms, with different names:

1. **Build a release version.** Not the debug build. Optimised, with debugging
   switched off.
2. **Sign it.** A cryptographic signature proving the build came from you. Lose the
   signing key on Android and you cannot update your own app.
3. **Upload** to App Store Connect or the Play Console.
4. **Fill in the store listing.** Description, screenshots for several screen
   sizes, an icon, a category, an age rating, and a privacy policy.
5. **Declare data collection.** Both stores require you to state what data you
   collect and why. Getting this wrong is a common rejection.
6. **Submit for review.**
7. **Release,** either all at once or as a staged rollout to a percentage of users.

### What gets apps rejected

| Reason | Detail |
| --- | --- |
| Permissions you do not visibly use | Requesting location with no feature that needs it |
| Missing or inaccurate privacy declaration | Stating you collect nothing while a library sends analytics |
| Crashes on launch | Reviewers test on a clean device, where your cached login does not exist |
| Broken or placeholder content | Lorem ipsum, dead links, a login with no test account supplied |
| Not enough native value | An app that is only a wrapper around your website |
| Payments outside the store | Taking payment for digital goods without the store's billing |

That last one is worth knowing: both platforms require digital purchases to go
through their billing, and take a cut. Physical goods and services are treated
differently.

## Permissions

Both platforms use runtime permissions: the app asks at the moment it needs
something, and the user can refuse, or grant "only this once".

| Platform | Behaviour |
| --- | --- |
| iOS | Requires a written reason string that is shown in the prompt. Missing it crashes the app. |
| Android | Grouped permissions. If the user refuses twice, the prompt stops appearing at all. |

The consequence for your code is the same on both: **your app must work when the
answer is no.** Chapter 18 covers this properly.

## What this means for you

- Budget for review. Do not schedule a launch on the day you submit. An urgent fix
  can take days to reach users on iOS.
- Version support is a policy decision. Supporting Android versions from five years
  ago multiplies your testing.
- Cross-platform tools do not exempt you from any of this. React Native and Flutter
  compile down to these same two platforms, sign the same way, and queue in the same
  review lines.
- Keep your Android signing key backed up somewhere you will still have it in three
  years.

## Recap

- iOS: fewer devices, faster OS adoption, stricter review, macOS required.
- Android: enormous device variety, faster review, more distribution freedom.
- Every release passes through build, sign, upload, list, declare, review, roll out.
- Most rejections are about permissions and privacy declarations, not code quality.
- Assume any permission can be refused, and design for it.
