// Chapter 2 playgrounds: HTML and CSS (T-075).
//
// Three states of the same page, in the order the chapter presents them:
// the finished target, the same markup with no CSS at all, and the halfway
// checkpoint where colours exist but flexbox does not. Keeping all three as
// live documents (rather than screenshots) is the point of the chapter: the
// student can add the missing rules to `ch02-raw` and watch it converge.

import { MARS_BASE_CSS, MARS_NAV_CSS, MARS_CONTENT_CSS, MARS_FORM_CSS, composeCss } from './theme'

const TARGET_HTML = `<nav class="nav">
  <div class="brand" data-go="home">Ares<span>Colony</span></div>
  <div class="nav-links">
    <button class="link active" data-go="home">Mission</button>
    <button class="link" data-go="crew">Crew</button>
    <button class="apply-btn" data-go="apply">Apply</button>
  </div>
</nav>

<div class="page active" data-page="home">
  <div class="kicker">Recruitment window open</div>
  <h1 class="big">Be among the first to live on Mars.</h1>
  <p class="lead">24 colonists. 2031 launch. No prior spaceflight required.</p>

  <a class="img-link" href="habitat-full.svg" target="_blank">
    <img src="habitat-thumb.svg" alt="Habitat module, click to enlarge" width="220">
  </a>

  <div class="stat-row">
    <div class="stat"><div class="n">24</div><div class="l">Seats</div></div>
    <div class="stat"><div class="n">2031</div><div class="l">Launch</div></div>
  </div>
</div>

<div class="page" data-page="crew">
  <div class="kicker">Confirmed crew</div>
  <h1 class="big">Meet the crew.</h1>
  <table class="crew">
    <tr><th>Name</th><th>Role</th></tr>
    <tr><td>Mr Big Balls</td><td>Botanist</td></tr>
    <tr><td>D. Pillay</td><td>Engineer</td></tr>
  </table>
</div>

<div class="page" data-page="apply">
  <div class="kicker">Application</div>
  <h1 class="big">Apply to be an astronaut.</h1>
  <div class="form-card">
    <label>Full name</label>
    <input type="text" placeholder="Neil Armstrong">

    <label>Preferred role</label>
    <div class="radio-row">
      <label><input type="radio" name="role" checked> Engineer</label>
      <label><input type="radio" name="role"> Botanist</label>
    </div>

    <div class="check-row">
      <label><input type="checkbox"> I accept it's a one-way trip</label>
    </div>

    <button class="submit">Submit</button>
  </div>
</div>`

// Page switching is previewed here ahead of Chapter 4, which is where the
// language itself is taught. Read it as "something makes the buttons work" for
// now; by Chapter 4 every line of it will be familiar.
const TARGET_JS = `// Show one .page at a time. Chapter 4 explains this properly.
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
});`

export const ch02Playgrounds = [
  {
    id: 'ch02-target',
    label: 'Ares Colony, finished',
    height: 460,
    files: {
      html: TARGET_HTML,
      css: composeCss(MARS_BASE_CSS, MARS_NAV_CSS, MARS_CONTENT_CSS, MARS_FORM_CSS),
      js: TARGET_JS,
    },
  },
  {
    id: 'ch02-raw',
    label: 'The same HTML, no CSS',
    height: 520,
    files: {
      html: `<div><b>AresColony</b></div>
<div><a href="#">Mission</a> <a href="#">Crew</a> <button>Apply</button></div>

<h1>Be among the first to live on Mars.</h1>
<p>24 colonists. 2031 launch. No prior spaceflight required.</p>

<a href="habitat-full.svg" target="_blank">
  <img src="habitat-thumb.svg" alt="Habitat module" width="160">
</a>

<table border="1" cellpadding="5">
  <tr><th>Name</th><th>Role</th></tr>
  <tr><td>Mr Big Balls</td><td>Botanist</td></tr>
</table>

<p>Full name: <input type="text"></p>
<p><input type="radio" name="role" checked> Engineer <input type="radio" name="role"> Botanist</p>
<p><input type="checkbox"> I accept it's a one-way trip</p>
<button>Submit</button>`,
      // Deliberately empty: this playground exists to show browser defaults.
      // Try adding a rule and watch the page above change.
      css: `/* Nothing here yet. That is the whole point of this preview:
   everything you see is the browser's own default styling.

   Add a rule and watch it take effect, e.g.

   body { background: #0b0d17; color: #f4ede4; font-family: sans-serif; }
*/`,
      js: '',
    },
  },
  {
    id: 'ch02-checkpoint1',
    label: 'Checkpoint 1, colours but no flexbox',
    height: 420,
    files: {
      html: `<div class="nav">
  <div class="brand">AresColony</div>
  <a href="#">Mission</a>
  <a href="#">Crew</a>
  <button class="apply-btn">Apply</button>
</div>

<h1>Be among the first to live on Mars.</h1>
<p class="lead">24 colonists. 2031 launch.</p>

<table class="crew">
  <tr><th>Name</th><th>Role</th></tr>
  <tr><td>Mr Big Balls</td><td>Botanist</td></tr>
</table>`,
      css: `${MARS_BASE_CSS}

/* Colours and spacing are in. Note what is NOT here yet:
   no display:flex, so the navbar items still stack vertically,
   and no border-radius, so the button corners are square. */

.nav { padding: 16px; }

.brand {
  padding: 8px 0;
  color: var(--dust-lt);
  font-weight: 700;
}

.nav a {
  display: block;
  padding: 4px 0;
  color: var(--muted);
}

.apply-btn {
  margin-top: 6px;
  padding: 8px 14px;
  border: none;
  background: var(--dust);
  color: #fff;
}

h1 { margin: 20px 16px 0; font-size: 1.6rem; }

.lead { margin: 0 16px; color: var(--muted); }

table.crew {
  margin: 10px 16px;
  border-collapse: collapse;
}

table.crew th,
table.crew td {
  border: 1px solid #444;
  padding: 6px;
}`,
      js: '',
    },
  },
]
