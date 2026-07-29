// A front-facing CRT computer — Computer Science course card (T-077).
//
// Hand-authored rather than procedural: a recognisable object (bezel, screen,
// prompt, stand) is far easier to draw by hand at this resolution than to
// derive from a distance function, and character art is what the reference
// design is actually made of. Characters map to density via the renderer's
// RAMP — see bitmapField.js. Rows are padded automatically, so trailing
// spaces don't need counting; only the left edges need to line up.
//
// Pair with the 'scanline' animation: the sweep reads as a CRT refresh.

export const computer = [
  '                                              ',
  '      ##################################      ',
  '      #%..............................%#      ',
  '      #%.::::::::::::::::::::::::::::.%#      ',
  '      #%.:                          :.%#      ',
  '      #%.:   @@                     :.%#      ',
  '      #%.:     @@                   :.%#      ',
  '      #%.:       @@    @@@@@@@@@    :.%#      ',
  '      #%.:     @@                   :.%#      ',
  '      #%.:   @@                     :.%#      ',
  '      #%.:                          :.%#      ',
  '      #%.:    ===  ==  ====  ==     :.%#      ',
  '      #%.:                          :.%#      ',
  '      #%.:    ==  =====  ===        :.%#      ',
  '      #%.:                          :.%#      ',
  '      #%.::::::::::::::::::::::::::::.%#      ',
  '      #%..............................%#      ',
  '      #%.....@@@..................--..%#      ',
  '      ##################################      ',
  '           ########################           ',
  '            ######################            ',
  '          ##########################          ',
  '       ################################       ',
  '     ####################################     ',
  '                                              ',
]

export default computer
