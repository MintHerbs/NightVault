/**
 * Stylelint — contrast guard only (LT-001 / issue #50).
 *
 * WHY THIS CONFIG EXTENDS NOTHING
 * -------------------------------
 * There is deliberately no `extends: ['stylelint-config-standard']`. That preset
 * is opinionated about hex casing, leading zeros, custom-property naming and
 * much else, and would emit hundreds of errors across the ~100 existing CSS
 * files — none of them related to the defect this guard exists to catch. It
 * would also trip on the `composes:` and `:global()` CSS-Modules syntax used in
 * 6 files, since those rules only arrive with the preset.
 *
 * A single-rule config keeps the CI signal focused on one thing. If the project
 * later wants full CSS linting, that is its own ticket with its own large diff.
 *
 * THE RULE
 * --------
 * Bans low-alpha white as a *text* colour. The `color` property only — this
 * does not touch `background-color` or `border-color`, which carry no text
 * contrast requirement.
 *
 * Threshold is alpha < 0.5, derived from the real page background
 * (`--bg-dark: #0d0d0d`, set on `body` — not pure black):
 *
 *   alpha 0.50  ->  ~5.3:1   passes WCAG AA
 *   alpha 0.45  ->  ~4.5:1   borderline, fails on lighter surfaces
 *   alpha 0.40  ->  ~3.8:1   fails
 *   alpha 0.35  ->  ~3.2:1   fails
 *
 * So 0.5 is the safe cut. For low-emphasis text use `var(--md-on-surface-variant)`
 * (#c9c2d2, ~10:1 on every dark surface in this app) instead.
 *
 * Known false positive: alpha 0.48 is matched but computes to ~5.0:1. It is
 * marginal enough that converting it to the token is the right call anyway, so
 * no exception is carved out.
 *
 * T-062 addendum: the theme retrofit rewrote every `rgba(255,255,255,α)` into
 * `rgba(var(--color-fg-rgb), α)` so the washes follow light/dark mode. That
 * form sailed straight past the original literal-only pattern, silently
 * disarming this guard, so the token form is matched too. In light mode
 * --color-fg-rgb is a near-black, where a low alpha fails contrast just as
 * badly — the threshold applies to both.
 */
export default {
  rules: {
    'declaration-property-value-disallowed-list': [
      {
        color: [
          '/^rgba\\(\\s*255\\s*,\\s*255\\s*,\\s*255\\s*,\\s*0?\\.[0-4]/',
          '/^rgba\\(\\s*var\\(\\s*--color-fg-rgb\\s*\\)\\s*,\\s*0?\\.[0-4]/',
        ],
      },
      {
        message:
          'Low-alpha white fails WCAG AA for text. Use var(--md-on-surface-variant) for low-emphasis text (LT-001).',
      },
    ],
  },
  ignoreFiles: ['node_modules/**', 'dist/**'],
};
