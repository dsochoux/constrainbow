"""Recounts the speed and score puzzles from today on against the current word_files/words.txt.

Adding words gives a puzzle more solutions, and can raise its best possible score. This keeps each
puzzle's layout and recounts num_possible_solutions, num_possible_points and best_solution. Run it
from the repo root after changing words.txt:
    env/bin/python scripts/recount_games.py

Days before today (Eastern time) are left alone. The server never overwrites an existing game on
deploy, so the updated files have to be copied to it as well; the script prints which ones changed.
"""
import glob
import json
import os
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(__file__))
from generate_game import Game, MODES, game_path


def recount(path, mode, date):
    """recounts one puzzle file in place; returns (old, new) puzzle dicts"""
    with open(path, "r") as f:
        puzzle = json.load(f)
    game = Game(date, mode, MODES[mode])
    game.set_vars()
    game.grid = puzzle["grid"]
    game.find_solution(1)
    updated = dict(puzzle)
    updated["num_possible_solutions"] = game.num_solutions
    updated["num_possible_points"] = game.best_solution["points"]
    updated["best_solution"] = game.best_solution
    if updated != puzzle:
        # write to a temporary file, then rename it into place, so the web server never reads half a file
        temp_path = path + ".tmp"
        with open(temp_path, "w") as f:
            json.dump(updated, f, indent=4)
        os.replace(temp_path, path)
    return puzzle, updated


if __name__ == "__main__":
    today = datetime.now(ZoneInfo("America/New_York")).replace(tzinfo=None, hour=0, minute=0, second=0, microsecond=0)
    changed = []
    for mode in MODES:
        for path in sorted(glob.glob(game_path(mode, "*"))):
            date = datetime.strptime(os.path.basename(path)[:-len(".json")], "%m%d%Y")
            if date < today:
                continue
            old, new = recount(path, mode, date)
            if old == new:
                continue
            changed.append(path)
            line = (f"{mode} {date:%m/%d/%Y}: {old['num_possible_solutions']:,} -> "
                    f"{new['num_possible_solutions']:,} solutions")
            if old["num_possible_points"] != new["num_possible_points"]:
                line += f", max score {old['num_possible_points']} -> {new['num_possible_points']}"
            print(line, flush=True)
    print(f"{len(changed)} puzzles updated")
