# Moving things with a phone code

Room Locator v5.4 (code version 14) reads codes made on `staff.html`. The website never changes the console directly: the code only tells the console what to propose. The console checks every part, shows the change with the old spot lit green and the new spot lit blue, and asks for the staff PIN before it saves anything to its SD card.

## The codes

| Code | What it does |
|---|---|
| `RL:MOVE:<code6>:<UNIT>-<shelf>` | Moves one item (every copy). `<code6>` is the item's page code (`h` in `data.json`). |
| `RL:SHELF:<UNIT>-<shelf>:<UNIT>-<shelf>` | Moves everything on one shelf onto another shelf. |
| `RL:SHELF:...:SWAP` | Swaps the two shelves' contents. |
| `RL:ADD:<type>\|<UNIT>-<shelf>\|<copies>\|<name>` | Starts the 3-step "new item" setup: check the details, scan the item's own barcode sticker (or skip), check the spot. `<type>` is the type's line number in the console's `TYPES.TSV` (listed in `room.json` as `types`). |

Every code must be under 60 characters, because the scanner hands the console 64 characters at a time. The staff page enforces this.

## Shelf rules the console uses

- Grooves are numbered from the bottom, starting at 1. `BOARDS.TSV` lists which grooves have a board.
- A shelf is the space from one board up to the next. An item at a groove with no board sits on the board below, and all the lights of that tall space light up together.
- Taking a board out (on the console) puts its things on the shelf below. Putting it back splits the space again; things already below stay put.
- A whole unit can only swap with another unit that has the same number of lights (done on the console, not by phone code).
- The console cannot see boards. Whoever moves a board in the model tells the console on the unit's screen.

## The staff PIN

- Stored on the console's SD card in `STAFF.TSV` (4 digits; 1234 if the file is missing). It is never on this website.
- Once typed, changes stay open for 5 minutes; a restart locks them again.
- Change it on the console: Home, Down past the last picture, Select, then the last spot on the map, "Change staff PIN".

## Bringing console changes back to the laptop and this site

1. Moves: type `@MOVES` in the Serial Monitor, save the output as `MOVES.TSV`, run `apply_moves.py "SD card files" MOVES.TSV`, send the files back to the card, then `@CLEARMOVES`.
2. New items: type `@ADDED`, save the output as `ADDED.txt`, run `fold_added.py "SD card files" ADDED.txt`, send `KINDS.TSV`, `TYPES.TSV`, `CODES.TSV` to the card.
3. Run `python3 sync_room.py "SD card files"` here and upload `data.json` and `room.json`, so the room view and staff page match the console again.
