# Gameplay

## The puzzle
- A 4×5 grid: four rows, each a five-letter English word. Word list: `word_files/words.txt` (2,451 hand-curated words; no regular plurals or regular past tenses).
- Some tiles have a colored border: red, orange, yellow, blue (constraints 1–4; CSS vars `--c1..--c4`). Black-bordered tiles are "wildcards" (constraint 0).
- Rules:
  1. All tiles of one color hold the same letter.
  2. Different colors hold different letters.
  3. A black tile may hold any letter **except** one used by a color. Black letters can repeat freely.
- Every color appears at least twice, and the colors are linked in a cycle across the rows (row i always has colors s[i] and s[i+1]), so all four colors interact.
- Speed puzzles have 10 colored tiles; score puzzles have 9.
- A new puzzle for each mode releases at midnight Eastern. Under the board header a sentence gives the date and how many solutions exist: "Today's puzzle (11/15) has 70,654 solutions." Speed puzzles are generated to have at least 15k solutions and score puzzles at least 50k. Counts in the current files range from about 13k to 6.3M.

## Modes
Both modes are on one page; the SPEED / SCORE switch under the wordmark changes between them. A cookie remembers the last mode, and `/` redirects to it (speed by default).

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

## Controls
- Tap a tile to select it (tapping the selected tile keeps it selected). Score mode starts with the first empty tile selected, and speed mode selects it on START.
- On-screen keyboard or a physical keyboard. Arrow keys and space move the cursor, wrapping between rows and from the last tile back to the first (and, with left arrow, from the first tile to the last). Backspace (DEL key) clears the letter on a filled tile (the cursor stays put); on an empty tile (or a play-test given letter) it moves back one tile, exactly like the left arrow. The CLEAR key clears the whole board. The selected tile lifts (bigger shadow) and shows a blinking cursor bar.
- Typing a letter on a colored tile fills **every** tile of that color. The cursor then jumps to the next blank tile in reading order.
- Illegal letters are refused, and the conflicting tiles flash pink for 200 ms. Illegal means a letter already owned by another color, or (on a colored tile) a letter already used on a black tile.
- Keyboard graying: keys you can't use on the selected tile turn gray.
- A completed word that isn't in the list turns red. The cursor stays on it, and the timer/score display is replaced by **REPORT MISSING WORD(S)**, which POSTs the word to the server. On reload, a saved invalid word brings the report button back too: right away in score mode, and once the letters are visible again (RESUME or a tile tap) in speed mode.
- Animations: a letter pops into its tile. Filling a color pops every tile of that color at once. Conflicts and invalid words shake. Solving plays a diagonal wave (each tile jumps and flashes its color, black tiles flash ink) and then a burst of confetti in the four colors. All of this is disabled under `prefers-reduced-motion`.
- Each word's tiles are joined by ink "links" (bars between the tiles, never vertically), because players were forgetting that only the rows (across) need to be words. A "rails" alternative (each word on a strip, green when valid, red when invalid) is still in the CSS: remove `class="row-links"` from `<body>` in game.html to switch.
- Colored tiles also carry a small shape (red circle, orange square, yellow diamond, blue triangle) for color-blind players.
- Progress (letters, timer, solved flag) saves in localStorage per mode and resets when the game id changes.

## Sharing
The first click on COPY RESULTS copies the following:
```
constrainbow.com
11/15 | 🎯 64/64
⬛️🟥⬛️🟧⬛️
⬛️⬛️🟦⬛️🟥
🟨⬛️🟦⬛️⬛️
🟦⬛️🟧⬛️🟨
462,754 solutions
```
The button then reads "COPIED! INCLUDE SOLUTION?". A second click within 5 s copies the same text plus the four words. The emoji grid shows the puzzle's layout, not the player's answer (unlike Wordle).

## How to play (intro)
A 4-step popup with BACK / NEXT and progress dots, each step with a small example board:
1. Fill each row with a five-letter word; only the rows (across) need to be words, not the columns.
2. Same color, same letter (different colors, different letters).
3. Black tiles are free: "Use any letter the colored tiles haven't claimed", and black tiles can share letters (the two Ks). Four real words across: solved!
4. The two modes, with the contact email and the authorship hash in fine print.

It opens automatically on the first visit (`localStorage.visited`) and from the `?` button. Players who visited before the redesign already have the flag, so they won't see the new intro unless they tap `?`.

## Play-test log (2026-11-15, local server, 375×812 mobile viewport)
- **Speed 11/15** (70,654 solutions). Layout: `_BO__ / R_Y_O / O_Y_R / __B_R`. Solved with QUERY / TRIBE / EXIST / GRUNT (blue=U, orange=E, yellow=I, red=T) in 0:41. A fun way in is to find the color pair shared by two rows and anchor on a common letter like E or T.
- **Score 11/15** (462,754 solutions, max 64). Got 64/64 with MAXIM / GYOZA / EPOXY / OXIDE, which matches the generator's `best_solution`. Typing the invalid word JAXIM correctly turned the row red and showed REPORT MISSING WORD. Pressing A on a black tile while red=A flashed the 2 red tiles.
- **Feel** (before the redesign): the core loop is satisfying. The one-color-fills-many mechanic gives nice cascades of letters. Friction points, all fixed the same day:
  - In score mode no tile is pre-selected, so keys do nothing until you tap.
  - Tapping the tile that auto-advance just selected deselects it, and the next keystrokes are silently dropped. I hit this while playing.
  - The board is plain Arial; no transitions apart from the conflict flash and the win cascade.
