import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
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
    private prisma: PrismaService,
    private llmService: LlmService,
  ) {}

  async onModuleInit() {
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
    // 1. Create Document record
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
      // 2. Parse & Chunk
      const content = file.buffer.toString('utf-8'); // TODO: Support PDF/Word with pdf-parse
      const chunks = this.chunkText(content);

      // 3. Embedding & Save
      const records = [];
      for (const chunkContent of chunks) {
        // DB Record
        const chunk = await this.prisma.chunk.create({
          data: {
            documentId: document.id,
            content: chunkContent,
          },
        });

        // Vector Record
        const vector = await this.llmService.getEmbedding(chunkContent);
        records.push({
          id: chunk.id,
          vector,
          content: chunkContent,
          documentId: document.id,
          knowledgeBaseId,
        });
      }

      if (records.length > 0) {
        await this.table.add(records);
      }

      // 4. Update status
      await this.prisma.document.update({
        where: { id: document.id },
        data: { status: 'indexed' },
      });

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

  async retrieve(knowledgeBaseId: string, query: string, topK = 3): Promise<string[]> {
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
    
    return results.map((r: any) => r.content as string);
  }

  private chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start += chunkSize - overlap;
    }
    return chunks;
  }
}
