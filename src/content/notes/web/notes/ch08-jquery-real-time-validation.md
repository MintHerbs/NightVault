# Chapter 8: jQuery real-time validation

*Week 8 · 2+1 hrs*

Checking on submit is fine, but better UX tells the user immediately, as they type, using `.on("input", ...)`, which fires on every keystroke.

::playground{id="ch08-live-validate"}

```javascript live-validate.js
$("#email").on("input", function () {
  const value = $(this).val();          // `this` = the input just typed in
  const looksOk = value.includes("@") && value.includes(".");

  $(this).toggleClass("valid", looksOk).toggleClass("invalid", !looksOk);
  $("#message").text(looksOk ? "Looks good" : "Needs an @ and a .");
});
```

`.toggleClass(name, condition)` adds the class if `condition` is true, removes it otherwise. `"input"` fires on every keystroke, unlike `"change"` which only fires when you click away.

## Doing it properly with regex

Checking for "@" and "." is a rough approximation. A **regular expression** (regex) is a pattern that checks text shape properly.

```javascript a real email pattern
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const looksOk = emailPattern.test(value);
```

`.test(value)` returns `true` or `false`. Reading the pattern: some characters, then `@`, then some characters, then `.`, then some characters, nothing else.

The playground above still uses the loose check. Open its JS pane, swap in the commented-out regex line, and try a value like `a@b` or `sarah@earth..` to feel the difference.

> Regex is a whole topic on its own. For this course, know that `.test()` exists and what it's for, you don't need to write patterns from memory, plenty of tested ones exist online for emails, phone numbers, and passwords.
