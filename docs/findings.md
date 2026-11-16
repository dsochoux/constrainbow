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
- *(Fixed 2026-11-15)* **Reload with an invalid full word** showed the timer/score instead of REPORT MISSING WORD(S), because `loadSavedGame` never ran the board-wide check. `Board.showReportIfInvalidWords()` now runs after loading (score) or on resume (speed).
- *(Fixed 2026-11-15)* **Favicons 404'd** after the app moved to the unprivileged user, because `favicon_io/` on the server was root-only (mode 700). deploy.sh now makes served folders world-readable.
- *(Fixed 2026-11-15)* **Score mode starts with no tile selected**, so keys do nothing until you tap a tile. Speed mode selects (0,0) on START.
- *(Fixed 2026-11-15)* **Tapping the selected tile deselects it.** Auto-advance often moves the cursor onto the tile you were about to tap, so your next keystrokes are silently ignored (I hit this while playing).
- Score mode logs only the *first* solve. Later improvements are never logged, so the server never learns a player's best score.
- *(Changed 2026-11-15: left arrow wraps from the top-left tile to the last tile, and backspace on an empty tile now moves back exactly one tile like the left arrow, instead of skipping back to the nearest filled tile.)* Backspace on a blank tile with nothing to its left (`isTopLeft`) used to be a no-op. Separately, `blackLetters['']` becomes NaN when you type over a blank black tile. It is harmless but sloppy.
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

## Features to work on (agreed 2026-11-15)
In priority order. The aim: give players a reason to come back, something to compare, and more to play for people who arrive from a video.
1. **Streaks and stats.** Kept in localStorage, no accounts: current/best streak, games played, a speed time histogram, score % of max.
2. **Best-solution reveal after a score-mode solve.** `best_solution` is already in each puzzle JSON. Send it only after the solve (a small endpoint, or include it in the `/log-solution` response) so it can't be read up front.
3. **A personal share.** Score mode: tiles shaded by points, or "58/64 · 91%". Later, "better than X% of players today" from the solve logs.
4. **Archive.** 676 puzzles per mode already exist. Lets new players keep playing straight after a video.
5. **Single-solution mode: SOLVE.** A puzzle with exactly one answer, so everyone solves the same thing and can talk about it.

   **Status (2026-11-15): named SOLVE (🔑), test batch built.** `scripts/generate_unique.py` makes the puzzles, and `/solve` serves a test batch of 12 (four each at 3, 5 and 7 given letters, mixed) with a timer and a REVEAL button. Solves are logged to `logs/solve.csv` (`/solvelog`) with time, given letters, reveals (black tiles, colors, and total tiles revealed), and an anonymous tester id. Progress is saved per puzzle. A revealed color counts as one reveal per tile, and the button says how many ("REVEAL 3"). Not linked from the game. Next: Danny and friends play it, then tune the numbers below. Answers come only from `word_files/common_words.txt`: 1,529 of the 2,450 words, reviewed by hand on 2026-11-15 to keep everyday, inoffensive words. `scripts/build_common_words.py` lists what was left out and why. Uniqueness is still checked against all of `words.txt`, since players may type any accepted word. `--words` refuses uncommon words unless given `--allow-uncommon`. Each puzzle gets a difficulty estimate (`UniqueGame.difficulty`, which imitates row-by-row deduction and reports how many boards are left when it gets stuck), and the batch is numbered from easiest to hardest by it. The estimate still needs checking against real solve times. "Check row" is not built yet.

   **Agreed design (2026-11-15), to be tuned by play-testing:**
   - **Answer first.** Start from 4 words, either picked by Danny (themed days, e.g. spooky words for Halloween) or picked automatically. Try every choice of 4 letters that appear at least twice as the colors; each choice forces the layout.
   - **Layout filter:** at least 9 colored tiles, and every row has a color.
   - **Filled-in letters** (black tiles that start with their letter showing) make the answer unique:
     - Floor: the minimum that leaves one solution.
     - Target: 5. Top up to 5 if the minimum is lower, adding letters to the row that still fits the most words.
     - Cap: 7. Automatic days that need more are rejected and new words are tried. Hand-picked sets accept whatever is needed and report the number.
     - Placement: at most 2 per row, never every black tile in a row, and every row touched by a letter or a shared color.
     - Keep the color choice that needs the fewest letters. If none works, swap a word or allow one filled-in colored tile.
   - **Uniqueness must be checked against every word the game accepts.**
   - **Probably timer plus hint count**, not score, since the score would be the same for everyone.
   - **Hint ideas:** reveal a black tile (cheap), reveal a color (expensive), check a row.
   - **The numbers 5, 7 and 2 are guesses.** Plan: generate batches at 3, 5 and 7 letters for Danny, his uncle and friends to play, then set them from real solve times. A weekly difficulty curve (more letters early in the week) can come after that.

   Experiments (2026-11-15, against `words.txt`):
   - **Pre-filled letters work best.** Starting from an ordinary speed layout (10 colored tiles) and a random answer, filling in black tiles from that answer makes it unique after a median of 4 letters (range 3–6, out of 30 puzzles). One puzzle also needed a colored tile revealed.
   - **Blank boards can be unique**, but only with 13–14 of the 20 tiles colored: about 3% of random 4-color layouts at 13 tiles and 1.5% at 14. Most layouts at 14+ have no solution at all. Finding them is cheap (600 layouts in about 2 s), and the answers are often normal words (THETA / INANE / ATOLL / ENACT), sometimes obscure (EXEAT, ILIAC).
   - **Answer-first also works.** Pick 4 words, then choose 4 letters that each appear at least twice in them as the colors. The layout is then forced, because every place a color's letter appears must carry that color (a black tile can never hold a color's letter). Over 40 random word sets, the best choice of colors gave 8–13 colored tiles but was never unique alone (0 of 1,000 random word sets; 91% still had over 1,000 solutions). It needed a median of 5 pre-filled letters (range 2–7), and 4 sets couldn't be made unique with black-tile letters at all. This costs about one more letter than layout-first, in exchange for choosing the answer (common words, themed days).
   - **A 5th color doesn't help**: 1% unique at 14 tiles, and about 10× slower to search.
   - **Uniqueness depends on the word list.** It has to be checked against every word the game *accepts*, or players will find a second valid answer. This conflicts with feature 6 unless uniqueness is checked against the bigger list and the answer itself uses only common words.
6. **Bigger accepted-word list.** Keep the curated `words.txt` for generating puzzles, but accept a larger list (still no regular plurals or past tenses) when checking answers, so real words aren't rejected. Review the 477 reports on the server.
7. **Visitor and solve counts** from the nginx logs and solve logs, to see which videos bring players.
8. Lower priority: hints, dark mode, an installable PWA.

## Feature ideas to discuss
- Stats/streaks (localStorage), and a results screen with distribution (the server already logs times and scores).
- An archive/practice mode for past puzzles (597 already exist per mode).
- Show "you beat X% of players" from the logs.
- A share text that encodes something player-specific (e.g. score tiles shaded by points, or time).
- A hint system (reveal one color), and an "optimal solution" reveal after solving in score mode (`best_solution` already exists in the JSON).
- ~~A first-time tutorial instead of the long text popup.~~ Done: 4-step visual intro (not interactive).
- A PWA/offline mode (manifest already present).
