
FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create logs directory
RUN mkdir -p logs

# Copy application code
COPY app ./app
COPY scripts ./scripts

# Environment variables
ENV PYTHONPATH=/app
ENV MODEL_NAME=all-MiniLM-L6-v2
ENV SENTENCE_TRANSFORMERS_HOME=/app/models

# Pre-download model during build (optional, increases image size but speeds up startup)
# RUN python scripts/download_model.py

# Expose port
EXPOSE 8000

# Start command
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
