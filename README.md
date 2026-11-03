# IGW workshop website

The website of The 1st Workshop on Interactive Game World Modeling. Plain static files with no build step, so any organizer can edit it.

## Preview

```bash
python -m http.server 8765
```

Then open http://localhost:8765. The island needs an HTTP server because it loads as a JavaScript module.

## Common edits

All content is in `index.html`.

- **Schedule and dates:** edit the table rows in place. Each track's deadline also appears in its block under Call for Participation, so change both.
- **After the CVPR decision:** set `data-status="accepted"` on the `<html>` tag. Text marked `when-proposed` disappears and text marked `when-accepted` appears.
- **A speaker's or organizer's photo:** add a square JPEG to `assets/people/` (360 by 360 is enough) and replace the `photo-mono` element with an `<img class="photo">`, copying a neighbor. The same card is used for speakers and organizers.
- **Organizers:** the section is hidden for now. To show it, remove `hidden` from `<section id="organizers">` and restore the commented-out link in the navigation. The names and photos stay in the source while it is hidden.
- **Contact:** edit the Contact section at the bottom.
- **Submission links:** when the calls open, add a link to each track block. Full rules are in the proposal (`CVPR_Game_Workshop/sec/` in the CVPRWorkshop repository); give a track its own page if they run long, as other workshop sites do for challenges.

## The island

`assets/world.js` draws the town with three.js (vendored in `assets/vendor/`, MIT license). It is rule-based and rebuilt from a fixed seed; no model is involved. `assets/island.webp` is a still render of the same town, used when WebGL is unavailable and at the bottom of the page. Re-render it if the terrain or seed changes.

## Fonts

Gabarito and Source Sans 3 are self-hosted in `assets/fonts/` under the SIL Open Font License; the license files sit beside the fonts.

## Deploying

Publish this repository with GitHub Pages from the root of its main branch. The `.nojekyll` file tells Pages to serve the files as they are.

## Provenance of images

- `assets/people/*.jpg`: headshots taken from each person's homepage, as listed in `index.html`.
- `assets/island.webp`: rendered from `assets/world.js`.

## Local design notes

`PRODUCT.md`, `DESIGN.md`, and `.impeccable/` hold the product record and design system for design tools. They are git-ignored because this repository has to be public for GitHub Pages, so they stay on the machine where they were written.
