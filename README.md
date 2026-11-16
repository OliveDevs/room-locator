# IDeATe Lending item guides

A student-made, unofficial guide to 382 entries in the IDeATe Lending inventory. Names were checked against the October 2026 Lending Office inventory and the current Room Locator v5.3 SD snapshot. The public CMU catalog was checked for model details; some records still do not identify a precise version. Locations and availability are a snapshot. Ask staff for the current shelf, kit contents, and checkout due date.

Each guide has what to gather, first steps, and a link to the maker's manual or a video walkthrough where we could find one that really matches the model. Photos are shown only when they are the right kind of thing (an exact model photo or a clearly labeled representative one); otherwise the page says "No photo yet" instead of showing the wrong item.

## Files

- `index.html`, `styles.css`, `app.js`: public site.
- `data.json`: inventory, stable `h` QR identifiers, and item locations.
- `photos.json`: image mapping with source/license links. Original SVG illustrations are in the repository root.
- `room.json`: geometry, board positions and the console's type list from the Room Locator SD snapshot.
- `staff.html`, `staff.js`: staff tools. Make QR codes the Room Locator console reads (move a thing, move a shelf, add a new item) and download a `data.json` update for a new item's guide.
- `room3d.js`: the 3D model of the room on the staff page. Click a shelf to pick where something goes.
- `firmware/RoomLocatorV5/RoomLocatorV5.ino`: the Arduino Mega code for the console.
- `diagrams/`: the block diagram and schematic (draw.io sources and PNG exports).
- `docs-photos/`: photos used in the class documentation.
- `sync_room.py`: refresh locations and boards from the current SD files.
- `STAFF-GUIDE.md`: transfer, publishing, maintenance, and photo instructions.
- `SHELF-MOVES.md`: the phone codes, the shelf rules, and the staff PIN.

Preview locally with `python3 -m http.server` in this directory. Opening `index.html` as a file will not load the JSON.

Printed `?i=<code>` QR links remain stable when the list is edited. Hash links of the form `#kN` depend on list order, so use QR codes for permanent item labels.

The official policy source is https://ideate.cmu.edu/resources/lending/index.html. This site is not an official policy or checkout service.
