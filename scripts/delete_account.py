"""Deletes one account and everything kept for it: its results, archive ✓s, friendships and sign-in
links (the privacy note promises this to anyone who asks through feedback).

Run from the repo root. On the server, as the app's own user (so SQLite's helper files stay its own):
    ssh root@constrainbow.com
    cd /srv/constrainbow && runuser -u constrainbow -- env/bin/python scripts/delete_account.py USERNAME

The nightly backups in data/backups still hold the account for up to 30 days, then age out.
"""
import sqlite3
import sys

DB_PATH = "data/constrainbow.db"


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: delete_account.py USERNAME")
    db = sqlite3.connect(DB_PATH, timeout=30)
    row = db.execute("SELECT id, username FROM users WHERE username = ? COLLATE NOCASE", (sys.argv[1],)).fetchone()
    if row is None:
        sys.exit(f"no account named {sys.argv[1]}")
    user_id, username = row
    with db:
        friends = db.execute("DELETE FROM friendships WHERE user_a = ? OR user_b = ?", (user_id, user_id)).rowcount
        results = db.execute("DELETE FROM results WHERE user_id = ?", (user_id,)).rowcount
        db.execute("DELETE FROM archive WHERE user_id = ?", (user_id,))
        db.execute("DELETE FROM device_links WHERE user_id = ?", (user_id,))
        db.execute("DELETE FROM users WHERE id = ?", (user_id,))
    print(f"deleted {username}: {results} results, {friends} friendships")


if __name__ == "__main__":
    main()
