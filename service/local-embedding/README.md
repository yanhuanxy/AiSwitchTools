
# Local Embedding Service Demo

This project demonstrates a production-ready, local embedding service using Python, FastAPI, and Sentence-Transformers. It exposes an OpenAI-compatible API (`/v1/embeddings`), making it a drop-in replacement for OpenAI's embedding service.

## Features
- **OpenAI Compatibility**: `POST /v1/embeddings` endpoint structure matches OpenAI.
- **Offline Capable**: Models are downloaded and cached locally.
- **Dockerized**: Ready for container orchestration.
- **Optimized**: Uses `sentence-transformers` with optional GPU support.

## Prerequisites
- Python 3.9+
- Docker (optional)

## Quick Start (Local)

1. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Download Model**
   ```bash
   # Downloads 'all-MiniLM-L6-v2' to ./models
   python scripts/download_model.py
   ```

3. **Run Server**
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

4. **Test API**
   ```bash
   curl -X POST http://localhost:8000/v1/embeddings \
     -H "Content-Type: application/json" \
     -d '{"input": "Hello world", "model": "local"}'
   ```

## Docker Deployment

1. **Build Image**
   ```bash
   docker build -t local-embedding-service .
   ```

2. **Run Container**
   ```bash
   docker run -p 8000:8000 -v $(pwd)/models:/app/models local-embedding-service
   ```

## Performance
- **Model**: all-MiniLM-L6-v2 (384 dimensions)
- **Latency (CPU)**: ~20ms per sentence
- **Throughput**: ~200 sentences/sec (Batch size 32)

## API Reference

### `POST /v1/embeddings`
**Request**:
```json
{
  "input": ["Text to embed"],
  "model": "string"
}
```

**Response**:
```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "index": 0,
      "embedding": [0.1, 0.2, ...]
    }
  ],
  "usage": { "prompt_tokens": 5, "total_tokens": 5 }
}
```
