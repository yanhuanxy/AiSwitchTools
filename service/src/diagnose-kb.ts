import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { KnowledgeBaseService } from './modules/knowledge-base/knowledge-base.service';
import { PrismaService } from './prisma/prisma.service';

async function diagnose() {
  console.log('Starting KnowledgeBase Module Diagnostic Check...');
  
  try {
    const app = await NestFactory.createApplicationContext(AppModule);
    console.log('Application Context Created');

    const prismaService = app.get(PrismaService);
    console.log('PrismaService retrieved');
    
    if (!prismaService) {
      console.error('CRITICAL: PrismaService is undefined/null');
    } else {
      console.log('PrismaService is defined');
      
      // Check for knowledgeBase property safely
      if ('knowledgeBase' in prismaService) {
        console.log('SUCCESS: prisma.knowledgeBase exists');
      } else {
        console.error('CRITICAL: prisma.knowledgeBase is MISSING');
      }
    }

    const kbService = app.get(KnowledgeBaseService);
    console.log('KnowledgeBaseService retrieved');
    
    if (!kbService) {
      console.error('CRITICAL: KnowledgeBaseService is undefined/null');
    } else {
       console.log('KnowledgeBaseService is defined');
       // Try to access the injected prisma
       const injectedPrisma = (kbService as any).prisma;
       if (injectedPrisma === prismaService) {
         console.log('SUCCESS: KnowledgeBaseService has correct PrismaService instance');
       } else {
         console.error('CRITICAL: KnowledgeBaseService has INCORRECT PrismaService instance');
       }
       
       if (!injectedPrisma) {
         console.error('CRITICAL: KnowledgeBaseService.prisma is undefined (DI Failed)');
       }
    }

    await app.close();
    console.log('Diagnostic Check Completed');

  } catch (err) {
    console.error('Diagnostic Check Failed with Error:', err);
  }
}

diagnose();
