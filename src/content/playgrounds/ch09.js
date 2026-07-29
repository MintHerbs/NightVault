// Chapter 9 playground: AJAX (T-075).
//
// There is no Django server behind this page, so `fakeFetchSeats()` stands in
// for one: a promise that resolves after a delay, which is the part of a real
// request that actually matters here (you get an answer later, not now). Swap it
// for a real `fetch("/api/seats/")` and the rest of the code is unchanged. That
// substitutability is the point.

import { MARS_BASE_CSS, MARS_FORM_CSS, composeCss } from './theme'

export const ch09Playgrounds = [
  {
    id: 'ch09-ajax',
    label: 'AJAX against a simulated endpoint',
    height: 280,
    files: {
      html: `<div class="pad">
  <button class="cta" id="check">Check seat availability</button>
  <div id="result" class="result"></div>
</div>`,
      css: composeCss(MARS_BASE_CSS, MARS_FORM_CSS, `.pad { padding: 26px; }

#result { margin-top: 12px; }`),
      js: `// Stands in for the Django endpoint from Chapter 11.
const fakeDB = { total: 24, taken: 2 };

function fakeFetchSeats() {
  return new Promise(function (resolve) {
    setTimeout(function () {
      resolve({ seats_left: fakeDB.total - fakeDB.taken, total: fakeDB.total });
    }, 700);
  });
}

const button = document.querySelector("#check");
const result = document.querySelector("#result");

button.addEventListener("click", async function () {
  result.className = "result load";
  result.textContent = "Contacting server...";

  // The real thing would be:
  //   const res = await fetch("/api/seats/");
  //   const data = await res.json();
  const data = await fakeFetchSeats();

  result.className = "result ok";
  result.textContent = data.seats_left + " of " + data.total + " seats available.";
});`,
    },
  },
]
