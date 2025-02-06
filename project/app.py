from flask import Flask, render_template, jsonify, request, redirect, make_response, send_from_directory
import os
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

# folder to look for the games
generated_game_folder = './generated_games'
files = [f for f in os.listdir(generated_game_folder)]

def get_game_id():
    return "doot"
    return datetime.now(eastern).strftime("%m%d%Y")

def get_date_string(game_id):
    return f"{game_id[0]}{game_id[1]}/{game_id[2]}{game_id[3]}"


@app.route('/')
def index():
    game_mode = request.cookies.get('game_mode', 'speed')
    return redirect(f'/{game_mode}')

@app.route('/speed')
def speed():
    game_id = get_game_id()
    response = make_response(
        render_template('game.html', game_id=game_id, game_mode="speed", date=get_date_string(game_id))
    )
    response.set_cookie('game_mode', 'speed', max_age=60*60*24*365)
    return response

@app.route('/score')
def score():
    game_id = get_game_id()
    response = make_response(
        render_template('game.html', game_id=game_id, game_mode="score", date=get_date_string(game_id))
    )
    response.set_cookie('game_mode', 'score', max_age=60*60*24*365)
    return response

# returns a game based on the query parameter game-id
# if no game-id is provided, redirect to the index, which will give a random game
@app.route('/game')
def game():
    global words
    global files
    
    # game id in hidden input supplied by /
    game_id = request.args.get("game-id", datetime.now(eastern).strftime("%m%d%Y")) # should never fall back to this, but just in case
    selected_game_file = game_id + '.json'
    
    # convert the json file to a dictionary
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

@app.route('/report-missing-word', methods=['POST'])
def report():
    data = request.get_json()
    words = data['words']
    # add words to text file
    with open('./word_files/reported_missing_words.txt', 'a') as f:
        for word in words:
            f.write(word + '\n')    
    return '', 200 # will never actually be used

@app.route('/clear_all_cookies', methods=['GET'])
def clear_all_cookies():
    # Create a response object
    response = make_response(redirect('/'))
    
    # Iterate over all cookies and clear them
    for cookie in request.cookies:
        response.set_cookie(cookie, '', expires=0)
    
    return response

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)