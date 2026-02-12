
import { Test, TestingModule } from '@nestjs/testing';
import { ModelConfigService } from './model-config.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

describe('ModelConfigService', () => {
  let service: ModelConfigService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModelConfigService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ModelConfigService>(ModelConfigService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('configuration loading', () => {
    it('should load configuration from environment variables', () => {
      mockConfigService.get.mockImplementation((key, def) => {
        if (key === 'EMBEDDING_MODEL') return 'env-embedding';
        if (key === 'CHAT_DEFAULT_MODEL') return 'env-chat';
        if (key === 'SEMANTIC_ANALYSIS_MODEL') return 'env-semantic';
        if (key === 'FALLBACK_LLM_MODEL') return 'env-fallback';
        return def;
      });

      // Reload to trigger loadConfig with new mocks
      service.reload();

      expect(service.embeddingModel).toBe('env-embedding');
      expect(service.defaultChatModel).toBe('env-chat');
      expect(service.semanticAnalysisModel).toBe('env-semantic');
      expect(service.fallbackModel).toBe('env-fallback');
    });

    it('should use default values if environment variables are missing', () => {
      mockConfigService.get.mockImplementation((key, def) => def);
      service.reload();

      expect(service.embeddingModel).toBe('text-embedding-ada-002');
      expect(service.defaultChatModel).toBe('gpt-3.5-turbo');
      expect(service.semanticAnalysisModel).toBe('gpt-3.5-turbo');
      expect(service.fallbackModel).toBe('gpt-3.5-turbo');
    });
  });

  describe('reload', () => {
    it('should reload configuration', () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'log');
      service.reload();
      expect(loggerSpy).toHaveBeenCalledWith('Reloading model configuration...');
    });
  });
});
