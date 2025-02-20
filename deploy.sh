#!/bin/bash

REMOTE_USER="root"
REMOTE_HOST="constrainbow.com"
REMOTE_DIR="constrainbow"


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
scp ./project/app.py $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/project
# game.html
scp ./project/templates/game.html $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/project/templates
# style.css
scp ./project/static/css/style.css $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/project/static/css
# bundle.js
scp ./project/static/js/bundle.js $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/project/static/js
# words.txt
scp ./word_files/words.txt $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/word_files
# games
rsync -avz ./games/ $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/games

echo "Restarting gunicorn..."
ssh $REMOTE_USER@$REMOTE_HOST << EOF
    cd $REMOTE_DIR
    source env/bin/activate
    pkill gunicorn
    nohup gunicorn -w 4 project.app:app -b 0.0.0.0:5001 > gunicorn.log 2>&1 &
EOF

echo "Restarting NGINX..."
ssh $REMOTE_USER@$REMOTE_HOST "sudo systemctl reload nginx"

echo "Deployment complete!"