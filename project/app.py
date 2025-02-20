from flask import Flask, render_template, jsonify, request, redirect, make_response, send_file
import os
import fcntl
import json
from datetime import datetime
from zoneinfo import ZoneInfo

app = Flask(__name__)

db_path = "database.db"
eastern = ZoneInfo("America/New_York")

words = []
with open('./word_files/words.txt', 'r') as f:
    for word in f:
        words.append(word.strip())

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
            mode_emoji="⏱️",
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
            other_mode_emoji = "⏱️",
            other_mode_endpoint = "/speed",
            date=get_date_string(game_id)
        )
    )
    response.set_cookie('game_mode', 'score', max_age=60*60*24*365)
    return response

# returns a game based on the query parameter game-id
# if no game-id is provided, redirect to the index, which will give a random game
@app.route('/game')
def game():
    global words
    
    try:
        # game id in hidden input supplied by /
        game_id = request.args.get("game-id", datetime.now(eastern).strftime("%m%d%Y")) # should never fall back to this, but just in case
        game_mode = request.args.get("game-mode", "speed")
        selected_game_file = game_id + '.json'
        
        # convert the json file to a dictionary
        generated_game_folder = f"./games/{game_mode}/"
        file_path = os.path.join(generated_game_folder, selected_game_file)
        with open(file_path, 'r') as f:
            game_object = json.load(f)

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
    data = request.get_json()
    words = data['words']
    # add words to text file
    with open('./word_files/reported_missing_words.txt', 'a') as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        for word in words:
            f.write(word + '\n')
        fcntl.flock(f, fcntl.LOCK_UN)  
    return '', 200 # will never actually be used

@app.route('/log-solution', methods=['POST'])
def log_solution():
    data = request.get_json()
    game_id = data['game_id']  # Used in the file name
    time = datetime.now(eastern).strftime("%H:%M:%S")
    mode = data['mode']
    metric = data['metric']
    words = data['words']

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

@app.route('/words', methods=['GET'])
def get_words():
    return send_file('../word_files/words.txt')


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)