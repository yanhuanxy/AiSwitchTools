import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';

@Injectable()
export class WorkflowService {
  constructor(private prisma: PrismaService) {}

  create(userId: string, createWorkflowDto: CreateWorkflowDto) {
    return this.prisma.workflow.create({
      data: {
        ...createWorkflowDto,
        ownerUserId: userId,
      },
    });
  }

  findAll(userId: string) {
    return this.prisma.workflow.findMany({
      where: { ownerUserId: userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  findOne(id: string, userId: string) {
    return this.prisma.workflow.findFirst({
      where: { id, ownerUserId: userId },
    });
  }

  update(id: string, userId: string, updateWorkflowDto: UpdateWorkflowDto) {
    return this.prisma.workflow.updateMany({
      where: { id, ownerUserId: userId },
      data: updateWorkflowDto,
    });
  }

  remove(id: string, userId: string) {
    return this.prisma.workflow.deleteMany({
      where: { id, ownerUserId: userId },
    });
  }
}
