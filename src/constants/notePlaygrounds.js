// Shape a `::playground{id="…"}` directive's id must match (T-075).
//
// Deliberately in its own module rather than in src/content/playgrounds: the
// renderer and the editor both need to VALIDATE an id while parsing, but only a
// note that actually contains a playground needs the registry itself, which
// carries ~25 KB of embedded HTML/CSS/JS. Importing the regex from the registry
// would pull all of that into the markdown chunk that every reader downloads.
//
// Mirrors how HEX_COLOR_RE (constants/noteColors.js) is shared between the same
// two surfaces.
export const PLAYGROUND_ID_RE = /^[a-z0-9][a-z0-9-]{0,48}$/
