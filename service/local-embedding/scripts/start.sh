
#!/bin/bash
echo "Starting Local Embedding Service..."

# Ensure virtualenv
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python -m venv venv
fi

source venv/bin/activate

# Install deps
echo "Installing dependencies..."
pip install -r requirements.txt

# Download model if not exists
if [ ! -d "models/all-MiniLM-L6-v2" ]; then
    echo "Downloading model..."
    export SENTENCE_TRANSFORMERS_HOME=./models
    python scripts/download_model.py
fi

# Start server in background
echo "Starting Uvicorn..."
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > logs/server.log 2>&1 &
echo "Service started with PID $!"
echo "Logs available at logs/server.log"
