# Chapter 10: Data exchange with JSON

*Week 10 · 2+1 hrs · Assignment 1 · Test 1 (scheduled separately)*

Reading: [MDN: Working with JSON](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/JSON)

> **TL;DR** Two programs written in different languages cannot hand each other a
> variable. They can only hand each other **text**. JSON is an agreed way of
> writing structured data as text, so a JavaScript browser and a Python server
> understand the same message. You turn data into JSON text before sending
> (`JSON.stringify`), and turn it back into data after receiving (`JSON.parse`).

## Why we need a format at all

Your browser runs JavaScript. Your Django server runs Python. A JavaScript
object and a Python dictionary are different things, living in different
programs, on different machines, in different memory. There is no way to post a
JavaScript object down a cable.

What *can* travel down a cable is a stream of characters. So both sides agree on
a way of writing data as characters, and each side converts at its own end.

> **Analogy:** you cannot email someone a chair. You can email them flat-pack
> instructions, and they build an identical chair at their end. JSON is the
> flat-pack instructions. `stringify` is packing it flat, `parse` is assembling
> it again.

Before JSON, the usual choice was XML, which wraps every value in opening and
closing tags and ends up several times larger for the same data. JSON won
because it is compact, readable by a human, and maps almost exactly onto data
structures that languages already have.

## What it looks like

```json an applicant, as JSON
{
  "full_name": "Mr Big Balls",
  "email": "bb@earth.com",
  "role": 2,
  "accepted_risk": true,
  "skills": ["botany", "welding"],
  "next_of_kin": null
}
```

If that looks like a JavaScript object, that is deliberate. JSON was taken from
JavaScript's object syntax. But it is a **stricter** subset, and the strictness
is where marks get lost.

## The rules

| Rule | Detail |
| --- | --- |
| Keys are strings | Always in **double** quotes. `"full_name"`, never `full_name` or `'full_name'`. |
| Strings use double quotes | `"botany"`. Single quotes are invalid JSON, even though they are fine in JavaScript. |
| No trailing commas | The last item in an object or array has no comma after it. This is the most common JSON error by a wide margin. |
| No comments | `//` and `/* */` are not allowed. If a field needs explaining, document it elsewhere. |
| No functions | JSON carries data only. There is no way to send behaviour. |
| No dates | There is no date type. Dates travel as strings, by convention ISO 8601: `"2026-07-29T14:30:00Z"`. |
| No `undefined` | JavaScript's `undefined` has no JSON equivalent. Use `null`, or leave the key out entirely. |

## The six value types

| Type | Example | Notes |
| --- | --- | --- |
| String | `"Ares-1"` | Double quotes only |
| Number | `24`, `3.14`, `-7` | No separate int and float |
| Boolean | `true`, `false` | Lowercase, always |
| Array | `["botany", "welding"]` | Ordered, mixed types allowed, can be empty `[]` |
| Object | `{ "id": 1 }` | Key/value pairs, can be empty `{}` |
| Null | `null` | "This field exists and is deliberately empty" |

## The distinction that catches everyone

**JSON is text. A JavaScript object is data.** They look similar on screen and
behave nothing alike.

```javascript text versus data
const text = '{"name":"Sarah"}';   // a STRING, 16 characters long
const data = { name: "Sarah" };    // an OBJECT, has properties

text.name;        // undefined  ← strings have no .name property
data.name;        // "Sarah"

text.length;      // 16         ← the number of characters
data.length;      // undefined  ← objects have no length
```

> **Analogy:** sheet music is not music. It is marks on paper that a musician
> turns into sound. JSON is the sheet music, the object is the performance, and
> `JSON.parse` is the musician.

## Converting, in both directions

```javascript the two functions you will use constantly
const obj = { name: "Sarah", seats: 22 };

const text = JSON.stringify(obj);   // object → JSON text, for SENDING
// '{"name":"Sarah","seats":22}'

const back = JSON.parse(text);      // JSON text → object, for READING
// { name: "Sarah", seats: 22 }
```

`JSON.stringify` takes an optional third argument that indents the output, which
is invaluable while debugging:

```javascript readable output while debugging
console.log(JSON.stringify(obj, null, 2));
// {
//   "name": "Sarah",
//   "seats": 22
// }
```

The `null` in the middle is a filter you will rarely need. The `2` is how many
spaces to indent by.

## Where it fits in a real request

![Diagram: an object leaving JavaScript and arriving as a Python dict](/notes/img/web/ch10-json-round-trip.svg)

Every `fetch` body you send is `JSON.stringify`'d. Every response you read is
`.json()`'d, which does the parsing for you:

```javascript both conversions in one call
const res = await fetch("/api/apply/", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ full_name: "Mr Big Balls", role: 2 })   // ← stringify
});
const data = await res.json();                                    // ← parse
```

The `Content-Type: application/json` header is not decoration. It tells Django
"the body is JSON, read it as such". Leave it out and Django tries to read the
body as form data, finds nothing, and your fields arrive empty.

## Nesting

Real payloads nest, and nesting is just the same six types inside one another:

```json a mission with its crew
{
  "mission": "Ares-1",
  "seats_left": 22,
  "crew": [
    { "name": "Mr Big Balls", "role": { "id": 2, "title": "Botanist" } },
    { "name": "D. Pillay",    "role": { "id": 1, "title": "Engineer" } }
  ]
}
```

Read it from the outside in: an object, whose `crew` key holds an array, each
item of which is an object, whose `role` key holds another object. To reach
"Botanist" in JavaScript: `data.crew[0].role.title`.

## Reading the errors

JSON errors are blunt, but each one has a single usual cause.

| Error | What actually happened |
| --- | --- |
| `Unexpected token < in JSON at position 0` | You got HTML, not JSON. That `<` is the start of `<!DOCTYPE html>`. Almost always a 404 or 500 page, so your URL is wrong. |
| `Unexpected end of JSON input` | The body was empty. The server returned 204, or the request failed before sending anything. |
| `Unexpected token } in JSON` | A trailing comma before the closing brace. |
| `Expected property name or '}'` | A key without double quotes, or single quotes used instead. |

> **Debugging habit:** when a call misbehaves, log `await res.text()` instead of
> `await res.json()`. Text never throws, so you see exactly what came back,
> including an HTML error page. Switch back to `.json()` once you can see the
> body really is JSON.

## The Django side

Python calls the same two operations `json.dumps` and `json.loads`, but with
Django REST Framework you rarely call them yourself. Serializers do the work and
`Response` handles the conversion:

```python DRF does the converting for you
@api_view(["POST"])
def apply(request):
    # request.data is ALREADY a Python dict, DRF parsed the JSON body for us
    serializer = ApplicantSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        # Response takes a dict and emits JSON text with the right header
        return Response(serializer.data, status=201)
    return Response(serializer.errors, status=400)
```

| JavaScript | Python | Job |
| --- | --- | --- |
| `JSON.stringify(obj)` | `json.dumps(d)` | data → text, for sending |
| `JSON.parse(text)` | `json.loads(s)` | text → data, for reading |
| `res.json()` | `request.data` | the framework parses it for you |

## Recap

- JSON is **text**, always. Parse before using, stringify before sending.
- Double quotes on keys and strings, no trailing commas, no comments, no dates.
- `Content-Type: application/json` tells the other side how to read the body.
- If parsing fails, look at the raw text first. It is usually an HTML error page,
  which means the URL was wrong, not the JSON.
