import { Injectable, OnModuleInit, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmService } from '../llm/llm.service';
import { ModelConfigService } from '../llm/model-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as vectordb from 'vectordb';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SmartIntentService implements OnModuleInit {
  private readonly logger = new Logger(SmartIntentService.name);
  private db!: vectordb.Connection;
  private table!: vectordb.Table;
  private tableName = 'workflow_templates';

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(LlmService) private readonly llmService: LlmService,
    @Inject(ModelConfigService) private readonly modelConfigService: ModelConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    const dbPath = path.join(process.cwd(), 'data', 'lancedb');
    if (!fs.existsSync(dbPath)) {
      fs.mkdirSync(dbPath, { recursive: true });
    }
    this.db = await vectordb.connect(dbPath);

    // Dynamic table name based on dimension to avoid schema conflicts
    const dimension = this.modelConfigService.embeddingDimension;
    this.tableName = `workflow_templates_${dimension}`;

    const tableNames = await this.db.tableNames();
    if (!tableNames.includes(this.tableName)) {
      this.logger.log(`Creating LanceDB table: ${this.tableName} (Dim: ${dimension})`);
      // Create schema: id, vector, content (description/name), metadata
      await this.db.createTable(this.tableName, [
        {
          id: 'init',
          vector: Array(dimension).fill(0),
          content: 'init',
          metadata: '{}', // JSON string
        },
      ]);
    }
    this.table = await this.db.openTable(this.tableName);
    this.logger.log(`SmartIntentService (LanceDB) initialized with table ${this.tableName}`);
  }

  async registerTemplate(template: { id: string; name: string; description?: string; tags?: string }) {
    const textToEmbed = `${template.name}\n${template.description || ''}\n${template.tags || ''}`;
    const vector = await this.llmService.getEmbedding(textToEmbed);

    await this.table.add([
      {
        id: template.id,
        vector,
        content: textToEmbed,
        metadata: JSON.stringify({ name: template.name, tags: template.tags }),
      },
    ]);
    this.logger.log(`Registered template ${template.id} in Vector DB`);
  }

  async resolve(query: string, history: any[]): Promise<{ intent: string; confidence: number; workflowId?: string; graphData?: any }> {
    // 1. Embedding
    const vector = await this.llmService.getEmbedding(query);

    // 2. Search
    const results = await this.table.search(vector).limit(5).execute();

    // 3. Rerank / Threshold (0.92)
    // LanceDB returns L2 distance by default for some indices, or cosine distance.
    // Assuming cosine distance (0=same, 1=opposite) or similar. 
    // Usually 1 - distance = similarity.
    // Let's assume standard behavior: lower distance = better.
    // If metric is cosine, score = 1 - distance.
    const threshold = 0.92;
    const bestMatch = results.find((r: any) => (1 - (r._distance || 0)) > threshold);

    if (bestMatch) {
      const distance = (bestMatch as any)._distance || 0;
      this.logger.log(`Matched existing template: ${bestMatch.id} (Score: ${1 - distance})`);
      return {
        intent: 'workflow',
        workflowId: bestMatch.id as string,
        confidence: 1 - distance,
      };
    }

    // 4. LLM Planning (Zero-shot)
    this.logger.log('No matching template found. Triggering Zero-shot Planning...');
    const plan = await this.generateDynamicPlan(query, history);
    
    return {
      intent: 'dynamic_workflow',
      confidence: 0.85, // Lower confidence for generated plans
      workflowId: `temp-${Date.now()}`,
      graphData: plan,
    };
  }

  async generateDynamicPlan(query: string, history: any[]): Promise<any> {
    const systemPrompt = `
You are an intelligent workflow planner.
Your goal is to generate a valid JSON DAG (Directed Acyclic Graph) for the user's request.
The output must be a valid JSON object with the following structure:
{
  "nodes": [
    { "id": "node1", "type": "start", "label": "Start" },
    { "id": "node2", "type": "llm", "label": "Analyze", "config": { "prompt": "..." } },
    { "id": "node3", "type": "end", "label": "End" }
  ],
  "edges": [
    { "source": "node1", "target": "node2" },
    { "source": "node2", "target": "node3" }
  ]
}
Supported node types: start, end, llm, semantic-analysis, tool-use.
Do NOT include markdown formatting (like \`\`\`json). Just return the JSON string.
`;

    const userPrompt = `Request: ${query}\nHistory Summary: ${JSON.stringify(history.slice(-3))}`;

    const jsonStr = await this.llmService.chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.1 }
    );

    try {
      // Attempt to clean markdown if present
      const cleaned = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      this.logger.error('Failed to parse generated plan', e);
      // Fallback simple plan
      return {
        nodes: [
          { id: 'start', type: 'start', label: 'Start' },
          { id: 'llm', type: 'llm', label: 'LLM Reply', config: { prompt: query } },
          { id: 'end', type: 'end', label: 'End' }
        ],
        edges: [
          { source: 'start', target: 'llm' },
          { source: 'llm', target: 'end' }
        ]
      };
    }
  }
}
