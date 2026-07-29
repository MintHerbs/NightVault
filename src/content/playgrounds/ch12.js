// Chapter 12 playground: API integration (T-075).
//
// Same simulated endpoint as Chapter 9, but the raw response body is printed
// too. That is the habit the chapter is arguing for: when a call misbehaves,
// look at what actually came back before touching the JavaScript.

import { MARS_BASE_CSS, MARS_FORM_CSS, composeCss } from './theme'

export const ch12Playgrounds = [
  {
    id: 'ch12-api',
    label: 'Calling our own API from the browser',
    height: 340,
    files: {
      html: `<div class="pad">
  <button class="cta" id="call">GET /api/seats/</button>
  <div id="status" class="result"></div>

  <div class="log">
    <div class="log-label">// response body</div>
    <div id="body"></div>
  </div>
</div>`,
      css: composeCss(MARS_BASE_CSS, MARS_FORM_CSS, `.pad { padding: 26px; }

#status { margin-top: 12px; }

.log {
  margin-top: 14px;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: #0a0b14;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 0.76rem;
}

.log-label { color: #5f6b7a; }

#body { color: #8fd694; }`),
      js: `const fakeDB = { total: 24, taken: 2 };

function fakeFetchSeats() {
  return new Promise(function (resolve) {
    setTimeout(function () {
      resolve({ seats_left: fakeDB.total - fakeDB.taken, total: fakeDB.total });
    }, 700);
  });
}

const button = document.querySelector("#call");
const status = document.querySelector("#status");
const body = document.querySelector("#body");

button.addEventListener("click", async function () {
  status.className = "result load";
  status.textContent = "Requesting...";
  body.textContent = "pending...";

  const data = await fakeFetchSeats();

  status.className = "result ok";
  status.textContent = "200 OK";
  body.textContent = JSON.stringify(data);
});`,
    },
  },
]
