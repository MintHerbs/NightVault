# Chapter 19: Connecting the mobile app to your API

*Week 19 · 2+1 hrs*

A mobile app is simply another client calling the same Django API from Chapters 11 and 12, no new backend concepts, just a different caller.

| Frontend client | How it calls the API |
| --- | --- |
| Browser (this semester's site) | `fetch(...)` or `$.ajax(...)` |
| React Native app | `fetch(...)`, same JavaScript function, it works there too |
| Native Swift/Kotlin app | Platform networking libraries (`URLSession`, `Retrofit`), same HTTP request underneath |

Whatever the client, it's making the same kind of request:

```http the request, from any mobile client
POST /api/apply/ HTTP/1.1
Host: ares-backend.com
Content-Type: application/json

{ "full_name": "Mr Big Balls", "email": "bb@earth.com", "role": 1 }
```

> **Mobile-specific detail:** mobile apps can't rely on browser cookies for login the way a website can. Most mobile APIs use a token (a long random string) sent in a header instead, `Authorization: Bearer <token>`, issued once at login and stored securely on the device.
