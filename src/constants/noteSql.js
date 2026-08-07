// Shape a `::sqlrun{id="…"}` directive's id must match.
//
// In its own module for the same reason PLAYGROUND_ID_RE and ANIMATION_ID_RE
// are: the renderer and the editor both validate an id while parsing, but only
// a note that actually embeds a console needs the script registry itself.
export const SQL_SCRIPT_ID_RE = /^[a-z0-9][a-z0-9-]{0,64}$/
