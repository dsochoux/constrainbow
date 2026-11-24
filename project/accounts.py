# optional accounts: a username and password (no email, so no password reset) that carry a player's
# stats and archive ✓s across devices, and a scoreboard of today's results among mutual friends.
# Design: docs/findings.md, "Accounts and a friends scoreboard".
#
# Everything lives in one SQLite file, data/constrainbow.db (data/ is git-ignored; on the server it's
# the only folder besides logs/ the app may write to). The session cookie is signed with
# data/secret_key, made on first start and never committed (the repo is public).
#
# Passwords are stored only as salted scrypt hashes (werkzeug). Failed sign-ins and sign-ups are
# rate limited per username and per visitor; visitors are kept only as a salted hash of their address,
# and only for a day, so no IP addresses are stored.

import os
import re
import json
import time
import secrets
import sqlite3
import hashlib
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from flask import Blueprint, request, jsonify, session, redirect, g, current_app
from werkzeug.security import generate_password_hash, check_password_hash

accounts = Blueprint('accounts', __name__)

DATA_FOLDER = "./data/"
DB_PATH = DATA_FOLDER + "constrainbow.db"
SECRET_KEY_PATH = DATA_FOLDER + "secret_key"
eastern = ZoneInfo("America/New_York")

MODES = ("solve", "speed", "score")
GAME_ID_PATTERN = re.compile(r"[0-9]{8}")             # MMDDYYYY
USERNAME_PATTERN = re.compile(r"[A-Za-z0-9_]{3,16}")
WORD_PATTERN = re.compile(r"[a-z]{5}")
CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"     # no 0/o, 1/l/i, so a link read aloud still works
CODE_PATTERN = re.compile(f"[{CODE_ALPHABET}]{{8}}")
PASSWORD_MIN, PASSWORD_MAX = 6, 200
DEVICE_LINK_MINUTES = 10

# rate limits: (how many, in how many seconds)
SIGNIN_FAILS_PER_NAME = (10, 15 * 60)
SIGNIN_FAILS_PER_VISITOR = (50, 15 * 60)
SIGNUPS_PER_VISITOR = (10, 24 * 60 * 60)
BAD_CODES_PER_VISITOR = (50, 60 * 60)   # friend codes and sign-in links that don't exist

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    friend_code TEXT NOT NULL UNIQUE,
    created TEXT NOT NULL
);
-- one row per pair of friends, the smaller user id first, so a friendship is mutual by construction
CREATE TABLE IF NOT EXISTS friendships (
    user_a INTEGER NOT NULL,
    user_b INTEGER NOT NULL,
    created TEXT NOT NULL,
    PRIMARY KEY (user_a, user_b),
    CHECK (user_a < user_b)
);
-- a finished daily puzzle: the same result the browser's stats keep (as JSON), plus the finished board
CREATE TABLE IF NOT EXISTS results (
    user_id INTEGER NOT NULL,
    mode TEXT NOT NULL,
    game_id TEXT NOT NULL,
    result TEXT NOT NULL,
    updated TEXT NOT NULL,
    PRIMARY KEY (user_id, mode, game_id)
);
-- a past puzzle finished in the archive (the calendar's ✓)
CREATE TABLE IF NOT EXISTS archive (
    user_id INTEGER NOT NULL,
    mode TEXT NOT NULL,
    game_id TEXT NOT NULL,
    PRIMARY KEY (user_id, mode, game_id)
);
-- "sign in on another device" links: single use, short-lived, only a hash of the token is kept
CREATE TABLE IF NOT EXISTS device_links (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires REAL NOT NULL
);
-- recent failed sign-ins, sign-ups and bad codes, for the rate limits (cleared after a day)
CREATE TABLE IF NOT EXISTS attempts (
    kind TEXT NOT NULL,
    key TEXT NOT NULL,
    at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS attempts_lookup ON attempts (kind, key, at);
"""


def setup(app):
    """called once by app.py: the secret key for the session cookie, and the database tables"""
    os.makedirs(DATA_FOLDER, exist_ok=True)
    app.secret_key = load_secret_key()
    app.config.update(
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=True,       # HTTPS only; app.py turns this off when running locally
        PERMANENT_SESSION_LIFETIME=timedelta(days=400),
    )
    with sqlite3.connect(DB_PATH, timeout=10) as db:
        db.execute("PRAGMA journal_mode=WAL")  # readers don't wait for a writer
        db.executescript(SCHEMA)
    app.teardown_appcontext(close_db)


def load_secret_key():
    # made once; several gunicorn workers may start at the same moment, so only one of them writes it
    try:
        fd = os.open(SECRET_KEY_PATH, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w") as f:
            f.write(secrets.token_hex(32))
    except FileExistsError:
        pass
    for _ in range(50):  # another worker may still be writing it
        with open(SECRET_KEY_PATH) as f:
            key = f.read().strip()
        if key:
            return key
        time.sleep(0.05)
    raise RuntimeError("data/secret_key is empty")


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH, timeout=10)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db


def close_db(_error=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def now_text():
    return datetime.now(eastern).strftime("%Y-%m-%d %H:%M:%S")


def today_id():
    return datetime.now(eastern).strftime("%m%d%Y")


def new_code(length):
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(length))


def hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


# ---- rate limits ----

def visitor_key():
    # nginx passes the visitor's address in X-Real-IP; only a salted hash of it is ever stored
    address = request.headers.get("X-Real-IP") or request.remote_addr or ""
    return hashlib.sha256((current_app.secret_key + address).encode()).hexdigest()[:16]


def is_limited(kind, key, limit):
    count, seconds = limit
    db = get_db()
    row = db.execute("SELECT COUNT(*) FROM attempts WHERE kind = ? AND key = ? AND at > ?",
                     (kind, key, time.time() - seconds)).fetchone()
    return row[0] >= count


def note_attempt(kind, key):
    db = get_db()
    db.execute("INSERT INTO attempts (kind, key, at) VALUES (?, ?, ?)", (kind, key, time.time()))
    db.execute("DELETE FROM attempts WHERE at < ?", (time.time() - 24 * 60 * 60,))
    db.commit()


# ---- who is signed in ----

def current_user():
    """the signed-in user's row, or None"""
    user_id = session.get("user_id")
    if not isinstance(user_id, int):
        return None
    return get_db().execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


def sign_in_as(user_id):
    session.clear()
    session.permanent = True
    session["user_id"] = user_id


def json_body():
    # every account request is JSON: a form on another site can't send JSON without the browser asking
    # this site first, which it never allows, so a signed-in player can't be tricked into these requests
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else None


def site_url():
    # the app sits behind nginx (or a tunnel) and only sees plain http, so links it makes say https,
    # except when it runs on this computer
    host = request.host
    local = host.startswith(("localhost", "127.0.0.1"))
    return f"{'http' if local else 'https'}://{host}/"


def account_info(user):
    return {"signedIn": True, "username": user["username"],
            "friendLink": f"{site_url()}friend/{user['friend_code']}"}


# ---- checking what the browser sends ----

def is_small_int(value, top=100000):
    return isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= top


def is_game_id(value):
    if not isinstance(value, str) or GAME_ID_PATTERN.fullmatch(value) is None:
        return False
    try:
        day = datetime.strptime(value, "%m%d%Y").date()
    except ValueError:
        return False
    return day <= datetime.now(eastern).date()  # never a day that hasn't started yet


def clean_words(words):
    if (isinstance(words, list) and len(words) == 4
            and all(isinstance(word, str) and WORD_PATTERN.fullmatch(word) for word in words)):
        return words
    return None


def clean_result(mode, result):
    """the stats result for a day (see stats.js), with its finished board, or None if anything is off"""
    if not isinstance(result, dict):
        return None
    if mode == "solve":
        if not (is_small_int(result.get("seconds")) and is_small_int(result.get("reveals"), 20)):
            return None
        clean = {"seconds": result["seconds"], "reveals": result["reveals"]}
        revealed = result.get("revealed")
        if (isinstance(revealed, list) and len(revealed) <= 20
                and all(isinstance(tile, list) and len(tile) == 2 and is_small_int(tile[0], 3)
                        and is_small_int(tile[1], 4) for tile in revealed)):
            clean["revealed"] = revealed
    elif mode == "speed":
        if not is_small_int(result.get("seconds")):
            return None
        clean = {"seconds": result["seconds"]}
    elif mode == "score":
        if not (is_small_int(result.get("points"), 1000) and is_small_int(result.get("max"), 1000)):
            return None
        clean = {"points": result["points"], "max": result["max"]}
    else:
        return None
    words = clean_words(result.get("words"))
    if words:
        clean["words"] = words
    return clean


def save_result(user_id, mode, game_id, result):
    """keeps the first finish of a day, except in score mode, where a higher score replaces it.
    A finish without a board fills in the board of one that had none"""
    db = get_db()
    row = db.execute("SELECT result FROM results WHERE user_id = ? AND mode = ? AND game_id = ?",
                     (user_id, mode, game_id)).fetchone()
    if row is not None:
        old = json.loads(row["result"])
        better = mode == "score" and result["points"] > old["points"]
        same_but_board = (mode != "score" or result["points"] == old["points"]) and "words" in result and "words" not in old
        if not (better or same_but_board):
            return
        if same_but_board and not better:
            result = {**old, **{key: result[key] for key in ("words", "revealed") if key in result}}
    db.execute("INSERT OR REPLACE INTO results (user_id, mode, game_id, result, updated) VALUES (?, ?, ?, ?, ?)",
               (user_id, mode, game_id, json.dumps(result), now_text()))


def user_data(user_id):
    """everything the browser keeps for a signed-in player: stats (without the boards) and archive ✓s"""
    db = get_db()
    stats = {mode: {} for mode in MODES}
    for row in db.execute("SELECT mode, game_id, result FROM results WHERE user_id = ?", (user_id,)):
        stats[row["mode"]][row["game_id"]] = json.loads(row["result"])
    archive = {mode: {} for mode in MODES}
    for row in db.execute("SELECT mode, game_id FROM archive WHERE user_id = ?", (user_id,)):
        archive[row["mode"]][row["game_id"]] = True
    return {"stats": stats, "archive": archive}


def merge_from_browser(user_id, data):
    """adds a browser's stats and archive ✓s to the account (on sign-in and every visit)"""
    stats = data.get("stats") if isinstance(data.get("stats"), dict) else {}
    archive = data.get("archive") if isinstance(data.get("archive"), dict) else {}
    db = get_db()
    for mode in MODES:
        days = stats.get(mode)
        if isinstance(days, dict):
            for game_id, result in list(days.items())[:5000]:
                clean = clean_result(mode, result)
                if is_game_id(game_id) and clean:
                    save_result(user_id, mode, game_id, clean)
        done = archive.get(mode)
        if isinstance(done, dict):
            for game_id in list(done.keys())[:5000]:
                if is_game_id(game_id):
                    db.execute("INSERT OR IGNORE INTO archive (user_id, mode, game_id) VALUES (?, ?, ?)",
                               (user_id, mode, game_id))
    db.commit()


# ---- sign up, sign in, sign out ----

@accounts.route('/account/me')
def me():
    user = current_user()
    return jsonify(account_info(user) if user else {"signedIn": False})


@accounts.route('/account/signup', methods=['POST'])
def signup():
    data = json_body()
    if data is None:
        return '', 400
    username, password = data.get("username"), data.get("password")
    if not isinstance(username, str) or USERNAME_PATTERN.fullmatch(username) is None:
        return jsonify(error="Usernames are 3–16 letters, numbers or _."), 400
    if not isinstance(password, str) or not PASSWORD_MIN <= len(password) <= PASSWORD_MAX:
        return jsonify(error=f"Passwords need at least {PASSWORD_MIN} characters."), 400
    visitor = visitor_key()
    if is_limited("signup", visitor, SIGNUPS_PER_VISITOR):
        return jsonify(error="Too many new accounts from here today. Try again tomorrow."), 429
    db = get_db()
    try:
        cursor = db.execute(
            "INSERT INTO users (username, password_hash, friend_code, created) VALUES (?, ?, ?, ?)",
            (username, generate_password_hash(password), new_code(8), now_text()))
    except sqlite3.IntegrityError:
        return jsonify(error="That username is taken."), 409
    db.commit()
    note_attempt("signup", visitor)
    user_id = cursor.lastrowid
    sign_in_as(user_id)
    merge_from_browser(user_id, data)
    user = current_user()
    return jsonify({**account_info(user), **user_data(user_id)})


@accounts.route('/account/signin', methods=['POST'])
def signin():
    data = json_body()
    if data is None:
        return '', 400
    username, password = data.get("username"), data.get("password")
    if not isinstance(username, str) or not isinstance(password, str) or len(password) > PASSWORD_MAX:
        return '', 400
    name_key, visitor = username.lower()[:40], visitor_key()
    if (is_limited("signin", name_key, SIGNIN_FAILS_PER_NAME)
            or is_limited("signin-visitor", visitor, SIGNIN_FAILS_PER_VISITOR)):
        return jsonify(error="Too many tries. Wait a few minutes and try again."), 429
    user = get_db().execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    if user is None or not check_password_hash(user["password_hash"], password):
        note_attempt("signin", name_key)
        note_attempt("signin-visitor", visitor)
        return jsonify(error="Wrong username or password."), 401
    sign_in_as(user["id"])
    merge_from_browser(user["id"], data)
    return jsonify({**account_info(user), **user_data(user["id"])})


@accounts.route('/account/signout', methods=['POST'])
def signout():
    if json_body() is None:
        return '', 400
    session.clear()
    return '', 204


# ---- keeping the browser and the account in step ----

# every visit while signed in: adds this browser's recent stats and ✓s, and returns the account's
@accounts.route('/account/sync', methods=['POST'])
def sync():
    data = json_body()
    user = current_user()
    if data is None:
        return '', 400
    if user is None:
        return jsonify(signedIn=False)
    merge_from_browser(user["id"], data)
    return jsonify({**account_info(user), **user_data(user["id"])})


# a finished daily puzzle (score mode sends each better score too)
@accounts.route('/account/result', methods=['POST'])
def result():
    data = json_body()
    user = current_user()
    if data is None or user is None:
        return '', 400 if data is None else 401
    mode, game_id = data.get("mode"), data.get("game_id")
    clean = clean_result(mode, data.get("result"))
    if mode not in MODES or not is_game_id(game_id) or clean is None:
        return '', 400
    save_result(user["id"], mode, game_id, clean)
    get_db().commit()
    return '', 204


# a past puzzle finished in the archive
@accounts.route('/account/archive', methods=['POST'])
def archive_done():
    data = json_body()
    user = current_user()
    if data is None or user is None:
        return '', 400 if data is None else 401
    mode, game_id = data.get("mode"), data.get("game_id")
    if mode not in MODES or not is_game_id(game_id):
        return '', 400
    db = get_db()
    db.execute("INSERT OR IGNORE INTO archive (user_id, mode, game_id) VALUES (?, ?, ?)", (user["id"], mode, game_id))
    db.commit()
    return '', 204


# ---- signing in on another device ----

@accounts.route('/account/device-link', methods=['POST'])
def device_link():
    user = current_user()
    if json_body() is None or user is None:
        return '', 401
    token = secrets.token_urlsafe(18)
    db = get_db()
    db.execute("DELETE FROM device_links WHERE expires < ?", (time.time(),))
    db.execute("INSERT INTO device_links (token_hash, user_id, expires) VALUES (?, ?, ?)",
               (hash_token(token), user["id"], time.time() + DEVICE_LINK_MINUTES * 60))
    db.commit()
    return jsonify(url=f"{site_url()}signin/{token}", minutes=DEVICE_LINK_MINUTES)


# opening the link signs this device in (once), then goes to the game
@accounts.route('/signin/<token>')
def device_signin(token):
    visitor = visitor_key()
    if is_limited("bad-code", visitor, BAD_CODES_PER_VISITOR):
        return redirect('/solve?signin=expired')
    db = get_db()
    row = db.execute("SELECT * FROM device_links WHERE token_hash = ?", (hash_token(token[:100]),)).fetchone()
    db.execute("DELETE FROM device_links WHERE token_hash = ? OR expires < ?", (hash_token(token[:100]), time.time()))
    db.commit()
    if row is None or row["expires"] < time.time():
        note_attempt("bad-code", visitor)
        return redirect('/solve?signin=expired')
    sign_in_as(row["user_id"])
    return redirect('/solve?signin=ok')


# ---- friends ----

def friend_ids(user_id):
    rows = get_db().execute(
        "SELECT user_b AS id FROM friendships WHERE user_a = ? UNION SELECT user_a AS id FROM friendships WHERE user_b = ?",
        (user_id, user_id)).fetchall()
    return [row["id"] for row in rows]


# a friend link opens the game, which reads the code and shows who it's from
@accounts.route('/friend/<code>')
def friend_link(code):
    if CODE_PATTERN.fullmatch(code) is None:
        return redirect('/solve?friend=bad')
    return redirect(f'/solve?friend={code}')


# who a friend code belongs to (the page asks before showing "X wants you on their scoreboard")
@accounts.route('/account/friend-code/<code>')
def friend_code(code):
    visitor = visitor_key()
    if is_limited("bad-code", visitor, BAD_CODES_PER_VISITOR):
        return '', 429
    owner = get_db().execute("SELECT id, username FROM users WHERE friend_code = ?", (code[:20],)).fetchone()
    if owner is None:
        note_attempt("bad-code", visitor)
        return '', 404
    user = current_user()
    status = None
    if user is not None:
        status = "self" if user["id"] == owner["id"] else "friends" if owner["id"] in friend_ids(user["id"]) else None
    return jsonify(username=owner["username"], status=status)


@accounts.route('/account/befriend', methods=['POST'])
def befriend():
    data = json_body()
    user = current_user()
    if data is None or user is None:
        return '', 400 if data is None else 401
    visitor = visitor_key()
    if is_limited("bad-code", visitor, BAD_CODES_PER_VISITOR):
        return '', 429
    code = data.get("code")
    db = get_db()
    owner = db.execute("SELECT id, username FROM users WHERE friend_code = ?",
                       (code[:20] if isinstance(code, str) else "",)).fetchone()
    if owner is None:
        note_attempt("bad-code", visitor)
        return jsonify(error="That friend link doesn't work any more. Ask for a new one."), 404
    if owner["id"] == user["id"]:
        return jsonify(status="self", username=owner["username"])
    pair = sorted((user["id"], owner["id"]))
    cursor = db.execute("INSERT OR IGNORE INTO friendships (user_a, user_b, created) VALUES (?, ?, ?)",
                        (pair[0], pair[1], now_text()))
    db.commit()
    return jsonify(status="added" if cursor.rowcount else "friends", username=owner["username"])


@accounts.route('/account/unfriend', methods=['POST'])
def unfriend():
    data = json_body()
    user = current_user()
    if data is None or user is None:
        return '', 400 if data is None else 401
    username = data.get("username")
    db = get_db()
    other = db.execute("SELECT id FROM users WHERE username = ?",
                       (username if isinstance(username, str) else "",)).fetchone()
    if other is not None:
        pair = sorted((user["id"], other["id"]))
        db.execute("DELETE FROM friendships WHERE user_a = ? AND user_b = ?", (pair[0], pair[1]))
        db.commit()
    return '', 204


# a new friend link; the old one stops working (anyone already a friend stays one)
@accounts.route('/account/new-friend-link', methods=['POST'])
def new_friend_link():
    user = current_user()
    if json_body() is None or user is None:
        return '', 401
    db = get_db()
    db.execute("UPDATE users SET friend_code = ? WHERE id = ?", (new_code(8), user["id"]))
    db.commit()
    return jsonify(account_info(current_user()))


# ---- the scoreboard ----

def puzzle_grid(mode, game_id):
    try:
        with open(f"./games/{mode}/{game_id}.json") as f:
            return json.load(f)["grid"]
    except (OSError, ValueError, KeyError):
        return None


# today's results for you and your friends. A mode stays locked until you've finished it today: your
# friends' results (and boards) in it are only sent once yours is in, so they can't be peeked at
@accounts.route('/account/scoreboard')
def scoreboard():
    user = current_user()
    if user is None:
        return '', 401
    game_id = today_id()
    db = get_db()
    people = [user["id"]] + friend_ids(user["id"])
    names = {row["id"]: row["username"] for row in db.execute(
        f"SELECT id, username FROM users WHERE id IN ({','.join('?' * len(people))})", people)}
    results = {}
    for row in db.execute(
            f"SELECT user_id, mode, result FROM results WHERE game_id = ? AND user_id IN ({','.join('?' * len(people))})",
            [game_id] + people):
        results[(row["user_id"], row["mode"])] = json.loads(row["result"])
    unlocked = [mode for mode in MODES if (user["id"], mode) in results]
    rows = []
    for person in people:
        cells = {}
        for mode in MODES:
            if person != user["id"] and mode not in unlocked:
                cells[mode] = "locked"
            else:
                cells[mode] = results.get((person, mode))  # None: not played today
        rows.append({"username": names.get(person, "?"), "isYou": person == user["id"], "results": cells})
    return jsonify({
        "gameId": game_id,
        "unlocked": unlocked,
        "grids": {mode: puzzle_grid(mode, game_id) for mode in unlocked},
        "givens": solve_givens(game_id) if "solve" in unlocked else [],
        "rows": rows,
        **account_info(user),
    })


def solve_givens(game_id):
    # the letters a SOLVE puzzle starts with, [w, l] each, so the board popup can mark them
    try:
        with open(f"./games/solve/{game_id}.json") as f:
            return [[given[0], given[1]] for given in json.load(f)["givens"]]
    except (OSError, ValueError, KeyError, TypeError, IndexError):
        return []
