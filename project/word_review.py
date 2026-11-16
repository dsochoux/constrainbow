"""A page for deciding what goes in the word lists, at http://localhost:5001/review-words

Only for running locally: app.py registers it only when started with `python project/app.py` (never
under gunicorn), it answers only requests from this computer, and deploy.sh doesn't copy it to the
server. The lists it edits:
  - words.txt: the big list, every word the game accepts (SOLVE uniqueness is checked against it)
  - common_words.txt: the small list, the everyday words SOLVE answers are drawn from
  - rejected_words.txt: reported words that won't be added
  - common_reviewed.txt: big-list words already decided for the small list (in or out), so the
    review can pick up where it left off
reported_missing_words.txt (what players reported) is only read. The server's copy is the real one;
download it first:  scp root@constrainbow.com:/srv/constrainbow/word_files/reported_missing_words.txt word_files/
"""
import glob
import json
import os
import sys
from collections import Counter
from datetime import datetime
from zoneinfo import ZoneInfo

from flask import Blueprint, abort, jsonify, render_template, request

WORDS_PATH = "./word_files/words.txt"
COMMON_PATH = "./word_files/common_words.txt"
REJECTED_PATH = "./word_files/rejected_words.txt"
REVIEWED_PATH = "./word_files/common_reviewed.txt"
REPORTED_PATH = "./word_files/reported_missing_words.txt"

word_review = Blueprint("word_review", __name__)


@word_review.before_request
def only_this_computer():
    # the dev server listens on every network interface, so turn away anything that isn't from this
    # computer, and anything that came through a proxy (nginx would add X-Forwarded-For)
    if request.remote_addr not in ("127.0.0.1", "::1") or "X-Forwarded-For" in request.headers:
        abort(404)


def read_list(path):
    if not os.path.exists(path):
        return []
    with open(path, "r") as f:
        return [line.strip() for line in f if line.strip()]


def write_list(path, words):
    # sorted, no duplicates; written to a temporary file and renamed, so a file is never half written
    temp_path = path + ".tmp"
    with open(temp_path, "w") as f:
        f.write("\n".join(sorted(set(words))) + "\n")
    os.replace(temp_path, path)


def solve_answer_words():
    # every word that is the answer to a SOLVE puzzle: these can't leave the big list
    words = set()
    for path in glob.glob("./games/solve/*.json") + glob.glob("./games/solve-test/*.json"):
        with open(path, "r") as f:
            words.update(json.load(f)["solution"])
    return words


def check_solve_puzzles():
    """the daily SOLVE puzzles from today on that have more than one solution with the current
    words.txt (earlier days have been played already; check_solve_unique.py reports every puzzle)"""
    scripts = os.path.abspath("./scripts")
    if scripts not in sys.path:
        sys.path.insert(0, scripts)
    from generate_game import Game
    from check_solve_unique import count_solutions
    Game.words = None  # words.txt may have changed: rebuild the index
    today = datetime.now(ZoneInfo("America/New_York")).strftime("%Y%m%d")
    broken = []
    for path in sorted(glob.glob("./games/solve/*.json")):
        game_id = os.path.basename(path)[:-len(".json")]  # MMDDYYYY
        if game_id[4:] + game_id[:4] < today:
            continue
        with open(path, "r") as f:
            if count_solutions(json.load(f)) > 1:
                broken.append(f"{game_id[:2]}/{game_id[2:4]}/{game_id[4:]}")
    return broken


def get_data():
    words = set(read_list(WORDS_PATH))
    common = set(read_list(COMMON_PATH))
    rejected = set(read_list(REJECTED_PATH))
    reviewed = set(read_list(REVIEWED_PATH))
    reported = Counter(read_list(REPORTED_PATH))

    def status(word):
        if word in common:
            return "small"
        if word in words:
            return "big"
        if word in rejected:
            return "rejected"
        return "pending"

    return {
        # most-reported first
        "reported": [{"word": word, "count": count, "status": status(word)}
                     for word, count in sorted(reported.items(), key=lambda item: (-item[1], item[0]))],
        "big": [{"word": word, "small": word in common, "reviewed": word in reviewed}
                for word in sorted(words)],
        "not_unique": check_solve_puzzles(),
    }


@word_review.route("/review-words")
def review_page():
    return render_template("word_review.html")


@word_review.route("/review-words/data")
def review_data():
    return jsonify(get_data())


@word_review.route("/review-words/decide", methods=["POST"])
def decide():
    data = request.get_json(silent=True) or {}
    word = data.get("word")
    choice = data.get("choice")
    words = set(read_list(WORDS_PATH))
    common = set(read_list(COMMON_PATH))
    rejected = set(read_list(REJECTED_PATH))
    reviewed = set(read_list(REVIEWED_PATH))
    if not isinstance(word, str) or len(word) != 5 or not word.isalpha() or not word.islower():
        return jsonify({"error": "not a five-letter word"}), 400

    if choice in ("reject", "pending", "big", "small"):
        # a reported word: set exactly which lists it's in
        if choice in ("reject", "pending") and word in words:
            if word not in read_list(REPORTED_PATH):
                return jsonify({"error": f"{word} wasn't reported, so it stays in the big list"}), 400
            if word in solve_answer_words():
                return jsonify({"error": f"{word} is a SOLVE answer, so it has to stay in the big list"}), 400
        words.discard(word)
        common.discard(word)
        rejected.discard(word)
        if choice == "reject":
            rejected.add(word)
        if choice in ("big", "small"):
            words.add(word)
            reviewed.add(word)  # deciding big vs small is the small-list review too
        if choice == "small":
            common.add(word)
        if choice == "pending":
            reviewed.discard(word)
    elif choice in ("in-small", "not-small"):
        # a big-list word: is it on the small list?
        if word not in words:
            return jsonify({"error": f"{word} isn't in the big list"}), 400
        if choice == "in-small":
            common.add(word)
        else:
            common.discard(word)
        reviewed.add(word)
    else:
        return jsonify({"error": "unknown choice"}), 400

    write_list(WORDS_PATH, words)
    write_list(COMMON_PATH, common)
    write_list(REJECTED_PATH, rejected)
    write_list(REVIEWED_PATH, reviewed)
    return jsonify(get_data())
