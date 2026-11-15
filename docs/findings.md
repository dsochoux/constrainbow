# Review findings (2026-11-15)

Ordered roughly by urgency. Items marked *(Fixed …)* or *(Addressed …)* were done on 2026-11-15; the rest are still open. Discuss with Danny before changing gameplay.

## Urgent / operational
1. *(Fixed 2026-11-15: games exist through 12/31, and the server's nightly cron keeps 30 days ahead. See generation-algorithm.md.)* **Puzzles run out on 2026-12-01.** The last game files are for 11/30. The live `/game?game-id=12012026` returns 404, so the page will show "SORRY, I FORGOT TO MAKE TODAY'S GAME 😭". Generate December (or more) and deploy. Longer term, consider auto-generation, or a warning when fewer than N days are left.
2. *(Fixed 2026-11-15: committed, along with the original Feb–Mar 2025 games copied from the server.)* **Jan–Nov 2026 game files were untracked in git** (the last commit is "july games", 2025). They exist only locally and on the server.
3. *(Fixed 2026-11-15.)* `/log-solution`, `/report-missing-word` and `/game` used request values in file paths and file contents without checking them. `app.py` now accepts only an 8-digit game id, `speed`/`score`, word lists matching `[a-z]{5}` (or `[a-z-]{5}` for boards), and a short metric. Anything else gets a 400 or 404. The server showed no sign the hole had been used. The app now also runs as an unprivileged, sandboxed user (see 5).
4. `/report-missing-word` and `/log-solution` have no rate limit or size limit, so the logs can be spammed. Solve times/scores are trusted from the client.
5. *(Fixed 2026-11-15.)* gunicorn used to be started with `pkill` + `nohup` as root, bound to 0.0.0.0:5001 (reachable from the internet, bypassing HTTPS). It now runs as the sandboxed systemd service `constrainbow`, as an unprivileged user, from `/srv/constrainbow`, listening on 127.0.0.1 only.

## Efficiency
- *(Fixed 2026-11-15)* `project/requirements.txt` is pinned, and the server venv is built from it.
- Every `/game` response includes the full 2,451-word list (~20 KB, **not gzipped** by nginx). Options: enable gzip in nginx, make `words.txt` a cacheable static asset (or keep it in localStorage with a version), or validate server-side.
- `bundle.js` and `style.css` have no cache-busting or versioning. There is no `Cache-Control` strategy, so after a deploy users may get stale JS.
- Point values are defined three times: helpers.js, generate_game.py, and the hard-coded key HTML. The 04/08 balloon is defined twice (app.py and speedBoard.js).
- `script.min.js` is dead. `game_solutions/`, the `reported_missing_words` DB table, and `getCookie`/`resetCookie`/`getInvalidWords` are unused.
- ~~Generator: one SQL query per candidate letter per row.~~ Done 2026-11-15: replaced with bitsets, 86× faster.

## Bugs / UX friction
- **Reload with an invalid full word** shows the timer/score instead of REPORT MISSING WORD(S): `loadSavedGame` doesn't call `check()`. Open.
- *(Fixed 2026-11-15)* **Favicons 404'd** after the app moved to the unprivileged user, because `favicon_io/` on the server was root-only (mode 700). deploy.sh now makes served folders world-readable.
- *(Fixed 2026-11-15)* **Score mode starts with no tile selected**, so keys do nothing until you tap a tile. Speed mode selects (0,0) on START.
- *(Fixed 2026-11-15)* **Tapping the selected tile deselects it.** Auto-advance often moves the cursor onto the tile you were about to tap, so your next keystrokes are silently ignored (I hit this while playing).
- Score mode logs only the *first* solve. Later improvements are never logged, so the server never learns a player's best score.
- Backspace on a blank tile with nothing to its left (`isTopLeft`) is a no-op. That is fine, but `blackLetters['']` becomes NaN when you type over a blank black tile. It is harmless but sloppy.
- A page left open past midnight keeps the old game id. Saved progress is keyed per mode, so returning the next day resets correctly, but an open tab doesn't roll over.
- *(Fixed 2026-11-15: replaced by the 4-step intro; example boards use a class and the popup fits the screen. The hash stays as proof of authorship.)* The "how to play" popup used `id="example-board"` three times (invalid HTML) and has a visible 64-hex hash string at the bottom (the commit "remove name for hash" suggests proof of authorship). It is capped at 70vh, which leaves dead space on phones.
- *(Mostly fixed 2026-11-15: `user-scalable=no` removed, colored tiles carry shapes, CLEAR/DEL/close/`?` and the mode switch have labels. Tiles themselves still have no aria labels, and share emojis are still color-only.)* The viewport had `user-scalable=no` (an accessibility concern). Tiles and keys have no aria labels, and color alone carries meaning (color-blind players can't tell red from orange easily, and the share emojis are color-only).
- Speed timer: `setInterval` tick counting can drift; it should use `Date.now()` deltas.
- `copyResults` decides "include solution?" from the button text, which is fragile.
- The share grid shows the puzzle *layout* only, so all players' shares for a day look identical apart from the time or score.

## Aesthetic observations
*(2026-11-15: redesigned in the "Paper pop" style, with tile pop animations (all tiles of a color at once; a ripple was tried and dropped as laggy), shake on errors, a wave-and-confetti win, color-blind shapes on colored tiles, across-only row links, a red over-max score, a 4-step visual how-to-play and a rainbow-C favicon. The notes below describe the old look. The design exploration is in `design/mockups.html`.)*
- Neo-brutalist look (thick borders, hard offset shadows), Arial, white background. Clean, but generic. The rainbow-shadow wordmark is the only branding.
- Few animations. Letter entry has no pop, conflicts get a 200 ms pink flash, the win gets a sequential dark/green cascade, and invalid words just go red.
- Dark mode was stubbed (`--bg` commented) but not implemented. Still no dark mode in Paper pop.
- Desktop layout is just the mobile column centered. 67px tiles.
- Good for video: the color-fill cascade when one letter fills 3 tiles, and the win cascade.

## Feature ideas to discuss
- Stats/streaks (localStorage), and a results screen with distribution (the server already logs times and scores).
- An archive/practice mode for past puzzles (597 already exist per mode).
- Show "you beat X% of players" from the logs.
- A share text that encodes something player-specific (e.g. score tiles shaded by points, or time).
- A hint system (reveal one color), and an "optimal solution" reveal after solving in score mode (`best_solution` already exists in the JSON).
- ~~A first-time tutorial instead of the long text popup.~~ Done: 4-step visual intro (not interactive).
- A PWA/offline mode (manifest already present).
