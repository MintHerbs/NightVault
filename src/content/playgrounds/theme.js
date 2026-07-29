// Shared CSS for the Ares Colony playgrounds (T-075).
//
// This is the `.marspv` block from the source course document with the
// `.marspv` prefix REMOVED from every selector. That matters pedagogically:
// each playground runs in its own iframe document, so the CSS a student reads
// and edits here is the same CSS they would write in their own project, not a
// scoped variant that only works inside this page.
//
// Composed into a playground's `css` string rather than injected separately, so
// the editor pane shows the complete stylesheet for the document. Fonts are
// system stacks, not the original Google Fonts import, so a playground has no
// third-party dependency and nothing to wait on before it paints.

/** Palette + base document rules. Every playground starts from these. */
export const MARS_BASE_CSS = `:root {
  --void: #0b0d17;
  --dust: #c1440e;
  --dust-lt: #e2703a;
  --sand: #f4ede4;
  --ink: #14162a;
  --muted: #c9cbe0;
  --dim: #8a91b4;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--void);
  color: var(--sand);
  font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.55;
}`

/** Nav bar, brand, page switching. Used by the full-site playgrounds. */
export const MARS_NAV_CSS = `.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.brand {
  font-weight: 700;
  font-size: 1.05rem;
  cursor: pointer;
}

.brand span { color: var(--dust-lt); }

.nav-links {
  display: flex;
  gap: 6px;
  align-items: center;
}

.nav-links button.link {
  padding: 8px 12px;
  border: none;
  border-radius: 7px;
  background: none;
  color: var(--muted);
  font-family: inherit;
  font-size: 0.9rem;
  cursor: pointer;
}

.nav-links button.link:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}

.nav-links button.link.active {
  background: rgba(226, 112, 58, 0.22);
  color: #fff;
}

.apply-btn {
  padding: 9px 18px;
  border: none;
  border-radius: 8px;
  background: var(--dust);
  color: #fff;
  font-family: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.apply-btn:hover { background: var(--dust-lt); }

@keyframes pulseBtn {
  0%   { box-shadow: 0 0 0 0 rgba(193, 68, 14, 0.6); }
  70%  { box-shadow: 0 0 0 12px rgba(193, 68, 14, 0); }
  100% { box-shadow: 0 0 0 0 rgba(193, 68, 14, 0); }
}

.apply-btn.pulse { animation: pulseBtn 1.6s infinite; }

.page { display: none; padding: 40px 24px 50px; }
.page.active { display: block; }`

/** Hero type, stats, tables, images. */
export const MARS_CONTENT_CSS = `.kicker {
  margin-bottom: 12px;
  color: var(--dust-lt);
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 0.7rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

h1.big {
  max-width: 16ch;
  margin: 0 0 12px;
  font-size: 1.9rem;
  font-weight: 700;
  line-height: 1.1;
}

p.lead {
  max-width: 46ch;
  margin: 0 0 20px;
  color: var(--muted);
  font-size: 0.96rem;
}

.stat-row {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  margin-top: 24px;
}

.stat .n { font-size: 1.7rem; font-weight: 700; color: #fff; }

.stat .l {
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--dim);
}

table.crew {
  width: 100%;
  margin-top: 10px;
  border-collapse: collapse;
  font-size: 0.85rem;
}

table.crew th,
table.crew td {
  border: 1px solid rgba(255, 255, 255, 0.12);
  padding: 8px 10px;
  text-align: left;
}

table.crew th { background: rgba(255, 255, 255, 0.05); color: #fff; }
table.crew td { color: var(--muted); }

a.img-link {
  display: inline-block;
  padding: 3px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
}

a.img-link img { display: block; border-radius: 6px; }`

/** Form controls, submit buttons, and the result message box. */
export const MARS_FORM_CSS = `label {
  display: block;
  margin: 12px 0 5px;
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 500;
}

input[type="text"],
input[type="email"],
select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  background: var(--ink);
  color: var(--sand);
  font-family: inherit;
  font-size: 0.9rem;
}

.radio-row,
.check-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 6px;
}

.radio-row label,
.check-row label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--muted);
  font-size: 0.86rem;
}

.form-card { max-width: 400px; }

.submit {
  width: 100%;
  margin-top: 18px;
  padding: 12px;
  border: none;
  border-radius: 9px;
  background: var(--dust);
  color: #fff;
  font-family: inherit;
  font-size: 0.96rem;
  font-weight: 600;
  cursor: pointer;
}

.submit:hover { background: var(--dust-lt); }

.cta {
  padding: 12px 24px;
  border: none;
  border-radius: 10px;
  background: var(--dust);
  color: #fff;
  font-family: inherit;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}

.cta:hover { background: var(--dust-lt); }

.result {
  display: none;
  margin-top: 14px;
  padding: 11px 13px;
  border-radius: 9px;
  font-size: 0.87rem;
}

.result.ok {
  display: block;
  border: 1px solid rgba(143, 214, 148, 0.4);
  background: rgba(143, 214, 148, 0.12);
  color: #b6e8bb;
}

.result.err {
  display: block;
  border: 1px solid rgba(255, 95, 86, 0.4);
  background: rgba(255, 95, 86, 0.1);
  color: #ffb3ad;
}

.result.load {
  display: block;
  border: 1px solid rgba(127, 179, 255, 0.4);
  background: rgba(127, 179, 255, 0.1);
  color: #bcd4ff;
}

.valid { outline: 2px solid #4caf6d; }
.invalid { outline: 2px solid #e25555; }`

/** Joins CSS fragments with a blank line between them. */
export function composeCss(...parts) {
  return parts.filter(Boolean).join('\n\n')
}
