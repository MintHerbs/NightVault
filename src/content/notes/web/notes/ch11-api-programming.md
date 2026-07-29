# Chapter 11: API programming

*Week 11 · 2+1 hrs*

Reading: [MDN: Client-side web APIs](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Client-side_APIs/Introduction)

> **TL;DR** An API is a set of URLs your server exposes so *other programs* can
> read and write its data, instead of a human reading a web page. REST is the
> convention we follow: the URL names a **thing** (`/api/applicants/`) and the
> HTTP method says what to **do** to it (GET to read, POST to create). Django
> REST Framework turns your existing models into that, in three small files.

## What an API actually is

Everything so far has produced HTML for a person to look at. An API produces
JSON for a *program* to consume. Same database, same Django project, different
audience.

> **Analogy:** a restaurant has a dining room and a takeaway hatch. The dining
> room is your HTML site, plated up and presented. The hatch is the API: the
> same kitchen, but handing over the food in a box for someone else to serve.
> The menu is the API contract, the waiter is HTTP, and you never walk into the
> kitchen yourself.

That last point matters. A client never touches your database. It asks the API,
the API decides what is allowed, and only then does the database get involved.
This is why an API is also a security boundary, not just a convenience.

## REST, in plain terms

REST is a set of conventions, not a technology. In practice it means two things:

1. **URLs name things (nouns), not actions.** `/api/applicants/` is a
   collection. `/api/applicants/7/` is one item. You never write
   `/api/getApplicant/` or `/api/deleteApplicant/`.
2. **The HTTP method is the verb.** The same URL does different jobs depending
   on the method used.

| URL | Method | Does |
| --- | --- | --- |
| `/api/applicants/` | GET | List every applicant |
| `/api/applicants/` | POST | Create a new applicant |
| `/api/applicants/7/` | GET | Fetch applicant 7 |
| `/api/applicants/7/` | PUT | Replace applicant 7 entirely |
| `/api/applicants/7/` | PATCH | Update *some* fields of applicant 7 |
| `/api/applicants/7/` | DELETE | Remove applicant 7 |

Two URLs, six operations. That is the whole idea.

### PUT versus PATCH

This is a common exam question. **PUT replaces the whole record**, so you must
send every field, and anything you leave out is wiped. **PATCH updates only what
you send** and leaves the rest alone. Reach for PATCH unless you genuinely mean
to overwrite everything.

### Safe and idempotent

| Property | Meaning | Which methods |
| --- | --- | --- |
| Safe | Changes nothing on the server | GET |
| Idempotent | Doing it twice has the same effect as once | GET, PUT, DELETE |
| Neither | Repeating it creates duplicates | POST |

This is why a browser will happily re-issue a GET but warns you before
re-submitting a POST: sending the application form twice creates two applicants.

## Status codes

The code is the server's one-word summary of what happened. Read the first digit
first, since it tells you *who* has the problem.

| Family | Meaning |
| --- | --- |
| `1xx` | Informational, rare in practice |
| `2xx` | It worked |
| `3xx` | Go and look somewhere else (redirect) |
| `4xx` | **You** made a mistake (the client) |
| `5xx` | **The server** made a mistake |

The ones you will actually use:

| Code | Name | Use when |
| --- | --- | --- |
| 200 | OK | A successful GET, PUT or PATCH |
| 201 | Created | A successful POST that made something new |
| 204 | No Content | A successful DELETE, nothing to return |
| 400 | Bad Request | Their data failed validation |
| 401 | Unauthorized | Not logged in (no valid credentials) |
| 403 | Forbidden | Logged in, but not allowed to do this |
| 404 | Not Found | No such URL, or no such record |
| 405 | Method Not Allowed | Right URL, wrong verb |
| 500 | Server Error | Your code threw an exception |

> **401 versus 403** trips people up. 401 means "I do not know who you are". 403
> means "I know exactly who you are, and no".

## Building it: three files, every time

The pattern never changes: **serializer** (shape of the data), **view** (what
happens), **url** (where it lives).

![Diagram: a request travelling through urls, view, serializer, model and back](/notes/img/web/ch11-drf-request-lifecycle.svg)

### 1. serializers.py, the translator

A serializer converts model instances into JSON-safe types on the way out, and
validates incoming JSON on the way in. It is the API equivalent of a Django
form.

```python recruitment/serializers.py
from rest_framework import serializers
from .models import Applicant

class ApplicantSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Applicant
        fields = ["id", "full_name", "email", "role", "status"]
        read_only_fields = ["status"]      # clients may read it, never set it

    # Same idea as a form's clean_<field>: one field's custom rule
    def validate_full_name(self, value):
        if len(value) < 2:
            raise serializers.ValidationError("Name too short")
        return value
```

`ModelSerializer` reads your model and generates the fields for you, exactly as
`ModelForm` does. Listing `fields` explicitly rather than using `"__all__"` is a
security habit: it means adding a sensitive column to the model later cannot
silently start publishing it.

`read_only_fields` matters more than it looks. Without it, an applicant could
POST `{"status": "accepted"}` and approve themselves.

### 2. views.py, the behaviour

```python recruitment/views.py
from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(["GET"])
def seats_left(request):
    mission = Mission.objects.get(name="Ares-1")
    left = mission.total_seats - mission.applicant_set.count()
    return Response({"seats_left": left})

@api_view(["POST"])
def apply(request):
    serializer = ApplicantSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=201)
    return Response(serializer.errors, status=400)
```

`@api_view(["POST"])` does real work: it rejects any other method with a 405
automatically, parses the JSON body into `request.data`, and gives you DRF's
browsable interface for free.

Note the shape of `apply`. Validate, then save, then report. If validation
fails, `serializer.errors` is already a dict of field names to messages, so the
frontend can highlight the exact field that was wrong.

### 3. urls.py, the addresses

```python recruitment/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path("seats/", views.seats_left),   # GET  /api/seats/
    path("apply/", views.apply),        # POST /api/apply/
]
```

## Testing without writing any JavaScript

DRF ships a **browsable API**: visit `/api/seats/` in a browser and you get a
readable page with the JSON, the allowed methods, and a form for POSTing test
data. Use it before you write a line of frontend code, so that when something
breaks later you already know the server side was fine.

## Where this is going

You now have a working, testable API. Chapter 12 connects the frontend to it and
deals with the practical problems that appear the moment two separate programs
talk to each other.

## Recap

- URLs are nouns, HTTP methods are verbs.
- PATCH for partial updates, PUT only when you mean to replace everything.
- 4xx is the client's fault, 5xx is yours.
- Serializer, view, url. Always those three, in that order.
- List `fields` explicitly and mark anything the client must not set as
  `read_only_fields`.
