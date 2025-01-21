from flask import Flask, render_template, jsonify
import os
import random
import json
import time

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/game')
def game():
    # returns json object containing info to play the game
    # contraints, list of valid words, etc...
    # "constraints": {
    #     "word_1": "@--$@",
    #     "word_2": "--@-#",
    #     "word_3": "%---$",
    #     "word_4": "-#-#%"
    # },
    words = []
    generated_game_folder = '../generated_games'
    files = [f for f in os.listdir(generated_game_folder)]
    selected_game_file = random.choice(files)
    # selected_game_file will be a json file. load into a python dict
    file_path = os.path.join(generated_game_folder, selected_game_file)
    with open(file_path, 'r') as f:
        game_object = json.load(f)


    with open('../word_files/words.txt', 'r') as f:
        for word in f:
            words.append(word.strip())

    return jsonify({
        "constraints": game_object["constraints"],
        "grid": game_object["grid"],
        "num_valid_constraint_assignments": game_object["num_valid_constraint_assignments"],
        "num_possible_solutions": game_object["num_possible_solutions"],
        "words": words
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)