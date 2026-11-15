# Review findings (2026-11-15)

Ordered roughly by urgency. None of these have been fixed yet. Discuss with Danny before changing gameplay.

## Urgent / operational
1. *(Addressed 2026-11-15: December was generated locally, and the server will generate nightly once the new deploy.sh is run. See generation-algorithm.md.)* **Puzzles run out on 2026-12-01.** The last game files are for 11/30. The live `/game?game-id=12012026` returns 404, so the page will show "SORRY, I FORGOT TO MAKE TODAY'S GAME 😭". Generate December (or more) and deploy. Longer term, consider auto-generation, or a warning when fewer than N days are left.
2. **Jan–Nov 2026 game files are untracked in git** (the last commit is "july games", 2025). They exist only locally and on the server.
3. **`/log-solution` path traversal, running as root.** `game_id` and `mode` come from the POST body unchecked and feed `os.makedirs(f'./logs/{game_id}/')` and `open(f'{path}{mode}.csv','a')`. Anyone can create directories and append to `.csv` files anywhere the process can write. gunicorn runs as **root**. Fix: validate `game_id` against `^\d{8}$` and `mode` against `{speed, score}`, and run gunicorn as an unprivileged user. `/game` builds a path the same way, but it only reads `.json` and returns specific keys, so it is low risk. It should still be validated.
4. `/report-missing-word` and `/log-solution` have no rate limit or size limit, so the logs can be spammed. Solve times/scores are trusted from the client.
5. The deploy restarts with `pkill` + `nohup` (no systemd unit, no restart on crash or reboot), as root over ssh.

## Efficiency
- Every `/game` response includes the full 2,451-word list (~20 KB, **not gzipped** by nginx). Options: enable gzip in nginx, make `words.txt` a cacheable static asset (or keep it in localStorage with a version), or validate server-side.
- `bundle.js` and `style.css` have no cache-busting or versioning. There is no `Cache-Control` strategy, so after a deploy users may get stale JS.
- Point values are defined three times: helpers.js, generate_game.py, and the hard-coded key HTML. The 04/08 balloon is defined twice (app.py and speedBoard.js).
- `script.min.js` is dead. `game_solutions/`, the `reported_missing_words` DB table, and `getCookie`/`resetCookie`/`getInvalidWords` are unused.
- ~~Generator: one SQL query per candidate letter per row.~~ Done 2026-11-15: replaced with bitsets, 86× faster.

## Bugs / UX friction
- **Score mode starts with no tile selected**, so keys do nothing until you tap a tile. Speed mode selects (0,0) on START.
- **Tapping the selected tile deselects it.** Auto-advance often moves the cursor onto the tile you were about to tap, so your next keystrokes are silently ignored (I hit this while playing).
- Score mode logs only the *first* solve. Later improvements are never logged, so the server never learns a player's best score.
- Backspace on a blank tile with nothing to its left (`isTopLeft`) is a no-op. That is fine, but `blackLetters['']` becomes NaN when you type over a blank black tile. It is harmless but sloppy.
- A page left open past midnight keeps the old game id. Saved progress is keyed per mode, so returning the next day resets correctly, but an open tab doesn't roll over.
- The "how to play" popup uses `id="example-board"` three times (invalid HTML) and has a visible 64-hex hash string at the bottom (the commit "remove name for hash" suggests proof of authorship). It is capped at 70vh, which leaves dead space on phones.
- The viewport has `user-scalable=no` (an accessibility concern). Tiles and keys have no aria labels, and colour alone carries meaning (colour-blind players can't tell red from orange easily, and the share emojis are colour-only).
- Speed timer: `setInterval` tick counting can drift; it should use `Date.now()` deltas.
- `copyResults` decides "include solution?" from the button text, which is fragile.
- The share grid shows the puzzle *layout* only, so all players' shares for a day look identical apart from the time or score.

## Aesthetic observations
- Neo-brutalist look (thick borders, hard offset shadows), Arial, white background. Clean, but generic. The rainbow-shadow wordmark is the only branding.
- Few animations. Letter entry has no pop, conflicts get a 200 ms pink flash, the win gets a sequential dark/green cascade, and invalid words just go red.
- Dark mode is stubbed (`--bg` commented) but not implemented.
- Desktop layout is just the mobile column centred. 67px tiles.
- Good for video: the colour-fill cascade when one letter fills 3 tiles, and the win cascade.

## Feature ideas to discuss
- Stats/streaks (localStorage), and a results screen with distribution (the server already logs times and scores).
- An archive/practice mode for past puzzles (597 already exist per mode).
- Show "you beat X% of players" from the logs.
- A share text that encodes something player-specific (e.g. score tiles shaded by points, or time).
- A hint system (reveal one colour), and an "optimal solution" reveal after solving in score mode (`best_solution` already exists in the JSON).
- A first-time interactive tutorial instead of the long text popup.
- A PWA/offline mode (manifest already present).
