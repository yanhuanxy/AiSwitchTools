import { Injectable, OnModuleInit, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { DocumentProcessorService } from './document-processor.service';
import * as vectordb from 'vectordb';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class RagService implements OnModuleInit {
  private readonly logger = new Logger(RagService.name);
  private db!: vectordb.Connection;
  private table!: vectordb.Table;
  private readonly tableName = 'chunks';

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LlmService) private readonly llmService: LlmService,
    @Inject(DocumentProcessorService) private readonly documentProcessor: DocumentProcessorService,
  ) {
    if (!this.prisma) {
        this.logger.error('PrismaService is not injected in RagService');
    }
    if (!this.llmService) {
        this.logger.error('LlmService is not injected in RagService');
    }
    if (!this.documentProcessor) {
        this.logger.error('DocumentProcessorService is not injected in RagService');
    }
  }

  async onModuleInit() {
    // Check Prisma Connection
    try {
        if (!this.prisma) throw new Error('PrismaService is null');
        // Simple check if document model exists
        if (!this.prisma.document) {
            throw new Error('Prisma Client does not have Document model. Please run "npx prisma generate"');
        }
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        this.logger.error(`RagService Initialization Failed: ${message}`);
        throw e; // Fail startup if critical dependency is missing
    }

    // Initialize LanceDB
    const dbPath = path.join(process.cwd(), 'data', 'lancedb');
    if (!fs.existsSync(dbPath)) {
      fs.mkdirSync(dbPath, { recursive: true });
    }
    this.db = await vectordb.connect(dbPath);
    
    // Check/Create Table
    const tableNames = await this.db.tableNames();
    if (!tableNames.includes(this.tableName)) {
      this.logger.log(`Creating LanceDB table: ${this.tableName}`);
      // Create with a dummy record to define schema
      await this.db.createTable(this.tableName, [
        { 
          id: 'init', 
          vector: Array(1536).fill(0), 
          content: 'init', 
          documentId: 'init',
          knowledgeBaseId: 'init'
        }
      ]);
    }
    this.table = await this.db.openTable(this.tableName);
    this.logger.log('LanceDB initialized');
  }

  async ingestDocument(
    userId: string,
    knowledgeBaseId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
  ) {
    if (!userId) throw new Error('User ID is required');
    if (!knowledgeBaseId) throw new Error('Knowledge Base ID is required');
    if (!file || !file.buffer) throw new Error('Invalid file provided');

    // 1. Create Document record
    if (!this.prisma || !this.prisma.document) {
       this.logger.error('PrismaService or Document model not initialized');
       throw new Error('Database connection failed');
    }

    const document = await this.prisma.document.create({
      data: {
        knowledgeBaseId,
        name: file.originalname,
        mimeType: file.mimetype,
        size: file.buffer.length,
        storageKey: `local_storage/${Date.now()}_${file.originalname}`,
        status: 'processing',
      },
    });

    try {
      await this.retryOperation(async () => {
        // 2. Parse & Chunk with DocumentProcessor
        const chunks = await this.documentProcessor.processFile(file.buffer, file.mimetype);
        this.logger.log(`Document parsed into ${chunks.length} chunks`);

        // 3. Embedding & Save
        const records: any[] = [];
        // Use concurrency control for embedding requests (simple batching)
        const BATCH_SIZE = 5;
        
        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
          const batch = chunks.slice(i, i + BATCH_SIZE);
          await Promise.all(batch.map(async (chunkData) => {
            // DB Record
            const chunk = await this.prisma.chunk.create({
              data: {
                documentId: document.id,
                content: chunkData.content,
                // Store metadata if schema supports it, for now we skip or store in embedding logic
              },
            });

            // Vector Record
            const vector = await this.llmService.getEmbedding(chunkData.content);
            records.push({
              id: chunk.id,
              vector,
              content: chunkData.content,
              documentId: document.id,
              knowledgeBaseId,
              metadata: JSON.stringify(chunkData.metadata), // Store rich metadata
            });
          }));
        }

        if (records.length > 0) {
          await this.table.add(records);
        }

        // 4. Update status
        await this.prisma.document.update({
          where: { id: document.id },
          data: { status: 'indexed' },
        });
      }, 3, 1000);

      return document;
    } catch (error) {
      this.logger.error('Ingestion failed', error);
      await this.prisma.document.update({
        where: { id: document.id },
        data: { status: 'failed' },
      });
      throw error;
    }
  }

  private async retryOperation<T>(operation: () => Promise<T>, maxRetries: number = 3, initialDelay: number = 1000): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const delay = initialDelay * Math.pow(2, i);
        this.logger.warn(`Operation failed (attempt ${i + 1}/${maxRetries}), retrying in ${delay}ms... Error: ${error instanceof Error ? error.message : String(error)}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  }

  async retrieve(knowledgeBaseId: string, query: string, topK = 3): Promise<any[]> {
    const queryVector = await this.llmService.getEmbedding(query);
    
    // Vector Search with LanceDB
    const results = await this.table
      .search(queryVector)
      .where(`knowledgeBaseId = '${knowledgeBaseId}'`)
      .limit(topK)
      .execute();

    if (results.length === 0) {
      return [];
    }
    
    // Return rich results with score (converted from distance if needed)
    return results.map((r: any) => ({
      id: r.id,
      content: r.content as string,
      score: 1 - (r._distance || 0), // Approx score from distance
      metadata: {
        documentId: r.documentId
      }
    }));
  }

  async deleteDocument(userId: string, documentId: string) {
    // 1. Check ownership
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { knowledgeBase: true },
    });

    if (!document || document.knowledgeBase.ownerUserId !== userId) {
      throw new Error('Document not found or access denied');
    }

    // 2. Delete from LanceDB
    // Note: LanceDB delete syntax might vary by version. 
    // If not supported efficiently, we might skip or use filter in query.
    // For now, let's try to delete if possible, or just accept that it stays in vector db until we rebuild index.
    // However, the retrieve method filters by knowledgeBaseId. 
    // To strictly remove, we should ideally delete. 
    try {
        await this.table.delete(`documentId = '${documentId}'`);
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        this.logger.warn(`Failed to delete from LanceDB: ${message}`);
    }

    // 3. Delete from Prisma (Cascades chunks usually if configured, but let's be safe)
    await this.prisma.chunk.deleteMany({ where: { documentId } });
    await this.prisma.document.delete({ where: { id: documentId } });

    return { success: true };
  }
}
