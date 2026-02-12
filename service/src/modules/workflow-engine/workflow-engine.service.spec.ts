import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowEngineService } from './workflow-engine.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { RagService } from '../rag/rag.service';
import { ModelConfigService } from '../llm/model-config.service';

describe('WorkflowEngineService', () => {
  let service: WorkflowEngineService;
  let prisma: PrismaService;
  let llmService: LlmService;
  let ragService: RagService;

  const mockPrisma = {
    workflow: {
      findUnique: jest.fn(),
    },
  };

  const mockLlmService = {
    chatCompletion: jest.fn(),
  };

  const mockRagService = {
    retrieve: jest.fn(),
  };

  const mockModelConfigService = {
    embeddingModel: 'text-embedding-mock',
    defaultChatModel: 'gpt-mock',
    semanticAnalysisModel: 'gpt-mock',
    fallbackModel: 'gpt-mock',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowEngineService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LlmService, useValue: mockLlmService },
        { provide: RagService, useValue: mockRagService },
        { provide: ModelConfigService, useValue: mockModelConfigService },
      ],
    }).compile();

    service = module.get<WorkflowEngineService>(WorkflowEngineService);
    prisma = module.get<PrismaService>(PrismaService);
    llmService = module.get<LlmService>(LlmService);
    ragService = module.get<RagService>(RagService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('executeWorkflow', () => {
    it('should execute a RAG workflow successfully', async () => {
      // Mock Data
      const workflowId = 'test-workflow';
      const graphData = JSON.stringify({
        nodes: [
          { id: '1', type: 'start' },
          { id: '2', type: 'semantic-analysis' },
          { id: '3', type: 'knowledge-base', data: { knowledgeBaseId: 'kb1' } },
          { id: '4', type: 'llm', data: { prompt: 'Context: {{context}}\nQ: {{user_input}}' } },
          { id: '5', type: 'end' }
        ],
        edges: [
          { source: '1', target: '2' },
          { source: '2', target: '3' },
          { source: '3', target: '4' },
          { source: '4', target: '5' }
        ]
      });

      mockPrisma.workflow.findUnique.mockResolvedValue({
        id: workflowId,
        name: 'RAG Flow',
        graphData
      });

      // Mocks for Semantic Analysis
      mockLlmService.chatCompletion.mockResolvedValueOnce(JSON.stringify({
        intent: 'technical_question',
        keywords: ['docker', 'windows']
      }));

      // Mocks for RAG
      mockRagService.retrieve.mockResolvedValue([
        { id: 'c1', content: 'Doc Content 1', score: 0.9, metadata: { documentId: 'd1' } }
      ]);

      // Mocks for LLM Generation
      mockLlmService.chatCompletion.mockResolvedValueOnce('Final Answer');

      // Execute
      const result = await service.executeWorkflow(workflowId, {
        userId: 'u1',
        conversationId: 'c1',
        input: 'How to install docker?',
        history: []
      });

      // Assertions
      expect(result).toBe('Final Answer');
      
      // Verify Semantic Analysis
      expect(mockLlmService.chatCompletion).toHaveBeenNthCalledWith(1, 
        expect.arrayContaining([{ role: 'user', content: expect.stringContaining('Analyze the following query') }]), 
        expect.objectContaining({ model: 'gpt-mock' })
      );

      // Verify RAG
      expect(mockRagService.retrieve).toHaveBeenCalledWith('kb1', 'docker windows');

      // Verify LLM Prompt Construction
      expect(mockLlmService.chatCompletion).toHaveBeenNthCalledWith(2,
        expect.arrayContaining([{ role: 'user', content: expect.stringContaining('Doc Content 1') }]),
        expect.objectContaining({ model: 'gpt-mock' })
      );
    });

    it('should retry on failure', async () => {
      // Mock Data
       const workflowId = 'retry-test';
       const graphData = JSON.stringify({
        nodes: [
          { id: '1', type: 'start' },
          { id: '2', type: 'llm' },
          { id: '3', type: 'end' }
        ],
        edges: [
          { source: '1', target: '2' },
          { source: '2', target: '3' }
        ]
      });

      mockPrisma.workflow.findUnique.mockResolvedValue({
        id: workflowId,
        graphData
      });

      // Fail twice then succeed
      mockLlmService.chatCompletion
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValue('Success');

      const result = await service.executeWorkflow(workflowId, {
        userId: 'u1',
        conversationId: 'c1',
        input: 'Hi',
        history: []
      });

      expect(result).toBe('Success');
      expect(mockLlmService.chatCompletion).toHaveBeenCalledTimes(3);
    });
  });
});