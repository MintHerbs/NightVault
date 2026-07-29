# Chapter 12: API integration

*Week 12 · 2+1 hrs*

Programming the API gets it running. **Integration** is connecting a real client, our frontend, to it, and handling the practical issues that come with two separate programs talking to each other.

## Testing it stands alone first

Before wiring up JavaScript, confirm the API itself works, from the terminal:

```bash terminal
curl http://localhost:8000/api/seats/
# → {"seats_left": 22}

curl -X POST http://localhost:8000/api/apply/ \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Mr Big Balls","email":"bb@earth.com","role":1,"mission":1}'
```

## CORS: letting the browser in

Browsers block a page on one address from calling an API on a different address, for security. Our frontend and Django count as different origins during development. **CORS** settings allow it explicitly:

```python settings.py
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5500",
]
```

## Calling it from the frontend

::playground{id="ch12-api"}

```javascript fetch, then jQuery, same call
const res = await fetch("http://localhost:8000/api/seats/");   // <- the request
const data = await res.json();

// jQuery equivalent
$.get("http://localhost:8000/api/seats/", data => console.log(data));
```

The playground prints the raw response body under the button. That is the habit worth building: when a call misbehaves, look at what actually came back before you start changing JavaScript.

> Integration is where most real bugs live: wrong URL, missing CORS setting, a typo in a field name between the serializer and the frontend. Always test the API alone with curl first, so you know if a bug is on the server or in your JavaScript.
