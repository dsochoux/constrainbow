# Gameplay

## The puzzle
- A 4×5 grid: four rows, each a five-letter English word. Word list: `word_files/words.txt` (2,531 hand-curated words on 2026-11-16; no regular plurals or regular past tenses). Players can report a full row that isn't accepted; reports are decided on the local review page (see architecture.md).
- Some tiles have a colored border: red, orange, yellow, blue (constraints 1–4; CSS vars `--c1..--c4`). Black-bordered tiles are "wildcards" (constraint 0).
- Rules:
  1. All tiles of one color hold the same letter.
  2. Different colors hold different letters.
  3. A black tile may hold any letter **except** one used by a color. Black letters can repeat freely.
- Every color appears at least twice, and the colors are linked in a cycle across the rows (row i always has colors s[i] and s[i+1]), so all four colors interact.
- Speed puzzles have 10 colored tiles; score puzzles have 9. SOLVE puzzles have whatever their answer gives (at least 9), plus 5 letters filled in.
- A new puzzle for each mode releases at midnight Eastern. Under the board header a sentence gives the date and how many solutions exist: "Today's puzzle (11/15) has 70,654 solutions." Speed puzzles are generated to have at least 15k solutions and score puzzles at least 50k. After the 2026-11-16 recount against the bigger word list, upcoming puzzles (11/16–12/31) range from about 16k to 3.1M.

## Modes
All three modes are on one page; the 🔑 SOLVE / ⏱️ SPEED / 🎯 SCORE switch under the wordmark changes between them. `/` always redirects to SOLVE, the default mode. The CONSTRAINBOW wordmark is a link to `/`.

### 🔑 Solve (`/solve`, since 2026-11-15)
- One puzzle a day with exactly **one** solution, so everyone solves the same four words. 5 letters start filled in (on black tiles), always with at least one row starting with two of them, which makes a natural place to begin. They sit pressed into the board and can't be changed.
- Plays like speed: START GAME, a timer, PAUSE, letters hidden while paused.
- **REVEAL** fills in the selected tile from the answer: one black tile, or a whole color (the button reads "REVEAL 3" for a 3-tile color). Revealed tiles show a gray letter and are locked. Reveals count per tile.
- Progress is saved, so a reload or a trip to another mode resumes where you left off.
- The share text starts with the mode's link (`constrainbow.com/solve`, `/speed` or `/score`), then shows the date, time and tiles revealed, then the layout with ⬜ for the given letters and 💡 for every revealed tile, so each player's share is different:
  ```
  constrainbow.com/solve
  11/15 | 🔑 4:37 | 3 reveals
  ⬜🟥⬛️💡⬛️
  ...
  ```
- Answers come from `word_files/common_words.txt` and aren't reused within 90 days. Hand-picked answers for a date go in `word_files/solve_themes.json`, optionally with an emoji (or a list) that falls instead of confetti when the puzzle is solved. To try a day before it goes live, open `/solve/day?d=2026-11-26` (unlisted). First themed day: Thanksgiving 2026-11-26, STUFF / CARVE / GRAVY / THANK with 🦃 🥧 🍂.
- The 12-puzzle play-test batch is still at `/solve/test?p=N` (unlinked).

### Themed SOLVE days
Danny writes the themes (roughly weekly, plus holidays): a clue and a pool of 6–8 words. The clue shows in a box above the board ("Birdwatching"); an optional emoji falls instead of confetti. The process:
1. Pick the date, ideally more than 30 days out (closer dates already have a puzzle, which must be remade and copied to the server).
2. Try every set of four from the pool for that exact date (same date seed as the real puzzle, so what it lists is what you get; about 2 s per set):
   `env/bin/python scripts/generate_unique.py --pool robin eagle heron stork crane finch raven --day 2027-01-03`
   It prints each working set's board and difficulty, and flags words off the small list or already an answer within 90 days. Typically about half the sets work.
3. Add the chosen set to `word_files/solve_themes.json`: `"2027-01-03": {"words": ["robin", "eagle", "heron", "stork"], "clue": "Birdwatching", "emoji": "🐦"}` (`clue` and `emoji` are optional).
4. Make it with `generate_unique.py --day 2027-01-03` and play it at `/solve/day?d=2027-01-03`.
5. Deploy (and for a date within 30 days, copy the remade file to the server).


### ⏱️ Speed (`/speed`)
- The board is hidden (blank black tiles) until you press **START GAME** or tap a tile. A timer then runs.
- **PAUSE** hides the letters again. The game also pauses when the tab is hidden or the how-to-play popup opens.
- The goal is any valid solution, as fast as possible. On solving, the timer stops and a **COPY RESULTS!** button appears.
- On 04/08 the stopwatch emoji becomes 🎈 (`emoji_overrides` in app.py, also hard-coded in speedBoard.js).

### 🎯 Score (`/score`)
- Letters carry Scrabble-like point values, which show on the keyboard keys and in each tile's corner.
- No timer. The display reads `score/max POSSIBLE POINTS`, where max is the best score achievable on that puzzle (precomputed).
- The score counts every letter on the board, even in unfinished or invalid rows, so it can go past the maximum. That's deliberate: it hints you're on the wrong track. When it does, the score pill turns red and shakes once.
- You can keep improving after the first solve, but only the **first** solution is logged to the server.
- **Your best board counts** (since 2026-11-16): the best-scoring board you've finished today is saved (localStorage `scoreDayBest`). It's what the stats keep and what COPY RESULTS shares, along with its words on the "include solution" second click, even if the board on screen now scores less.
- **SHOW BEST** appears once you've finished today's puzzle. It first asks, and says you can keep changing letters to beat your score (so nobody thinks one solution ends the game) and that looking makes today's score final. A perfect score skips the question. Then a best solution fills a read-only copy of the board, and a **YOURS: 58 / BEST: 81** switch flips between it and your own board. The points pill stays in place and shows whichever board is on screen ("81/81 POSSIBLE POINTS" on BEST). You can keep playing on your board, but the score that's saved and shared stays at what it was (`scoreRevealed`). The puzzle file stores one best board, so it's "a" best solution; others may tie.
- **Yesterday's best** is in the score stats popup for everyone ("MAXIM · GYOZA · EPOXY · OXIDE (64 points)"), and a small "Yesterday's best ›" link at the end of the description opens it.

## Controls
- Tap a tile to select it (tapping the selected tile keeps it selected). Score mode starts with the first empty tile selected, and speed mode selects it on START.
- On-screen keyboard or a physical keyboard. Arrow keys and space move the cursor, wrapping between rows and from the last tile back to the first (and, with left arrow, from the first tile to the last). Backspace (DEL key) clears the letter on a filled tile (the cursor stays put); on an empty tile (or a SOLVE given letter) it moves back one tile, exactly like the left arrow. The CLEAR key clears the whole board. The selected tile lifts (bigger shadow) and shows a blinking cursor bar.
- Typing a letter on a colored tile fills **every** tile of that color. The cursor then jumps to the next blank tile in reading order.
- Illegal letters are refused, and the conflicting tiles flash pink for 200 ms. Illegal means a letter already owned by another color, or (on a colored tile) a letter already used on a black tile.
- Keyboard graying: keys you can't use on the selected tile turn gray.
- A completed word that isn't in the list turns red. The cursor stays on it, and the timer/score display is replaced by **REPORT MISSING WORD(S)**, which POSTs the word to the server. On reload, a saved invalid word brings the report button back too: right away in score mode, and once the letters are visible again (RESUME or a tile tap) in speed mode.
- Animations: a letter pops into its tile. Filling a color pops every tile of that color at once. Conflicts and invalid words shake. Solving plays a diagonal wave (each tile jumps and flashes its color, black tiles flash ink) and then a burst of confetti in the four colors (on a themed SOLVE day, the theme's emojis fall instead). All of this is disabled under `prefers-reduced-motion`.
- Each word's tiles are joined by ink "links" (bars between the tiles, never vertically), because players were forgetting that only the rows (across) need to be words. A "rails" alternative (each word on a strip, green when valid, red when invalid) is still in the CSS: remove `class="row-links"` from `<body>` in game.html to switch.
- Colored tiles also carry a small shape (red circle, orange square, yellow diamond, blue triangle) for color-blind players.
- Progress (letters, timer, solved flag) saves in localStorage per mode and resets when the game id changes.

## Archive (since 2026-11-16)
- The 📅 button in the header (next to 📊 and ?) opens `/archive/<mode>`: a month calendar of past puzzles, with SOLVE / SPEED / SCORE tabs, ‹ › between months, and ✕ back to today's puzzle. Days with a puzzle are tiles; today's tile is dark and goes to today's puzzle; future days are plain numbers. Every mode starts on 2026-11-01 (`ARCHIVE_START` in app.py), so all three have the same number of puzzles. SOLVE was backfilled for 11/1–11/14 to make that possible; older speed and score puzzles (back to 2025-02-10) still exist but aren't listed, and their dates redirect to the calendar.
- A ✓ marks days finished in this browser, whether as the daily puzzle (from the stats) or in the archive (localStorage `archive`).
- A past puzzle opens at `/archive/<mode>/YYYY-MM-DD`, the normal game page with `‹ ⏱️ SPEED 11/10/2026 ›` in place of the mode tabs (› after the last past day goes to today's). Today's or a future date redirects to today's puzzle.
- Archive puzzles keep their own progress (`archiveSpeed11102026Word0`…; SOLVE shares `solveDay…` with `/solve/day`), aren't logged, don't count toward stats or streaks, and have no 📊 button. Score's SHOW BEST works there too. The share text links to the archive page and includes the year: `constrainbow.com/archive/speed/2026-11-10` / `11/10/2026 | ⏱️ 0:41`.

## Stats and streaks (since 2026-11-16)
- Each daily mode keeps its own stats in this browser (localStorage `stats`; no accounts): days played, current streak 🔥, best streak, plus a mode-specific number and chart:
  - SOLVE: no-reveal solves and average tiles revealed per day; solve times (under 2m, 2–5m, 5–10m, 10m+).
  - SPEED: best time; times (under 1m, 1–2m, 2–3m, 3–5m, 5m+).
  - SCORE: perfect scores; share of the max score (100%, 90–99%, 75–89%, under 75%). A better score later the same day replaces the day's result.
- A day counts once its puzzle is finished. In SOLVE, reveals don't matter. The current streak stays alive until a whole day is missed (finishing yesterday but not yet today still shows the streak).
- The 📊 button next to `?` opens the stats (and pauses the game, like `?`). They also open by themselves about 2 s after today's puzzle is finished for the first time. Today's bar is highlighted. Once today's puzzle is solved, the popup also has a COPY RESULTS button that works the page's button (same text; in speed and score a second click includes the solution).
- Only the daily puzzles count: the SOLVE test batch and `/solve/day` have no 📊 button and record nothing.
- Nothing was recorded before this, so everyone's streak started on 2026-11-16.

## Sharing
The first click on COPY RESULTS copies the following (the `| 🔥 5` streak appears once that mode's streak is at least 2 days):
```
constrainbow.com/score
11/15 | 🎯 64/64 | 🔥 5
⬛️🟥⬛️🟧⬛️
⬛️⬛️🟦⬛️🟥
🟨⬛️🟦⬛️⬛️
🟦⬛️🟧⬛️🟨
462,754 solutions
```
The button then reads "COPIED! INCLUDE SOLUTION?". A second click within 5 s copies the same text plus the four words. The emoji grid shows the puzzle's layout, not the player's answer (unlike Wordle).

## How to play (intro)
A 4-step popup with BACK / NEXT and progress dots, each step with a small example board. Since 2026-11-16 the example board is **yesterday's SOLVE answer**, and step 3 ends with "This is yesterday's Solve answer (MM/DD)." The letters in the text come from that board (`get_tutorial` and `describe_tutorial` in app.py): the orange letter, the four color letters in reading order, and the most repeated black-tile letter ("like the two Hs"; "A's", "I's", "U's" get an apostrophe). About 1 day in 8 has no repeated black letter; then step 3 says "Black tiles can share letters with each other." If yesterday's file is missing or lacks a color, the fixed FIFTY / FLASK / SPARK / PUPIL board is used, with no caption.
1. Fill each row with a five-letter word; only the horizontal rows need to be words, not the vertical columns.
2. Same color, same letter (different colors, different letters).
3. Black tiles are free: "Use any letter the colored tiles haven't claimed", and black tiles can share letters (the two Hs). Four real words across: solved!
4. The two modes, with the contact email and "Made by Daniel Sochoux. All rights reserved." in fine print.

It opens automatically on the first visit (`localStorage.visited`) and from the `?` button. Players who visited before the redesign already have the flag, so they won't see the new intro unless they tap `?`.

## Play-test log (2026-11-15, local server, 375×812 mobile viewport)
- **Speed 11/15** (70,654 solutions). Layout: `_BO__ / R_Y_O / O_Y_R / __B_R`. Solved with QUERY / TRIBE / EXIST / GRUNT (blue=U, orange=E, yellow=I, red=T) in 0:41. A fun way in is to find the color pair shared by two rows and anchor on a common letter like E or T.
- **Score 11/15** (462,754 solutions, max 64). Got 64/64 with MAXIM / GYOZA / EPOXY / OXIDE, which matches the generator's `best_solution`. Typing the invalid word JAXIM correctly turned the row red and showed REPORT MISSING WORD. Pressing A on a black tile while red=A flashed the 2 red tiles.
- **Feel** (before the redesign): the core loop is satisfying. The one-color-fills-many mechanic gives nice cascades of letters. Friction points, all fixed the same day:
  - In score mode no tile is pre-selected, so keys do nothing until you tap.
  - Tapping the tile that auto-advance just selected deselects it, and the next keystrokes are silently dropped. I hit this while playing.
  - The board is plain Arial; no transitions apart from the conflict flash and the win cascade.
