# Chapter 13: Security issues in web and mobile development

*Week 13 · 2+1 hrs*

Reading: [MDN: Website security](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Server-side/First_steps/Website_security) · [OWASP Top Ten](https://owasp.org/www-project-top-ten/)

> **TL;DR** Every attack in this chapter is the same mistake wearing a different
> hat: **data supplied by a user was treated as instructions.** SQL injection is
> user data becoming part of a query. XSS is user data becoming part of a page.
> CSRF is a request from elsewhere being treated as an instruction from your
> user. Learn to spot that shape and the specific attacks stop being a list to
> memorise.

## The one principle

Your JavaScript validation from Chapter 8 is a courtesy to honest users. It is
**not** security. Anyone can open dev tools, delete your checks, and send
whatever they like. They can skip the browser entirely and use curl, as you did
in Chapter 12.

> **Analogy:** you can print a form with "please write your name in block
> capitals" at the top. Nothing physically stops someone writing a paragraph of
> instructions to the clerk instead. The safeguard has to live with the clerk,
> not on the form.

So: **the server must revalidate everything, every time.** That is why Chapter 5
existed.

## SQL injection

The attack: put characters into an input that change the *meaning* of the SQL
query your code builds, rather than just supplying a value to it.

### How it actually works

Suppose you build a query by gluing strings together:

```python NEVER do this
query = "SELECT * FROM users WHERE name = '" + user_input + "'"
```

With honest input `Sarah`, the finished query is:

```sql the intended query
SELECT * FROM users WHERE name = 'Sarah'
```

Now the attacker types `x' OR '1'='1` instead. Glue that in and read what the
database receives:

```sql what the database is actually asked
SELECT * FROM users WHERE name = 'x' OR '1'='1'
```

The attacker's quote **closed your string early**, and everything after it is now
part of the query itself. `'1'='1'` is always true, so the `WHERE` matches every
row. One text box has turned "fetch one user" into "dump the entire user table".

![Diagram: how a quote in user input escapes the string and becomes query logic](/notes/img/web/ch13-sql-injection.svg)

> **Analogy:** you are dictating a letter to a typist and say "Dear Sarah, full
> stop, new paragraph". The typist has no way to know that "new paragraph" was an
> instruction rather than words to type, unless the two of you agreed in advance
> which is which. Injection is exploiting the fact that nobody agreed.

### Variations worth recognising

| Variant | What it does |
| --- | --- |
| Authentication bypass | `' OR '1'='1` in a password field makes the login check always true |
| UNION attack | Appends `UNION SELECT ...` to read a table the query was never about |
| Blind injection | Nothing is displayed, so the attacker asks true/false questions and reads the answer from how the page behaves |
| Time-based | Injects a deliberate delay, then measures response time to read data one bit at a time |
| Destructive | `'; DROP TABLE users; --` where multiple statements are permitted |

The trailing `--` in that last one is a SQL comment. It makes the database ignore
whatever remained of your original query, so the attacker's fragment does not
have to be syntactically tidy.

## XSS, cross-site scripting

The attack: get your page to include attacker-supplied text **as HTML**, so the
browser runs it as code.

If a user submits this as their name, and your page prints it without escaping:

```html what the attacker submits
<script>stealCookies()</script>
```

then every visitor who views that page runs the attacker's JavaScript, inside
your site's origin, with full access to the logged-in user's session.

> **Analogy:** a community noticeboard where anyone can pin up a note. Someone
> pins up a note that reads "staff: unlock the safe for whoever hands you this".
> The noticeboard did nothing wrong. It just failed to distinguish "a message to
> display" from "an instruction to follow".

### The three kinds

| Kind | Where the payload lives | Example |
| --- | --- | --- |
| **Stored** | Saved in your database, served to everyone | A malicious comment on the applicant list. The worst kind: it attacks every visitor, forever. |
| **Reflected** | In a URL, echoed back by the page | `?search=<script>...</script>` on a results page. Needs the victim to click a crafted link. |
| **DOM-based** | Never reaches the server at all | Your JavaScript writes `location.hash` into `innerHTML` |

![Diagram: a stored XSS payload saved once and served to every later visitor](/notes/img/web/ch13-xss-stored.svg)

### Why it is worse than it looks

Because the script runs on *your* origin, it can do anything your own JavaScript
could:

- read `document.cookie` and send the session to the attacker
- read anything on the page, including data only that user should see
- make authenticated requests to your API as that user
- rewrite the page, for example replacing a form with one that posts elsewhere

That last point is why "it only affects the attacker's own browser" is wrong for
stored XSS. The payload is served to everyone.

### The DOM-based trap

This one catches people who have correctly escaped everything server-side:

```javascript the dangerous line
element.innerHTML = userText;    // parses userText as HTML
element.textContent = userText;  // safe: always treated as text
```

`innerHTML` interprets its input as markup. `textContent` never does. If you do
not need HTML, use `textContent`, and the whole class of bug disappears.

## CSRF, cross-site request forgery

The attack: make a logged-in user's **own browser** send a request to your site
that the user never intended.

### Why it works

Cookies are attached automatically. The browser sends your session cookie with
every request to your domain, no matter which page caused that request. So if the
user is logged in to your site and then visits a malicious page:

```html on the attacker's site, in a hidden iframe
<form action="https://ares-colony.com/api/apply/" method="POST" id="f">
  <input name="full_name" value="Attacker">
</form>
<script>document.getElementById("f").submit();</script>
```

The browser posts that form to your server **with the victim's session cookie
attached**, because that is how cookies work. Your server sees a perfectly
authenticated request from a logged-in user, and has no way to tell from the
cookie alone that the user did not mean it.

![Diagram: the victim's browser submitting an attacker's form with the real session cookie](/notes/img/web/ch13-csrf-flow.svg)

> **Analogy:** you are logged in at the bank counter and step away for a moment
> without leaving. A stranger slides a withdrawal slip in front of the teller.
> The teller checks the session (yes, you are here, you are you) and pays out.
> The teller verified *who* you are but never that *you* asked.

Notice what the attacker does **not** need: they cannot read your cookie, and
they cannot read the response. They only need the side effect to happen. That is
enough to transfer money, change an email address, or delete a record.

## Mobile-specific concerns

Everything above still applies, because a mobile app talks to the same API. Mobile
then adds risks of its own, all stemming from one fact: **the app is running on a
device you do not control.**

| Risk | Why it happens |
| --- | --- |
| Hard-coded secrets | An installed app package can be unzipped and read. Any API key, password or private endpoint compiled into it is readable in minutes. |
| Insecure local storage | Files an app writes can be read on a rooted or jailbroken device, and often via a device backup even without that. |
| Traffic interception | Public wifi lets anyone on the network read unencrypted traffic. Without HTTPS, tokens and personal data travel in the clear. |
| Reverse engineering | Compiled apps can be decompiled to recover logic. Any check performed only in the app can be found and removed. |
| Over-broad permissions | An app granted location or contacts access keeps it. A breach or a careless library then exposes that data. |
| Outdated dependencies | A published app keeps running the library versions it shipped with until the user updates. |

> **The mobile rule of thumb:** treat the app as **public**. Assume an attacker
> has read every line of it and can run it in a modified form. Anything that must
> stay secret, and any check that must not be bypassed, belongs on the server.

## Recap

| Attack | What gets confused | Where the payload runs |
| --- | --- | --- |
| SQL injection | Data becomes part of a **query** | On your database server |
| XSS | Data becomes part of a **page** | In other users' browsers |
| CSRF | A foreign request becomes an **instruction** | In the victim's browser, against your server |

- Client-side validation is UX. Server-side validation is security.
- All three attacks come from mixing data and instructions. The fixes in Chapter
  14 all work by keeping the two apart.
- On mobile, assume the app itself is readable and modifiable by the attacker.

> Chapter 14 covers exactly how Django closes each of these off, mostly by
> default, and what you have to avoid switching off.
