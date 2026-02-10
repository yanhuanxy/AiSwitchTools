import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';

@Injectable()
export class KnowledgeBaseService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  create(userId: string, createKnowledgeBaseDto: CreateKnowledgeBaseDto) {
    this.ensurePrisma();
    return this.prisma.knowledgeBase.create({
      data: {
        ...createKnowledgeBaseDto,
        ownerUserId: userId,
      },
    });
  }

  findAll(userId: string) {
    this.ensurePrisma();
    return this.prisma.knowledgeBase.findMany({
      where: { ownerUserId: userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        documents: true,
      }
    });
  }

  findOne(id: string, userId: string) {
    this.ensurePrisma();
    return this.prisma.knowledgeBase.findFirst({
      where: { id, ownerUserId: userId },
      include: {
        documents: true,
      }
    });
  }

  update(id: string, userId: string, updateKnowledgeBaseDto: UpdateKnowledgeBaseDto) {
    this.ensurePrisma();
    return this.prisma.knowledgeBase.updateMany({
      where: { id, ownerUserId: userId },
      data: updateKnowledgeBaseDto,
    });
  }

  remove(id: string, userId: string) {
    this.ensurePrisma();
    return this.prisma.knowledgeBase.deleteMany({
      where: { id, ownerUserId: userId },
    });
  }

  private ensurePrisma() {
    if (!this.prisma) {
      throw new Error('PrismaService is not initialized in KnowledgeBaseService');
    }
    if (!this.prisma.knowledgeBase) {
      throw new Error('PrismaService does not have knowledgeBase model. Please run "prisma generate".');
    }
  }
}
