
import os
from sentence_transformers import SentenceTransformer
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MODEL_NAME = os.getenv("MODEL_NAME", "all-MiniLM-L6-v2")
CACHE_DIR = os.getenv("SENTENCE_TRANSFORMERS_HOME", "./models")

def download():
    logger.info(f"Downloading model {MODEL_NAME} to {CACHE_DIR}...")
    try:
        # This will download the model to the specified cache directory
        # If cache_folder is not specified, it uses default (~/.cache/torch/...)
        # We can enforce a local directory for easier Docker volume mapping
        model = SentenceTransformer(MODEL_NAME, cache_folder=CACHE_DIR)
        model.save(os.path.join(CACHE_DIR, MODEL_NAME))
        logger.info("Download complete.")
    except Exception as e:
        logger.error(f"Download failed: {e}")
        exit(1)

if __name__ == "__main__":
    download()
