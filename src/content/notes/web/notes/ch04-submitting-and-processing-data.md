# Chapter 4: Submitting and processing data

*Week 4 · 2+1 hrs · Lab 4 · Quiz 1 · Deliverable: Collaborative Interface Design (web+mobile)*

Reading: [MDN: Django forms](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Server-side/Django/Forms)

Back to the Ares Colony form from Chapter 2. It's built in HTML and styled in CSS, but nothing happens when you click Submit. Notice the Apply button below is pulsing, that's a CSS animation nudging the user to click it.

::playground{id="ch04-form"}

We built the shape with HTML/CSS. Now we build the behaviour with JavaScript, a full pass on the language, then we point it at this exact form.

## JavaScript language guide

### Variables

```javascript variables
const name = "Sarah";   // won't be reassigned
let age = 21;           // will change
age = 22;               // fine, it's `let`
```

Use `const` by default, `let` only when the value must change.

### Data types

| Type | Example |
| --- | --- |
| String | `"hello"` |
| Number | `24`, `3.14` |
| Boolean | `true`, `false` |
| Array | `["Engineer", "Botanist"]` |
| Object | `{ name: "Sarah", age: 21 }` |

### Operators

| Operator | Meaning |
| --- | --- |
| `===` | Equal to (always use this, not `==`) |
| `!==` | Not equal to |
| `&&` / `\|\|` / `!` | AND / OR / NOT |
| `+= -= ++` | Add and reassign, subtract and reassign, increment by 1 |

### Conditionals

```javascript if / else
if (age >= 18) {
  console.log("adult");
} else {
  console.log("minor");
}
```

### Loops

```javascript for / while
for (let i = 0; i < 5; i++) {
  console.log(i);            // 0 1 2 3 4
}

const roles = ["Engineer", "Botanist"];
roles.forEach(function (r) { console.log(r); });
```

### Functions, the plain way and the short way

```javascript functions
// plain function, named, reusable
function greet(name) {
  return "Welcome, " + name;
}
greet("Sarah");              // "Welcome, Sarah"

// arrow function, same thing, shorter
const greet2 = (name) => "Welcome, " + name;
```

A function is a named block of steps. You define it once, call it as many times as you like, with different inputs each time.

### Talking to the page: DOM and events

| Task | Code |
| --- | --- |
| Find an element | `document.querySelector("#name")` |
| Read a typed value | `.value` |
| Change visible text | `.textContent` |
| React to a click / submit | `.addEventListener("click", fn)` |

## Now, wire it to the form

Grab the fields, listen for submit, stop the page reloading, check the values, show a result.

```javascript apply.js
const form = document.querySelector("#apply");
const result = document.querySelector("#result");

form.addEventListener("submit", function (event) {
  event.preventDefault();                 // stop reload
  const name = document.querySelector("#name").value;
  const email = document.querySelector("#email").value;

  if (!name || !email.includes("@")) {
    result.className = "result err";
    result.textContent = "Fill in a name and valid email.";
    return;
  }
  result.className = "result ok";
  result.textContent = "Welcome aboard, " + name + "!";
});
```

Try it in the playground above: submit empty, submit with a bad email, then submit properly. Open the JS pane and change the message, or drop the `preventDefault()` line to see what it was stopping.

## Enter jQuery

Same logic, jQuery spelling. `$("#name").val()` instead of `document.querySelector("#name").value`. Shorter, same idea.

```javascript same thing, jQuery
$("#apply").on("submit", function (e) {
  e.preventDefault();
  const name = $("#name").val();
  $("#result").text("Welcome, " + name).fadeIn();
});
```

## A first taste of AJAX

Right now the form only shows a message, it never leaves the browser. **AJAX** means sending that data to a server in the background, no reload, using `fetch`:

```javascript preview of what's coming
// this line is the actual request; the rest is prep and reaction
fetch("/api/apply/", { method: "POST", body: JSON.stringify({name, email}) })
  .then(res => res.json())
  .then(data => console.log("saved as", data.id));
```

> This is exactly how the form will eventually reach Django's database. Full AJAX deep dive is Chapter 9, once we've built the server side in Chapters 5 and 6.
