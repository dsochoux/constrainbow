# How puzzle generation works (and why it got 86× faster)

*Written 2026-11-15, when `scripts/generate_game.py` moved from SQLite queries to in-memory bitsets, and the server started generating its own puzzles every night.*

## TL;DR

| | Before (SQLite) | After (bitsets) |
|---|---|---|
| Time per puzzle | 1–17 s (≈10 s average) | 0.01–0.25 s |
| One month (62 puzzles) | ≈ 5–10 min | ≈ 10 s |
| 20-puzzle benchmark | 294.3 s | 3.4 s (**86×**) |
| Needs `database.db` | yes | no, reads `word_files/words.txt` directly |
| Output | — | **byte-for-byte identical** for the same random seed (20/20 puzzles checked) |
| Who runs it | Danny, by hand, monthly | the server, nightly via cron (`scripts/ensure_games.py`) |

The search itself (how layouts are made, the order letters are tried, the pruning, how solutions are counted and how the best score is chosen) is **exactly the same**. The only change is how one question gets answered: *"which words fit this row right now?"* It used to be a SQL query. Now it's a few operations on big integers.

---

## 1. What the generator does (unchanged)

The new parts only make sense against the old structure, so here's a recap. `Game(date, mode, num_colored).generate()` does three things.

### 1a. Make a layout (`generate_constraints`)
- Shuffle the four colors into an order `s`. Row *i* gets colors `s[i]` and `s[(i+1) % 4]` at two random positions. The colors therefore form a ring (row 0 shares a color with row 1, row 1 with row 2, …, row 3 with row 0), so every color appears at least twice and no color can be solved in isolation.
- Then add `num_colored − 8` more colored tiles: 2 for speed, 1 for score. Each extra tile gets a different color, placed on a random empty tile.
- Throw the layout away if two rows came out identical (same colors in the same places), which the two speed extras can do now and then (it happened on 12/09/2025 and 11/21/2026): any word for one of those rows fits the other, so a player can enter the same word twice (`has_identical_rows`, since 2026-11-21).

### 1b. Count every solution (`find_solution` → `generate_solutions`)
This is a backtracking search over **color → letter assignments**:

```
find_solution(color):
    if all 4 colors have letters → generate_solutions(); return
    for letter in a..z:
        skip if another color already has this letter
        give `color` this letter
        PRUNE: for each row containing `color`, is there at least one word
               that fits the colored tiles assigned so far?  (black tiles = anything)
        if every such row still has a word → find_solution(color + 1)
    un-assign `color`
```

The pruning check deliberately ignores the black-tile rule. That makes it cheaper, and it still throws away most dead ends early. Black tiles also can't be checked until all four letters are known.

When all four colors have letters (a **leaf**), `generate_solutions` applies the full rules to each row. Colored tiles must match their letters, and black tiles must **not** be any of the four color letters. For each row it gets the set of fitting words:
- **Count:** black letters can repeat across rows, so the rows are independent once the colors are fixed. The number of boards for this assignment is `count(row0) × count(row1) × count(row2) × count(row3)`. That gets added to the total, and that's the "unique solutions" number on the site. Two different color assignments can never produce the same four words (some colored tile would differ), so nothing is double-counted.
- **Best score:** for the same reason, the best board for this assignment is the best word in each row, added together. The overall best (`num_possible_points`) is the maximum over all leaves.

### 1c. Retry until the puzzle is roomy enough (`generate`)
If the total is below the threshold (15,000 for speed, 50,000 for score), throw the layout away and make a new one. Then write the JSON.

---

## 2. Where the old version spent its time

Every check in the search was a SQL query:
- **Pruning** (`is_solution_for`) ran `SELECT COUNT(*) FROM words WHERE third_letter = ? AND fifth_letter = ?`.
- **Leaves** (`generate_solutions`) ran `SELECT … WHERE first_letter = ? AND second_letter != ? AND second_letter != ? …`, which can carry up to 4 `!=` conditions per black tile.

I instrumented one score puzzle:

| | count |
|---|---|
| pruning checks | 78,634 |
| leaf row checks | 19,145 |
| leaves reached | 6,242 |
| **total queries** | **≈ 97,800** |

The `words` table has no indexes on the letter columns, so every one of those queries is a **full scan of all 2,451 rows**. That's roughly 240 million row comparisons per puzzle. On top of that, each query pays to build the SQL string, parse it, plan it, and convert the result to Python objects. SQLite is fast, but it's built for questions you ask a few times, not 100k times in a tight loop.

The key observation is that the word list is tiny (2,451 words) and never changes during a run, while the questions are always the same shape: "position *p* is (or isn't) letter *c*". You can precompute the answer to every possible single condition once, then combine them very cheaply.

---

## 3. Bitsets, from scratch

### 3a. A set of words as one integer
Number the words by their line in `words.txt`: word 0 is `aback`, word 1 is `abase`, and so on up to word 2450. A **bitset** is one integer where **bit *i* is 1 if word *i* is in the set**.

Python integers can be any size, so a set of up to 2,451 words is one ~2,451-bit integer. Python stores it internally as about 82 chunks of 30 bits.

A toy example with 6 words, writing bit 0 on the **right**:

| # | word |
|---|---|
| 0 | brine |
| 1 | crane |
| 2 | crisp |
| 3 | plant |
| 4 | slate |
| 5 | stone |

The set {crane, crisp} is bits 1 and 2 → `000110` (the integer 6). The set of all words is `111111` = `(1 << 6) − 1`. In the real code that's `Game.all_words = (1 << 2451) − 1`.

### 3b. Set operations are single integer operations
| Set operation | Bitset operation | Toy example |
|---|---|---|
| intersection (A **and** B) | `A & B` | `000110 & 110011 = 000010` |
| remove B from A | `A & ~B` | `111111 & ~000110 = 111001` |
| is it empty? | `A == 0` | |
| how many? | `A.bit_count()` (popcount) | `110011` → 4 |

On a 2,451-bit integer each of these is a short loop over ~82 chunks, inside Python's C code. I timed one `&` at about **0.1 µs**. A SQL query that scans the table is thousands of times slower.

A note on `~`: in Python, `~x` of a positive integer is negative (conceptually, infinitely many 1s on the left). That's fine here, because we always AND it into a positive, finite set, and the result keeps only bits that were already in that set.

### 3c. The index: 130 precomputed sets
`Game.build_index()` runs once per process (about 5 ms) and builds:

```python
index[position][letter] = bitset of words that have `letter` at `position`
```

That's 5 positions × 26 letters = 130 integers. In the toy list:

- `index[0]['c']` = words starting with c = {crane, crisp} = `000110`
- `index[0]['s']` = {slate, stone} = `110000`
- `index[4]['e']` = words ending in e = {brine, crane, slate, stone} = `110011`
- `index[1]['r']` = {brine, crane, crisp} = `000111`

It's built by looping over every word and letter and turning on bit *i*: `index[position][letter] |= 1 << i`. The class also stores `words` (bit number → word) and `word_points` (bit number → point value), so a bit can be turned back into a word and its score.

The index is stored on the **class**, so every `Game` in a run shares it. Generating a whole month builds it once.

---

## 4. The new `matching_words`: one function replaces both queries

The two SQL builders (`verify_constraints_query` and `verify_word_query`) and their queries became one method:

```python
def matching_words(self, word, strict):
    bits = self.all_words                         # start with every word
    for i, constraint in enumerate(word):         # i = position 0..4 in this row
        if constraint == 0:                       # black tile
            if strict:
                for letter in self.constraint_assignments:
                    bits &= ~self.index[i][letter]    # can't be any color's letter
        else:                                     # colored tile
            letter = self.constraint_assignments[constraint - 1]
            if letter != '':
                bits &= self.index[i][letter]     # must be this color's letter
        if bits == 0:
            break                                 # nothing left; stop early
    return bits
```

How each old query maps onto it:
- `strict=False` is the old `verify_constraints_query`. Only the colored tiles whose color already has a letter count; black tiles are ignored. The pruning step uses this through `is_solution_for`, which is now `matching_words(row, strict=False) != 0`.
- `strict=True` is the old `verify_word_query`. Colored tiles must match **and** every black tile has all four color letters removed. Only `generate_solutions` uses it, at a leaf where all four colors have letters.

### Worked example (toy list)
Row layout `[yellow, 0, 0, 0, red]`, with the assignment red=`e`, orange=`t`, yellow=`c`, blue=`s`.

| step | operation | bits | words left |
|---|---|---|---|
| start | `all_words` | `111111` | all 6 |
| pos 0, yellow=`c` | `& index[0]['c']` (`000110`) | `000110` | crane, crisp |
| pos 1, black | `& ~index[1]['e']`, `['t']`, `['c']`, `['s']` | `000110` | (both have `r`: unchanged) |
| pos 2, black | same 4 removals | `000110` | (`a`, `i`: unchanged) |
| pos 3, black | same 4 removals | `000010` | crisp has **s** here and s is blue's letter → removed. crane (`n`) stays |
| pos 4, red=`e` | `& index[4]['e']` (`110011`) | `000010` | **crane** |

The result is `000010`: one word, crane. The old code got the same answer from a SQL query that scanned the whole table. The new code did about 14 integer operations.

---

## 5. The new `generate_solutions`

```python
for i, word in enumerate(self.grid):
    bits = self.matching_words(word, strict=True)
    if bits == 0:
        return                                  # this assignment has a dead row
    num_solutions *= popcount(bits)             # how many words fit this row
    while bits:                                 # visit every word in the set
        lowest_bit = bits & -bits
        w = lowest_bit.bit_length() - 1
        if self.word_points[w] > best_points[i]:
            best_points[i] = self.word_points[w]
            best_words[i] = self.words[w]
        bits ^= lowest_bit
```

**Counting** is `popcount(bits)`. It used to be `len(cursor.fetchall())`, which built a Python tuple for every row. `popcount` uses `int.bit_count()` (Python 3.10+) and falls back to `bin(bits).count("1")` on older Pythons. The server's Python version is unknown, so the fallback keeps it safe.

**Finding the best word** still has to look at every word in the set, because points vary by word. The loop walks the 1-bits from lowest to highest with a classic trick:

- `bits & -bits` isolates the **lowest 1-bit**. In two's complement, `-bits` is "flip every bit, then add 1". The add-1 carries through the trailing 0s (which became 1s) and stops exactly at the lowest 1 (which became 0, then 1 again). Every bit above it is flipped relative to `bits`, so ANDing them leaves only that one bit.
  Example: `bits = 101100`, `-bits = …010100`, `bits & -bits = 000100`.
- `.bit_length() − 1` turns that single bit into its position: `000100` has bit length 3, so it's word number 2.
- `bits ^= lowest_bit` turns that bit off, and the loop continues with the next one.

The loop runs once per matching word, so it costs about what the old `fetchall` loop did. But it no longer builds strings or tuples, and point values are precomputed in `word_points`.

---

## 6. Why the output is byte-for-byte identical

1. **Same random calls in the same order.** `generate_constraints`, `generate`, and the threshold loop are untouched, so a given random seed produces the same layouts.
2. **Same search order.** `find_solution` is untouched: colors 1→4, letters a→z, the same pruning rule, so the same leaves are visited.
3. **Same sets at every check.** `matching_words` applies exactly the same equal / not-equal conditions as the SQL `WHERE` clauses.
4. **Same tie-breaking for the best word.** The old code kept the *first* highest-scoring word in the order SQLite returned rows. That's row-id order, which is `words.txt` order, because `db.py` inserts in file order. The new loop visits bits from lowest to highest, which is also `words.txt` order, and keeps the first maximum (strict `>`).

Checked: 10 dates × 2 modes, each with the same seed passed to the original (from git `HEAD`) and the new generator. **20/20 JSON files were identical.**

One subtle difference makes the new version *more* correct. The old generator read `database.db`, which only matched `words.txt` if you remembered to re-run `scripts/db.py` after editing the word list. The new one reads `words.txt` directly, so the generator and the website (which also serves `words.txt`) can never disagree about what counts as a word.

---

## 7. Other small changes in `generate_game.py`
- **Removed:** `sqlite3`, `db_path`, the connection and `__del__`, both query builders, and `self.solutions` (a list of every solution object that was built up but only used by commented-out code; dropping it saves memory).
- **Atomic writes:** the JSON is written to `MMDDYYYY.json.tmp` and then `os.replace`d into place. Generation now happens on the live server, so this guarantees Flask never reads a half-written puzzle.
- **Shared helpers:**
  - `MODES = {"speed": 10, "score": 9}`, so the colored-tile counts live in one place.
  - `game_path(mode, game_id)`.
  - `generate_day(date)`, which makes both modes for one date.
- The `__main__` date-range loop still works exactly as before if you ever want to generate a range by hand.
- `database.db` and `scripts/db.py` are no longer needed for generation. They're left in place; delete them whenever you like.

---

## 8. The new process: the server makes its own puzzles

### `scripts/ensure_games.py`
```bash
env/bin/python scripts/ensure_games.py            # today (Eastern) + next 30 days
env/bin/python scripts/ensure_games.py --days 60  # further ahead
```
- It looks at today plus N days, using the same Eastern-time day boundary as `app.py`. It generates **only** the mode/date files that don't exist yet.
- It **never overwrites** an existing game, so a puzzle someone may already have played can't change.
- If nothing is missing, it prints one line and exits. It's safe to run any number of times.
- Run it from the repo root, like everything else.

### Nightly cron on the server
`deploy.sh` now installs this crontab line for root (idempotently: it replaces any older `ensure_games` line rather than adding duplicates):
```
15 3 * * * cd /srv/constrainbow && env/bin/python scripts/ensure_games.py >> generate.log 2>&1
```
That's 3:15 server time every night. With a 30-day buffer, the site keeps working for a month even if the job breaks, and there's no need to worry about the exact timezone. Output goes to `/srv/constrainbow/generate.log` on the server.

A night's run normally generates 2 puzzles (one new day) in well under a second, even on the $6 droplet. The first run fills the whole buffer in about 10–20 s.

### What `deploy.sh` does with games now
1. Copies `scripts/generate_game.py` and `scripts/ensure_games.py` to the server.
2. `rsync --ignore-existing` **up**: sends any games the server doesn't have yet (for example, games generated locally by hand).
3. `rsync --ignore-existing` **down**: pulls the games the server generated into your local `games/`, so your local copy stays a full archive.
4. Runs `ensure_games.py` once on the server, then installs or refreshes the cron line and prints it so you can see it's there.

`--ignore-existing` in both directions means a game file is never replaced once it exists anywhere. Previously, `rsync -avz ./games/` would overwrite the server's copy with yours.

### Day-to-day
- **Nothing to do monthly any more.**
- To check on it: `ssh root@constrainbow.com 'tail /srv/constrainbow/generate.log; crontab -l'`.
- **Word-list changes:** deploy the new `words.txt` as usual. Puzzles generated from then on use it. Already-generated puzzles (up to 30 days ahead) keep their old counts, so run `scripts/recount_games.py` (recounts speed/score from today on, layouts unchanged) and `scripts/check_solve_unique.py --fix` (remakes upcoming SOLVE days that are no longer unique), then copy the changed files to the server. Done on 2026-11-16 after the word list grew to 2,531; the explanation below uses the old 2,451-word list for its numbers.

### Requirements on the server
- Python 3.9+ in `/srv/constrainbow/env`. `zoneinfo` needs 3.9, and `app.py` already uses it, so this is already true.
- No new packages: only the standard library.
