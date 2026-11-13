# IDeATe Lending item guides

A student-made, unofficial guide to 382 entries in the IDeATe Lending inventory. The item names and quantities were checked against the October 2026 inventory spreadsheet provided by the IDeATe Lending Office: 1,882 checkout records and 382 distinct names. Locations, short descriptions, QR identifiers, and existing maker links were carried over from the previous single-file site. The public CMU catalog was also checked for category names and model details; some catalog records do not identify a precise product variant. The inventory is a snapshot; ask the lending desk for the current shelf, kit contents, availability, and borrowing rules.

## Site files

- `index.html` is the page shell.
- `styles.css` controls the layout and colors.
- `app.js` contains the item guide rules, model-specific preparation notes, search, and routing.
- `data.json` contains the inventory and maker resources. Each item retains its `h` identifier, so existing `?i=...` QR links still work. `#kN` links also work, but their indices depend on item order.

To preview locally, run `python3 -m http.server` in this directory and open the shown local address. The JSON fetch means opening `index.html` directly as a file may not work.

## Updating an item

Find the entry in `data.json`. Add verified maker resources as `r`, a list of `[label, URL]` pairs. Use a model-specific manual when the exact model is known. For generic inventory names, check the label on the physical device first. Do not guess that batteries, cables, cards, or other accessories are included in a loan.

Add unusual setup requirements or steps in `OVERRIDE` in `app.js`. The shared `GUIDE` rules cover common equipment types; every entry gets a preparation list and first steps even when no model-specific resource has been verified.

The official IDeATe Lending page is linked for current policy. This site does not assert live availability, lending hours, or kit contents.
