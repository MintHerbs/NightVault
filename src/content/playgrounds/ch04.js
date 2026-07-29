// Chapter 4 playground: submitting and processing data (T-075).
//
// The Chapter 2 scaffold with the Apply button now pulsing, and a form that
// actually responds. Plain `document.querySelector` / `addEventListener`, which
// is exactly what the chapter teaches before jQuery is introduced.

import { MARS_BASE_CSS, MARS_NAV_CSS, MARS_CONTENT_CSS, MARS_FORM_CSS, composeCss } from './theme'

export const ch04Playgrounds = [
  {
    id: 'ch04-form',
    label: 'The form, now wired up',
    height: 440,
    files: {
      html: `<nav class="nav">
  <div class="brand" data-go="home">Ares<span>Colony</span></div>
  <div class="nav-links">
    <button class="link active" data-go="home">Mission</button>
    <button class="apply-btn pulse" data-go="apply">Apply</button>
  </div>
</nav>

<div class="page active" data-page="home">
  <div class="kicker">Recruitment window open</div>
  <h1 class="big">Be among the first to live on Mars.</h1>
  <p class="lead">Click Apply, then try submitting the form empty.</p>
</div>

<div class="page" data-page="apply">
  <div class="kicker">Application form</div>
  <h1 class="big">Apply to be an astronaut.</h1>
  <div class="form-card">
    <form id="apply">
      <label>Full name</label>
      <input id="name" type="text" placeholder="Neil Armstrong">

      <label>Email</label>
      <input id="email" type="email" placeholder="you@earth.com">

      <button type="submit" class="submit">Submit</button>
      <div id="result" class="result"></div>
    </form>
  </div>
</div>`,
      css: composeCss(MARS_BASE_CSS, MARS_NAV_CSS, MARS_CONTENT_CSS, MARS_FORM_CSS),
      js: `// Page switching, same as Chapter 2.
document.querySelectorAll("[data-go]").forEach(function (button) {
  button.addEventListener("click", function () {
    var target = button.getAttribute("data-go");
    document.querySelectorAll("[data-page]").forEach(function (page) {
      page.classList.toggle("active", page.getAttribute("data-page") === target);
    });
    document.querySelectorAll(".link").forEach(function (link) {
      link.classList.toggle("active", link.getAttribute("data-go") === target);
    });
  });
});

// The part this chapter is about.
const form = document.querySelector("#apply");
const result = document.querySelector("#result");

form.addEventListener("submit", function (event) {
  event.preventDefault();                 // stop the page reloading

  const name = document.querySelector("#name").value.trim();
  const email = document.querySelector("#email").value.trim();

  if (!name || !email.includes("@")) {
    result.className = "result err";
    result.textContent = "Fill in a name and valid email.";
    return;
  }

  result.className = "result ok";
  result.textContent = "Welcome aboard, " + name + "!";
  form.reset();
});`,
    },
  },
]
