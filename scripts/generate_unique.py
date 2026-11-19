"""Single-solution puzzles, built answer first.

Run from the repo root:
    env/bin/python scripts/generate_unique.py --words ghost crypt witch skull     (try a puzzle from your words)
    env/bin/python scripts/generate_unique.py --day 2026-12-25                  (make one day's SOLVE puzzle)
    env/bin/python scripts/generate_unique.py --pool robin eagle heron stork crane --day 2026-12-06
                                         (try every set of four themed words for that day)
    env/bin/python scripts/generate_unique.py --test-batch                      (the SOLVE test batch)
Daily puzzles are normally made by scripts/ensure_games.py (the nightly cron), which calls generate_solve_day.

How a puzzle is made (see docs/findings.md, "Single-solution mode"):
1. Start from the 4 answer words.
2. A color's letter can never sit on a black tile, so once we pick which 4 letters are the colors,
   the layout is forced: every place a color letter appears gets that color. We try every choice
   of 4 letters that appear at least twice, and drop layouts that fail the filter.
3. The layout alone always has many solutions, so we fill in black tiles with their letter from
   the answer ("given" letters), one at a time, always picking the tile that leaves the fewest
   solutions, until only the answer is left.
4. If that took fewer than the target number of letters, add more, in the row a player is most
   likely to be stuck on (the row that fits the most words on its own).

Counting reuses Game from generate_game.py: same backtracking over color letters, same bitsets.
Uniqueness is checked against every word in words.txt, the same list the website accepts.
Answers come only from word_files/common_words.txt (everyday words, nothing offensive; built by
scripts/build_common_words.py).

Each puzzle also gets a difficulty estimate (see UniqueGame.difficulty), used to order the batch.
"""
import argparse
import itertools
import json
import os
import random
import re
from collections import Counter
from datetime import datetime, timedelta

from generate_game import Game, popcount

TARGET_GIVENS = 5   # top up to this many given letters
MAX_GIVENS = 7      # automatic puzzles that need more than this are thrown away
MAX_GIVENS_PER_ROW = 2
MIN_COLORED = 9     # layout filter: at least this many colored tiles
NUM_LAYOUTS_TO_TRY = 6  # only the layouts with the fewest solutions get the (slower) given-letter search
COMMON_WORDS_PATH = "word_files/common_words.txt"

# daily SOLVE puzzles (decided after the first play-test, see docs/findings.md)
DAILY_GIVENS = 5        # always exactly 5 given letters
NO_REPEAT_DAYS = 90     # an answer word isn't used again within this many days (either side)
SOLVE_FOLDER = "games/solve"
TEST_BATCH_FOLDER = "games/solve-test"
# optional hand-picked answers per day: {"2027-10-31": ["ghost", ...]}, or with a clue shown above the board
# and emojis that fall instead of confetti when the puzzle is solved:
#   {"2026-11-26": {"words": ["stuff", ...], "clue": "Happy Thanksgiving!", "emoji": "🦃"}}
# ("emoji" can also be a list, like ["🦃", "🥧"], and the falling emojis cycle through it)
# and "title": a message of exactly 12 characters (a space leaves a tile empty) that the CONSTRAINBOW title
# turns into when the puzzle is solved, like "HAPPYNEWYEAR"
THEMES_PATH = "word_files/solve_themes.json"
TITLE_LENGTH = 12  # a theme's "title" replaces the 12 letters of CONSTRAINBOW


def solve_path(game_id):
    return f"{SOLVE_FOLDER}/{game_id}.json"


def load_common_words():
    with open(COMMON_WORDS_PATH, "r") as f:
        return [line.strip() for line in f if line.strip()]


# the easter-egg words (a row that spells one does something special) are read straight from the game's
# code, where each is a `word === '...'` line in Word.setRowState, so this list can't fall behind when an
# egg is added. deploy.sh copies word.js to the server, which makes its own puzzles
EGG_WORDS_PATH = "project/static/js/word.js"


def load_egg_words():
    if not os.path.exists(EGG_WORDS_PATH):
        print(f"WARNING: {EGG_WORDS_PATH} is missing, so a SOLVE puzzle could get two easter-egg words", flush=True)
        return set()
    with open(EGG_WORDS_PATH, "r") as f:
        return set(re.findall(r"word === '([a-z]+)'", f.read()))


class TooManySolutions(Exception):
    pass


class UniqueGame(Game):

    def __init__(self, answer):
        # Game.__init__ needs a date; a unique puzzle doesn't, so set up the same state by hand
        self.answer = [word.lower() for word in answer]
        self.constraints = [i + 1 for i in range(4)]
        self.constraint_assignments = ['' for _ in range(len(self.constraints))]
        self.set_vars()
        if Game.words is None:
            Game.build_index()
        self.givens = {}   # (row, position) -> letter, for black tiles that start filled in
        self.cap = None    # stop counting once the count goes past this
        self.failure = ""  # why build() returned None

    # ---- counting ----

    def set_layout(self, color_letters):
        # color_letters[i] is the letter of color i + 1; every tile holding it gets that color
        self.color_letters = list(color_letters)
        self.grid = [[self.color_letters.index(ch) + 1 if ch in self.color_letters else 0 for ch in word]
                     for word in self.answer]
        self.givens = {}

    # the words that fit row i: Game's check, plus every given letter in the row must match
    def row_matches(self, i, strict):
        bits = self.matching_words(self.grid[i], strict)
        for (row, position), letter in self.givens.items():
            if row == i:
                bits &= self.index[position][letter]
        return bits

    def is_solution_for(self, i):
        return self.row_matches(i, strict=False) != 0

    # called by Game.find_solution once every color has a letter; only counts (no best score needed)
    def generate_solutions(self):
        num_solutions = 1
        for i in range(len(self.grid)):
            bits = self.row_matches(i, strict=True)
            if bits == 0:
                return
            num_solutions *= popcount(bits)
        self.num_solutions += num_solutions
        if self.cap is not None and self.num_solutions > self.cap:
            raise TooManySolutions()

    def count(self, cap=None):
        # a given letter sits on a black tile, so no color can use it: leave it out of the search
        # (find_solution loops over self.alphabet, so an instance copy without those letters is enough)
        given_letters = set(self.givens.values())
        self.alphabet = tuple(letter for letter in Game.alphabet if letter not in given_letters)
        self.num_solutions = 0
        self.constraint_assignments = ['' for _ in range(len(self.constraints))]
        self.cap = cap
        try:
            self.find_solution(1)
        except TooManySolutions:
            pass
        self.cap = None
        return self.num_solutions

    # ---- layout filter ----

    def colored_count(self):
        return sum(1 for row in self.grid for c in row if c != 0)

    def passes_filter(self):
        if self.colored_count() < MIN_COLORED:
            return False
        for i, row in enumerate(self.grid):
            colors = {c for c in row if c != 0}
            if not colors:
                return False  # a row with no color
            # every row must share at least one color with another row, so no row is cut off
            other_colors = {c for j, other in enumerate(self.grid) if j != i for c in other if c != 0}
            if not colors & other_colors:
                return False
        return True

    # ---- given letters ----

    def can_give(self, row, position):
        if self.grid[row][position] != 0 or (row, position) in self.givens:
            return False
        givens_in_row = sum(1 for (r, _) in self.givens if r == row)
        blacks_in_row = self.grid[row].count(0)
        # at most 2 per row, and never every black tile in a row
        return givens_in_row < MAX_GIVENS_PER_ROW and givens_in_row + 1 < blacks_in_row

    def add_givens_until_unique(self):
        """greedy: keep filling in the black tile that leaves the fewest solutions.
        returns the number of solutions left (1 means it worked)"""
        current = self.count()
        while current > 1:
            best = None
            for row in range(4):
                for position in range(5):
                    if not self.can_give(row, position):
                        continue
                    self.givens[(row, position)] = self.answer[row][position]
                    n = self.count(cap=best[0] if best else current)
                    del self.givens[(row, position)]
                    if best is None or n < best[0]:
                        best = (n, row, position)
            if best is None:
                return current  # no tile left that the placement rules allow
            current, row, position = best
            self.givens[(row, position)] = self.answer[row][position]
        return current

    # how many words fit row i if you only look at that row (what a player sees before
    # working out any colors): givens must match, same color = same letter, different
    # colors = different letters, and black tiles can't use the row's color letters
    def row_candidates(self, i):
        row = self.grid[i]
        total = 0
        for word in self.words:
            color_to_letter = {}
            ok = True
            for position, c in enumerate(row):
                letter = word[position]
                given = self.givens.get((i, position))
                if given is not None and letter != given:
                    ok = False
                    break
                if c != 0:
                    if color_to_letter.setdefault(c, letter) != letter:
                        ok = False
                        break
            if not ok:
                continue
            color_letters = set(color_to_letter.values())
            if len(color_letters) != len(color_to_letter):
                continue  # two colors with the same letter
            if any(c == 0 and word[p] in color_letters for p, c in enumerate(row)):
                continue
            total += 1
        return total

    def top_up_givens(self, target):
        while len(self.givens) < target:
            best = None
            # the row that fits the most words on its own is where a player is most likely stuck
            for row in sorted(range(4), key=self.row_candidates, reverse=True):
                for position in range(5):
                    if not self.can_give(row, position):
                        continue
                    self.givens[(row, position)] = self.answer[row][position]
                    n = self.row_candidates(row)
                    del self.givens[(row, position)]
                    if best is None or n < best[0]:
                        best = (n, row, position)
                if best is not None:
                    break
            if best is None:
                return False
            self.givens[(best[1], best[2])] = self.answer[best[1]][best[2]]
        return True

    # ---- difficulty ----

    def difficulty(self):
        """A rough difficulty estimate, made by imitating a careful player. They look at each row on
        its own, using every letter they know so far (givens, plus any color they've worked out):
          - if every word that fits a row agrees on a color's letter, that color is now known
          - repeat until nothing new is learned
        Returns (passes, remaining): remaining is how many full boards are still possible when the
        player runs out of easy deductions (the product of each row's candidate count; 1 means the
        puzzle falls out with no guessing), and passes is how many rounds of deductions it took.
        This ignores cleverer reasoning, so it ranks puzzles rather than predicting a time."""
        known = {}  # color -> letter
        given_letters = set(self.givens.values())
        passes = 0
        while True:
            passes += 1
            learned = False
            remaining = 1
            for i, row in enumerate(self.grid):
                candidates = self.row_candidates_known(i, known, given_letters)
                remaining *= max(len(candidates), 1)
                for c in {c for c in row if c != 0 and c not in known}:
                    position = row.index(c)
                    letters = {word[position] for word in candidates}
                    if len(letters) == 1:
                        known[c] = letters.pop()
                        learned = True
            if not learned:
                return passes, remaining

    # the words that fit row i, given the color letters a player knows so far
    def row_candidates_known(self, i, known, given_letters):
        row = self.grid[i]
        known_letters = set(known.values())
        result = []
        for word in self.words:
            color_to_letter = {}
            ok = True
            for position, c in enumerate(row):
                letter = word[position]
                given = self.givens.get((i, position))
                if given is not None:
                    if letter != given:
                        ok = False
                        break
                    continue
                if c == 0:
                    if letter in known_letters:
                        ok = False  # a black tile can't hold a color's letter
                        break
                    continue
                if c in known:
                    if letter != known[c]:
                        ok = False
                        break
                elif letter in known_letters or letter in given_letters:
                    ok = False  # an unknown color can't reuse a known color's letter or a given letter
                    break
                if color_to_letter.setdefault(c, letter) != letter:
                    ok = False
                    break
            if not ok:
                continue
            row_letters = list(color_to_letter.values())
            if len(set(row_letters)) != len(row_letters):
                continue  # two colors with the same letter
            if any(c == 0 and (i, p) not in self.givens and word[p] in row_letters for p, c in enumerate(row)):
                continue  # a black tile using this row's color letter
            result.append(word)
        return result

    # ---- putting it together ----

    def build(self, target=TARGET_GIVENS, max_givens=MAX_GIVENS, rng=random):
        """tries every choice of color letters; returns a puzzle dict, or None if nothing works"""
        letter_counts = Counter(''.join(self.answer))
        repeated = sorted(letter for letter, n in letter_counts.items() if n >= 2)
        layouts = []
        for color_letters in itertools.combinations(repeated, 4):
            self.set_layout(color_letters)
            if self.passes_filter():
                layouts.append((self.count(), color_letters))
        layouts.sort()
        if not layouts:
            self.failure = (f"no layout passes the filter: these words share only {len(repeated)} repeated "
                            f"letters ({', '.join(repeated).upper() or 'none'}), and a layout needs 4 of them "
                            f"covering at least {MIN_COLORED} tiles with every row linked to another")
            return None

        best = None
        for num_solutions, color_letters in layouts[:NUM_LAYOUTS_TO_TRY]:
            self.set_layout(color_letters)
            if self.add_givens_until_unique() != 1:
                continue
            if best is None or len(self.givens) < len(best[1]):
                best = (color_letters, dict(self.givens), num_solutions)
        if best is None:
            self.failure = (f"{len(layouts)} layouts pass the filter, but none can be made unique with given "
                            f"letters on black tiles (at most {MAX_GIVENS_PER_ROW} per row)")
            return None
        if len(best[1]) > max_givens:
            self.failure = f"needs {len(best[1])} given letters, more than the limit of {max_givens}"
            return None

        color_letters, givens, layout_solutions = best
        # shuffle which color (red, orange, ...) each letter gets, so colors vary between puzzles
        color_letters = list(color_letters)
        rng.shuffle(color_letters)
        self.set_layout(color_letters)
        self.givens = givens
        min_givens = len(givens)
        if not self.top_up_givens(target):
            self.failure = f"can't place {target} given letters within the placement rules"
            return None
        assert self.count() == 1  # adding letters can only remove solutions, but check anyway
        passes, remaining = self.difficulty()

        constraints = [[] for _ in range(len(self.constraints) + 1)]
        for i, row in enumerate(self.grid):
            for j, c in enumerate(row):
                constraints[c].append([i, j])
        return {
            "grid": self.grid,
            "constraints": constraints,
            "givens": [[r, p, letter] for (r, p), letter in sorted(self.givens.items())],
            "solution": self.answer,
            "num_givens": len(self.givens),
            "min_givens": min_givens,
            "layout_solutions": layout_solutions,  # solutions before any letters were given
            "difficulty": {"remaining": remaining, "passes": passes},  # see UniqueGame.difficulty
            "num_possible_solutions": 1,
        }


def has_starter_row(puzzle):
    # at least one row starts with two given letters: a natural place to begin
    per_row = Counter(row for row, _, _ in puzzle["givens"])
    return max(per_row.values(), default=0) >= 2


def load_themes():
    if not os.path.exists(THEMES_PATH):
        return {}
    with open(THEMES_PATH, "r") as f:
        themes = json.load(f)
    # keys are written YYYY-MM-DD for people; game ids are MMDDYYYY. Each theme becomes
    # {"words": [...], "emoji": [...]}, with no emoji an empty list
    loaded = {}
    for day, theme in themes.items():
        if isinstance(theme, list):
            theme = {"words": theme}
        emoji = theme.get("emoji", [])
        title = theme.get("title", "").upper()
        if title and len(title) != TITLE_LENGTH:
            # a typo shouldn't stop the puzzle being made: warn, and leave the title out
            print(f"WARNING: the title for {day} ({title!r}) has {len(title)} characters, not {TITLE_LENGTH}; "
                  f"leaving it out", flush=True)
            title = ""
        loaded[datetime.strptime(day, "%Y-%m-%d").strftime("%m%d%Y")] = {
            "words": [w.lower() for w in theme["words"]],
            "clue": theme.get("clue", ""),
            "emoji": [emoji] if isinstance(emoji, str) else list(emoji),
            "title": title,
        }
    return loaded


def nearby_answer_words(date):
    """every answer word used by a SOLVE puzzle within NO_REPEAT_DAYS of date (before or after)"""
    words = set()
    for offset in range(-NO_REPEAT_DAYS, NO_REPEAT_DAYS + 1):
        if offset == 0:
            continue
        path = solve_path((date + timedelta(days=offset)).strftime("%m%d%Y"))
        if os.path.exists(path):
            with open(path, "r") as f:
                words.update(json.load(f)["solution"])
    return words


def write_puzzle(path, puzzle):
    # write to a temporary file, then rename it into place, so the web server never reads half a file
    os.makedirs(os.path.dirname(path), exist_ok=True)
    temp_path = path + ".tmp"
    with open(temp_path, "w") as f:
        json.dump(puzzle, f, indent=4)
    os.replace(temp_path, path)


def generate_solve_day(date):
    """makes the SOLVE puzzle for one day: 5 given letters, a starter row, common answer words not used
    nearby, or the hand-picked words from solve_themes.json for that day. Seeded by the date, so
    running it again for the same day (with the same neighbours) gives the same puzzle."""
    if Game.words is None:
        Game.build_index()
    game_id = date.strftime("%m%d%Y")
    rng = random.Random(int(game_id))

    theme = load_themes().get(game_id)
    if theme is not None:
        game = UniqueGame(theme["words"])
        puzzle = game.build(target=DAILY_GIVENS, max_givens=DAILY_GIVENS, rng=rng)
        if puzzle is not None and puzzle["num_givens"] == DAILY_GIVENS and has_starter_row(puzzle):
            puzzle["theme"] = True
            if theme["clue"]:
                puzzle["clue"] = theme["clue"]
            if theme["emoji"]:
                puzzle["emoji"] = theme["emoji"]
            if theme["title"]:
                puzzle["title"] = theme["title"]
            write_puzzle(solve_path(game_id), puzzle)
            return puzzle
        # never leave a day without a puzzle: say so loudly, then make a normal one
        print(f"WARNING: the themed words for {date:%Y-%m-%d} ({', '.join(theme['words'])}) can't make a "
              f"{DAILY_GIVENS}-letter puzzle ({game.failure or 'no starter row'}); using random words instead", flush=True)

    avoid = nearby_answer_words(date)
    candidates = [word for word in load_common_words() if word not in avoid]
    egg_words = load_egg_words()
    while True:
        answer = rng.sample(candidates, 4)
        # at most one easter-egg word per puzzle, so each day has at most one to discover (themed days,
        # above, are hand-picked and exempt)
        if sum(word in egg_words for word in answer) > 1:
            continue
        puzzle = UniqueGame(answer).build(target=DAILY_GIVENS, max_givens=DAILY_GIVENS, rng=rng)
        if puzzle is not None and puzzle["num_givens"] == DAILY_GIVENS and has_starter_row(puzzle):
            write_puzzle(solve_path(game_id), puzzle)
            return puzzle


def try_pool(words, date):
    """tries every set of four from a pool of themed words for one day, exactly the way
    generate_solve_day will make that day's puzzle (same date seed), and prints the sets that work"""
    if Game.words is None:
        Game.build_index()
    words = list(dict.fromkeys(word.lower() for word in words))  # no repeats, in the order given
    missing = [word for word in words if word not in Game.words]
    if missing:
        raise SystemExit(f"not in words.txt (players couldn't type them): {', '.join(missing)}")
    if len(words) < 4:
        raise SystemExit("the pool needs at least 4 words")
    game_id = date.strftime("%m%d%Y")
    common = set(load_common_words())
    nearby = nearby_answer_words(date)
    sets = list(itertools.combinations(words, 4))
    print(f"trying {len(sets)} sets of four for {date:%Y-%m-%d} (a few seconds each)...\n", flush=True)
    working = []
    for i, answer in enumerate(sets, 1):
        puzzle = UniqueGame(list(answer)).build(target=DAILY_GIVENS, max_givens=DAILY_GIVENS,
                                                rng=random.Random(int(game_id)))
        if puzzle is None or puzzle["num_givens"] != DAILY_GIVENS or not has_starter_row(puzzle):
            continue
        working.append(puzzle)
        print(f"{len(working)}. {' '.join(answer).upper()}   (set {i} of {len(sets)})")
        show(puzzle)
        uncommon = [word for word in answer if word not in common]
        if uncommon:
            print(f"   not on the small list: {', '.join(uncommon)}")
        repeats = [word for word in answer if word in nearby]
        if repeats:
            print(f"   already an answer within {NO_REPEAT_DAYS} days: {', '.join(repeats)} "
                  f"(that day would need remaking)")
        print(flush=True)
    if not working:
        print("none of these sets work for this day; try more words, or words that share more letters")
        return
    print(f"{len(working)} of {len(sets)} sets work. To use one, add it to {THEMES_PATH}, e.g.")
    print(f'    "{date:%Y-%m-%d}": {{"words": {json.dumps(working[0]["solution"])}, "clue": "...", "emoji": "..."}}')
    print(f"then make the puzzle with --day {date:%Y-%m-%d} and play it at /solve/day?d={date:%Y-%m-%d}")


def show(puzzle):
    # colors as lowercase r/o/y/b, given letters in capitals, empty black tiles as ·
    names = "·royb"
    givens = {(r, p): letter for r, p, letter in puzzle["givens"]}
    for i, row in enumerate(puzzle["grid"]):
        tiles = [givens[(i, p)].upper() if (i, p) in givens else names[c] for p, c in enumerate(row)]
        print("   " + " ".join(tiles) + f"     {puzzle['solution'][i].upper()}")
    print(f"   {puzzle['num_givens']} given letters (minimum {puzzle['min_givens']}), "
          f"{puzzle['layout_solutions']:,} solutions before any were given, "
          f"difficulty: {puzzle['difficulty']['remaining']:,} left after easy deductions "
          f"({puzzle['difficulty']['passes']} passes)")


# The SOLVE test batch: four puzzles each at 3, 5 and 7 given letters, answers from the common word
# list, numbered from easiest to hardest by the difficulty estimate.
TEST_BATCH_TARGETS = [3, 5, 7] * 4


def difficulty_key(puzzle):
    # fewer boards left after the easy deductions is easier; ties go to the puzzle that gives more letters
    return (puzzle["difficulty"]["remaining"], -puzzle["num_givens"], puzzle["difficulty"]["passes"])


def make_test_batch(seed=2026):
    Game.build_index()
    common = load_common_words()
    puzzles = []
    used = set()
    for number, target in enumerate(TEST_BATCH_TARGETS, start=1):
        rng = random.Random(seed * 100 + number)
        while True:
            answer = rng.sample(common, 4)
            if used & set(answer):
                continue  # don't repeat an answer word within the batch
            # max_givens=target: the minimum must not be above the target, or it can't be made at that level
            puzzle = UniqueGame(answer).build(target=target, max_givens=target, rng=rng)
            if puzzle is not None and puzzle["num_givens"] == target:
                break
        used |= set(answer)
        puzzles.append(puzzle)

    puzzles.sort(key=difficulty_key)
    folder = TEST_BATCH_FOLDER
    os.makedirs(folder, exist_ok=True)
    for name in os.listdir(folder):
        if name.endswith(".json"):
            os.remove(os.path.join(folder, name))
    for number, puzzle in enumerate(puzzles, start=1):
        path = f"{folder}/{number:02d}.json"
        write_puzzle(path, puzzle)
        print(f"{path}:")
        show(puzzle)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--words", nargs=4, help="the four answer words")
    parser.add_argument("--target", type=int, default=TARGET_GIVENS, help="top up to this many given letters")
    parser.add_argument("--out", help="write the puzzle JSON here")
    parser.add_argument("--test-batch", action="store_true", help="write the SOLVE test batch to games/solve-test/")
    parser.add_argument("--day", help="make the daily SOLVE puzzle for this date (YYYY-MM-DD), replacing any existing one")
    parser.add_argument("--pool", nargs="+", help="themed words to try in every set of four (with --day)")
    parser.add_argument("--allow-uncommon", action="store_true",
                        help="let --words use words that aren't in common_words.txt")
    args = parser.parse_args()

    if args.test_batch:
        make_test_batch()
    elif args.pool:
        if not args.day:
            raise SystemExit("--pool needs --day YYYY-MM-DD: the date decides how the letters are placed")
        try_pool(args.pool, datetime.strptime(args.day, "%Y-%m-%d"))
    elif args.day:
        date = datetime.strptime(args.day, "%Y-%m-%d")
        puzzle = generate_solve_day(date)
        print(f"{solve_path(date.strftime('%m%d%Y'))}:")
        show(puzzle)
    elif args.words:
        Game.build_index()
        missing = [w for w in args.words if w.lower() not in Game.words]
        if missing:
            raise SystemExit(f"not in words.txt: {', '.join(missing)}")
        uncommon = [w for w in args.words if w.lower() not in load_common_words()]
        if uncommon and not args.allow_uncommon:
            raise SystemExit(f"not in common_words.txt: {', '.join(uncommon)} "
                             f"(use --allow-uncommon if you really want them)")
        # trying out words: accept however many letters they need, and say whether they'd work as a
        # daily theme (exactly 5 letters with a starter row)
        game = UniqueGame(args.words)
        puzzle = game.build(target=args.target, max_givens=20)
        if puzzle is None:
            raise SystemExit(f"couldn't make a puzzle: {game.failure}. Try swapping a word.")
        show(puzzle)
        daily = UniqueGame(args.words).build(target=DAILY_GIVENS, max_givens=DAILY_GIVENS)
        if daily is not None and daily["num_givens"] == DAILY_GIVENS and has_starter_row(daily):
            print(f"   these words work as a daily theme: add them to {THEMES_PATH}")
        else:
            print(f"   these words can't be a daily puzzle ({DAILY_GIVENS} letters with a starter row)")
        if args.out:
            with open(args.out, "w") as f:
                json.dump(puzzle, f, indent=4)
    else:
        parser.print_help()
