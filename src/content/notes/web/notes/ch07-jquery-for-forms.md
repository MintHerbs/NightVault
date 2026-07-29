# Chapter 7: jQuery for forms

*Week 7 · 2+1 hrs · Quiz 4*

Chapter 4 introduced jQuery briefly. Now we use it properly on forms: reading multiple fields, chaining methods, and validating the whole form at once before it's allowed to submit.

## Reading and writing with jQuery

| Method | Does |
| --- | --- |
| `.val()` | Get/set an input's value |
| `.text()` | Get/set an element's plain text |
| `.html()` | Get/set an element's inner HTML |
| `.attr(name)` | Get/set an HTML attribute |
| `.addClass()` / `.removeClass()` | Add or remove a CSS class |
| `.on(event, fn)` | Listen for an event: click, submit, focus, blur |

jQuery methods return the jQuery object itself, so you can **chain** them:

```javascript chaining
$("#result")
  .text("Checking...")
  .removeClass("ok err")
  .addClass("load");
```

## Validating a whole form before it submits

Instead of checking one field, collect every problem into a list, then decide.

::playground{id="ch07-validate-all"}

```javascript check-all.js
$("#check").on("click", function () {
  const problems = [];                       // collect every issue found

  if (!$("#name").val()) problems.push("name is required");
  if (!$("#email").val().includes("@")) problems.push("email looks wrong");

  if (problems.length > 0) {
    $("#message").attr("class", "result err").text(problems.join(", "));
  } else {
    $("#message").attr("class", "result ok").text("All good.");
  }
});
```

This pattern, collect every problem then report them together, scales to any number of fields, and is exactly what Chapter 8's live version builds on. Try adding a third field to the playground's HTML and a third check to its JS.
