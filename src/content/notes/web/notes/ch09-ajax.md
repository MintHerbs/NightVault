# Chapter 9: AJAX

*Week 9 · 2+1 hrs*

Full recap: AJAX = talk to a server in the background, no page reload. `fetch` is the built-in way, it returns a **promise** (an IOU for a future answer).

```javascript fetch, GET and POST
// GET
fetch("/api/seats/")                     // <- the actual request
  .then(res => res.json())
  .then(data => console.log(data.seats_left));

// POST, with async/await instead of .then chains
async function apply(payload) {
  const res = await fetch("/api/apply/", {     // <- the actual request
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(payload)
  });
  return await res.json();
}
```

The marked lines are always the actual request. Everything else is prep (before) or reaction (after).

::playground{id="ch09-ajax"}

There is no Django server behind that playground yet, so it calls a `fakeFetchSeats()` stand-in: a promise that resolves after a delay. That delay is the part of a real request that matters here, you get an answer later, not now. Swap it for a real `fetch("/api/seats/")` and none of the surrounding code changes.

### jQuery's version

```javascript $.ajax
$.ajax({ url:"/api/seats/", method:"GET",
  success: data => console.log(data),
  error: () => console.log("failed") });
```

| fetch | jQuery |
| --- | --- |
| `fetch(url)` | `$.get(url, cb)` |
| `.then(data => ..)` | `success: data => ..` |
| `.catch(err => ..)` | `error: () => ..` |
