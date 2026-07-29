# Chapter 14: Mitigation strategies by frameworks

*Week 14 · 2+1 hrs*

Reading: [Django: Security in Django](https://docs.djangoproject.com/en/stable/topics/security/)

> **TL;DR** Django already blocks all three attacks from Chapter 13, and it does
> so by default. Your job is mostly **not to switch the protections off**. The
> ORM stops SQL injection by never letting data become query syntax, templates
> stop XSS by escaping output, and the CSRF token stops forged requests by
> demanding proof the request came from your own page.

## The idea behind all of it

Every fix in this chapter works the same way: **keep data and instructions in
separate channels**, so no amount of clever input can jump from one to the other.

> **Analogy:** instead of dictating a letter aloud and hoping the typist can tell
> your instructions from your words, you hand over a form with the words in
> labelled boxes. There is no longer any way to say "new paragraph" and have it
> obeyed, because words go in the box and instructions go on the form.

## The three defences

| Attack | Django's mitigation | On by default? |
| --- | --- | --- |
| SQL injection | The ORM parameterizes every query. Data is sent to the database separately from the SQL, so it can never be read as syntax. | Yes |
| XSS | Templates auto-escape all variable output. `<script>` renders as visible text, not as a tag. | Yes |
| CSRF | `CsrfViewMiddleware` requires a secret token on every state-changing request. | Yes |

### 1. The ORM, against SQL injection

```python safe: the ORM parameterizes for you
Applicant.objects.filter(full_name=user_input)
```

The database receives the query and the value as **two separate things**:
`SELECT ... WHERE name = ?` plus the value. Because the value never becomes part
of the query text, a quote inside it is just a quote in a name. There is nothing
to escape from.

This is why `' OR '1'='1` submitted through the ORM does not bypass anything. It
searches for an applicant literally named `' OR '1'='1`, finds none, and returns
an empty list.

The escape hatches are where it goes wrong:

```python the two dangerous doors
# UNSAFE: you built the string, so you own the problem
Applicant.objects.raw("SELECT * FROM applicants WHERE name = '%s'" % user_input)

# SAFE: parameters passed separately, even in raw SQL
Applicant.objects.raw("SELECT * FROM applicants WHERE name = %s", [user_input])
```

The difference is `%` versus a comma. With `%` **you** interpolate, and the
database gets one pre-assembled string. With a comma the **driver** does it, and
the value stays a value. Also treat `.extra()` and any hand-written `cursor.
execute()` with the same suspicion.

> **Rule:** if you can see the user's data inside a string you built, you have a
> potential injection. Pass it as a parameter instead.

### 2. Auto-escaping, against XSS

```html a template printing user data
<p>Welcome, {{ applicant.full_name }}</p>
```

If `full_name` contains `<script>stealCookies()</script>`, Django converts the
dangerous characters before writing them into the page:

| Character | Becomes | Why it matters |
| --- | --- | --- |
| `<` | `&lt;` | Cannot start a tag |
| `>` | `&gt;` | Cannot close a tag |
| `"` | `&quot;` | Cannot break out of an attribute |
| `'` | `&#x27;` | Same, for single-quoted attributes |
| `&` | `&amp;` | So escaping itself is unambiguous |

The visitor sees the literal text `<script>stealCookies()</script>` on the page.
The browser never treats it as a tag, because it is no longer written like one.

The dangerous switch is the `|safe` filter, and its block-level twin
`{% autoescape off %}`:

```html the one thing not to do
<p>{{ applicant.bio|safe }}</p>          <!-- renders raw HTML -->
```

`|safe` means "I promise this is trusted HTML". It is fine for a string you wrote
yourself. On anything a user supplied it re-opens the hole completely.

Remember the JavaScript-side equivalent from Chapter 13: templates protect what
Django renders, but they cannot protect a value your own JavaScript later pushes
through `innerHTML`. Use `textContent` unless you specifically need markup.

### 3. The CSRF token

Cookies prove *who* the user is. The CSRF token proves the request came from
**your own page**. The attacker's site can cause the browser to send a request,
but it cannot read your page to discover the token.

```html the token, in a Django template
<form method="POST">
  {% csrf_token %}
  <!-- fields -->
</form>
```

That tag renders a hidden input holding a random value that also exists in the
user's session. On every POST, PUT, PATCH and DELETE, `CsrfViewMiddleware`
compares the two and returns **403** if they do not match. GET is exempt, which
is exactly why a GET request must never change data.

For AJAX there is no form, so you send the token as a header instead:

```javascript sending the token with fetch
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

await fetch("/api/apply/", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-CSRFToken": getCookie("csrftoken"),   // ← the proof
  },
  body: JSON.stringify(payload),
});
```

> **If you are getting a 403 on a POST that looks correct, this is why**, nine
> times out of ten. The fix is the header, never switching the middleware off.

## The layers together

No single one of these is "the" security. A request passes through all of them,
and each layer assumes the others might fail:

![Diagram: a request passing through HTTPS, CSRF, validation, ORM and escaping](/notes/img/web/ch14-defense-layers.svg)

This is **defense in depth**. If an attacker slips past validation, the ORM still
stops the injection. If tainted data reaches the database, escaping still stops it
executing in a browser. You are never relying on one check being perfect.

## Other protections worth knowing

| Setting or feature | Protects against |
| --- | --- |
| `SECURE_SSL_REDIRECT = True` | Plain HTTP, by redirecting everything to HTTPS |
| `SESSION_COOKIE_SECURE = True` | The session cookie travelling over unencrypted HTTP |
| `CSRF_COOKIE_SECURE = True` | The same, for the CSRF cookie |
| `SECURE_HSTS_SECONDS` | Downgrade attacks, by telling browsers to use HTTPS only |
| `X_FRAME_OPTIONS = "DENY"` | Clickjacking, by refusing to be loaded in an iframe |
| `ALLOWED_HOSTS` | Host header attacks, by rejecting unexpected domains |
| `DEBUG = False` | Leaking your settings, source code and SQL on an error page |
| Password hashing (PBKDF2 by default) | Stored passwords being readable after a database breach |

`DEBUG = False` deserves emphasis. With `DEBUG = True` in production, any error
page publishes your settings, installed apps, and recent SQL queries to whoever
triggered it. It is the single most common serious misconfiguration in student
projects.

## For mobile, the equivalent habits

| Risk | Mitigation |
| --- | --- |
| Hard-coded secrets | Keep API keys on the server. Have the app call *your* endpoint, which then calls the third party using the key. |
| Insecure storage | Use the platform's secure store, Keychain on iOS and Keystore on Android, never a plain file or plain preferences. |
| Unencrypted traffic | HTTPS only, with no exception for "internal" traffic. Both platforms block plain HTTP by default now. |
| Reverse engineering | Perform every security decision on the server. Obfuscation slows an attacker down, it does not stop one. |
| Over-broad permissions | Request a permission at the moment it is needed, explain why, and handle refusal gracefully. |
| Stale dependencies | Keep libraries current and ship updates, since a published app keeps running old code until users update. |

## Recap

- Django's defaults already stop all three attacks. Most vulnerabilities are a
  protection someone turned off to make something work.
- The ORM is safe because data never becomes query text. `%` formatting into
  `raw()` throws that away.
- Templates escape output. `|safe` on user input undoes it.
- The CSRF token proves the request came from your page, which a cookie cannot.
- `DEBUG = False` and HTTPS in production, without exception.

> **Golden rule:** never trust input from a browser or an app. Validate on the
> server, escape on output, use the ORM rather than raw SQL, and leave the
> framework's protections switched on.
