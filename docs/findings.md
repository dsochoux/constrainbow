# Review findings (2026-11-15)

Ordered roughly by urgency. Items marked *(Fixed …)* or *(Addressed …)* were done on 2026-11-15 or later (dated); the rest are still open. Discuss with Danny before changing gameplay.

## Urgent / operational
1. *(Fixed 2026-11-15: games exist through 12/31, and the server's nightly cron keeps 30 days ahead. See generation-algorithm.md.)* **Puzzles run out on 2026-12-01.** The last game files are for 11/30. The live `/game?game-id=12012026` returns 404, so the page will show "SORRY, I FORGOT TO MAKE TODAY'S GAME 😭". Generate December (or more) and deploy. Longer term, consider auto-generation, or a warning when fewer than N days are left.
2. *(Fixed 2026-11-15: committed, along with the original Feb–Mar 2025 games copied from the server.)* **Jan–Nov 2026 game files were untracked in git** (the last commit is "july games", 2025). They exist only locally and on the server.
3. *(Fixed 2026-11-15.)* `/log-solution`, `/report-missing-word` and `/game` used request values in file paths and file contents without checking them. `app.py` now accepts only an 8-digit game id, `speed`/`score`, word lists matching `[a-z]{5}` (or `[a-z-]{5}` for boards), and a short metric. Anything else gets a 400 or 404. The server showed no sign the hole had been used. The app now also runs as an unprivileged, sandboxed user (see 5).
4. `/report-missing-word` and `/log-solution` have no rate limit or size limit, so the logs can be spammed. Solve times/scores are trusted from the client.
5. *(Fixed 2026-11-15.)* gunicorn used to be started with `pkill` + `nohup` as root, bound to 0.0.0.0:5001 (reachable from the internet, bypassing HTTPS). It now runs as the sandboxed systemd service `constrainbow`, as an unprivileged user, from `/srv/constrainbow`, listening on 127.0.0.1 only.
6. **SOLVE answers are public.** The repo is public, and `games/solve/*.json` contains each day's solution, 30+ days ahead. Danny decided on 2026-11-16 that this is fine for now. If the game grows, stop tracking `games/solve/` in git (the server makes its own puzzles), or keep the answer out of the files and check a submitted board against the word list on the server.

## Efficiency
- *(Fixed 2026-11-15)* `project/requirements.txt` is pinned, and the server venv is built from it.
- Every `/game` response includes the full word list (2,531 words, ~20 KB, **not gzipped** by nginx). Options: enable gzip in nginx, make `words.txt` a cacheable static asset (or keep it in localStorage with a version), or validate server-side.
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
- *(Fixed 2026-11-15: replaced by the 4-step intro; example boards use a class and the popup fits the screen. The hash stayed as proof of authorship until 2026-11-16, when it became the line "Made by Daniel Sochoux. All rights reserved.")* The "how to play" popup used `id="example-board"` three times (invalid HTML) and has a visible 64-hex hash string at the bottom (the commit "remove name for hash" suggests proof of authorship). It is capped at 70vh, which leaves dead space on phones.
- *(Mostly fixed 2026-11-15: `user-scalable=no` removed, colored tiles carry shapes, CLEAR/DEL/close/`?` and the mode switch have labels. Tiles themselves still have no aria labels, and share emojis are still color-only.)* The viewport had `user-scalable=no` (an accessibility concern). Tiles and keys have no aria labels, and color alone carries meaning (color-blind players can't tell red from orange easily, and the share emojis are color-only).
- Speed timer: `setInterval` tick counting can drift; it should use `Date.now()` deltas.
- `copyResults` decides "include solution?" from the button text, which is fragile.
- The share grid shows the puzzle *layout* only, so all players' shares for a day look identical apart from the time or score. *(SOLVE shares differ: ⬜ givens and 💡 reveals. Since 2026-11-16 every share starts with the mode's link, e.g. `constrainbow.com/solve`, since the emoji alone didn't say which mode.)*

## Aesthetic observations
*(2026-11-15: redesigned in the "Paper pop" style, with tile pop animations (all tiles of a color at once; a ripple was tried and dropped as laggy), shake on errors, a wave-and-confetti win, color-blind shapes on colored tiles, across-only row links, a red over-max score, a 4-step visual how-to-play and a rainbow-C favicon. The notes below describe the old look. The design exploration is in `design/mockups.html`.)*
- Neo-brutalist look (thick borders, hard offset shadows), Arial, white background. Clean, but generic. The rainbow-shadow wordmark is the only branding.
- Few animations. Letter entry has no pop, conflicts get a 200 ms pink flash, the win gets a sequential dark/green cascade, and invalid words just go red.
- Dark mode was stubbed (`--bg` commented) but not implemented. Still no dark mode in Paper pop.
- Desktop layout is just the mobile column centered. 67px tiles.
- Good for video: the color-fill cascade when one letter fills 3 tiles, and the win cascade.

## Word lists (2026-11-16)
- Downloaded the server's `reported_missing_words.txt` (478 lines, 376 different words; it contains all of the old local copy). Of the 146 not yet decided:
  - **Rejected (58):** typos and garbage (abwab, bptch, glowr…), regular plurals and -s verbs (books, races, wants…), regular past tenses (aimed, named, saved…), proper nouns (amish, korea, santa…). Added to `rejected_words.txt`.
  - **Added to the big list (61):** clearly fine words such as argon, beige, chewy, emoji, nacho, umami, upend, xenon. Not added to the small list; that's Danny's call on the review page.
  - **Left for Danny (27), decided on the review page:** 20 added to the big list only (ahold, amnio, annal, arcus, cupid, gouda, griot, haulm, intel, katsu, lanai, loden, nabob, otary, pecky, snarf, stoma, thunk, wahoo, yahoo), 7 rejected (dohyo, estop, hicky, laude, lycra, synch, wives).
- **Small list:** Danny's picks took it from 1,529 to 1,711 words. His bar: words most American adults know, including vocabulary-test words (adage, aloof, askew) and mildly rude or grim ones (idiot, vomit, tumor), but nothing profane or sexual, and not formal or old-world words (abase, abate, abbey, abbot, saber). Claude suggested candidates in three groups; group 1 (everyday words) is decided, group 2 (more bookish words) and group 3 (adjectives that look like past tenses, e.g. tired, mixed) are still open.
- Removed the duplicate "minty" from words.txt.
- The new words gave 3 SOLVE puzzles a second answer: 11/20 and 12/16 were remade (now STAFF/PROMO/VILLA/FRYER and WEIRD/STRAW/PIECE/PHONY), and test puzzle 12 (already played) was left as it is.
- The new words raised every upcoming speed/score puzzle's solution count by 10–107% and the max score of score 11/30 (80 → 82), 12/07 (70 → 81) and 12/24 (64 → 66), plus five speed puzzles (max score isn't shown in speed). `scripts/recount_games.py` recounted all 92 puzzles from 11/16 to 12/31 in place (layouts unchanged), and the updated files were copied to the server.

## Features to work on (agreed 2026-11-15)
In priority order. The aim: give players a reason to come back, something to compare, and more to play for people who arrive from a video.
1. *(Built 2026-11-16: one streak per mode, any finish counts (reveals too), a 📊 stats popup that also opens after a day's first finish, and `| 🔥 N` in the share text. See gameplay.md.)* **Streaks and stats.** Kept in localStorage, no accounts: current/best streak, games played, a speed time histogram, score % of max.
2. **Best-solution reveal after a score-mode solve.** `best_solution` is already in each puzzle JSON. Send it only after the solve (a small endpoint, or include it in the `/log-solution` response) so it can't be read up front.
3. **A personal share.** Score mode: tiles shaded by points, or "58/64 · 91%". Later, "better than X% of players today" from the solve logs.
4. **Archive.** 676 puzzles per mode already exist. Lets new players keep playing straight after a video.
5. **Single-solution mode: SOLVE.** A puzzle with exactly one answer, so everyone solves the same thing and can talk about it.

   **Status (2026-11-15): daily SOLVE built, first tab and default mode.** One 5-letter puzzle a day at `/solve`, made nightly by `ensure_games.py` (about 1–4 s each), answers not reused within 90 days, themed days from `word_files/solve_themes.json` (a theme that can't make a 5-letter puzzle falls back to random words with a loud warning; check themes first with `--words`). Share grid marks givens ⬜ and reveals 💡. Difficulty is flat for now. Before that: named SOLVE (🔑), and `/solve/test` serves the play-test batch of 12 (four each at 3, 5 and 7 given letters, mixed) with a timer and a REVEAL button. Test-batch solves are logged to `logs/solve-test.csv` (`/solvetestlog`), daily ones to `logs/MMDDYYYY/solve.csv` (`/solvelog`), with time, given letters, reveals (black tiles, colors, and total tiles revealed), and an anonymous tester id. Progress is saved per puzzle. A revealed color counts as one reveal per tile, and the button says how many ("REVEAL 3"). Not linked from the game. Next: Danny and friends play it, then tune the numbers below. Answers come only from `word_files/common_words.txt`: 1,529 of the 2,450 words, reviewed by hand on 2026-11-15 to keep everyday, inoffensive words. `scripts/build_common_words.py` lists what was left out and why. Uniqueness is still checked against all of `words.txt`, since players may type any accepted word. `--words` refuses uncommon words unless given `--allow-uncommon`. Each puzzle gets a difficulty estimate (`UniqueGame.difficulty`, which imitates row-by-row deduction and reports how many boards are left when it gets stuck), and the batch is numbered from easiest to hardest by it. The estimate still needs checking against real solve times. "Check row" is not built yet.

   **2026-11-16:** the unlisted `/solve/day?d=YYYY-MM-DD` plays any day's SOLVE puzzle (past or future) with ‹ › to the neighboring days, saving progress under `solveDay{MMDDYYYY}` and logging nothing, so themed days can be tried before they go live. Themed days can carry an emoji that falls instead of confetti (`"emoji"` in solve_themes.json, copied into the puzzle JSON, sent by `/game`, used by `Board.celebrate` → `launchConfetti(emojis)`). Thanksgiving (11/26) is STUFF / CARVE / GRAVY / THANK with 🦃 🥧 🍂; 12/02 was regenerated because it reused STUFF. `/` now always redirects to `/solve` (the `game_mode` cookie that remembered the last mode is gone), and the how-to-play example board is yesterday's SOLVE answer, with a caption, so returning players can see the answer they missed (see gameplay.md).

   **First play-test (Danny, all 12, 2026-11-15):**

   | Given letters | Puzzles | Times | Revealed tiles |
   |---|---|---|---|
   | 7 | 1, 2, 3, 6 | 0:10 – 1:16 | none |
   | 5 | 4, 7, 10, 11 | 1:45 – 7:14 | 0, 5, 0, 4 |
   | 3 | 5, 8, 9, 12 | 1:21 – 11:30 | 6, 0, 2, 5 |

   Danny's take: the middle puzzles, where par involved a hint or two, were the most fun. 7 letters felt too easy, and 5 felt the nicest and least daunting. With few letters you don't know where to start. With 5 (and at most 2 per row), at least one row must start with two letters, which makes a natural starting point. The difficulty estimate ranked roughly right: its hardest, 12 and 11, were the slowest. Its misses were 8 (rated hard, solved in 1:21) and 5 (rated easy, 6 reveals).
   **Decision:** a daily SOLVE gives 5 letters, always with at least one row starting with two. Difficulty is varied with the estimate rather than the letter count.

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
6. **Bigger accepted-word list.** Keep the curated `words.txt` for generating puzzles, but accept a larger list (still no regular plurals or past tenses) when checking answers, so real words aren't rejected. *(2026-11-16: the reports were reviewed and the good words added; see Word lists above. A local review page now handles new reports.)*
7. **Visitor and solve counts** from the nginx logs and solve logs, to see which videos bring players.
8. Lower priority: hints, dark mode, an installable PWA.

## Feature ideas to discuss
- *(Stats and streaks built 2026-11-16.)* A results screen comparing you with everyone else (the server already logs times and scores).
- An archive/practice mode for past puzzles (597 already exist per mode).
- Show "you beat X% of players" from the logs.
- A share text that encodes something player-specific (e.g. score tiles shaded by points, or time).
- A hint system (reveal one color), and an "optimal solution" reveal after solving in score mode (`best_solution` already exists in the JSON).
- ~~A first-time tutorial instead of the long text popup.~~ Done: 4-step visual intro (not interactive).
- A PWA/offline mode (manifest already present).
