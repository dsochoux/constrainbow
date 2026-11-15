# Makes sure games exist for today and the next few days, generating only the missing ones.
# Safe to run as often as you like; if nothing is missing it does nothing.
#
# Run from the repo root:
#   env/bin/python scripts/ensure_games.py            # today + next 30 days
#   env/bin/python scripts/ensure_games.py --days 60  # today + next 60 days
#
# On the server, cron runs this once a day (see docs/generation-algorithm.md).
import argparse
import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from generate_game import MODES, Game, game_path

eastern = ZoneInfo("America/New_York") # same day boundary as app.py


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=30, help="how many days ahead to fill (default 30)")
    args = parser.parse_args()

    today = datetime.now(eastern).replace(tzinfo=None)
    num_generated = 0
    for i in range(args.days + 1):
        date = today + timedelta(days=i)
        game_id = date.strftime("%m%d%Y")
        for mode, num_colored in MODES.items():
            if os.path.exists(game_path(mode, game_id)):
                continue # never overwrite a game that already exists
            Game(date, mode, num_colored).generate()
            num_generated += 1
            print(f"{datetime.now(eastern):%Y-%m-%d %H:%M:%S} generated {mode} game for {date:%m/%d/%Y}", flush=True)

    if num_generated == 0:
        print(f"{datetime.now(eastern):%Y-%m-%d %H:%M:%S} all games through "
              f"{today + timedelta(days=args.days):%m/%d/%Y} already exist", flush=True)


if __name__ == "__main__":
    main()
