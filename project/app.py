from flask import Flask, render_template, jsonify, request
import os
import random
import json
import glob
import fnmatch

app = Flask(__name__)

@app.route('/')
def index():
    game_id = request.args.get("game-id", None)
    return render_template('index.html', game_id=game_id)

@app.route('/game')
def game():
    words = []
    with open('../word_files/words.txt', 'r') as f:
        for word in f:
            words.append(word.strip())
    
    game_id = request.args.get("game-id", None)
    print(game_id)
    generated_game_folder = '../generated_games'
    files = [f for f in os.listdir(generated_game_folder)]
    if game_id is None:
        selected_game_file = random.choice(files)
    else:
        # get the file that starts with game_id
        matching_files = [f for f in os.listdir(generated_game_folder) if fnmatch.fnmatch(f, str(game_id) + '*')]
        selected_game_file = matching_files[0]

    
    # selected_game_file will be a json file. load into a python dict
    file_path = os.path.join(generated_game_folder, selected_game_file)
    with open(file_path, 'r') as f:
        game_object = json.load(f)


    

    return jsonify({
        "constraints": game_object["constraints"],
        "grid": game_object["grid"],
        "num_valid_constraint_assignments": game_object["num_valid_constraint_assignments"],
        "num_possible_solutions": game_object["num_possible_solutions"],
        "words": words
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)