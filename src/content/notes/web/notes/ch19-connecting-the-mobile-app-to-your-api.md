# Chapter 19: Connecting the mobile app to your API

*Weeks 15-20 · 2+1 hrs · Developing Mobile Apps*

> **TL;DR** A mobile app is just another HTTP client calling the same Django API
> from Chapters 11 and 12. Nothing on the server changes except **how you prove
> who the user is**: browsers use cookies, which mobile apps cannot rely on, so
> mobile uses a **token** sent in an `Authorization` header.

## The same API, a different caller

Your backend does not know or care what kind of program is talking to it. It sees
an HTTP request.

| Client | How it calls the API |
| --- | --- |
| Browser (this semester's site) | `fetch(...)` or `$.ajax(...)` |
| React Native app | `fetch(...)`, the same JavaScript function |
| Flutter app | The `http` or `dio` package |
| Native iOS (Swift) | `URLSession` |
| Native Android (Kotlin) | Retrofit or OkHttp |

All of them produce the identical request on the wire:

```http the request, from any client at all
POST /api/apply/ HTTP/1.1
Host: ares-backend.com
Content-Type: application/json
Authorization: Bearer 9f2c1a7e4b8d3f60a5c2

{ "full_name": "Mr Big Balls", "email": "bb@earth.com", "role": 1 }
```

> **Analogy:** the API is a post office counter. It does not matter whether you
> arrived by bus, bike or on foot. You hand over the same form and show the same
> ID. The journey is the client's business.

## Why cookies do not work well here

In a browser, login works by cookie: the server sets a session cookie, and the
browser attaches it automatically to every later request. That automatic
attachment is convenient, and it is also exactly what made CSRF possible in
Chapter 13.

Mobile apps do not get that for free:

| Problem | Detail |
| --- | --- |
| No shared cookie jar | A native app is not a browser. Cookie handling is manual at best, and inconsistent across platforms. |
| Sessions expire | Server sessions are short-lived by design. An app the user opens once a week would be logged out constantly. |
| No CSRF protection available | The token-in-a-page trick from Chapter 14 needs a page. There is no page. |
| Multiple clients | The same account may be signed in on a phone, a tablet and the website at once. |

So mobile APIs use **tokens** instead, sent explicitly on each request. Because the
app attaches the token deliberately rather than the platform doing it
automatically, CSRF stops being possible at all: a malicious site cannot make your
app add its header.

## The token flow

![Diagram: login exchanging credentials for a token, then authenticated calls](/notes/img/web/ch19-token-auth-sequence.svg)

1. The app posts the email and password **once**, to a login endpoint.
2. The server checks them and returns a **token**, a long random string.
3. The app stores that token in the platform's secure store.
4. Every later request carries `Authorization: Bearer <token>`.
5. The server looks the token up, finds the user, and treats the request as theirs.
6. On logout, the app deletes the token and the server invalidates it.

The password travels **exactly once**. After that, only the token does, and a
stolen token can be revoked server-side without forcing a password change.

### On the Django side

```bash install
pip install djangorestframework-simplejwt
```

```python settings.py
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
}
```

```python urls.py
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path("login/",   TokenObtainPairView.as_view()),   # email+password → tokens
    path("refresh/", TokenRefreshView.as_view()),      # refresh → new access
]
```

```python protecting an endpoint
from rest_framework.permissions import IsAuthenticated

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_application(request):
    # request.user is the user the token belongs to
    app = Applicant.objects.get(user=request.user)
    return Response(ApplicantSerializer(app).data)
```

`request.user` is the whole point. Once authentication is configured, the rest of
your code is written exactly as before.

### Access and refresh tokens

JWT setups issue two:

| Token | Lifetime | Job |
| --- | --- | --- |
| **Access** | Short, minutes | Sent with every request |
| **Refresh** | Long, days or weeks | Used only to obtain a new access token |

The reason for the split is damage control. A stolen access token is useless within
minutes. The refresh token is used rarely, so it spends almost all its time sitting
in secure storage rather than travelling over the network.

> **Analogy:** the refresh token is your passport, kept in the hotel safe. The
> access token is the room key you carry around. Lose the room key and it stops
> working tonight; you only produce the passport to get a new one.

## Storing the token safely

This is where Chapter 13's mobile risks come back. The token **is** the login. Store
it badly and you have leaked the account.

| Do | Do not |
| --- | --- |
| iOS Keychain | A plain file in the app's documents directory |
| Android Keystore / EncryptedSharedPreferences | Plain `SharedPreferences` |
| Delete on logout | Log it, ever, in analytics or crash reports |
| Send only over HTTPS | Put it in a URL query string, where it lands in server logs |

## Handling an unreliable network

A desktop browser sits on wifi. A phone moves between cells, through tunnels, and
onto captive-portal wifi that answers every request with a login page.

| Situation | What the app should do |
| --- | --- |
| Request times out | Set an explicit timeout, then offer a retry |
| Repeated failure | Back off, waiting longer between attempts rather than hammering |
| 401 returned | Try the refresh token once. If that fails too, send the user to login |
| Offline entirely | Show cached data with an "as of" time, and queue writes |
| Duplicate submit | Have the app send an idempotency key so a retried POST cannot create two applicants |

That last row connects back to Chapter 11: POST is not idempotent, so a retry on a
flaky connection genuinely can create two applications. The fix is a unique key the
app generates and the server remembers.

```javascript a call that survives a bad connection
async function apply(payload, token) {
  const res = await fetch("https://ares-backend.com/api/apply/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "Idempotency-Key": payload.clientRequestId,   // same on every retry
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),             // do not hang forever
  });

  if (res.status === 401) throw new NeedsRefresh();
  if (!res.ok) throw new Error(`Server said ${res.status}`);
  return res.json();
}
```

Note `res.ok` again. The Chapter 12 warning applies identically on mobile: `fetch`
does not throw on 404 or 500.

## Recap

- The API does not change. Only authentication does.
- Browsers use cookies, mobile uses `Authorization: Bearer <token>`.
- Because the app attaches the token deliberately, CSRF does not apply.
- Access token short, refresh token long, and the password travels only once.
- Store tokens in Keychain or Keystore, never a plain file, never in a URL.
- Assume the network fails mid-request: timeouts, backoff, retry, and an
  idempotency key so a retry cannot duplicate a record.
