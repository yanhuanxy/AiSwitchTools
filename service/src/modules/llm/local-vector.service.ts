
import { Injectable, Logger, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { VectorService, EmbeddingResponseDto } from './vector.interface';
import { ModelConfigService } from './model-config.service';
import { TransformersVectorService } from './transformers-vector.service';

@Injectable()
export class LocalVectorService implements VectorService {
  private readonly logger = new Logger(LocalVectorService.name);

  constructor(
    @Inject(ModelConfigService) private readonly modelConfigService: ModelConfigService,
    @Inject(HttpService) private readonly httpService: HttpService,
    @Inject(TransformersVectorService) private readonly transformersVectorService: TransformersVectorService,
  ) {}

  async isAvailable(): Promise<boolean> {
    if (this.modelConfigService.localEmbeddingType === 'in-process') {
        return this.transformersVectorService.isAvailable();
    }

    try {
      // HTTP Health Check
      await this.getEmbedding('ping');
      return true;
    } catch (error) {
      return false;
    }
  }

  async getEmbedding(text: string): Promise<number[]> {
    if (this.modelConfigService.localEmbeddingType === 'in-process') {
        return this.transformersVectorService.getEmbedding(text);
    }
    const embeddings = await this.getEmbeddings([text]);
    return embeddings[0];
  }

  async getEmbeddings(texts: string[]): Promise<number[][]> {
    if (this.modelConfigService.localEmbeddingType === 'in-process') {
        return this.transformersVectorService.getEmbeddings(texts);
    }

    let lastError: any;
    const retries = this.modelConfigService.localEmbeddingRetries;
    const url = this.modelConfigService.localEmbeddingUrl;
    const timeout = this.modelConfigService.localEmbeddingTimeout;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response$ = this.httpService.post<EmbeddingResponseDto>(url, {
          input: texts,
          model: this.modelConfigService.embeddingModel, 
        }, {
            timeout: timeout
        });
        
        const response = await firstValueFrom(response$);

        if (response.data && response.data.data) {
          // Sort by index to ensure order matches input
          return response.data.data
            .sort((a, b) => a.index - b.index)
            .map((item) => item.embedding);
        }
        throw new Error('Invalid response format from local vector service');
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `Local embedding attempt ${attempt}/${retries} failed: ${error}`,
        );
        if (attempt < retries) {
          // Exponential backoff: 200ms, 400ms, 800ms...
          await new Promise((resolve) => setTimeout(resolve, 200 * Math.pow(2, attempt - 1)));
        }
      }
    }

    this.logger.error('All local embedding attempts failed');
    throw lastError;
  }
}
