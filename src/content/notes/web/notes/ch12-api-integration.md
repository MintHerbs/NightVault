# Chapter 12: API integration

*Week 12 · 2+1 hrs*

> **TL;DR** Programming the API gets it running. **Integration** is connecting a
> real client to it. Two rules save most of the pain: test the API on its own
> with `curl` **before** writing any JavaScript, so you know which side a bug is
> on; and expect the browser to block your first cross-origin call, because that
> is what CORS is for.

## Why this is a separate chapter

The API works. You proved it in Chapter 11 with the browsable interface. Now a
second, separate program has to talk to it, and a whole class of problems appears
that neither program has on its own: wrong URLs, blocked requests, mismatched
field names, and errors that are silently swallowed.

> **Analogy:** two people who each speak their own language agree on a
> phrasebook. Both are fluent, both are cooperating, and it still goes wrong at
> the join: one says "seats_left", the other listens for "seatsLeft", and nobody
> is at fault except the join itself.

## Test it stands alone first

`curl` sends an HTTP request from the terminal with no browser, no JavaScript and
no CORS involved. If curl works and the browser does not, the bug is in the
browser layer. If curl fails, stop looking at your JavaScript entirely.

```bash reading data
curl http://localhost:8000/api/seats/
# → {"seats_left": 22}
```

```bash sending data
curl -X POST http://localhost:8000/api/apply/ \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Mr Big Balls","email":"bb@earth.com","role":1,"mission":1}'
```

| Flag | Does |
| --- | --- |
| `-X POST` | Sets the method. Without it curl sends GET. |
| `-H "..."` | Adds a header. `Content-Type` is the one you will always need. |
| `-d '...'` | The request body. Using `-d` implies POST, so `-X POST` is often optional. |
| `-i` | Show the response **headers** as well as the body. |
| `-v` | Verbose: show the whole conversation, request and response. |

`-i` is the one worth remembering:

```bash see the status code and headers
curl -i http://localhost:8000/api/seats/
# HTTP/1.1 200 OK
# Content-Type: application/json
# Allow: GET, HEAD, OPTIONS
#
# {"seats_left": 22}
```

That blank line is the boundary: headers above, body below. The `Allow` header is
the server telling you which methods this URL accepts, which instantly explains
any 405 you get.

## The same-origin policy

Browsers refuse, by default, to let a page on one origin read a response from a
different origin. An **origin** is the combination of three things:

**scheme + host + port**

| Compared with `http://localhost:5500` | Same origin? | Why |
| --- | --- | --- |
| `http://localhost:5500/other/page.html` | Yes | Path is irrelevant |
| `https://localhost:5500` | No | Different scheme |
| `http://localhost:8000` | No | Different port |
| `http://127.0.0.1:5500` | No | Different host, even though it is the same machine |

That last row surprises everyone. `localhost` and `127.0.0.1` are the same
computer but *not* the same origin, so mixing them in one project causes CORS
errors that look inexplicable.

During development your frontend is served on one port and Django runs on 8000,
so **every** API call you make is cross-origin.

## CORS: how the server opts in

The same-origin policy is a browser rule, so only the browser can relax it, and
it will only do so if the *server* says the call is acceptable. That permission
is a response header, and the mechanism is called **CORS** (Cross-Origin
Resource Sharing).

> **Analogy:** the browser is a bouncer working the door on your behalf. It will
> not let a response in from a stranger unless that stranger is on the guest
> list. CORS headers are the server adding your page to its guest list. Note who
> holds the list: the server. You cannot talk your way past the bouncer from
> inside your JavaScript.

This is the single most important thing to understand about a CORS error: **it is
not a bug in your fetch call.** No amount of rewriting the JavaScript fixes it.
The fix is always on the server.

### The preflight

For anything beyond a simple GET, the browser sends a **preflight** request
first: an `OPTIONS` call that asks "would you accept a POST from this origin,
with these headers?" Only if the answer is yes does it send the real request.

![Diagram: the CORS preflight exchange before the real POST](/notes/img/web/ch12-cors-preflight.svg)

A preflight is triggered by any of:

- a method other than GET, HEAD or POST
- a custom header, such as `Authorization` or `X-CSRFToken`
- a `Content-Type` of `application/json`

That last one means practically every API call you write triggers a preflight.
When you see a mysterious `OPTIONS` in the Django console that you never wrote,
that is what it is. It is normal.

### Setting it up in Django

```bash install
pip install django-cors-headers
```

```python settings.py
INSTALLED_APPS = [
    # ...
    "corsheaders",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",     # must be near the TOP
    "django.middleware.common.CommonMiddleware",
    # ...
]

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",     # list both, they are different origins
]
```

Middleware order is not cosmetic. `CorsMiddleware` has to run before anything
that might return a response, otherwise the CORS headers never get attached and
the browser blocks a response the server thought it had allowed.

> **Never use `CORS_ALLOW_ALL_ORIGINS = True` in production.** It tells the
> browser that any website in the world may call your API with the user's
> credentials. It is fine as a five-minute debugging step, and a genuine
> vulnerability if it ships.

## Calling it from the frontend

::playground{id="ch12-api"}

```javascript fetch, then jQuery, the same call
const res = await fetch("http://localhost:8000/api/seats/");   // ← the request
const data = await res.json();

// jQuery equivalent
$.get("http://localhost:8000/api/seats/", data => console.log(data));
```

There is a trap in that first version. **`fetch` does not throw on 404 or 500.**
It only rejects if the request never completed at all, such as a DNS failure or a
CORS block. A 500 is, as far as `fetch` is concerned, a successful round trip
that happens to carry an error page. So you must check yourself:

```javascript what a real call looks like
async function loadSeats() {
  try {
    const res = await fetch("http://localhost:8000/api/seats/");

    if (!res.ok) {                        // ← 4xx and 5xx land here
      throw new Error(`Server said ${res.status}`);
    }

    const data = await res.json();
    document.querySelector("#seats").textContent = data.seats_left;
  } catch (err) {
    // network failure, CORS block, bad JSON, or the throw above
    document.querySelector("#seats").textContent = "Could not load seats";
    console.error(err);
  }
}
```

`res.ok` is simply `status` in the 200 to 299 range. Checking it is the
difference between "no seats shown and no idea why" and an error you can read.

The playground above prints the raw response body under the button. That is the
habit worth building: when a call misbehaves, look at what actually came back
before changing any JavaScript.

## Where the bugs actually are

| Symptom | Usual cause |
| --- | --- |
| `blocked by CORS policy` in the console | Origin missing from `CORS_ALLOWED_ORIGINS`, or middleware in the wrong order |
| `Unexpected token < in JSON` | The URL 404'd and you parsed an HTML error page |
| 405 Method Not Allowed | Right URL, wrong verb. Check the `Allow` header |
| Fields arrive empty on the server | Missing `Content-Type: application/json` |
| `undefined` in the page, no error | A field-name mismatch, and no `res.ok` check to catch it |
| Works in curl, fails in browser | Something in the browser layer: CORS, or a relative URL resolving against the wrong host |
| 403 with a valid login | CSRF token missing (Chapter 14) |

> Integration is where most real bugs live, and almost none of them are
> interesting. They are a wrong port, a missing header, or a typo in a field
> name. Test with curl first, so you always know which half to look at.

## Recap

- An origin is scheme **plus** host **plus** port. `localhost` and `127.0.0.1`
  are different origins.
- CORS is enforced by the browser but configured on the **server**. You cannot
  fix it from JavaScript.
- `Content-Type: application/json` triggers a preflight `OPTIONS`. That extra
  request is expected.
- `fetch` does not throw on 404 or 500. Check `res.ok` every time.
- curl first, JavaScript second.
