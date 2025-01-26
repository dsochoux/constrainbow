#!/bin/bash

# Navigate to your project directory
cd /path/to/your/project

# Pull the latest code
git pull origin deploy

# Install any new dependencies
pip install -r requirements.txt

# Restart the Flask application (use the method you're using, e.g., systemd, supervisor, etc.)
sudo systemctl restart flask-app.service  # Adjust this if you're using a different method to run your app
