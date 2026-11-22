# The codes between the staff page and the console

The website never changes the console directly. The staff page shows a QR code, the console's scanner reads it, and the console asks for the staff PIN before it saves anything. Codes that only light shelves or answer a sync need no PIN.

## From the staff page to the console

| Code | What it does |
|---|---|
| `RL:MOVE:<code6>:<UNIT>-<shelf>` | Moves one item (every copy). `<code6>` is the item's page code (`h` in `data.json`) |
| `RL:SHELF:<UNIT>-<shelf>:<UNIT>-<shelf>` | Moves everything on one shelf onto another. `:SWAP` on the end swaps the two |
| `RL:COUNT:<code6>:<n>` | How many Lending has. 0 takes the item out of Lending; a later count puts it back |
| `RL:FOUND:<code6>` | Takes an item off an audit's not-found list |
| `RL:ADD:<type>\|<UNIT>-<shelf>\|<copies>\|<name>` | Starts the new-item steps on the console |
| `RL:Q:<id>:<how many>:<check>:<change>*<change>...` | Up to about twelve MOVE, SHELF, COUNT and FOUND changes in one code, with a checksum |
| `RL:B:<id>:<part>/<parts>:<change>` | The same changes one at a time, for a scanner that cannot read the big code |
| `RL:KIT:<code6>,<code6>,...` | Lights every piece of a kit. No PIN |
| `RL:WEB:<pass>` | Links the console to the website, once |
| `RL:GOT:<n>` | The staff page's answer after a sync: the website has the console's list up to byte `<n>` |
| `RL:RESEND` | The two have lost track of each other: the console sends its whole list again |

## From the console to the website

**Send to website** shows the console's change list as QR pages. Each is the staff page's address followed by
`#RLSYNC~page~pages~lines~from~to~tidy!line!line...` with `~` for tab and `!` for a new line. `from` and `to` are byte positions in the console's `MOVES.TSV`; `tidy` is how many times the console has tidied up.

The lines, as the console keeps them:

| Line | Meaning |
|---|---|
| `code6, unit, shelf` | One item moved |
| `S, unit, low, high, unit, shelf` | A shelf's things moved to another shelf |
| `X, unit, low, high, unit, low, high` | Two shelves swapped |
| `B, unit, groove, 1 or 0` | A board put in or taken out |
| `U, unit, unit` | Two units traded places |
| `A, category, type, name, unit, shelf, copies` | A new item |
| `C, code6, copies` | A new count (0 = taken out of Lending) |
| `N, code6, 1 or 0` | Not found in an audit (1), or found again (0) |

## Shelf rules

- Grooves are numbered from the bottom, starting at 1. A shelf is the space from one board up to the next, and an item at a groove with no board sits on the board below.
- Taking a board out puts its things on the shelf below. Putting it back splits the space again.
- A whole unit only swaps with a unit that has the same number of lights.
- The console cannot see boards. Whoever moves one tells the console on that unit's screen.
