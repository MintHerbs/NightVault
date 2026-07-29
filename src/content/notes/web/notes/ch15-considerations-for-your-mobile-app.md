# Chapter 15: Considerations for your mobile app

*Weeks 15-20 · 2+1 hrs · Developing Mobile Apps*

> **TL;DR** Before writing any mobile code, pick **how** it will be built. There
> are four realistic options and the choice is a trade-off between how much
> device hardware you need, how many codebases you can afford to maintain, and
> whether you need to be in an app store. Your API does not care which you pick,
> so this is a decision about the client only.

## The fundamentals do not change

Everything from Chapters 1 to 14 still applies. HTTP is still HTTP, JSON is still
JSON, your API is unchanged, and validation still has to happen on the server.
What changes is the **client**: a smaller screen, a touch input, an unreliable
network, a battery, and a set of sensors a desktop browser never had.

## The four options

| Approach | What it means | Best when |
| --- | --- | --- |
| **Responsive web** | Your existing site, adapted with CSS to work on small screens. One codebase, no install. | The app is mostly reading and forms, and you need it working this month. |
| **PWA** | A responsive site plus a service worker and manifest, so it installs to the home screen and works offline. | You want an app-like feel and offline support without app stores. |
| **Native** | Built separately per platform. Swift for iOS, Kotlin for Android. | Performance or deep hardware access is the product, e.g. a camera or maps app. |
| **Cross-platform** | One codebase, React Native or Flutter, compiled to both. | You need real device access and store presence but have one team. |

> **Analogy:** you need somewhere to live. **Responsive web** is renting a flat
> and rearranging the furniture: fast, cheap, limited. **PWA** is a good long
> lease with permission to redecorate. **Cross-platform** is a prefab house,
> assembled quickly from standard parts, and if you want something unusual you
> are fighting the kit. **Native** is architect-designed and built twice, once on
> each plot: exactly what you wanted, at twice the cost, forever.

### What each one can actually reach

| Capability | Responsive web | PWA | Cross-platform | Native |
| --- | --- | --- | --- | --- |
| Camera | Limited (file picker) | Yes | Yes | Yes |
| GPS | Yes, while open | Yes | Yes, incl. background | Yes, incl. background |
| Push notifications | No | Yes (limited on iOS) | Yes | Yes |
| Accelerometer | Partial | Partial | Yes | Yes |
| Offline use | No | Yes | Yes | Yes |
| Biometric login | No | No | Yes | Yes |
| App store listing | No | No | Yes | Yes |
| Codebases to maintain | 1 | 1 | 1 | 2 |

## Choosing

![Diagram: a decision path from hardware and store requirements to one of the four approaches](/notes/img/web/ch15-approach-decision.svg)

Work through these in order and the answer usually falls out:

1. **Do you need hardware the web cannot reach?** Background GPS, biometrics,
   Bluetooth, reliable push. If yes, responsive web is out.
2. **Do you need to be in an app store?** For credibility, for paid downloads, or
   because users will look for you there. If yes, you need a real app.
3. **Does it need to work offline?** If yes, you need at least a PWA.
4. **How many codebases can you maintain?** Two native codebases means every
   feature, every bug fix and every review cycle happens twice, forever.
5. **What does the team already know?** A team that knows JavaScript ships a
   working React Native app long before it ships a good Swift one.

> **The honest default for a student project:** cross-platform, or a PWA if you
> do not need the store. Native is the right answer far less often than it feels,
> and "we will do both natively" is how projects run out of semester.

## Design considerations that are genuinely different

Choosing the technology is the easy half. These catch people out:

| Consideration | Why it matters on mobile |
| --- | --- |
| **Touch targets** | A fingertip is roughly 44 to 48 pixels across. Links that work with a mouse are unhittable with a thumb. |
| **The thumb zone** | Holding a phone one-handed, the bottom and centre are easy to reach, the top corners are not. Put primary actions low. |
| **Typing is painful** | Every text field is a cost. Prefer pickers, toggles and sensible defaults. Set `type="email"` so the right keyboard appears. |
| **Unreliable network** | Connections drop mid-request constantly. Every call needs a loading state, an error state, and a retry. |
| **Battery and data** | Polling an API every few seconds drains the battery and burns a data allowance. Use push instead. |
| **Interruptions** | Calls, notifications and app switching happen mid-task. Never lose a half-filled form. |
| **Screen space** | The Chapter 4 form is comfortable on a laptop and cramped on a phone. One column, larger inputs, fewer fields visible at once. |

> **Analogy:** designing for desktop is like writing for someone at a desk with a
> cup of tea. Designing for mobile is like writing for someone on a bus, holding
> a rail, in the rain, being jostled. Same information, and it needs to survive
> much rougher handling.

## What this means for Ares Colony

Our API from Chapters 11 and 12 is already the finished back end. `/api/seats/`
and `/api/apply/` do not change at all.

The recruitment app needs to show remaining seats and submit an application. No
camera, no background location, no biometrics. So:

- A **PWA** would genuinely be enough, and would be by far the fastest route.
- If a store listing is required, **cross-platform** is the sensible next step, and
  reuses the JavaScript you already know.
- **Native** would be a poor use of the time, since nothing in the product needs
  it.

Chapters 16 to 20 assume a real app, because that is where the platform-specific
material lives.

## Recap

- The API is unchanged. This is a client decision.
- Four options: responsive web, PWA, cross-platform, native. Cost rises left to
  right, capability rises with it.
- Decide on hardware needs, store presence, offline, codebase count, and team
  skills, in that order.
- Two native codebases means doing everything twice, forever.
- Touch targets, one-handed reach, typing cost and dropped connections matter more
  than the framework you pick.
