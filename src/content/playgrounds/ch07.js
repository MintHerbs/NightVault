// Chapter 7 playground: jQuery for forms (T-075).
//
// Collect every problem into a list first, then report them together. `jquery:
// true` makes the runner load jQuery from a CDN into the iframe, which is the
// same way the chapter tells you to load it in your own project.

import { MARS_BASE_CSS, MARS_FORM_CSS, composeCss } from './theme'

export const ch07Playgrounds = [
  {
    id: 'ch07-validate-all',
    label: 'Check every field at once',
    height: 340,
    jquery: true,
    files: {
      html: `<div class="pad">
  <label>Full name</label>
  <input id="name" type="text" placeholder="Neil Armstrong">

  <label>Email</label>
  <input id="email" type="text" placeholder="you@earth.com">

  <button class="cta" id="check">Check my answers</button>
  <div id="message" class="result"></div>
</div>`,
      css: composeCss(MARS_BASE_CSS, MARS_FORM_CSS, `.pad { padding: 26px; }

#check { margin-top: 14px; }

#message { margin-top: 12px; }`),
      js: `$("#check").on("click", function () {
  const problems = [];                       // collect every issue found

  if (!$("#name").val()) {
    problems.push("name is required");
  }
  if (!$("#email").val().includes("@")) {
    problems.push("email looks wrong");
  }

  if (problems.length > 0) {
    $("#message").attr("class", "result err").text(problems.join(", "));
  } else {
    $("#message").attr("class", "result ok").text("All good.");
  }
});`,
    },
  },
]
