from flask import Flask, render_template, jsonify

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
    with open('../word_files/words.txt', 'r') as f:
        for word in f:
            words.append(word.strip())

    return jsonify({
        "constraints": {
            '@': [[0, 0], [0, 4], [1, 2]],
            '#': [[1, 4], [3, 1], [3, 3]],
            '$': [[0, 3], [2, 4]],
            '%': [[2, 0], [3, 4]]
        },
        "grid": [
            ['@', '-', '-', '$', '@'],
            ['-', '-', '@', '-', '#'],
            ['%', '-', '-', '-', '$'],
            ['-', '#', '-', '#', '%'],
        ],
        "words": words
    })

if __name__ == '__main__':
    app.run(debug=True)