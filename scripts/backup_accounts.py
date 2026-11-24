"""Nightly copy of the accounts database (data/constrainbow.db, see project/accounts.py).

Run from the repo root (the server's cron does, right after the games are made):
    env/bin/python scripts/backup_accounts.py

Writes data/backups/accounts-YYYY-MM-DD.db with SQLite's own backup, which is safe while the app is
writing, and keeps the newest KEEP copies. On the server it runs as the app's own user
("constrainbow"): opening the database as root could leave root-owned -wal/-shm files the app then
can't use. data/ is git-ignored and readable only by its owner, since it holds usernames and password
hashes. deploy.sh copies the server's backups down to this computer (backups/, also git-ignored), so
there's a copy off the server too.
"""
import os
import sqlite3
from datetime import datetime
from zoneinfo import ZoneInfo

DB_PATH = "data/constrainbow.db"
BACKUP_FOLDER = "data/backups"
KEEP = 30


def main():
    if not os.path.exists(DB_PATH):
        print("no accounts database yet, nothing to back up")
        return
    os.makedirs(BACKUP_FOLDER, mode=0o700, exist_ok=True)
    os.chmod(BACKUP_FOLDER, 0o700)
    day = datetime.now(ZoneInfo("America/New_York")).strftime("%Y-%m-%d")
    target = os.path.join(BACKUP_FOLDER, f"accounts-{day}.db")
    temp = target + ".tmp"
    source = sqlite3.connect(DB_PATH, timeout=30)
    copy = sqlite3.connect(temp)
    with copy:
        source.backup(copy)
    users = copy.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    copy.close()
    source.close()
    os.chmod(temp, 0o600)
    os.replace(temp, target)  # a half-written copy never takes a real backup's name

    backups = sorted(name for name in os.listdir(BACKUP_FOLDER)
                     if name.startswith("accounts-") and name.endswith(".db"))
    for old in backups[:-KEEP]:
        os.remove(os.path.join(BACKUP_FOLDER, old))
    print(f"{datetime.now():%Y-%m-%d %H:%M} backed up {users} accounts to {target}, "
          f"{min(len(backups), KEEP)} backups kept")


if __name__ == "__main__":
    main()
