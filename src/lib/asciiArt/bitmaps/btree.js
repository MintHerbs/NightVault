// A B+ tree diagram — the B+ Tree Visualizer card (T-077).
//
// Hand-authored for the same reason as bitmaps/computer.js and folder.js: the
// procedural "branches growing from a root" field only lit up cells lying
// almost exactly on a branch line, so at this grid resolution it sampled down
// to a faint smudge rather than a tree.
//
// Note the linked leaf row along the bottom — that sibling chain is what makes
// a B+ tree a B+ tree, so it's the one detail worth spending rows on.
//
// Only characters in the renderer's RAMP (' .:-=+*#%@') carry density; '|' and
// '/' render as empty, so connectors are drawn with '+' and '=' instead.

export const btree = [
  '                                          ',
  '                                          ',
  '                ############              ',
  '                #%%%%%%%%%%#              ',
  '                #%%%%%%%%%%#              ',
  '                ############              ',
  '                     ++                   ',
  '           ++++++++++++++++++++++         ',
  '           ++                   ++        ',
  '      ############        ############    ',
  '      #%%%%%%%%%%#        #%%%%%%%%%%#    ',
  '      ############        ############    ',
  '        ++      ++          ++      ++    ',
  '    #######  #######    #######  #######  ',
  '    #%%%%%#  #%%%%%#    #%%%%%#  #%%%%%#  ',
  '    #######  #######    #######  #######  ',
  '       ==========================         ',
  '                                          ',
  '                                          ',
  '                                          ',
]

export default btree
