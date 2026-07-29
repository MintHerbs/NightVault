# Chapter 2: HTML and CSS

*Week 2 · 2+1 hrs · Lab 2: first Django app · Assignment: PGP*

Here is what we're building by the end of this chapter: the Ares Colony site. Fully clickable already, so you know the target before we write a single tag. Click the nav, open the form, and open the code panes if you want to see how any part of it is made.

::playground{id="ch02-target"}

## Part 1: HTML, the skeleton

Every page starts the same way:

```html index.html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Ares Colony</title>
</head>
<body>
  <!-- everything visible goes here -->
</body>
</html>
```

`head` = invisible metadata. `body` = what people see. That's it.

### Structure tags

| Tag | Use for |
| --- | --- |
| `<nav>` | The navigation bar. |
| `<section>` | A distinct chunk of the page. |
| `<h1>` to `<h6>` | Headings, biggest to smallest. One `h1` per page. |
| `<p>` | A paragraph of text. |
| `<div>` | A generic invisible box, for grouping. |

### Tables

Use tables for actual tabular data, like a crew roster. Not for layout, that's what CSS is for.

```html a crew table
<table>
  <tr><th>Name</th><th>Role</th></tr>
  <tr><td>Mr Big Balls</td><td>Botanist</td></tr>
</table>
```

`tr` = table row. `th` = header cell (bold by default). `td` = data cell.

### Radio buttons and checkboxes

Both are `<input>` with a different `type`. The difference is behaviour, not looks:

| Type | Behaviour |
| --- | --- |
| `radio` | Pick **one** option out of a group. Group them with the same `name`. |
| `checkbox` | Pick **any number** independently, including zero. |

```html radio group + checkbox
<!-- same name = only one can be picked -->
<input type="radio" name="role" checked> Engineer
<input type="radio" name="role"> Botanist

<!-- independent, can tick or not -->
<input type="checkbox"> I accept it's a one-way trip
```

### `href` on images: making a picture clickable

`<img>` displays a picture using `src`. It's not a link by itself. Wrap it in `<a href>` to make the picture clickable, usually to open a bigger version:

```html clickable image
<a href="habitat-full.jpg" target="_blank">
  <img src="habitat-thumb.jpg" alt="Habitat module" width="220">
</a>
```

`alt` is required, it's the text shown if the image fails to load, and what screen readers read aloud. `target="_blank"` opens the link in a new tab.

## The scaffolding, before any CSS

This is the exact same HTML as our target, with zero CSS. This is what "just HTML" looks like. Everything works, nothing looks good yet. The CSS pane is empty on purpose: add a rule to it and watch the page change.

::playground{id="ch02-raw"}

> This is browser default styling. Black Times New Roman text, blue underlined links, grey buttons. Every browser has slightly different defaults. CSS is how we take control instead of leaving it to chance.

## Part 2: CSS, taking control of the look

A CSS rule has a selector (what to style) and properties (how). Recap:

```css anatomy
.apply-btn {
  background: #c1440e;
  color: white;
}
```

| Selector | Matches |
| --- | --- |
| `button` | Every `<button>` tag |
| `.apply-btn` | Every element with `class="apply-btn"` |
| `#seatNum` | The one element with `id="seatNum"` |

### The box model

Every element is a box with four layers, from inside out: `content`, `padding` (space inside the border), `border`, `margin` (space outside, pushing other elements away).

### Core properties you'll use constantly

| Property | Controls |
| --- | --- |
| `background`, `color` | Fill colour, text colour |
| `padding`, `margin` | Spacing inside / outside |
| `border`, `border-radius` | Outline, rounded corners |
| `font-size`, `font-weight` | Text size and boldness |
| `display: flex` | Line children up in a row (or column) with control over spacing |
| `:hover` | Style applied only while the mouse is over the element |
| `transition` | Animate a property change smoothly instead of snapping |

### Checkpoint 1: colours and spacing added, no flexbox yet

We add background colour, text colour, padding. We have NOT added `display:flex` yet, so the navbar items still stack, since that's still just default block flow.

::playground{id="ch02-checkpoint1"}

> Better already, colours are on-brand. But the navbar is stacked vertically and the button has square corners. That's what `display:flex` and `border-radius` fix next. Try adding them in the CSS pane above before reading on.

### Checkpoint 2: final, flexbox layout + rounded corners + hover + transitions

```css the finishing touches
.nav { display: flex; justify-content: space-between; }
.apply-btn { border-radius: 8px; transition: background .15s; }
.apply-btn:hover { background: #e2703a; }
```

That's it, that's the same target preview from the top of this chapter. Scroll up and try clicking around it again, now you know exactly which lines of HTML and CSS produce every part of it.
