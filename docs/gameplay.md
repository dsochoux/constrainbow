# Gameplay

## The puzzle
- A 4×5 grid: four rows, each a five-letter English word. Word list: `word_files/words.txt` (2,451 hand-curated words; no regular plurals or regular past tenses).
- Some tiles have a coloured border: red, orange, yellow, blue (constraints 1–4; CSS vars `--c1..--c4`). Black-bordered tiles are "wildcards" (constraint 0).
- Rules:
  1. All tiles of one colour hold the same letter.
  2. Different colours hold different letters.
  3. A black tile may hold any letter **except** one used by a colour. Black letters can repeat freely.
- Every colour appears at least twice, and the colours are linked in a cycle across the rows (row i always has colours s[i] and s[i+1]), so all four colours interact.
- Speed puzzles have 10 coloured tiles; score puzzles have 9.
- A new puzzle for each mode releases at midnight Eastern. The header shows the date and how many solutions exist (for example "70,654 unique solutions"). Speed puzzles are generated to have at least 15k solutions and score puzzles at least 50k. Counts in the current files range from about 13k to 6.3M.

## Modes
Both modes are on one page; a button in the header switches between them. A cookie remembers the last mode, and `/` redirects to it (speed by default).

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
- On-screen keyboard or a physical keyboard. Arrow keys and space move the cursor, wrapping between rows. Backspace (DEL key) clears the letter, or moves back if the tile is blank. The CLEAR key clears the whole board. The selected tile lifts (bigger shadow) and shows a blinking cursor bar.
- Typing a letter on a coloured tile fills **every** tile of that colour. The cursor then jumps to the next blank tile in reading order.
- Illegal letters are refused, and the conflicting tiles flash pink for 200 ms. Illegal means a letter already owned by another colour, or (on a coloured tile) a letter already used on a black tile.
- Keyboard greying: keys you can't use on the selected tile turn grey.
- A completed word that isn't in the list turns red. The cursor stays on it, and the timer/score display is replaced by **REPORT MISSING WORD(S)**, which POSTs the word to the server.
- Animations: a letter pops into its tile. Filling a colour pops every tile of that colour at once. Conflicts and invalid words shake. Solving plays a diagonal wave (each tile jumps and flashes its colour, black tiles flash ink) and then a burst of confetti in the four colours. All of this is disabled under `prefers-reduced-motion`.
- Each word's tiles are joined by ink "links" (bars between the tiles, never vertically), because players were forgetting that only the rows (across) need to be words. A "rails" alternative (each word on a strip, green when valid, red when invalid) is still in the CSS: remove `class="row-links"` from `<body>` in game.html to switch.
- Coloured tiles also carry a small shape (red circle, orange square, yellow diamond, blue triangle) for colour-blind players.
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

## Play-test log (2026-11-15, local server, 375×812 mobile viewport)
- **Speed 11/15** (70,654 solutions). Layout: `_BO__ / R_Y_O / O_Y_R / __B_R`. Solved with QUERY / TRIBE / EXIST / GRUNT (blue=U, orange=E, yellow=I, red=T) in 0:41. A fun way in is to find the colour pair shared by two rows and anchor on a common letter like E or T.
- **Score 11/15** (462,754 solutions, max 64). Got 64/64 with MAXIM / GYOZA / EPOXY / OXIDE, which matches the generator's `best_solution`. Typing the invalid word JAXIM correctly turned the row red and showed REPORT MISSING WORD. Pressing A on a black tile while red=A flashed the 2 red tiles.
- **Feel**: the core loop is satisfying. The one-colour-fills-many mechanic gives nice cascades of letters. Friction points:
  - In score mode no tile is pre-selected, so keys do nothing until you tap.
  - Tapping the tile that auto-advance just selected deselects it, and the next keystrokes are silently dropped. I hit this while playing.
  - The board is plain Arial; no transitions apart from the conflict flash and the win cascade.
