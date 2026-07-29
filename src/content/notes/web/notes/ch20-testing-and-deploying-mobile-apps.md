# Chapter 20: Testing and deploying mobile apps

*Weeks 15-20 · 2+1 hrs · Developing Mobile Apps*

> **TL;DR** Two separate things ship: the **Django backend** to a server, and the
> **app** to two stores. The backend you can fix in minutes. The app you cannot,
> because a release waits for review and then for users to update. So test the
> things you cannot patch, and make the app tolerant of a backend that changes.

## Testing

### The four levels

| Level | What it checks | Example |
| --- | --- | --- |
| **Unit** | One function in isolation | The seat calculation returns 22 for 24 seats and 2 applicants |
| **Integration** | Parts working together | POST to `/api/apply/` really creates a row |
| **UI** | The app from the outside | Tapping Apply with an empty name shows the error |
| **Manual** | Everything a script cannot judge | Does it feel right in one hand, on a real phone |

Django gives you the first two nearly free, and they run in seconds:

```python recruitment/tests.py
from django.test import TestCase
from rest_framework.test import APIClient

class ApplyTests(TestCase):
    def test_apply_creates_applicant(self):
        client = APIClient()
        res = client.post("/api/apply/", {
            "full_name": "Mr Big Balls",
            "email": "bb@earth.com",
            "role": 1, "mission": 1,
        }, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Applicant.objects.count(), 1)

    def test_short_name_rejected(self):
        client = APIClient()
        res = client.post("/api/apply/", {"full_name": "X"}, format="json")
        self.assertEqual(res.status_code, 400)          # the Chapter 5 rule
```

```bash run them
python manage.py test
```

Test the **error** paths as much as the happy path. A 400 that returns the wrong
message is a bug your users will meet far more often than any success case.

### Emulators are not devices

An emulator runs your app on your laptop's fast processor with a perfect network
connection. Real devices differ in ways that matter:

| Difference | Why it bites |
| --- | --- |
| Real touch | Your buttons are hittable with a mouse and too small for a thumb |
| Real performance | Animation that is smooth on a laptop stutters on a three-year-old phone |
| Real sensors | GPS on an emulator is a fixed fake value that never takes time to fix |
| Real screens | Notches, rounded corners and gesture bars overlap your layout |
| Real interruptions | An actual phone call arrives mid-form |
| Real battery | You only notice you are polling too often on hardware |

> **Test on the oldest, smallest, cheapest device you can find.** It will find more
> bugs in an hour than the newest flagship finds in a week.

### Deliberately break the network

This is the most under-tested area in student projects, and Chapter 19 explains
why it matters. Both platforms let you simulate poor conditions from developer
settings.

Check each of these on purpose:

- **Airplane mode** while a request is in flight. Does it show an error, or hang forever?
- **Very slow connection.** Is there a loading state, or does it look frozen?
- **Drop the connection mid-POST.** Does a retry create a duplicate applicant?
- **Captive-portal wifi**, which answers every request with a login page. Do you show "unexpected token <" to the user?
- **Backend returning 500.** Does the app say something human?

## Beta testing

Never go from your desk to a public release.

| Platform | Mechanism | Notes |
| --- | --- | --- |
| iOS | TestFlight | Up to 100 internal testers without review; external testers need a lighter review |
| Android | Internal, closed and open testing tracks | Internal is near-instant, ideal for the team |

Give testers something specific to try. "Let me know what you think" produces
nothing; "please apply for a role using mobile data, not wifi" produces the bug you
were looking for.

## Deploying the backend

The app is useless without the server, so this goes first.

![Diagram: the two release paths, backend to a host and app through review to stores](/notes/img/web/ch20-deploy-pipeline.svg)

### The settings that must change

| Setting | Development | Production |
| --- | --- | --- |
| `DEBUG` | `True` | **`False`**, without exception |
| `ALLOWED_HOSTS` | `[]` or `localhost` | Your real domain |
| `SECRET_KEY` | In the file | From an environment variable |
| Database | SQLite | PostgreSQL or similar |
| `CORS_ALLOWED_ORIGINS` | `localhost:5500` | Your real frontend origin |
| HTTPS | Off | On, with `SECURE_SSL_REDIRECT = True` |
| Static files | Served by Django | Collected and served by the host or a CDN |

`DEBUG = False` is the one that matters most, and Chapter 14 explains why: with it
left on, any error page publishes your settings, code and recent SQL to whoever
triggered it.

```bash the deploy checklist Django will run for you
python manage.py check --deploy
```

That command inspects your settings and lists what is unsafe for production. Run it
before every release and fix what it reports.

```bash the two commands every deploy needs
python manage.py migrate          # apply schema changes (Chapter 3)
python manage.py collectstatic    # gather CSS/JS for the web server
```

### Secrets belong in the environment

```python settings.py
import os

SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]
DEBUG = os.environ.get("DJANGO_DEBUG", "False") == "True"
ALLOWED_HOSTS = os.environ["DJANGO_ALLOWED_HOSTS"].split(",")
```

A key committed to git is a leaked key, permanently, even if you delete it later.
The history keeps it.

## Configuring the app for each environment

The app needs to point at the live server, and this cannot be a value you edit by
hand before each build:

```javascript one base URL, chosen by build type
const API_BASE = __DEV__
  ? "http://10.0.2.2:8000"          // the emulator's route to your machine
  : "https://ares-backend.com";
```

> `localhost` inside an emulator means the emulator itself, not your laptop. That
> is why the development value is not `localhost:8000`, and it is a genuinely
> common first-day confusion.

## The version-skew problem

This is the part with no equivalent in web development.

When you fix a website, every visitor gets the fix on their next refresh. When you
fix an app, the release waits for review (Chapter 16), then waits for each user to
update, and **some users never update at all**.

So old app versions keep calling your API indefinitely. Which means:

- **Never remove or rename an API field** that a released app depends on. Add new
  fields instead.
- **Version your API** (`/api/v1/`) when a breaking change is genuinely needed, and
  keep the old version running.
- **Build in a kill switch**: a tiny endpoint the app checks on launch that can say
  "this version is too old, please update".

> **Analogy:** a website is a noticeboard you can repaint whenever you like. An app
> is a printed book already on people's shelves. You cannot edit the copies that
> have shipped, so the sequel has to make sense to someone still reading the first
> edition.

## Release checklist

- [ ] `python manage.py check --deploy` reports nothing
- [ ] `DEBUG = False`, `ALLOWED_HOSTS` set, secrets from environment
- [ ] Migrations applied, static files collected
- [ ] HTTPS enforced, database backed up
- [ ] App points at the production URL, not localhost
- [ ] Tested on a real, old device
- [ ] Tested with the network off, and slow
- [ ] Beta tested by someone who is not you
- [ ] Store listing, screenshots and privacy declaration complete
- [ ] Signing key backed up somewhere you will still have it in three years

## The whole course, in one paragraph

Everything from Chapter 1 has been building to one moment. A real user, on a real
phone, fills in a form. It is validated in the browser for courtesy and on the
server for safety. It travels as JSON over HTTPS, through DNS and TCP and TLS, to
an API you designed, which authenticates a token, runs it through a serializer, and
saves a row via the ORM. That is the same journey Sarah's message took in Chapter
1, except this time every hop is code you wrote.

## Recap

- Unit and integration tests are cheap in Django. Test the error paths too.
- Emulators lie about touch, performance, sensors and network. Test on real, old
  hardware.
- Break the network on purpose. Airplane mode mid-request is the test nobody runs.
- Beta test through TestFlight or a Play testing track before any public release.
- `DEBUG = False`, secrets from the environment, HTTPS, `check --deploy`.
- Old app versions live forever. Never remove an API field a shipped app uses.
