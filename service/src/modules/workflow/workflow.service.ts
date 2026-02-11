import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';

@Injectable()
export class WorkflowService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  create(userId: string, createWorkflowDto: CreateWorkflowDto) {
    this.ensurePrisma();
    return this.prisma.workflow.create({
      data: {
        ...createWorkflowDto,
        ownerUserId: userId,
      },
    });
  }

  findAll(userId: string) {
    this.ensurePrisma();
    return this.prisma.workflow.findMany({
      where: { ownerUserId: userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  findOne(id: string, userId: string) {
    this.ensurePrisma();
    return this.prisma.workflow.findFirst({
      where: { id, ownerUserId: userId },
    });
  }

  update(id: string, userId: string, updateWorkflowDto: UpdateWorkflowDto) {
    this.ensurePrisma();
    return this.prisma.workflow.updateMany({
      where: { id, ownerUserId: userId },
      data: updateWorkflowDto,
    });
  }

  async publish(id: string, userId: string) {
    this.ensurePrisma();
    
    // 1. Get workflow
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, ownerUserId: userId },
    });

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // 2. Determine new version
    const lastVersion = await this.prisma.workflowVersion.findFirst({
      where: { workflowId: id },
      orderBy: { version: 'desc' },
    });

    const newVersion = (lastVersion?.version || 0) + 1;
    const versionTag = `v1.0.${newVersion - 1}`; // Simple semver simulation

    // 3. Create version and update workflow
    const [version] = await this.prisma.$transaction([
      this.prisma.workflowVersion.create({
        data: {
          workflowId: id,
          version: newVersion,
          versionTag,
          graphData: workflow.graphData,
          publishedBy: userId,
        },
      }),
      this.prisma.workflow.update({
        where: { id },
        data: { published: true },
      }),
    ]);

    return version;
  }

  remove(id: string, userId: string) {
    this.ensurePrisma();
    return this.prisma.workflow.deleteMany({
      where: { id, ownerUserId: userId },
    });
  }

  private ensurePrisma() {
    if (!this.prisma) {
      throw new Error('PrismaService is not initialized in WorkflowService');
    }
    if (!this.prisma.workflow) {
      throw new Error('PrismaService does not have workflow model. Please run "prisma generate".');
    }
  }
}
