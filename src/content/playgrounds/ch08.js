// Chapter 8 playground: jQuery real-time validation (T-075).
//
// Ships with the loose "has an @ and a ." check the chapter starts from. The
// proper regex is the next thing the chapter shows, and it is left commented
// out below so the student can swap it in and feel the difference on a value
// like "a@b" or "sarah@earth..".

import { MARS_BASE_CSS, MARS_FORM_CSS, composeCss } from './theme'

export const ch08Playgrounds = [
  {
    id: 'ch08-live-validate',
    label: 'Validation as you type',
    height: 300,
    jquery: true,
    files: {
      html: `<div class="pad">
  <label>Email</label>
  <input id="email" type="text" placeholder="you@earth.com">
  <div id="message"></div>
</div>`,
      css: composeCss(MARS_BASE_CSS, MARS_FORM_CSS, `.pad { padding: 26px; }

#message {
  margin-top: 8px;
  color: #9aa0c0;
  font-size: 0.85rem;
}`),
      js: `$("#email").on("input", function () {
  const value = $(this).val();             // \`this\` = the input just typed in

  const looksOk = value.includes("@") && value.includes(".");

  // Swap the line above for this one to check the shape properly:
  // const looksOk = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value);

  $(this).toggleClass("valid", looksOk).toggleClass("invalid", !looksOk);

  $("#message").text(
    value.length ? (looksOk ? "Looks good" : "Needs an @ and a .") : ""
  );
});`,
    },
  },
]
