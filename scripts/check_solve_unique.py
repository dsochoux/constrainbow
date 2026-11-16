"""Checks that every SOLVE puzzle still has exactly one solution against word_files/words.txt.

Adding words to words.txt can give an existing puzzle a second solution. Run this from the repo
root after changing the word list:
    env/bin/python scripts/check_solve_unique.py          # report only
    env/bin/python scripts/check_solve_unique.py --fix    # also regenerate broken days after today

--fix only remakes days that haven't happened yet (Eastern time), since players may have already seen
today's and earlier puzzles. A remade day also has to replace the server's copy, because deploy.sh
never overwrites an existing game.
"""
import argparse
import glob
import json
import os
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(__file__))
from generate_unique import UniqueGame, generate_solve_day, SOLVE_FOLDER, TEST_BATCH_FOLDER


def count_solutions(puzzle):
    """the number of solutions this puzzle has with today's words.txt (stops counting at 2)"""
    game = UniqueGame(puzzle["solution"])
    # every tile of color c holds the same letter, so read each color's letter off the answer
    color_letters = [None] * 4
    for row, word in zip(puzzle["grid"], puzzle["solution"]):
        for color, letter in zip(row, word):
            if color:
                color_letters[color - 1] = letter
    game.set_layout(color_letters)
    if game.grid != puzzle["grid"]:
        raise ValueError("the layout doesn't match the answer")
    game.givens = {(row, position): letter for row, position, letter in puzzle["givens"]}
    return game.count(cap=1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--fix", action="store_true", help="regenerate broken days that haven't happened yet")
    args = parser.parse_args()

    today = datetime.now(ZoneInfo("America/New_York")).strftime("%Y%m%d")
    broken = []
    paths = sorted(glob.glob(f"{SOLVE_FOLDER}/*.json")) + sorted(glob.glob(f"{TEST_BATCH_FOLDER}/*.json"))
    for path in paths:
        with open(path, "r") as f:
            puzzle = json.load(f)
        if count_solutions(puzzle) > 1:
            broken.append(path)
            print(f"NOT UNIQUE: {path} ({' '.join(puzzle['solution'])})")
    print(f"checked {len(paths)} puzzles, {len(broken)} not unique")

    if args.fix:
        for path in broken:
            if os.path.dirname(path) != SOLVE_FOLDER:
                print(f"skipping {path}: remake the test batch with generate_unique.py --test-batch")
                continue
            game_id = os.path.basename(path)[:-5]
            date = datetime.strptime(game_id, "%m%d%Y")
            if date.strftime("%Y%m%d") <= today:
                print(f"skipping {path}: that day has already started")
                continue
            puzzle = generate_solve_day(date)
            print(f"remade {path}: {' '.join(puzzle['solution'])}")
