# Looking after the Room Locator

The Room Locator has two parts: the console in the Lending room (an Arduino Mega with a screen, a scanner and the shelf lights) and this website. The printed staff manual covers day-to-day use. This page is for whoever maintains it. The website is a guide to where things live. It is not the checkout system and does not know what is checked out.

## How the two parts stay in step

- Changes can start in either place. On the **staff page** (`staff.html`) a change is saved to the website straight away and waits on a list until the console has scanned its code. On the **console**, a change is saved to its SD card and goes to the website with **Send to website**.
- The console is the record of where things are. A website sync plays the console's change list over a starting point, so undoing a change on the console takes it off the website too.
- The staff page answers each sync with a code for the console (`RL:GOT`). Only then does the console count those changes as on the website.

## The console tidies up by itself

The console holds 128 changes in memory. When its list reaches 100 and the website has all of them, it folds the changes into its own item list on the SD card and starts an empty list ("Room made" on its screen, about a minute). From then on:

- **Start over** on the console goes back to that point, not to the Nov 16 setup.
- The next website sync notices (the website code carries the tidy-up number) and the website takes its own state as its new starting point too (`base/data.json` and `base/room.json`).
- Changes from before the tidy-up can no longer be undone one by one on the console. The website's Change history and Earlier editions still show them.

Nothing needs a laptop. If the console ever says the change list is full, update the website and scan its answer: it makes room then.

## What the website keeps

| File | What it is |
|---|---|
| `data.json` | Every item: name, category, type, count, unit, shelf, guide text. A count of 0 means taken out of Lending |
| `room.json` | The units, their shelves and boards, and how far the last sync got |
| `pending.json` | Changes waiting for the console, and the newest 150 to 250 lines of history |
| `history/<year>.json` | Older history. Nothing is dropped |
| `editions/<day>.json` | The whole item list as it was at the end of each day it changed |
| `base/` | The starting point after the console's last tidy-up |
| `backup/2026-11-16/` | The first setup |
| `key.json` | The site key, locked with the passcodes. Useless without one |
| `access.json` | Which tools student staff can use |
| `kits.json`, `photos.json`, `howto.json` | Kits, photos and how-to guides |

**Earlier editions** on the staff page shows any day's list next to today's and downloads it as a spreadsheet. GitHub's own history has every version of every file as well.

## The GitHub account

The site lives in one GitHub repository (`OliveDevs/room-locator`) and saves through a site key, a fine-grained token for that repository with Contents: Read and write. Keys run out on the date set when they were made. **Check everything** on the staff page warns three weeks before, and lists the steps for a new one.

Before the account's owner leaves CMU: transfer the repository to an IDeATe account, or make a Lending manager an admin, and have that person make a new site key. If the site moves to a different address, change `STAFF_URL` and `MANUAL_URL` at the top of the console's code and flash it, or keep the old address as a redirect: the stickers and the console's codes point there.

## Passcodes and roles

- **Console PIN**: four digits, on the console's SD card (scrambled). Opens staff mode. Changed on the console.
- **Staff passcode** and **manager passcode**: at least 10 characters, set by a manager on the staff page. A new one signs out every device that used the old one. Linking the console again does the same for phones that signed in by scanning it.
- Roles are a lock on the page. Everyone who is signed in uses the same site key underneath, so only give passcodes to people who should be able to change the site.

## The console

- Code: `firmware/RoomLocatorV5/` (open `RoomLocatorV5.ino` in the Arduino IDE; `dog.h` sits beside it). Board: Arduino Mega 2560. Libraries: Adafruit GFX, MCUFRIEND_kbv, Adafruit NeoPixel, QRCode (ricmoo), SD.
- The top of the code lists every file on the SD card and every command the Serial Monitor takes (115200 baud). `@STATUS`, `@FILES` and `@LIGHTS` are the useful ones for a check-up.
- Forgotten PIN: take the card out, delete `STAFF.TSV` on a computer, put it back. The PIN is 1234 again.
- Keep a copy of the SD card's files somewhere safe after each tidy-up. `firmware/tools/push_card.py` sends files to the card over USB.
- `firmware/tools/apply_moves.py`, `fold_added.py` and `fix_offsets.py` rebuild the card's files on a laptop from a saved `MOVES.TSV`. The console does the same job itself now, so they are only for repairs.

## Guides, photos and manuals

Edit an item on the staff page changes its photo, description, checklists and manual link. Use photos Lending took, or ones IDeATe has permission to publish. Link a manual only for the exact model on the shelf. The lending rules on item pages come from https://ideate.cmu.edu/resources/lending/index.html: recheck them each term and update `app.js` if the policy changes.
