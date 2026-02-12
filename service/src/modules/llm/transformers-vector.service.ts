
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { env, pipeline } from '@xenova/transformers';
import { VectorService } from './vector.interface';
import * as path from 'path';

@Injectable()
export class TransformersVectorService implements VectorService, OnModuleInit {
  private readonly logger = new Logger(TransformersVectorService.name);
  private extractor: any = null;
  private readonly MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';

  constructor() {
    // Configure cache directory to be local to the project to avoid downloading every time in new envs
    // or use default if preferred.
    env.cacheDir = path.join(process.cwd(), 'models');
    env.allowLocalModels = true; // Changed to true to prioritize local models if present
    
    // Set Hugging Face mirror if provided in env, or use a default mirror if network is an issue
    if (process.env.HF_ENDPOINT) {
        // @xenova/transformers uses HF_ENDPOINT env var internally if set, 
        // but we can also set it explicitly on env object if needed, though type definition might not show it.
        // Actually, for xenova/transformers 2.x, it respects process.env.HF_ENDPOINT
    } else {
        // Optional: Set a default mirror if we know we are in a region with poor HF connectivity (e.g. CN)
        // process.env.HF_ENDPOINT = 'https://hf-mirror.com'; 
    }
  }

  async onModuleInit() {
    // Lazy load or eager load? Eager load might slow down startup.
    // Let's do lazy load but trigger it if this service is instantiated.
    // However, since we might not use it if config says 'http', we should be careful.
    // But this service is provided by LlmModule, so it will be instantiated.
    // Let's just log.
    this.logger.log('TransformersVectorService initialized. Model will be loaded on first use.');
  }

  private async ensureModelLoaded() {
    if (!this.extractor) {
      this.logger.log(`Loading local embedding model: ${this.MODEL_NAME}...`);
      try {
        this.extractor = await pipeline('feature-extraction', this.MODEL_NAME);
        this.logger.log('Local embedding model loaded successfully.');
      } catch (error) {
        this.logger.error('Failed to load local embedding model', error);
        throw error;
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
        // Checking availability implies checking if we can load the model or it is loaded.
        // We don't want to load it just to check availability if we aren't going to use it.
        // But if this method is called, it means we likely want to use it.
        // Let's just return true as this is an in-process library, unless we are in an environment where it doesn't work.
        return true;
    } catch (e) {
        return false;
    }
  }

  async getEmbedding(text: string): Promise<number[]> {
    await this.ensureModelLoaded();
    const output = await this.extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  async getEmbeddings(texts: string[]): Promise<number[][]> {
    await this.ensureModelLoaded();
    const results = await this.extractor(texts, { pooling: 'mean', normalize: true });
    // When input is array, output.data is a flattened Float32Array or Tensor.
    // We need to reshape it.
    // However, @xenova/transformers pipeline with array input returns a Tensor with shape [batch_size, hidden_size]
    // or a list of Tensors depending on version/config.
    // Let's check documentation behavior: pipeline('feature-extraction') usually returns a Tensor.
    
    // If results is a Tensor object:
    if (results.dims && results.data) {
        const [batchSize, hiddenSize] = results.dims;
        const embeddings: number[][] = [];
        for (let i = 0; i < batchSize; i++) {
            const start = i * hiddenSize;
            const end = start + hiddenSize;
            embeddings.push(Array.from(results.data.slice(start, end)));
        }
        return embeddings;
    }
    
    // Fallback if behavior differs (e.g. older versions)
    // But standard behavior for feature-extraction is Tensor.
    throw new Error('Unexpected output format from transformers pipeline');
  }
}
