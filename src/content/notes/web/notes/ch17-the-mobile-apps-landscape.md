# Chapter 17: The mobile apps landscape

*Weeks 15-20 · 2+1 hrs · Developing Mobile Apps*

> **TL;DR** Building the app is the easy part. Almost nobody will find it by
> accident: people spend nearly all their phone time in apps they already have.
> So decide early what **category** you are in, how you expect to be **found**,
> and how you intend to make **money**, because all three change what you have to
> build on the server.

## The uncomfortable numbers

Some context before you design anything:

- People spend the overwhelming majority of their phone time in a **handful** of
  apps they already have installed.
- A large share of installed apps are opened once and never again.
- Store search is how most discovery happens, and it rewards apps that already
  have installs and reviews. New apps are invisible by default.
- Getting someone to install an app is much harder than getting them to visit a
  web page. Every step, finding it, downloading, granting permissions, signing up,
  loses people.

> **Analogy:** opening an app is like opening a shop. Opening a website is like
> handing out a leaflet. The shop is nicer once someone is inside, but you have to
> persuade them to walk through a door first, and a leaflet needs no such
> persuasion.

This is the strongest practical argument for the PWA option in Chapter 15: no
install step at all.

## Categories

Which category you are in is not marketing trivia. It dictates your design.

| Category | User's intent | Design implication |
| --- | --- | --- |
| **Utility** | Get in, do one task, get out | Speed and clarity beat everything. Success is a short session. |
| **Social / communication** | Check for something new | Needs push notifications and realtime updates. Success is frequent sessions. |
| **Commerce** | Browse and buy | Needs trust signals, saved details, and a payment flow that survives interruption. |
| **Entertainment / media** | Fill time | Success is a long session. Needs offline playback and recommendations. |
| **Productivity** | Do real work over time | Needs sync across devices, offline editing, and conflict resolution. |

Notice that "success" means the opposite thing for a utility app and an
entertainment app. A long session in a utility app usually means the user is
struggling.

## Discovery

![Diagram: the funnel from store impression through install to a retained user](/notes/img/web/ch17-discovery-funnel.svg)

Each step of that funnel loses most of the people who reached it, which is why the
early steps matter so much more than they feel like they should.

**App Store Optimisation (ASO)** is the store equivalent of SEO:

| Lever | Why it matters |
| --- | --- |
| Title and subtitle | Weighted heavily in store search |
| Keywords | The terms you actually expect people to type |
| Icon | The single biggest influence on whether a listing gets tapped |
| Screenshots | Most people judge from these alone and never read the description |
| Ratings and reviews | Both ranking signal and social proof |
| Update frequency | A stale app ranks worse and looks abandoned |

Beyond the store, the routes that actually work are word of mouth, an existing
audience such as your website, and being embedded in an institution that tells
people to install it.

## Monetization, and what it costs you to build

This is where the landscape reaches back into your API. Every model needs server
support.

| Model | How it works | What your backend must do |
| --- | --- | --- |
| **Free** | No revenue | Nothing extra |
| **Paid download** | One up-front payment | Nothing extra, the store handles it |
| **Freemium / IAP** | Free, pay to unlock features | Record entitlements per user, and verify purchase receipts with the store |
| **Subscription** | Recurring payment | An endpoint that reports active status, plus handling renewals, expiry, refunds and grace periods |
| **Advertising** | Free, ads shown | An ad SDK, and a privacy declaration covering what it collects |

Two warnings worth carrying forward:

**Never trust the client about entitlements.** If the app says "this user is
premium", an attacker changes it, exactly as in Chapter 13. Verify the purchase
receipt server-side and let the server decide what the user may access.

**Ads and subscriptions both add privacy obligations.** An ad SDK collects data on
your behalf, and you have to declare it in the store listing (Chapter 16). "I did
not know the library did that" is not a defence.

> **Analogy:** subscriptions are a gym membership, and the hard part is not taking
> the payment, it is knowing exactly who is currently a member, who lapsed
> yesterday, and who is in a two-week grace period after a failed card. That
> bookkeeping is server work, and it is most of the job.

## Where Ares Colony fits

The recruitment app is squarely a **utility** app. Someone opens it, checks seats
or applies, and leaves. Success is a short session.

That gives us clear answers:

- **No monetization.** It exists to collect applications, so no IAP, no ads, no
  subscription endpoints, and no receipt verification.
- **Discovery is not via the store.** People arrive from the recruitment website,
  so the store listing is a formality rather than a growth channel.
- **Push is optional but valuable.** "Your application status changed" is a genuine
  reason to notify, and it reuses Chapter 18's mechanism.
- **Offline matters less than it might.** Checking live seat counts inherently needs
  the network. A cached last-known value with a clear "as of" timestamp is enough.

The whole thing stays a thin client over the same Django API.

## Recap

- Most phone time goes to apps people already have. Assume you will not be found
  by accident.
- Your category decides what "success" means, and long sessions are not always good.
- The install funnel loses people at every step, so the icon and screenshots do more
  work than the description.
- Every monetization model except "free" adds server work, and entitlements must be
  verified on the server.
- Ares Colony is a utility app: short sessions, no monetization, discovery from the
  website.
