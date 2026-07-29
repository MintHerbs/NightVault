# Chapter 15: Considerations for your mobile app

*Week 15 · 2+1 hrs*

Before writing a line of mobile code, decide how it will be built. Same core skills, HTML/CSS/JS, APIs, data, apply, mobile changes the platform and constraints, not the fundamentals.

| Approach | What it means | Trade-off |
| --- | --- | --- |
| Responsive web | Your existing website, adapted with CSS to work on small screens. Same codebase. | Fastest, but no real device hardware access, no app store presence. |
| Native | Built per platform, Swift for iOS, Kotlin for Android. | Best performance and full device access, but two separate codebases. |
| Hybrid / cross-platform | One JavaScript codebase, React Native or Flutter, compiles to both iOS and Android. | One codebase, most device access, small performance cost. |

## Questions to ask before choosing

* Does the app need camera, GPS, or push notifications? If yes, responsive web alone usually isn't enough.
* Is there budget and time for two native codebases, or does the team need to move fast with one?
* Does it need to be discoverable in an app store, or is a mobile-friendly website enough?

> Our Ares Colony API from Chapters 11 and 12 doesn't care which of these you pick. Any of them can call the same `/api/apply/` endpoint. The decision is entirely about the client, not the server.
