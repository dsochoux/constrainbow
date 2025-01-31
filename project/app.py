from flask import Flask, render_template, jsonify, request, redirect, make_response
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

# return a random game
@app.route('/')
def index():
    # a game-id can be provided as a query parameter (this is a secret feature)
    # people will hit the normal endpoint
    # if no game-id is provided, get the game id for today's game and pass it to the index.html
    # then, when the user hits the game endpoint, it will get the game with that game id
    game_id = request.args.get("game-id", None)
    if game_id is not None:
        # verify it is valid
       if not os.path.isfile(os.path.join(generated_game_folder, f"{game_id}.json")):
           return redirect('/')
    else:
        game_id = datetime.now(eastern).strftime("%m%d%Y")
        print(game_id)
    # game_id = datetime.now(eastern).strftime("%m%d%Y")
    return render_template('index.html', game_id=game_id, date=f"{game_id[0]}{game_id[1]}/{game_id[2]}{game_id[3]}")

# returns a game based on the query parameter game-id
# if no game-id is provided, redirect to the index, which will give a random game
@app.route('/game')
def game():
    global words
    global files
    
    # game id in hidden input supplied by /
    game_id = request.args.get("game-id", datetime.now(eastern).strftime("%m%d%Y")) # should never fall back to this, but just in case
    
    # game id in the cookie, if it exists
    saved_game_id = request.cookies.get('game_id', '')
    selected_game_file = game_id + '.json'
    
    # convert the json file to a dictionary
    file_path = os.path.join(generated_game_folder, selected_game_file)
    with open(file_path, 'r') as f:
        game_object = json.load(f)


    # make sure all the cookies are present
    should_use_saved_game = (
        game_id == saved_game_id and 
        'total_seconds' in request.cookies and
        'word0' in request.cookies and
        'word1' in request.cookies and
        'word2' in request.cookies and
        'word3' in request.cookies and
        'first_solution_found' in request.cookies
    )

    return jsonify({
        "use_saved_game": should_use_saved_game,
        "game_id": game_id,
        "constraints": game_object["constraints"],
        "grid": game_object["grid"],
        "num_possible_solutions": game_object["num_possible_solutions"],
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