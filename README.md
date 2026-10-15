# The Bookshelf — 3D Rotating Cover Carousel · DESIGN PREVIEW

**What you're looking at:** a working preview of the revolving-bookshelf
bookstore for kimaniupshur.com. Swipe (or drag) and the covers rotate like a
revolving shelf — the centered book faces you, its neighbours angle away, and
the next cover rotates forward. Tap the centered cover and you land on that
book's real page on kimaniupshur.com, where all of its purchase buttons live
exactly as they do today. **Nothing here is live** — the bookstore is
untouched; this folder and a separate git branch are the whole footprint.

## Open it on your phone
Open `index.html` from this folder in any browser (it runs fully offline —
every image is included). Handy deep links:

- `index.html` — All Books, from the top of the alphabet
- `index.html?cat=christian-living&pos=40` — mid-shelf in Christian Living
- `index.html?cat=fiction&view=simple` — the simple list view (Fiction)

## What's inside
- **945 listed books in 17 collections**: All Books (870) · Christian Living
  (392) · Personal Growth (105) · Bible People (80) · Faith & Doctrine (64) ·
  Business & Leadership (41) · Health & Wellness (38) · Money & Finance (32) ·
  Tech & AI (27) · Family & Relationships (26) · Fiction (19) · Prayer &
  Worship (15) · Box Sets (6) · Church & Ministry (6) · Bible Study (5) ·
  Kids (39) · Teens (35).
- **944 books have real covers** — every one is the book's actual artwork,
  resized only (440 px wide). No generated, stock, or substitute covers.
- **1 book has no cover yet**: *Halcyon Protocol: The Compliance Problem*
  (its artwork is owner-held). It is excluded from the rotating shelf and
  appears in the simple view as a gold text tile that still links to its page.
- Books whose pages exist but are listed nowhere on the current site
  (22 pages, e.g. the Quantum Computing / Nuclear Energy fast-lane pages)
  are not in the preview either — the preview mirrors the site's public
  listings exactly. Internal `cluster-*` collections are likewise not
  offered as browse categories (their books appear under their real
  categories, All Books, and search).

## How it works
- **Browsing:** touch swipe with momentum and snap-to-center, mouse drag,
  on-screen arrows, keyboard (←/→, PgUp/PgDn, Home/End, Enter opens the
  book), an A–Z jump bar, a category selector, and live title search across
  the whole catalog. Tapping a side cover rotates it to the center; tapping
  the centered cover opens the book.
- **Order:** alphabetical by title inside each collection. The sort key
  ignores a leading "The / A / An" and folds accents (so *The Completion*
  shelves under C, *Résumé* under R).
- **Simple view:** one tap switches to a plain linked grid of the same
  collection — the fallback for anyone who prefers lists, and the only view
  where the cover-less book appears.
- **Reduced motion:** if the visitor's device asks for reduced motion, the
  shelf steps instantly instead of spinning (there's also a visible
  "Reduce motion" toggle).
- **No wrap-around:** the shelf has a first and a last book, like the
  alphabet does; the arrows disable at the ends.

## Performance (measured, reproducible — see `perf_results.json`)
The catalog's original covers total **79.7 MB**. This preview never loads
them. Only a window of **±8 covers** around your position is ever requested
(17 small images at most, recycled as you move):

| Moment | Cover images fetched | Cover bytes |
|---|---|---|
| First open (All Books, at "A") | 9 | 197 KB |
| After browsing 20 books forward | 29 total (one new cover per step) | 677 KB total |
| One jump from book 29 to book 600 | +17 (destination window only) | — |
| Whole first page load, everything included | 13 requests | **408 KB total** |

Long jumps past 30 titles use a quick fade instead of a rotating sweep, so
the browser never fetches the hundreds of covers it would pass on the way.
The small "Preview stats" line at the bottom of the page counts cover images
loaded so far — watch it while you swipe. The thumbnails are 440 px-wide
derivatives averaging **26.5 KB** (23.9 MB for all 944 — they ship with this
preview folder; on the real site they'd be generated once and cached).

## Files
- `index.html`, `carousel.css`, `carousel.js` — the component (vanilla, no framework)
- `books-data.js` — generated catalog data (183 KB, metadata for 945 books)
- `thumbs/` — the 944 thumbnail derivatives of the real covers
- `build_carousel.py` — regenerates data + thumbs from the cover inventory
- `measure_and_shoot.py` — reproduces the performance numbers + screenshots
- `functional_test.py` + `functional_test_results.json` — 14/14 automated checks passed
- `screenshots/` — iPhone / iPad / desktop captures, centered + mid-rotation
- `excluded_no_cover.json` — the cover-less book record

## Also packaged for production
The identical component is committed on branch
`preview/cover-carousel-2026-10-14` (base `5e94755b2e`) in a separate clone at
`~/workspace/agents/cover-carousel/site`, under `bookshelf/` with an
integration README — ready to become a `/bookshelf/` page if approved.
The branch was never pushed or merged, and no live page was touched.

## Known limits / decisions for your approval
1. **Header height on phones:** brand + controls take the top ~55% of a
   phone screen before the shelf appears (see screenshots). A production
   version should compact the header so the shelf is the first thing seen.
2. **Where it lives:** standalone `/bookshelf/` page vs. replacing the
   /books/ index vs. a homepage section — undecided, no existing page changed.
3. **Default collection:** All Books today; Christian Living is the biggest
   category and might be the warmer front door.
4. **Carousel vs. the grid preview:** the static cover-grid preview is being
   built separately; this carousel is the alternative direction, not a
   replacement decision.
5. Swipe feel (speed, angle, spacing) is tuned by eye in the screenshots;
   your on-device feel is the real test.
