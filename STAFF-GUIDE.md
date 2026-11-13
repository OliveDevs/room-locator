# Maintaining the IDeATe Lending guide

This is a student project, ready for IDeATe staff to review and own. The public site is a **snapshot**, not the checkout system or a source of live availability.

## Publish under an IDeATe GitHub account

1. Ask the IDeATe repository owner to fork or copy `OliveDevs/room-locator` into an IDeATe organization repository. Keep the files at the repository root.
2. In the new repository, enable GitHub Pages for the main branch and root folder. Open several item pages and the room view on the new Pages URL.
3. Existing QR labels and the Room Locator firmware currently point to `https://olivedevs.github.io/room-locator/?i=<six-character-code>`. Keep that old site available as a redirect, or change the firmware QR base and replace printed labels. Relative links inside this site already work under a different repository name.
4. Have an IDeATe staff member check the item list, photos, manual versions, due-date language, and room positions before linking the new site from an official page. The copyright or use permission for any staff or catalog photos should be confirmed first.

No GitHub password or access token is stored in the site. The student authors do not need organization administrator access. Staff can use GitHub's web editor and normal review process.

## Add an item

1. Open `staff.html` on the published site and fill in the physical item's name, unit, shelf, preparation list, steps, and any verified maker guide.
2. The form downloads a new `data.json` and shows the new item's stable six-character QR code. It does **not** publish automatically. Review the file, then upload it in a GitHub branch or commit. Upload a staff-owned photo if you entered a relative photo path.
3. Add the same item to the Room Locator console inventory. The website and console are separate systems. Check the published item page and room view after both are updated.
4. For a model name that could mean several generations, add verified versions to `MODEL_CHOICES` in `app.js`, or leave the maker guide blank until the unit label is checked. Do not link a manual for a guessed version.

The form stores a custom preparation list, first steps, and tips directly in the new item's data. Existing entries can be edited in `data.json`: `n` name, `c` category, `t` type, `x` copies, `u` unit, `s` groove, `w` display location, `d` short description, `r` official links, `need`, `start`, and `tips`. Keep the existing `h` code unchanged; changing it breaks printed QR links. `photos.json` maps existing items to licensed photos or illustrations. Each photo record has a source and license link; an individual item can instead have a `p` photo object.

## Refresh locations and shelf boards

For a verified SD card snapshot, run `python3 sync_room.py /path/to/SD-card-files`. This reads `KINDS.TSV`, `UNITS.TSV`, and `BOARDS.TSV` and updates item locations in `data.json` plus the room layout in `room.json`. It stops if a new console item is missing a website guide, so the new item can be reviewed first. Do not sync an old SD snapshot over newer staff edits. Commit the updated files together and check a few real shelves.

The room view treats shelves as groove positions counted from the bottom. Only grooves listed in `BOARDS.TSV` have physical boards. For a listed item at groove `g`, the displayed support board is the highest board at or below `g`. The room view uses the November 13, 2026 v5.3 SD snapshot and must be refreshed when the physical layout changes.

## Return reminders and official rules

The calendar button makes a draft event in the borrower's own Google Calendar. The borrower enters the due date from their checkout email and saves the event themselves. The shortcut fills CMU's normal three-day, 6 p.m. estimate; holidays or special checkout terms can change the actual date. The current IDeATe Lending page says renewals ended in Fall 2026: https://ideate.cmu.edu/resources/lending/index.html. Recheck the official page each term and update `app.js` if the policy changes.

## Photos and manuals

Existing images are either original site illustrations or Wikimedia Commons images with an individual source and license link in `photos.json`. Many are deliberately marked “Representative photo” because the inventory name does not identify an exact model. Replace those with staff photos of the loaned unit when possible. Use an image only when IDeATe has permission to publish it; a library catalog image is not automatically reusable just because it appears in the catalog. Preserve creator credit and any required license text. Manuals link to makers or their official support sites; verify the unit's full model and generation before changing a link.
