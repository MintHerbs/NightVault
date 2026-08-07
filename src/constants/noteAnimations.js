// Shape a `::anim{id="…"}` directive's id must match.
//
// Deliberately in its own module rather than in src/content/animations: the
// renderer and the editor both need to VALIDATE an id while parsing, but only a
// note that actually contains an animation needs the registry itself, which
// carries the SVG frame source for every animation on the site. Importing the
// regex from the registry would pull all of that into the markdown chunk that
// every reader downloads.
//
// Mirrors PLAYGROUND_ID_RE (constants/notePlaygrounds.js) exactly, which is
// shared between the same two surfaces for the same reason.
export const ANIMATION_ID_RE = /^[a-z0-9][a-z0-9-]{0,64}$/
