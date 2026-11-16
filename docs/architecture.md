# Architecture

```
constrainbow/
├── project/
│   ├── app.py                 Flask app (all routes)
│   ├── templates/game.html    single page for both modes (Jinja): 4-step how-to-play popup (its example is yesterday's SOLVE answer, passed to every page as `tutorial` by a context processor in app.py), mode switch, on-screen keyboard
│   └── static/
│       ├── css/style.css      all styles, "Paper pop" (~780 lines)
│       ├── js/                ES-module sources → bundled to bundle.js
│       └── favicon_io/        rainbow-C icons: favicon.svg/.ico, 16/32 PNGs, apple-touch, android 192/512, site.webmanifest
├── scripts/
│   ├── generate_game.py       puzzle generator / solver (in-memory bitsets over words.txt)
│   ├── ensure_games.py        generates any missing games for the next N days (default 30); run nightly by cron
│   ├── generate_unique.py     SOLVE puzzles (single solution, answer first): `generate_solve_day` for dailies, `--day`, `--test-batch`, `--words a b c d`
│   ├── build_common_words.py  builds common_words.txt from words.txt minus a hand-reviewed exclude list
│   ├── db.py                  rebuilds `words` table in database.db (no longer needed)
│   ├── filter_reported_words.py  reported_missing − words − rejected → filtered_reported_missing_words.txt
│   └── sort_words.py          sorts words.txt in place
├── word_files/
│   ├── words.txt              accepted words (2,451, lowercase, sorted; "minty" is listed twice)
│   ├── common_words.txt       the 1,529 everyday, inoffensive words single-solution answers are drawn from
│   ├── reported_missing_words.txt  appended by /report-missing-word (server copy is the real one)
│   ├── rejected_words.txt     manually rejected reports
│   └── filtered_reported_missing_words.txt
├── games/solve/MMDDYYYY.json  daily SOLVE puzzles (5 given letters), made by ensure_games.py like speed/score
├── games/solve-test/NN.json  the SOLVE play-test batch (12 puzzles at 3/5/7 given letters, easiest first)
├── games/{speed,score}/MMDDYYYY.json   pre-generated puzzles (676 per mode, 2025-02-10 … 2026-12-31 locally; the server keeps 30 days ahead)
├── logs/MMDDYYYY/{solve,speed,score}.csv  solve logs (gitignored; server copy is real); logs/solve-test.csv for the test batch
├── game_solutions/            old full-solution dumps (gitignored, unused)
├── database.db                old sqlite word table, unused since the bitset generator
├── deploy.sh                  see Deploy below
├── design/                   design explorations (mockups.html) and favicon sources (favicon/D*.svg = the chosen rainbow C; rendered to PNG/ICO with headless Chrome + ImageMagick)
├── server/constrainbow.service  systemd unit for gunicorn
├── .claude/launch.json        browser-preview config (`constrainbow`)
└── env/                       local Python 3.11 venv (server: 3.12, from project/requirements.txt)
```

## Backend — `project/app.py`
Loads `words.txt` into memory at import. Input validation lives at the top: `GAME_ID_PATTERN`, `WORD_PATTERN`, `BOARD_WORD_PATTERN`, `METRIC_PATTERN`, `GAME_MODES`, plus helpers `is_valid_game` and `is_list_of`. Routes:

| Route | Purpose |
|---|---|
| `GET /` | redirect to `/solve` (the default mode) |
| `GET /speed`, `/score` | render game.html with `game_id` (today, Eastern), mode, emojis, date `MM/DD` |
| `GET /game?game-id=&game-mode=` | read `games/{mode}/{id}.json` (modes `solve` and `solve-test` also return `givens` and `solution`; `solve-test` takes a 2-digit id from `games/solve-test/`), return `{game_id, constraints, grid, num_possible_solutions, num_possible_points, words: [all 2,451 words]}`; invalid id/mode or missing file → 404 |
| `POST /report-missing-word` `{words:[...]}` | words must match `[a-z]{5}`, else 400; append to `word_files/reported_missing_words.txt` (flock) |
| `POST /log-solution` `{game_id, mode, metric, words}` | validated (8-digit id, `speed`/`score`, metric `[0-9:/]{1,20}`, words `[a-z-]{5}`), else 400; append `time,metric,w0..w3` to `logs/{game_id}/{mode}.csv` (flock, header on first write) |
| `GET /words` | send words.txt |
| `GET /solve` | today's SOLVE puzzle |
| `GET /solve/day?d=YYYY-MM-DD` | any day's SOLVE puzzle, past or future (unlisted, for trying out themed days), `game_mode="solve-day"`, with ‹ › links to the days around it. 404 if that day has no puzzle; a bad date means today. Progress is saved under `solveDay{MMDDYYYY}`, and solves aren't logged |
| `GET /solve/test?p=N` | SOLVE test-batch puzzle N (unlisted; out-of-range N is clamped), `game_mode="solve-test"`. The old `/playtest?p=N` redirects here |
| `POST /log-solve` `{puzzle, mode, tester, seconds, black_reveals, color_reveals, revealed_tiles, replay, words}` | validated; daily (`mode: solve`) solves go to `logs/MMDDYYYY/solve.csv`, test-batch ones to `logs/solve-test.csv`, with the puzzle's given-letter count. `/log-solution` refuses mode `solve` |
| `GET /solvelog`, `/solvetestlog` | today's SOLVE log / the test-batch log, as text |
| `GET /favicon.ico` | send `static/favicon_io/favicon.ico` (browsers ask for it at the root) |
| `GET /speedlog`, `/scorelog` | today's raw CSV as text/plain (public) |

Production: nginx 1.26 (HTTPS via Let's Encrypt, auto-renewed by certbot) proxies to gunicorn `-w 4 project.app:app -b 127.0.0.1:5001`. gunicorn runs from `/srv/constrainbow` as the systemd service `constrainbow` (`server/constrainbow.service`). The service runs as the no-login system user `constrainbow`, restarts on crash and starts at boot. It is sandboxed (`ProtectSystem=strict`, `ProtectHome`, `PrivateTmp`, `NoNewPrivileges`) and may write only to `logs/` and `word_files/reported_missing_words.txt`; everything else under `/srv/constrainbow` is root-owned and read-only to it. gunicorn's output goes to `gunicorn.log`. The nightly root cron runs `ensure_games.py` from `/srv/constrainbow`. No gzip on JSON responses.


Server (checked 2026-11-15): DigitalOcean droplet with 1 vCPU and 1 GB RAM, Ubuntu 24.10, clock in UTC, Python 3.12.7. The venv `env/` was built from `project/requirements.txt` (pinned). `/srv/constrainbow` is not a git checkout. The pre-move folder is kept at `/root/constrainbow-backup-2026-11-15` (contains legacy `generated_games/` and old `gunicorn.log`). The server's `reported_missing_words.txt` had 477 lines vs 323 locally. ufw is inactive; port 5001 is not publicly reachable because gunicorn binds 127.0.0.1. Access: `ssh root@constrainbow.com`. Because the app user isn't root, every file it serves must be world-readable: a root-only `favicon_io/` made every icon 404 after the move, and deploy.sh now runs `chmod -R a+rX` on `project`, `word_files`, `games` and `scripts`.

## Puzzle JSON format
```jsonc
{
  "grid": [[0,1,0,0,3], ...],          // 4×5, constraint id per tile (0 = black/wildcard, 1-4 = red/orange/yellow/blue)
  "constraints": [[[w,l],...], ...],   // index = constraint id, list of [word, letter] positions (index 0 = all black tiles)
  "num_possible_solutions": 70654,
  "num_possible_points": 64,           // max achievable score
  "best_solution": {"points":64,"word_1":"maxim",...}   // NOT sent to client
}
```

## Frontend — `project/static/js`
Entry `script.js` → `new Manager()` on DOMContentLoaded. Class layout:

- **Manager** (`manager.js`) — page controller. Fetches `/game`, builds `accepted_words` Set, instantiates `SpeedBoard` or `ScoreBoard` (score mode then calls `selectFirstBlank()`), wires keydown, virtual keys (dispatch synthetic `KeyboardEvent`), report/copy buttons, `visibilitychange` → pause. Owns keyboard graying (`updateKeyboard`), logging POST, report POST. How-to-play: `setUpHowToPlay` / `showStep` / `showHowToPlay` / `hideHowToPlay`; first visit opens it via `localStorage.visited`.
- **Board** (`board.js`, base) — state: `words[]`, `selectedLetter`, `constraints`, `grid`, `constraintAssignments[4]` (letter per color), `blackLetters{letter:count}`. Handles selection (`selectLetter`, `selectFirstBlank`; tapping the selected tile keeps it), navigation (arrows wrap), `handleLetterKeyPressed` (conflict checks → flash + shake conflicting tiles, or fill all tiles of color with one simultaneous pop via `popConstraint` → auto-advance to next blank), backspace, clear, `check()` (invalid words → hide items + report button; all valid → `handleSolutionFound` → log once, celebrate, copy button), `celebrate()` (diagonal wave, then `launchConfetti`), `copyResults()` (emoji grid; second click within 5 s includes words), localStorage save/load (`{prefix}Word{w}` = JSON array of 5 letters).
- **SpeedBoard** — timer (`setInterval` 1 s, persisted as `elapsedSeconds`), play/pause button (START selects the first blank), letters hidden while paused, `speedGameId`/`speedIsSolutionFound` in localStorage.
- **ScoreBoard** — score = sum of `LETTERS_TO_POINTS` over all filled tiles (`scoreGameId`, `scoreIsSolutionFound`). `updateScoreDisplay` adds class `over` (red) when the score passes `numPossiblePoints` and shakes the pill the first time. `pause()` is a no-op inherited from Board.
- **Word** / SpeedWord / ScoreWord — 5 Letters inside a `.word-row` element; `updateLetter` tracks fill count, validates against word list when full (`turnRed` shakes and calls `setRowState('invalid')`; valid rows get `'valid'`), writes itself to localStorage.
- **Letter** / SpeedLetter / ScoreLetter — DOM tile (`div.letter.c{n}` > `span.letter-text` [+ `span.letter-points`]); click → board callback; `playAnimation(className, delay)` with `pop`, `shake`, `celebrate`. SpeedLetter adds paused state; ScoreLetter shows point value.
- **SolveBoard** / SolveWord / SolveLetter — SOLVE mode, the single-solution puzzles (extend the Speed* classes). Givens and revealed tiles are "locked" (`setGiven`, pressed-in style, can't be typed over or deleted, restored after CLEAR). `reveal()` fills the selected black tile, or the selected tile's whole color, first clearing anything that would clash. Progress is saved under its own keys: the daily puzzle in `solveWord0-3` and `solveState` (which stores the answer, so a new day's puzzle starts fresh), test-batch puzzles in `solveTest{NN}Word0-3` and `solveTest{NN}State`. `initBoard` and `startTimer` are overridden so the daily speed game's `speedWord*`, `speedGameId` and `elapsedSeconds` are never touched. The REVEAL button reads "REVEAL N" on a colored tile (via `updateRevealButton`, called from `Manager.updateKeyboard`), and reveals are counted per tile. Results go to `/log-solve` with a random per-browser `solveTester` id. `getEmojiBoard` marks given letters ⬜ and revealed tiles 💡 in the share grid.
- **helpers.js** — `LETTERS_TO_POINTS` (duplicated in generate_game.py and hard-coded in game.html keys), constants, cookie helpers, `formatTime`, `delayedForEach`, `launchConfetti`.

## Look — `style.css` ("Paper pop", 2026-11-15)
Chosen from the three directions in `design/mockups.html`.
- **Tokens** at the top of the file: `--ink #1d1b20`, `--paper #fbf4e6`, colors `--c1..--c4` (red `#e0352b`, orange `#ff8a1f`, yellow `#e6c200`, blue `#3a3fd9`) and tints `--t1..--t4`. Fonts: Archivo Black (`--display-font`: wordmark, tiles) and Space Grotesk (`--ui-font`), loaded from Google Fonts.
- **Sizing**: `--tile` drives `--content`, the one width the wordmark, mode switch, board and keyboard all share, so nothing hangs over. `--key` and `--key-wide` are derived from `--content`. They're computed on `body` so a body class can change their inputs. Smaller tiles under `max-height: 645px`.
- **Tiles**: ink border plus a hard offset shadow. Colored tiles get a tint, a colored shadow and a shape in `::before` (red circle, orange square, yellow diamond, blue triangle) for color-blind players. The selected tile lifts (`translate(-3px,-3px)`, 6px shadow) and shows a blinking caret (`::after`).
- **Rows**: `<body class="row-links">` joins each word's tiles with ink links (across only, always black). Without the class, rows show as "rails" (a strip behind each word, green when valid, red when invalid).
- **Keys**: `button { all: unset; box-sizing: border-box; }`. `all: unset` also resets box-sizing, so without the second line key borders add to their width and the keyboard overflows. CLEAR and DEL are paper-colored word keys (`.key-word`).
- **Motion**: keyframes for pop, shake, celebrate and confetti; all switched off under `prefers-reduced-motion`.
- **Favicon**: a rainbow "C" in the four colors. SVG sources are in `design/favicon/` (`D.svg` and `D-full.svg` for the full-square app icons). PNGs were rendered with headless Chrome (`--headless=new --screenshot --default-background-color=00000000`) and resized and packed into the .ico with ImageMagick. ImageMagick's own SVG renderer drops strokes, so don't use it directly.

## Generator — `scripts/generate_game.py`
> Since 2026-11-15 the row checks use in-memory bitsets instead of the SQL queries described below (same results, 86× faster), and `scripts/ensure_games.py` + a nightly server cron keep 30 days of games ahead. See [generation-algorithm.md](generation-algorithm.md) for the full write-up.

`Game(date, mode, num_colored).generate()`:
1. **Layout**: shuffle colors 1–4; row i gets colors (s[i], s[(i+1)%4]) at two random positions (8 colored tiles, guaranteeing a connected cycle). Add `num_colored − 8` more tiles with *distinct* random colors at random empty positions (speed 10, score 9).
2. **Solve**: backtracking over colors 1→4, assigning distinct letters a–z; prune when any row containing that color has no word matching the assigned positions (`SELECT COUNT(*) … WHERE nth_letter = ?`). At a full assignment, for each row query words where colored positions match and black positions ≠ any assigned letter. Solution count += product of per-row counts; best score = sum of per-row maxima (valid because black letters may repeat across rows).
3. Repeat layouts until `num_solutions ≥ threshold` (speed 15k, score 50k), write `games/{mode}/{id}.json` with `best_solution`.
The `__main__` block still loops a hard-coded date range for manual runs; normally `ensure_games.py` is used instead.

Note: count is over (letter assignment × word choices); different assignments can't produce the same 4 words, so it's a true count of distinct boards.

## Deploy — `deploy.sh`
Asks two y/n questions (bundle rebuilt? dev changes removed?), then:
1. scp `app.py`, `game.html`, `style.css`, `bundle.js`, `favicon_io/*`, `words.txt` and the scripts to `/srv/constrainbow`.
2. rsync games both ways with `--ignore-existing` (never overwrites), run `ensure_games.py`, and (re)install the cron line `15 3 * * * cd /srv/constrainbow && env/bin/python scripts/ensure_games.py >> generate.log 2>&1`.
3. Create the `constrainbow` user if missing; make sure `logs/` and `reported_missing_words.txt` exist and belong to it; `chmod -R a+rX` the read-only folders.
4. Install `server/constrainbow.service`, `daemon-reload`, `enable`, `restart`; reload nginx.

Non-interactive: `printf 'y\ny\n' | ./deploy.sh`. Server-side `reported_missing_words.txt` and `logs/` are never pulled back automatically.
