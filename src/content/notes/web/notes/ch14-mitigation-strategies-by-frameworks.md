# Chapter 14: Mitigation strategies by frameworks

*Week 14 · 2+1 hrs*

Django was built with Chapter 13's attacks in mind. Here is exactly what blocks each one.

| Attack | Django's mitigation |
| --- | --- |
| SQL injection | The ORM (`Model.objects.filter(...)`) parameterizes every query automatically. You never concatenate raw SQL strings. |
| XSS | Django templates auto-escape all output by default. `<script>` becomes harmless text on screen. Never disable this with the `\|safe` filter on user-submitted input. |
| CSRF | `{% csrf_token %}` in every form, a hidden token Django checks matches on every POST, PUT, PATCH, DELETE. |

```html the CSRF token, in a Django template
<form method="POST">
  {% csrf_token %}
  <!-- fields -->
</form>
```

## For mobile, the equivalent good habits

| Risk | Mitigation |
| --- | --- |
| Hard-coded secrets | Keep API keys on the server, never ship them inside the app package. |
| Insecure storage | Use the platform's secure storage (Keychain on iOS, Keystore on Android), never plain text files. |
| Unencrypted traffic | HTTPS only, always, no exceptions for "internal" traffic. |

> **Golden rule:** never trust input from the browser or the app. Validate on the server, escape on output, use the ORM instead of raw SQL, and let a framework's built-in protections run, don't turn them off "to make it work."
