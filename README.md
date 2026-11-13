# IDeATe Lending item guides

A student-made, unofficial guide to 382 entries in the IDeATe Lending inventory. Names were checked against the October 2026 Lending Office inventory and the current Room Locator v5.3 SD snapshot. The public CMU catalog was checked for model details; some records still do not identify a precise version. Locations and availability are a snapshot. Ask staff for the current shelf, kit contents, and checkout due date.

The site provides an image for every item (exact model photo, clearly labeled representative photo, or original illustration), preparation lists, first steps, relevant tips, maker resources when verified, a model chooser for selected ambiguous entries, a room view, and an optional Google Calendar return reminder.

## Files

- `index.html`, `styles.css`, `app.js`: public site.
- `data.json`: inventory, stable `h` QR identifiers, and item locations.
- `photos.json`: image mapping with source/license links. Original SVG illustrations are in the repository root.
- `room.json`: geometry and board positions from the Room Locator SD snapshot.
- `staff.html`, `staff.js`: add item form that downloads a reviewable `data.json` update.
- `sync_room.py`: refresh locations and boards from the current SD files.
- `STAFF-GUIDE.md`: transfer, publishing, maintenance, and photo instructions.
- `SHELF-MOVES.md`: safe shelf move logic for future console work.

Preview locally with `python3 -m http.server` in this directory. Opening `index.html` as a file will not load the JSON.

Printed `?i=<code>` QR links remain stable when the list is edited. Hash links of the form `#kN` depend on list order, so use QR codes for permanent item labels.

The official policy source is https://ideate.cmu.edu/resources/lending/index.html. This site is not an official policy or checkout service.
