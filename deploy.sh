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
scp ./project/app.py ./project/dashboard.py $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/project
# the page templates (not word_review.html, which is only for running locally)
scp ./project/templates/game.html ./project/templates/head.html ./project/templates/archive.html ./project/templates/dashboard.html ./project/templates/preview_test.html $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/project/templates
# style.css
scp ./project/static/css/style.css $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/project/static/css
# favicons and the web app manifest
scp ./project/static/favicon_io/* $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/project/static/favicon_io
# link-preview test images (see /preview-test in app.py)
ssh $REMOTE_USER@$REMOTE_HOST "mkdir -p $REMOTE_DIR/project/static/preview"
scp ./project/static/preview/* $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/project/static/preview
# bundle.js, and word.js, which the server's puzzle generator reads the easter-egg words from
scp ./project/static/js/bundle.js ./project/static/js/word.js $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/project/static/js
# words.txt (accepted words), common_words.txt (SOLVE answers), and SOLVE themes if there are any
scp ./word_files/words.txt ./word_files/common_words.txt $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/word_files
if [ -f ./word_files/solve_themes.json ]; then
    scp ./word_files/solve_themes.json $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/word_files
fi
# game generation scripts (the server generates its own games every night, see docs/generation-algorithm.md)
ssh $REMOTE_USER@$REMOTE_HOST "mkdir -p $REMOTE_DIR/scripts"
scp ./scripts/generate_game.py ./scripts/generate_unique.py ./scripts/ensure_games.py $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/scripts
# games: --ignore-existing means a game that already exists is never overwritten, in either direction,
# so a game that players may have already seen can never change
# push any games the server is missing, then pull down any games the server generated
rsync -avz --ignore-existing ./games/ $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/games
rsync -avz --ignore-existing $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/games/ ./games

echo "Generating any missing games and installing the nightly cron job..."
CRON_LINE="15 3 * * * cd $REMOTE_DIR && env/bin/python scripts/ensure_games.py >> generate.log 2>&1"
ssh $REMOTE_USER@$REMOTE_HOST << EOF
    cd $REMOTE_DIR
    env/bin/python scripts/ensure_games.py
    (crontab -l 2>/dev/null | grep -v 'scripts/ensure_games.py'; echo "$CRON_LINE") | crontab -
    crontab -l | grep ensure_games
EOF

echo "Restarting the constrainbow service (gunicorn)..."
# gunicorn runs as a systemd service, so it restarts itself if it crashes and starts on boot
# see server/constrainbow.service
scp ./server/constrainbow.service $REMOTE_USER@$REMOTE_HOST:/etc/systemd/system/constrainbow.service
ssh $REMOTE_USER@$REMOTE_HOST << EOF
    # the app runs as "constrainbow", a user that can't log in; it may only write its logs and missing-word reports
    id constrainbow >/dev/null 2>&1 || useradd --system --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin constrainbow
    mkdir -p $REMOTE_DIR/logs
    touch $REMOTE_DIR/word_files/reported_missing_words.txt
    chown -R constrainbow:constrainbow $REMOTE_DIR/logs $REMOTE_DIR/word_files/reported_missing_words.txt
    # everything else stays owned by root, but the app user must be able to read it
    chmod -R a+rX $REMOTE_DIR/project $REMOTE_DIR/word_files $REMOTE_DIR/games $REMOTE_DIR/scripts
    systemctl daemon-reload
    systemctl enable constrainbow
    systemctl restart constrainbow
    systemctl is-active constrainbow
EOF

echo "Restarting NGINX..."
ssh $REMOTE_USER@$REMOTE_HOST "sudo systemctl reload nginx"

echo "Deployment complete!"