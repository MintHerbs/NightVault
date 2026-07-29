# Chapter 13: Security issues in web and mobile development

*Week 13 · 2+1 hrs*

Three attacks every web and mobile developer must recognise before we look at how frameworks defend against them.

## SQL injection

An attacker types something like `' OR 1=1` into a form field, hoping your code pastes it directly into a database query, changing its meaning entirely.

```python the danger, string-built SQL
# NEVER do this:
query = "SELECT * FROM users WHERE name = '" + user_input + "'"
# if user_input is: x' OR '1'='1
# the query now returns EVERY row, not just one user
```

## XSS, cross-site scripting

An attacker submits `<script>stealCookies()</script>` as a name or comment. If your page displays that text without escaping it, the script actually runs in every visitor's browser who views that page.

## CSRF, cross-site request forgery

A malicious site tricks a logged-in user's own browser into silently submitting a request to your site, using their existing session, without them knowing.

## Mobile-specific concerns

Mobile apps add their own risks on top of the above: API keys hard-coded into an app can be extracted from the installed package, local data storage on the device can be read if the device is compromised, and traffic must use HTTPS since public wifi is common.

> Chapter 14 covers exactly how frameworks like Django close each of these off by default.
