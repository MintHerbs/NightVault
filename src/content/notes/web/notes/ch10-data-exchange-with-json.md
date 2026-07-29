# Chapter 10: Data exchange with JSON

*Week 10 · 2+1 hrs · Assignment 1 · Test 1 (scheduled separately)*

**JSON** (JavaScript Object Notation) is the text format almost every API uses. It looks like a JS object, but it's just text, any language can read and write it.

```json a JSON payload
{
  "full_name": "Mr Big Balls",
  "role": 2,
  "accepted_risk": true
}
```

| Rule | Detail |
| --- | --- |
| Keys are strings | Always in double quotes: `"full_name"` |
| Values | String, number, boolean, array, object, or `null` |
| No trailing commas | The last item in a list has no comma after it |

```javascript converting between JS objects and JSON text
const obj = { name: "Sarah" };

const text = JSON.stringify(obj);   // object → JSON text, for sending
const back = JSON.parse(text);      // JSON text → object, for reading
```

Every `fetch` body you send is `JSON.stringify`'d. Every response you read is `.json()`'d (which does the parsing for you). On the Django side, DRF serializers do this same job in Python.
