
from fastapi.testclient import TestClient
from app.main import app
import pytest

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_embedding_generation():
    payload = {
        "input": "Hello world",
        "model": "test-model"
    }
    response = client.post("/v1/embeddings", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["object"] == "list"
    assert len(data["data"]) == 1
    assert len(data["data"][0]["embedding"]) > 0
    # Check dimensions for all-MiniLM-L6-v2 (384)
    assert len(data["data"][0]["embedding"]) == 384

def test_batch_embedding():
    payload = {
        "input": ["Hello", "World"],
        "model": "test-model"
    }
    response = client.post("/v1/embeddings", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]) == 2

def test_empty_input():
    payload = {
        "input": [],
        "model": "test-model"
    }
    response = client.post("/v1/embeddings", json=payload)
    assert response.status_code == 400
