
import { Test, TestingModule } from '@nestjs/testing';
import { V4ObservabilityController } from './v4-observability.controller';
import { ObservabilityService } from './observability.service';
import { ConfigService } from '@nestjs/config';

describe('V4ObservabilityController', () => {
  let controller: V4ObservabilityController;

  const mockObservabilityService = {
    getMetricsSnapshot: jest.fn().mockReturnValue({ metrics: {} }),
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key, def) => {
        if (key === 'APP_PROFILE') return 'aggregate';
        return def;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [V4ObservabilityController],
      providers: [
        { provide: ObservabilityService, useValue: mockObservabilityService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<V4ObservabilityController>(V4ObservabilityController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('health', () => {
    it('should return UP status', async () => {
      const result = await controller.health();
      expect(result.status).toBe('UP');
      expect(result.version).toBe('4.0.0');
      expect(result.services.database).toBe('UP');
    });
  });

  describe('debug', () => {
    it('should return profile info', async () => {
      const result = await controller.debug();
      expect(result.profile).toBe('aggregate');
    });
  });
});
