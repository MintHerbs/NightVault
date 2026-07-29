# Chapter 18: Sensor-aware applications

*Weeks 15-20 · 2+1 hrs · Developing Mobile Apps*

> **TL;DR** Sensors are the real reason to build an app rather than a website. Every
> one of them follows the same three-step pattern: **ask permission, read the
> value, react to it.** The hard part is never the reading. It is handling the user
> saying no, and not flattening the battery.

## What makes an app different

A browser page is a guest in a sandbox. An installed app can, with permission, reach
the hardware directly.

| Sensor | Typical use | Cost to be aware of |
| --- | --- | --- |
| GPS / location | Maps, "near me", geofencing | Heaviest battery drain of any sensor |
| Accelerometer | Step counting, shake gestures, orientation | Very cheap to read |
| Gyroscope | Rotation, AR, games | Cheap, but high sample rates add up |
| Magnetometer | Compass heading | Cheap, easily confused by nearby metal |
| Camera | QR scanning, photo capture, AR | Heavy, and the most privacy-sensitive |
| Microphone | Voice input, recording | Heavy privacy expectations |
| Biometrics | Fingerprint or face login | Cheap, and the result never leaves the device |
| Proximity / ambient light | Screen-off in a pocket, auto-brightness | Cheap |
| Push notifications | Server-initiated wake-up | Effectively free, and covered below |

## The pattern, every time

```
check → request → handle the answer → read → react
```

1. **Check** whether you already have permission. Do not prompt if you do.
2. **Request** it, at the moment the feature is used, not on first launch.
3. **Handle the answer**, including "no" and "only this once".
4. **Read** the sensor.
5. **React**, and stop reading when you no longer need it.

![Diagram: the permission lifecycle from first request through denial and settings](/notes/img/web/ch18-permission-lifecycle.svg)

### Ask at the right moment

The single biggest mistake is prompting for everything on first launch. A user who
has been open for four seconds has no idea why you want their location, so they say
no, and on Android a second refusal means **the prompt never appears again**. You
have permanently lost the capability.

> **Analogy:** asking for someone's home address the moment you meet them gets a
> refusal. Asking after they have agreed to buy a sofa, when you say "where shall we
> deliver it?", gets an answer. Same question, and only the timing changed.

Ask when the reason is self-evident, and say why in one short sentence before the
system prompt appears.

### Assume the answer is no

Every sensor feature needs a working path for refusal. Not an error, not a dead
screen: a usable alternative.

| Feature | If permission is refused |
| --- | --- |
| "Find launch sites near me" | Offer a text field to type a city |
| Photo attachment | Offer picking an existing file instead |
| QR scan of an application code | Offer typing the code |
| Biometric login | Fall back to password |

## Location in practice

Location has more nuance than the others, and it appears in most exam questions.

| Concern | Detail |
| --- | --- |
| Accuracy tiers | Coarse (network-based, hundreds of metres, cheap) versus fine (GPS, a few metres, expensive) |
| Foreground versus background | Background location is a separate, much harder permission, and stores demand strong justification |
| Time to first fix | A cold GPS start can take many seconds. Show a spinner, never a wrong value |
| Indoors | GPS is unreliable or unavailable inside buildings |
| Battery | Continuous high-accuracy tracking is the fastest way to drain a phone |

> **Request the least you need.** If you are showing which colony sites are in a
> user's country, coarse accuracy is plenty, and it is cheaper, faster and less
> intrusive.

## Push notifications, tying back to Chapter 1

This is the same mechanism that woke the ex's phone in Chapter 1's case study. Your
server does **not** contact the device directly. It asks a platform push service,
Apple's APNs or Google's FCM, to do it.

![Diagram: your server pushing a notification](/notes/img/web/ch18-push-notifications.svg)

The full flow, including the part Chapter 1 skipped:

1. On launch, the app asks the OS to register for push.
2. The OS returns a **device token**, a long unique string for this app on this
   device.
3. The app sends that token to **your** API, which stores it against the user.
4. Later, your server sends a message plus that token to APNs or FCM.
5. The push service delivers it, and the OS wakes the app or shows the alert.
6. The app makes its own normal API call to fetch the details.

Step 6 matters. A push payload is small and not guaranteed to arrive, so you send a
nudge, not the data. "Your application status changed" wakes the app, and the app
then calls `/api/applications/7/` to find out what actually happened.

```python your server asking the push service to deliver
# The token came from the app in step 3 and is stored on the user record.
send_push(
    token=user.device_token,
    title="Ares Colony",
    body="Your application status has changed",
    data={"application_id": 7},      # a hint, not the payload
)
```

Two things to plan for: tokens **expire and rotate**, so refresh them on every
launch and delete ones the service reports as invalid; and delivery is
**best-effort**, so never rely on a push having arrived.

## Privacy

Sensor data is personal data, and both stores treat it that way.

- Declare in the store listing exactly what you collect and why (Chapter 16).
- Collect the minimum. Do not store precise coordinates when a country would do.
- Do not send sensor data to your server unless the feature requires it.
- Never log location or camera data into analytics as a side effect.
- If a library needs a permission, that is *your* declaration to make.

> Getting this wrong is both a rejection risk and, in many countries, a legal one.

## What this means for Ares Colony

The recruitment app needs almost none of this. It has no map, no photo upload and no
AR. Two are worth having:

- **Push notifications**, so an applicant hears about a status change without
  polling. This needs a `device_token` field on the user and one endpoint to receive
  it.
- **Biometric login**, so a returning applicant does not retype a password. The
  result stays on the device and unlocks the stored token from Chapter 19.

Nothing else earns its permission prompt, and Chapter 16 warns that asking for
permissions you do not visibly use gets apps rejected.

## Recap

- Check, request, handle the answer, read, react. Then stop reading.
- Ask at the moment of use, with a reason. Two refusals on Android is permanent.
- Every sensor feature needs a working path for "no".
- Location: pick the coarsest accuracy that works, and background is a separate
  battle.
- Push goes server → APNs/FCM → OS → app, and carries a nudge, not the data.
- Sensor data is personal data. Collect the minimum and declare it.
