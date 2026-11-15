# Architecture

```
constrainbow/
├── project/
│   ├── app.py                 Flask app (all routes)
│   ├── templates/game.html    single page for both modes (Jinja), includes how-to-play popup + on-screen keyboard
│   └── static/
│       ├── css/style.css      all styles (~435 lines)
│       ├── js/                ES-module sources → bundled to bundle.js
│       └── favicon_io/
├── scripts/
│   ├── generate_game.py       offline puzzle generator / solver (sqlite-backed)
│   ├── db.py                  rebuilds `words` table in database.db from words.txt
│   ├── filter_reported_words.py  reported_missing − words − rejected → filtered_reported_missing_words.txt
│   └── sort_words.py          sorts words.txt in place
├── word_files/
│   ├── words.txt              accepted answers (2,451, lowercase, sorted)
│   ├── reported_missing_words.txt  appended by /report-missing-word (server copy is the real one)
│   ├── rejected_words.txt     manually rejected reports
│   └── filtered_reported_missing_words.txt
├── games/{speed,score}/MMDDYYYY.json   pre-generated puzzles (597 per mode, 2025-03-30 … 2026-11-30)
├── logs/MMDDYYYY/{speed,score}.csv     solve logs (gitignored; server copy is real)
├── game_solutions/            old full-solution dumps (gitignored, unused)
├── database.db                sqlite: tables words(id, first_letter..fifth_letter), reported_missing_words (unused)
├── deploy.sh
├── server/constrainbow.service  systemd unit for gunicorn
└── env/                       Python 3.11 venv (Flask, gunicorn on server)
```

## Backend — `project/app.py`
Loads `words.txt` into memory at import. Routes:

| Route | Purpose |
|---|---|
| `GET /` | redirect to `/{game_mode cookie or 'speed'}` |
| `GET /speed`, `/score` | render game.html with `game_id` (today, Eastern), mode, emojis, date `MM/DD`; set `game_mode` cookie (1 yr) |
| `GET /game?game-id=&game-mode=` | read `games/{mode}/{id}.json`, return `{game_id, constraints, grid, num_possible_solutions, num_possible_points, words: [all 2,451 words]}`; bare `except` → 404 |
| `POST /report-missing-word` `{words:[...]}` | append to `word_files/reported_missing_words.txt` (flock) |
| `POST /log-solution` `{game_id, mode, metric, words}` | append `time,metric,w0..w3` to `logs/{game_id}/{mode}.csv` (flock, header on first write) |
| `GET /words` | send words.txt |
| `GET /speedlog`, `/scorelog` | today's raw CSV as text/plain (public) |

Production: gunicorn `-w 4 project.app:app -b 0.0.0.0:5001` behind nginx 1.26 on Ubuntu, run as root from `/root/constrainbow` by the systemd service `constrainbow` (`server/constrainbow.service`: `Restart=always`, enabled at boot, output to `gunicorn.log`). No gzip on JSON responses observed.
Server (checked 2026-11-15): DigitalOcean droplet with 1 vCPU and 1 GB RAM, clock in UTC, Python 3.12.7 in `env/`. `/root/constrainbow` is not a git checkout. It also holds legacy `generated_games/`, `gunicorn.log`, and the real `logs/` and `reported_missing_words.txt` (477 lines vs 323 locally). The server had 645 speed games vs 628 locally (through 11/30 only), and there was no crontab before the new deploy.sh. The new generator takes ~0.35 s/puzzle there. Access: `ssh root@constrainbow.com`.

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

- **Manager** (`manager.js`) — page controller. Fetches `/game`, builds `accepted_words` Set, instantiates `SpeedBoard` or `ScoreBoard`, wires keydown, virtual keys (dispatch synthetic `KeyboardEvent`), overlay, report/copy buttons, `visibilitychange` → pause. Owns keyboard greying (`updateKeyboard`), logging POST, report POST. First-visit popup via `localStorage.visited`.
- **Board** (`board.js`, base) — state: `words[]`, `selectedLetter`, `constraints`, `grid`, `constraintAssignments[4]` (letter per colour), `blackLetters{letter:count}`. Handles navigation (arrows wrap), `handleLetterKeyPressed` (conflict checks → fill all tiles of colour → auto-advance to next blank), backspace, clear, `check()` (invalid words → hide items + report button; all valid → `handleSolutionFound` → log once, celebrate, copy button), `celebrate()` cascade, `copyResults()` (emoji grid; second click within 5 s includes words), localStorage save/load (`{prefix}Word{w}` = JSON array of 5 letters).
- **SpeedBoard** — timer (`setInterval` 1 s, persisted as `elapsedSeconds`), play/pause button, letters hidden while paused, `speedGameId`/`speedIsSolutionFound` in localStorage.
- **ScoreBoard** — score = sum of `LETTERS_TO_POINTS` over all filled tiles (`scoreGameId`, `scoreIsSolutionFound`). `pause()` is a no-op inherited from Board.
- **Word** / SpeedWord / ScoreWord — 5 Letters; `updateLetter` tracks fill count, validates against word list when full (turns red if invalid), writes itself to localStorage.
- **Letter** / SpeedLetter / ScoreLetter — DOM tile (`div.letter.c{n}` > `span.letter-text` [+ `span.letter-points`]); click → board callback. SpeedLetter adds paused state; ScoreLetter shows point value.
- **helpers.js** — `LETTERS_TO_POINTS` (duplicated in generate_game.py and hard-coded in game.html keys), constants, cookie helpers, `formatTime`, `delayedForEach`.

CSS: white bg, black 2px borders with 3px offset solid box-shadow ("neo-brutalist"), coloured borders/shadows for constraints, Arial. One media query for short screens (≤645px tall → 60px tiles) and one for ≥1024px wide (vertical centering). Dark mode var is commented out.

## Generator — `scripts/generate_game.py`
> Since 2026-11-15 the row checks use in-memory bitsets instead of the SQL queries described below (same results, 86× faster), and `scripts/ensure_games.py` + a nightly server cron keep 30 days of games ahead. See [generation-algorithm.md](generation-algorithm.md) for the full write-up.

`Game(date, mode, num_colored).generate()`:
1. **Layout**: shuffle colours 1–4; row i gets colours (s[i], s[(i+1)%4]) at two random positions (8 coloured tiles, guaranteeing a connected cycle). Add `num_colored − 8` more tiles with *distinct* random colours at random empty positions (speed 10, score 9).
2. **Solve**: backtracking over colours 1→4, assigning distinct letters a–z; prune when any row containing that colour has no word matching the assigned positions (`SELECT COUNT(*) … WHERE nth_letter = ?`). At a full assignment, for each row query words where coloured positions match and black positions ≠ any assigned letter. Solution count += product of per-row counts; best score = sum of per-row maxima (valid because black letters may repeat across rows).
3. Repeat layouts until `num_solutions ≥ threshold` (speed 15k, score 50k), write `games/{mode}/{id}.json` with `best_solution`.
Main block loops a hard-coded date range (currently uncommitted edit: 2026-11-01 … 2026-11-30).

Note: count is over (letter assignment × word choices); different assignments can't produce the same 4 words, so it's a true count of distinct boards.

## Deploy — `deploy.sh`
Prompts (bundle rebuilt? dev changes removed?) → scp app.py, game.html, style.css, bundle.js, words.txt → scripts + games sync (see generation-algorithm.md) → install `server/constrainbow.service`, `systemctl restart constrainbow` → `systemctl reload nginx`. Server-side `reported_missing_words.txt` and `logs/` are never pulled back automatically.
