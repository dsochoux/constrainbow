from flask import Flask, render_template, jsonify, request, redirect, make_response, send_file, Response
import os
import re
import fcntl
import json
from datetime import datetime
from zoneinfo import ZoneInfo

app = Flask(__name__)

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
GAME_MODES = ("speed", "score")
SOLVE_ID_PATTERN = re.compile(r"[0-9]{2}")       # SOLVE test puzzle "01", "02", ...
TESTER_PATTERN = re.compile(r"[0-9a-f]{8}")      # a random id each SOLVE player's browser makes up
SOLVE_FOLDER = "./games/solve/"

def is_valid_game(game_id, game_mode):
    return (isinstance(game_id, str) and GAME_ID_PATTERN.fullmatch(game_id) is not None
            and game_mode in GAME_MODES)

def is_list_of(value, pattern, max_length):
    return (isinstance(value, list) and len(value) <= max_length
            and all(isinstance(item, str) and pattern.fullmatch(item) for item in value))

def get_solve_count():
    if not os.path.isdir(SOLVE_FOLDER):
        return 0
    return len([name for name in os.listdir(SOLVE_FOLDER) if name.endswith('.json')])

def is_small_int(value):
    return isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= 100000

def get_game_id():
    return datetime.now(eastern).strftime("%m%d%Y")

def get_date_string(game_id):
    return f"{game_id[0]}{game_id[1]}/{game_id[2]}{game_id[3]}"


@app.route('/')
def index():
    # going to / will redirect the user to either speed or score mode
    # this is determined by what they were last playing, which is stored in the cookie
    # if the cookie is not set, default to speed mode
    game_mode = request.cookies.get('game_mode', 'speed')
    return redirect(f'/{game_mode}')

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
    response.set_cookie('game_mode', 'speed', max_age=60*60*24*365)
    return response

@app.route('/score')
def score():
    game_id = get_game_id()
    response = make_response(
        render_template(
            'game.html',
            game_id=game_id,
            game_mode="score",
            mode_emoji="🎯",
            other_mode_emoji = emoji_overrides.get(game_id[:4], "⏱️"),
            other_mode_endpoint = "/speed",
            date=get_date_string(game_id)
        )
    )
    response.set_cookie('game_mode', 'score', max_age=60*60*24*365)
    return response

# SOLVE: single-solution puzzles (see scripts/generate_unique.py), for now a numbered batch of
# test puzzles; not linked from the game, share /solve with testers directly
@app.route('/solve')
def solve():
    count = get_solve_count()
    try:
        number = int(request.args.get('p', '1'))
    except ValueError:
        number = 1
    if count == 0:
        return "No SOLVE puzzles yet.", 404
    number = max(1, min(number, count))
    game_id = f"{number:02d}"
    with open(os.path.join(SOLVE_FOLDER, game_id + '.json'), 'r') as f:
        num_givens = json.load(f)["num_givens"]
    return render_template(
        'game.html',
        game_id=game_id,
        game_mode="solve",
        mode_emoji="⏱️",
        other_mode_emoji="🎯",
        puzzle_number=number,
        puzzle_count=count,
        num_givens=num_givens,
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
        is_solve = game_mode == "solve" and SOLVE_ID_PATTERN.fullmatch(game_id) is not None
        if not is_valid_game(game_id, game_mode) and not is_solve:
            return '', 404
        selected_game_file = game_id + '.json'
        
        # convert the json file to a dictionary
        generated_game_folder = f"./games/{game_mode}/"
        file_path = os.path.join(generated_game_folder, selected_game_file)
        with open(file_path, 'r') as f:
            game_object = json.load(f)

        if is_solve:
            # SOLVE puzzles have one answer; the client needs it for the REVEAL button
            return jsonify({
                "game_id": game_id,
                "constraints": game_object["constraints"],
                "grid": game_object["grid"],
                "givens": game_object["givens"],
                "solution": game_object["solution"],
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
    if (not is_valid_game(game_id, mode)
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

# one line per SOLVE solve, all in logs/solve.csv
@app.route('/log-solve', methods=['POST'])
def log_solve():
    data = request.get_json(silent=True) or {}
    puzzle = data.get('puzzle')
    tester = data.get('tester')
    words = data.get('words')
    numbers = [data.get(key) for key in ('seconds', 'black_reveals', 'color_reveals', 'revealed_tiles', 'replay')]
    if (not isinstance(puzzle, str) or SOLVE_ID_PATTERN.fullmatch(puzzle) is None
            or not isinstance(tester, str) or TESTER_PATTERN.fullmatch(tester) is None
            or not all(is_small_int(n) for n in numbers)
            or not is_list_of(words, WORD_PATTERN, 4)):
        return '', 400
    puzzle_path = os.path.join(SOLVE_FOLDER, puzzle + '.json')
    if not os.path.exists(puzzle_path):
        return '', 400
    with open(puzzle_path, 'r') as f:
        num_givens = json.load(f)["num_givens"]

    os.makedirs('./logs', exist_ok=True)
    file_name = './logs/solve.csv'
    with open(file_name, 'a') as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        if os.stat(file_name).st_size == 0:
            f.write('date,time,tester,puzzle,givens,seconds,black_reveals,color_reveals,revealed_tiles,replay,word0,word1,word2,word3\n')
        now = datetime.now(eastern)
        f.write(f'{now.strftime("%Y-%m-%d")},{now.strftime("%H:%M:%S")},{tester},{puzzle},{num_givens},'
                f'{",".join(str(n) for n in numbers)},{",".join(words)}\n')
        fcntl.flock(f, fcntl.LOCK_UN)
    return '', 200

@app.route('/solvelog', methods=['GET'])
def get_solve_log():
    return return_log('./logs/solve.csv', "SOLVE")

# the mode was called "playtest" before it was named SOLVE; keep old links working
@app.route('/playtest')
def old_playtest():
    try:
        number = int(request.args.get('p', '1'))
    except ValueError:
        number = 1
    return redirect(f'/solve?p={number}')

# browsers ask for /favicon.ico on their own (e.g. for bookmarks), regardless of the <link> tags
@app.route('/favicon.ico')
def favicon():
    return send_file('static/favicon_io/favicon.ico', mimetype='image/vnd.microsoft.icon')

@app.route('/words', methods=['GET'])
def get_words():
    return send_file('../word_files/words.txt')

@app.route('/speedlog', methods=['GET'])
def get_speed_log():
    game_id = get_game_id()
    file_path = f'./logs/{game_id}/speed.csv'
    return return_log(file_path, "speed")

@app.route('/scorelog', methods=['GET'])
def get_score_log():
    game_id = get_game_id()
    file_path = f'./logs/{game_id}/score.csv'
    return return_log(file_path, "score")

def return_log(file_path, mode):
    if not os.path.exists(file_path):
        return f"Nobody has solved today's {mode} game yet.", 200
    # Open the CSV file and read its content
    with open(file_path, 'r') as file:
        file_content = file.read()

    # Return the file content as a response with text/plain MIME type
    return Response(file_content, 
                    mimetype='text/plain', 
                    headers={"Content-Disposition": f"inline; filename={mode}log.txt"})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)