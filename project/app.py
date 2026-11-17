from flask import Flask, render_template, jsonify, request, redirect, make_response, send_file
import os
import re
import fcntl
import json
import calendar
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

app = Flask(__name__)

# Danny's analytics dashboard (/dashboard, password-protected by nginx; see dashboard.py). app.py is
# imported as project.app under gunicorn, so make its own folder importable first
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dashboard import dashboard
app.register_blueprint(dashboard)

db_path = "database.db"
eastern = ZoneInfo("America/New_York")

words = []

emoji_overrides = {
    "0408": "🎈",
}

with open('./word_files/words.txt', 'r') as f:
    for word in f:
        words.append(word.strip())

# validation for anything that comes from a request and ends up in a file path or a file
GAME_ID_PATTERN = re.compile(r"[0-9]{8}")      # MMDDYYYY
WORD_PATTERN = re.compile(r"[a-z]{5}")         # a full word
BOARD_WORD_PATTERN = re.compile(r"[a-z-]{5}")  # a word on the board, '-' for blanks
METRIC_PATTERN = re.compile(r"[0-9:/]{1,20}")  # "0:41", "1:02:03", "64/64"
GAME_MODES = ("solve", "speed", "score")
SOLVE_TEST_ID_PATTERN = re.compile(r"[0-9]{2}")  # SOLVE test-batch puzzle "01", "02", ...
TESTER_PATTERN = re.compile(r"[0-9a-f]{8}")      # a random id each SOLVE player's browser makes up
SOLVE_TEST_FOLDER = "./games/solve-test/"

def is_valid_game(game_id, game_mode):
    return (isinstance(game_id, str) and GAME_ID_PATTERN.fullmatch(game_id) is not None
            and game_mode in GAME_MODES)

def is_list_of(value, pattern, max_length):
    return (isinstance(value, list) and len(value) <= max_length
            and all(isinstance(item, str) and pattern.fullmatch(item) for item in value))

def get_solve_test_count():
    if not os.path.isdir(SOLVE_TEST_FOLDER):
        return 0
    return len([name for name in os.listdir(SOLVE_TEST_FOLDER) if name.endswith('.json')])

def get_num_givens(path):
    # how many letters a SOLVE puzzle fills in (5 for every daily), for the description; None if missing
    try:
        with open(path, 'r') as f:
            return json.load(f)["num_givens"]
    except (OSError, ValueError, KeyError):
        return None

def get_clue(path):
    # a themed SOLVE puzzle's clue (from solve_themes.json), shown above the board; "" if none
    try:
        with open(path, 'r') as f:
            return json.load(f).get("clue", "")
    except (OSError, ValueError, AttributeError):
        return ""

def get_best_solution(game_id):
    """a score puzzle's best solution, {"points", "words"}, or None if there's no puzzle for that day"""
    try:
        with open(f"./games/score/{game_id}.json", 'r') as f:
            best = json.load(f)["best_solution"]
        return {"points": best["points"], "words": [best[f"word_{i}"] for i in range(1, 5)]}
    except (OSError, ValueError, KeyError, TypeError):
        return None

def is_small_int(value):
    return isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= 100000

def get_game_id():
    return datetime.now(eastern).strftime("%m%d%Y")

def get_date_string(game_id):
    return f"{game_id[0]}{game_id[1]}/{game_id[2]}{game_id[3]}"

# the how-to-play popup shows yesterday's SOLVE answer as its example board; this hand-picked
# board is the fallback when yesterday's puzzle is missing or unusual
FALLBACK_TUTORIAL = {
    "colors": [[2, 4, 2, 0, 0], [2, 0, 3, 0, 0], [0, 1, 3, 0, 0], [1, 0, 1, 4, 0]],
    "words": ["FIFTY", "FLASK", "SPARK", "PUPIL"],
    "date": None,
}

def letter_plural(letter):
    # "Ks", but "A's", "I's" and "U's" so they don't read as words
    return f"{letter}'s" if letter in "AIU" else f"{letter}s"

def describe_tutorial(example):
    # adds the letters the how-to-play text mentions, read off the example board
    colors, words = example["colors"], example["words"]
    color_letters = {}  # color -> letter, in reading order
    black_counts = {}   # letter -> how many black tiles hold it, in reading order
    for row, word in zip(colors, words):
        for color, letter in zip(row, word):
            if color:
                color_letters.setdefault(color, letter)
            else:
                black_counts[letter] = black_counts.get(letter, 0) + 1
    claimed = list(color_letters.values())
    shared = None
    most = max(black_counts.values(), default=0)
    if most >= 2:
        letter = next(letter for letter, count in black_counts.items() if count == most)
        number = {2: "two", 3: "three", 4: "four", 5: "five"}.get(most, str(most))
        shared = f"{number} {letter_plural(letter)}"
    return {
        **example,
        "orange": color_letters[2],
        "claimed": ", ".join(claimed[:-1]) + ", and " + claimed[-1],
        "shared": shared,
    }

def get_tutorial():
    yesterday = (datetime.now(eastern) - timedelta(days=1)).strftime("%m%d%Y")
    try:
        with open(f"./games/solve/{yesterday}.json", 'r') as f:
            puzzle = json.load(f)
        example = {
            "colors": puzzle["grid"],
            "words": [word.upper() for word in puzzle["solution"]],
            "date": get_date_string(yesterday),
        }
        # the text needs all four colors, and red and orange in particular
        if sorted({c for row in example["colors"] for c in row if c}) == [1, 2, 3, 4]:
            return describe_tutorial(example)
    except (OSError, ValueError, KeyError, TypeError, AttributeError):
        pass
    return describe_tutorial(FALLBACK_TUTORIAL)

@app.context_processor
def add_tutorial():
    # every page renders game.html, which has the how-to-play popup
    return {"tutorial": get_tutorial()}


@app.route('/')
def index():
    # SOLVE is the default mode, so / always goes there
    return redirect('/solve')

@app.route('/speed')
def speed():
    game_id = get_game_id()
    response = make_response(
        render_template(
            'game.html',
            game_id=game_id,
            game_mode="speed",
            mode_emoji=emoji_overrides.get(game_id[:4], "⏱️"),
            other_mode_emoji="🎯",
            other_mode_endpoint="/score",
            date=get_date_string(game_id)
        )
    )
    return response

@app.route('/score')
def score():
    game_id = get_game_id()
    yesterday = (datetime.now(eastern) - timedelta(days=1)).strftime("%m%d%Y")
    response = make_response(
        render_template(
            'game.html',
            game_id=game_id,
            game_mode="score",
            mode_emoji="🎯",
            other_mode_emoji = emoji_overrides.get(game_id[:4], "⏱️"),
            other_mode_endpoint = "/speed",
            date=get_date_string(game_id),
            yesterday_best=get_best_solution(yesterday),  # no secret any more, so it's in the page
        )
    )
    return response

# SOLVE: today's single-solution puzzle (see scripts/generate_unique.py)
@app.route('/solve')
def solve():
    game_id = get_game_id()
    response = make_response(
        render_template(
            'game.html',
            game_id=game_id,
            game_mode="solve",
            mode_emoji="🔑",
            other_mode_emoji=emoji_overrides.get(game_id[:4], "⏱️"),
            date=get_date_string(game_id),
            num_givens=get_num_givens(f"./games/solve/{game_id}.json"),
            clue=get_clue(f"./games/solve/{game_id}.json"),
        )
    )
    return response

# any day's SOLVE puzzle, past or future, for Danny to try out themed days before they go live:
# /solve/day?d=2026-11-26. Not linked; progress is saved apart from the daily game and nothing is logged
@app.route('/solve/day')
def solve_day():
    try:
        date = datetime.strptime(request.args.get('d', ''), "%Y-%m-%d")
    except ValueError:
        date = datetime.now(eastern)
    game_id = date.strftime("%m%d%Y")
    puzzle_path = f"./games/solve/{game_id}.json"
    if not os.path.exists(puzzle_path):
        return f"No SOLVE puzzle for {date:%Y-%m-%d}.", 404
    return render_template(
        'game.html',
        game_id=game_id,
        game_mode="solve-day",
        mode_emoji="🔑",
        other_mode_emoji=emoji_overrides.get(get_game_id()[:4], "⏱️"),
        date=f"{date.month}/{date.day}/{date.year}",
        previous_day=(date - timedelta(days=1)).strftime("%Y-%m-%d"),
        next_day=(date + timedelta(days=1)).strftime("%Y-%m-%d"),
        num_givens=get_num_givens(puzzle_path),
        clue=get_clue(puzzle_path),
    )

# ---- the archive: every past puzzle, by mode ----

MODE_EMOJI = {"solve": "🔑", "speed": "⏱️", "score": "🎯"}
# the archive starts on the same day for every mode, so each has the same number of puzzles (SOLVE was
# backfilled from here; older speed and score puzzles still exist but aren't listed)
ARCHIVE_START = datetime(2026, 11, 1).date()

def get_today():
    return datetime.now(eastern).date()

def archive_days(mode):
    """every day from ARCHIVE_START up to (not including) today that has a puzzle in this mode, as dates"""
    folder = f"./games/{mode}/"
    days = []
    for name in os.listdir(folder):
        if not name.endswith(".json") or GAME_ID_PATTERN.fullmatch(name[:-len(".json")]) is None:
            continue
        day = datetime.strptime(name[:-len(".json")], "%m%d%Y").date()
        if ARCHIVE_START <= day < get_today():
            days.append(day)
    return sorted(days)

@app.route('/archive')
def archive_index():
    return redirect('/archive/solve')

# a month of past puzzles as a calendar; ?m=YYYY-MM picks the month (default: this month)
@app.route('/archive/<mode>')
def archive_calendar(mode):
    if mode not in GAME_MODES:
        return '', 404
    days = archive_days(mode)
    today = get_today()
    try:
        month = datetime.strptime(request.args.get('m', ''), "%Y-%m").date()
    except ValueError:
        month = today.replace(day=1)
    month = min(max(month, ARCHIVE_START.replace(day=1)), today.replace(day=1))
    available = {day for day in days if (day.year, day.month) == (month.year, month.month)}
    # Sunday-first weeks, each day None (padding) or (date, state): "puzzle", "today", or "none"
    weeks = []
    for week in calendar.Calendar(firstweekday=6).monthdatescalendar(month.year, month.month):
        weeks.append([None if day.month != month.month else
                      (day, "puzzle" if day in available else "today" if day == today else "none")
                      for day in week])
    previous_month = (month.replace(day=1) - timedelta(days=1)).replace(day=1)
    next_month = (month.replace(day=28) + timedelta(days=4)).replace(day=1)
    return render_template(
        'archive.html',
        mode=mode,
        mode_emoji=MODE_EMOJI[mode],
        month_name=month.strftime("%B %Y"),
        weeks=weeks,
        # only months with puzzles before them / up to this month can be visited
        previous_month=previous_month.strftime("%Y-%m") if days and previous_month >= days[0].replace(day=1) else None,
        next_month=next_month.strftime("%Y-%m") if next_month <= today.replace(day=1) else None,
        count=len(days),
    )

# one past puzzle: the normal game page for that mode, saved apart from today's and not logged
@app.route('/archive/<mode>/<day>')
def archive_puzzle(mode, day):
    if mode not in GAME_MODES:
        return '', 404
    try:
        date = datetime.strptime(day, "%Y-%m-%d").date()
    except ValueError:
        return '', 404
    if date >= get_today():
        return redirect(f'/{mode}')  # today's (or a future) puzzle isn't in the archive
    if date < ARCHIVE_START:
        return redirect(f'/archive/{mode}')
    game_id = date.strftime("%m%d%Y")
    puzzle_path = f"./games/{mode}/{game_id}.json"
    if not os.path.exists(puzzle_path):
        return '', 404
    days = archive_days(mode)
    earlier = [d for d in days if d < date]
    later = [d for d in days if d > date]
    return render_template(
        'game.html',
        game_id=game_id,
        game_mode=mode,
        is_archive=True,
        mode_emoji=MODE_EMOJI[mode],
        other_mode_emoji=emoji_overrides.get(get_game_id()[:4], "⏱️"),
        date=f"{date.month}/{date.day}/{date.year}",
        previous_day=earlier[-1].strftime("%Y-%m-%d") if earlier else None,
        next_day=later[0].strftime("%Y-%m-%d") if later else None,
        num_givens=get_num_givens(puzzle_path) if mode == "solve" else None,
        clue=get_clue(puzzle_path) if mode == "solve" else "",
    )

# the numbered batch of SOLVE puzzles from the first play-test (games/solve-test/); not linked
@app.route('/solve/test')
def solve_test():
    count = get_solve_test_count()
    try:
        number = int(request.args.get('p', '1'))
    except ValueError:
        number = 1
    if count == 0:
        return "No SOLVE test puzzles.", 404
    number = max(1, min(number, count))
    game_id = f"{number:02d}"
    return render_template(
        'game.html',
        game_id=game_id,
        game_mode="solve-test",
        mode_emoji="🔑",
        other_mode_emoji=emoji_overrides.get(get_game_id()[:4], "⏱️"),
        puzzle_number=number,
        puzzle_count=count,
        num_givens=get_num_givens(os.path.join(SOLVE_TEST_FOLDER, game_id + '.json')),
    )

# returns a game based on the query parameter game-id
# if no game-id is provided, redirect to the index, which will give a random game
@app.route('/game')
def game():
    global words
    
    try:
        # game id in hidden input supplied by /
        game_id = request.args.get("game-id", datetime.now(eastern).strftime("%m%d%Y")) # should never fall back to this, but just in case
        game_mode = request.args.get("game-mode", "speed")
        is_solve_test = game_mode == "solve-test" and SOLVE_TEST_ID_PATTERN.fullmatch(game_id) is not None
        if game_mode == "solve-day": # /solve/day: a daily SOLVE puzzle from another day
            game_mode = "solve"
        if not is_valid_game(game_id, game_mode) and not is_solve_test:
            return '', 404
        selected_game_file = game_id + '.json'
        
        # convert the json file to a dictionary
        generated_game_folder = SOLVE_TEST_FOLDER if is_solve_test else f"./games/{game_mode}/"
        file_path = os.path.join(generated_game_folder, selected_game_file)
        with open(file_path, 'r') as f:
            game_object = json.load(f)

        if game_mode in ("solve", "solve-test"):
            # SOLVE puzzles have one answer; the client needs it for the REVEAL button
            return jsonify({
                "game_id": game_id,
                "constraints": game_object["constraints"],
                "grid": game_object["grid"],
                "givens": game_object["givens"],
                "solution": game_object["solution"],
                "emoji": game_object.get("emoji", []),  # themed days: emojis that fall instead of confetti
                "num_possible_solutions": 1,
                "num_possible_points": 0,
                "words": words
            })

        return jsonify({
            "game_id": game_id,
            "constraints": game_object["constraints"],
            "grid": game_object["grid"],
            "num_possible_solutions": game_object["num_possible_solutions"],
            "num_possible_points": game_object["num_possible_points"],
            "words": words
        })
    except:
        return '', 404

@app.route('/report-missing-word', methods=['POST'])
def report():
    data = request.get_json(silent=True) or {}
    words = data.get('words')
    if not is_list_of(words, WORD_PATTERN, 4):
        return '', 400
    # add words to text file
    with open('./word_files/reported_missing_words.txt', 'a') as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        for word in words:
            f.write(word + '\n')
        fcntl.flock(f, fcntl.LOCK_UN)  
    return '', 200 # will never actually be used

# a score puzzle's best solution, for SHOW BEST after a player finishes today's puzzle. Never for a
# day that hasn't started yet (Eastern time), so tomorrow's answer can't be looked up early. This only
# keeps the answer out of the page; anyone can still ask for today's (scores aren't checked anyway)
@app.route('/best-solution')
def best_solution():
    game_id = request.args.get("game-id", "")
    if GAME_ID_PATTERN.fullmatch(game_id) is None:
        return '', 404
    day = datetime.strptime(game_id, "%m%d%Y").date()
    if day > datetime.now(eastern).date():
        return '', 404
    best = get_best_solution(game_id)
    if best is None:
        return '', 404
    return jsonify(best)

# ---- analytics events (read by /dashboard) ----
# one JSON object per line in logs/events/YYYY-MM-DD.jsonl (Eastern date). Every field is checked, so
# only what the game sends can end up in the file. No IP addresses are stored
EVENTS_FOLDER = "./logs/events/"
REF_PATTERN = re.compile(r"[a-z0-9.-]{1,100}")      # a referring site's host name
UTM_PATTERN = re.compile(r"[A-Za-z0-9_.-]{1,40}")   # ?utm_source=youtube
EVENT_FIELDS = {
    # event: {field: check}, on top of player, mode, game and archive
    "visit": {"new": bool, "ref": "ref", "utm": "utm", "page": "page"},
    "start": {},
    "finish": {"seconds": int, "reveals": int, "checks": int, "points": int, "max": int, "words": "words"},
    "share": {"solution": bool},
    "show_best": {"points": int, "max": int},
    "report": {"count": int},
}

def check_event_field(value, check):
    if check is bool:
        return isinstance(value, bool)
    if check is int:
        return is_small_int(value)
    if check == "words":
        return is_list_of(value, BOARD_WORD_PATTERN, 4)
    if check == "page":
        return value in ("game", "calendar")
    pattern = REF_PATTERN if check == "ref" else UTM_PATTERN
    return isinstance(value, str) and (value == "" or pattern.fullmatch(value) is not None)

@app.route('/log-event', methods=['POST'])
def log_event():
    data = request.get_json(silent=True) or {}
    event = data.get('event')
    if event not in EVENT_FIELDS:
        return '', 400
    player, mode, game = data.get('player'), data.get('mode'), data.get('game')
    if (not isinstance(player, str) or TESTER_PATTERN.fullmatch(player) is None
            or mode not in GAME_MODES
            or not (game == "" or (isinstance(game, str) and GAME_ID_PATTERN.fullmatch(game)))
            or not isinstance(data.get('archive', False), bool)):
        return '', 400
    line = {"time": datetime.now(eastern).strftime("%H:%M:%S"), "event": event, "player": player,
            "mode": mode, "game": game, "archive": data.get('archive', False),
            "device": "mobile" if "Mobi" in request.headers.get('User-Agent', '') else "desktop"}
    for field, check in EVENT_FIELDS[event].items():
        if field in data:
            if not check_event_field(data[field], check):
                return '', 400
            line[field] = data[field]
    os.makedirs(EVENTS_FOLDER, exist_ok=True)
    file_name = f"{EVENTS_FOLDER}{datetime.now(eastern).strftime('%Y-%m-%d')}.jsonl"
    with open(file_name, 'a') as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        f.write(json.dumps(line) + "\n")
        fcntl.flock(f, fcntl.LOCK_UN)
    return '', 204

@app.route('/log-solution', methods=['POST'])
def log_solution():
    data = request.get_json(silent=True) or {}
    game_id = data.get('game_id')  # Used in the file name
    time = datetime.now(eastern).strftime("%H:%M:%S")
    mode = data.get('mode')
    metric = data.get('metric')
    words = data.get('words')

    # these values become a folder name, a file name, and a line of CSV, so only accept exactly
    # what the game sends; anything else could write files outside of ./logs
    if (not is_valid_game(game_id, mode) or mode == "solve"  # SOLVE has its own route, /log-solve
            or not isinstance(metric, str) or METRIC_PATTERN.fullmatch(metric) is None
            or not is_list_of(words, BOARD_WORD_PATTERN, 4)):
        return '', 400

    file_path = f'./logs/{game_id}/'
    file_name = f'{file_path}{mode}.csv'

    # Ensure the directory exists
    os.makedirs(file_path, exist_ok=True)

    # Use file locking to prevent race conditions
    with open(file_name, 'a') as f:
        fcntl.flock(f, fcntl.LOCK_EX)  # Exclusive lock

        # If the file is empty, write the header first
        if os.stat(file_name).st_size == 0:
            f.write('time,metric,word0,word1,word2,word3\n')

        # Append the new line
        f.write(f'{time},{metric},{",".join(words)}\n')

        fcntl.flock(f, fcntl.LOCK_UN)  # Unlock

    return '', 200

# one line per SOLVE solve: daily puzzles go to logs/MMDDYYYY/solve.csv (next to speed.csv and
# score.csv), test-batch puzzles to logs/solve-test.csv
@app.route('/log-solve', methods=['POST'])
def log_solve():
    data = request.get_json(silent=True) or {}
    puzzle = data.get('puzzle')
    mode = data.get('mode')
    tester = data.get('tester')
    words = data.get('words')
    numbers = [data.get(key) for key in ('seconds', 'black_reveals', 'color_reveals', 'revealed_tiles', 'replay')]
    if mode == "solve":
        valid_id = isinstance(puzzle, str) and GAME_ID_PATTERN.fullmatch(puzzle) is not None
        puzzle_path = f"./games/solve/{puzzle}.json"
        file_path = f"./logs/{puzzle}/"
        file_name = f"{file_path}solve.csv"
    elif mode == "solve-test":
        valid_id = isinstance(puzzle, str) and SOLVE_TEST_ID_PATTERN.fullmatch(puzzle) is not None
        puzzle_path = os.path.join(SOLVE_TEST_FOLDER, f"{puzzle}.json")
        file_path = "./logs/"
        file_name = "./logs/solve-test.csv"
    else:
        return '', 400
    # these values become a folder name, a file name, and a line of CSV, so only accept exactly what
    # the game sends
    if (not valid_id
            or not isinstance(tester, str) or TESTER_PATTERN.fullmatch(tester) is None
            or not all(is_small_int(n) for n in numbers)
            or not is_list_of(words, WORD_PATTERN, 4)):
        return '', 400
    num_givens = get_num_givens(puzzle_path)
    if num_givens is None:
        return '', 400

    os.makedirs(file_path, exist_ok=True)
    with open(file_name, 'a') as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        if os.stat(file_name).st_size == 0:
            f.write('date,time,tester,puzzle,givens,seconds,black_reveals,color_reveals,revealed_tiles,replay,word0,word1,word2,word3\n')
        now = datetime.now(eastern)
        f.write(f'{now.strftime("%Y-%m-%d")},{now.strftime("%H:%M:%S")},{tester},{puzzle},{num_givens},'
                f'{",".join(str(n) for n in numbers)},{",".join(words)}\n')
        fcntl.flock(f, fcntl.LOCK_UN)
    return '', 200

# the mode was called "playtest" before it was named SOLVE; keep old links working
@app.route('/playtest')
def old_playtest():
    try:
        number = int(request.args.get('p', '1'))
    except ValueError:
        number = 1
    return redirect(f'/solve/test?p={number}')

# browsers ask for /favicon.ico on their own (e.g. for bookmarks), regardless of the <link> tags
@app.route('/favicon.ico')
def favicon():
    return send_file('static/favicon_io/favicon.ico', mimetype='image/vnd.microsoft.icon')

@app.route('/words', methods=['GET'])
def get_words():
    return send_file('../word_files/words.txt')

if __name__ == '__main__':
    # the word-list review page (/review-words) exists only when running locally like this, never under
    # gunicorn on the server; see word_review.py
    from word_review import word_review
    app.register_blueprint(word_review)
    app.run(host='0.0.0.0', port=5001, debug=True)