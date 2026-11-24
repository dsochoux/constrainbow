#!/bin/bash

REMOTE_USER="root"
REMOTE_HOST="constrainbow.com"
REMOTE_DIR="/srv/constrainbow"  # the app runs from here as the unprivileged user "constrainbow"


read -p "Have you updated your bundle.js and is game.html using it? (Y/n) " confirm
confirm=$(echo "$confirm" | tr '[:upper:]' '[:lower:]')
if [[ "$confirm" == "y" || "$confirm" == "" ]]; then
    echo "Continuing with deployment..."
else
    echo "Building bundle.js, then aborting..."
    esbuild ./project/static/js/script.js --bundle --minify --outfile=./project/static/js/bundle.js
    exit 1
fi

read -p "No development changes remain in app.py? (Y/n) " confirm
confirm=$(echo "$confirm" | tr '[:upper:]' '[:lower:]')
if [[ "$confirm" == "y" || "$confirm" == "" ]]; then
    echo "Continuing with deployment..."
else
    echo "Aborting..."
    exit 1
fi

echo "Syncing files..."
# app.py
scp ./project/app.py ./project/dashboard.py ./project/accounts.py $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/project
# the page templates (not word_review.html, which is only for running locally)
scp ./project/templates/game.html ./project/templates/head.html ./project/templates/archive.html ./project/templates/dashboard.html ./project/templates/preview_test.html $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/project/templates
# style.css and eggs.css (the easter eggs)
scp ./project/static/css/style.css ./project/static/css/eggs.css $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/project/static/css
# favicons and the web app manifest
scp ./project/static/favicon_io/* $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/project/static/favicon_io
# link-preview test images (see /preview-test in app.py)
ssh $REMOTE_USER@$REMOTE_HOST "mkdir -p $REMOTE_DIR/project/static/preview"
scp ./project/static/preview/* $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/project/static/preview
# bundle.js, and word.js, which the server's puzzle generator reads the easter-egg words from
scp ./project/static/js/bundle.js ./project/static/js/word.js $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/project/static/js
# compressed copies of the big text files, which nginx sends to browsers instead of compressing on every
# request (gzip_static; see server/nginx-static.conf). Made fresh on every deploy, right after the files
# they copy: a stale .gz would serve an old version
ssh $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_DIR/project/static && gzip -9 -k -f css/style.css css/eggs.css js/bundle.js"
# words.txt (accepted words), common_words.txt (SOLVE answers), and SOLVE themes if there are any
scp ./word_files/words.txt ./word_files/common_words.txt $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/word_files
if [ -f ./word_files/solve_themes.json ]; then
    scp ./word_files/solve_themes.json $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/word_files
fi
# game generation scripts (the server generates its own games every night, see docs/generation-algorithm.md)
ssh $REMOTE_USER@$REMOTE_HOST "mkdir -p $REMOTE_DIR/scripts"
scp ./scripts/generate_game.py ./scripts/generate_unique.py ./scripts/ensure_games.py ./scripts/backup_accounts.py $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/scripts
# games: --ignore-existing means a game that already exists is never overwritten, in either direction,
# so a game that players may have already seen can never change
# push any games the server is missing, then pull down any games the server generated
rsync -avz --ignore-existing ./games/ $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/games
rsync -avz --ignore-existing $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/games/ ./games

echo "Generating any missing games and installing the nightly cron jobs..."
# 3:15 (server time, UTC): make any missing games; 3:30: back up the accounts database to data/backups/,
# as the app's own user (see scripts/backup_accounts.py)
CRON_LINE="15 3 * * * cd $REMOTE_DIR && env/bin/python scripts/ensure_games.py >> generate.log 2>&1"
BACKUP_LINE="30 3 * * * cd $REMOTE_DIR && runuser -u constrainbow -- env/bin/python scripts/backup_accounts.py >> backup.log 2>&1"
ssh $REMOTE_USER@$REMOTE_HOST << EOF
    cd $REMOTE_DIR
    env/bin/python scripts/ensure_games.py
    (crontab -l 2>/dev/null | grep -v -e 'scripts/ensure_games.py' -e 'scripts/backup_accounts.py'; echo "$CRON_LINE"; echo "$BACKUP_LINE") | crontab -
    crontab -l | grep -e ensure_games -e backup_accounts
EOF

echo "Restarting the constrainbow service (gunicorn)..."
# gunicorn runs as a systemd service, so it restarts itself if it crashes and starts on boot
# see server/constrainbow.service
scp ./server/constrainbow.service $REMOTE_USER@$REMOTE_HOST:/etc/systemd/system/constrainbow.service
ssh $REMOTE_USER@$REMOTE_HOST << EOF
    # the app runs as "constrainbow", a user that can't log in; it may only write its logs, missing-word reports and data/
    id constrainbow >/dev/null 2>&1 || useradd --system --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin constrainbow
    mkdir -p $REMOTE_DIR/logs $REMOTE_DIR/data
    touch $REMOTE_DIR/word_files/reported_missing_words.txt
    chown -R constrainbow:constrainbow $REMOTE_DIR/logs $REMOTE_DIR/data $REMOTE_DIR/word_files/reported_missing_words.txt
    # the accounts database and session secret: only the app may read them
    chmod 700 $REMOTE_DIR/data
    # everything else stays owned by root, but the app user must be able to read it
    chmod -R a+rX $REMOTE_DIR/project $REMOTE_DIR/word_files $REMOTE_DIR/games $REMOTE_DIR/scripts
    systemctl daemon-reload
    systemctl enable constrainbow
    systemctl restart constrainbow
    systemctl is-active constrainbow
EOF

echo "Copying the server's accounts backups to this computer..."
# a copy of the accounts database off the server, in case the server's disk is ever lost (backups/ is
# git-ignored: it holds usernames and password hashes)
mkdir -p ./backups && chmod 700 ./backups
rsync -az $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/data/backups/ ./backups/ 2>/dev/null || echo "(no backups on the server yet)"

echo "Restarting NGINX..."
ssh $REMOTE_USER@$REMOTE_HOST "sudo systemctl reload nginx"

echo "Deployment complete!"