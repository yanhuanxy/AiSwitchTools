import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { InternalServerErrorException } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';

describe('WorkflowController', () => {
  let controller: WorkflowController;
  let service: WorkflowService;

  const mockWorkflowService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockRequest = {
    user: { id: 'user_123' },
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkflowController],
      providers: [
        {
          provide: WorkflowService,
          useValue: mockWorkflowService,
        },
      ],
    })
    .overrideGuard(AuthGuard)
    .useValue({ canActivate: () => true })
    .compile();

    controller = module.get<WorkflowController>(WorkflowController);
    service = module.get<WorkflowService>(WorkflowService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a workflow', async () => {
      const dto: CreateWorkflowDto = { name: 'Test Workflow', description: 'Test', graphData: '{}' };
      const expectedResult = { id: 'wf_1', ...dto, ownerUserId: 'user_123' };
      
      mockWorkflowService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(mockRequest, dto);

      expect(result).toEqual(expectedResult);
      expect(service.create).toHaveBeenCalledWith('user_123', dto);
    });

    it('should throw error if service is undefined (simulated)', async () => {
       // Manually set service to undefined to test the defensive code
       (controller as any).workflowService = undefined;
       
       expect(() => controller.create(mockRequest, { name: 'test', graphData: '{}' })).toThrow(InternalServerErrorException);
    });
  });
});
