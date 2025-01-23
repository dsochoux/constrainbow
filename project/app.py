from flask import Flask, render_template, jsonify, request, redirect
import os
import random
import json
import glob
import fnmatch
import sqlite3

app = Flask(__name__)

db_path = "database.db"


# return a random game
@app.route('/')
def index():
    game_id = request.args.get("game-id", None)
    return render_template('index.html', game_id=game_id)

# returns a game based on the query parameter game-id
# if no game-id is provided, redirect to the index, which will give a random game
@app.route('/game')
def game():
    words = []
    with open('./word_files/words.txt', 'r') as f:
        for word in f:
            words.append(word.strip())
    
    game_id = request.args.get("game-id", None)
    print(game_id)
    generated_game_folder = './generated_games'
    files = [f for f in os.listdir(generated_game_folder)]
    if game_id is None:
        selected_game_file = random.choice(files)
    else:
        # get the file that starts with game_id
        generated_game_folder = './generated_games'
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

@app.route('/report-missing-word', methods=['POST'])
def report():
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    data = request.get_json()
    words = data['words']
    # insert the words into the database
    cursor.executemany('INSERT INTO reported_missing_words (word) VALUES (?)', [(word,) for word in words])
    conn.commit()
    conn.close()
    # add words to text file
    with open('./word_files/reported_missing_words.txt', 'a') as f:
        for word in words:
            f.write(word + '\n')    
    return '', 200 # will never actually be used

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)