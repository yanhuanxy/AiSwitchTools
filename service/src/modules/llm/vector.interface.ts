
import { Injectable } from '@nestjs/common';

export interface VectorService {
  /**
   * Get vector embedding for a single text.
   * @param text The text to embed.
   * @returns A promise that resolves to the embedding vector.
   */
  getEmbedding(text: string): Promise<number[]>;

  /**
   * Get vector embeddings for multiple texts.
   * @param texts The array of texts to embed.
   * @returns A promise that resolves to an array of embedding vectors.
   */
  getEmbeddings(texts: string[]): Promise<number[][]>;

  /**
   * Check if the vector service is available.
   * @returns A promise that resolves to true if available, false otherwise.
   */
  isAvailable(): Promise<boolean>;
}

export interface EmbeddingRequestDto {
  input: string | string[];
  model?: string;
  encoding_format?: 'float';
}

export interface EmbeddingObjectDto {
  object: 'embedding';
  index: number;
  embedding: number[];
}

export interface UsageDto {
  prompt_tokens: number;
  total_tokens: number;
}

export interface EmbeddingResponseDto {
  object: 'list';
  data: EmbeddingObjectDto[];
  model: string;
  usage: UsageDto;
}
