
import os
import logging
import time
from typing import List, Optional, Union
from fastapi import FastAPI, HTTPException, Body, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer
import torch

# --- Configuration ---
MODEL_NAME = os.getenv("MODEL_NAME", "all-MiniLM-L6-v2")
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# --- Logging Setup ---
logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("logs/app.log")
    ]
)
logger = logging.getLogger("embedding-service")

# --- App Definition ---
app = FastAPI(
    title="Local Embedding Service",
    description="OpenAI-compatible embedding API using Sentence-Transformers",
    version="1.0.0"
)

# --- Global Model Holder ---
model: Optional[SentenceTransformer] = None

@app.on_event("startup")
async def load_model():
    global model
    logger.info(f"Loading model: {MODEL_NAME} on {DEVICE}...")
    try:
        # Load model from local cache if available, otherwise download
        model = SentenceTransformer(MODEL_NAME, device=DEVICE)
        logger.info("Model loaded successfully.")
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        raise RuntimeError(f"Could not load model {MODEL_NAME}")

# --- Data Models (OpenAI Compatible) ---
class EmbeddingRequest(BaseModel):
    input: Union[str, List[str]] = Field(..., description="Input text to embed")
    model: Optional[str] = Field(None, description="Model name (ignored)")
    encoding_format: Optional[str] = Field("float", description="float or base64 (only float supported)")

class Usage(BaseModel):
    prompt_tokens: int
    total_tokens: int

class EmbeddingObject(BaseModel):
    object: str = "embedding"
    index: int
    embedding: List[float]

class EmbeddingResponse(BaseModel):
    object: str = "list"
    data: List[EmbeddingObject]
    model: str
    usage: Usage

# --- Middleware for Timing/Logging ---
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    logger.debug(f"Path: {request.url.path} Method: {request.method} Time: {process_time:.4f}s")
    return response

# --- Endpoints ---

@app.get("/health")
async def health_check():
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    return {"status": "healthy", "device": DEVICE, "model": MODEL_NAME}

@app.post("/v1/embeddings", response_model=EmbeddingResponse)
async def create_embeddings(request: EmbeddingRequest):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not initialized")

    inputs = request.input
    if isinstance(inputs, str):
        inputs = [inputs]

    if not inputs:
        raise HTTPException(status_code=400, detail="Input cannot be empty")

    try:
        # Measure inference time
        start_inf = time.time()
        
        # Normalize embeddings is common for RAG
        embeddings = model.encode(inputs, convert_to_numpy=True, normalize_embeddings=True)
        
        inf_time = time.time() - start_inf
        logger.info(f"Batch size: {len(inputs)}, Inference time: {inf_time:.4f}s")

        data = []
        total_tokens = 0 # Approximation: 1 word ~= 1.3 tokens or just use char len / 4
        
        for i, emb in enumerate(embeddings):
            # Simple token estimation
            tokens = len(inputs[i]) // 4
            total_tokens += tokens
            
            data.append(EmbeddingObject(
                index=i,
                embedding=emb.tolist()
            ))

        return EmbeddingResponse(
            data=data,
            model=MODEL_NAME,
            usage=Usage(prompt_tokens=total_tokens, total_tokens=total_tokens)
        )

    except Exception as e:
        logger.error(f"Embedding generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
