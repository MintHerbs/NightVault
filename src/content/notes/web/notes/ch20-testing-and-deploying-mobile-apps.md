# Chapter 20: Testing and deploying mobile apps

*Week 20 · 2+1 hrs*

The course closes where a real project would: getting the app in front of users.

## Testing

* Test on real devices, not just an emulator, screen sizes and sensor behaviour genuinely differ.
* Test with a slow or dropped connection deliberately, mobile networks are unreliable, your error handling from Chapter 9's AJAX work matters here.
* Beta test with a small group before a public release, both app stores support this directly (TestFlight for iOS, internal testing tracks for Android).

## Deploying

| Piece | Where it lives |
| --- | --- |
| Django backend | A hosting provider, with the database, running behind HTTPS |
| Mobile app build | Submitted to the App Store and Google Play |
| Config | The app's API base URL points at your live server, not `localhost` |

> Everything from Chapter 1 onward has been building toward this single moment: a real user, on a real phone, filling in a form that reaches a real server you built, that saves to a real database, exactly like Sarah's message did in Chapter 1, except this time it's your code carrying it.
