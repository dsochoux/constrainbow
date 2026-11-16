# Constrainbow

Daily word-puzzle web game, live at constrainbow.com. Written entirely by Danny (started Jan 2025). Flask backend + vanilla-JS ES-module frontend bundled with esbuild. Puzzles are pre-generated offline by a Python solver and served as static JSON.

Detailed notes (read these before making changes):
- [docs/gameplay.md](docs/gameplay.md) — rules, both modes, UI behavior, what a play session feels like
- [docs/architecture.md](docs/architecture.md) — every file, data formats, request flow, generator algorithm, deploy
- [docs/findings.md](docs/findings.md) — bugs, risks, tech debt, and improvement ideas found during the Nov 2026 review

## Quick facts
- Run locally: `env/bin/python project/app.py` from the repo root (port 5001). App uses paths relative to the repo root (`./games`, `./word_files`, `./logs`), so it **must** be started from the root. `.claude/launch.json` has a `constrainbow` config for the browser preview.
- The template loads **`project/static/js/bundle.js`**, not the ES-module sources. After editing any JS, rebuild:
  `esbuild ./project/static/js/script.js --bundle --minify --outfile=./project/static/js/bundle.js`
  (`script.min.js` is a stale, unused artifact.)
- Puzzles: the **server generates its own** with a nightly cron job (`scripts/ensure_games.py`, keeping 30 days ahead for all three modes, never overwriting). Locally: `env/bin/python scripts/ensure_games.py [--days N]` from the root. The generator uses in-memory bitsets over `words.txt` (~0.15 s/puzzle); `database.db` is no longer needed. Full explanation: [docs/generation-algorithm.md](docs/generation-algorithm.md).
- Deploy: `./deploy.sh` (scp to `root@constrainbow.com`; rsyncs games both ways with `--ignore-existing`; runs ensure_games and (re)installs the cron line; installs `server/constrainbow.service` and `systemctl restart constrainbow`; reloads nginx). It asks two y/n questions first; `printf 'y\ny\n' | ./deploy.sh` answers both.
- SOLVE mode (🔑, single-solution puzzles, the first tab and the default for new visitors): daily puzzles in `games/solve/MMDDYYYY.json`, made by `ensure_games.py` along with speed/score (via `generate_solve_day` in `scripts/generate_unique.py`), 5 given letters each, answers only from `word_files/common_words.txt` (rebuilt by `scripts/build_common_words.py`) and not reused within 90 days. Hand-picked answers per date go in `word_files/solve_themes.json` (`{"2027-10-31": ["..."]}`); test words first with `--words a b c d`. The play-test batch lives at `/solve/test?p=N` (`games/solve-test/`). Logs: `logs/MMDDYYYY/solve.csv`. Design notes and play-test results: docs/findings.md (feature 5).
- Game day boundary is midnight **America/New_York**; game id format is `MMDDYYYY`.
- Production: the app runs from `/srv/constrainbow` as the sandboxed systemd service `constrainbow` (unprivileged user, gunicorn on 127.0.0.1:5001 behind nginx). Every file it serves must be world-readable; deploy.sh handles that. Details in [docs/architecture.md](docs/architecture.md).
- As of 2026-11-16, games exist through 2026-12-31 locally (committed) and the server keeps 30 days ahead on its own. The live site matches the latest commit: `/` always redirects to `/solve`, share text starts with the mode's link (`constrainbow.com/solve`), the how-to-play example is yesterday's SOLVE answer, and its fine print reads "Made by Daniel Sochoux. All rights reserved." (Daniel is Danny's professional name, the one on the resume and LinkedIn.)
- The repo is public (for Danny's resume), so never commit secrets. SOLVE answers in `games/solve/` are public too; Danny accepted that for now (2026-11-16). If the game grows, stop tracking `games/solve/` so only the server has them.

## Look
"Paper pop" (chosen 2026-11-15 from the three directions in `design/mockups.html`): a cream paper background (`--paper`), ink borders with hard offset shadows, Archivo Black for the wordmark and tiles, Space Grotesk for the UI. Colored tiles get a tint plus a colored shadow plus a shape. All colors are CSS variables at the top of `style.css`. Rows use ink "links" (`<body class="row-links">`). Favicon sources are in `design/favicon/`. Write American English (color, gray) everywhere.

## Conventions
- No framework, no package.json, no tests. Keep it that way unless Danny agrees otherwise.
- Danny is proud of having written all the code: explain changes, keep the existing structure and style (class hierarchy Board/Word/Letter with Speed*/Score* subclasses) unless a refactor is agreed.
