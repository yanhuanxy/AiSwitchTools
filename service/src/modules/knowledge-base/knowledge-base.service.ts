import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';

@Injectable()
export class KnowledgeBaseService {
  constructor(private prisma: PrismaService) {}

  create(userId: string, createKnowledgeBaseDto: CreateKnowledgeBaseDto) {
    return this.prisma.knowledgeBase.create({
      data: {
        ...createKnowledgeBaseDto,
        ownerUserId: userId,
      },
    });
  }

  findAll(userId: string) {
    return this.prisma.knowledgeBase.findMany({
      where: { ownerUserId: userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        documents: true,
      }
    });
  }

  findOne(id: string, userId: string) {
    return this.prisma.knowledgeBase.findFirst({
      where: { id, ownerUserId: userId },
      include: {
        documents: true,
      }
    });
  }

  update(id: string, userId: string, updateKnowledgeBaseDto: UpdateKnowledgeBaseDto) {
    return this.prisma.knowledgeBase.updateMany({
      where: { id, ownerUserId: userId },
      data: updateKnowledgeBaseDto,
    });
  }

  remove(id: string, userId: string) {
    return this.prisma.knowledgeBase.deleteMany({
      where: { id, ownerUserId: userId },
    });
  }
}
