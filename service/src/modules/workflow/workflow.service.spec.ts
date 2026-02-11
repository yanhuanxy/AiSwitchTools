
import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowService } from './workflow.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrismaService = {
  workflow: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
  },
  workflowVersion: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn((args) => Promise.resolve(args)),
};

describe('WorkflowService', () => {
  let service: WorkflowService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<WorkflowService>(WorkflowService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('publish', () => {
    it('should publish workflow and create version', async () => {
      const userId = 'user1';
      const workflowId = 'wf1';
      const graphData = '{"nodes":[]}';

      mockPrismaService.workflow.findFirst.mockResolvedValue({
        id: workflowId,
        ownerUserId: userId,
        graphData,
        published: false,
      });

      mockPrismaService.workflowVersion.findFirst.mockResolvedValue(null); // No previous versions

      mockPrismaService.workflowVersion.create.mockReturnValue({
        id: 'v1',
        version: 1,
        versionTag: 'v1.0.0',
      });

      mockPrismaService.workflow.update.mockReturnValue({
        id: workflowId,
        published: true,
      });

      const result = await service.publish(workflowId, userId);

      expect(mockPrismaService.workflow.findFirst).toHaveBeenCalledWith({
        where: { id: workflowId, ownerUserId: userId },
      });

      expect(mockPrismaService.workflowVersion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workflowId,
          version: 1,
          versionTag: 'v1.0.0',
          graphData,
          publishedBy: userId,
        }),
      });

      expect(mockPrismaService.workflow.update).toHaveBeenCalledWith({
        where: { id: workflowId },
        data: { published: true },
      });

      expect(result).toBeDefined();
    });

    it('should increment version correctly', async () => {
      const userId = 'user1';
      const workflowId = 'wf1';

      mockPrismaService.workflow.findFirst.mockResolvedValue({
        id: workflowId,
        ownerUserId: userId,
        graphData: '{}',
      });

      mockPrismaService.workflowVersion.findFirst.mockResolvedValue({
        version: 5,
      });

      await service.publish(workflowId, userId);

      expect(mockPrismaService.workflowVersion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          version: 6,
          versionTag: 'v1.0.5',
        }),
      });
    });

    it('should throw if workflow not found', async () => {
      mockPrismaService.workflow.findFirst.mockResolvedValue(null);
      await expect(service.publish('invalid', 'user')).rejects.toThrow('Workflow not found');
    });
  });
});
